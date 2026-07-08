import { describe, expect, it } from 'vitest';
import { isAddDisabled, nextNumberPreview } from './limits';

describe('isAddDisabled', () => {
  it('is false for Premium (limit null) regardless of count', () => {
    expect(isAddDisabled({ count: 999, limit: null })).toBe(false);
  });

  it('is false below cap', () => {
    expect(isAddDisabled({ count: 5, limit: 6 })).toBe(false);
  });

  it('is true at cap', () => {
    expect(isAddDisabled({ count: 6, limit: 6 })).toBe(true);
  });

  it('is true over cap', () => {
    expect(isAddDisabled({ count: 7, limit: 6 })).toBe(true);
  });
});

describe('nextNumberPreview', () => {
  it('previews 1 for an empty list', () => {
    expect(nextNumberPreview([])).toBe(1);
  });

  it('previews max + 1 for a contiguous list', () => {
    expect(nextNumberPreview([1, 2, 3])).toBe(4);
  });

  it('previews max + 1 even with gaps (never gap-fills)', () => {
    expect(nextNumberPreview([1, 5, 3])).toBe(6);
  });
});
