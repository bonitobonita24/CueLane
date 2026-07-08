// Wave 7.6-T5 — reusable usage meter: a shadcn Progress bar vs. a TIER_LIMITS cap, with an
// at-/over-cap visual + text state. `limit === null` (Premium) renders an "Unlimited" pill with no
// bar. Pure presentational component — the caller (Services/Windows/Users pages, Usage tab) fetches
// counts via `tenantAdmin.getUsage` / router `.list()` and passes them in.
import { Progress } from '@cuelane/ui';
import { cn } from '@cuelane/ui';

interface UsageMeterProps {
  label: string;
  count: number;
  limit: number | null;
  className?: string;
}

export function UsageMeter({ label, count, limit, className }: UsageMeterProps) {
  const atLimit = limit != null && count >= limit;
  const percent = limit != null ? Math.min(100, Math.round((count / limit) * 100)) : 0;

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className={cn('tabular-nums', atLimit ? 'font-semibold text-destructive' : 'text-muted-foreground')}>
          {limit == null ? `${count} · Unlimited` : `${count} / ${limit}`}
        </span>
      </div>
      {limit != null && (
        <Progress
          value={percent}
          aria-label={`${label} usage: ${count} of ${limit}`}
          className={cn('h-2', atLimit && '[&>div]:bg-destructive')}
        />
      )}
      {atLimit && (
        <p className="text-xs text-destructive">
          Free tier limit reached ({limit} {label.toLowerCase()} max). Upgrade to Premium for unlimited.
        </p>
      )}
    </div>
  );
}
