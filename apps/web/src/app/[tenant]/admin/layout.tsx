// Wave 7.6-T5 / Wave 8-sidebar — Admin Panel server shell. middleware.ts already gates `/admin`
// behind ANY valid session (PROTECTED_TENANT_PATHS); this layout adds the Admin/SuperAdmin role
// check (defense-in-depth, same pattern as station/page.tsx) PLUS resolves the tenant's tier so
// the nav can hide Premium-only items for Free tenants. Tenant-agnostic: tenantId/tier/name are
// always looked up from the DB by slug — never hardcoded, never trusted from client input. A
// brand-new tenant needs zero changes here.
//
// Wave 8-sidebar: the old top-tab AdminTabsNav is replaced by the shared left-sidebar AppShell
// (the global purpose-driven-app archetype). The tier-filtered tab list is resolved here (server)
// and passed down as fully-serializable nav items — identical trust boundary to the old
// server-layout → client-nav split; only the chrome changed. The parent [tenant]/layout.tsx still
// owns the server-side theme CSS-var injection (unchanged), so it applies to this shell too.
import { redirect } from 'next/navigation';
import { auth } from '@/server/auth';
import { prisma, prismaRaw } from '@cuelane/db';
import { TenantTier } from '@cuelane/shared';
import { AppShell, type AppShellNavItem } from '@/components/AppShell';
import { visibleAdminTabs } from './_lib/access';
import { resolvePrincipal, type Principal } from '@/lib/rbac';

interface AdminLayoutProps {
  children: React.ReactNode;
  params: Promise<{ tenant: string }>;
}

export default async function AdminLayout({ children, params }: AdminLayoutProps) {
  const { tenant: tenantSlug } = await params;
  const session = await auth();

  const userId = session?.user?.id ?? null;
  if (userId == null || userId === '') {
    redirect('/login');
  }

  // Wave 1 (Rule 34 Part B): the Admin Panel gate is now the view-access MATRIX, not a flat
  // Admin/SuperAdmin role check. Resolve the caller's DB Principal (fixed system role + any
  // custom-role permission matrix), then let the nav — and the shell-entry guard below — flow from
  // it. Fixed tiers (manager/superadmin/tenant_admin) short-circuit to full access inside
  // hasPermission; an employee with a custom role gets exactly the tabs their matrix grants. The
  // platform tenant_manager has no user row and never belongs in a tenant admin shell, so a
  // missing row = not authorized here.
  let principal: Principal;
  try {
    principal = await resolvePrincipal(userId, prismaRaw);
  } catch {
    redirect(`/${tenantSlug}/kiosk`);
  }

  // TenantLayout (the parent [tenant]/layout.tsx) already verified the tenant exists + is active —
  // re-select here (defense-in-depth, same pattern as station/page.tsx) for the tier the nav needs
  // + the companyName the sidebar brand header shows.
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true, tier: true, status: true, companyName: true },
  });
  if (tenant == null || tenant.status !== 'active') {
    redirect('/login');
  }

  const tabs = visibleAdminTabs(principal, tenant.tier as TenantTier);
  // No visible tab → the caller has no admin-module access at all (a plain employee with no
  // custom-role grants) → bounce out of the admin shell entirely, same target as before.
  if (tabs.length === 0) {
    redirect(`/${tenantSlug}/kiosk`);
  }

  // Resolve each tier-filtered tab into a fully-serializable nav item with an absolute href. The
  // Dashboard tab (href '') is the admin ROOT (`/{tenant}/admin`, no trailing slash) and is
  // active only on an EXACT pathname match — it's a prefix of every other admin href. This is the
  // same active-state rule the old AdminTabsNav encoded, moved into AppShell.
  const navItems: AppShellNavItem[] = tabs.map((tab) => ({
    id: tab.id,
    label: tab.label,
    href: tab.href === '' ? `/${tenantSlug}/admin` : `/${tenantSlug}/admin/${tab.href}`,
    exact: tab.href === '',
  }));

  return (
    <AppShell
      brandName={tenant.companyName}
      brandSubtitle="Admin Panel"
      title="Admin Panel"
      subtitle={
        <>
          Tenant: <code className="font-mono">{tenantSlug}</code>
        </>
      }
      navLabel="Manage"
      navItems={navItems}
    >
      {children}
    </AppShell>
  );
}
