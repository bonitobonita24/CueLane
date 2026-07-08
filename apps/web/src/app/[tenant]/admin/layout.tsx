// Wave 7.6-T5 — Admin Panel server shell. middleware.ts already gates `/admin` behind ANY valid
// session (PROTECTED_TENANT_PATHS); this layout adds the Admin/SuperAdmin role check (defense-in-
// depth, same pattern as station/page.tsx) PLUS resolves the tenant's tier so the tab nav can hide
// Premium-only tabs for Free tenants. Tenant-agnostic: tenantId/tier are always looked up from the
// DB by slug — never hardcoded, never trusted from client input. A brand-new tenant needs zero
// changes here.
import { redirect } from 'next/navigation';
import { auth } from '@/server/auth';
import { prisma } from '@cuelane/db';
import { Role, TenantTier } from '@cuelane/shared';
import { isAdminRole, visibleAdminTabs } from './_lib/access';
import { AdminTabsNav } from './_components/AdminTabsNav';

interface AdminLayoutProps {
  children: React.ReactNode;
  params: Promise<{ tenant: string }>;
}

export default async function AdminLayout({ children, params }: AdminLayoutProps) {
  const { tenant: tenantSlug } = await params;
  const session = await auth();

  const roles = (session?.user as { roles?: Role[] } | undefined)?.roles ?? [];
  if (!isAdminRole(roles)) {
    redirect(`/${tenantSlug}/kiosk`);
  }

  // TenantLayout (the parent [tenant]/layout.tsx) already verified the tenant exists + is active —
  // re-select here (defense-in-depth, same pattern as station/page.tsx) purely for the tier the
  // tab nav needs.
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true, tier: true, status: true },
  });
  if (tenant == null || tenant.status !== 'active') {
    redirect('/login');
  }

  const tabs = visibleAdminTabs(tenant.tier as TenantTier);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b px-4 py-4 sm:px-6">
        <h1 className="text-xl font-semibold tracking-tight">Admin Panel</h1>
        <p className="text-sm text-muted-foreground">
          Tenant: <code className="font-mono text-xs">{tenantSlug}</code>
        </p>
      </header>
      <AdminTabsNav tenantSlug={tenantSlug} tabs={tabs} />
      <main className="flex-1 p-4 sm:p-6">{children}</main>
    </div>
  );
}
