// Wave 7.6-T5 — Admin panel access rules. Pure, tenant-agnostic functions (no DB/session access
// here — callers resolve `roles`/`tier` from ctx.session/ctx.tenantId and pass them in) so they
// can be unit-tested in the existing node-environment vitest setup (this repo has no RSC/DOM test
// harness yet — every test in apps/web is a plain `.test.ts` against exported logic, same
// convention as server/domain/admin.ts). `layout.tsx` is a thin server-component wrapper around
// these two functions plus the redirect/render side effects that can't be unit-tested without a
// browser-render harness.
import { Role, TenantTier } from '@cuelane/shared';
import { FeatureKey } from '@cuelane/db';
import { hasPermission } from '@/lib/rbac';
import type { Principal } from '@/lib/rbac';

export interface AdminTab {
  id: string;
  label: string;
  /** Path segment under /{tenant}/admin/, e.g. 'services' → /{tenant}/admin/services. Empty
   *  string ('') is the special case for the admin ROOT (Dashboard) — AdminTabsNav renders it as
   *  `/{tenant}/admin` with no trailing slash, not `/{tenant}/admin/`. */
  href: string;
  /** The view-access FeatureKey this tab maps to (Wave 1 — Rule 34 Part B). The sidebar renders a
   *  tab only when the caller's Principal has `view` on this feature; the matching sub-page
   *  re-guards it server-side (defense-in-depth) and the tRPC router gates its data. */
  feature: FeatureKey;
}

/** All Admin Panel tabs, tenant-agnostic (no tenant/slug baked in — layout.tsx prefixes href).
 *  Wave 7.7a-T3: 'dashboard' (href '') is the admin index. Wave 1: each tab carries its FeatureKey
 *  so nav visibility flows from the per-role / custom-role view-access matrix (`visibleAdminTabs`),
 *  not a flat role check. The tab `id` intentionally equals its FeatureKey value. */
export const ADMIN_TABS: readonly AdminTab[] = [
  { id: 'dashboard', label: 'Dashboard', href: '', feature: FeatureKey.dashboard },
  { id: 'services', label: 'Services', href: 'services', feature: FeatureKey.services },
  { id: 'windows', label: 'Windows', href: 'windows', feature: FeatureKey.windows },
  { id: 'users', label: 'Users', href: 'users', feature: FeatureKey.users },
  { id: 'roles', label: 'Roles', href: 'roles', feature: FeatureKey.roles },
  { id: 'media', label: 'Media', href: 'media', feature: FeatureKey.media },
  { id: 'settings', label: 'Printer', href: 'settings', feature: FeatureKey.settings },
  { id: 'theme', label: 'Theme', href: 'theme', feature: FeatureKey.theme },
  { id: 'usage', label: 'Usage', href: 'usage', feature: FeatureKey.usage },
] as const;

/** Tab ids hidden on the Free tier. Wave 7.7b: 'theme' is REMOVED from this set — Free tenants now
 *  see the Theme tab too (8 presets), same as Premium. Only the CUSTOM 9-color picker inside that
 *  tab stays Premium-gated (theme-client.tsx checks `Tenant.tier` itself, not this list). This
 *  supersedes the Wave 7.6-T7 decision ("Theme tab is Premium-only" — see
 *  docs/DECISIONS_LOG.md 2026-07-08) per the Wave 7.7b brief (docs/DECISIONS_LOG.md 2026-07-09). */
const FREE_GATED_TAB_IDS: ReadonlySet<string> = new Set([]);

/** True when the caller's roles satisfy the Admin Panel gate (Admin or SuperAdmin). */
export function isAdminRole(roles: readonly Role[]): boolean {
  return roles.includes(Role.TenantSuperadmin) || roles.includes(Role.TenantAdmin) || roles.includes(Role.TenantManager);
}

/**
 * Tabs a given Principal may see, in ADMIN_TABS order (Wave 1 — Rule 34 Part B).
 * A tab is shown only when BOTH hold:
 *   1. The Principal has `view` on the tab's FeatureKey (the per-role / custom-role matrix —
 *      fixed tiers short-circuit allow; tenant_admin is denied OWNER_ONLY features; employees
 *      resolve through role_permissions, deny-by-default).
 *   2. It is not tier-gated away (Free tenants drop FREE_GATED_TAB_IDS — currently empty).
 * The nav is a convenience filter; the real boundary is the tRPC matrixProcedure + the per-page
 * server guard, both reading the SAME resolver — so nav can never show what tRPC would forbid.
 */
export function visibleAdminTabs(principal: Principal, tier: TenantTier): AdminTab[] {
  return ADMIN_TABS.filter((tab) => {
    if (tier !== TenantTier.Premium && FREE_GATED_TAB_IDS.has(tab.id)) return false;
    return hasPermission(principal, tab.feature, 'view');
  });
}

/** True when `tabId` is gated away for `tier` (used by sub-pages as a defense-in-depth check,
 *  same pattern as the role guard — a Free-tier admin hitting /theme by URL directly gets bounced,
 *  not just hidden from nav). */
export function isTabGatedForTier(tabId: string, tier: TenantTier): boolean {
  return tier !== TenantTier.Premium && FREE_GATED_TAB_IDS.has(tabId);
}
