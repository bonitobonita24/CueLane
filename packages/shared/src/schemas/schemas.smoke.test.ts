import { describe, it, expect } from 'vitest';
import {
  createServiceSchema,
  createUserSchema,
  createTenantSchema,
} from './index.js';
import { Role, TenantTier } from '../types/index.js';

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

  it('rejects a non-4-6-digit PIN and a SuperAdmin tenant role', () => {
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
        role: Role.SuperAdmin, // not tenant-assignable
        pin: '1234',
      }).success,
    ).toBe(false);
  });

  it('defaults a new tenant tier to Free', () => {
    const parsed = createTenantSchema.parse({
      companyName: 'Demo Branch Co.',
      tagline: 'Fast and friendly.',
    });
    expect(parsed.tier).toBe(TenantTier.Free);
  });
});
