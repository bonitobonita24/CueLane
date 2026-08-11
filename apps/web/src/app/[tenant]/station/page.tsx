// Wave 7.4-T1 / Wave 8-sidebar — Employee Station server shell. middleware.ts already gates
// `/station` behind ANY valid session (see PROTECTED_TENANT_PATHS); this page adds the role check
// (defense-in-depth, same pattern as admin/page.tsx) and resolves the tenant's windows for the
// client component's window-selection step.
//
// Wave 8-sidebar: the station is a focused serve console, so it gets the shared AppShell but as a
// NON-OBTRUSIVE thin icon-rail — collapsible="icon" + defaultOpen={false} so it opens COLLAPSED
// and the operator keeps maximum working area (the queue/serve panels stay the large right
// region). On mobile the rail is off-canvas (hidden until the hamburger). All serve/skip/transfer/
// window logic in StationClient is untouched — only the chrome changed.
import { redirect } from 'next/navigation';
import { auth } from '@/server/auth';
import { prisma, withTenantContext } from '@cuelane/db';
import { Role } from '@cuelane/shared';
import { AppShell, type AppShellNavItem } from '@/components/AppShell';
import { StationClient } from './station-client';

interface StationPageProps {
  params: Promise<{ tenant: string }>;
}

export default async function StationPage({ params }: StationPageProps) {
  const { tenant: tenantSlug } = await params;
  const session = await auth();

  const roles = (session?.user as { roles?: Role[] } | undefined)?.roles ?? [];
  if (
    !roles.includes(Role.Employee) &&
    !roles.includes(Role.TenantAdmin) &&
    !roles.includes(Role.TenantSuperadmin) &&
    !roles.includes(Role.TenantManager)
  ) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/${tenantSlug}/station`)}`);
  }

  // TenantLayout already resolves/guards the tenant by slug; re-select here (defense-in-depth,
  // same pattern as kiosk/page.tsx) purely for the window list the client needs up front.
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true, status: true, companyName: true },
  });
  if (tenant == null || tenant.status !== 'active') {
    redirect('/login');
  }

  // L6 lesson (queue.ts's kioskProcedure precedent): Window is a tenant-scoped model, NOT a
  // GLOBAL_MODEL like Tenant — the L6-guarded `prisma` extension throws "No tenant context
  // active" for any tenant-scoped query issued outside an AsyncLocalStorage tenant context. A
  // plain server component has no such context by default (unlike a staffProcedure/kioskProcedure
  // resolver), so it must be established explicitly here.
  //
  // ⚠ The callback passed to withTenantContext MUST be an `async` function (even with no
  // internal `await`) — a plain synchronous arrow that merely RETURNS a Prisma lazy-thenable
  // (`() => prisma.window.findMany(...)`) does NOT keep the AsyncLocalStorage context alive
  // through that thenable's `.then()` continuation: `tenantStorage.run()` only wraps the
  // SYNCHRONOUS execution of the callback, and a bare arrow's synchronous execution ends the
  // instant it returns the (still-pending) promise object — the guard extension's async
  // operation then runs OUTSIDE the ALS store. An `async` callback's V8 continuation machinery
  // stays properly instrumented, so the same guard sees the context. Confirmed by reproducing
  // both shapes directly against the real DB (logged to ~/.claude/LESSONS_GLOBAL.md).
  const windows = await withTenantContext(tenant.id, async () =>
    prisma.window.findMany({
      where: { tenantId: tenant.id },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  );

  // Single-item rail: the station is a one-screen console with no natural multi-destination nav,
  // so the sidebar is intentionally minimal chrome (brand + hamburger + the Station entry). It
  // starts COLLAPSED to a thin icon-rail (defaultOpen={false}) so it never dominates the console.
  const navItems: AppShellNavItem[] = [
    { id: 'station', label: 'Station', href: `/${tenantSlug}/station`, exact: true },
  ];

  return (
    <AppShell
      brandName={tenant.companyName}
      brandSubtitle="Station"
      title="Employee Station"
      subtitle={
        <>
          Tenant: <code className="font-mono">{tenantSlug}</code>
        </>
      }
      navLabel="Console"
      navItems={navItems}
      collapsible="icon"
      defaultOpen={false}
    >
      <StationClient tenantSlug={tenantSlug} windows={windows} />
    </AppShell>
  );
}
