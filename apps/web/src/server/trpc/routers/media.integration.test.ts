// Wave 7.7c-T5 — cross-cutting Media Manager integration test against the REAL seeded `demo`
// (premium) and `clinic` (free) tenants — no mocks, no ephemeral fixture tenant, ground-truth
// check per the Wave 7.7c brief. Mirrors queue.integration.test.ts's approach: resolve the
// seeded tenant/admin ids via `prismaRaw` at runtime (never hardcoded), drive everything through
// the real `media`/`tenantAd` routers, and clean up every row this test creates in `afterAll` so
// re-running the suite (or the seed) stays idempotent-safe for the shared seeded tenants.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NextRequest } from 'next/server';
import { prismaRaw } from '@cuelane/db';
import { Role, MediaType, AdType } from '@cuelane/shared';
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
function adminCallerFor(tenantId: string, userId: string) {
  return createCaller(
    ctxFor({ session: { user: { id: userId } } as unknown as Context['session'], userId, roles: [Role.TenantSuperadmin], tenantId }),
  );
}

describe('Media Manager integration (Wave 7.7c-T5, against seeded demo+clinic tenants)', () => {
  let demoTenantId: string;
  let demoAdminId: string;
  let clinicTenantId: string;
  let clinicAdminId: string;

  // Track every row this test creates so afterAll can clean up without touching seed.ts's own rows.
  const createdPlaylistEntryIds: string[] = [];
  const createdTenantAdIds: string[] = [];

  beforeAll(async () => {
    const demoTenant = await prismaRaw.tenant.findUniqueOrThrow({ where: { slug: 'demo' }, select: { id: true, tier: true } });
    expect(demoTenant.tier).toBe('premium');
    demoTenantId = demoTenant.id;
    const demoAdmin = await prismaRaw.user.findFirstOrThrow({
      where: { tenantId: demoTenantId, name: 'Branch Admin', role: 'tenant_superadmin' },
      select: { id: true },
    });
    demoAdminId = demoAdmin.id;

    const clinicTenant = await prismaRaw.tenant.findUniqueOrThrow({ where: { slug: 'clinic' }, select: { id: true, tier: true } });
    expect(clinicTenant.tier).toBe('free');
    clinicTenantId = clinicTenant.id;
    const clinicAdmin = await prismaRaw.user.findFirstOrThrow({
      where: { tenantId: clinicTenantId, name: 'Nurse Admin', role: 'tenant_superadmin' },
      select: { id: true },
    });
    clinicAdminId = clinicAdmin.id;
  });

  afterAll(async () => {
    await prismaRaw.playlistEntry.deleteMany({ where: { id: { in: createdPlaylistEntryIds } } });
    await prismaRaw.tenantAd.deleteMany({ where: { id: { in: createdTenantAdIds } } });
  });

  it('demo (premium) admin: create → reorder → delete a YouTube playlist entry', async () => {
    const admin = adminCallerFor(demoTenantId, demoAdminId);

    const e1 = await admin.media.createYoutube({ type: MediaType.YouTube, title: 'Integ Vid 1', videoId: 'dQw4w9WgXcQ', isLive: false });
    const e2 = await admin.media.createYoutube({ type: MediaType.YouTube, title: 'Integ Vid 2', videoId: 'dQw4w9WgXcQ', isLive: false });
    createdPlaylistEntryIds.push(e1.id, e2.id);

    const listBefore = await admin.media.list();
    const idxE1 = listBefore.findIndex((e) => e.id === e1.id);
    const idxE2 = listBefore.findIndex((e) => e.id === e2.id);
    expect(idxE1).toBeGreaterThanOrEqual(0);
    expect(idxE2).toBeGreaterThan(idxE1);

    await admin.media.reorder({ orderedIds: [e2.id, e1.id] });
    const listAfter = await admin.media.list();
    const reorderedIds = listAfter.filter((e) => e.id === e1.id || e.id === e2.id).map((e) => e.id);
    expect(reorderedIds).toEqual([e2.id, e1.id]);

    const deleted = await admin.media.delete({ id: e1.id });
    expect(deleted.id).toBe(e1.id);
    createdPlaylistEntryIds.splice(createdPlaylistEntryIds.indexOf(e1.id), 1);
    expect((await admin.media.list()).find((e) => e.id === e1.id)).toBeUndefined();
  });

  it('demo (premium) admin: create + delete a Tenant Ad (Premium gate passes)', async () => {
    const admin = adminCallerFor(demoTenantId, demoAdminId);
    const ad = await admin.tenantAd.create({ type: AdType.YouTube, title: 'Integ Ad', videoId: 'dQw4w9WgXcQ' });
    createdTenantAdIds.push(ad.id);
    expect((await admin.tenantAd.list()).map((a) => a.id)).toContain(ad.id);
    const deleted = await admin.tenantAd.delete({ id: ad.id });
    expect(deleted.id).toBe(ad.id);
    createdTenantAdIds.splice(createdTenantAdIds.indexOf(ad.id), 1);
  });

  it('clinic (free) admin: tenantAd is FORBIDDEN (Premium-only gate)', async () => {
    const clinicAdmin = adminCallerFor(clinicTenantId, clinicAdminId);
    await expect(clinicAdmin.tenantAd.list()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      clinicAdmin.tenantAd.create({ type: AdType.YouTube, title: 'Nope', videoId: 'dQw4w9WgXcQ' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('tenant isolation: clinic admin cannot see, reorder, or delete a demo playlist entry', async () => {
    const demoAdmin = adminCallerFor(demoTenantId, demoAdminId);
    const clinicAdmin = adminCallerFor(clinicTenantId, clinicAdminId);

    const demoEntry = await demoAdmin.media.createYoutube({ type: MediaType.YouTube, title: 'Demo-only Vid', videoId: 'dQw4w9WgXcQ', isLive: false });
    createdPlaylistEntryIds.push(demoEntry.id);

    const clinicList = await clinicAdmin.media.list();
    expect(clinicList.find((e) => e.id === demoEntry.id)).toBeUndefined();

    await expect(clinicAdmin.media.reorder({ orderedIds: [demoEntry.id] })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(clinicAdmin.media.delete({ id: demoEntry.id })).rejects.toMatchObject({ code: 'NOT_FOUND' });

    // Prove it's still there, untouched, from the demo tenant's own perspective.
    expect((await demoAdmin.media.list()).find((e) => e.id === demoEntry.id)).toBeDefined();
  });
});
