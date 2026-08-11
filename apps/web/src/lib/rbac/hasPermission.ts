/**
 * RBAC permission resolver (Wave 0b — per-role menu/module view-access retrofit).
 *
 * Implements the fixed 3-tier ceiling + the tenant custom-role permission
 * matrix per `.ai_prompt/rbac.md` Rule 34 Part B:
 *   - tenant_manager / tenant_superadmin: full access to every FeatureKey
 *     (incl. users/roles — the platform + tenant-owner tiers).
 *   - tenant_admin: full access EXCEPT users/roles (the OWNER_ONLY guardrail —
 *     User-Management stays exclusive to the owner tier, and is the capability
 *     ceiling for every custom role).
 *   - employee (and any user holding a customRoleId): resolved from
 *     `principal.permissions` (the role_permissions matrix loaded by
 *     resolvePrincipal). users/roles are HARD-DENIED even if a matrix row
 *     somehow grants them (defense in depth) — deny-by-default on a missing row.
 *
 * Deny-by-default: any unrecognized role/feature/action combination is false.
 */
import { OWNER_ONLY_FEATURES, type FeatureKey } from './features';
import type { Principal } from './principal';

export type PermissionAction = 'view' | 'write' | 'update' | 'delete';

export function hasPermission(principal: Principal, feature: FeatureKey, action: PermissionAction): boolean {
  switch (principal.role) {
    case 'tenant_manager':
    case 'tenant_superadmin':
      return true;

    case 'tenant_admin':
      return !OWNER_ONLY_FEATURES.has(feature);

    case 'employee': {
      if (OWNER_ONLY_FEATURES.has(feature)) {
        return false;
      }
      const flags = principal.permissions.get(feature);
      return flags?.[action] ?? false;
    }

    default:
      return false;
  }
}
