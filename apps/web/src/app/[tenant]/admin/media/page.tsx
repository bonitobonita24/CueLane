// Wave 7.7c-T4 — Media admin tab. No tier gate here (PRODUCT.md: Media is visible on BOTH tiers,
// with limits). Wave 1 (Rule 34 Part B): view-access-guarded (requireFeatureView).
import { FeatureKey } from '@cuelane/db';
import { requireFeatureView } from '../_lib/require-feature';
import { MediaClient } from './media-client';

export default async function MediaPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params;
  await requireFeatureView(tenant, FeatureKey.media);
  return <MediaClient />;
}
