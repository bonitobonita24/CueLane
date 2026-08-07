// Wave 7.6-T5 — Admin panel access rules. Pure, tenant-agnostic functions (no DB/session access
// here — callers resolve `roles`/`tier` from ctx.session/ctx.tenantId and pass them in) so they
// can be unit-tested in the existing node-environment vitest setup (this repo has no RSC/DOM test
// harness yet — every test in apps/web is a plain `.test.ts` against exported logic, same
// convention as server/domain/admin.ts). `layout.tsx` is a thin server-component wrapper around
// these two functions plus the redirect/render side effects that can't be unit-tested without a
// browser-render harness.
import { Role, TenantTier } from '@cuelane/shared';

export interface AdminTab {
  id: string;
  label: string;
  /** Path segment under /{tenant}/admin/, e.g. 'services' → /{tenant}/admin/services. Empty
   *  string ('') is the special case for the admin ROOT (Dashboard) — AdminTabsNav renders it as
   *  `/{tenant}/admin` with no trailing slash, not `/{tenant}/admin/`. */
  href: string;
}

/** All Admin Panel tabs, tenant-agnostic (no tenant/slug baked in — layout.tsx prefixes href).
 *  Wave 7.7a-T3: 'dashboard' (href '') is the admin index — always visible on every tier (the KPI
 *  cards + rate bars render for Free; only the advanced blocks inside dashboard-client.tsx are
 *  tier-gated, so this tab itself is never in FREE_GATED_TAB_IDS). */
export const ADMIN_TABS: readonly AdminTab[] = [
  { id: 'dashboard', label: 'Dashboard', href: '' },
  { id: 'services', label: 'Services', href: 'services' },
  { id: 'windows', label: 'Windows', href: 'windows' },
  { id: 'users', label: 'Users', href: 'users' },
  { id: 'media', label: 'Media', href: 'media' },
  { id: 'settings', label: 'Printer', href: 'settings' },
  { id: 'theme', label: 'Theme', href: 'theme' },
  { id: 'usage', label: 'Usage', href: 'usage' },
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

/** Tabs visible for a given tier — Free tier filters out FREE_GATED_TAB_IDS. */
export function visibleAdminTabs(tier: TenantTier): AdminTab[] {
  if (tier === TenantTier.Premium) return [...ADMIN_TABS];
  return ADMIN_TABS.filter((tab) => !FREE_GATED_TAB_IDS.has(tab.id));
}

/** True when `tabId` is gated away for `tier` (used by sub-pages as a defense-in-depth check,
 *  same pattern as the role guard — a Free-tier admin hitting /theme by URL directly gets bounced,
 *  not just hidden from nav). */
export function isTabGatedForTier(tabId: string, tier: TenantTier): boolean {
  return tier !== TenantTier.Premium && FREE_GATED_TAB_IDS.has(tabId);
}
