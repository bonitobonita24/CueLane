// Wave 7.4-T1 — Employee Station server shell. middleware.ts already gates `/station` behind ANY
// valid session (see PROTECTED_TENANT_PATHS); this page adds the role check (defense-in-depth,
// same pattern as admin/page.tsx) and resolves the tenant's windows for the client component's
// window-selection step.
import { redirect } from 'next/navigation';
import { auth } from '@/server/auth';
import { prisma } from '@cuelane/db';
import { Role } from '@cuelane/shared';
import { StationClient } from './station-client';

interface StationPageProps {
  params: Promise<{ tenant: string }>;
}

export default async function StationPage({ params }: StationPageProps) {
  const { tenant: tenantSlug } = await params;
  const session = await auth();

  const roles = (session?.user as { roles?: Role[] } | undefined)?.roles ?? [];
  if (!roles.includes(Role.Employee) && !roles.includes(Role.Admin) && !roles.includes(Role.SuperAdmin)) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/${tenantSlug}/station`)}`);
  }

  // TenantLayout already resolves/guards the tenant by slug; re-select here (defense-in-depth,
  // same pattern as kiosk/page.tsx) purely for the window list the client needs up front.
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true, status: true },
  });
  if (tenant == null || tenant.status !== 'active') {
    redirect('/login');
  }

  const windows = await prisma.window.findMany({
    where: { tenantId: tenant.id },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });

  return <StationClient tenantSlug={tenantSlug} windows={windows} />;
}
