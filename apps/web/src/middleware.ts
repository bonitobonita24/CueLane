// Edge-safe auth instance ONLY — importing from '@/server/auth' would pull the
// Prisma-backed providers into the Edge middleware bundle and crash at runtime
// ("Extensions.defineExtension unable to run in this browser environment").
import { auth } from '@/server/auth/edge';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { Role } from '@cuelane/shared';
import { evaluateProtectedTenantAccess } from '@/server/auth/tenant-guard';

// Paths that do NOT need auth (kiosk + display are public-facing)
const PUBLIC_TENANT_PATHS = ['/kiosk', '/display'];

// Paths under /{tenant}/ that require an authenticated session
const PROTECTED_TENANT_PATHS = ['/station', '/admin'];

// Turnstile-protected public entry points (per inputs.yml)
const TURNSTILE_PATHS = ['/login', '/register', '/forgot-password'];

// Paths that bypass all tenant/auth middleware (Next.js internals + static assets).
// IMPORTANT: Do NOT use pathname.includes('.') — it would bypass auth for any
// URL path containing a dot (e.g. /super-admin/report.csv).
// Instead, check for a file extension only at the END of the last path segment.
const STATIC_EXT_RE = /\.\w{1,8}$/;

function isInternalPath(pathname: string): boolean {
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    STATIC_EXT_RE.test(pathname)
  );
}

// Non-async callback: no await inside, remove async to satisfy @typescript-eslint/require-await
export default auth((req: NextRequest & { auth: unknown }) => {
  const { pathname } = req.nextUrl;

  // 1. Skip Next.js internals and auth API
  if (isInternalPath(pathname)) {
    return NextResponse.next();
  }

  // 2. Super Admin routes — require super_admin role
  if (pathname.startsWith('/super-admin')) {
    const session = req.auth as
      | { user?: { roles?: Role[]; id?: string } }
      | null
      | undefined;

    const roles: Role[] = session?.user?.roles ?? [];
    const isSuperAdmin = roles.includes('super_admin' as Role);

    if (!isSuperAdmin) {
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = '/login';
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
  }

  // 3. Resolve tenant slug from first URL path segment: /{tenant}/...
  const segments = pathname.split('/').filter(Boolean);
  const tenantSlug = segments[0];

  // Root path or non-tenant paths — pass through (explicit null check for strict-boolean-expressions)
  if (tenantSlug == null || TURNSTILE_PATHS.includes(`/${tenantSlug}`)) {
    return NextResponse.next();
  }

  // Determine if the sub-path under the tenant is protected or public
  const subPath = `/${segments.slice(1).join('/')}`;
  // Use exact-segment prefix matching to avoid false positives:
  // '/station'.startsWith('/station') → true, but so does '/stationery' without this guard.
  const matchesSegment = (sub: string, prefix: string) =>
    sub === prefix || sub.startsWith(prefix + '/');

  const isPublicTenantPath = PUBLIC_TENANT_PATHS.some((p) =>
    matchesSegment(subPath, p),
  );
  const isProtectedTenantPath = PROTECTED_TENANT_PATHS.some((p) =>
    matchesSegment(subPath, p),
  );

  // 4. Kiosk and display are public — allow without auth
  if (isPublicTenantPath) {
    return NextResponse.next();
  }

  // 5. Protected tenant routes (station, admin) — require a valid session AND
  //    enforce that the URL {tenant} slug matches the session user's own tenant
  //    (defense-in-depth page guard; DATA isolation is still owned by the tRPC
  //    requireTenant / L6 / RLS layer — do NOT rely on this alone). SuperAdmin is
  //    exempt (may view any tenant). The tenant slug is carried in the JWT
  //    (server/auth/config.ts authorize → jwt callback), so no DB call is needed
  //    edge-side. See server/auth/tenant-guard.ts + DECISIONS_LOG 2026-07-10.
  if (isProtectedTenantPath) {
    const session = req.auth as
      | { user?: { id?: string; tenantSlug?: string | null; roles?: Role[] } }
      | null
      | undefined;

    const decision = evaluateProtectedTenantAccess({
      urlTenantSlug: tenantSlug,
      session: {
        userId: session?.user?.id,
        tenantSlug: session?.user?.tenantSlug,
        roles: session?.user?.roles,
      },
    });

    if (decision.action === 'redirect-login') {
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = '/login';
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (decision.action === 'redirect-tenant') {
      // Send the user to the SAME sub-path under their OWN tenant slug, e.g.
      // /clinic/admin/users (as a demo admin) → /demo/admin/users. Drop the query
      // string — it may reference the other tenant's resource ids.
      const ownUrl = req.nextUrl.clone();
      ownUrl.pathname = `/${decision.slug}${subPath}`;
      ownUrl.search = '';
      return NextResponse.redirect(ownUrl);
    }

    return NextResponse.next();
  }

  // 6. All other /{tenant}/... paths — allow through (no action)
  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static  (static files)
     * - _next/image   (image optimization)
     * - favicon.ico
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
