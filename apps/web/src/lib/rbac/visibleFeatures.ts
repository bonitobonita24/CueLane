/**
 * Nav-filter helper (Wave 0b) — every FeatureKey a principal may VIEW, in
 * FeatureKey declaration order. Pure; used to filter admin-shell nav items.
 */
import { hasPermission } from './hasPermission';
import { FeatureKey } from './features';
import type { Principal } from './principal';

export function visibleFeatures(principal: Principal): FeatureKey[] {
  return (Object.values(FeatureKey) as FeatureKey[]).filter((key) => hasPermission(principal, key, 'view'));
}
