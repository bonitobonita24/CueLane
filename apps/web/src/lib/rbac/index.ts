/**
 * RBAC resolver barrel (Wave 0b + Wave 1). Single import surface for the per-role /
 * custom-role module view-access matrix (`.ai_prompt/rbac.md` Rule 34 Part B):
 * the Feature registry, the Principal resolver, the permission checker, and the
 * nav-filter helper. Server-only — everything here reads the DB or fixed policy,
 * never client input.
 */
export {
  FeatureKey,
  OWNER_ONLY_FEATURES,
  WRITABLE_FEATURES,
  FEATURE_LABELS,
} from './features';
export { hasPermission, type PermissionAction } from './hasPermission';
export {
  resolvePrincipal,
  type Principal,
  type PermissionFlags,
} from './principal';
export { visibleFeatures } from './visibleFeatures';
