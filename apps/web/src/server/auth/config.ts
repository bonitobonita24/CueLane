import type { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@cuelane/db';
import { Role } from '@cuelane/shared';

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
        const tenant = await prisma.tenant.findUnique({
          where: { slug: tenantSlug },
          select: { id: true },
        });
        if (tenant == null) return null;

        // TODO(schema-gap): Query by email once `email` column is added to User.
        // Currently matches by name (acting as unique username per tenant).
        const user = await prisma.user.findFirst({
          where: {
            name: identifier,
            role: { in: ['admin'] },
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
          roles: [Role.SuperAdmin],
        };
      },
    }),
  ],

  session: { strategy: 'jwt' },

  callbacks: {
    // Auth.js v5: JWT base type extends Record<string,unknown> and User has an index signature,
    // making it impossible to access app-specific fields (tenantId, roles) without `any`.
    // Block-disable covers only these two callbacks where the cast is unavoidable.
    /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */

    // Not async: no await needed — JWT fields are set synchronously from the user object.
    // User is typed non-nullable; use trigger to detect initial sign-in.
    jwt({ token, user, trigger }) {
      if (trigger === 'signIn' || trigger === 'signUp') {
        const u = user as any;
        return {
          ...token,
          userId: String(u.id ?? ''),
          tenantId: (u.tenantId as string | null | undefined) ?? null,
          roles: (u.roles as Role[] | undefined) ?? [],
        };
      }
      return token;
    },

    // Not async: no await needed — session fields are set synchronously from the token.
    session({ session, token }) {
      const tok = token as any;
      session.user.id = String(tok.userId ?? '');
      session.user.tenantId = (tok.tenantId as string | null | undefined) ?? null;
      session.user.roles = (tok.roles as Role[] | undefined) ?? [];
      return session;
    },

    /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  // SameSite=Lax prevents CSRF — safe for subdirectory multi-tenant routing
  cookies: {
    sessionToken: {
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env['NODE_ENV'] === 'production',
      },
    },
  },
};
