// Wave 7.6-T3 — windowRouter. Admin Core CRUD for Window. Same `adminProcedure` guarantees as
// serviceRouter (tenant-scoped, Admin-only). No per-tenant numbering — windows are named, not
// numbered — so `create` only needs the limit check (still inside `withTenant` so the count read
// + create are atomic against a concurrent create racing past the free-tier cap).
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { createWindowSchema, updateWindowSchema, TenantTier } from '@cuelane/shared';
import { prisma, withTenant, FeatureKey } from '@cuelane/db';
import { createTRPCRouter, matrixProcedure } from '../trpc';
import { assertWithinLimit } from '@/server/domain/admin';
import { rethrowAdmin, idInputSchema, stripUndefined } from '../lib/admin-errors';

export const windowRouter = createTRPCRouter({
  list: matrixProcedure(FeatureKey.windows, 'view').input(z.void()).query(async ({ ctx }) => {
    return prisma.window.findMany({ where: { tenantId: ctx.tenantId }, orderBy: { name: 'asc' } });
  }),

  create: matrixProcedure(FeatureKey.windows, 'write').input(createWindowSchema).mutation(async ({ ctx, input }) => {
    try {
      return await withTenant(ctx.tenantId, async (tx) => {
        const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId }, select: { tier: true } });
        await assertWithinLimit(tx, 'windows', ctx.tenantId, tenant.tier as TenantTier);
        return tx.window.create({ data: { tenantId: ctx.tenantId, ...input } });
      });
    } catch (e) {
      rethrowAdmin(e);
    }
  }),

  update: matrixProcedure(FeatureKey.windows, 'update')
    .input(idInputSchema.merge(updateWindowSchema))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const existing = await prisma.window.findFirst({ where: { id, tenantId: ctx.tenantId } });
      if (existing == null) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Unknown window.' });
      }
      return prisma.window.update({ where: { id }, data: stripUndefined(data) });
    }),

  delete: matrixProcedure(FeatureKey.windows, 'delete').input(idInputSchema).mutation(async ({ ctx, input }) => {
    const existing = await prisma.window.findFirst({ where: { id: input.id, tenantId: ctx.tenantId } });
    if (existing == null) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Unknown window.' });
    }
    await prisma.window.delete({ where: { id: input.id } });
    return { id: input.id };
  }),
});
