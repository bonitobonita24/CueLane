import { describe, it, expect } from 'vitest';
import {
  createServiceSchema,
  createUserSchema,
  createTenantSchema,
  updateTenantSettingsSchema,
} from './index.js';
import {
  Role,
  TenantTier,
  TIER_LIMITS,
  THEME_PRESETS,
  SERVICE_ICON_OPTIONS,
  SERVICE_COLOR_OPTIONS,
} from '../types/index.js';

// Phase 5 validation smoke test — proves the test harness runs and the core
// shared zod contracts behave. Not a full suite (see docs/STATE.md Phase-8 gap).
describe('@cuelane/shared schemas (smoke)', () => {
  it('accepts a valid service and rejects a bad colour', () => {
    expect(
      createServiceSchema.safeParse({
        name: 'Cash Deposit',
        icon: '💰',
        color: '#3B82F6',
        avgTime: 5,
      }).success,
    ).toBe(true);

    expect(
      createServiceSchema.safeParse({
        name: 'Bad',
        icon: '💰',
        color: 'blue', // not a hex colour
        avgTime: 5,
      }).success,
    ).toBe(false);
  });

  it('rejects a non-4-6-digit PIN and a TenantManager tenant role', () => {
    expect(
      createUserSchema.safeParse({
        name: 'Alice',
        role: Role.Employee,
        pin: '12', // too short
      }).success,
    ).toBe(false);

    expect(
      createUserSchema.safeParse({
        name: 'Mallory',
        role: Role.TenantManager, // platform role — not tenant-assignable
        pin: '1234',
      }).success,
    ).toBe(false);
  });

  it('accepts the tenant-assignable roles (employee, tenant_admin, tenant_superadmin)', () => {
    for (const role of [Role.Employee, Role.TenantAdmin, Role.TenantSuperadmin]) {
      expect(
        createUserSchema.safeParse({
          name: 'Bob',
          role,
          pin: '1234',
        }).success,
      ).toBe(true);
    }
  });

  it('defaults a new tenant tier to Free', () => {
    const parsed = createTenantSchema.parse({
      companyName: 'Demo Branch Co.',
      tagline: 'Fast and friendly.',
    });
    expect(parsed.tier).toBe(TenantTier.Free);
  });

  // Wave 7.6 (T1) — decisions 1-4 (docs/DECISIONS_LOG.md 2026-07-08).
  it('rejects a service icon/color outside the PM-authored option lists', () => {
    expect(
      createServiceSchema.safeParse({
        name: 'Off-list',
        icon: '🎃', // not in SERVICE_ICON_OPTIONS
        color: '#3B82F6',
        avgTime: 5,
      }).success,
    ).toBe(false);

    expect(
      createServiceSchema.safeParse({
        name: 'Off-list',
        icon: SERVICE_ICON_OPTIONS[0],
        color: '#ABCDEF', // not in SERVICE_COLOR_OPTIONS
        avgTime: 5,
      }).success,
    ).toBe(false);

    // Every seed color must be a valid option (decision 4's superset requirement).
    for (const seedColor of ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B']) {
      expect(SERVICE_COLOR_OPTIONS as readonly string[]).toContain(seedColor);
    }
  });

  it('accepts a THEME_PRESETS id and printerConfig.enabled, rejects an unknown theme id', () => {
    expect(
      updateTenantSettingsSchema.safeParse({
        settings: { theme: 'indigo', printerConfig: { enabled: true, autoCut: true } },
      }).success,
    ).toBe(true);

    expect(
      updateTenantSettingsSchema.safeParse({
        settings: { theme: 'not-a-real-preset' },
      }).success,
    ).toBe(false);
  });

  it('TIER_LIMITS encodes the locked free caps and unlimited premium', () => {
    expect(TIER_LIMITS.free).toEqual({ users: 10, services: 6, windows: 4 });
    expect(TIER_LIMITS.premium).toBeNull();
    expect(THEME_PRESETS.length).toBe(8);
  });
});
