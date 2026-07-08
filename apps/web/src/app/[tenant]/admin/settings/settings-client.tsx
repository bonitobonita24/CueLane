// Wave 7.6-T7 — Printer Settings tab. Reads/writes `Tenant.settings.printerConfig` via
// `tenantAdmin.getSettings`/`updateSettings`. The server does a read-modify-write merge (including
// a nested merge of printerConfig itself — tenantAdmin.ts), so every save here only patches the
// fields this form actually shows; it never clobbers sibling settings (theme, tickerText, etc.).
'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/trpc';
import { Button, Input, Label, Switch } from '@cuelane/ui';

interface PrinterConfigState {
  enabled: boolean;
  autoCut: boolean;
  footerText: string;
}

const DEFAULT_PRINTER_CONFIG: PrinterConfigState = { enabled: false, autoCut: false, footerText: '' };

const client = createClient('/api/trpc');

export function SettingsClient() {
  const [printerConfig, setPrinterConfig] = useState<PrinterConfigState>(DEFAULT_PRINTER_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    const settings = await client.tenantAdmin.getSettings.query();
    const pc = (settings.settings as { printerConfig?: Partial<PrinterConfigState> } | null)?.printerConfig;
    setPrinterConfig({
      enabled: pc?.enabled ?? false,
      autoCut: pc?.autoCut ?? false,
      footerText: pc?.footerText ?? '',
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    refresh()
      .catch(() => toast.error('Failed to load printer settings.'))
      .finally(() => setLoading(false));
  }, [refresh]);

  const save = async (next: PrinterConfigState) => {
    setSaving(true);
    try {
      await client.tenantAdmin.updateSettings.mutate({ settings: { printerConfig: next } });
      setPrinterConfig(next);
      toast.success('Printer settings saved.');
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
    <div className="max-w-md space-y-6">
      <div className="flex items-center justify-between rounded-md border p-4">
        <div>
          <p className="font-medium">Enable receipt printer</p>
          <p className="text-sm text-muted-foreground">Turn off if this tenant has no ticket printer.</p>
        </div>
        <Switch
          checked={printerConfig.enabled}
          onCheckedChange={(checked) => void save({ ...printerConfig, enabled: checked })}
          disabled={saving}
          aria-label="Enable receipt printer"
        />
      </div>

      <div className="flex items-center justify-between rounded-md border p-4">
        <div>
          <p className="font-medium">Auto-cut after each ticket</p>
        </div>
        <Switch
          checked={printerConfig.autoCut}
          onCheckedChange={(checked) => void save({ ...printerConfig, autoCut: checked })}
          disabled={saving || !printerConfig.enabled}
          aria-label="Auto-cut after each ticket"
        />
      </div>

      <div className="space-y-2 rounded-md border p-4">
        <Label htmlFor="footerText">Receipt footer text</Label>
        <Input
          id="footerText"
          value={printerConfig.footerText}
          maxLength={200}
          disabled={!printerConfig.enabled}
          onChange={(e) => setPrinterConfig({ ...printerConfig, footerText: e.target.value })}
        />
        <Button
          size="sm"
          disabled={saving || !printerConfig.enabled}
          onClick={() => void save(printerConfig)}
        >
          Save footer text
        </Button>
      </div>
    </div>
  );
}
