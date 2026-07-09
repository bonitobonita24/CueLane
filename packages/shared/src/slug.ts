// Wave 7.9-T1 — tenant workspace slug rules (signup + any future "change workspace URL" admin
// feature). Single source of truth for slug shape + reserved-word rejection, shared between the
// signup tRPC router (server-side authority) and the signup form (client-side live preview).

export const MIN_SLUG_LENGTH = 3;
export const MAX_SLUG_LENGTH = 50;

/** Paths that collide with real Next.js routes, or with the seeded demo tenants that must stay
 *  reachable at their fixed slugs. Never allow a signup to claim one of these. */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  'login',
  'signup',
  'api',
  'super-admin',
  'superadmin',
  '_next',
  'demo',
  'clinic',
  'forgot-password',
  'reset-password',
  'favicon.ico',
  'robots.txt',
  'sitemap.xml',
  'assets',
  'static',
  'public',
]);

// Unicode "Combining Diacritical Marks" block — what NFKD decomposition splits an accented
// letter into (e.g. 'é' -> 'e' + U+0301). Stripped BEFORE the generic non-alphanumeric replace
// below so an accented letter collapses to its base letter instead of leaving a stray hyphen.
const COMBINING_MARKS_RE = /[̀-ͯ]/g;

/** Derive a URL-safe slug candidate from free-text input (company name or a user-edited field).
 *  Lowercases, strips diacritics, replaces any run of non-alphanumeric characters with a single
 *  hyphen, trims leading/trailing hyphens, and caps length at MAX_SLUG_LENGTH. */
export function slugify(input: string): string {
  const withoutDiacritics = input.normalize('NFKD').replace(COMBINING_MARKS_RE, '');

  const slug = withoutDiacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug.slice(0, MAX_SLUG_LENGTH).replace(/-+$/g, '');
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug);
}

/** Shape validation only — does NOT check DB uniqueness (the caller must do that separately). */
export function isValidSlugShape(slug: string): boolean {
  if (slug.length < MIN_SLUG_LENGTH || slug.length > MAX_SLUG_LENGTH) return false;
  if (!/^[a-z0-9-]+$/.test(slug)) return false;
  if (slug.startsWith('-') || slug.endsWith('-')) return false;
  return true;
}
