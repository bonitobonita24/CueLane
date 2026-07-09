import Link from 'next/link';
import { ArrowRight, Bell } from 'lucide-react';
import { Button } from '@cuelane/ui';

export function HeroSection() {
  return (
    <section className="relative overflow-hidden border-b border-border/60 bg-background">
      {/* Subtle radial glow — HashiCorp-style micro-depth, no gradient-fill text (anti-slop). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px] bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,hsl(var(--primary)/0.14),transparent)]"
      />

      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-28">
        <div className="flex flex-col gap-6">
          <span className="cl-label w-fit rounded-full border border-border bg-secondary px-3 py-1 text-secondary-foreground">
            Queue management, built for walk-ins
          </span>

          <h1 className="font-display text-4xl font-semibold leading-[1.1] tracking-tight text-foreground sm:text-5xl lg:text-[3.4rem]">
            Every walk-in, organized.
            <br />
            Every number, called on time.
          </h1>

          <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
            CueLane replaces the paper ticket dispenser and the spreadsheet you never open. Set up
            a branch — bank, clinic, government window, telco desk — and start managing queues in
            minutes, with a Kiosk, an Employee Station, a Big Display, and real analytics from day
            one.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild size="lg" className="gap-2">
              <Link href="/signup">
                Get Started Free
                <ArrowRight aria-hidden className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">Sign in to your workspace</Link>
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            Free tier included — no card required. Upgrade to Premium any time.
          </p>
        </div>

        <HeroDisplayMock />
      </div>
    </section>
  );
}

/** An illustrative, static preview of the Big Display "Now Serving" surface — NOT a stock photo,
 *  NOT a fabricated metric. Purely a shape-accurate mockup of the real module (see
 *  apps/web/src/app/[tenant]/display) built from the same design tokens, so the hero communicates
 *  the actual product instead of a generic dashboard placeholder. */
function HeroDisplayMock() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_1px_rgba(97,104,117,0.05),0_2px_2px_rgba(97,104,117,0.05)]">
        <div className="flex items-center justify-between border-b border-border/60 bg-secondary/60 px-4 py-2.5">
          <span className="cl-label text-muted-foreground">Big Display · Now Serving</span>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Bell aria-hidden className="size-3.5" />
            Live
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 p-4">
          {[
            { window: 'Window 1', number: '1-014', label: 'Cash Deposit' },
            { window: 'Window 2', number: '1-015', label: 'Account Opening' },
          ].map((row) => (
            <div key={row.window} className="rounded-lg border border-border bg-background p-3">
              <p className="cl-label text-[10px] text-primary">{row.window}</p>
              <p className="font-display text-3xl font-semibold tracking-tight text-foreground">
                {row.number}
              </p>
              <p className="text-xs text-muted-foreground">{row.label}</p>
            </div>
          ))}
        </div>

        <div className="border-t border-border/60 px-4 py-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Up Next</span>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground">
              6 waiting
            </span>
          </div>
          <div className="mt-2 flex gap-1.5">
            {['1-016', '1-017', '1-018', '1-019'].map((n) => (
              <span
                key={n}
                className="rounded-md border border-border bg-background px-2 py-1 font-mono text-xs text-foreground"
              >
                {n}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
