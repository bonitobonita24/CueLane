// Wave 7.9-T4 — end-to-end integration test for the full Wave 7.9 journey: a brand-new tenant
// signs up, its admin can immediately authenticate (bcrypt hash matches what the real
// 'admin-credentials' Auth.js provider checks), then that admin runs the full password-reset
// round trip (request -> email enqueued -> confirm -> new password authenticates, old one no
// longer does). No mocks — real Postgres via prismaRaw, real BullMQ queue via @cuelane/jobs.
// Creates exactly ONE ephemeral tenant (never demo/clinic) and deletes it in afterAll so the
// baseline (exactly demo + clinic) is restored regardless of pass/fail.
import { afterAll, describe, expect, it } from 'vitest';
import type { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { prismaRaw } from '@cuelane/db';
import { emailQueue } from '@cuelane/jobs';
import { appRouter } from '../root';
import { createCallerFactory } from '../trpc';

const createCaller = createCallerFactory(appRouter);

function fakeReq(): NextRequest {
  return { headers: new Headers() } as unknown as NextRequest;
}
function publicCaller() {
  return createCaller({ session: null, userId: null, roles: [], tenantId: null, req: fakeReq() });
}

describe('auth E2E journey (Wave 7.9-T4): signup -> login -> password reset', () => {
  let createdTenantId: string | null = null;

  afterAll(async () => {
    if (createdTenantId != null) {
      await prismaRaw.tenant.delete({ where: { id: createdTenantId } });
    }
  });

  it('signs up, authenticates the new admin, resets the password, and authenticates with the new one', async () => {
    const uniqueSuffix = Date.now();
    const companyName = `E2E Journey Co ${uniqueSuffix}`;
    const adminEmail = `e2e-admin-${uniqueSuffix}@example.test`;
    const originalPassword = 'OriginalE2EPass1!';
    const newPassword = 'RotatedE2EPass2!';

    // ── Step 1: signup ────────────────────────────────────────────────────────
    const caller = publicCaller();
    const signupResult = await caller.auth.signup({
      companyName,
      slug: companyName,
      adminName: 'E2E Admin',
      adminEmail,
      password: originalPassword,
    });

    expect(signupResult.slug).toMatch(/^[a-z0-9-]+$/);

    const tenant = await prismaRaw.tenant.findUniqueOrThrow({ where: { slug: signupResult.slug } });
    createdTenantId = tenant.id;
    expect(tenant.status).toBe('active');
    expect(tenant.tier).toBe('free');

    const admin = await prismaRaw.user.findFirstOrThrow({
      where: { tenantId: tenant.id, name: 'E2E Admin' },
    });
    expect(admin.role).toBe('admin');

    // ── Step 2: the new admin can authenticate — same check as the real
    //    'admin-credentials' Auth.js provider (server/auth/config.ts) ─────────
    await expect(bcrypt.compare(originalPassword, admin.pin)).resolves.toBe(true);

    // Tenant is immediately usable (kiosk/station need at least one service + window).
    expect(await prismaRaw.service.count({ where: { tenantId: tenant.id } })).toBeGreaterThanOrEqual(1);
    expect(await prismaRaw.window.count({ where: { tenantId: tenant.id } })).toBeGreaterThanOrEqual(1);

    // ── Step 3: request a password reset ──────────────────────────────────────
    const resetRequestResult = await caller.auth.requestPasswordReset({
      identifier: 'E2E Admin',
      tenantSlug: signupResult.slug,
    });
    expect(resetRequestResult).toEqual({ success: true });

    const resetToken = await prismaRaw.passwordResetToken.findFirstOrThrow({
      where: { userId: admin.id },
      orderBy: { createdAt: 'desc' },
    });
    expect(resetToken.usedAt).toBeNull();

    // The email job was enqueued to the REAL BullMQ email queue. A live worker container may be
    // running against this SAME Valkey instance and consume it near-instantly (dev docker-compose
    // stack) — poll across waiting/active/completed/failed states for a few hundred ms rather than
    // assuming any single state.
    async function findEnqueuedJob() {
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const jobsByState = await Promise.all([
          emailQueue.getJobs(['waiting']),
          emailQueue.getJobs(['active']),
          emailQueue.getJobs(['completed']),
          emailQueue.getJobs(['failed']),
        ]);
        const found = jobsByState
          .flat()
          .find((job) => job.data.to === adminEmail && job.data.templateId === 'password_reset');
        if (found != null) return found;
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
      return undefined;
    }

    const matchingJob = await findEnqueuedJob();
    expect(matchingJob).toBeDefined();

    // We do NOT have the raw token here (only its SHA-256 hash is persisted, by design — see
    // auth.ts's confirmPasswordReset). This test proves the DB/queue side-effects of the request;
    // the raw-token confirm path itself is covered by auth.test.ts's confirmPasswordReset suite
    // (which mints its own raw token to drive that mutation directly) and was independently
    // verified via a real browser + MailHog round trip for this same wave (see PM report).

    // ── Step 4: simulate confirm using a fresh token for the SAME user (proves the full
    //    reset-then-relogin contract without needing the raw mailed token in-process) ───────────
    const crypto = await import('node:crypto');
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    await prismaRaw.passwordResetToken.create({
      data: {
        tenantId: tenant.id,
        userId: admin.id,
        token: hashedToken,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const confirmResult = await caller.auth.confirmPasswordReset({ token: rawToken, newPassword });
    expect(confirmResult).toEqual({ success: true });

    // ── Step 5: new password authenticates, old one no longer does ───────────
    const updatedAdmin = await prismaRaw.user.findUniqueOrThrow({ where: { id: admin.id } });
    await expect(bcrypt.compare(newPassword, updatedAdmin.pin)).resolves.toBe(true);
    await expect(bcrypt.compare(originalPassword, updatedAdmin.pin)).resolves.toBe(false);
  });
});
