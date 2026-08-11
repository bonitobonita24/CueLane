// Wave 7.6-T3 — serviceRouter. Admin Core CRUD for Service (Transaction Type). Every procedure is
// `adminProcedure` (protected, tenant-scoped via ctx.tenantId resolved from session — never a
// client-supplied tenant id, L6 AsyncLocalStorage context already established by adminProcedure,
// Admin-role-only). `create` allocates the per-tenant Service.number atomically alongside the
// limit check inside a single `withTenant` RLS transaction (mirrors queue.ts's issueTicket
// pattern) — prevents two concurrent creates from either double-allocating a number or both
// slipping past the free-tier cap.
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { createServiceSchema, updateServiceSchema, TenantTier } from '@cuelane/shared';
import { prisma, withTenant, FeatureKey } from '@cuelane/db';
import { createTRPCRouter, matrixProcedure } from '../trpc';
import { assertWithinLimit, nextServiceNumber } from '@/server/domain/admin';
import { rethrowAdmin, idInputSchema, stripUndefined } from '../lib/admin-errors';

export const serviceRouter = createTRPCRouter({
  list: matrixProcedure(FeatureKey.services, 'view').input(z.void()).query(async ({ ctx }) => {
    return prisma.service.findMany({ where: { tenantId: ctx.tenantId }, orderBy: { number: 'asc' } });
  }),

  create: matrixProcedure(FeatureKey.services, 'write').input(createServiceSchema).mutation(async ({ ctx, input }) => {
    try {
      return await withTenant(ctx.tenantId, async (tx) => {
        const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId }, select: { tier: true } });
        await assertWithinLimit(tx, 'services', ctx.tenantId, tenant.tier as TenantTier);
        const number = await nextServiceNumber(tx, ctx.tenantId);
        return tx.service.create({ data: { tenantId: ctx.tenantId, number, ...input } });
      });
    } catch (e) {
      rethrowAdmin(e);
    }
  }),

  update: matrixProcedure(FeatureKey.services, 'update')
    .input(idInputSchema.merge(updateServiceSchema))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const existing = await prisma.service.findFirst({ where: { id, tenantId: ctx.tenantId } });
      if (existing == null) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Unknown service.' });
      }
      return prisma.service.update({ where: { id }, data: stripUndefined(data) });
    }),

  delete: matrixProcedure(FeatureKey.services, 'delete').input(idInputSchema).mutation(async ({ ctx, input }) => {
    const existing = await prisma.service.findFirst({ where: { id: input.id, tenantId: ctx.tenantId } });
    if (existing == null) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Unknown service.' });
    }
    await prisma.service.delete({ where: { id: input.id } });
    return { id: input.id };
  }),
});
