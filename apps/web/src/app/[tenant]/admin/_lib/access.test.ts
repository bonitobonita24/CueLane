// Wave 7.6-T5 — Admin panel access-rule tests. Proves (a) the role guard admits Admin/SuperAdmin
// and rejects Employee/no-role, and (b) every tier sees every tab (Wave 7.7b: the Theme tab is no
// longer Free-gated — Free tenants get presets, only the in-tab custom picker stays Premium-only,
// see access.ts). This repo's vitest config is node-environment with no RSC/DOM render harness
// (see vitest.config.ts comment), so `layout.tsx`'s redirect/render wiring is exercised indirectly
// via these pure functions — the same testing shape server/domain/admin.ts already uses.
import { describe, expect, it } from 'vitest';
import { Role, TenantTier } from '@cuelane/shared';
import { ADMIN_TABS, isAdminRole, isTabGatedForTier, visibleAdminTabs } from './access';

describe('isAdminRole', () => {
  it('admits Admin', () => {
    expect(isAdminRole([Role.Admin])).toBe(true);
  });

  it('admits SuperAdmin', () => {
    expect(isAdminRole([Role.SuperAdmin])).toBe(true);
  });

  it('rejects Employee', () => {
    expect(isAdminRole([Role.Employee])).toBe(false);
  });

  it('rejects an empty role list', () => {
    expect(isAdminRole([])).toBe(false);
  });
});

describe('visibleAdminTabs', () => {
  it('Free tier sees the Theme tab (Wave 7.7b — presets are free; only custom is Premium-gated)', () => {
    const tabs = visibleAdminTabs(TenantTier.Free);
    expect(tabs.map((t) => t.id)).toContain('theme');
    expect(tabs.length).toBe(ADMIN_TABS.length);
  });

  it('Premium tier sees every tab, including Theme', () => {
    const tabs = visibleAdminTabs(TenantTier.Premium);
    expect(tabs.map((t) => t.id)).toContain('theme');
    expect(tabs.length).toBe(ADMIN_TABS.length);
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
