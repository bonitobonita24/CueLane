// Wave 7.8-T1 — superAdminRouter tRPC tests (TDD). Highest-privilege surface in the app: every
// procedure MUST forbid a non-super-admin caller (unauth AND a real tenant admin) — a broken guard
// here exposes every tenant on the platform. Mirrors tenantAd.test.ts's fixture conventions.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NextRequest } from 'next/server';
import { prismaRaw } from '@cuelane/db';
import { Role, AdType, TenantTier, TenantStatus } from '@cuelane/shared';
import { appRouter } from '../root';
import { createCallerFactory } from '../trpc';
import type { Context } from '../context';

const createCaller = createCallerFactory(appRouter);

function fakeReq(): NextRequest {
  return { headers: new Headers() } as unknown as NextRequest;
}
function ctxFor(overrides: Partial<Context>): Context {
  return { session: null, userId: null, roles: [], tenantId: null, req: fakeReq(), ...overrides };
}
function superAdminCaller() {
  return createCaller(
    ctxFor({
      session: { user: { id: 'super-admin' } } as unknown as Context['session'],
      userId: 'super-admin',
      roles: [Role.TenantManager],
      tenantId: null,
    }),
  );
}
function tenantAdminCaller(tenantId: string, userId: string) {
  return createCaller(
    ctxFor({ session: { user: { id: userId } } as unknown as Context['session'], userId, roles: [Role.TenantSuperadmin], tenantId }),
  );
}
function unauthCaller() {
  return createCaller(ctxFor({}));
}

describe('superAdminRouter (Wave 7.8-T1)', () => {
  let tenantId: string;
  let adminId: string;

  beforeAll(async () => {
    const tenant = await prismaRaw.tenant.create({
      data: { slug: `test-sa-${Date.now()}`, companyName: 'Super Admin Test Co.', tagline: 'x', tier: 'free' },
    });
    tenantId = tenant.id;
    adminId = (await prismaRaw.user.create({ data: { tenantId, name: 'SA Test Admin', role: 'tenant_superadmin', pin: 'x' } })).id;
  });

  afterAll(async () => {
    await prismaRaw.systemAd.deleteMany({ where: { title: { startsWith: 'SA Test' } } });
    await prismaRaw.tenant.deleteMany({ where: { id: tenantId } });
  });

  describe('privilege-escalation guard — every procedure denies a non-super-admin', () => {
    it('an unauthenticated caller is UNAUTHORIZED on every procedure', async () => {
      const anon = unauthCaller();
      await expect(anon.superAdmin.listTenants()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
      await expect(anon.superAdmin.platformStats()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
      await expect(anon.superAdmin.listSystemAds()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
      await expect(
        anon.superAdmin.setTier({ tenantId, tier: TenantTier.Premium }),
      ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    });

    it('a real tenant Admin (not Super Admin) is FORBIDDEN on every procedure', async () => {
      const admin = tenantAdminCaller(tenantId, adminId);
      await expect(admin.superAdmin.listTenants()).rejects.toMatchObject({ code: 'FORBIDDEN' });
      await expect(admin.superAdmin.getTenant({ id: tenantId })).rejects.toMatchObject({ code: 'FORBIDDEN' });
      await expect(
        admin.superAdmin.setTier({ tenantId, tier: TenantTier.Premium }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      await expect(
        admin.superAdmin.setStatus({ tenantId, status: TenantStatus.Suspended }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      await expect(admin.superAdmin.platformStats()).rejects.toMatchObject({ code: 'FORBIDDEN' });
      await expect(admin.superAdmin.listSystemAds()).rejects.toMatchObject({ code: 'FORBIDDEN' });
      await expect(
        admin.superAdmin.createSystemAd({ type: AdType.YouTube, title: 'x', videoId: 'dQw4w9WgXcQ' }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });
  });

  it('super admin can list tenants and see this tenant with its counts', async () => {
    const sa = superAdminCaller();
    const tenants = await sa.superAdmin.listTenants();
    const found = tenants.find((t) => t.id === tenantId);
    expect(found).toBeDefined();
    expect(found?._count).toBeDefined();
  });

  it('super admin getTenant returns detail; unknown id → NOT_FOUND', async () => {
    const sa = superAdminCaller();
    const detail = await sa.superAdmin.getTenant({ id: tenantId });
    expect(detail.id).toBe(tenantId);
    await expect(sa.superAdmin.getTenant({ id: 'c0000000000000000000000000' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('setTier toggles free -> premium -> free and persists', async () => {
    const sa = superAdminCaller();
    await sa.superAdmin.setTier({ tenantId, tier: TenantTier.Premium });
    expect((await prismaRaw.tenant.findUniqueOrThrow({ where: { id: tenantId } })).tier).toBe('premium');

    await sa.superAdmin.setTier({ tenantId, tier: TenantTier.Free });
    expect((await prismaRaw.tenant.findUniqueOrThrow({ where: { id: tenantId } })).tier).toBe('free');
  });

  it('setStatus suspends and reactivates and persists', async () => {
    const sa = superAdminCaller();
    await sa.superAdmin.setStatus({ tenantId, status: TenantStatus.Suspended });
    expect((await prismaRaw.tenant.findUniqueOrThrow({ where: { id: tenantId } })).status).toBe('suspended');

    await sa.superAdmin.setStatus({ tenantId, status: TenantStatus.Active });
    expect((await prismaRaw.tenant.findUniqueOrThrow({ where: { id: tenantId } })).status).toBe('active');
  });

  it('platformStats returns pinned KPI shape', async () => {
    const sa = superAdminCaller();
    const stats = await sa.superAdmin.platformStats();
    expect(typeof stats.totalTenants).toBe('number');
    expect(Array.isArray(stats.tenantsByTier)).toBe(true);
    expect(Array.isArray(stats.tenantsByStatus)).toBe(true);
    expect(typeof stats.totalUsers).toBe('number');
    expect(typeof stats.totalTicketsAllTime).toBe('number');
    expect(typeof stats.totalTicketsToday).toBe('number');
  });

  it('System Ads CRUD: create (youtube) / list / enable-toggle / reorder / delete', async () => {
    const sa = superAdminCaller();
    const ad1 = await sa.superAdmin.createSystemAd({ type: AdType.YouTube, title: 'SA Test Ad 1', videoId: 'dQw4w9WgXcQ', duration: 30 });
    const ad2 = await sa.superAdmin.createSystemAd({ type: AdType.YouTube, title: 'SA Test Ad 2', videoId: 'dQw4w9WgXcQ', duration: 30 });

    const list = await sa.superAdmin.listSystemAds();
    const ids = list.filter((a) => a.id === ad1.id || a.id === ad2.id).map((a) => a.id);
    expect(ids).toContain(ad1.id);
    expect(ids).toContain(ad2.id);

    const disabled = await sa.superAdmin.setSystemAdEnabled({ id: ad1.id, enabled: false });
    expect(disabled.enabled).toBe(false);

    await sa.superAdmin.reorderSystemAds({ orderedIds: [ad2.id, ad1.id] });
    const reordered = await prismaRaw.systemAd.findUnique({ where: { id: ad2.id } });
    expect(reordered?.sortOrder).toBe(0);

    const deleted = await sa.superAdmin.deleteSystemAd({ id: ad1.id });
    expect(deleted.id).toBe(ad1.id);
    expect(await prismaRaw.systemAd.findUnique({ where: { id: ad1.id } })).toBeNull();

    await sa.superAdmin.deleteSystemAd({ id: ad2.id });
  });
});
