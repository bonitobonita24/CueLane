// Wave 7.6-T7 — Printer Settings admin tab. Wave 1 (Rule 34 Part B): view-access-guarded
// (requireFeatureView) — the `settings` feature also gates tenantAdmin.getSettings/updateSettings.
import { FeatureKey } from '@cuelane/db';
import { requireFeatureView } from '../_lib/require-feature';
import { SettingsClient } from './settings-client';

export default async function SettingsPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params;
  await requireFeatureView(tenant, FeatureKey.settings);
  return <SettingsClient />;
}
