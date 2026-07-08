// Wave 7.6-T7 — Theme admin tab. Free-gated (AdminLayout's tab nav already hides this route for
// Free tenants); this page adds a defense-in-depth server-side gate, same pattern as
// layout.tsx's role guard, for a Free-tier admin who hits the URL directly.
import { redirect } from 'next/navigation';
import { prisma } from '@cuelane/db';
import { TenantTier } from '@cuelane/shared';
import { isTabGatedForTier } from '../_lib/access';
import { ThemeClient } from './theme-client';

interface ThemePageProps {
  params: Promise<{ tenant: string }>;
}

export default async function ThemePage({ params }: ThemePageProps) {
  const { tenant: tenantSlug } = await params;
  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug }, select: { tier: true } });

  if (tenant != null && isTabGatedForTier('theme', tenant.tier as TenantTier)) {
    redirect(`/${tenantSlug}/admin/services`);
  }

  return <ThemeClient />;
}
