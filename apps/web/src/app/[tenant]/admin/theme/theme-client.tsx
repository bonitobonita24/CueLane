// Wave 7.6-T7 (presets) + Wave 7.7b-T3 (Premium custom 9-color picker). Presets are available to
// every tier (Wave 7.7b un-gates the Theme tab for Free — see docs/DECISIONS_LOG.md 2026-07-09,
// supersedes the Wave 7.6-T7 "Theme tab is Premium-only" call: Free tenants now see presets, only
// the CUSTOM picker stays Premium-gated). Persisted via `tenantAdmin.updateSettings` (JSON RMW —
// only patches `settings.theme`), same vanilla tRPC-proxy client pattern as station-client.tsx —
// no react-query provider in this app.
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/trpc';
import {
  THEME_PRESETS,
  THEME_BASE_VARS,
  TenantTier,
  resolveThemeVars,
  type ThemePresetId,
  type ThemeVars,
  type CustomTheme,
} from '@cuelane/shared';
import { cn } from '@cuelane/ui';

const client = createClient('/api/trpc');

type ThemeMode = 'preset' | 'custom';

const DEFAULT_PRESET_ID: ThemePresetId = THEME_PRESETS[0].id;

const CUSTOM_FIELD_LABELS: Record<keyof CustomTheme, string> = {
  primary: 'Primary',
  primaryForeground: 'Primary text',
  secondary: 'Secondary',
  secondaryForeground: 'Secondary text',
  accent: 'Accent',
  accentForeground: 'Accent text',
  background: 'Background',
  foreground: 'Foreground text',
  ring: 'Focus ring',
};

const CUSTOM_FIELD_ORDER = Object.keys(CUSTOM_FIELD_LABELS) as (keyof CustomTheme)[];

