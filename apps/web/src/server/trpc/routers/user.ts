// Wave 7.6-T4 — userRouter. Admin Core CRUD for User + the UserService join table (an employee's
// assigned services). `adminProcedure`-only (tenant-scoped, Admin-role-only). Every serviceId a
// caller supplies is validated to belong to THIS tenant before being written — never trust a
// client-supplied service id blindly (the same L6 tenant-isolation lesson queue.ts documents for
// windowId). Pin is always bcrypt-hashed (matches the Auth.js credentials provider, which verifies
// with bcrypt.compare — see server/auth/config.ts) and NEVER returned to the client.
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { createUserSchema, updateUserSchema, TenantTier } from '@cuelane/shared';
import { prisma, withTenant, type Prisma } from '@cuelane/db';
import { createTRPCRouter, adminProcedure } from '../trpc';
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
  user: { id: string; tenantId: string; name: string; role: string; createdAt: Date },
  serviceIds: string[],
) {
  return { id: user.id, tenantId: user.tenantId, name: user.name, role: user.role, createdAt: user.createdAt, serviceIds };
}

export const userRouter = createTRPCRouter({
  list: adminProcedure.input(z.void()).query(async ({ ctx }) => {
    const users = await prisma.user.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { name: 'asc' },
      include: { userServices: { select: { serviceId: true } } },
    });
    // Never return `pin` (bcrypt hash) to the client.
    return users.map((u) => serializeUser(u, u.userServices.map((us) => us.serviceId)));
  }),

  create: adminProcedure.input(createUserSchema).mutation(async ({ ctx, input }) => {
    const hashedPin = await bcrypt.hash(input.pin, 10);
    try {
      return await withTenant(ctx.tenantId, async (tx) => {
        const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId }, select: { tier: true } });
        await assertWithinLimit(tx, 'users', ctx.tenantId, tenant.tier as TenantTier);
        await assertServicesBelongToTenant(tx, ctx.tenantId, input.services);

        const user = await tx.user.create({
          data: { tenantId: ctx.tenantId, name: input.name, role: input.role, pin: hashedPin },
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

  update: adminProcedure.input(idInputSchema.merge(updateUserSchema)).mutation(async ({ ctx, input }) => {
    const { id, services, pin, name } = input;
    const existing = await prisma.user.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (existing == null) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Unknown user.' });
    }

    const patch: { name?: string; pin?: string } = stripUndefined({
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

        const updated = Object.keys(patch).length > 0 ? await tx.user.update({ where: { id }, data: patch }) : existing;
        const joins = await tx.userService.findMany({ where: { tenantId: ctx.tenantId, userId: id }, select: { serviceId: true } });
        return serializeUser(updated, joins.map((j) => j.serviceId));
      });
    } catch (e) {
      rethrowAdmin(e);
    }
  }),

  delete: adminProcedure.input(idInputSchema).mutation(async ({ ctx, input }) => {
    const existing = await prisma.user.findFirst({ where: { id: input.id, tenantId: ctx.tenantId } });
    if (existing == null) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Unknown user.' });
    }
    // UserService rows cascade (onDelete: Cascade, schema.prisma) — no explicit join cleanup needed.
    await prisma.user.delete({ where: { id: input.id } });
    return { id: input.id };
  }),
});
