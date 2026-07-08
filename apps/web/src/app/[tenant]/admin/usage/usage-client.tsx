// Wave 7.6-T7 — Usage overview: full UsageMeter per limited entity, sourced from
// `tenantAdmin.getUsage` (services/windows/users vs. TIER_LIMITS).
'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/trpc';
import { Badge } from '@cuelane/ui';
import { TenantTier } from '@cuelane/shared';
import { UsageMeter } from '../_components/UsageMeter';

interface EntityUsage {
  count: number;
  limit: number | null;
}

interface UsageState {
  tier: TenantTier;
  users: EntityUsage;
  services: EntityUsage;
  windows: EntityUsage;
}

const client = createClient('/api/trpc');

export function UsageClient() {
  const [usage, setUsage] = useState<UsageState | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const result = await client.tenantAdmin.getUsage.query();
    setUsage(result);
  }, []);

  useEffect(() => {
    setLoading(true);
    refresh()
      .catch(() => toast.error('Failed to load usage.'))
      .finally(() => setLoading(false));
  }, [refresh]);

  if (loading || usage == null) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="max-w-lg space-y-6">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Plan:</span>
        <Badge variant={usage.tier === TenantTier.Premium ? 'default' : 'secondary'}>
          {usage.tier === TenantTier.Premium ? 'Premium' : 'Free'}
        </Badge>
      </div>

      <div className="space-y-5 rounded-md border p-4">
        <UsageMeter label="Services" count={usage.services.count} limit={usage.services.limit} />
        <UsageMeter label="Windows" count={usage.windows.count} limit={usage.windows.limit} />
        <UsageMeter label="Users" count={usage.users.count} limit={usage.users.limit} />
      </div>
    </div>
  );
}
