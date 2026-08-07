// TDD — cross-tenant protected-page guard (defense-in-depth hardening).
// Pure decision-function tests (no DB, no Auth.js boot). Mirrors the four cases
// the middleware must enforce on PROTECTED_TENANT_PATHS (/station, /admin):
//   mismatched slug (non-super-admin) → redirect to own tenant
//   matching slug                     → allow
//   super-admin cross-tenant          → allow (exempt)
//   unauthenticated                   → redirect to login
import { describe, expect, it } from 'vitest';
import { Role } from '@cuelane/shared';
import { evaluateProtectedTenantAccess } from './tenant-guard';

describe('evaluateProtectedTenantAccess (cross-tenant page guard)', () => {
  it('redirects a non-super-admin whose session tenant slug does NOT match the URL slug, to their OWN slug', () => {
    const decision = evaluateProtectedTenantAccess({
      urlTenantSlug: 'clinic',
      session: { userId: 'u1', tenantSlug: 'demo', roles: [Role.TenantSuperadmin] },
    });
    expect(decision).toEqual({ action: 'redirect-tenant', slug: 'demo' });
  });

  it('allows a non-super-admin whose session tenant slug matches the URL slug', () => {
    const decision = evaluateProtectedTenantAccess({
      urlTenantSlug: 'demo',
      session: { userId: 'u1', tenantSlug: 'demo', roles: [Role.TenantSuperadmin] },
    });
    expect(decision).toEqual({ action: 'allow' });
  });

  it('allows an EMPLOYEE-role user on their own tenant', () => {
    const decision = evaluateProtectedTenantAccess({
      urlTenantSlug: 'clinic',
      session: { userId: 'u2', tenantSlug: 'clinic', roles: [Role.Employee] },
    });
    expect(decision).toEqual({ action: 'allow' });
  });

  it('allows a SUPER ADMIN to access ANY tenant (exempt from the slug match)', () => {
    const decision = evaluateProtectedTenantAccess({
      urlTenantSlug: 'clinic',
      session: { userId: 'super-admin', tenantSlug: null, roles: [Role.TenantManager] },
    });
    expect(decision).toEqual({ action: 'allow' });
  });

  it('redirects an unauthenticated request (no userId) to login', () => {
    expect(
      evaluateProtectedTenantAccess({ urlTenantSlug: 'demo', session: null }),
    ).toEqual({ action: 'redirect-login' });
    expect(
      evaluateProtectedTenantAccess({
        urlTenantSlug: 'demo',
        session: { userId: '', tenantSlug: 'demo', roles: [Role.TenantSuperadmin] },
      }),
    ).toEqual({ action: 'redirect-login' });
  });

  it('redirects an authenticated non-super-admin with NO resolvable tenant slug to login (safe fallback)', () => {
    const decision = evaluateProtectedTenantAccess({
      urlTenantSlug: 'demo',
      session: { userId: 'u3', tenantSlug: null, roles: [Role.TenantSuperadmin] },
    });
    expect(decision).toEqual({ action: 'redirect-login' });
  });
});
