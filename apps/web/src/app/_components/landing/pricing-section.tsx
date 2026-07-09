import Link from 'next/link';
import { Check, Minus } from 'lucide-react';
import { TIER_LIMITS, MEDIA_LIMITS } from '@cuelane/shared';
import { Button } from '@cuelane/ui';

interface ComparisonRow {
  label: string;
  free: string | boolean;
  premium: string | boolean;
}

// Every row is pulled from real, already-enforced limits/behavior — docs/PRODUCT.md's
// "Subscription Tiers" section + the actual TIER_LIMITS/MEDIA_LIMITS constants the backend
// enforces (apps/web/src/server/domain/admin.ts, media.ts). No invented numbers.
const ROWS: ComparisonRow[] = [
  { label: 'Employees', free: `Up to ${TIER_LIMITS.free.users}`, premium: 'Unlimited' },
  { label: 'Transaction types', free: `Up to ${TIER_LIMITS.free.services}`, premium: 'Unlimited' },
  { label: 'Windows', free: `Up to ${TIER_LIMITS.free.windows}`, premium: 'Unlimited' },
  {
    label: 'Big Display playlist items',
    free: `Up to ${MEDIA_LIMITS.free.maxPlaylistItems}`,
    premium: `Up to ${MEDIA_LIMITS.premium.maxPlaylistItems}`,
  },
  {
    label: 'Uploaded video files',
    free: `${MEDIA_LIMITS.free.maxUploadedFiles} file`,
    premium: `${MEDIA_LIMITS.premium.maxUploadedFiles} files`,
  },
  { label: 'Customer Kiosk + priority lane', free: true, premium: true },
  { label: 'Employee Station (desktop)', free: true, premium: true },
  { label: 'Mobile Employee Station', free: false, premium: true },
  { label: 'Custom theme colors', free: false, premium: true },
  { label: 'Full white-label branding', free: false, premium: true },
  { label: 'System ads on Big Display', free: 'Included, always on', premium: 'None' },
  { label: 'Your own tenant ads (live mode)', free: false, premium: true },
  { label: 'Advanced dashboard (employee timing)', free: false, premium: true },
  { label: 'Receipt template customization', free: false, premium: true },
  { label: 'Transfer with return-after-done', free: false, premium: true },
];

function Cell({ value }: { value: string | boolean }) {
  if (typeof value === 'boolean') {
    return value ? (
      <Check aria-label="Included" className="mx-auto size-4 text-primary" />
    ) : (
      <Minus aria-label="Not included" className="mx-auto size-4 text-muted-foreground/50" />
    );
  }
  return <span className="text-sm text-foreground">{value}</span>;
}

export function PricingSection() {
  return (
    <section id="pricing" className="border-b border-border/60 bg-background">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="cl-label text-muted-foreground">Simple, generous tiers</span>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-foreground">
            Start free. Upgrade when you outgrow it.
          </h2>
          <p className="mt-3 text-muted-foreground">
            Every workspace starts on the Free tier — no card required. Upgrade to Premium any
            time from your Admin Panel.
          </p>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div className="flex flex-col gap-6 rounded-xl border border-border bg-card p-8">
            <div>
              <h3 className="font-display text-xl font-semibold text-foreground">Free</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Everything a single branch needs to get running today.
              </p>
            </div>
            <Button asChild size="lg" variant="outline">
              <Link href="/signup">Get Started Free</Link>
            </Button>
          </div>

          <div className="flex flex-col gap-6 rounded-xl border-2 border-primary bg-card p-8 shadow-[0_1px_1px_rgba(97,104,117,0.05),0_4px_10px_rgba(97,104,117,0.08)]">
            <div>
              <span className="cl-label text-primary">Most complete</span>
              <h3 className="mt-1 font-display text-xl font-semibold text-foreground">Premium</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Full white-label, no limits, and every module unlocked.
              </p>
            </div>
            <Button asChild size="lg">
              <Link href="/signup">Start free, upgrade anytime</Link>
            </Button>
          </div>
        </div>

        <div className="mt-10 overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[560px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="p-4 text-sm font-medium text-muted-foreground">Feature</th>
                <th className="p-4 text-center text-sm font-medium text-muted-foreground">Free</th>
                <th className="p-4 text-center text-sm font-medium text-primary">Premium</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row, idx) => (
                <tr
                  key={row.label}
                  className={idx % 2 === 1 ? 'bg-secondary/20' : undefined}
                >
                  <td className="p-4 text-sm text-foreground">{row.label}</td>
                  <td className="p-4 text-center">
                    <Cell value={row.free} />
                  </td>
                  <td className="p-4 text-center">
                    <Cell value={row.premium} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
