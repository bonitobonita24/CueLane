// T0 fix (Wave 7.3 pre-flight) — TDD test proving `prisma/seed.ts` emits REAL Prisma cuids for
// every seeded row (never the old literal `seed-svc-<tenantId>-name` style strings), and that
// re-running the seed is idempotent (same row identities, no duplicates).
//
// This was a hard BLOCKER documented by Wave 7.1-T4's queue.integration.test.ts: every shared
// zod schema validates id fields with `z.string().cuid()`, so a kiosk call referencing a seeded
// serviceId would 400 at input validation before ever reaching a resolver.
//
// Runs the REAL `tsx prisma/seed.ts` CLI entry point (no mocks, exercises the exact path
// `pnpm --filter @cuelane/db db:seed` runs) against the REAL dev Postgres DB, then inspects the
// resulting rows via `prismaRaw` — same no-mocks convention as every other test in this repo.
//
// Wave 7.6-T9 — seed.ts now seeds the enriched `demo` tenant (8 services / 5 windows / 6 users /
// 9 tickets) PLUS a second free-tier `clinic` tenant. This file only asserts `demo`'s counts
// (its own natural-key idempotency); `clinic`'s counts are covered by the Wave 7.6-T9 seed smoke
// check (see docs/PRODUCT.md / STATE.md), not duplicated here.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prismaRaw } from '../src/index';

const CUID_RE = /^c[a-z0-9]{24}$/;
const PACKAGE_ROOT = path.resolve(__dirname, '..');

function runSeed(): void {
  execFileSync('pnpm', ['exec', 'tsx', 'prisma/seed.ts'], {
    cwd: PACKAGE_ROOT,
    env: process.env,
    stdio: 'pipe',
  });
}

describe('prisma/seed.ts (T0 — real-cuid ids + idempotent reseed)', () => {
  beforeAll(async () => {
    // Start from a clean slate: delete any pre-existing demo tenant (cascades to every child row
    // — Service/Window/User/Ticket/Subscription/SequenceCounter all have onDelete: Cascade from
    // Tenant in schema.prisma).
    await prismaRaw.tenant.deleteMany({ where: { slug: 'demo' } });
  });

  afterAll(async () => {
    await prismaRaw.$disconnect();
  });

  it('creates every seeded row with a real Prisma cuid, never a literal id', () => {
    runSeed();
    return (async () => {
      const tenant = await prismaRaw.tenant.findUniqueOrThrow({ where: { slug: 'demo' } });
      expect(tenant.id).toMatch(CUID_RE);

      const services = await prismaRaw.service.findMany({ where: { tenantId: tenant.id } });
      expect(services.length).toBe(8);
      for (const s of services) expect(s.id).toMatch(CUID_RE);

      const windows = await prismaRaw.window.findMany({ where: { tenantId: tenant.id } });
      expect(windows.length).toBe(5);
      for (const w of windows) expect(w.id).toMatch(CUID_RE);

      const users = await prismaRaw.user.findMany({ where: { tenantId: tenant.id } });
      expect(users.length).toBe(6);
      for (const u of users) expect(u.id).toMatch(CUID_RE);

      const tickets = await prismaRaw.ticket.findMany({ where: { tenantId: tenant.id } });
      expect(tickets.length).toBe(9);
      for (const t of tickets) expect(t.id).toMatch(CUID_RE);
    })();
  });

  it('is idempotent — re-running the seed does not duplicate rows or change ids', async () => {
    const before = await prismaRaw.tenant.findUniqueOrThrow({ where: { slug: 'demo' } });
    const servicesBefore = await prismaRaw.service.findMany({
      where: { tenantId: before.id },
      orderBy: { number: 'asc' },
    });
    const windowsBefore = await prismaRaw.window.findMany({
      where: { tenantId: before.id },
      orderBy: { name: 'asc' },
    });
    const usersBefore = await prismaRaw.user.findMany({
      where: { tenantId: before.id },
      orderBy: { name: 'asc' },
    });
    const ticketsBefore = await prismaRaw.ticket.findMany({
      where: { tenantId: before.id },
      orderBy: { id: 'asc' },
    });

    runSeed();

    const servicesAfter = await prismaRaw.service.findMany({
      where: { tenantId: before.id },
      orderBy: { number: 'asc' },
    });
    const windowsAfter = await prismaRaw.window.findMany({
      where: { tenantId: before.id },
      orderBy: { name: 'asc' },
    });
    const usersAfter = await prismaRaw.user.findMany({
      where: { tenantId: before.id },
      orderBy: { name: 'asc' },
    });
    const ticketsAfter = await prismaRaw.ticket.findMany({
      where: { tenantId: before.id },
      orderBy: { id: 'asc' },
    });

    expect(servicesAfter.map((s) => s.id)).toEqual(servicesBefore.map((s) => s.id));
    expect(windowsAfter.map((w) => w.id)).toEqual(windowsBefore.map((w) => w.id));
    expect(usersAfter.map((u) => u.id)).toEqual(usersBefore.map((u) => u.id));
    expect(ticketsAfter.map((t) => t.id)).toEqual(ticketsBefore.map((t) => t.id));
    expect(servicesAfter.length).toBe(servicesBefore.length);
    expect(windowsAfter.length).toBe(windowsBefore.length);
    expect(usersAfter.length).toBe(usersBefore.length);
    expect(ticketsAfter.length).toBe(ticketsBefore.length);
  });
});
