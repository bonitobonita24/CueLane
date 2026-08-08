/**
 * RBAC feature registry re-exports (Wave 0b — per-role menu/module view-access retrofit).
 *
 * `FeatureKey` is the fixed catalog of admin-shell modules a role/custom-role's
 * view-access matrix can grant/deny (packages/db/prisma/schema.prisma `Feature`
 * model + `.ai_prompt/rbac.md` Rule 34 Part B). `OWNER_ONLY_FEATURES` are the
 * feature keys that may NEVER be granted via a tenant custom-role permission
 * matrix — they stay exclusive to `tenant_admin`+ (users/roles = User-Management,
 * never matrix-grantable per the Rule 34 guardrail).
 */
import { FeatureKey } from '@cuelane/db';

export { FeatureKey };

export const OWNER_ONLY_FEATURES: ReadonlySet<FeatureKey> = new Set([
  FeatureKey.users,
  FeatureKey.roles,
]);

/**
 * The features a tenant's custom-role permission matrix may ever grant —
 * every `FeatureKey` MINUS `OWNER_ONLY_FEATURES`. Used by the custom-role
 * builder to build the feature catalog/editor rows and reject any attempt
 * to grant an owner-only feature via a custom role.
 */
export const WRITABLE_FEATURES: FeatureKey[] = Object.values(FeatureKey).filter(
  (f) => !OWNER_ONLY_FEATURES.has(f),
);

/** Human-readable labels for every `FeatureKey`, for admin-shell nav + the custom-role builder UI. */
export const FEATURE_LABELS: Record<FeatureKey, string> = {
  [FeatureKey.dashboard]: 'Dashboard',
  [FeatureKey.services]: 'Services',
  [FeatureKey.windows]: 'Windows',
  [FeatureKey.users]: 'Users',
  [FeatureKey.media]: 'Media',
  [FeatureKey.settings]: 'Settings',
  [FeatureKey.theme]: 'Theme',
  [FeatureKey.usage]: 'Usage',
  [FeatureKey.roles]: 'Roles',
};
