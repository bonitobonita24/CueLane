/**
 * Custom-role preset → view-access matrix mapping (Rule 34 Part B, §4.4). FerryBook's
 * customRoles router has no equivalent — the preset is stored on `CustomRole.preset` purely
 * as a UI/audit label there. CueLane authors the actual preset→matrix expansion here so the
 * custom-role builder UI (Wave 2) can pre-fill a starting matrix when the tenant owner picks a
 * preset, before fine-tuning individual cells.
 *
 * Presets apply per-feature over `WRITABLE_FEATURES` only — `users`/`roles`
 * (`OWNER_ONLY_FEATURES`) are never included, matching the hard guardrail enforced
 * server-side in the roles router regardless of what a client sends.
 */
import { FeatureKey, WRITABLE_FEATURES } from './features';

// CLIENT-SAFE BY CONSTRUCTION (Wave 2 build-break fix, same rationale as features.ts): a local,
// self-contained, zero-import mirror of `@cuelane/db`'s Prisma-generated `RolePreset` literal
// union, instead of a value import from `@cuelane/db` (its barrel drags `node:async_hooks` into
// any client bundle that imports it — this file is reachable from `'use client'`
// RoleFormDialog.tsx via `presetMatrix`).
export const RolePreset = {
  supervisor: 'supervisor',
  operator: 'operator',
  contributor: 'contributor',
  viewer: 'viewer',
} as const;
export type RolePreset = (typeof RolePreset)[keyof typeof RolePreset];

export interface PresetPermissionRow {
  featureKey: FeatureKey;
  view: boolean;
  write: boolean;
  update: boolean;
  delete: boolean;
}

// Features that get only `view` under the operator/contributor presets — the reporting/config
// surfaces, as opposed to the day-to-day operational surfaces (services, windows, media).
const VIEW_ONLY_UNDER_OPERATOR = new Set<FeatureKey>([
  FeatureKey.dashboard,
  FeatureKey.settings,
  FeatureKey.theme,
  FeatureKey.usage,
]);

// The operational surfaces contributor gets write (no update/delete) on.
const CONTRIBUTOR_WRITE_FEATURES = new Set<FeatureKey>([
  FeatureKey.services,
  FeatureKey.windows,
  FeatureKey.media,
]);

// Features supervisor may delete on (the rest get full view/write/update, no delete).
const SUPERVISOR_DELETE_FEATURES = new Set<FeatureKey>([
  FeatureKey.services,
  FeatureKey.windows,
  FeatureKey.media,
]);

export function presetMatrix(preset: RolePreset): PresetPermissionRow[] {
  return WRITABLE_FEATURES.map((featureKey) => {
    switch (preset) {
      case RolePreset.supervisor:
        return {
          featureKey,
          view: true,
          write: true,
          update: true,
          delete: SUPERVISOR_DELETE_FEATURES.has(featureKey),
        };

      case RolePreset.operator: {
        const viewOnly = VIEW_ONLY_UNDER_OPERATOR.has(featureKey);
        return {
          featureKey,
          view: true,
          write: !viewOnly,
          update: !viewOnly,
          delete: false,
        };
      }

      case RolePreset.contributor: {
        if (featureKey === FeatureKey.dashboard) {
          return { featureKey, view: true, write: false, update: false, delete: false };
        }
        const canWrite = CONTRIBUTOR_WRITE_FEATURES.has(featureKey);
        return { featureKey, view: canWrite, write: canWrite, update: false, delete: false };
      }

      case RolePreset.viewer:
      default:
        return { featureKey, view: true, write: false, update: false, delete: false };
    }
  });
}
