// Wave 7.7c-T2 — tenantAdRouter. Premium-only, YouTube LIVE-mode-only tenant ads
// (docs/PRODUCT.md "Custom Tenant Ads (Premium — LIVE mode only)"). Every procedure layers a
// Premium-tier gate on top of `adminProcedure` — a Free-tier admin caller gets FORBIDDEN on
// every mutation/query here, mirroring queue.ts's inline Return-After-Done Premium check
// (Tenant.tier is the source of truth, never Subscription.tier — same PM decision 5 as admin.ts).
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { createTenantAdSchema, reorderTenantAdsSchema, TenantTier, AdType } from '@cuelane/shared';
import { prisma, prismaRaw, withTenant } from '@cuelane/db';
import { createTRPCRouter, adminProcedure } from '../trpc';
import { reorderTenantAds } from '@/server/domain/media';
import { rethrowAdmin, idInputSchema } from '../lib/admin-errors';
import { deleteObject } from '@cuelane/storage';

// Chained directly onto `adminProcedure.use()` (not a standalone `middleware()` builder) so the
// `ctx` seen inside the callback is adminProcedure's NARROWED context (tenantId: string, not
// string | null) — a standalone `middleware()` infers against the base `Context` type instead
// and re-widens tenantId to nullable, breaking every downstream procedure's type-checking.
const premiumAdminProcedure = adminProcedure.use(async ({ ctx, next }) => {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId }, select: { tier: true } });
  // Cast: Prisma's generated TenantTier (from `@prisma/client`) is a distinct nominal type from
  // `@cuelane/shared`'s TenantTier — eslint's no-unsafe-enum-comparison rule flags a bare
  // cross-enum !==, so cast the DB-sourced value before comparing.
  if ((tenant.tier as TenantTier) !== TenantTier.Premium) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Tenant Ads are a Premium feature.' });
  }
  return next({ ctx });
});

export const tenantAdRouter = createTRPCRouter({
  list: premiumAdminProcedure.input(z.void()).query(async ({ ctx }) => {
    return prisma.tenantAd.findMany({ where: { tenantId: ctx.tenantId }, orderBy: { sortOrder: 'asc' } });
  }),

  create: premiumAdminProcedure.input(createTenantAdSchema).mutation(async ({ ctx, input }) => {
    try {
      return await withTenant(ctx.tenantId, async (tx) => {
        const agg = await tx.tenantAd.aggregate({ where: { tenantId: ctx.tenantId }, _max: { sortOrder: true } });
        return tx.tenantAd.create({
          data: {
            tenantId: ctx.tenantId,
            type: input.type,
            title: input.title,
            videoId: input.type === AdType.YouTube ? input.videoId : null,
            storageKey: input.type === AdType.Uploaded ? input.storageKey : null,
            fileName: input.type === AdType.Uploaded ? input.fileName : 'youtube',
            fileSize: input.type === AdType.Uploaded ? input.fileSize : 0,
            duration: input.duration ?? 0,
            sortOrder: (agg._max?.sortOrder ?? -1) + 1,
          },
        });
      });
    } catch (e) {
      rethrowAdmin(e);
    }
  }),

  reorder: premiumAdminProcedure.input(reorderTenantAdsSchema).mutation(async ({ ctx, input }) => {
    try {
      // prismaRaw — same convention as mediaRouter.reorder (domain layer already tenant-filters).
      await reorderTenantAds(prismaRaw, ctx.tenantId, input.orderedIds);
    } catch (e) {
      rethrowAdmin(e);
    }
    return { ok: true };
  }),

  delete: premiumAdminProcedure.input(idInputSchema).mutation(async ({ ctx, input }) => {
    const existing = await prisma.tenantAd.findFirst({ where: { id: input.id, tenantId: ctx.tenantId } });
    if (existing == null) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Unknown tenant ad.' });
    }
    await prisma.tenantAd.delete({ where: { id: input.id } });
    if (existing.storageKey != null) {
      await deleteObject(ctx.tenantId, existing.storageKey);
    }
    return { id: input.id };
  }),
});
