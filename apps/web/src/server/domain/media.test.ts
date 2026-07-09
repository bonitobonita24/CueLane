// Wave 7.7c-T2 — media domain unit tests (TDD: written before mediaRouter/tenantAdRouter).
// Runs against the REAL dev Postgres DB (no mocks), isolated ephemeral fixture tenants (a fresh
// Free tenant AND a fresh Premium tenant) — mirrors admin.test.ts's conventions exactly.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prismaRaw } from '@cuelane/db';
import { TenantTier } from '@cuelane/shared';
import { AdminDomainError } from './admin';
import {
  assertWithinPlaylistLimit,
  assertWithinUploadedFilesLimit,
  reorderPlaylistEntries,
  reorderTenantAds,
} from './media';

describe('media domain (Wave 7.7c-T2)', () => {
  let freeTenantId: string;
  let premiumTenantId: string;

  beforeAll(async () => {
    const freeTenant = await prismaRaw.tenant.create({
      data: { slug: `test-media-free-${Date.now()}`, companyName: 'Free Media Test Co.', tagline: 'x', tier: 'free' },
    });
    freeTenantId = freeTenant.id;

    const premiumTenant = await prismaRaw.tenant.create({
      data: { slug: `test-media-premium-${Date.now()}`, companyName: 'Premium Media Test Co.', tagline: 'x', tier: 'premium' },
    });
    premiumTenantId = premiumTenant.id;
  });

  afterAll(async () => {
    await prismaRaw.tenant.deleteMany({ where: { id: { in: [freeTenantId, premiumTenantId] } } });
  });

  describe('assertWithinPlaylistLimit', () => {
    it('free tenant: allows up to 3 playlist entries, blocks the 4th', async () => {
      for (let i = 0; i < 3; i++) {
        await expect(assertWithinPlaylistLimit(prismaRaw, freeTenantId, TenantTier.Free)).resolves.toBeUndefined();
        await prismaRaw.playlistEntry.create({
          data: {
            tenantId: freeTenantId,
            type: 'youtube',
            title: `Vid ${i + 1}`,
            videoId: 'dQw4w9WgXcQ',
            fileName: 'n/a',
            fileSize: 0,
            fileExt: 'mp4',
            sortOrder: i,
          },
        });
      }
      await expect(assertWithinPlaylistLimit(prismaRaw, freeTenantId, TenantTier.Free)).rejects.toBeInstanceOf(AdminDomainError);
    });

    it('premium tenant: allows up to 10, blocks the 11th', async () => {
      for (let i = 0; i < 10; i++) {
        await expect(assertWithinPlaylistLimit(prismaRaw, premiumTenantId, TenantTier.Premium)).resolves.toBeUndefined();
        await prismaRaw.playlistEntry.create({
          data: {
            tenantId: premiumTenantId,
            type: 'youtube',
            title: `Vid ${i + 1}`,
            videoId: 'dQw4w9WgXcQ',
            fileName: 'n/a',
            fileSize: 0,
            fileExt: 'mp4',
            sortOrder: i,
          },
        });
      }
      await expect(assertWithinPlaylistLimit(prismaRaw, premiumTenantId, TenantTier.Premium)).rejects.toBeInstanceOf(AdminDomainError);
    });
  });

  describe('assertWithinUploadedFilesLimit', () => {
    it("free tenant: allows 1 LOCAL entry, blocks the 2nd (YouTube entries don't count)", async () => {
      // freeTenantId already has 3 youtube entries from the prior test — none of them are 'local'.
      await expect(assertWithinUploadedFilesLimit(prismaRaw, freeTenantId, TenantTier.Free)).resolves.toBeUndefined();
      await prismaRaw.playlistEntry.create({
        data: {
          tenantId: freeTenantId,
          type: 'local',
          title: 'Uploaded 1',
          storageKey: `${freeTenantId}/media/f1.mp4`,
          fileName: 'f1.mp4',
          fileSize: 1000,
          fileExt: 'mp4',
          sortOrder: 99,
        },
      });
      await expect(assertWithinUploadedFilesLimit(prismaRaw, freeTenantId, TenantTier.Free)).rejects.toBeInstanceOf(AdminDomainError);
    });
  });

  describe('reorderPlaylistEntries', () => {
    it('applies the given order as sortOrder and rejects an id from another tenant', async () => {
      const entries = await prismaRaw.playlistEntry.findMany({ where: { tenantId: premiumTenantId }, orderBy: { sortOrder: 'asc' } });
      const ids = entries.map((e) => e.id);
      const reversed = [...ids].reverse();
      await reorderPlaylistEntries(prismaRaw, premiumTenantId, reversed);
      const after = await prismaRaw.playlistEntry.findMany({ where: { tenantId: premiumTenantId }, orderBy: { sortOrder: 'asc' } });
      expect(after.map((e) => e.id)).toEqual(reversed);

      const [foreignEntry] = await prismaRaw.playlistEntry.findMany({ where: { tenantId: freeTenantId }, take: 1 });
      await expect(reorderPlaylistEntries(prismaRaw, premiumTenantId, [foreignEntry!.id])).rejects.toBeInstanceOf(AdminDomainError);
    });
  });

  describe('reorderTenantAds', () => {
    it('applies the given order and rejects an id from another tenant', async () => {
      const adA = await prismaRaw.tenantAd.create({
        data: { tenantId: premiumTenantId, type: 'youtube', title: 'Ad A', videoId: 'dQw4w9WgXcQ', fileName: 'n/a', fileSize: 0, duration: 15, sortOrder: 0 },
      });
      const adB = await prismaRaw.tenantAd.create({
        data: { tenantId: premiumTenantId, type: 'youtube', title: 'Ad B', videoId: 'dQw4w9WgXcQ', fileName: 'n/a', fileSize: 0, duration: 15, sortOrder: 1 },
      });
      await reorderTenantAds(prismaRaw, premiumTenantId, [adB.id, adA.id]);
      const after = await prismaRaw.tenantAd.findMany({ where: { tenantId: premiumTenantId }, orderBy: { sortOrder: 'asc' } });
      expect(after.map((a) => a.id)).toEqual([adB.id, adA.id]);

      const foreignAd = await prismaRaw.tenantAd.create({
        data: { tenantId: freeTenantId, type: 'youtube', title: 'Foreign Ad', videoId: 'dQw4w9WgXcQ', fileName: 'n/a', fileSize: 0, duration: 15, sortOrder: 0 },
      });
      await expect(reorderTenantAds(prismaRaw, premiumTenantId, [foreignAd.id])).rejects.toBeInstanceOf(AdminDomainError);
    });
  });
});
