// Wave 7.7a-T3 — Admin index renders the Dashboard landing directly. Wave 1 (Rule 34 Part B): the
// admin ROOT is view-access-guarded like every sub-page, but with a loop-safe twist — a caller who
// reached the shell (the layout let them in for SOME tab) yet lacks `dashboard:view` is routed to
// their FIRST visible tab instead of rendering the dashboard. The root never redirects to a
// sub-page the caller can't view, so the sub-page guards (which bounce denials back here) can never
// loop.
import { redirect } from 'next/navigation';
import { prisma, prismaRaw, FeatureKey } from '@cuelane/db';
import { TenantTier } from '@cuelane/shared';
import { auth } from '@/server/auth';
import { resolvePrincipal, hasPermission, type Principal } from '@/lib/rbac';
import { visibleAdminTabs } from './_lib/access';
import { DashboardClient } from './dashboard-client';

interface AdminPageProps {
  params: Promise<{ tenant: string }>;
}

export default async function AdminPage({ params }: AdminPageProps) {
  const { tenant: tenantSlug } = await params;
  const session = await auth();
  const userId = session?.user?.id ?? null;
  if (userId == null || userId === '') {
    redirect('/login');
  }

  let principal: Principal;
  try {
    principal = await resolvePrincipal(userId, prismaRaw);
  } catch {
    redirect(`/${tenantSlug}/kiosk`);
  }

  if (!hasPermission(principal, FeatureKey.dashboard, 'view')) {
    const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug }, select: { tier: true } });
    const tabs = visibleAdminTabs(principal, (tenant?.tier ?? TenantTier.Free) as TenantTier);
    const first = tabs.find((t) => t.href !== '');
    redirect(first != null ? `/${tenantSlug}/admin/${first.href}` : `/${tenantSlug}/kiosk`);
  }

  return <DashboardClient />;
}
