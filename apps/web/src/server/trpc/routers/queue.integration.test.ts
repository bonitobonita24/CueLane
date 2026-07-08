// Wave 7.1-T4 — cross-cutting integration test against the REAL seeded `demo` tenant (no mocks,
// no ephemeral fixture tenant — this is the ground-truth check the roadmap asks for).
//
// ⚠ FINDING (pre-existing, not introduced by Wave 7.1): packages/db/prisma/seed.ts assigns
// custom, human-readable, NON-CUID string ids to every seeded row (e.g.
// `seed-svc-<tenantId>-cash-deposit`, `seed-win-<tenantId>-window-1`), but every shared zod
// schema validates id fields with `idSchema = z.string().cuid()`. That means NO tRPC procedure
// using idSchema (serviceId/windowId/ticketId/userId — i.e. nearly everything) can ever be
// called against a raw seeded Service/Window/User/Ticket row — it fails "Invalid cuid" at the
// input-validation layer before it even reaches a resolver. This will block the Wave 7.3+
// kiosk/station UI from working against the seeded demo tenant once wired up, unless seed.ts's
// id strategy is revisited (e.g. real cuids + find-by-natural-key for reseed idempotency,
// instead of custom deterministic ids). Flagged to the PM; out of scope to fix here.
//
// Workaround for this test: every fixture below (services, windows, employee) is created here
// via prismaRaw.*.create() with no custom id, so Prisma's `@default(cuid())` produces real
// cuids — while still operating inside the REAL demo tenant (same tenantId, same Tenant.tier
// premium gate, same SequenceCounter mechanics, same L2/L6 guards) — so this remains a
// ground-truth test against real seeded state, not an isolated fixture tenant like T2/T3.
//
// Numbering note: `demo` already has a ticket consuming "P-001" (priority) from seed.ts's
// direct field assignment — seed.ts now also reserves a matching SequenceCounter row (see
// seed.ts's "SequenceCounter reservations" section) so live issuance never collides with it.
// The priority assertion below is therefore RELATIVE to the real counter state read at
// beforeAll (not a hardcoded literal), proving the atomic allocator is correct in the presence
// of real pre-existing data — a strictly stronger check than a clean-DB literal would be.
import { beforeAll, describe, expect, it } from 'vitest';
import type { NextRequest } from 'next/server';
import { prismaRaw } from '@cuelane/db';
import { Role } from '@cuelane/shared';
import { appRouter } from '../root';
import { createCallerFactory } from '../trpc';
import type { Context } from '../context';
import { pad3, todayKey } from '@/server/domain/queue';

const createCaller = createCallerFactory(appRouter);

function fakeReq(): NextRequest {
  return { headers: new Headers() } as unknown as NextRequest;
}

function ctxFor(overrides: Partial<Context>): Context {
  return { session: null, userId: null, roles: [], tenantId: null, req: fakeReq(), ...overrides };
}

