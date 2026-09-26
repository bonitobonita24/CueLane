// Edge-safe (zero imports): consumed by src/middleware.ts to decide which request paths bypass
// all tenant/auth middleware. Extracted so it is unit-testable without pulling the Auth.js edge
// instance into the test graph.
//
// CROSS-SCOPE: apps/web/public holds the official Powerbyte favicon kit + site.webmanifest +
// /brand logos (copied from Branding-Marketing-Framework/brand-assets/official-logo). If a
// public asset is added/renamed, keep PUBLIC_ASSET_PATHS here AND the `config.matcher` literal
// in middleware.ts in sync — otherwise the asset falls into tenant-slug routing.

// IMPORTANT: Do NOT use pathname.includes('.') — it would bypass auth for any URL path containing
// a dot anywhere. Only a file extension at the END of the last path segment counts.
export const STATIC_EXT_RE = /\.\w{1,8}$/;

// Root-level public assets served from apps/web/public (exact paths).
export const PUBLIC_ASSET_PATHS: ReadonlySet<string> = new Set([
  '/favicon.ico',
  '/favicon-16x16.png',
  '/favicon-32x32.png',
  '/apple-touch-icon.png',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
  '/site.webmanifest',
  '/robots.txt',
  '/sitemap.xml',
]);

// Brand logos (apps/web/public/brand/*.svg|png) bypass via STATIC_EXT_RE — deliberately NOT via a
// '/brand/' prefix rule, so a tenant whose slug happens to be "brand" keeps full auth on
// /brand/admin etc.
export function isInternalPath(pathname: string): boolean {
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    PUBLIC_ASSET_PATHS.has(pathname) ||
    STATIC_EXT_RE.test(pathname)
  );
}
