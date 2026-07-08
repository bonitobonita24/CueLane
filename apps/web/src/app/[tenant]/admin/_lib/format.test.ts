import { describe, expect, it } from 'vitest';
import { formatDurationSec, formatPercent } from './format';

describe('formatDurationSec', () => {
  it('formats sub-minute durations as m:ss', () => {
    expect(formatDurationSec(0)).toBe('0:00');
    expect(formatDurationSec(32.5)).toBe('0:33'); // rounds
    expect(formatDurationSec(90)).toBe('1:30');
  });

  it('formats past-hour durations as h:mm:ss', () => {
    expect(formatDurationSec(3661)).toBe('1:01:01');
  });

  it('clamps negative input to 0:00', () => {
    expect(formatDurationSec(-5)).toBe('0:00');
  });
});

describe('formatPercent', () => {
  it('rounds a fraction to a whole-number percent', () => {
    expect(formatPercent(0)).toBe('0%');
    expect(formatPercent(3 / 7)).toBe('43%');
    expect(formatPercent(1)).toBe('100%');
  });
});
