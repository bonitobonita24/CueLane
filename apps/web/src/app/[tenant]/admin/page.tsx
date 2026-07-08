import { auth } from '@/server/auth';
import { redirect } from 'next/navigation';
import { Role } from '@cuelane/shared';

interface AdminPageProps {
  params: Promise<{ tenant: string }>;
}

export default async function AdminPage({ params }: AdminPageProps) {
  const { tenant } = await params;
  const session = await auth();

  const roles = (
    session?.user as { roles?: Role[] } | undefined
  )?.roles ?? [];

  if (
    !roles.includes(Role.Admin) &&
    !roles.includes(Role.SuperAdmin)
  ) {
    redirect(`/${tenant}/kiosk`);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">Admin Panel</h1>
        <p className="mt-2 text-muted-foreground">
          Tenant: <code className="font-mono text-sm">{tenant}</code>
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          Placeholder — full admin UI wired in feature sessions.
        </p>
      </div>
    </main>
  );
}
