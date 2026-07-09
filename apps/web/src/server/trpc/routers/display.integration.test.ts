// Wave 7.7d-T4 — displayRouter.media integration test against the REAL seeded `demo` (premium)
// and `clinic` (free) tenants — no ephemeral fixture tenants, ground-truth check per the Wave
// 7.7d brief. Mirrors media.integration.test.ts's approach: resolve seeded ids via `prismaRaw`,
// drive everything through the real router, and restore BOTH tenants to their pristine seed
// baseline in `afterAll` (delete every row this test creates, revert every settings patch) so
// re-running the suite — or a human poking at the demo stack afterward — sees no residue.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NextRequest } from 'next/server';
import { prismaRaw } from '@cuelane/db';
import { Role, MediaType, AdType, VideoMode } from '@cuelane/shared';
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
function kioskCaller() {
  return createCaller(ctxFor({}));
}
function adminCallerFor(tenantId: string, userId: string) {
  return createCaller(
    ctxFor({ session: { user: { id: userId } } as unknown as Context['session'], userId, roles: [Role.Admin], tenantId }),
  );
}

describe('displayRouter.media integration (Wave 7.7d-T4, against seeded demo+clinic tenants)', () => {
  let demoTenantId: string;
  let demoAdminId: string;
  let demoOriginalSettings: unknown;

  const createdPlaylistEntryIds: string[] = [];
  const createdTenantAdIds: string[] = [];

  beforeAll(async () => {
    const demoTenant = await prismaRaw.tenant.findUniqueOrThrow({
      where: { slug: 'demo' },
      select: { id: true, tier: true, settings: true },
    });
    expect(demoTenant.tier).toBe('premium');
    demoTenantId = demoTenant.id;
    demoOriginalSettings = demoTenant.settings;
    const demoAdmin = await prismaRaw.user.findFirstOrThrow({
      where: { tenantId: demoTenantId, name: 'Branch Admin', role: 'admin' },
      select: { id: true },
    });
    demoAdminId = demoAdmin.id;

    const clinicTenant = await prismaRaw.tenant.findUniqueOrThrow({ where: { slug: 'clinic' }, select: { tier: true } });
    expect(clinicTenant.tier).toBe('free');
  });

  afterAll(async () => {
    // Restore demo to its EXACT pristine settings (including videoMode/liveStreamUrl this suite
    // may have changed) — a direct prismaRaw write, not the RMW mutation, to guarantee an exact
    // revert regardless of what shape the settings JSON was in before this test ran.
    await prismaRaw.tenant.update({ where: { id: demoTenantId }, data: { settings: demoOriginalSettings as never } });
    await prismaRaw.playlistEntry.deleteMany({ where: { id: { in: createdPlaylistEntryIds } } });
    await prismaRaw.tenantAd.deleteMany({ where: { id: { in: createdTenantAdIds } } });
  });

  it('clinic (free): displayRouter.media surfaces the seeded system ad; tenantAds always empty', async () => {
    const result = await kioskCaller().display.media({ tenantSlug: 'clinic' });
    expect(result.tier).toBe('free');
    // The seeded system ad (packages/db/prisma/seed.ts) is enabled + chronological-first —
    // ground truth, not a fixture this test controls.
    expect(result.ads.length).toBeGreaterThan(0);
    expect(result.tenantAds).toEqual([]);
  });

  it('demo (premium, playlist mode by default): no system ads, no tenant ads — zero interruptions', async () => {
    const result = await kioskCaller().display.media({ tenantSlug: 'demo' });
    expect(result.tier).toBe('premium');
    expect(result.videoMode).toBe('playlist');
    expect(result.ads).toEqual([]);
    expect(result.tenantAds).toEqual([]);
  });

  it('demo switched to LIVE mode + a real Tenant Ad added: tenantAds populated, system ads still absent', async () => {
    const admin = adminCallerFor(demoTenantId, demoAdminId);
    await admin.tenantAdmin.updateSettings({
      settings: { videoMode: VideoMode.Live, liveStreamUrl: 'https://www.youtube.com/watch?v=jfKfPfyJRdk' },
    });
    const ad = await admin.tenantAd.create({ type: AdType.YouTube, title: 'Integ Tenant Ad', videoId: 'dQw4w9WgXcQ', duration: 20 });
    createdTenantAdIds.push(ad.id);

    const result = await kioskCaller().display.media({ tenantSlug: 'demo' });
    expect(result.videoMode).toBe('live');
    expect(result.liveStreamUrl).toBe('https://www.youtube.com/watch?v=jfKfPfyJRdk');
    expect(result.ads).toEqual([]); // Premium — never system ads, regardless of mode
    expect(result.tenantAds.map((a) => a.id)).toContain(ad.id);
  });

  it('tenant isolation: clinic playlist/ads never leak into demo response, and vice versa', async () => {
    const admin = adminCallerFor(demoTenantId, demoAdminId);
    const demoEntry = await admin.media.createYoutube({ type: MediaType.YouTube, title: 'Demo-only display-integ entry', videoId: 'dQw4w9WgXcQ', isLive: false });
    createdPlaylistEntryIds.push(demoEntry.id);

    const demoResult = await kioskCaller().display.media({ tenantSlug: 'demo' });
    const clinicResult = await kioskCaller().display.media({ tenantSlug: 'clinic' });

    expect(demoResult.playlist.map((e) => e.id)).toContain(demoEntry.id);
    expect(clinicResult.playlist.map((e) => e.id)).not.toContain(demoEntry.id);
    // The seeded system ad is a GLOBAL model — it correctly appears for clinic (free) and
    // correctly NEVER appears for demo (premium), proving the tier gate, not a tenant filter bug.
    expect(clinicResult.ads.length).toBeGreaterThan(0);
    expect(demoResult.ads).toEqual([]);
  });

  it('unknown tenantSlug → NOT_FOUND (no information leak about tenant existence)', async () => {
    await expect(kioskCaller().display.media({ tenantSlug: `no-such-tenant-${Date.now()}` })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
