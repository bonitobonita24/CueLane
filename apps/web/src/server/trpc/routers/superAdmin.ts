// Wave 7.8-T1 — superAdminRouter. Platform-level, cross-tenant (Role.TenantManager only — see
// `superAdminProcedure` in trpc.ts). Every resolver uses `prismaRaw` (the UNGUARDED client) —
// there is no single tenant AsyncLocalStorage context for a platform-wide operation (Tenant /
// SystemAd / Subscription are GLOBAL_MODELS that bypass the L6 guard anyway; User / Ticket counts
// below are cross-tenant aggregates with no `withTenantContext` to enter, so the guarded `prisma`
// client would throw "No tenant context active" — see packages/db tenant-guard.ts).
//
// [HOW] decision (Wave 7.8-T1, recorded in docs/DECISIONS_LOG.md): `setTier` writes Tenant.tier —
// the field every tenant-facing surface actually reads (kioskProcedure, displayRouter.media,
// tenantAdRouter's premium gate, dashboard limits) — as the SOURCE OF TRUTH. If a Subscription row
// already exists for the tenant, its `tier` column is mirrored to stay display-consistent for any
// future billing UI, but that mirror is NOT authoritative and its absence never blocks the toggle
// (a Free-tier tenant with no Subscription row yet must still be toggle-able to Premium).
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  createSystemAdSchema,
  reorderSystemAdsSchema,
  updateTenantStatusSchema,
  setTenantTierSchema,
  AdType,
} from '@cuelane/shared';
import { prismaRaw } from '@cuelane/db';
import { createTRPCRouter, superAdminProcedure } from '../trpc';
import { idInputSchema } from '../lib/admin-errors';
import { deleteGlobalObject } from '@cuelane/storage';

const tenantCounts = {
  _count: { select: { services: true, windows: true, users: true, tickets: true } },
} as const;

function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export const superAdminRouter = createTRPCRouter({
  // ─── Tenant directory ───────────────────────────────────────────────────────
  listTenants: superAdminProcedure.input(z.void()).query(async () => {
    return prismaRaw.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      include: tenantCounts,
    });
  }),

  getTenant: superAdminProcedure.input(idInputSchema).query(async ({ input }) => {
    const tenant = await prismaRaw.tenant.findUnique({
      where: { id: input.id },
      include: { subscription: true, ...tenantCounts },
    });
    if (tenant == null) throw new TRPCError({ code: 'NOT_FOUND', message: 'Unknown tenant.' });
    return tenant;
  }),

  setTier: superAdminProcedure.input(setTenantTierSchema).mutation(async ({ input }) => {
    const existing = await prismaRaw.tenant.findUnique({ where: { id: input.tenantId }, select: { id: true } });
    if (existing == null) throw new TRPCError({ code: 'NOT_FOUND', message: 'Unknown tenant.' });

    const tenant = await prismaRaw.tenant.update({ where: { id: input.tenantId }, data: { tier: input.tier } });
    // Mirror-only — see file header [HOW] decision. updateMany is a no-op (0 rows) if no
    // Subscription row exists yet, which is expected for a tenant that has never gone through the
    // Xendit flow; the tier toggle itself must still succeed.
    await prismaRaw.subscription.updateMany({ where: { tenantId: input.tenantId }, data: { tier: input.tier } });
    return tenant;
  }),

  setStatus: superAdminProcedure.input(updateTenantStatusSchema).mutation(async ({ input }) => {
    const existing = await prismaRaw.tenant.findUnique({ where: { id: input.tenantId }, select: { id: true } });
    if (existing == null) throw new TRPCError({ code: 'NOT_FOUND', message: 'Unknown tenant.' });
    return prismaRaw.tenant.update({ where: { id: input.tenantId }, data: { status: input.status } });
  }),

  // ─── Platform analytics ─────────────────────────────────────────────────────
  platformStats: superAdminProcedure.input(z.void()).query(async () => {
    const [tenantsByTier, tenantsByStatus, totalUsers, totalTicketsAllTime, totalTicketsToday] = await Promise.all([
      prismaRaw.tenant.groupBy({ by: ['tier'], _count: { _all: true } }),
      prismaRaw.tenant.groupBy({ by: ['status'], _count: { _all: true } }),
      prismaRaw.user.count(),
      prismaRaw.ticket.count(),
      prismaRaw.ticket.count({ where: { createdAt: { gte: startOfTodayUtc() } } }),
    ]);
    const totalTenants = tenantsByStatus.reduce((sum, row) => sum + row._count._all, 0);
    return { totalTenants, tenantsByTier, tenantsByStatus, totalUsers, totalTicketsAllTime, totalTicketsToday };
  }),

  // ─── System Ads Manager (global, Free-tier interrupt engine) ───────────────
  listSystemAds: superAdminProcedure.input(z.void()).query(async () => {
    return prismaRaw.systemAd.findMany({ orderBy: { sortOrder: 'asc' } });
  }),

  // Single discriminated-union `create` (mirrors tenantAdRouter's convention) — handles both a
  // YouTube ad (videoId) and an uploaded ad (storageKey from the global upload route, Wave
  // 7.8-T1's `/api/system-ads/upload`) through the one input shape, rather than splitting into
  // create-youtube / create-uploaded mutations.
  createSystemAd: superAdminProcedure.input(createSystemAdSchema).mutation(async ({ input }) => {
    const agg = await prismaRaw.systemAd.aggregate({ _max: { sortOrder: true } });
    return prismaRaw.systemAd.create({
      data: {
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
  }),

  setSystemAdEnabled: superAdminProcedure
    .input(z.object({ id: z.string().cuid(), enabled: z.boolean() }))
    .mutation(async ({ input }) => {
      const existing = await prismaRaw.systemAd.findUnique({ where: { id: input.id } });
      if (existing == null) throw new TRPCError({ code: 'NOT_FOUND', message: 'Unknown system ad.' });
      return prismaRaw.systemAd.update({ where: { id: input.id }, data: { enabled: input.enabled } });
    }),

  reorderSystemAds: superAdminProcedure.input(reorderSystemAdsSchema).mutation(async ({ input }) => {
    await prismaRaw.$transaction(
      input.orderedIds.map((id, idx) => prismaRaw.systemAd.update({ where: { id }, data: { sortOrder: idx } })),
    );
    return { ok: true };
  }),

  deleteSystemAd: superAdminProcedure.input(idInputSchema).mutation(async ({ input }) => {
    const existing = await prismaRaw.systemAd.findUnique({ where: { id: input.id } });
    if (existing == null) throw new TRPCError({ code: 'NOT_FOUND', message: 'Unknown system ad.' });
    await prismaRaw.systemAd.delete({ where: { id: input.id } });
    if (existing.storageKey != null) {
      await deleteGlobalObject(existing.storageKey);
    }
    return { id: input.id };
  }),
});
