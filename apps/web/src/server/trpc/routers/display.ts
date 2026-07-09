// Wave 7.7d-T1 — displayRouter. Public (kioskProcedure — same unauthenticated posture as
// queue.state), single-round-trip read for the Big Display's video/ads panel. Returns everything
// the client needs to run the video panel + free-tier System-Ad interrupt engine + premium
// Tenant-Ad rotation in ONE call, per docs/PRODUCT.md "Big Display Screen" / "Video source mode
// selector" / "System Ads (Free tier — non-negotiable)" / "Custom Tenant Ads (Premium — LIVE mode
// only)":
//   - Free tier:    System Ads interrupt every 5 min regardless of playlist/live mode.
//   - Premium tier: NO system ads, ever. LIVE mode only: tenant's own TenantAds interrupt instead
//                   (PRODUCT.md "In Playlist mode, premium tenants have no ad interruptions at
//                   all" — so tenantAds is [] outside Premium+LIVE, not just outside Premium).
//
// tenantId is ALWAYS ctx.tenantId, resolved server-side by kioskProcedure from the tenantSlug
// input — never client-supplied — so there is no cross-tenant leakage path (same guarantee as
// queue.state/queue.listActive).
import { prisma } from '@cuelane/db';
import { MediaType, AdType, TenantTier } from '@cuelane/shared';
import { getSignedDownloadUrl, getSignedGlobalUrl } from '@cuelane/storage';
import { createTRPCRouter, kioskProcedure } from '../trpc';

interface DisplayPlaylistEntry {
  id: string;
  type: 'youtube' | 'local';
  title: string;
  videoId: string | null;
  /** Presigned public-origin URL for a 'local' entry; always null for 'youtube' (the client
   *  embeds by videoId instead). */
  url: string | null;
  isLive: boolean;
}

interface DisplayAdEntry {
  id: string;
  type: 'youtube' | 'uploaded';
  title: string;
  videoId: string | null;
  /** Presigned public-origin URL for an 'uploaded' ad; always null for 'youtube'. */
  url: string | null;
  duration: number;
}

export const displayRouter = createTRPCRouter({
  media: kioskProcedure.query(async ({ ctx }) => {
    // Tenant is a GLOBAL_MODEL (bypasses the L6 tenant guard) — safe to read via the plain
    // `prisma` client with no extra wrap, same convention as queue.state.
    const tenant = await prisma.tenant.findUniqueOrThrow({
      where: { id: ctx.tenantId },
      select: { tier: true, settings: true },
    });
    const tier = tenant.tier as TenantTier;

    // `settings` is Prisma's untyped Json column (RMW shape: { videoMode, liveStreamUrl, ... },
    // Wave 7.6-T4) — defensive parse, never trust the shape blindly (same posture as
    // resolveThemeVars for `settings.theme`).
    const settings = (tenant.settings ?? {}) as { videoMode?: unknown; liveStreamUrl?: unknown };
    const videoMode: 'playlist' | 'live' = settings.videoMode === 'live' ? 'live' : 'playlist';
    const liveStreamUrl = typeof settings.liveStreamUrl === 'string' && settings.liveStreamUrl !== '' ? settings.liveStreamUrl : null;

    const playlistRows = await prisma.playlistEntry.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { sortOrder: 'asc' },
    });

    const playlist: DisplayPlaylistEntry[] = await Promise.all(
      playlistRows.map(async (row) => {
        // Cast: Prisma's generated MediaType is a distinct nominal type from @cuelane/shared's —
        // same convention as media.ts/tenantAd.ts (eslint no-unsafe-enum-comparison).
        const isLocal = (row.type as MediaType) === MediaType.Local;
        const url =
          isLocal && row.storageKey != null
            ? await getSignedDownloadUrl({ tenantId: ctx.tenantId, key: row.storageKey })
            : null;
        return {
          id: row.id,
          type: isLocal ? 'local' : 'youtube',
          title: row.title,
          videoId: row.videoId,
          url,
          isLive: row.isLive,
        };
      }),
    );

    // Free tier: System Ads interrupt regardless of playlist/live mode (PRODUCT.md
    // "non-negotiable"). SystemAd is a GLOBAL_MODEL (no tenantId column) — read via plain `prisma`
    // with no tenant filter, same as the `tenant` read above.
    let ads: DisplayAdEntry[] = [];
    if (tier !== TenantTier.Premium) {
      const systemAdRows = await prisma.systemAd.findMany({
        where: { enabled: true },
        orderBy: { sortOrder: 'asc' },
      });
      ads = await Promise.all(
        systemAdRows.map(async (row) => {
          const isUploaded = (row.type as AdType) === AdType.Uploaded;
          const url = isUploaded && row.storageKey != null ? await getSignedGlobalUrl(row.storageKey) : null;
          return {
            id: row.id,
            type: isUploaded ? 'uploaded' : 'youtube',
            title: row.title,
            videoId: row.videoId,
            url,
            duration: row.duration,
          };
        }),
      );
    }

    // Premium + LIVE mode ONLY: tenant's own ads replace system ads (PRODUCT.md "Custom Tenant
    // Ads (Premium — LIVE mode only)" + "In Playlist mode, premium tenants have no ad
    // interruptions at all").
    let tenantAds: DisplayAdEntry[] = [];
    if (tier === TenantTier.Premium && videoMode === 'live') {
      const tenantAdRows = await prisma.tenantAd.findMany({
        where: { tenantId: ctx.tenantId },
        orderBy: { sortOrder: 'asc' },
      });
      tenantAds = await Promise.all(
        tenantAdRows.map(async (row) => {
          const isUploaded = (row.type as AdType) === AdType.Uploaded;
          const url =
            isUploaded && row.storageKey != null
              ? await getSignedDownloadUrl({ tenantId: ctx.tenantId, key: row.storageKey })
              : null;
          return {
            id: row.id,
            type: isUploaded ? 'uploaded' : 'youtube',
            title: row.title,
            videoId: row.videoId,
            url,
            duration: row.duration,
          };
        }),
      );
    }

    return { tier, videoMode, liveStreamUrl, playlist, ads, tenantAds };
  }),
});
