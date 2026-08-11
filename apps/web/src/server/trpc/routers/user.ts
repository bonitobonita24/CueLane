// Wave 7.6-T4 — userRouter. Admin Core CRUD for User + the UserService join table (an employee's
// assigned services). `adminProcedure`-only (tenant-scoped, Admin-role-only). Every serviceId a
// caller supplies is validated to belong to THIS tenant before being written — never trust a
// client-supplied service id blindly (the same L6 tenant-isolation lesson queue.ts documents for
// windowId). Pin is always bcrypt-hashed (matches the Auth.js credentials provider, which verifies
// with bcrypt.compare — see server/auth/config.ts) and NEVER returned to the client.
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { createUserSchema, updateUserSchema, transferOwnershipSchema, TenantTier, Role } from '@cuelane/shared';
import { prisma, withTenant, writeAuditLog, type Prisma } from '@cuelane/db';
import { createTRPCRouter, userManagementProcedure } from '../trpc';
import { AdminDomainError, assertWithinLimit } from '@/server/domain/admin';
import { rethrowAdmin, idInputSchema, stripUndefined } from '../lib/admin-errors';

/** Validates every id in `serviceIds` belongs to `tenantId` — throws BAD_REQUEST-mapped
 *  AdminDomainError otherwise. No-ops for an empty array. */
async function assertServicesBelongToTenant(
  db: Prisma.TransactionClient,
  tenantId: string,
  serviceIds: string[],
): Promise<void> {
  if (serviceIds.length === 0) return;
  const validCount = await db.service.count({ where: { tenantId, id: { in: serviceIds } } });
  if (validCount !== serviceIds.length) {
    throw new AdminDomainError('BAD_REQUEST', 'One or more services do not belong to this tenant.');
  }
}

function serializeUser(
  user: { id: string; tenantId: string; name: string; role: string; customRoleId: string | null; createdAt: Date },
  serviceIds: string[],
) {
  return {
    id: user.id,
    tenantId: user.tenantId,
    name: user.name,
    role: user.role,
    customRoleId: user.customRoleId,
    createdAt: user.createdAt,
    serviceIds,
  };
}

/** RBAC Wave 2 (Task 3) — `customRoleId` is meaningful ONLY for `role: Role.Employee` (see
 *  hasPermission.ts: tenant_admin/tenant_superadmin/tenant_manager never consult the matrix).
 *  Forces the value to `null` for any other role regardless of what the client sent, and — when a
 *  non-null id IS being assigned — validates it belongs to THIS tenant (never trust a
 *  client-supplied roleId across tenants, L6). Returns the id to persist. */
async function resolveCustomRoleId(
  db: Prisma.TransactionClient,
  tenantId: string,
  role: string,
  requestedCustomRoleId: string | null | undefined,
): Promise<string | null> {
  // `role` may arrive as either the shared `Role` enum (create, from createUserSchema) or the
  // Prisma-generated `UserRole` enum (update, from `existing.role`) — coerce to one nominal type
  // for the comparison, same pattern as transferOwnership's `targetRole` above (satisfies
  // @typescript-eslint/no-unsafe-enum-comparison).
  if ((role as unknown as Role) !== Role.Employee) {
    return null;
  }
  if (requestedCustomRoleId == null) {
    return null;
  }
  const found = await db.customRole.findFirst({ where: { id: requestedCustomRoleId, tenantId }, select: { id: true } });
  if (found == null) {
    throw new AdminDomainError('BAD_REQUEST', 'Custom role does not belong to this tenant.');
  }
  return requestedCustomRoleId;
}

