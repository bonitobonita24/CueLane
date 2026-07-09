import type { NextConfig } from 'next';

// Wave 7.7d — the Big Display video panel plays local (uploaded) media via a presigned MinIO/S3
// URL fetched by the BROWSER (`<video src>`), which needs `media-src` to include the storage
// origin. This is deliberately env-aware (never a hardcoded single origin — that would break
// prod): derive it from the same `MINIO_PUBLIC_ENDPOINT`/`MINIO_ENDPOINT` env vars
// `@cuelane/storage`'s `getPublicEndpoint()` uses (docs/DECISIONS_LOG.md "Wave 7.7d-T1"). Falls
// back to the dev default so a from-scratch `next build` without env vars set doesn't crash.
function getMediaSrcOrigin(): string {
  const raw = process.env['MINIO_PUBLIC_ENDPOINT'] ?? process.env['MINIO_ENDPOINT'] ?? 'http://localhost:41709';
  try {
    return new URL(raw).origin;
  } catch {
    return 'http://localhost:41709';
  }
}

const securityHeaders = [
  // Prevent clickjacking — deny framing from other origins
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  // Prevent MIME type sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Force HTTPS for 1 year, include subdomains
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  // Disable browser features not needed by the app
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  // Control referrer information sent with requests
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Basic XSS protection for older browsers
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  // Content Security Policy — tighten per environment after dev phase
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // Wave 7.7d — https://www.youtube.com is required ONLY for the IFrame Player API bootstrap
      // script (`https://www.youtube.com/iframe_api`), which the Big Display video panel loads to
      // detect playlist/ad video-end events (`onStateChange`). The embed itself uses
      // youtube-nocookie.com (frame-src below) — this script-src addition does not by itself
      // permit framing youtube.com.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.youtube.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self'",
      // Wave 7.7d — YouTube playlist entries / LIVE-mode stream / tenant+system ad embeds.
      // youtube-nocookie.com is the privacy-enhanced embed domain (preferred); youtube.com is
      // additionally allowed because the IFrame Player API's bootstrapped player can redirect
      // through it for certain videos (e.g. non-embeddable-by-default warnings, share overlays).
      "frame-src https://www.youtube-nocookie.com https://www.youtube.com",
      // Wave 7.7d — local (uploaded) Big Display media, played via a presigned MinIO/S3 URL
      // fetched directly by the browser's <video> element. Origin is env-derived (dev: the
      // host-mapped MinIO port; staging/prod: the public S3/R2/CDN origin) — never a wildcard.
      `media-src 'self' ${getMediaSrcOrigin()}`,
      "frame-ancestors 'none'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  output: 'standalone',
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
  transpilePackages: [
    '@cuelane/ui',
    '@cuelane/shared',
    '@cuelane/api-client',
    '@cuelane/db',
    '@cuelane/jobs',
    '@cuelane/storage',
  ],
  // Required for server-only imports in workspace packages (Next.js 15+)
  serverExternalPackages: ['@prisma/client'],
  webpack: (config) => {
    // Resolve .js extensions to .ts/.tsx for workspace packages that use
    // TypeScript ESModule convention (import './foo.js' where file is foo.ts)
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
      '.jsx': ['.tsx', '.jsx'],
    };
    return config;
  },
};

export default nextConfig;
