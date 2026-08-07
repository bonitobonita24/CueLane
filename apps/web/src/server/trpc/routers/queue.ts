// Wave 7.1-T3 — queueRouter. Wires the Wave 7.1-T2 queue domain module (apps/web/src/server/domain/queue.ts)
// to tRPC with tenant scoping (RLS `withTenant` for mutations — see queue.ts's L2/L6 note), RBAC,
// and the unauthenticated kiosk path (`kioskProcedure`, resolves tenantId via prismaRaw then
// enters `withTenantContext` — the L6 lesson from the /login fix).
//
// Wave 7.2-T2 — every mutation now publishes its domain `events[]` to Valkey pub/sub via
// `publishEvents` (fire-and-forget-safe: a Valkey outage never fails the mutation — see
// server/realtime/publisher.ts). Publish happens AFTER the domain call succeeds (ticket state is
// already committed), so a publish failure never rolls back or blocks the response.

import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  callNextSchema,
  completeTicketSchema,
  createTicketSchema,
  recallSkippedTicketSchema,
  recallTicketSchema,
  skipTicketSchema,
  transferTicketSchema,
  Role,
} from '@cuelane/shared';
import { prisma, withTenant, withTenantContext } from '@cuelane/db';
import { createTRPCRouter, kioskProcedure, protectedProcedure, assertTenantActive } from '../trpc';
import { requireTenant } from '../middleware/tenant';
import { requireRole } from '../middleware/rbac';
import { publishEvents } from '@/server/realtime/publisher';
import {
  callNext as domainCallNext,
  complete as domainComplete,
  issueTicket as domainIssueTicket,
  QueueDomainError,
  recall as domainRecall,
  recallSkipped as domainRecallSkipped,
  skip as domainSkip,
  transfer as domainTransfer,
} from '@/server/domain/queue';

/** Translates a domain-layer error into the matching TRPCError; unknown errors pass through
 *  unchanged (tRPC's default error formatter turns those into INTERNAL_SERVER_ERROR). */
function rethrow(e: unknown): never {
  if (e instanceof QueueDomainError) {
    throw new TRPCError({ code: e.code, message: e.message });
  }
  throw e;
}

// A protected, tenant-scoped, Employee/Admin-only procedure — the shared base for every
// staff-facing queue mutation/query below. The final middleware establishes the L6
// AsyncLocalStorage tenant context (mandatory pattern — see packages/db's tenant-guard) for
// every downstream resolver's plain `prisma.*` (guarded) calls; mutations additionally wrap
// their domain call in `withTenant` (RLS tx) for atomicity, same as the kiosk `issue` path.
// Exported (Wave 7.4) so station.ts's window-session router shares the exact same
// tenant/role/context-narrowing guarantees instead of re-deriving them.
export const staffProcedure = protectedProcedure
  .use(requireTenant)
  .use(requireRole(Role.Employee, Role.TenantAdmin, Role.TenantSuperadmin))
  .use(async ({ ctx, next }) => {
    // requireTenant/requireRole are standalone middleware typed against the base Context
    // (userId/tenantId nullable) — they pass ctx through unnarrowed even though protectedProcedure
    // already guarantees non-null at runtime. Re-narrow explicitly here so every downstream
    // resolver gets non-nullable tenantId/userId in its ctx type (not just at runtime).
    const tenantId = ctx.tenantId;
    const userId = ctx.userId;
    if (tenantId == null || userId == null) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }
    // Wave 7.8-T2 — a suspended tenant's Employee Station must be blocked mid-session, same as
    // adminProcedure (trpc.ts's `assertTenantActive`). Employee sessions never carry
    // Role.TenantManager, so no bypass is needed here (unlike adminProcedure, which super-admin can
    // also hit through shared admin routers).
    await assertTenantActive(tenantId);
    return withTenantContext(tenantId, () => next({ ctx: { ...ctx, tenantId, userId } }));
  });

