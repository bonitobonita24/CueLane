// Wave 7.9-T1 — authRouter tRPC tests (TDD). Every mutation here is `publicProcedure` (no
// session) — signup, password-reset request, password-reset confirm are all pre-auth surfaces.
// Ephemeral tenants only (never `demo`/`clinic`); every tenant this suite creates is deleted in
// afterAll so the baseline (exactly demo + clinic) is restored.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { prismaRaw } from '@cuelane/db';
import { appRouter } from '../root';
import { createCallerFactory } from '../trpc';

const createCaller = createCallerFactory(appRouter);

function fakeReq(): NextRequest {
  return { headers: new Headers() } as unknown as NextRequest;
}
function publicCaller() {
  return createCaller({ session: null, userId: null, roles: [], tenantId: null, req: fakeReq() });
}

describe('authRouter (Wave 7.9-T1)', () => {
  const createdTenantSlugs: string[] = [];
  let preexistingSlug: string;
  let preexistingTenantId: string;
  let preexistingUserId: string;

  beforeAll(async () => {
    // A pre-existing tenant to prove slug-uniqueness rejection + to drive the reset flow.
    preexistingSlug = `test-auth-existing-${Date.now()}`;
    const tenant = await prismaRaw.tenant.create({
      data: {
        slug: preexistingSlug,
        companyName: 'Existing Test Co.',
        tagline: 'x',
        tier: 'free',
        settings: { adminEmail: 'existing-admin@example.test' },
      },
    });
    preexistingTenantId = tenant.id;
    const user = await prismaRaw.user.create({
      data: { tenantId: tenant.id, name: 'Existing Admin', role: 'tenant_superadmin', pin: await bcrypt.hash('OldPassw0rd!', 10) },
    });
    preexistingUserId = user.id;
  });

  afterAll(async () => {
    for (const slug of createdTenantSlugs) {
      const t = await prismaRaw.tenant.findUnique({ where: { slug } });
      if (t != null) await prismaRaw.tenant.delete({ where: { id: t.id } });
    }
    await prismaRaw.tenant.delete({ where: { id: preexistingTenantId } });
  });

  describe('checkSlugAvailability', () => {
    it('flags a reserved slug as unavailable', async () => {
      const caller = publicCaller();
      const result = await caller.auth.checkSlugAvailability({ slug: 'login' });
      expect(result).toEqual({ candidate: 'login', available: false, reason: 'reserved' });
    });

    it('flags an already-taken slug as unavailable', async () => {
      const caller = publicCaller();
      const result = await caller.auth.checkSlugAvailability({ slug: preexistingSlug });
      expect(result).toEqual({ candidate: preexistingSlug, available: false, reason: 'taken' });
    });

    it('flags a fresh, well-formed slug as available', async () => {
      const caller = publicCaller();
      const candidate = `brand-new-co-${Date.now()}`;
      const result = await caller.auth.checkSlugAvailability({ slug: candidate });
      expect(result).toEqual({ candidate, available: true, reason: null });
    });
  });

  describe('signup', () => {
    it('rejects a reserved slug', async () => {
      const caller = publicCaller();
      await expect(
        caller.auth.signup({
          companyName: 'Some Co',
          slug: 'login',
          adminName: 'Some Admin',
          adminEmail: `reserved-${Date.now()}@example.test`,
          password: 'ValidPass123!',
        }),
      ).rejects.toThrow();
    });

    it('rejects a slug that is already taken', async () => {
      const caller = publicCaller();
      await expect(
        caller.auth.signup({
          companyName: 'Dupe Co',
          slug: preexistingSlug,
          adminName: 'Dupe Admin',
          adminEmail: `dupe-${Date.now()}@example.test`,
          password: 'ValidPass123!',
        }),
      ).rejects.toThrow();
    });

    it('rejects a too-short slug', async () => {
      const caller = publicCaller();
      await expect(
        caller.auth.signup({
          companyName: 'A',
          slug: 'ab',
          adminName: 'A Admin',
          adminEmail: `short-${Date.now()}@example.test`,
          password: 'ValidPass123!',
        }),
      ).rejects.toThrow();
    });

    it('creates a working tenant + loginable admin transactionally, slugified server-side', async () => {
      const slug = `Test Signup Co ${Date.now()}`; // deliberately unslugified — router must derive it
      const caller = publicCaller();

      const result = await caller.auth.signup({
        companyName: 'Test Signup Co.',
        slug,
        adminName: 'Signup Admin',
        adminEmail: `signup-${Date.now()}@example.test`,
        password: 'ValidPass123!',
      });

      expect(result.slug).toMatch(/^[a-z0-9-]+$/);
      createdTenantSlugs.push(result.slug);

      const tenant = await prismaRaw.tenant.findUnique({ where: { slug: result.slug } });
      expect(tenant).not.toBeNull();
      if (tenant == null) throw new Error('unreachable — asserted above');
      expect(tenant.status).toBe('active');
      expect(tenant.tier).toBe('free');

      const admin = await prismaRaw.user.findFirst({ where: { tenantId: tenant.id, name: 'Signup Admin' } });
      expect(admin).not.toBeNull();
      expect(admin?.role).toBe('tenant_superadmin');

      // Loginable: bcrypt.compare(password, user.pin) must succeed — same check the
      // 'admin-credentials' provider performs (server/auth/config.ts).
      const valid = await bcrypt.compare('ValidPass123!', admin?.pin ?? '');
      expect(valid).toBe(true);

      // A brand-new tenant must be immediately usable: at least one service + one window.
      const serviceCount = await prismaRaw.service.count({ where: { tenantId: tenant.id } });
      const windowCount = await prismaRaw.window.count({ where: { tenantId: tenant.id } });
      expect(serviceCount).toBeGreaterThanOrEqual(1);
      expect(windowCount).toBeGreaterThanOrEqual(1);
    });

    it('does not leave an orphan tenant if a duplicate slug race is retried after normalization collides', async () => {
      // Two different raw inputs that slugify to the SAME candidate — the second must be
      // rejected as taken, and must not have created a second Tenant row.
      const base = `Collision Co ${Date.now()}`;
      const caller = publicCaller();

      const first = await caller.auth.signup({
        companyName: base,
        slug: base,
        adminName: 'First Admin',
        adminEmail: `collide-a-${Date.now()}@example.test`,
        password: 'ValidPass123!',
      });
      createdTenantSlugs.push(first.slug);

      await expect(
        caller.auth.signup({
          companyName: base,
          slug: base, // slugifies identically -> same candidate -> must collide
          adminName: 'Second Admin',
          adminEmail: `collide-b-${Date.now()}@example.test`,
          password: 'ValidPass123!',
        }),
      ).rejects.toThrow();

      const count = await prismaRaw.tenant.count({ where: { slug: first.slug } });
      expect(count).toBe(1);
    });
  });

  describe('requestPasswordReset', () => {
    it('returns the same success response for an unknown tenant slug (anti-enumeration)', async () => {
      const caller = publicCaller();
      const result = await caller.auth.requestPasswordReset({
        identifier: 'Nobody',
        tenantSlug: `nonexistent-tenant-${Date.now()}`,
      });
      expect(result).toEqual({ success: true });
    });

    it('returns the same success response for an unknown identifier within a real tenant', async () => {
      const caller = publicCaller();
      const result = await caller.auth.requestPasswordReset({
        identifier: 'Definitely Not A Real User',
        tenantSlug: preexistingSlug,
      });
      expect(result).toEqual({ success: true });
    });

    it('returns success and creates a hashed, single-use reset token for a real admin', async () => {
      const caller = publicCaller();
      const before = await prismaRaw.passwordResetToken.count({ where: { userId: preexistingUserId } });

      const result = await caller.auth.requestPasswordReset({
        identifier: 'Existing Admin',
        tenantSlug: preexistingSlug,
      });
      expect(result).toEqual({ success: true });

      const after = await prismaRaw.passwordResetToken.count({ where: { userId: preexistingUserId } });
      expect(after).toBe(before + 1);

      const latest = await prismaRaw.passwordResetToken.findFirst({
        where: { userId: preexistingUserId },
        orderBy: { createdAt: 'desc' },
      });
      expect(latest).not.toBeNull();
      // Token at rest must be the SHA-256 hash (64 hex chars), never the raw token.
      expect(latest?.token).toMatch(/^[0-9a-f]{64}$/);
      expect(latest?.usedAt).toBeNull();
      expect(latest?.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('confirmPasswordReset', () => {
    it('rejects an unknown/garbage token', async () => {
      const caller = publicCaller();
      await expect(
        caller.auth.confirmPasswordReset({ token: 'not-a-real-token-at-all', newPassword: 'NewPassw0rd1!' }),
      ).rejects.toThrow();
    });

    it('rejects an expired token', async () => {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
      await prismaRaw.passwordResetToken.create({
        data: {
          tenantId: preexistingTenantId,
          userId: preexistingUserId,
          token: hashedToken,
          expiresAt: new Date(Date.now() - 1000), // already expired
        },
      });

      const caller = publicCaller();
      await expect(
        caller.auth.confirmPasswordReset({ token: rawToken, newPassword: 'NewPassw0rd1!' }),
      ).rejects.toThrow();
    });

    it('rejects an already-used token', async () => {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
      await prismaRaw.passwordResetToken.create({
        data: {
          tenantId: preexistingTenantId,
          userId: preexistingUserId,
          token: hashedToken,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          usedAt: new Date(), // already used
        },
      });

      const caller = publicCaller();
      await expect(
        caller.auth.confirmPasswordReset({ token: rawToken, newPassword: 'NewPassw0rd1!' }),
      ).rejects.toThrow();
    });

    it('accepts a valid token, updates the password, and marks the token used (single-use)', async () => {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
      const created = await prismaRaw.passwordResetToken.create({
        data: {
          tenantId: preexistingTenantId,
          userId: preexistingUserId,
          token: hashedToken,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      const caller = publicCaller();
      const result = await caller.auth.confirmPasswordReset({ token: rawToken, newPassword: 'BrandNewPass1!' });
      expect(result).toEqual({ success: true });

      const user = await prismaRaw.user.findUnique({ where: { id: preexistingUserId } });
      const valid = await bcrypt.compare('BrandNewPass1!', user?.pin ?? '');
      expect(valid).toBe(true);

      const usedToken = await prismaRaw.passwordResetToken.findUnique({ where: { id: created.id } });
      expect(usedToken?.usedAt).not.toBeNull();

      // Single-use: replaying the SAME raw token again must be rejected.
      await expect(
        caller.auth.confirmPasswordReset({ token: rawToken, newPassword: 'AnotherPass2!' }),
      ).rejects.toThrow();
    });
  });
});
