// Wave 7.1-T2 — queue domain unit tests (TDD: written before queue.ts implementation).
// Runs against the REAL dev Postgres DB (no mocks) in an isolated, ephemeral fixture tenant —
// created in beforeAll and torn down in afterAll — so numbering assertions can use exact
// literal values ("1-001" etc.) without colliding with the persistent seeded `demo` tenant.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prismaRaw, withTenant } from '@cuelane/db';
import { callNext, complete, issueTicket, pad3, QueueDomainError, recall, skip, todayKey, transfer } from './queue';

describe('queue domain (Wave 7.1)', () => {
  let tenantId: string;
  let serviceA: { id: string; number: number };
  let serviceB: { id: string; number: number };
  let windowOrigin: string;
  let windowDest: string;
  let userId: string;
  let serviceCounter = 10;

  // A dedicated fresh service per callNext/skip/recall/transfer test — keeps each test's waiting
  // pool empty so callNext deterministically picks the ticket THIS test issued, independent of
  // ticket state left behind by other tests in this file (e.g. the numbering tests intentionally
  // leave tickets in `waiting`).
  async function freshService(): Promise<{ id: string; number: number }> {
    serviceCounter += 1;
    return prismaRaw.service.create({
      data: { tenantId, number: serviceCounter, name: `Fresh ${serviceCounter}`, icon: 'F', color: '#333333', avgTime: 5 },
    });
  }

  beforeAll(async () => {
    const tenant = await prismaRaw.tenant.create({
      data: {
        slug: `test-queue-${Date.now()}`,
        companyName: 'Queue Test Co.',
        tagline: 'test fixture',
        tier: 'premium',
      },
    });
    tenantId = tenant.id;

    serviceA = await prismaRaw.service.create({
      data: { tenantId, number: 1, name: 'Service A', icon: 'A', color: '#111111', avgTime: 5 },
    });
    serviceB = await prismaRaw.service.create({
      data: { tenantId, number: 2, name: 'Service B', icon: 'B', color: '#222222', avgTime: 5 },
    });

    const winO = await prismaRaw.window.create({ data: { tenantId, name: 'Origin' } });
    const winD = await prismaRaw.window.create({ data: { tenantId, name: 'Destination' } });
    windowOrigin = winO.id;
    windowDest = winD.id;

    const user = await prismaRaw.user.create({
      data: { tenantId, name: 'Test Employee', role: 'employee', pin: 'x' },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prismaRaw.tenant.delete({ where: { id: tenantId } }); // cascades to services/windows/users/tickets
  });

  it('pad3 zero-pads to 3 digits', () => {
    expect(pad3(1)).toBe('001');
    expect(pad3(23)).toBe('023');
    expect(pad3(456)).toBe('456');
  });

  it('todayKey returns a stable 8-digit YYYYMMDD string', () => {
    expect(todayKey()).toMatch(/^\d{8}$/);
    expect(todayKey(new Date('2026-01-05T12:00:00Z'))).toBe('20260105');
  });

  it('issues sequential regular tickets, 3-digit padded, prefixed by the service number', async () => {
    const r1 = await withTenant(tenantId, (tx) => issueTicket({ serviceId: serviceA.id, priority: false }, { tenantId, tx }));
    const r2 = await withTenant(tenantId, (tx) => issueTicket({ serviceId: serviceA.id, priority: false }, { tenantId, tx }));

    expect(r1.ticket.number).toBe('1-001');
    expect(r1.ticket.sequence).toBe(1);
    expect(r2.ticket.number).toBe('1-002');
    expect(r2.ticket.sequence).toBe(2);
    expect(r1.events).toEqual([{ type: 'ticket.issued', tenantId, ticketId: r1.ticket.id, payload: { number: '1-001' } }]);
  });

  it('issues priority tickets on a separate tenant-wide P-NNN sequence', async () => {
    const r1 = await withTenant(tenantId, (tx) => issueTicket({ serviceId: serviceB.id, priority: true }, { tenantId, tx }));
    expect(r1.ticket.number).toBe('P-001');
    expect(r1.ticket.priority).toBe(true);
  });

  it('allocates distinct sequences under 2 concurrent issues for the same service+day (race-safe)', async () => {
    const [a, b] = await Promise.all([
      withTenant(tenantId, (tx) => issueTicket({ serviceId: serviceB.id, priority: false }, { tenantId, tx })),
      withTenant(tenantId, (tx) => issueTicket({ serviceId: serviceB.id, priority: false }, { tenantId, tx })),
    ]);
    expect(new Set([a.ticket.sequence, b.ticket.sequence]).size).toBe(2);
    expect([a.ticket.number, b.ticket.number].sort()).toEqual(['2-001', '2-002']);
  });

  it('rejects issueTicket for a service that does not belong to the tenant', async () => {
    await expect(
      withTenant(tenantId, (tx) => issueTicket({ serviceId: 'nonexistent-service-id', priority: false }, { tenantId, tx })),
    ).rejects.toBeInstanceOf(QueueDomainError);
    await expect(
      withTenant(tenantId, (tx) => issueTicket({ serviceId: 'nonexistent-service-id', priority: false }, { tenantId, tx })),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('callNext returns null when there is nothing waiting for the given services', async () => {
    const result = await withTenant(tenantId, (tx) =>
      callNext({ windowId: windowOrigin, userId, serviceIds: ['no-such-service'] }, { tenantId, tx }),
    );
    expect(result.ticket).toBeNull();
    expect(result.events).toEqual([]);
  });

  it('callNext serves priority tickets before older regular tickets (priority DESC, then FIFO)', async () => {
    const svc = await freshService();
    const older = await withTenant(tenantId, (tx) => issueTicket({ serviceId: svc.id, priority: false }, { tenantId, tx }));
    const priority = await withTenant(tenantId, (tx) => issueTicket({ serviceId: svc.id, priority: true }, { tenantId, tx }));

    const first = await withTenant(tenantId, (tx) =>
      callNext({ windowId: windowOrigin, userId, serviceIds: [svc.id] }, { tenantId, tx }),
    );
    expect(first.ticket?.id).toBe(priority.ticket.id);
    expect(first.ticket?.status).toBe('serving');
    expect(first.events[0]?.type).toBe('ticket.called');

    await withTenant(tenantId, (tx) => complete({ ticketId: first.ticket!.id, outcome: 'done' }, { tenantId, tx }));

    const second = await withTenant(tenantId, (tx) =>
      callNext({ windowId: windowOrigin, userId, serviceIds: [svc.id] }, { tenantId, tx }),
    );
    expect(second.ticket?.id).toBe(older.ticket.id);

    await withTenant(tenantId, (tx) => complete({ ticketId: second.ticket!.id, outcome: 'done' }, { tenantId, tx }));
  });

  it('skip transitions a serving ticket to skipped', async () => {
    const svc = await freshService();
    const issued = await withTenant(tenantId, (tx) => issueTicket({ serviceId: svc.id, priority: false }, { tenantId, tx }));
    await withTenant(tenantId, (tx) => callNext({ windowId: windowOrigin, userId, serviceIds: [svc.id] }, { tenantId, tx }));
    const skipped = await withTenant(tenantId, (tx) => skip({ ticketId: issued.ticket.id }, { tenantId, tx }));
    expect(skipped.ticket.status).toBe('skipped');
    expect(skipped.events[0]?.type).toBe('ticket.skipped');
  });

  it('skip rejects a ticket that is not currently serving', async () => {
    const svc = await freshService();
    const issued = await withTenant(tenantId, (tx) => issueTicket({ serviceId: svc.id, priority: false }, { tenantId, tx }));
    await expect(withTenant(tenantId, (tx) => skip({ ticketId: issued.ticket.id }, { tenantId, tx }))).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('recall re-announces a serving ticket (bumps calledAt) without changing its status', async () => {
    const svc = await freshService();
    const issued = await withTenant(tenantId, (tx) => issueTicket({ serviceId: svc.id, priority: false }, { tenantId, tx }));
    const called = await withTenant(tenantId, (tx) =>
      callNext({ windowId: windowOrigin, userId, serviceIds: [svc.id] }, { tenantId, tx }),
    );
    const before = called.ticket!.calledAt!;
    await new Promise((r) => setTimeout(r, 5));
    const recalled = await withTenant(tenantId, (tx) => recall({ ticketId: called.ticket!.id }, { tenantId, tx }));
    expect(recalled.ticket.status).toBe('serving');
    expect(recalled.ticket.calledAt!.getTime()).toBeGreaterThan(before.getTime());
    expect(recalled.events[0]?.type).toBe('ticket.recalled');
  });

  it('transfer moves a serving ticket to the destination window (PRODUCT.md: immediately serving)', async () => {
    const svc = await freshService();
    const issued = await withTenant(tenantId, (tx) => issueTicket({ serviceId: svc.id, priority: false }, { tenantId, tx }));
    await withTenant(tenantId, (tx) => callNext({ windowId: windowOrigin, userId, serviceIds: [svc.id] }, { tenantId, tx }));

    const transferred = await withTenant(tenantId, (tx) =>
      transfer({ ticketId: issued.ticket.id, toWindowId: windowDest, returnAfterDone: false }, { tenantId, tx }),
    );
    expect(transferred.ticket.windowId).toBe(windowDest);
    expect(transferred.ticket.status).toBe('serving');
    expect(transferred.ticket.transferred).toBe(true);
    expect(transferred.ticket.transferredFrom).toBe(windowOrigin);
    expect(transferred.ticket.returnTo).toBeNull();

    // Not Return-After-Done: a normal "done" completion just completes it.
    const done = await withTenant(tenantId, (tx) => complete({ ticketId: issued.ticket.id, outcome: 'done' }, { tenantId, tx }));
    expect(done.ticket.status).toBe('completed');
  });

  it('transfer + Return-After-Done: destination completes → ticket auto-returns to origin window as serving (PRODUCT.md line 32)', async () => {
    const svc = await freshService();
    const issued = await withTenant(tenantId, (tx) => issueTicket({ serviceId: svc.id, priority: false }, { tenantId, tx }));
    await withTenant(tenantId, (tx) => callNext({ windowId: windowOrigin, userId, serviceIds: [svc.id] }, { tenantId, tx }));

    const transferred = await withTenant(tenantId, (tx) =>
      transfer(
        { ticketId: issued.ticket.id, toWindowId: windowDest, returnAfterDone: true, returnToWindowId: windowOrigin },
        { tenantId, tx },
      ),
    );
    expect(transferred.ticket.returnTo).toBe(windowOrigin);

    const autoReturned = await withTenant(tenantId, (tx) =>
      complete({ ticketId: issued.ticket.id, outcome: 'done' }, { tenantId, tx }),
    );
    expect(autoReturned.ticket.status).toBe('serving');
    expect(autoReturned.ticket.windowId).toBe(windowOrigin);
    expect(autoReturned.ticket.returnedFromTransfer).toBe(true);
    expect(autoReturned.events[0]?.type).toBe('ticket.called');

    // Second completion (at the origin, after the auto-return) finalizes for real — the
    // returnedFromTransfer guard prevents an infinite return loop.
    const finalCompletion = await withTenant(tenantId, (tx) =>
      complete({ ticketId: issued.ticket.id, outcome: 'done' }, { tenantId, tx }),
    );
    expect(finalCompletion.ticket.status).toBe('completed');
    expect(finalCompletion.events[0]?.type).toBe('ticket.completed');
  });

  it('No Show at destination clears the returnTo flag — no auto-return for abandoned tickets (PRODUCT.md line 32)', async () => {
    const svc = await freshService();
    const issued = await withTenant(tenantId, (tx) => issueTicket({ serviceId: svc.id, priority: false }, { tenantId, tx }));
    await withTenant(tenantId, (tx) => callNext({ windowId: windowOrigin, userId, serviceIds: [svc.id] }, { tenantId, tx }));
    await withTenant(tenantId, (tx) =>
      transfer(
        { ticketId: issued.ticket.id, toWindowId: windowDest, returnAfterDone: true, returnToWindowId: windowOrigin },
        { tenantId, tx },
      ),
    );
    const result = await withTenant(tenantId, (tx) => complete({ ticketId: issued.ticket.id, outcome: 'noshow' }, { tenantId, tx }));
    expect(result.ticket.status).toBe('noshow');
    expect(result.ticket.returnTo).toBeNull();
    expect(result.events[0]?.type).toBe('ticket.noshow');
  });

  it('transfer rejects a ticket that is not currently serving', async () => {
    const svc = await freshService();
    const issued = await withTenant(tenantId, (tx) => issueTicket({ serviceId: svc.id, priority: false }, { tenantId, tx }));
    await expect(
      withTenant(tenantId, (tx) => transfer({ ticketId: issued.ticket.id, toWindowId: windowDest, returnAfterDone: false }, { tenantId, tx })),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});
