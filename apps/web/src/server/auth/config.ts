import type { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
// Auth runs BEFORE any tenant context exists (login is what establishes it), so
// the L6 tenant-guard (`prisma`) would throw "No tenant context active" here.
// Use the sanctioned unguarded client for this pre-auth/system-bootstrap lookup —
// the query below is still manually scoped by `tenantId`, preserving isolation.
import { prismaRaw } from '@cuelane/db';
import { Role } from '@cuelane/shared';
import { authConfigEdge } from './config.edge';

const adminCredentialsSchema = z.object({
  // NOTE(S5): User schema uses `name` as identifier. A dedicated `email` column
  // will be added in a future schema migration (tracked in lessons.md).
  // For this scaffold: identifier = user name, password verified against `pin` (bcrypt).
  // tenantSlug scopes the query so the same username across tenants cannot cross-authenticate.
  identifier: z.string().min(1),
  password: z.string().min(1),
  tenantSlug: z.string().min(1),
});

export const authConfig: NextAuthConfig = {
  // Inherit the edge-safe base (session strategy, callbacks, cookies, pages) and
  // append the Prisma-backed providers here. Keeping providers only in this
  // Node-runtime config is what keeps Prisma OUT of the Edge middleware bundle.
  ...authConfigEdge,
  providers: [
    // Provider 1: Email + password for Admin / Super Admin
    Credentials({
      id: 'admin-credentials',
      name: 'Admin Credentials',
      credentials: {
        identifier: { label: 'Username / Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
        // tenantSlug is submitted by the login form (it's visible in the URL /{tenant}/...).
        // It scopes the DB query so the same username cannot cross-authenticate across tenants.
        tenantSlug: { label: 'Tenant', type: 'text' },
      },
      async authorize(rawCredentials) {
        const parsed = adminCredentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        const { identifier, password, tenantSlug } = parsed.data;

        // Resolve tenant first — prevents cross-tenant name collision.
        const tenant = await prismaRaw.tenant.findUnique({
          where: { slug: tenantSlug },
          select: { id: true },
        });
        if (tenant == null) return null;

        // TODO(schema-gap): Query by email once `email` column is added to User.
        // Currently matches by name (acting as unique username per tenant).
        const user = await prismaRaw.user.findFirst({
          where: {
            name: identifier,
            // Wave 7.4-T1 fix: was `role: { in: ['admin'] } }`, which silently blocked every
            // employee-role user from ever signing in (roleMap below already maps 'employee' ->
            // Role.Employee, and staffProcedure explicitly allows Role.Employee — this filter was
            // the one place that disagreed). The Employee Station requires an employee session,
            // so both roles must be queryable here.
            role: { in: ['admin', 'employee'] },
            tenantId: tenant.id,  // scoped to this tenant — prevents cross-tenant auth
          },
          select: {
            id: true,
            name: true,
            role: true,
            tenantId: true,
            pin: true,
          },
        });

        if (user == null) return null;

        const valid = await bcrypt.compare(password, user.pin);
        if (!valid) return null;

        const roleMap: Record<string, Role> = {
          admin: Role.Admin,
          employee: Role.Employee,
        };

        return {
          id: user.id,
          name: user.name,
          email: null,
          tenantId: user.tenantId,
          // Carry the tenant SLUG (already validated above) onto the session so
          // Edge middleware can compare the URL {tenant} slug without a DB call
          // (cross-tenant page guard — see server/auth/tenant-guard.ts).
          tenantSlug,
          roles: [roleMap[user.role] ?? Role.Employee],
        };
      },
    }),

    // Provider 2: Super Admin (platform-level, env-based credentials)
    Credentials({
      id: 'super-admin-credentials',
      name: 'Super Admin',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(rawCredentials) {
        const parsed = z
          .object({ email: z.string().email(), password: z.string().min(1) })
          .safeParse(rawCredentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const superAdminEmail = process.env['SUPER_ADMIN_EMAIL'];
        const superAdminHash = process.env['SUPER_ADMIN_PASSWORD_HASH'];

        // Explicit null/empty checks required by @typescript-eslint/strict-boolean-expressions
        if (superAdminEmail == null || superAdminEmail === '' || superAdminHash == null || superAdminHash === '') {
          return null;
        }
        if (email !== superAdminEmail) return null;

        const valid = await bcrypt.compare(password, superAdminHash);
        if (!valid) return null;

        return {
          id: 'super-admin',
          name: 'Super Admin',
          email: superAdminEmail,
          tenantId: null,
          tenantSlug: null, // Super Admin has no home tenant — exempt from the slug guard
          roles: [Role.SuperAdmin],
        };
      },
    }),
  ],

  // session, callbacks (jwt/session), pages, and cookies are inherited from
  // authConfigEdge (spread above) — the single source of truth shared with the
  // edge middleware instance. Do NOT redefine them here.
};