export const userRouter = createTRPCRouter({
  list: userManagementProcedure.input(z.void()).query(async ({ ctx }) => {
    const users = await prisma.user.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { name: 'asc' },
      include: { userServices: { select: { serviceId: true } } },
    });
    // Never return `pin` (bcrypt hash) to the client.
    return users.map((u) => serializeUser(u, u.userServices.map((us) => us.serviceId)));
  }),

  create: userManagementProcedure.input(createUserSchema).mutation(async ({ ctx, input }) => {
    const hashedPin = await bcrypt.hash(input.pin, 10);
    try {
      return await withTenant(ctx.tenantId, async (tx) => {
        const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId }, select: { tier: true } });
        await assertWithinLimit(tx, 'users', ctx.tenantId, tenant.tier as TenantTier);
        await assertServicesBelongToTenant(tx, ctx.tenantId, input.services);
        const customRoleId = await resolveCustomRoleId(tx, ctx.tenantId, input.role, input.customRoleId);

        const user = await tx.user.create({
          data: { tenantId: ctx.tenantId, name: input.name, role: input.role, pin: hashedPin, customRoleId },
        });
        if (input.services.length > 0) {
          await tx.userService.createMany({
            data: input.services.map((serviceId) => ({ tenantId: ctx.tenantId, userId: user.id, serviceId })),
          });
        }
        return serializeUser(user, input.services);
      });
    } catch (e) {
      rethrowAdmin(e);
    }
  }),

  update: userManagementProcedure.input(idInputSchema.merge(updateUserSchema)).mutation(async ({ ctx, input }) => {
    const { id, services, pin, name, customRoleId: requestedCustomRoleId } = input;
    const existing = await prisma.user.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (existing == null) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Unknown user.' });
    }

    const patch: { name?: string; pin?: string; customRoleId?: string | null } = stripUndefined({
      name,
      pin: pin === undefined ? undefined : await bcrypt.hash(pin, 10),
    });

    try {
      return await withTenant(ctx.tenantId, async (tx) => {
        if (services !== undefined) {
          await assertServicesBelongToTenant(tx, ctx.tenantId, services);
          // Re-sync the join: delete every existing assignment, then re-create the supplied set.
          await tx.userService.deleteMany({ where: { tenantId: ctx.tenantId, userId: id } });
          if (services.length > 0) {
            await tx.userService.createMany({
              data: services.map((serviceId) => ({ tenantId: ctx.tenantId, userId: id, serviceId })),
            });
          }
        }

        // requestedCustomRoleId undefined = "no change from the client" (skip); explicit null/id =
        // resolve against the EXISTING role (this mutation never changes `role`).
        if (requestedCustomRoleId !== undefined) {
          patch.customRoleId = await resolveCustomRoleId(tx, ctx.tenantId, existing.role, requestedCustomRoleId);
        }

        const updated = Object.keys(patch).length > 0 ? await tx.user.update({ where: { id }, data: patch }) : existing;
        const joins = await tx.userService.findMany({ where: { tenantId: ctx.tenantId, userId: id }, select: { serviceId: true } });
        return serializeUser(updated, joins.map((j) => j.serviceId));
      });
    } catch (e) {
      rethrowAdmin(e);
    }
  }),

  // T5 — in-tenant ownership succession. ONLY the current owner (TenantSuperadmin) may transfer
  // their own tenant's ownership — a platform TenantManager acting cross-tenant must use the
  // break-glass `platformUser.reassignOwner` path instead. The partial-unique index
  // (one_tenant_superadmin_per_tenant, WHERE role='tenant_superadmin' AND tenant_id IS NOT NULL)
  // is checked by Postgres at EACH statement boundary, so the demote (statement 1) MUST commit
  // before the promote (statement 2) — both inside the same transaction.
  transferOwnership: userManagementProcedure.input(transferOwnershipSchema).mutation(async ({ ctx, input }) => {
    if (!ctx.roles.includes(Role.TenantSuperadmin)) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Only the current tenant owner may transfer ownership.' });
    }
    if (input.newOwnerUserId === ctx.userId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot transfer ownership to yourself.' });
    }

    const target = await prisma.user.findFirst({ where: { id: input.newOwnerUserId, tenantId: ctx.tenantId } });
    if (target == null) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Unknown user.' });
    }
    // `target.role` is the Prisma-generated UserRole enum; coerce to the shared Role enum so the
    // comparison shares one enum type (satisfies @typescript-eslint/no-unsafe-enum-comparison).
    const targetRole = target.role as unknown as Role;
    if (targetRole !== Role.TenantAdmin && targetRole !== Role.Employee) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Ownership can only transfer to a tenant_admin or employee.' });
    }

    const previousOwnerId = ctx.userId;
    return withTenant(ctx.tenantId, async (tx) => {
      const previousOwnerBefore = await tx.user.findUniqueOrThrow({ where: { id: previousOwnerId } });

      // Statement 1 — demote the current owner FIRST so the partial-unique index never sees two
      // tenant_superadmin rows for this tenant at once.
      const demoted = await tx.user.update({ where: { id: previousOwnerId }, data: { role: Role.TenantAdmin } });
      // Statement 2 — promote the successor.
      const promoted = await tx.user.update({ where: { id: input.newOwnerUserId }, data: { role: Role.TenantSuperadmin } });

      await writeAuditLog(tx, {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'UPDATE',
        entity: 'users',
        entityId: demoted.id,
        before: { role: previousOwnerBefore.role },
        after: { role: demoted.role },
      });
      await writeAuditLog(tx, {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'UPDATE',
        entity: 'users',
        entityId: promoted.id,
        before: { role: target.role },
        after: { role: promoted.role },
      });

      return { previousOwnerId: demoted.id, newOwnerId: promoted.id };
    });
  }),

  delete: userManagementProcedure.input(idInputSchema).mutation(async ({ ctx, input }) => {
    const existing = await prisma.user.findFirst({ where: { id: input.id, tenantId: ctx.tenantId } });
    if (existing == null) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Unknown user.' });
    }
    // UserService rows cascade (onDelete: Cascade, schema.prisma) — no explicit join cleanup needed.
    await prisma.user.delete({ where: { id: input.id } });
    return { id: input.id };
  }),
});
