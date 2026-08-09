// RBAC Wave 2 (Rule 34 Part B) — rolesRouter. Tenant-scoped custom-role builder CRUD: the
// owner-only surface a `tenant_superadmin` (or the platform `tenant_manager`) uses to author
// custom roles and their per-feature view-access matrix (`CustomRole` + `RolePermission`).
// Guarded with `userManagementProcedure` (owner-only — narrower than `adminProcedure`), NOT
// `matrixProcedure(FeatureKey.roles, …)`: role-authoring is itself the User-Management /
// OWNER_ONLY surface (`.ai_prompt/rbac.md` Rule 34 Part B), so a plain `tenant_admin` must be
// FORBIDDEN outright rather than matrix-evaluated.
//
// HARD GUARDRAIL: a custom role may NEVER grant a permission on an `OWNER_ONLY_FEATURES` feature
// (`users`, `roles`) — enforced server-side on every write via `assertNoOwnerOnlyGrant`,
// independent of whatever the client sends.
//
// All reads/writes are scoped to `ctx.tenantId` (established by `userManagementProcedure`'s
// AsyncLocalStorage context) — `tenantId` is NEVER taken from client input.
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { createCustomRoleSchema, updateCustomRoleSchema } from '@cuelane/shared';
import { prisma, withTenant, FeatureKey } from '@cuelane/db';
import { createTRPCRouter, userManagementProcedure } from '../trpc';
import { OWNER_ONLY_FEATURES, WRITABLE_FEATURES, FEATURE_LABELS } from '@/lib/rbac';
import { idInputSchema } from '../lib/admin-errors';

interface PermissionRow {
  featureKey: FeatureKey;
  view: boolean;
  write: boolean;
  update: boolean;
  delete: boolean;
}

// `permissions` here comes straight off the Zod-validated client input, whose `featureKey` is
// typed against @cuelane/shared's mirror `FeatureKey` enum (packages/shared cannot depend on
// @cuelane/db — see packages/shared/src/types/index.ts). The two enums share identical runtime
// string values (schema.prisma is the source of truth both mirror), so a cast to the DB enum for
// the `Set.has` lookup is safe — accept `string` here rather than fight the nominal TS enum
// mismatch.
function assertNoOwnerOnlyGrant(permissions: { featureKey: string }[]): void {
  const offending = permissions.find((p) => OWNER_ONLY_FEATURES.has(p.featureKey as FeatureKey));
  if (offending != null) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `"${offending.featureKey}" may never be granted via a custom role.`,
    });
  }
}

function hasAnyGrant(p: { view: boolean; write: boolean; update: boolean; delete: boolean }): boolean {
  return p.view || p.write || p.update || p.delete;
}

function mapP2002(err: unknown, message: string): never {
  if (err != null && typeof err === 'object' && 'code' in err && err.code === 'P2002') {
    throw new TRPCError({ code: 'CONFLICT', message });
  }
  throw err;
}

export const rolesRouter = createTRPCRouter({
  featureCatalog: userManagementProcedure.input(z.void()).query(() => {
    return WRITABLE_FEATURES.map((featureKey) => ({
      featureKey,
      label: FEATURE_LABELS[featureKey],
    }));
  }),

  list: userManagementProcedure.input(z.void()).query(async ({ ctx }) => {
    const roles = await prisma.customRole.findMany({
      where: { tenantId: ctx.tenantId },
      include: { rolePermissions: true, _count: { select: { users: true } } },
      orderBy: { name: 'asc' },
    });

    return roles.map((r) => ({
      id: r.id,
      name: r.name,
      preset: r.preset,
      featureCount: r.rolePermissions.filter(hasAnyGrant).length,
      userCount: r._count.users,
    }));
  }),

  get: userManagementProcedure.input(idInputSchema).query(async ({ ctx, input }) => {
    const role = await prisma.customRole.findFirst({
      where: { id: input.id, tenantId: ctx.tenantId },
      include: { rolePermissions: true },
    });
    if (role == null) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Role not found for this tenant.' });
    }

    const byFeature = new Map(role.rolePermissions.map((p) => [p.featureKey, p]));
    const permissions: PermissionRow[] = WRITABLE_FEATURES.map((featureKey) => {
      const existing = byFeature.get(featureKey);
      return {
        featureKey,
        view: existing?.view ?? false,
        write: existing?.write ?? false,
        update: existing?.update ?? false,
        delete: existing?.delete ?? false,
      };
    });

    return { id: role.id, name: role.name, preset: role.preset, permissions };
  }),

  create: userManagementProcedure.input(createCustomRoleSchema).mutation(async ({ ctx, input }) => {
    assertNoOwnerOnlyGrant(input.permissions);
    const tenantId = ctx.tenantId;
    const grantedRows = input.permissions.filter(hasAnyGrant);

    try {
      const created = await withTenant(tenantId, async (tx) => {
        const role = await tx.customRole.create({
          data: { tenantId, name: input.name, preset: input.preset },
        });
        if (grantedRows.length > 0) {
          await tx.rolePermission.createMany({
            data: grantedRows.map((p) => ({
              tenantId,
              customRoleId: role.id,
              featureKey: p.featureKey,
              view: p.view,
              write: p.write,
              update: p.update,
              delete: p.delete,
            })),
          });
        }
        return role;
      });
      return { id: created.id };
    } catch (err) {
      mapP2002(err, 'A role with that name already exists');
    }
  }),

  update: userManagementProcedure.input(updateCustomRoleSchema).mutation(async ({ ctx, input }) => {
    assertNoOwnerOnlyGrant(input.permissions);
    const tenantId = ctx.tenantId;

    const existing = await prisma.customRole.findFirst({
      where: { id: input.id, tenantId },
      select: { id: true },
    });
    if (existing == null) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Role not found for this tenant.' });
    }

    const grantedRows = input.permissions.filter(hasAnyGrant);

    try {
      await withTenant(tenantId, async (tx) => {
        await tx.customRole.update({
          where: { id: input.id },
          data: { name: input.name, preset: input.preset },
        });
        await tx.rolePermission.deleteMany({ where: { customRoleId: input.id } });
        if (grantedRows.length > 0) {
          await tx.rolePermission.createMany({
            data: grantedRows.map((p) => ({
              tenantId,
              customRoleId: input.id,
              featureKey: p.featureKey,
              view: p.view,
              write: p.write,
              update: p.update,
              delete: p.delete,
            })),
          });
        }
      });
      return { id: input.id };
    } catch (err) {
      mapP2002(err, 'A role with that name already exists');
    }
  }),

  delete: userManagementProcedure.input(idInputSchema).mutation(async ({ ctx, input }) => {
    const tenantId = ctx.tenantId;
    const existing = await prisma.customRole.findFirst({
      where: { id: input.id, tenantId },
      select: { id: true },
    });
    if (existing == null) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Role not found for this tenant.' });
    }

    await withTenant(tenantId, async (tx) => {
      const assignedUserCount = await tx.user.count({ where: { customRoleId: input.id } });
      if (assignedUserCount > 0) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `Reassign ${assignedUserCount} staff before deleting this role`,
        });
      }
      await tx.customRole.delete({ where: { id: input.id } });
    });
    return { id: input.id };
  }),
});
