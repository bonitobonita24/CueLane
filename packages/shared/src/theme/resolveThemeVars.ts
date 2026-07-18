// Wave 7.7b-T1 — resolves a tenant's `settings.theme` value (whatever shape it happens to be —
// Prisma's `settings` column is untyped Json, so this MUST be defensive against every legacy/
// malformed shape ever written) to the concrete 9 CSS-variable values every theme carries.
// Consumed server-side by `[tenant]/layout.tsx` (no client effect — avoids a theme flash) and
// unit-tested directly here.
import { THEME_PRESETS, THEME_BASE_VARS, type ThemeVars } from '../types/index.js';
import { customThemeSchema } from '../schemas/index.js';

const DEFAULT_PRESET = THEME_PRESETS[0];

function presetVars(id: string): ThemeVars {
  const preset = THEME_PRESETS.find((p) => p.id === id) ?? DEFAULT_PRESET;
  return { ...THEME_BASE_VARS, ...preset.vars };
}

/** Resolves ANY value that might be sitting in `settings.theme` to a full `ThemeVars` map.
 *  Deliberately typed `unknown` on input (not `ThemeSetting`) — the Prisma `settings` Json column
 *  is untyped at rest, so a legacy/hand-edited/corrupt row is a real possibility, not just a type
 *  hole. Never throws; unresolvable input always falls back to `THEME_PRESETS[0]`. */
export function resolveThemeVars(setting: unknown): ThemeVars {
  // 1. A bare preset-id string — the legacy Wave 7.6 shape AND still the common case today.
  if (typeof setting === 'string') {
    return presetVars(setting);
  }

  // 2. A Premium custom-color object: `{ custom: {...} }`. Re-validated here (not trusted just
  //    because it has a `custom` key) — a hand-edited or pre-schema DB row could carry a
  //    malformed/incomplete custom object, which must fall back rather than inject bad CSS.
  if (setting != null && typeof setting === 'object' && 'custom' in setting) {
    const parsed = customThemeSchema.safeParse(setting.custom);
    if (parsed.success) return parsed.data;
  }

  // 3. Anything else — null/undefined, the pre-decision-2 `{ preset: 'indigo' }` shape, an
  //    unknown/retired preset id, garbage — sensible default.
  return presetVars(DEFAULT_PRESET.id);
}
