// Wave 7.3-T1 — Customer Kiosk. Server shell: resolves the tenant's public branding (company
// name + tagline — no sensitive fields) and hands off to the client component that owns all
// interactivity (tile grid, issue mutation, live counts, auto-print, auto-reset).
import { notFound } from 'next/navigation';
import { prisma } from '@cuelane/db';
import { KioskClient } from './kiosk-client';

interface KioskPageProps {
  params: Promise<{ tenant: string }>;
}

export default async function KioskPage({ params }: KioskPageProps) {
  const { tenant: tenantSlug } = await params;

  // TenantLayout already guards existence/active-status, but this page needs the branding
  // fields too, so it re-selects (defense-in-depth, same pattern as layout.tsx).
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { companyName: true, tagline: true, status: true, settings: true },
  });

  if (tenant == null || tenant.status !== 'active') {
    notFound();
  }

  // settings is an untyped Json column (see schema.prisma comment: { theme, printerConfig,
  // tickerText, businessName, videoMode, liveStreamUrl }) — narrow defensively, default to no
  // auto-print for any tenant that hasn't configured a kiosk printer.
  const settings = tenant.settings as { printerConfig?: { enabled?: boolean } } | null;
  const printEnabled = settings?.printerConfig?.enabled === true;

  return (
    <KioskClient
      tenantSlug={tenantSlug}
      companyName={tenant.companyName}
      tagline={tenant.tagline}
      printEnabled={printEnabled}
    />
  );
}
