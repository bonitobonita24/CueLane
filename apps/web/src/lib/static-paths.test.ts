// Guards the middleware bypass for public assets (official Powerbyte favicon kit, manifest,
// /brand logos) AND that non-asset routes keep going through tenant/auth middleware.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PUBLIC_ASSET_PATHS, isInternalPath } from './static-paths';

// Next's matcher literal must stay a static string in middleware.ts (not importable), so read it
// from source and compile it the same way Next does: anchored full-path regex.
function loadMatcherRegex(): RegExp {
  const src = readFileSync(path.resolve(__dirname, '../middleware.ts'), 'utf8');
  const match = /matcher:\s*\[\s*(?:\/\*[\s\S]*?\*\/\s*)?'([^']+)'/.exec(src);
  if (match?.[1] == null) throw new Error('matcher literal not found in middleware.ts');
  return new RegExp(`^${match[1].replace(/\\\\/g, '\\')}$`);
}

describe('isInternalPath (middleware bypass)', () => {
  it.each([
    '/favicon.ico',
    '/favicon-16x16.png',
    '/favicon-32x32.png',
    '/apple-touch-icon.png',
    '/android-chrome-192x192.png',
    '/android-chrome-512x512.png',
    '/site.webmanifest',
    '/brand/BrandLogoLightBG.svg',
    '/brand/250x65pxLogoBrandDarkBG.png',
    '/_next/static/chunks/main.js',
    '/api/auth/session',
  ])('bypasses %s', (p) => {
    expect(isInternalPath(p)).toBe(true);
  });

  it.each(['/login', '/superadmin/dashboard', '/demo/admin', '/demo/kiosk', '/brand/admin', '/brand'])(
    'does NOT bypass app route %s',
    (p) => {
      expect(isInternalPath(p)).toBe(false);
    },
  );
});

describe('middleware config.matcher', () => {
  const matcher = loadMatcherRegex();

  it('excludes every root-level favicon-kit asset (middleware never runs)', () => {
    for (const p of PUBLIC_ASSET_PATHS) {
      if (p === '/robots.txt' || p === '/sitemap.xml') continue;
      expect(matcher.test(p), p).toBe(false);
    }
  });

  it('still matches app routes, including a tenant slug named "brand"', () => {
    for (const p of ['/login', '/superadmin/dashboard', '/demo/admin', '/brand/admin']) {
      expect(matcher.test(p), p).toBe(true);
    }
  });
});
