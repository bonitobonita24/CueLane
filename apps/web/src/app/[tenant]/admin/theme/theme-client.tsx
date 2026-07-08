// Wave 7.6-T7 — Theme picker (8 THEME_PRESETS ids, decision 2 — the custom color picker is
// deferred to Wave 7.7). Persisted via `tenantAdmin.updateSettings` (JSON RMW — only patches
// `settings.theme`, never touches printerConfig/tickerText/etc.).
'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/trpc';
import { THEME_PRESETS, type ThemePresetId } from '@cuelane/shared';
import { cn } from '@cuelane/ui';

const client = createClient('/api/trpc');

// Swatch-only preview colors for this picker. NOT the runtime theming system — applying
// THEME_PRESETS to the Kiosk/Station/Display CSS variables is out of this wave's scope (globals.css
// doesn't define per-preset CSS custom properties yet); this map exists purely so the admin can
// visually distinguish presets while choosing.
const PREVIEW_COLORS: Record<ThemePresetId, string> = {
  indigo: '#6366F1',
  ocean: '#0EA5E9',
  emerald: '#10B981',
  rose: '#F43F5E',
  amber: '#F59E0B',
  violet: '#8B5CF6',
  teal: '#14B8A6',
  slate: '#64748B',
};

export function ThemeClient() {
  const [theme, setTheme] = useState<ThemePresetId | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    const settings = await client.tenantAdmin.getSettings.query();
    const currentTheme = (settings.settings as { theme?: ThemePresetId } | null)?.theme ?? 'indigo';
    setTheme(currentTheme);
  }, []);

  useEffect(() => {
    setLoading(true);
    refresh()
      .catch(() => toast.error('Failed to load theme.'))
      .finally(() => setLoading(false));
  }, [refresh]);

  const selectTheme = async (id: ThemePresetId) => {
    setSaving(true);
    try {
      await client.tenantAdmin.updateSettings.mutate({ settings: { theme: id } });
      setTheme(id);
      toast.success('Theme updated.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="max-w-2xl space-y-4">
      <p className="text-sm text-muted-foreground">
        Choose the accent color shown on the Kiosk, Station, and Display screens.
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" role="radiogroup" aria-label="Theme preset">
        {THEME_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            role="radio"
            aria-checked={theme === preset.id}
            disabled={saving}
            onClick={() => void selectTheme(preset.id)}
            className={cn(
              'rounded-md border p-4 text-left transition-colors motion-reduce:transition-none',
              theme === preset.id ? 'border-primary ring-1 ring-primary' : 'border-border hover:bg-accent',
            )}
          >
            <span
              className="mb-2 block h-6 w-full rounded"
              style={{ backgroundColor: PREVIEW_COLORS[preset.id] }}
              aria-hidden
            />
            <span className="text-sm font-medium">{preset.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
