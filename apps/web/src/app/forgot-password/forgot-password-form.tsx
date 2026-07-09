'use client';

import { useState } from 'react';
import { Button, Input, Label } from '@cuelane/ui';
import { createClient } from '@/lib/trpc';

const client = createClient('/api/trpc');

interface ForgotPasswordFormProps {
  initialTenantSlug?: string;
}

export function ForgotPasswordForm({ initialTenantSlug = '' }: ForgotPasswordFormProps) {
  const [tenantSlug, setTenantSlug] = useState(initialTenantSlug);
  const [identifier, setIdentifier] = useState('');
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);

    try {
      // Anti-enumeration: the server ALWAYS returns { success: true } regardless of whether the
      // workspace/username combination exists — this UI must never branch on that fact either.
      await client.auth.requestPasswordReset.mutate({ identifier, tenantSlug });
      setSubmitted(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setPending(false);
    }
  }

  if (submitted) {
    return (
      <div role="status" className="rounded-md border border-border bg-muted/40 px-3 py-3 text-sm text-foreground">
        If this account exists, a password reset link has been sent to its contact email.
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-5" noValidate>
      {error != null ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tenantSlug">Workspace URL</Label>
        <div className="flex items-center gap-1.5">
          <span className="whitespace-nowrap text-sm text-muted-foreground">cuelane.app/</span>
          <Input
            id="tenantSlug"
            name="tenantSlug"
            type="text"
            required
            value={tenantSlug}
            onChange={(e) => setTenantSlug(e.target.value.toLowerCase())}
            disabled={pending}
            className="font-mono"
          />
        </div>
      </div>

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

      <Button type="submit" disabled={pending} className="mt-1">
        {pending ? 'Sending…' : 'Send reset link'}
      </Button>
    </form>
  );
}
