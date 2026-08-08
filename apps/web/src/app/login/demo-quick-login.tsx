'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Button, cn } from '@cuelane/ui';
import { DEMO_QUICK_ACCOUNTS, type DemoQuickAccount } from './_lib/demo-quick-accounts';

interface DemoQuickLoginProps {
  tenantSlug: string;
}

// Dev/demo-only convenience rail: one button per RBAC tier that auto-fills + submits a seeded
// `demo`-tenant account through the same `admin-credentials` provider the form uses. Gated by the
// server component (login/page.tsx) — never rendered in staging/production.
export function DemoQuickLogin({ tenantSlug }: DemoQuickLoginProps) {
  const router = useRouter();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function quickLogin(account: DemoQuickAccount) {
    setError(null);
    setPendingKey(account.key);

    const redirectTarget = `/${tenantSlug}/${account.target}`;

    try {
      const result = await signIn('admin-credentials', {
        identifier: account.identifier,
        password: account.pin,
        tenantSlug,
        redirect: false,
        callbackUrl: redirectTarget,
      });

      if (result?.error != null && result.error !== '') {
        setError(`Could not sign in as ${account.sublabel}. Is the demo tenant seeded?`);
        setPendingKey(null);
        return;
      }

      router.push(result?.url ?? redirectTarget);
    } catch {
      setError('Something went wrong. Please try again.');
      setPendingKey(null);
    }
  }

  return (
    <aside
      aria-label="Demo quick login"
      className="w-full rounded-lg border border-dashed border-border bg-muted/30 p-4 md:w-56"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Demo quick login
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        One-click sign-in per role. Dev &amp; demo only.
      </p>

      {error != null ? (
        <div
          role="alert"
          className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-2 text-xs text-destructive"
        >
          {error}
        </div>
      ) : null}

      <div className="mt-3 flex flex-col gap-2">
        {DEMO_QUICK_ACCOUNTS.map((account) => {
          const isPending = pendingKey === account.key;
          return (
            <Button
              key={account.key}
              type="button"
              variant="outline"
              disabled={pendingKey != null}
              onClick={() => void quickLogin(account)}
              className={cn('h-auto justify-start gap-2.5 py-2 text-left')}
            >
              <span aria-hidden className="text-base leading-none">
                {account.emoji}
              </span>
              <span className="flex flex-col">
                <span className="text-sm font-medium leading-tight">
                  {isPending ? 'Signing in…' : account.label}
                </span>
                <span className="text-xs font-normal leading-tight text-muted-foreground">
                  {account.sublabel}
                </span>
              </span>
            </Button>
          );
        })}
      </div>
    </aside>
  );
}
