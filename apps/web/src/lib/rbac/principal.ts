/**
 * RBAC Principal resolution (Wave 0b — per-role menu/module view-access retrofit).
 *
 * A `Principal` is the fully-resolved, server-side authorization context for a
 * single authenticated user: their fixed system role (packages/db UserRole)
 * plus — when they hold a tenant custom role — the per-feature permission
 * matrix loaded from `CustomRole.rolePermissions` (`.ai_prompt/rbac.md` Rule
 * 34 Part B). Built once per request from the DB — never trusted from the
 * client.
 */
import type { PrismaClient, UserRole } from '@cuelane/db';
import type { FeatureKey } from './features';

export interface PermissionFlags {
  view: boolean;
  write: boolean;
  update: boolean;
  delete: boolean;
}

export interface Principal {
  userId: string;
  tenantId: string | null;
  role: UserRole;
  customRoleId: string | null;
  /** Populated only when the user holds a customRoleId (from CustomRole.rolePermissions). */
  permissions: Map<FeatureKey, PermissionFlags>;
}

/**
 * Loads a User by id and resolves their full authorization Principal —
 * including the custom-role permission matrix when `customRoleId` is set.
 * Throws if the user does not exist.
 */
export async function resolvePrincipal(userId: string, prisma: PrismaClient): Promise<Principal> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      customRole: {
        include: { rolePermissions: true },
      },
    },
  });

  if (user == null) {
    throw new Error(`resolvePrincipal: user not found (id: ${userId})`);
  }

  const permissions = new Map<FeatureKey, PermissionFlags>();
  if (user.customRole != null) {
    for (const perm of user.customRole.rolePermissions) {
      permissions.set(perm.featureKey, {
        view: perm.view,
        write: perm.write,
        update: perm.update,
        delete: perm.delete,
      });
    }
  }

  return {
    userId: user.id,
    tenantId: user.tenantId,
    role: user.role,
    customRoleId: user.customRoleId,
    permissions,
  };
}
