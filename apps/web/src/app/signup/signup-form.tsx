'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X } from 'lucide-react';
import { slugify } from '@cuelane/shared';
import { Button, Input, Label, cn } from '@cuelane/ui';
import { createClient } from '@/lib/trpc';

const client = createClient('/api/trpc');

const SLUG_CHECK_DEBOUNCE_MS = 400;

// Wave 7.9-T3 — Turnstile seam. Dev's dummy site key (see .env.dev) has no real challenge to
// render; the server-side no-op (server/lib/turnstile.ts) already accepts any/no token against
// that dummy secret. We only render the widget placeholder once the owner supplies a LIVE site
// key at Phase-6 — until then, signup submits with no token and the server-side seam passes it
// through cleanly. Real widget mounting (Cloudflare's turnstile.render script) is the one thing
// left to wire when that key lands.
const TURNSTILE_SITE_KEY = process.env['NEXT_PUBLIC_TURNSTILE_SITE_KEY'];
const DUMMY_SITE_KEY_PREFIX = '1x0000';
const turnstileConfigured =
  TURNSTILE_SITE_KEY != null && TURNSTILE_SITE_KEY !== '' && !TURNSTILE_SITE_KEY.startsWith(DUMMY_SITE_KEY_PREFIX);

type SlugAvailability = { state: 'idle' } | { state: 'checking' } | { state: 'available' } | { state: 'unavailable'; reason: string };

function availabilityMessage(reason: string): string {
  switch (reason) {
    case 'reserved':
      return 'This workspace URL is reserved.';
    case 'taken':
      return 'This workspace URL is already taken.';
    case 'invalid':
      return 'Use 3-50 lowercase letters, numbers, and hyphens.';
    default:
      return 'This workspace URL is unavailable.';
  }
}

export function SignupForm() {
  const router = useRouter();

  const [companyName, setCompanyName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<SlugAvailability>({ state: 'idle' });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Live preview: slug field auto-follows companyName until the user edits it directly.
  const derivedSlug = useMemo(() => slugify(companyName), [companyName]);
  useEffect(() => {
    if (!slugTouched) setSlug(derivedSlug);
  }, [derivedSlug, slugTouched]);

  // Debounced availability check — UX only, never the authority (signup re-validates server-side).
  useEffect(() => {
    if (slug.trim() === '') {
      setAvailability({ state: 'idle' });
      return;
    }
    setAvailability({ state: 'checking' });
    if (debounceRef.current != null) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      client.auth.checkSlugAvailability
        .query({ slug })
        .then((result) => {
          if (result.available) {
            setAvailability({ state: 'available' });
          } else {
            setAvailability({ state: 'unavailable', reason: result.reason ?? 'unavailable' });
          }
        })
        .catch(() => setAvailability({ state: 'idle' }));
    }, SLUG_CHECK_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current != null) clearTimeout(debounceRef.current);
    };
  }, [slug]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);

    try {
      const result = await client.auth.signup.mutate({
        companyName,
        slug,
        adminName,
        adminEmail,
        password,
      });

      router.push(`/login?callbackUrl=${encodeURIComponent(`/${result.slug}/admin`)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setPending(false);
    }
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
        <Label htmlFor="companyName">Company name</Label>
        <Input
          id="companyName"
          name="companyName"
          type="text"
          autoComplete="organization"
          required
          maxLength={100}
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          disabled={pending}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="slug">Workspace URL</Label>
        <div className="flex items-center gap-1.5">
          <span className="whitespace-nowrap text-sm text-muted-foreground">cuelane.app/</span>
          <Input
            id="slug"
            name="slug"
            type="text"
            required
            maxLength={50}
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value.toLowerCase());
            }}
            disabled={pending}
            aria-describedby="slug-hint"
            className="font-mono"
          />
        </div>
        <p
          id="slug-hint"
          className={cn(
            'flex items-center gap-1 text-xs',
            availability.state === 'available' && 'text-emerald-600 dark:text-emerald-400',
            availability.state === 'unavailable' && 'text-destructive',
            (availability.state === 'idle' || availability.state === 'checking') && 'text-muted-foreground',
          )}
        >
          {availability.state === 'available' ? (
            <>
              <Check aria-hidden className="size-3.5" /> This workspace URL is available.
            </>
          ) : availability.state === 'unavailable' ? (
            <>
              <X aria-hidden className="size-3.5" /> {availabilityMessage(availability.reason)}
            </>
          ) : availability.state === 'checking' ? (
            'Checking availability…'
          ) : (
            '3-50 lowercase letters, numbers, and hyphens.'
          )}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="adminName">Your name (used to sign in)</Label>
        <Input
          id="adminName"
          name="adminName"
          type="text"
          autoComplete="name"
          required
          maxLength={100}
          value={adminName}
          onChange={(e) => setAdminName(e.target.value)}
          disabled={pending}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="adminEmail">Contact email</Label>
        <Input
          id="adminEmail"
          name="adminEmail"
          type="email"
          autoComplete="email"
          required
          value={adminEmail}
          onChange={(e) => setAdminEmail(e.target.value)}
          disabled={pending}
        />
        <p className="text-xs text-muted-foreground">
          Used to send you the password-reset link if you ever forget your password.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={pending}
        />
        <p className="text-xs text-muted-foreground">At least 8 characters.</p>
      </div>

      {turnstileConfigured ? (
        <div id="cf-turnstile-container" className="flex justify-center" />
      ) : null}

      <Button type="submit" disabled={pending || availability.state === 'unavailable'} className="mt-1">
        {pending ? 'Creating your workspace…' : 'Get Started Free'}
      </Button>
    </form>
  );
}
