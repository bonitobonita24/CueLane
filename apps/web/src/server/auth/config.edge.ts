import type { NextAuthConfig } from 'next-auth';
import { Role } from '@cuelane/shared';

// ─────────────────────────────────────────────────────────────────────────────
// EDGE-SAFE Auth.js v5 base config.
//
// This file MUST NOT import Prisma (`@cuelane/db`), bcrypt, or any Node-only
// module. It is consumed by the Edge middleware (see ./edge.ts + middleware.ts).
// The session strategy is JWT, so middleware only needs to DECODE the token —
// it never runs a provider `authorize()` (which is where the DB lookups live).
//
// The full, Prisma-backed config (./config.ts) spreads this base and appends the
// Credentials providers whose `authorize()` callbacks query the database. Those
// providers stay OUT of the edge bundle, fixing the runtime error:
//   "Extensions.defineExtension is unable to run in this browser environment"
// ─────────────────────────────────────────────────────────────────────────────
export const authConfigEdge: NextAuthConfig = {
  // Providers are appended in the Node-runtime config (./config.ts). The edge
  // instance needs none: JWT decoding + the callbacks below are enough to
  // reconstruct `req.auth` for route protection in middleware.
  providers: [],

  // Behind Docker/Traefik the request Host differs from a Vercel deployment.
  // Auth.js v5 rejects such hosts by default ("UntrustedHost"). We terminate TLS
  // and set NEXTAUTH_URL ourselves per environment, so trusting the host is safe.
  trustHost: true,

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
          tenantSlug: (u.tenantSlug as string | null | undefined) ?? null,
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
      session.user.tenantSlug = (tok.tenantSlug as string | null | undefined) ?? null;
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
