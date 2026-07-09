// Wave 7.7d-T1 — displayRouter tRPC tests (TDD: written before the router implementation).
// Public kioskProcedure (tenantSlug-resolved, same posture as queue.state) — single round-trip
// read for the Big Display's video/ads panel. Fresh ephemeral fixture tenants (never the seeded
// demo/clinic tenants — those get their own cross-tenant proof in display.integration.test.ts),
// real MinIO round-trip for the local-media signed URL (no mocks, per framework convention).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NextRequest } from 'next/server';
import { prismaRaw } from '@cuelane/db';
import { putObject, deleteObject } from '@cuelane/storage';
import { MediaType, AdType } from '@cuelane/shared';
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

describe('displayRouter.media (Wave 7.7d-T1)', () => {
  let freeTenantId: string;
  let freeSlug: string;
  let premiumTenantId: string;
  let premiumSlug: string;
  let uploadedKey: string;

  const createdSystemAdIds: string[] = [];

  beforeAll(async () => {
    freeSlug = `test-display-free-${Date.now()}`;
    const freeTenant = await prismaRaw.tenant.create({
      data: {
        slug: freeSlug,
        companyName: 'Display Free Co',
        tagline: 'x',
        tier: 'free',
        settings: { videoMode: 'playlist', liveStreamUrl: null },
      },
    });
    freeTenantId = freeTenant.id;

    premiumSlug = `test-display-premium-${Date.now()}`;
    const premiumTenant = await prismaRaw.tenant.create({
      data: {
        slug: premiumSlug,
        companyName: 'Display Premium Co',
        tagline: 'x',
        tier: 'premium',
        settings: { videoMode: 'live', liveStreamUrl: 'https://www.youtube.com/watch?v=jfKfPfyJRdk' },
      },
    });
    premiumTenantId = premiumTenant.id;

    // A real uploaded local playlist entry for the free tenant — proves the signed-URL path.
    const uploaded = await putObject({
      tenantId: freeTenantId,
      entityType: 'media',
      body: Buffer.from('fake-mp4-bytes'),
      mimeType: 'video/mp4',
      originalFilename: 'clip.mp4',
      sizeBytes: 14,
    });
    uploadedKey = uploaded.key;

    await prismaRaw.playlistEntry.create({
      data: {
        tenantId: freeTenantId,
        type: MediaType.YouTube,
        title: 'YT Entry',
        videoId: 'dQw4w9WgXcQ',
        isLive: false,
        fileName: 'youtube',
        fileSize: 0,
        fileExt: 'youtube',
        sortOrder: 0,
      },
    });
    await prismaRaw.playlistEntry.create({
      data: {
        tenantId: freeTenantId,
        type: MediaType.Local,
        title: 'Local Entry',
        storageKey: uploadedKey,
        fileName: 'clip.mp4',
        fileSize: 14,
        fileExt: 'mp4',
        isLive: false,
        sortOrder: 1,
      },
    });

    // Premium tenant ad (LIVE mode) — proves the tenantAds branch.
    await prismaRaw.tenantAd.create({
      data: {
        tenantId: premiumTenantId,
        type: AdType.YouTube,
        title: 'Premium Ad',
        videoId: 'dQw4w9WgXcQ',
        fileName: 'youtube',
        fileSize: 0,
        duration: 15,
        sortOrder: 0,
      },
    });
  });

  afterAll(async () => {
    await deleteObject(freeTenantId, uploadedKey);
    await prismaRaw.tenant.deleteMany({ where: { id: { in: [freeTenantId, premiumTenantId] } } });
    await prismaRaw.systemAd.deleteMany({ where: { id: { in: createdSystemAdIds } } });
  });

  it('free tier: returns playlist (YouTube + signed local URL) AND enabled system ads, tenantAds empty', async () => {
    const result = await kioskCaller().display.media({ tenantSlug: freeSlug });

    expect(result.tier).toBe('free');
    expect(result.videoMode).toBe('playlist');
    expect(result.liveStreamUrl).toBeNull();

    expect(result.playlist).toHaveLength(2);
    const yt = result.playlist.find((e) => e.type === 'youtube');
    const local = result.playlist.find((e) => e.type === 'local');
    expect(yt?.videoId).toBe('dQw4w9WgXcQ');
    expect(yt?.url).toBeNull();
    expect(local?.url).toMatch(/^https?:\/\//);

    // Signed URL is genuinely fetchable (real MinIO round-trip, no mock).
    const res = await fetch(local!.url!);
    expect(res.status).toBe(200);
    expect(Buffer.from(await res.arrayBuffer()).toString()).toBe('fake-mp4-bytes');

    // The one seeded system ad (from packages/db/prisma/seed.ts) is enabled + YouTube-type —
    // free tier must see it. Real seed data is ground truth here, not a fixture we control, so
    // only assert shape + non-empty rather than an exact count (another test process could be
    // running against the same DB).
    expect(result.ads.length).toBeGreaterThan(0);
    expect(result.ads.every((a) => typeof a.duration === 'number')).toBe(true);
    expect(result.tenantAds).toEqual([]);
  });

  it('premium tier: no system ads; LIVE mode surfaces tenantAds', async () => {
    const result = await kioskCaller().display.media({ tenantSlug: premiumSlug });

    expect(result.tier).toBe('premium');
    expect(result.videoMode).toBe('live');
    expect(result.liveStreamUrl).toBe('https://www.youtube.com/watch?v=jfKfPfyJRdk');
    expect(result.ads).toEqual([]);
    expect(result.tenantAds).toHaveLength(1);
    expect(result.tenantAds[0]?.videoId).toBe('dQw4w9WgXcQ');
  });

  it('tenant isolation: the free tenant playlist never leaks into the premium tenant response', async () => {
    const result = await kioskCaller().display.media({ tenantSlug: premiumSlug });
    expect(result.playlist).toEqual([]);
  });

  it('unknown tenantSlug → NOT_FOUND', async () => {
    await expect(kioskCaller().display.media({ tenantSlug: 'no-such-tenant-xyz' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
