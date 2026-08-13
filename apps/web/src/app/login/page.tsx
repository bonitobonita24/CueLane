import type { Metadata } from 'next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, cn } from '@cuelane/ui';
import { LoginForm } from './login-form';
import { DemoQuickLogin } from './demo-quick-login';

export const metadata: Metadata = {
  title: 'Sign in · CueLane',
};

interface LoginPageProps {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}

// Tenant slug is the first path segment of callbackUrl (mirrors login-form.tsx deriveTarget):
// absent / 'super-admin' => super-admin mode (no tenant).
function tenantSlugFromCallback(callbackUrl: string | null): string | null {
  const firstSegment = callbackUrl?.split('/').filter(Boolean)[0];
  if (firstSegment == null || firstSegment === '' || firstSegment === 'super-admin') return null;
  return firstSegment;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const callbackUrl = params.callbackUrl ?? null;
  const error = params.error ?? null;

  // Quick-login rail: dev + demo environments only (never staging/prod), and only for the seeded
  // `demo` tenant. A future demo stack sets APP_ENV=demo to switch it on there too.
  const appEnv = process.env.APP_ENV ?? 'development';
  const tenantSlug = tenantSlugFromCallback(callbackUrl);
  const quickLoginEnabled =
    (appEnv === 'development' || appEnv === 'demo') && tenantSlug === 'demo';

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div className={cn('flex w-full flex-col gap-8', quickLoginEnabled ? 'max-w-2xl' : 'max-w-sm')}>
        <div className="flex flex-col items-center gap-1 text-center">
          <span className="font-display text-2xl font-semibold tracking-tight text-foreground">
            CueLane
          </span>
          <p className="text-sm text-muted-foreground">Smart Queue Management</p>
        </div>

        <div
          className={cn(
            'flex flex-col gap-6',
            quickLoginEnabled && 'md:flex-row md:items-start md:justify-center',
          )}
        >
          <Card className="w-full md:max-w-sm">
            <CardHeader>
              <CardTitle className="font-display text-xl">Sign in</CardTitle>
              <CardDescription>Enter your credentials to continue.</CardDescription>
            </CardHeader>
            <CardContent>
              <LoginForm callbackUrl={callbackUrl} initialError={error} />
            </CardContent>
          </Card>

          {quickLoginEnabled && tenantSlug != null ? (
            <DemoQuickLogin tenantSlug={tenantSlug} />
          ) : null}
        </div>
      </div>
    </main>
  );
}
