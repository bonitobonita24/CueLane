// Wave 7.7c-T2 — mediaRouter. Admin Core CRUD for PlaylistEntry (Big Display video panel).
// `adminProcedure`-only (tenant-scoped, Admin-role-only — same guarantees as service/window
// routers). `createYoutube` is the ONLY creation path exposed here — a 'local' (uploaded-file)
// PlaylistEntry is created by the T3 multipart upload Route Handler
// (apps/web/src/app/api/tenants/[slug]/media/upload/route.ts), which streams the file to
// storage FIRST and only then inserts the row with its real storageKey/fileSize — creating a
// 'local' row here (with no uploaded bytes behind it) would be a phantom entry, so `createYoutube`
// rejects a 'local' payload with BAD_REQUEST pointing callers at the upload route.
//
// VideoMode/liveStreamUrl are NOT duplicated here — they already round-trip through
// `tenantAdmin.updateSettings`/`getSettings` (Tenant.settings JSON RMW, Wave 7.6-T4). Admin UI
// (T4) calls tenantAdmin for those two fields and mediaRouter for everything playlist-shaped.
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { createPlaylistEntrySchema, reorderPlaylistSchema, MediaType, TenantTier } from '@cuelane/shared';
import { prisma, prismaRaw, withTenant } from '@cuelane/db';
import { deleteObject } from '@cuelane/storage';
import { createTRPCRouter, adminProcedure } from '../trpc';
import { assertWithinPlaylistLimit, reorderPlaylistEntries } from '@/server/domain/media';
import { rethrowAdmin, idInputSchema } from '../lib/admin-errors';

export const mediaRouter = createTRPCRouter({
  list: adminProcedure.input(z.void()).query(async ({ ctx }) => {
    return prisma.playlistEntry.findMany({ where: { tenantId: ctx.tenantId }, orderBy: { sortOrder: 'asc' } });
  }),

  createYoutube: adminProcedure.input(createPlaylistEntrySchema).mutation(async ({ ctx, input }) => {
    if (input.type !== MediaType.YouTube) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'createYoutube only accepts YouTube entries — upload a local file via the media upload route.',
      });
    }
    try {
      return await withTenant(ctx.tenantId, async (tx) => {
        const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId }, select: { tier: true } });
        await assertWithinPlaylistLimit(tx, ctx.tenantId, tenant.tier as TenantTier);
        const agg = await tx.playlistEntry.aggregate({ where: { tenantId: ctx.tenantId }, _max: { sortOrder: true } });
        return tx.playlistEntry.create({
          data: {
            tenantId: ctx.tenantId,
            type: MediaType.YouTube,
            title: input.title,
            videoId: input.videoId,
            isLive: input.isLive,
            // Placeholder file* columns — schema requires them NOT NULL but a YouTube entry has
            // no uploaded file behind it; consumers must branch on `type` before reading these.
            fileName: 'youtube',
            fileSize: 0,
            fileExt: 'youtube',
            sortOrder: (agg._max.sortOrder ?? -1) + 1,
          },
        });
      });
    } catch (e) {
      rethrowAdmin(e);
    }
  }),

  reorder: adminProcedure.input(reorderPlaylistSchema).mutation(async ({ ctx, input }) => {
    try {
      // prismaRaw (unguarded), not the L6-guarded `prisma` — same convention as tenantAdmin.ts:
      // domain/media.ts's Db type (Prisma.TransactionClient | PrismaClient) doesn't structurally
      // match the extended-client type `prisma` resolves to. reorderPlaylistEntries already
      // filters every query by the explicit `tenantId` parameter, so this is safe without the guard.
      await reorderPlaylistEntries(prismaRaw, ctx.tenantId, input.orderedIds);
    } catch (e) {
      rethrowAdmin(e);
    }
    return { ok: true };
  }),

  delete: adminProcedure.input(idInputSchema).mutation(async ({ ctx, input }) => {
    const existing = await prisma.playlistEntry.findFirst({ where: { id: input.id, tenantId: ctx.tenantId } });
    if (existing == null) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Unknown playlist entry.' });
    }
    await prisma.playlistEntry.delete({ where: { id: input.id } });
    // Local entries own an uploaded object in storage — clean it up. YouTube entries have no
    // storageKey (null) so this is a no-op for them.
    if (existing.type === MediaType.Local && existing.storageKey != null) {
      await deleteObject(ctx.tenantId, existing.storageKey);
    }
    return { id: input.id };
  }),
});