describe('queue integration (Wave 7.1-T4, against the seeded demo tenant)', () => {
  let tenantId: string;
  let svcNumberingA: { id: string; number: number };
  let svcNumberingB: { id: string; number: number };
  let priorityCounterBefore: number;

  let transferSvcId: string;
  let transferEmployeeId: string;
  let windowOriginId: string;
  let windowDestId: string;

  beforeAll(async () => {
    const tenant = await prismaRaw.tenant.findUniqueOrThrow({ where: { slug: 'demo' } });
    tenantId = tenant.id;
    expect(tenant.tier).toBe('premium'); // ground-truth precondition for the Return-After-Done assertion below

    const priorityCounter = await prismaRaw.sequenceCounter.findUnique({
      where: { tenantId_key: { tenantId, key: `priority:${todayKey()}` } },
    });
    priorityCounterBefore = priorityCounter?.value ?? 0;

    const nextNumber = async (): Promise<number> => {
      const agg = await prismaRaw.service.aggregate({ where: { tenantId }, _max: { number: true } });
      return (agg._max.number ?? 0) + 1;
    };

    // Fresh, real-cuid fixtures inside the real demo tenant — see file header for why raw
    // seeded rows can't be used with the idSchema-validated procedures.
    svcNumberingA = await prismaRaw.service.create({
      data: { tenantId, number: await nextNumber(), name: 'T4 Numbering A', icon: 'A', color: '#111111', avgTime: 5 },
    });
    svcNumberingB = await prismaRaw.service.create({
      data: { tenantId, number: await nextNumber(), name: 'T4 Numbering B', icon: 'B', color: '#222222', avgTime: 5 },
    });

    const svc = await prismaRaw.service.create({
      data: { tenantId, number: await nextNumber(), name: 'T4 Transfer Fixture', icon: 'T', color: '#555555', avgTime: 5 },
    });
    transferSvcId = svc.id;

    const employee = await prismaRaw.user.create({
      data: { tenantId, name: 'T4 Fixture Employee', role: 'employee', pin: 'x' },
    });
    transferEmployeeId = employee.id;
    await prismaRaw.userService.create({ data: { tenantId, userId: employee.id, serviceId: svc.id } });

    const winO = await prismaRaw.window.create({ data: { tenantId, name: 'T4 Origin Window' } });
    const winD = await prismaRaw.window.create({ data: { tenantId, name: 'T4 Destination Window' } });
    windowOriginId = winO.id;
    windowDestId = winD.id;
  });

  it('issues 2 regular tickets on services with no prior demo activity — correct service-number prefix', async () => {
    const kioskCaller = createCaller(ctxFor({}));

    const r1 = await kioskCaller.queue.issue({ tenantSlug: 'demo', serviceId: svcNumberingA.id, priority: false });
    const r2 = await kioskCaller.queue.issue({ tenantSlug: 'demo', serviceId: svcNumberingB.id, priority: false });

    // Both services were just created — genuinely clean counters, so the literal "-001" is
    // ground truth here (not a hardcoded guess about shared/contested state).
    expect(r1.number).toBe(`${svcNumberingA.number}-001`);
    expect(r2.number).toBe(`${svcNumberingB.number}-001`);
  });

  it("issues a priority ticket on the real tenant-wide P-NNN sequence (relative to demo's existing counter)", async () => {
    const kioskCaller = createCaller(ctxFor({}));
    const result = await kioskCaller.queue.issue({ tenantSlug: 'demo', serviceId: svcNumberingA.id, priority: true });

    // demo's seed already consumed at least P-001 — the counter genuinely continues from
    // there, proving the atomic allocator is correct in the presence of real pre-existing data.
    expect(result.number).toBe(`P-${pad3(priorityCounterBefore + 1)}`);
    expect(result.number.startsWith('P-')).toBe(true);
  });

  it('callNext serves the priority ticket before an older regular ticket', async () => {
    const kioskCaller = createCaller(ctxFor({}));
    const staffCaller = createCaller(
      ctxFor({
        session: { user: { id: transferEmployeeId } } as unknown as Context['session'],
        userId: transferEmployeeId,
        roles: [Role.Employee],
        tenantId,
      }),
    );

    const older = await kioskCaller.queue.issue({ tenantSlug: 'demo', serviceId: transferSvcId, priority: false });
    const priority = await kioskCaller.queue.issue({ tenantSlug: 'demo', serviceId: transferSvcId, priority: true });

    const first = await staffCaller.queue.callNext({ windowId: windowOriginId });
    expect(first?.id).toBe(priority.ticketId);
    expect(first?.status).toBe('serving');
    await staffCaller.queue.complete({ ticketId: priority.ticketId, outcome: 'done' });

    const second = await staffCaller.queue.callNext({ windowId: windowOriginId });
    expect(second?.id).toBe(older.ticketId);
    expect(second?.priority).toBe(false);
    await staffCaller.queue.complete({ ticketId: older.ticketId, outcome: 'done' });
  });

  it('transfer with Return-After-Done → destination completes → ticket requeues to the origin window as serving', async () => {
    const kioskCaller = createCaller(ctxFor({}));
    const staffCaller = createCaller(
      ctxFor({
        session: { user: { id: transferEmployeeId } } as unknown as Context['session'],
        userId: transferEmployeeId,
        roles: [Role.Employee],
        tenantId,
      }),
    );

    const issued = await kioskCaller.queue.issue({ tenantSlug: 'demo', serviceId: transferSvcId, priority: false });
    const called = await staffCaller.queue.callNext({ windowId: windowOriginId });
    expect(called?.id).toBe(issued.ticketId);

    const transferred = await staffCaller.queue.transfer({
      ticketId: issued.ticketId,
      toWindowId: windowDestId,
      returnAfterDone: true,
      returnToWindowId: windowOriginId,
    });
    expect(transferred.windowId).toBe(windowDestId);
    expect(transferred.returnTo).toBe(windowOriginId);

    const autoReturned = await staffCaller.queue.complete({ ticketId: issued.ticketId, outcome: 'done' });
    expect(autoReturned.status).toBe('serving');
    expect(autoReturned.windowId).toBe(windowOriginId); // requeued to the ORIGIN window — ground truth

    const finalCompletion = await staffCaller.queue.complete({ ticketId: issued.ticketId, outcome: 'done' });
    expect(finalCompletion.status).toBe('completed');
  });
});
