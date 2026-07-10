import type { Role } from '@cuelane/shared';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      tenantId: string | null;
      // Tenant SLUG carried alongside tenantId so Edge middleware can compare the
      // URL {tenant} slug without a DB call (cross-tenant page guard). null for
      // Super Admin (no home tenant).
      tenantSlug: string | null;
      roles: Role[];
    };
    expires: string;
  }

  // Returned by `authorize()` in Credentials provider
  interface User {
    id: string;
    name?: string | null;
    email?: string | null;
    tenantId: string | null;
    tenantSlug: string | null;
    roles: Role[];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId: string;
    tenantId: string | null;
    tenantSlug: string | null;
    roles: Role[];
  }
}
