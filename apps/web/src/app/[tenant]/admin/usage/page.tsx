// Wave 7.6-T7 — Usage overview tab. Wave 1 (Rule 34 Part B): view-access-guarded (requireFeatureView).
import { FeatureKey } from '@cuelane/db';
import { requireFeatureView } from '../_lib/require-feature';
import { UsageClient } from './usage-client';

export default async function UsagePage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params;
  await requireFeatureView(tenant, FeatureKey.usage);
  return <UsageClient />;
}
