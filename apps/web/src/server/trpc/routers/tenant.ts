import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { requireTenant } from '../middleware/tenant';
import { requireRole } from '../middleware/rbac';
import { prisma } from '@cuelane/db';
import { Role } from '@cuelane/shared';

export const tenantRouter = createTRPCRouter({
  // Returns the current tenant's public info for the session tenant
  getCurrent: protectedProcedure
    .use(requireTenant)
    .input(z.void())
    .query(async ({ ctx }) => {
      if (ctx.tenantId == null) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }
      const tenant = await prisma.tenant.findUnique({
        where: { id: ctx.tenantId },
        select: {
          id: true,
          slug: true,
          companyName: true,
          tagline: true,
          logoUrl: true,
          tier: true,
          status: true,
          settings: true,
        },
      });
      if (!tenant) throw new TRPCError({ code: 'NOT_FOUND' });
      return tenant;
    }),

  // Super Admin only: list all tenants
  listAll: protectedProcedure
    .use(requireRole(Role.SuperAdmin))
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(20),
        cursor: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      const tenants = await prisma.tenant.findMany({
        take: input.limit + 1,
        // exactOptionalPropertyTypes + strict-boolean-expressions: explicit undefined check
        ...(input.cursor !== undefined ? { cursor: { id: input.cursor } } : {}),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          slug: true,
          companyName: true,
          tier: true,
          status: true,
          createdAt: true,
        },
      });

      let nextCursor: string | undefined;
      if (tenants.length > input.limit) {
        const next = tenants.pop();
        nextCursor = next?.id;
      }

      return { tenants, nextCursor };
    }),
});