export const queueRouter = createTRPCRouter({
  // ─── Kiosk (unauthenticated, tenantSlug-resolved) ─────────────────────────────

  issue: kioskProcedure
    .input(createTicketSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await withTenant(ctx.tenantId, (tx) =>
          domainIssueTicket({ serviceId: input.serviceId, priority: input.priority }, { tenantId: ctx.tenantId, tx }),
        );
        await publishEvents(result.events);
        return { number: result.ticket.number, ticketId: result.ticket.id };
      } catch (e) {
        rethrow(e);
      }
    }),

  // Kiosk transaction-grid data — every service for this tenant, ordered for stable tile layout.
  // The Service model has no enabled/disabled flag yet (schema.prisma), so "active" here means
  // "exists for this tenant" — every row returned is safe for the public kiosk (no PII, no
  // cross-tenant leakage: `ctx.tenantId` is server-resolved from tenantSlug by kioskProcedure,
  // never client-supplied — the L6 tenant-isolation lesson).
  listActive: kioskProcedure.query(async ({ ctx }) => {
    return prisma.service.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { number: 'asc' },
      select: { id: true, name: true, number: true, icon: true, color: true, avgTime: true },
    });
  }),

  // Wave 7.5 — Big Display's single-round-trip public read. Public (kioskProcedure — the wall
  // screen has no login, same unauthenticated posture as the kiosk), tenantSlug-resolved. Returns
  // everything the display client needs in one call: now-serving (per window, with the ticket
  // + service it's serving), up-next (next 6 waiting, priority-first-then-FIFO — same ordering
  // queueRouter.callNext uses), the total waiting count, and the branding fields needed for
  // free-tier gating (companyName + tier — Tenant is a GLOBAL_MODEL, so reading it via the plain
  // `prisma` client here needs no extra tenant-context wrap; ctx.tenantId is server-resolved from
  // tenantSlug by kioskProcedure, never client-supplied — no cross-tenant leakage).
  state: kioskProcedure.query(async ({ ctx }) => {
    const [tenant, nowServing, upNext, totalWaiting] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: ctx.tenantId }, select: { companyName: true, tier: true } }),
      prisma.ticket.findMany({
        where: { tenantId: ctx.tenantId, status: 'serving' },
        orderBy: { calledAt: 'asc' },
        include: { window: { select: { id: true, name: true } }, service: { select: { name: true } } },
      }),
      prisma.ticket.findMany({
        where: { tenantId: ctx.tenantId, status: 'waiting' },
        orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
        take: 6,
        include: { service: { select: { name: true } } },
      }),
      prisma.ticket.count({ where: { tenantId: ctx.tenantId, status: 'waiting' } }),
    ]);

    return {
      companyName: tenant?.companyName ?? '',
      tier: tenant?.tier ?? 'free',
      nowServing: nowServing.map((t) => ({
        windowId: t.windowId,
        windowName: t.window?.name ?? 'Window',
        ticketNumber: t.number,
        serviceName: t.service.name,
        priority: t.priority,
      })),
      upNext: upNext.map((t) => ({
        ticketNumber: t.number,
        serviceName: t.service.name,
        priority: t.priority,
      })),
      totalWaiting,
    };
  }),

  // Live waiting/serving counts — safe for the public kiosk display (no ticket-level detail).
  counts: kioskProcedure.query(async ({ ctx }) => {
    const [waiting, serving] = await Promise.all([
      prisma.ticket.count({ where: { tenantId: ctx.tenantId, status: 'waiting' } }),
      prisma.ticket.count({ where: { tenantId: ctx.tenantId, status: 'serving' } }),
    ]);
    return { waiting, serving };
  }),

  // ─── Staff (protected, tenant-scoped, Employee/Admin) ─────────────────────────

  callNext: staffProcedure.input(callNextSchema).mutation(async ({ ctx, input }) => {
    // Resolve the calling employee's assigned services (never trust a client-supplied list).
    const assignments = await prisma.userService.findMany({
      where: { tenantId: ctx.tenantId, userId: ctx.userId },
      select: { serviceId: true },
    });
    const serviceIds = assignments.map((a) => a.serviceId);

    try {
      const result = await withTenant(ctx.tenantId, (tx) =>
        domainCallNext({ windowId: input.windowId, userId: ctx.userId, serviceIds }, { tenantId: ctx.tenantId, tx }),
      );
      await publishEvents(result.events);
      return result.ticket;
    } catch (e) {
      rethrow(e);
    }
  }),

  complete: staffProcedure.input(completeTicketSchema).mutation(async ({ ctx, input }) => {
    try {
      const result = await withTenant(ctx.tenantId, (tx) => domainComplete(input, { tenantId: ctx.tenantId, tx }));
      await publishEvents(result.events);
      return result.ticket;
    } catch (e) {
      rethrow(e);
    }
  }),

  skip: staffProcedure.input(skipTicketSchema).mutation(async ({ ctx, input }) => {
    try {
      const result = await withTenant(ctx.tenantId, (tx) => domainSkip(input, { tenantId: ctx.tenantId, tx }));
      await publishEvents(result.events);
      return result.ticket;
    } catch (e) {
      rethrow(e);
    }
  }),

  recall: staffProcedure.input(recallTicketSchema).mutation(async ({ ctx, input }) => {
    try {
      const result = await withTenant(ctx.tenantId, (tx) =>
        domainRecall({ ticketId: input.ticketId }, { tenantId: ctx.tenantId, tx }),
      );
      await publishEvents(result.events);
      return result.ticket;
    } catch (e) {
      rethrow(e);
    }
  }),

  // Wave 7.4 — "Skipped Tickets (tap to recall)" (PRODUCT.md line 32). Distinct from `recall`
  // above (which only re-announces an ALREADY-serving ticket): brings a `skipped` ticket back
  // into `serving` at the CALLING employee's currently-selected window.
  recallSkipped: staffProcedure.input(recallSkippedTicketSchema).mutation(async ({ ctx, input }) => {
    try {
      const result = await withTenant(ctx.tenantId, (tx) =>
        domainRecallSkipped({ ticketId: input.ticketId, windowId: input.windowId, userId: ctx.userId }, { tenantId: ctx.tenantId, tx }),
      );
      await publishEvents(result.events);
      return result.ticket;
    } catch (e) {
      rethrow(e);
    }
  }),

  transfer: staffProcedure.input(transferTicketSchema).mutation(async ({ ctx, input }) => {
    // Premium gate — Return After Done is a Premium-tier feature (PRODUCT.md line 32).
    // Tenant is a GLOBAL_MODEL (bypasses the L6 guard), so this read needs no tenant context.
    if (input.returnAfterDone) {
      const tenant = await prisma.tenant.findUnique({ where: { id: ctx.tenantId }, select: { tier: true } });
      if (tenant?.tier !== 'premium') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Return After Done is a Premium feature.' });
      }
    }

    try {
      const result = await withTenant(ctx.tenantId, (tx) => domainTransfer(input, { tenantId: ctx.tenantId, tx }));
      await publishEvents(result.events);
      return result.ticket;
    } catch (e) {
      rethrow(e);
    }
  }),

  listWaiting: staffProcedure.input(z.void()).query(async ({ ctx }) => {
    return prisma.ticket.findMany({
      where: { tenantId: ctx.tenantId, status: 'waiting' },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });
  }),

  // Wave 7.4 — the station's "Skipped Tickets (tap to recall)" panel (PRODUCT.md line 32).
  listSkipped: staffProcedure.input(z.void()).query(async ({ ctx }) => {
    return prisma.ticket.findMany({
      where: { tenantId: ctx.tenantId, status: 'skipped' },
      orderBy: { createdAt: 'asc' },
    });
  }),

  nowServing: staffProcedure.input(z.void()).query(async ({ ctx }) => {
    return prisma.ticket.findMany({ where: { tenantId: ctx.tenantId, status: 'serving' } });
  }),

  // Wave 7.4 — window picker for the station (window-selection UI + Transfer's destination
  // picker). Every window for this tenant, no PII — safe for any staffProcedure caller.
  listWindows: staffProcedure.input(z.void()).query(async ({ ctx }) => {
    return prisma.window.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
  }),
});
