// TDD — RBAC per-role menu/module view-access resolver (Wave 0b).
// Pure decision-function tests (no DB). Hand-built Principal objects covering:
//   tenant_manager / tenant_superadmin -> full access, incl. owner-only features
//   tenant_admin                       -> full access EXCEPT owner-only (users/roles)
//   employee (matrix-driven)           -> deny-by-default on missing row + hard-deny owner-only
import { describe, expect, it } from 'vitest';
import { FeatureKey } from './features';
import { hasPermission } from './hasPermission';
import type { Principal } from './principal';
import { visibleFeatures } from './visibleFeatures';

function principal(overrides: Partial<Principal>): Principal {
  return {
    userId: 'u1',
    tenantId: 't1',
    role: 'employee',
    customRoleId: null,
    permissions: new Map(),
    ...overrides,
  };
}

describe('hasPermission', () => {
  it('tenant_superadmin has view/write/update/delete on every FeatureKey, incl. owner-only (users/roles)', () => {
    const p = principal({ role: 'tenant_superadmin' });
    for (const key of Object.values(FeatureKey)) {
      expect(hasPermission(p, key, 'view')).toBe(true);
      expect(hasPermission(p, key, 'write')).toBe(true);
      expect(hasPermission(p, key, 'update')).toBe(true);
      expect(hasPermission(p, key, 'delete')).toBe(true);
    }
  });

  it('tenant_manager has view/write/update/delete on every FeatureKey, incl. owner-only (users/roles)', () => {
    const p = principal({ role: 'tenant_manager', tenantId: null });
    for (const key of Object.values(FeatureKey)) {
      expect(hasPermission(p, key, 'view')).toBe(true);
      expect(hasPermission(p, key, 'delete')).toBe(true);
    }
  });

  it('tenant_admin has full access on writable features but FALSE on users/roles (owner-only)', () => {
    const p = principal({ role: 'tenant_admin' });
    expect(hasPermission(p, FeatureKey.dashboard, 'view')).toBe(true);
    expect(hasPermission(p, FeatureKey.services, 'write')).toBe(true);
    expect(hasPermission(p, FeatureKey.settings, 'update')).toBe(true);
    expect(hasPermission(p, FeatureKey.users, 'view')).toBe(false);
    expect(hasPermission(p, FeatureKey.users, 'write')).toBe(false);
    expect(hasPermission(p, FeatureKey.roles, 'view')).toBe(false);
    expect(hasPermission(p, FeatureKey.roles, 'delete')).toBe(false);
  });

  it('an employee/custom-role principal with a partial matrix sees only the granted flag, misses deny by default', () => {
    const p = principal({
      role: 'employee',
      customRoleId: 'cr1',
      permissions: new Map([[FeatureKey.services, { view: true, write: false, update: false, delete: false }]]),
    });
    expect(hasPermission(p, FeatureKey.services, 'view')).toBe(true);
    expect(hasPermission(p, FeatureKey.services, 'write')).toBe(false);
    // dashboard has no matrix row at all -> deny-by-default
    expect(hasPermission(p, FeatureKey.dashboard, 'view')).toBe(false);
  });

  it('an employee/custom-role principal is HARD-DENIED on users/roles even if a matrix row grants it (defense in depth)', () => {
    const p = principal({
      role: 'employee',
      customRoleId: 'cr1',
      permissions: new Map([[FeatureKey.users, { view: true, write: true, update: true, delete: true }]]),
    });
    expect(hasPermission(p, FeatureKey.users, 'view')).toBe(false);
    expect(hasPermission(p, FeatureKey.roles, 'view')).toBe(false);
  });

  it('an employee principal with an empty permissions Map is false on every feature/action', () => {
    const p = principal({ role: 'employee', permissions: new Map() });
    for (const key of Object.values(FeatureKey)) {
      expect(hasPermission(p, key, 'view')).toBe(false);
      expect(hasPermission(p, key, 'write')).toBe(false);
      expect(hasPermission(p, key, 'update')).toBe(false);
      expect(hasPermission(p, key, 'delete')).toBe(false);
    }
  });
});

describe('visibleFeatures', () => {
  it('returns exactly the granted view=true set for a matrix-driven employee principal', () => {
    const p = principal({
      role: 'employee',
      customRoleId: 'cr1',
      permissions: new Map([
        [FeatureKey.services, { view: true, write: false, update: false, delete: false }],
        [FeatureKey.windows, { view: false, write: false, update: false, delete: false }],
        [FeatureKey.media, { view: true, write: true, update: false, delete: false }],
      ]),
    });
    expect(visibleFeatures(p)).toEqual([FeatureKey.services, FeatureKey.media]);
  });

  it('returns every FeatureKey for tenant_superadmin, incl. owner-only', () => {
    const p = principal({ role: 'tenant_superadmin' });
    expect(visibleFeatures(p)).toEqual(Object.values(FeatureKey));
  });

  it('returns every FeatureKey except users/roles for tenant_admin', () => {
    const p = principal({ role: 'tenant_admin' });
    expect(visibleFeatures(p)).toEqual(
      Object.values(FeatureKey).filter((k) => k !== FeatureKey.users && k !== FeatureKey.roles),
    );
  });

  it('returns an empty array for an employee principal with no permissions', () => {
    const p = principal({ role: 'employee', permissions: new Map() });
    expect(visibleFeatures(p)).toEqual([]);
  });
});
