// Wave 7.6-T4 — tenantAdminRouter. `getUsage` (services/windows/users counts vs. this tenant's
// tier caps — domain/admin.ts), `getSettings`/`updateSettings` (Tenant.settings JSON, read-modify-
// write so an update NEVER clobbers unrelated keys). `adminProcedure`-only; tenantId is always
// resolved from `ctx.tenantId` (session-derived) — never a client-supplied tenant id.
import { z } from 'zod';
import { updateTenantSettingsSchema } from '@cuelane/shared';
import { prisma, prismaRaw, type Prisma } from '@cuelane/db';
import { createTRPCRouter, adminProcedure } from '../trpc';
import { getUsage as domainGetUsage } from '@/server/domain/admin';
import { stripUndefined } from '../lib/admin-errors';

export const tenantAdminRouter = createTRPCRouter({
  // `prismaRaw` (unguarded) here, not the L6-guarded `prisma` — domain/admin.ts's Db type is
  // `Prisma.TransactionClient | PrismaClient`, and `prisma` (the tenant-guard `$extends()`
  // result) is a structurally-narrower extended-client type that doesn't match `PrismaClient`
  // exactly. domain/admin.ts already filters every query by the explicit `tenantId` parameter
  // (same L2/L6 convention as queue.ts's domain layer), so this is safe without the guard.
  getUsage: adminProcedure.input(z.void()).query(async ({ ctx }) => {
    return domainGetUsage(prismaRaw, ctx.tenantId);
  }),

  getSettings: adminProcedure.input(z.void()).query(async ({ ctx }) => {
    const tenant = await prisma.tenant.findUniqueOrThrow({
      where: { id: ctx.tenantId },
      select: { companyName: true, tagline: true, logoUrl: true, tier: true, settings: true },
    });
    return tenant;
  }),

  updateSettings: adminProcedure.input(updateTenantSettingsSchema).mutation(async ({ ctx, input }) => {
    const { settings: settingsPatch, ...tenantFields } = input;

    const existing = await prisma.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId }, select: { settings: true } });
    const existingSettings = (existing.settings ?? {}) as Record<string, unknown>;

    let mergedSettings: Record<string, unknown> = existingSettings;
    if (settingsPatch !== undefined) {
      const cleanPatch = stripUndefined(settingsPatch);
      mergedSettings = { ...existingSettings, ...cleanPatch };

      // printerConfig is itself a nested object — merge it too, so patching one printer field
      // (e.g. just `autoCut`) never drops sibling fields (e.g. `paperWidth`) that were already set.
      if (cleanPatch.printerConfig !== undefined) {
        const existingPrinterConfig = (existingSettings['printerConfig'] ?? {}) as Record<string, unknown>;
        mergedSettings['printerConfig'] = { ...existingPrinterConfig, ...stripUndefined(cleanPatch.printerConfig) };
      }
    }

    const updated = await prisma.tenant.update({
      where: { id: ctx.tenantId },
      data: {
        ...stripUndefined(tenantFields),
        settings: mergedSettings as Prisma.InputJsonValue,
      },
    });
    return updated;
  }),
});
