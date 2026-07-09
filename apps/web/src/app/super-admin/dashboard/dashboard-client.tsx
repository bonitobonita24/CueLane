// Wave 7.8-T3 — Super Admin platform analytics. Vanilla tRPC proxy (no react-query provider —
// same convention as [tenant]/admin/dashboard-client.tsx). Every KPI is pinned to an exact
// `superAdmin.platformStats` field — no invented metrics (design anti-slop D6).
'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from '@cuelane/ui';
import { KpiCard } from '../_components/KpiCard';
import { TenantsByTierChart } from '../_components/TenantsByTierChart';

interface PlatformStats {
  totalTenants: number;
  tenantsByTier: { tier: string; _count: { _all: number } }[];
  tenantsByStatus: { status: string; _count: { _all: number } }[];
  totalUsers: number;
  totalTicketsAllTime: number;
  totalTicketsToday: number;
}

const client = createClient('/api/trpc');

export function DashboardClient() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.superAdmin.platformStats
      .query()
      .then(setStats)
      .catch(() => toast.error('Failed to load platform stats.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading || stats == null) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  const suspendedCount = stats.tenantsByStatus.find((r) => r.status === 'suspended')?._count._all ?? 0;
  const activeCount = stats.tenantsByStatus.find((r) => r.status === 'active')?._count._all ?? 0;

  const kpis = [
    { label: 'Total Tenants', value: String(stats.totalTenants) },
    { label: 'Active Tenants', value: String(activeCount) },
    { label: 'Suspended Tenants', value: String(suspendedCount) },
    { label: 'Total Users (all tenants)', value: String(stats.totalUsers) },
    { label: 'Tickets Today (all tenants)', value: String(stats.totalTicketsToday) },
    { label: 'Tickets All-Time (all tenants)', value: String(stats.totalTicketsAllTime) },
  ];

  const tierChartData = stats.tenantsByTier.map((r) => ({ tier: r.tier, count: r._count._all }));

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold tracking-tight">Platform Analytics</h2>

      <div
        key="platform-kpis"
        className="grid grid-cols-2 gap-4 sm:grid-cols-3 motion-safe:animate-in motion-safe:fade-in motion-reduce:animate-none"
      >
        {kpis.map((k) => (
          <KpiCard key={k.label} label={k.label} value={k.value} />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Tenants by Tier</CardTitle>
        </CardHeader>
        <CardContent>
          <TenantsByTierChart data={tierChartData} />
        </CardContent>
      </Card>
    </div>
  );
}
