// Wave 7.6-T7 — Theme admin tab. Wave 7.7b: no longer Free-gated (Free tenants get the 8 presets
// too — only the in-tab Premium custom-color picker is tier-gated, by ThemeClient itself reading
// Tenant.tier). `isTabGatedForTier` is retained as a defense-in-depth call, same pattern as
// layout.tsx's role guard, for whenever a future tab IS added to FREE_GATED_TAB_IDS — it's a no-op
// today (theme isn't in that set anymore).
import { redirect } from 'next/navigation';
import { prisma, FeatureKey } from '@cuelane/db';
import { TenantTier } from '@cuelane/shared';
import { isTabGatedForTier } from '../_lib/access';
import { requireFeatureView } from '../_lib/require-feature';
import { ThemeClient } from './theme-client';

interface ThemePageProps {
  params: Promise<{ tenant: string }>;
}

export default async function ThemePage({ params }: ThemePageProps) {
  const { tenant: tenantSlug } = await params;
  // Wave 1 (Rule 34 Part B): view-access guard first, then the existing tier gate.
  await requireFeatureView(tenantSlug, FeatureKey.theme);
  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug }, select: { tier: true } });

  if (tenant != null && isTabGatedForTier('theme', tenant.tier as TenantTier)) {
    redirect(`/${tenantSlug}/admin/services`);
  }

  return <ThemeClient />;
}
