// Cross-tenant protected-page guard (defense-in-depth).
//
// EDGE-SAFE: this module imports ONLY the `Role` type — no Prisma, no bcrypt, no
// Node-only APIs — so it can run inside the Edge middleware bundle. It is a PURE
// decision function (no I/O) so it is unit-testable without booting Auth.js.
//
// Background: `middleware.ts` gates PROTECTED_TENANT_PATHS (`/station`, `/admin`)
// behind "a session exists", but historically never compared the URL `{tenant}`
// slug against the session user's own tenant. Data isolation already held (tRPC
// `requireTenant` + L6 Prisma guard + RLS scope every read/write to the session
// tenantId, ignoring the URL slug), so this was a page-render/UX + defense-in-depth
// gap only — a tenant admin visiting another tenant's `/admin/*` would render that
// tenant's chrome populated with their OWN data. This guard closes the gap by
// carrying the tenant slug in the JWT (no DB call needed edge-side) and comparing.
import type { Role } from '@cuelane/shared';

const SUPER_ADMIN: Role = 'super_admin' as Role;

/** Minimal session shape the guard needs (mapped from `session.user` in middleware).
 *  Fields are `| undefined` (not just optional) so a `session.user` with missing keys
 *  can be passed directly under tsconfig `exactOptionalPropertyTypes`. */
export interface TenantGuardSession {
  userId?: string | null | undefined;
  tenantSlug?: string | null | undefined;
  roles?: Role[] | undefined;
}

export type TenantGuardDecision =
  | { action: 'allow' }
  | { action: 'redirect-login' }
  | { action: 'redirect-tenant'; slug: string };

/**
 * Decide whether an authenticated session may view a PROTECTED tenant sub-path
 * whose URL tenant slug is `urlTenantSlug`.
 *
 *  - No / empty userId          → redirect-login   (unauthenticated)
 *  - SuperAdmin                 → allow            (may access any tenant)
 *  - URL slug === session slug  → allow            (own tenant)
 *  - URL slug !== session slug  → redirect-tenant  (send them to their OWN slug)
 *  - non-super-admin w/o a slug → redirect-login   (safe fallback — cannot serve
 *                                                   a tenant page without a slug)
 *
 * The DATA layer (tRPC requireTenant / L6 / RLS) is unchanged and remains the
 * authoritative isolation boundary — this is defense-in-depth for page render.
 */
export function evaluateProtectedTenantAccess(params: {
  urlTenantSlug: string;
  session: TenantGuardSession | null | undefined;
}): TenantGuardDecision {
  const { urlTenantSlug, session } = params;

  const userId = session?.userId;
  if (userId == null || userId === '') {
    return { action: 'redirect-login' };
  }

  const roles = session?.roles ?? [];
  if (roles.includes(SUPER_ADMIN)) {
    return { action: 'allow' };
  }

  const sessionSlug = session?.tenantSlug;
  if (sessionSlug == null || sessionSlug === '') {
    return { action: 'redirect-login' };
  }

  if (sessionSlug !== urlTenantSlug) {
    return { action: 'redirect-tenant', slug: sessionSlug };
  }

  return { action: 'allow' };
}
