// Wave 7.8-T3 — Super Admin shell. middleware.ts already gates every /super-admin/* path behind
// Role.SuperAdmin (redirects to /login otherwise); this layout adds the same defense-in-depth
// server-side re-check used by [tenant]/admin/layout.tsx, plus the nav.
import { redirect } from 'next/navigation';
import { auth } from '@/server/auth';
import { Role } from '@cuelane/shared';
import { SuperAdminNav } from './_components/SuperAdminNav';

interface SuperAdminLayoutProps {
  children: React.ReactNode;
}

export default async function SuperAdminLayout({ children }: SuperAdminLayoutProps) {
  const session = await auth();
  const roles = (session?.user as { roles?: Role[] } | undefined)?.roles ?? [];
  if (!roles.includes(Role.SuperAdmin)) {
    redirect('/login');
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b px-4 py-4 sm:px-6">
        <h1 className="text-xl font-semibold tracking-tight">Super Admin</h1>
        <p className="text-sm text-muted-foreground">CueLane Platform Management — Powerbyte staff only</p>
      </header>
      <SuperAdminNav />
      <main className="flex-1 p-4 sm:p-6">{children}</main>
    </div>
  );
}
