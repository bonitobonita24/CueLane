// Wave 7.4-T1 — TDD regression test for a real bug found while building the Employee Station:
// the admin-credentials provider's authorize() queried `role: { in: ['admin'] } }`, which
// silently excludes every `employee`-role user even though the same function maps `employee` ->
// Role.Employee a few lines below (dead code) and staffProcedure explicitly allows
// Role.Employee. Net effect: no employee (e.g. seeded 'Alice Santos'/'Bob Reyes', pins
// 1234/5678) could EVER sign in, so the station page — which requires an Employee/Admin
// session — was unreachable by an employee account. Runs against the real seeded `demo` tenant
// (no mocks), consistent with this repo's DB-testing convention.
import { describe, expect, it } from 'vitest';
import { prismaRaw } from '@cuelane/db';
import { authConfig } from './config';

// ⚠ @auth/core footgun (logged to ~/.claude/LESSONS_GLOBAL.md): `Credentials(config)` does NOT
// return your `authorize` function on the returned provider object — it returns a fixed stub
// `{ id: 'credentials', authorize: () => null, options: config, ... }` and stashes YOUR real
// config (including the real `authorize`) under `.options`. Auth.js's internal sign-in flow
// reads `provider.options.authorize`, never `provider.authorize` (confirmed by decompiling
// node_modules/@auth/core/providers/credentials.js — `authorize: () => null` is literally in the
// source). Calling `provider.authorize(...)` directly (as this test originally did) silently
// invokes the always-null stub — no throw, no rejection, so a naive test asserting "returns
// null" would falsely PASS even against a working authorize implementation. The real function
// under test is `provider.options.authorize`.
function adminCredentialsProvider(): {
  authorize: (creds: Record<string, unknown>) => Promise<unknown>;
} {
  type ProviderWithOptions = {
    options?: { id?: string; authorize?: (creds: Record<string, unknown>) => Promise<unknown> };
  };
  const provider = authConfig.providers
    .map((p) => p as unknown as ProviderWithOptions)
    .find((p) => p.options?.id === 'admin-credentials');
  const authorize = provider?.options?.authorize;
  if (authorize == null) throw new Error('admin-credentials provider (with options.authorize) not found in authConfig');
  return { authorize };
}

describe('authConfig admin-credentials provider (Wave 7.4-T1 regression)', () => {
  it('authorizes a seeded EMPLOYEE user (Alice Santos / pin 1234 against demo)', async () => {
    const tenant = await prismaRaw.tenant.findUniqueOrThrow({ where: { slug: 'demo' } });
    const alice = await prismaRaw.user.findFirstOrThrow({
      where: { tenantId: tenant.id, name: 'Alice Santos' },
    });
    expect(alice.role).toBe('employee'); // ground-truth precondition

    const result = await adminCredentialsProvider().authorize({
      identifier: 'Alice Santos',
      password: '1234',
      tenantSlug: 'demo',
    });

    expect(result).not.toBeNull();
    const user = result as { id: string; roles: string[] };
    expect(user.id).toBe(alice.id);
    expect(user.roles).toEqual(['employee']);
  });

  it('still authorizes the seeded ADMIN user (Branch Admin / pin 0000 against demo)', async () => {
    const result = await adminCredentialsProvider().authorize({
      identifier: 'Branch Admin',
      password: '0000',
      tenantSlug: 'demo',
    });

    expect(result).not.toBeNull();
    const user = result as { roles: string[] };
    expect(user.roles).toEqual(['tenant_superadmin']);
  });

  it('rejects a wrong pin for an employee', async () => {
    const result = await adminCredentialsProvider().authorize({
      identifier: 'Alice Santos',
      password: 'wrong-pin',
      tenantSlug: 'demo',
    });
    expect(result).toBeNull();
  });
});