// ── HSL triplet ("H S% L%", the runtime/storage format — matches globals.css + resolveThemeVars)
// <-> hex (the native <input type="color"> widget's only supported value format) conversion.
// Purely a UI-widget concern — nothing outside this file ever sees hex.
function hslTripletToHex(triplet: string): string {
  const m = /^(\d+(?:\.\d+)?) (\d+(?:\.\d+)?)% (\d+(?:\.\d+)?)%$/.exec(triplet.trim());
  if (!m) return '#000000';
  const h = Number(m[1]) / 360;
  const s = Number(m[2]) / 100;
  const l = Number(m[3]) / 100;
  if (s === 0) {
    const v = Math.round(l * 255);
    const hex = v.toString(16).padStart(2, '0');
    return `#${hex}${hex}${hex}`;
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2rgb = (t: number): number => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const r = Math.round(hue2rgb(h + 1 / 3) * 255);
  const g = Math.round(hue2rgb(h) * 255);
  const b = Math.round(hue2rgb(h - 1 / 3) * 255);
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

function hexToHslTriplet(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  const d = max - min;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r:
        h = ((g - b) / d) % 6;
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function themeVarsToCssVarMap(vars: ThemeVars): Record<string, string> {
  const map: Record<string, string> = {};
  const entries = Object.entries(vars) as Array<[string, string]>;
  for (const [key, value] of entries) {
    const kebab = key.replace(/([A-Z])/g, '-$1').toLowerCase();
    map[`--${kebab}`] = value;
  }
  return map;
}

export function ThemeClient() {
  const [tier, setTier] = useState<TenantTier | null>(null);
  const [mode, setMode] = useState<ThemeMode>('preset');
  const [presetId, setPresetId] = useState<ThemePresetId>(DEFAULT_PRESET_ID);
  const [custom, setCustom] = useState<CustomTheme>({ ...THEME_BASE_VARS, ...THEME_PRESETS[0].vars });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Live-preview scope: a dedicated ref'd element, NEVER document.documentElement — dragging a
  // color input must not repaint the surrounding admin chrome, only this sample panel.
  const previewRef = useRef<HTMLDivElement>(null);

  const isPremium = tier === TenantTier.Premium;

  const refresh = useCallback(async () => {
    const settings = await client.tenantAdmin.getSettings.query();
    setTier(settings.tier as TenantTier);
    const themeSetting = (settings.settings as { theme?: unknown } | null)?.theme;

    if (themeSetting != null && typeof themeSetting === 'object' && 'custom' in themeSetting) {
      // resolveThemeVars re-validates + falls back defensively — reuse it so a malformed stored
      // custom object can never crash this panel, it just resolves to the default preset instead.
      setCustom(resolveThemeVars(themeSetting));
      setMode('custom');
    } else {
      const id = THEME_PRESETS.find((p) => p.id === themeSetting)?.id ?? DEFAULT_PRESET_ID;
      setPresetId(id);
      setMode('preset');
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    refresh()
      .catch(() => toast.error('Failed to load theme.'))
      .finally(() => setLoading(false));
  }, [refresh]);

  // Resolved vars for whichever mode is currently being edited/previewed.
  const previewVars: ThemeVars = useMemo(() => {
    if (mode === 'custom') return custom;
    return resolveThemeVars(presetId);
  }, [mode, presetId, custom]);

  // Apply the live preview imperatively to the dedicated ref'd panel — NOT document.documentElement
  // — so every drag/keystroke on a color input repaints only the sample card, not the admin chrome.
  useEffect(() => {
    const el = previewRef.current;
    if (el == null) return;
    const map = themeVarsToCssVarMap(previewVars);
    for (const [prop, value] of Object.entries(map)) {
      el.style.setProperty(prop, value);
    }
  }, [previewVars]);

  const selectPreset = async (id: ThemePresetId) => {
    setPresetId(id);
    setMode('preset');
    setSaving(true);
    try {
      await client.tenantAdmin.updateSettings.mutate({ settings: { theme: id } });
      toast.success('Theme updated.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  const updateCustomField = (field: keyof CustomTheme, hex: string) => {
    setCustom((prev) => ({ ...prev, [field]: hexToHslTriplet(hex) }));
  };

  const saveCustom = async () => {
    setSaving(true);
    try {
      await client.tenantAdmin.updateSettings.mutate({ settings: { theme: { custom } } });
      setMode('custom');
      toast.success('Custom theme saved.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  if (loading || tier == null) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <p className="text-sm text-muted-foreground">
        Choose the accent color shown on the Kiosk, Station, and Display screens.
      </p>

      {/* Mode tabs — Presets always available, Custom is Premium-only. */}
      <div className="flex gap-2 border-b border-border" role="tablist" aria-label="Theme mode">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'preset'}
          onClick={() => setMode('preset')}
          className={cn(
            'border-b-2 px-3 py-2 text-sm font-medium transition-colors motion-reduce:transition-none',
            mode === 'preset' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          Presets
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'custom'}
          disabled={!isPremium}
          onClick={() => isPremium && setMode('custom')}
          className={cn(
            'border-b-2 px-3 py-2 text-sm font-medium transition-colors motion-reduce:transition-none',
            mode === 'custom' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            !isPremium && 'cursor-not-allowed opacity-50 hover:text-muted-foreground',
          )}
        >
          Custom {!isPremium ? '🔒' : null}
        </button>
      </div>

      {mode === 'preset' ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" role="radiogroup" aria-label="Theme preset">
          {THEME_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              role="radio"
              aria-checked={presetId === preset.id}
              disabled={saving}
              onClick={() => void selectPreset(preset.id)}
              className={cn(
                'rounded-md border p-4 text-left transition-colors motion-reduce:transition-none',
                presetId === preset.id ? 'border-primary ring-1 ring-primary' : 'border-border hover:bg-accent',
              )}
            >
              <span
                className="mb-2 block h-6 w-full rounded"
                style={{ backgroundColor: `hsl(${preset.vars.primary})` }}
                aria-hidden
              />
              <span className="text-sm font-medium">{preset.label}</span>
            </button>
          ))}
        </div>
      ) : !isPremium ? (
        <div className="rounded-md border border-dashed border-border p-6 text-center">
          <p className="text-sm font-medium">Custom colors are a Premium feature.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Upgrade to Premium to design your own 9-color theme instead of choosing from a preset.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {CUSTOM_FIELD_ORDER.map((field) => (
              <label key={field} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                <span className="text-sm">{CUSTOM_FIELD_LABELS[field]}</span>
                <input
                  type="color"
                  aria-label={CUSTOM_FIELD_LABELS[field]}
                  value={hslTripletToHex(custom[field])}
                  disabled={saving}
                  onChange={(e) => updateCustomField(field, e.target.value)}
                  className="h-8 w-12 cursor-pointer rounded border border-border bg-transparent p-0"
                />
              </label>
            ))}
          </div>

          {/* Live preview — scoped to this ref'd panel only (see the useEffect above), never
              document.documentElement. */}
          <div
            ref={previewRef}
            className="space-y-3 rounded-md border border-border bg-background p-4 text-foreground"
          >
            <p className="cl-label text-muted-foreground">Live preview</p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">
                Primary button
              </span>
              <span className="rounded-md bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground">
                Secondary
              </span>
              <span className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground">
                Accent
              </span>
              <span className="rounded-md border-2 border-primary px-3 py-1.5 text-sm font-medium ring-2 ring-ring">
                Focus ring
              </span>
            </div>
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={() => void saveCustom()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors motion-reduce:transition-none disabled:opacity-50"
          >
            Save custom theme
          </button>
        </div>
      )}
    </div>
  );
}
