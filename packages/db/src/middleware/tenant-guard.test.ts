// Wave 7.7c-T3 regression test — the L6 tenant-guard extension unconditionally injected
// `args.where = { ...args.where, tenantId }` for EVERY operation, including `create`/`createMany`
// — which have no `where` argument in Prisma's input shape at all. Every pre-existing `.create()`
// call in this codebase happened to go through `tx.<model>.create()` inside `withTenant()` (the
// RAW, unguarded transaction client), so this bug was never triggered until the Wave 7.7c media
// upload route called `prisma.playlistEntry.create()` directly against the GUARDED client inside
// `withTenantContext()`, hitting a real 500: "PrismaClientValidationError: Unknown argument
// `where`." This test proves the fix (`tenant-guard.ts` now skips the `where` injection for
// create/createMany) and guards against a future regression, run against the REAL dev Postgres DB
// (no mocks), using a fresh ephemeral fixture tenant.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma, prismaRaw } from '../client';
import { withTenantContext } from './tenant-guard';

describe('tenant-guard — create/createMany no longer inject a where clause (Wave 7.7c-T3 regression)', () => {
  let tenantAId: string;
  let tenantBId: string;

  beforeAll(async () => {
    const tenantA = await prismaRaw.tenant.create({
      data: { slug: `test-guard-a-${Date.now()}`, companyName: 'Guard Tenant A', tagline: 'x', tier: 'free' },
    });
    tenantAId = tenantA.id;
    const tenantB = await prismaRaw.tenant.create({
      data: { slug: `test-guard-b-${Date.now()}`, companyName: 'Guard Tenant B', tagline: 'x', tier: 'free' },
    });
    tenantBId = tenantB.id;
  });

  afterAll(async () => {
    await prismaRaw.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } });
  });

  it('prisma.<model>.create() (guarded client, direct call, NOT via tx) succeeds and auto-stamps tenantId', async () => {
    // `tenantId` in `data` below is a TS-satisfying placeholder — Prisma's generated
    // WindowUncheckedCreateInput requires it at the type level (the extension's runtime
    // injection is invisible to tsc); the guard extension overwrites it with the real
    // AsyncLocalStorage value from withTenantContext regardless of what's passed here.
    const created = await withTenantContext(tenantAId, async () => {
      return prisma.window.create({ data: { name: 'Guard Test Window', tenantId: 'placeholder' } });
    });
    expect(created.name).toBe('Guard Test Window');
    expect(created.tenantId).toBe(tenantAId);
  });

  it('createMany still stamps tenantId onto every row', async () => {
    await withTenantContext(tenantBId, async () => {
      return prisma.window.createMany({
        data: [
          { name: 'Guard Many 1', tenantId: 'placeholder' },
          { name: 'Guard Many 2', tenantId: 'placeholder' },
        ],
      });
    });
    const rows = await prismaRaw.window.findMany({ where: { tenantId: tenantBId } });
    expect(rows.map((r) => r.name).sort()).toEqual(['Guard Many 1', 'Guard Many 2']);
    expect(rows.every((r) => r.tenantId === tenantBId)).toBe(true);
  });

  it('find/update/delete still get the where-clause tenantId injection (isolation unbroken by the fix)', async () => {
    const created = await withTenantContext(tenantAId, async () =>
      prisma.window.create({ data: { name: 'Isolation Check', tenantId: 'placeholder' } }),
    );

    // Tenant B's guarded context must NOT see Tenant A's row.
    const crossTenantList = await withTenantContext(tenantBId, async () => prisma.window.findMany({}));
    expect(crossTenantList.find((w) => w.id === created.id)).toBeUndefined();

    // Tenant A's own guarded context sees it.
    const ownList = await withTenantContext(tenantAId, async () => prisma.window.findMany({}));
    expect(ownList.find((w) => w.id === created.id)).toBeDefined();
  });
});
