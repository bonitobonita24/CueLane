import type { Metadata } from 'next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@cuelane/ui';
import { LoginForm } from './login-form';

export const metadata: Metadata = {
  title: 'Sign in · CueLane',
};

interface LoginPageProps {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const callbackUrl = params.callbackUrl ?? null;
  const error = params.error ?? null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div className="flex w-full max-w-sm flex-col gap-8">
        <div className="flex flex-col items-center gap-1 text-center">
          <span className="font-display text-2xl font-semibold tracking-tight text-foreground">
            CueLane
          </span>
          <p className="text-sm text-muted-foreground">Smart Queue Management</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-xl">Sign in</CardTitle>
            <CardDescription>Enter your credentials to continue.</CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm callbackUrl={callbackUrl} initialError={error} />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
