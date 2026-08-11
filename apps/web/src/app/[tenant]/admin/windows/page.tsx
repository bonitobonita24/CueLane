// Wave 7.6-T6 — Windows admin tab. Wave 1 (Rule 34 Part B): view-access-guarded (requireFeatureView).
import { FeatureKey } from '@cuelane/db';
import { requireFeatureView } from '../_lib/require-feature';
import { WindowsClient } from './windows-client';

export default async function WindowsPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params;
  await requireFeatureView(tenant, FeatureKey.windows);
  return <WindowsClient />;
}
