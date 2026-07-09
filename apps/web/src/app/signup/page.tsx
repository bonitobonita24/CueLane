import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@cuelane/ui';
import { SignupForm } from './signup-form';

export const metadata: Metadata = {
  title: 'Get Started · CueLane',
};

export default function SignupPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div className="flex w-full max-w-md flex-col gap-8">
        <div className="flex flex-col items-center gap-1 text-center">
          <Link href="/" className="font-display text-2xl font-semibold tracking-tight text-foreground">
            CueLane
          </Link>
          <p className="text-sm text-muted-foreground">Set up your workspace — free, no card required.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-xl">Get Started</CardTitle>
            <CardDescription>Create your company workspace and admin account.</CardDescription>
          </CardHeader>
          <CardContent>
            <SignupForm />
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          Already have a workspace?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
