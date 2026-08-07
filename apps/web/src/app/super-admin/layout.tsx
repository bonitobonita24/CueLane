// Wave 7.8-T3 / Wave 8-sidebar — Super Admin shell. middleware.ts already gates every
// /super-admin/* path behind Role.TenantManager (redirects to /login otherwise); this layout adds the
// same defense-in-depth server-side re-check used by [tenant]/admin/layout.tsx.
//
// Wave 8-sidebar: the old top-tab SuperAdminNav is replaced by the shared left-sidebar AppShell
// (the global purpose-driven-app archetype) — this platform-management surface now reads as a
// proper dashboard instead of a thin nav strip over a wasted top area. Super Admin has no tenant
// theme + no tier: a fixed 3-item nav, absolute hrefs, platform-neutral brand.
import { redirect } from 'next/navigation';
import { auth } from '@/server/auth';
import { Role } from '@cuelane/shared';
import { AppShell, type AppShellNavItem } from '@/components/AppShell';

interface SuperAdminLayoutProps {
  children: React.ReactNode;
}

const NAV_ITEMS: AppShellNavItem[] = [
  { id: 'dashboard', label: 'Dashboard', href: '/super-admin/dashboard' },
  { id: 'tenants', label: 'Tenants', href: '/super-admin/tenants' },
  { id: 'system-ads', label: 'System Ads', href: '/super-admin/system-ads' },
];

export default async function SuperAdminLayout({ children }: SuperAdminLayoutProps) {
  const session = await auth();
  const roles = (session?.user as { roles?: Role[] } | undefined)?.roles ?? [];
  if (!roles.includes(Role.TenantManager)) {
    redirect('/login');
  }

  return (
    <AppShell
      brandName="CueLane"
      brandSubtitle="Super Admin"
      title="Super Admin"
      subtitle="Platform Management — Powerbyte staff only"
      navLabel="Platform"
      navItems={NAV_ITEMS}
    >
      {children}
    </AppShell>
  );
}
