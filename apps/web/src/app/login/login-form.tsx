'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { Button, Input, Label, cn } from '@cuelane/ui';

interface LoginFormProps {
  callbackUrl: string | null;
  initialError: string | null;
}

// Derives sign-in mode purely from the callbackUrl's first path segment.
// - absent, or first segment === 'super-admin' -> super-admin mode
// - any other first segment -> tenant-admin mode, segment is the tenant slug
function deriveTarget(callbackUrl: string | null): {
  mode: 'super-admin' | 'tenant-admin';
  tenantSlug: string | null;
  redirectTarget: string;
} {
  if (callbackUrl == null || callbackUrl === '') {
    return { mode: 'super-admin', tenantSlug: null, redirectTarget: '/super-admin/dashboard' };
  }

  const segments = callbackUrl.split('/').filter(Boolean);
  const firstSegment = segments[0];

  if (firstSegment == null || firstSegment === '' || firstSegment === 'super-admin') {
    return { mode: 'super-admin', tenantSlug: null, redirectTarget: '/super-admin/dashboard' };
  }

  return { mode: 'tenant-admin', tenantSlug: firstSegment, redirectTarget: callbackUrl };
}

function friendlyError(code: string | null): string | null {
  if (code == null || code === '') return null;
  return 'Invalid credentials. Please try again.';
}

export function LoginForm({ callbackUrl, initialError }: LoginFormProps) {
  const router = useRouter();
  const { mode, tenantSlug, redirectTarget } = deriveTarget(callbackUrl);

  const [email, setEmail] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(friendlyError(initialError));

  const isTenantMode = mode === 'tenant-admin';

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);

    try {
      if (isTenantMode) {
        if (tenantSlug == null || tenantSlug === '') {
          setError('Invalid tenant. Please try again.');
          setPending(false);
          return;
        }

        const result = await signIn('admin-credentials', {
          identifier,
          password,
          tenantSlug,
          redirect: false,
          callbackUrl: redirectTarget,
        });

        if (result?.error != null && result.error !== '') {
          setError('Invalid credentials. Please try again.');
          setPending(false);
          return;
        }

        router.push(result?.url ?? redirectTarget);
        return;
      }

      const result = await signIn('super-admin-credentials', {
        email,
        password,
        redirect: false,
        callbackUrl: redirectTarget,
      });

      if (result?.error != null && result.error !== '') {
        setError('Invalid credentials. Please try again.');
        setPending(false);
        return;
      }

      router.push(result?.url ?? redirectTarget);
    } catch {
      setError('Something went wrong. Please try again.');
      setPending(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-5" noValidate>
      {isTenantMode ? (
        <div className="rounded-md border border-border bg-muted/50 px-3 py-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Workspace
          </p>
          <p className="font-mono text-sm text-foreground">{tenantSlug}</p>
        </div>
      ) : null}

      {error != null ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      {isTenantMode ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="identifier">Username</Label>
          <Input
            id="identifier"
            name="identifier"
            type="text"
            autoComplete="username"
            required
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            disabled={pending}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={pending}
          />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          {isTenantMode && tenantSlug != null ? (
            <Link
              href={`/forgot-password?tenantSlug=${encodeURIComponent(tenantSlug)}`}
              className="text-xs font-medium text-primary hover:underline"
            >
              Forgot password?
            </Link>
          ) : null}
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={pending}
        />
      </div>

      <Button type="submit" disabled={pending} className={cn('mt-1 w-full')}>
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>

      {!isTenantMode ? (
        <p className="text-center text-xs text-muted-foreground">
          Signing in to a workspace? Use the link your administrator provided.
        </p>
      ) : null}
    </form>
  );
}
