// Wave 7.9-T1 — authRouter. Every procedure here is PUBLIC (no session) — signup, password-reset
// request, password-reset confirm are all pre-auth surfaces reachable from the marketing landing
// page / login page. See file-level notes on each mutation for the security reasoning.
import crypto from 'node:crypto';
import { TRPCError } from '@trpc/server';
import bcrypt from 'bcryptjs';
import {
  signupSchema,
  requestPasswordResetSchema,
  consumePasswordResetSchema,
  slugify,
  isReservedSlug,
  isValidSlugShape,
} from '@cuelane/shared';
import { prismaRaw } from '@cuelane/db';
import { addEmailJob } from '@cuelane/jobs';
import { createTRPCRouter, publicProcedure } from '../trpc';
import { rateLimiters } from '@/server/lib/rate-limit';
import { verifyTurnstile } from '@/server/lib/turnstile';

const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour, per docs/PRODUCT.md

/** Tenant.settings is a permissive Json column (no `email` column on Tenant/User without a
 *  migration — see schemas/index.ts's signupSchema header note). Read it defensively: any shape
 *  other than `{ adminEmail: string }` is treated as "no contact email on file". */
function extractAdminEmail(settings: unknown): string | null {
  if (settings != null && typeof settings === 'object' && !Array.isArray(settings)) {
    const value = (settings as Record<string, unknown>)['adminEmail'];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return null;
}

function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

function resetUrlFor(tenantSlug: string, rawToken: string): string {
  const base = process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000';
  return `${base}/${tenantSlug}/reset-password?token=${rawToken}`;
}

export const authRouter = createTRPCRouter({
  // Public signup: create a Tenant + its admin User in ONE transaction so a partial failure never
  // leaves an orphan tenant (mission brief requirement). Free tier by default (Xendit upgrade is
  // a separate, later flow — see tenantAdmin/subscription routers). A brand-new tenant gets one
  // default Service + one default Window so the kiosk/station are immediately usable without a
  // forced "now go configure everything" detour.
  signup: publicProcedure.input(signupSchema).mutation(async ({ input }) => {
    const turnstileOk = await verifyTurnstile(input.turnstileToken);
    if (!turnstileOk) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Verification failed. Please try again.' });
    }

    // Server re-derives + re-validates the slug — the client-side live preview (slugify() in the
    // signup form) is a UX convenience only, NEVER the authority.
    const candidate = slugify(input.slug);

    if (!isValidSlugShape(candidate)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Workspace URL must be 3-50 characters: lowercase letters, numbers, and hyphens only.',
      });
    }
    if (isReservedSlug(candidate)) {
      throw new TRPCError({ code: 'CONFLICT', message: 'This workspace URL is reserved. Please choose another.' });
    }

    const existing = await prismaRaw.tenant.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (existing != null) {
      throw new TRPCError({ code: 'CONFLICT', message: 'This workspace URL is already taken.' });
    }

    const hashedPassword = await bcrypt.hash(input.password, 10);

    const tenant = await prismaRaw.$transaction(async (tx) => {
      const createdTenant = await tx.tenant.create({
        data: {
          slug: candidate,
          companyName: input.companyName,
          tagline: '',
          tier: 'free',
          status: 'active',
          settings: { adminEmail: input.adminEmail },
        },
      });

      await tx.service.create({
        data: {
          tenantId: createdTenant.id,
          number: 1,
          name: 'General Inquiry',
          icon: '📋',
          color: '#3B82F6',
          avgTime: 5,
        },
      });

      await tx.window.create({ data: { tenantId: createdTenant.id, name: 'Window 1' } });

      await tx.user.create({
        data: {
          tenantId: createdTenant.id,
          name: input.adminName,
          role: 'admin',
          pin: hashedPassword,
        },
      });

      return createdTenant;
    });

    return { slug: tenant.slug };
  }),

  // Anti-enumeration: ALWAYS returns the identical `{ success: true }` response, whether or not
  // the tenant/identifier/contact-email combination exists — never let a caller distinguish
  // "unknown tenant" from "unknown user" from "no contact email on file" from "email sent".
  requestPasswordReset: publicProcedure.input(requestPasswordResetSchema).mutation(async ({ input }) => {
    rateLimiters.passwordReset.check(`${input.tenantSlug}:${input.identifier.toLowerCase()}`);

    const SUCCESS = { success: true } as const;

    const tenant = await prismaRaw.tenant.findUnique({
      where: { slug: input.tenantSlug },
      select: { id: true, settings: true },
    });
    if (tenant == null) return SUCCESS;

    const user = await prismaRaw.user.findFirst({
      where: { tenantId: tenant.id, name: input.identifier, role: 'admin' },
      select: { id: true },
    });
    if (user == null) return SUCCESS;

    const adminEmail = extractAdminEmail(tenant.settings);
    if (adminEmail == null) return SUCCESS; // no contact email on file (e.g. seeded demo tenants)

    const rawToken = crypto.randomBytes(32).toString('hex');
    await prismaRaw.passwordResetToken.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        token: hashToken(rawToken),
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS),
      },
    });

    await addEmailJob({
      tenantId: tenant.id,
      userId: user.id,
      to: adminEmail,
      subject: '',
      templateId: 'password_reset',
      templateData: { url: resetUrlFor(input.tenantSlug, rawToken) },
    });

    return SUCCESS;
  }),

  confirmPasswordReset: publicProcedure.input(consumePasswordResetSchema).mutation(async ({ input }) => {
    const resetToken = await prismaRaw.passwordResetToken.findUnique({
      where: { token: hashToken(input.token) },
    });

    if (resetToken == null || resetToken.usedAt != null || resetToken.expiresAt.getTime() < Date.now()) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'This link has expired. Please request a new one.',
      });
    }

    const hashedPassword = await bcrypt.hash(input.newPassword, 10);

    await prismaRaw.$transaction([
      prismaRaw.user.update({ where: { id: resetToken.userId }, data: { pin: hashedPassword } }),
      prismaRaw.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: new Date() } }),
    ]);

    return { success: true };
  }),
});
