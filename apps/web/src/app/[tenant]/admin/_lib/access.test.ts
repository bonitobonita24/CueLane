// Wave 7.6-T5 — Admin panel access-rule tests. Proves (a) the role guard admits Admin/SuperAdmin
// and rejects Employee/no-role, and (b) every tier sees every tab (Wave 7.7b: the Theme tab is no
// longer Free-gated — Free tenants get presets, only the in-tab custom picker stays Premium-only,
// see access.ts). This repo's vitest config is node-environment with no RSC/DOM render harness
// (see vitest.config.ts comment), so `layout.tsx`'s redirect/render wiring is exercised indirectly
// via these pure functions — the same testing shape server/domain/admin.ts already uses.
import { describe, expect, it } from 'vitest';
import { Role, TenantTier } from '@cuelane/shared';
import { FeatureKey } from '@cuelane/db';
import type { Principal, PermissionFlags } from '@/lib/rbac';
import { ADMIN_TABS, isAdminRole, isTabGatedForTier, visibleAdminTabs } from './access';

// Fixed-tier principals (no matrix — hasPermission short-circuits by role).
function principalFor(role: Principal['role']): Principal {
  return { userId: 'u1', tenantId: 't1', role, customRoleId: null, permissions: new Map() };
}
// An employee principal carrying a custom-role matrix.
function employeePrincipal(grants: Partial<Record<FeatureKey, Partial<PermissionFlags>>>): Principal {
  const permissions = new Map<FeatureKey, PermissionFlags>();
  for (const [key, flags] of Object.entries(grants)) {
    permissions.set(key as FeatureKey, { view: false, write: false, update: false, delete: false, ...flags });
  }
  return { userId: 'u2', tenantId: 't1', role: 'employee', customRoleId: 'cr1', permissions };
}

describe('isAdminRole', () => {
  it('admits Admin', () => {
    expect(isAdminRole([Role.TenantSuperadmin])).toBe(true);
  });

  it('admits SuperAdmin', () => {
    expect(isAdminRole([Role.TenantManager])).toBe(true);
  });

  it('rejects Employee', () => {
    expect(isAdminRole([Role.Employee])).toBe(false);
  });

  it('rejects an empty role list', () => {
    expect(isAdminRole([])).toBe(false);
  });
});

describe('visibleAdminTabs (Wave 1 — matrix-driven)', () => {
  it('tenant_superadmin sees every tab on Free tier (fixed tier — full access, presets are free)', () => {
    const tabs = visibleAdminTabs(principalFor('tenant_superadmin'), TenantTier.Free);
    expect(tabs.map((t) => t.id)).toContain('theme');
    expect(tabs.length).toBe(ADMIN_TABS.length);
  });

  it('tenant_superadmin sees every tab on Premium tier, including Users', () => {
    const tabs = visibleAdminTabs(principalFor('tenant_superadmin'), TenantTier.Premium);
    expect(tabs.map((t) => t.id)).toContain('users');
    expect(tabs.length).toBe(ADMIN_TABS.length);
  });

  it('tenant_admin sees every tab EXCEPT Users and Roles (OWNER_ONLY — matches userManagementProcedure)', () => {
    const tabs = visibleAdminTabs(principalFor('tenant_admin'), TenantTier.Premium);
    expect(tabs.map((t) => t.id)).not.toContain('users');
    expect(tabs.map((t) => t.id)).not.toContain('roles');
    expect(tabs.length).toBe(ADMIN_TABS.length - 2);
  });

  it('an employee custom role granting only services:view sees exactly the Services tab', () => {
    const tabs = visibleAdminTabs(employeePrincipal({ [FeatureKey.services]: { view: true } }), TenantTier.Premium);
    expect(tabs.map((t) => t.id)).toEqual(['services']);
  });

  it('an employee with no grants sees no tabs (deny-by-default)', () => {
    const tabs = visibleAdminTabs(employeePrincipal({}), TenantTier.Premium);
    expect(tabs).toHaveLength(0);
  });
});

describe('isTabGatedForTier', () => {
  it('never gates theme for Free (Wave 7.7b)', () => {
    expect(isTabGatedForTier('theme', TenantTier.Free)).toBe(false);
  });

  it('never gates theme for Premium', () => {
    expect(isTabGatedForTier('theme', TenantTier.Premium)).toBe(false);
  });

  it('never gates an ungated tab like services for Free', () => {
    expect(isTabGatedForTier('services', TenantTier.Free)).toBe(false);
  });
});
