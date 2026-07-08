// Wave 7.7a-T2 — dashboardRouter. `dashboard.get` returns the full KPI payload from
// domain/dashboard.ts's `computeDashboard` PLUS `tier` (read fresh from `Tenant.tier` — the tier
// source of truth per PM decision 5, docs/DECISIONS_LOG.md 2026-07-08) so the client can gate the
// advanced/premium-only blocks. `dashboard.ticketLog` returns a searchable ticket log for the
// same range. Both `adminProcedure`-only — tenantId is always resolved from `ctx.tenantId`
// (session-derived), never a client-supplied tenant id.
//
// `prismaRaw` (unguarded) here, not the L6-guarded `prisma` — same reasoning as
// tenantAdminRouter.ts: domain/dashboard.ts's `Db` type is `Prisma.TransactionClient |
// PrismaClient`, and `prisma` (the tenant-guard `$extends()` result) is a structurally-narrower
// extended-client type that doesn't match `PrismaClient` exactly. domain/dashboard.ts already
// filters every query by the explicit `tenantId` parameter (same L2/L6 convention as
// domain/admin.ts and domain/queue.ts), so this is safe without the guard — and this router only
// runs behind `adminProcedure`, which has already established tenant context.
import { dashboardRangeSchema, dashboardTicketLogSchema } from '@cuelane/shared';
import { prismaRaw } from '@cuelane/db';
import { createTRPCRouter, adminProcedure } from '../trpc';
import { computeDashboard, getRangeBounds } from '@/server/domain/dashboard';

export const dashboardRouter = createTRPCRouter({
  get: adminProcedure.input(dashboardRangeSchema).query(async ({ ctx, input }) => {
    const [result, tenant] = await Promise.all([
      computeDashboard(prismaRaw, ctx.tenantId, input),
      prismaRaw.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId }, select: { tier: true } }),
    ]);
    return { ...result, tier: tenant.tier };
  }),

  ticketLog: adminProcedure.input(dashboardTicketLogSchema).query(async ({ ctx, input }) => {
    const { start, end } = getRangeBounds(input.range);
    const search = input.search?.trim() ?? '';

    const tickets = await prismaRaw.ticket.findMany({
      where: {
        tenantId: ctx.tenantId,
        createdAt: { gte: start, lt: end },
        ...(search !== ''
          ? {
              OR: [
                { number: { contains: search, mode: 'insensitive' } },
                { service: { name: { contains: search, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        number: true,
        status: true,
        createdAt: true,
        calledAt: true,
        completedAt: true,
        service: { select: { name: true } },
        window: { select: { name: true } },
      },
    });

    return tickets.map((t) => ({
      id: t.id,
      number: t.number,
      serviceName: t.service.name,
      status: t.status,
      windowLabel: t.window?.name ?? null,
      createdAt: t.createdAt,
      calledAt: t.calledAt,
      completedAt: t.completedAt,
    }));
  }),
});
