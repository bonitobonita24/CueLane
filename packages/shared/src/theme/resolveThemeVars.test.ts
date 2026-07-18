// Wave 7.7b-T1 — resolveThemeVars tests, written FIRST (TDD). Covers: every preset id, a custom
// object, a legacy bare string (back-compat), and unknown/malformed input (must never throw —
// this runs server-side on every tenant page render).
import { describe, it, expect } from 'vitest';
import { resolveThemeVars } from './resolveThemeVars.js';
import { THEME_PRESETS, THEME_BASE_VARS, type CustomTheme } from '../types/index.js';

describe('resolveThemeVars', () => {
  it.each(THEME_PRESETS.map((p) => p.id))('resolves the "%s" preset id to its CSS vars', (id) => {
    const preset = THEME_PRESETS.find((p) => p.id === id)!;
    const vars = resolveThemeVars(id);
    expect(vars.primary).toBe(preset.vars.primary);
    expect(vars.primaryForeground).toBe(preset.vars.primaryForeground);
    expect(vars.ring).toBe(preset.vars.ring);
    // Base neutral vars always present alongside the accent override.
    expect(vars.secondary).toBe(THEME_BASE_VARS.secondary);
    expect(vars.background).toBe(THEME_BASE_VARS.background);
  });

  it('resolves a custom theme object ({ custom: {...} }) to its own 9 colors verbatim', () => {
    const custom: CustomTheme = {
      primary: '10 50% 50%',
      primaryForeground: '0 0% 100%',
      secondary: '20 20% 90%',
      secondaryForeground: '20 20% 20%',
      accent: '30 30% 80%',
      accentForeground: '30 30% 10%',
      background: '0 0% 99%',
      foreground: '0 0% 1%',
      ring: '10 50% 50%',
    };
    const vars = resolveThemeVars({ custom });
    expect(vars).toEqual(custom);
  });

  it('back-compat: a legacy bare preset-id string (pre-Wave-7.7b shape) still resolves', () => {
    // This is literally what every seeded tenant's settings.theme looks like today: 'indigo'.
    const vars = resolveThemeVars('indigo');
    const indigo = THEME_PRESETS.find((p) => p.id === 'indigo')!;
    expect(vars.primary).toBe(indigo.vars.primary);
  });

  it('falls back to the default preset for an unknown/garbage string', () => {
    // NOTE: the signature is `unknown` by design (defensive parse of Prisma's untyped Json
    // column) — this asserts the runtime guard falls back for an unknown/retired preset id.
    const vars = resolveThemeVars('some-old-value-that-no-longer-exists');
    const fallback = THEME_PRESETS[0];
    expect(vars.primary).toBe(fallback.vars.primary);
  });

  it('falls back to the default preset for null/undefined/garbage-shaped input', () => {
    const fallback = THEME_PRESETS[0];
    expect(resolveThemeVars(undefined).primary).toBe(fallback.vars.primary);
    expect(resolveThemeVars(null).primary).toBe(fallback.vars.primary);
    // NOTE: old `{ preset: 'indigo' }` shape (pre-decision-2, docs/DECISIONS_LOG.md 2026-07-08)
    // is neither a string nor `{ custom }` — must not throw, must fall back.
    expect(resolveThemeVars({ preset: 'indigo' }).primary).toBe(fallback.vars.primary);
    // NOTE: a `{ custom }` object with missing/garbage keys must not throw.
    expect(resolveThemeVars({ custom: { primary: 123 } }).primary).toBe(fallback.vars.primary);
  });
});
