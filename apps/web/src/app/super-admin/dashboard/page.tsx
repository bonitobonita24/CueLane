import { auth } from '@/server/auth';
import { redirect } from 'next/navigation';
import { Role } from '@cuelane/shared';

export default async function SuperAdminDashboardPage() {
  const session = await auth();

  const roles = (
    session?.user as { roles?: Role[] } | undefined
  )?.roles ?? [];

  if (!roles.includes(Role.SuperAdmin)) {
    redirect('/login');
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">Super Admin</h1>
        <p className="mt-2 text-muted-foreground">Platform Management</p>
        <p className="mt-4 text-sm text-muted-foreground">
          Placeholder — platform admin UI wired in feature sessions.
        </p>
      </div>
    </main>
  );
}
