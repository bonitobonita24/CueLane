// T5 — platform break-glass ownership reassignment. Role.TenantManager only (`superAdminProcedure`
// — see trpc.ts), cross-tenant via `prismaRaw` (no single AsyncLocalStorage tenant context exists
// for a platform-wide operation; mirrors superAdmin.ts's rationale). Used when a tenant's owner is
// unreachable/locked out and the platform operator must reassign ownership on their behalf — the
// tenant-scoped `user.transferOwnership` path is reserved for the current owner acting themselves.
import { TRPCError } from '@trpc/server';
import { reassignOwnerSchema, Role } from '@cuelane/shared';
import { prismaRaw, writeAuditLog } from '@cuelane/db';
import { createTRPCRouter, superAdminProcedure } from '../trpc';

export const platformUserRouter = createTRPCRouter({
  reassignOwner: superAdminProcedure.input(reassignOwnerSchema).mutation(async ({ ctx, input }) => {
    const target = await prismaRaw.user.findFirst({ where: { id: input.newOwnerUserId, tenantId: input.tenantId } });
    if (target == null) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Target user does not belong to the named tenant.' });
    }

    const platformUserId = ctx.userId ?? 'PLATFORM';

    return prismaRaw.$transaction(async (tx) => {
      const currentOwners = await tx.user.findMany({ where: { tenantId: input.tenantId, role: Role.TenantSuperadmin } });

      // Demote every current owner FIRST (statement(s) before the promote) — the partial-unique
      // index (one_tenant_superadmin_per_tenant) is checked at each statement boundary, so no two
      // tenant_superadmin rows for this tenant may exist simultaneously mid-transaction.
      for (const owner of currentOwners) {
        const demoted = await tx.user.update({ where: { id: owner.id }, data: { role: Role.TenantAdmin } });
        await writeAuditLog(tx, {
          tenantId: input.tenantId,
          userId: platformUserId,
          action: 'UPDATE',
          entity: 'users',
          entityId: demoted.id,
          before: { role: owner.role },
          after: { role: demoted.role },
        });
      }

      const promoted = await tx.user.update({ where: { id: input.newOwnerUserId }, data: { role: Role.TenantSuperadmin } });
      await writeAuditLog(tx, {
        tenantId: input.tenantId,
        userId: platformUserId,
        action: 'UPDATE',
        entity: 'users',
        entityId: promoted.id,
        before: { role: target.role },
        after: { role: promoted.role },
      });

      return { tenantId: input.tenantId, newOwnerId: promoted.id };
    });
  }),
});
