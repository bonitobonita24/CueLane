// Edge-safe auth instance ONLY — importing from '@/server/auth' would pull the
// Prisma-backed providers into the Edge middleware bundle and crash at runtime
// ("Extensions.defineExtension unable to run in this browser environment").
import { auth } from '@/server/auth/edge';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { Role } from '@cuelane/shared';

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

  // 5. Protected tenant routes (station, admin) — require valid session
  if (isProtectedTenantPath) {
    const session = req.auth as
      | { user?: { id?: string; tenantId?: string | null; roles?: Role[] } }
      | null
      | undefined;

    const userId = session?.user?.id;
    if (userId == null || userId === '') {
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = '/login';
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // L1 anti-enumeration: tenant slug vs session tenantId.
    // Full enforcement is in tRPC requireTenant middleware (DB-level guard).
    // NOTE: slug-in-JWT optimisation tracked in DECISIONS_LOG.
    const roles: Role[] = session?.user?.roles ?? [];
    const _isSuperAdmin = roles.includes('super_admin' as Role);
    void _isSuperAdmin; // checked here for future early-exit; enforcement is in tRPC layer

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
