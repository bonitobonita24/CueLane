// Wave 7.9-T1 — slug utility tests (TDD). Signup derives a tenant workspace slug from
// user input; this is the ONLY place slug shape/reserved-word rules are defined so the
// signup router and any future admin "change workspace URL" feature share one source of truth.
import { describe, expect, it } from 'vitest';
import { slugify, isReservedSlug, isValidSlugShape, RESERVED_SLUGS, MIN_SLUG_LENGTH, MAX_SLUG_LENGTH } from './slug.js';

describe('slugify', () => {
  it('lowercases and hyphenates spaces', () => {
    expect(slugify('Bayanihan Rural Bank')).toBe('bayanihan-rural-bank');
  });

  it('strips non-alphanumeric characters', () => {
    expect(slugify("O'Brien & Sons, Inc.")).toBe('o-brien-sons-inc');
  });

  it('collapses consecutive separators into one hyphen', () => {
    expect(slugify('Foo   ---   Bar')).toBe('foo-bar');
  });

  it('trims leading/trailing hyphens', () => {
    expect(slugify('  -Foo Bar-  ')).toBe('foo-bar');
  });

  it('removes diacritics', () => {
    expect(slugify('Café Münich')).toBe('cafe-munich');
  });

  it('truncates to MAX_SLUG_LENGTH and re-trims a trailing hyphen', () => {
    const long = 'a'.repeat(MAX_SLUG_LENGTH + 20);
    const result = slugify(long);
    expect(result.length).toBeLessThanOrEqual(MAX_SLUG_LENGTH);
    expect(result.endsWith('-')).toBe(false);
  });
});

describe('isReservedSlug', () => {
  it('flags known reserved routes', () => {
    for (const s of ['login', 'signup', 'api', 'super-admin', 'superadmin', '_next', 'demo', 'clinic']) {
      expect(isReservedSlug(s)).toBe(true);
    }
  });

  it('exposes the reserved set for reuse elsewhere', () => {
    expect(RESERVED_SLUGS.has('login')).toBe(true);
    expect(RESERVED_SLUGS.has('totally-not-reserved')).toBe(false);
  });

  it('does not flag an ordinary company slug', () => {
    expect(isReservedSlug('bayanihan-rural-bank')).toBe(false);
  });
});

describe('isValidSlugShape', () => {
  it('accepts a well-formed slug', () => {
    expect(isValidSlugShape('bayanihan-bank')).toBe(true);
  });

  it('rejects below MIN_SLUG_LENGTH', () => {
    expect(isValidSlugShape('a'.repeat(MIN_SLUG_LENGTH - 1))).toBe(false);
  });

  it('rejects above MAX_SLUG_LENGTH', () => {
    expect(isValidSlugShape('a'.repeat(MAX_SLUG_LENGTH + 1))).toBe(false);
  });

  it('rejects uppercase or invalid characters', () => {
    expect(isValidSlugShape('Bad_Slug!')).toBe(false);
  });

  it('rejects leading/trailing hyphen', () => {
    expect(isValidSlugShape('-bad')).toBe(false);
    expect(isValidSlugShape('bad-')).toBe(false);
  });
});
