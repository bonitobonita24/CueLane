// Wave 7.7a-T3 — Admin Dashboard landing. daily/monthly/yearly range toggle, 8 KPI cards,
// completion/no-show rate bars, and (Premium tier only) hourly-traffic chart + per-transaction
// breakdown + employee-performance timing table. Per-window cards + the searchable ticket log are
// visible on every tier. Data via the vanilla tRPC client (no react-query provider in this app —
// matches services-client.tsx's pattern). tenant-agnostic: never sends/derives a tenantId — every
// procedure resolves it server-side from the caller's session.
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { ColumnDef } from '@tanstack/react-table';
import { createClient } from '@/lib/trpc';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Progress,
  Skeleton,
} from '@cuelane/ui';
import { ToggleGroup, ToggleGroupItem } from '@cuelane/ui/toggle-group';
import { DataTable } from './_components/DataTable';
import { KpiCard } from './_components/KpiCard';
import { HourlyTrafficChart } from './_components/HourlyTrafficChart';
import { formatDurationSec, formatPercent } from './_lib/format';

type DashboardRange = 'daily' | 'monthly' | 'yearly';

interface DashboardData {
  ticketsIssued: number;
  completed: number;
  waitingNow: number;
  servingNow: number;
  noShows: number;
  skipped: number;
  transferred: number;
  avgWaitSec: number;
  completionRate: number;
  noShowRate: number;
  hourlyTraffic: { hour: number; count: number }[];
  perService: { serviceId: string; serviceName: string; issued: number; completed: number; avgWaitSec: number }[];
  perWindow: { windowId: string; windowName: string; served: number }[];
  employeePerformance: {
    userId: string;
    userName: string;
    served: number;
    avgServiceSec: number;
    fastestSec: number;
    slowestSec: number;
    avgIdleSec: number;
  }[];
  tier: string;
}

interface TicketLogRow {
  id: string;
  number: string;
  serviceName: string;
  status: string;
  windowLabel: string | null;
  createdAt: string | Date;
  calledAt: string | Date | null;
  completedAt: string | Date | null;
}

const client = createClient('/api/trpc');

const RANGE_OPTIONS: { value: DashboardRange; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

const ticketLogColumns: ColumnDef<TicketLogRow>[] = [
  { accessorKey: 'number', header: 'Ticket #' },
  { accessorKey: 'serviceName', header: 'Service' },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <Badge variant="secondary">{row.original.status}</Badge>,
  },
  {
    id: 'windowLabel',
    header: 'Window',
    cell: ({ row }) => row.original.windowLabel ?? '—',
  },
  {
    id: 'createdAt',
    header: 'Issued',
    cell: ({ row }) => new Date(row.original.createdAt).toLocaleString(),
  },
];

export function DashboardClient() {
  const [range, setRange] = useState<DashboardRange>('daily');
  const [data, setData] = useState<DashboardData | null>(null);
  const [ticketLog, setTicketLog] = useState<TicketLogRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [logLoading, setLogLoading] = useState(true);

  const refreshDashboard = useCallback(async (r: DashboardRange) => {
    const result = await client.dashboard.get.query({ range: r });
    setData(result);
  }, []);

  const refreshTicketLog = useCallback(async (r: DashboardRange, s: string) => {
    const rows = await client.dashboard.ticketLog.query({ range: r, search: s === '' ? undefined : s });
    setTicketLog(rows);
  }, []);

  useEffect(() => {
    setLoading(true);
    refreshDashboard(range)
      .catch(() => toast.error('Failed to load dashboard.'))
      .finally(() => setLoading(false));
  }, [range, refreshDashboard]);

  useEffect(() => {
    setLogLoading(true);
    const handle = setTimeout(() => {
      refreshTicketLog(range, search)
        .catch(() => toast.error('Failed to load ticket log.'))
        .finally(() => setLogLoading(false));
    }, 250); // debounce search keystrokes
    return () => clearTimeout(handle);
  }, [range, search, refreshTicketLog]);

  const isPremium = data?.tier === 'premium';

  const kpiCards = useMemo(() => {
    if (data == null) return [];
    return [
      { label: 'Issued', value: String(data.ticketsIssued) },
      { label: 'Completed', value: String(data.completed) },
      { label: 'Waiting Now', value: String(data.waitingNow) },
      { label: 'Serving Now', value: String(data.servingNow) },
      { label: 'No Shows', value: String(data.noShows) },
      { label: 'Skipped', value: String(data.skipped) },
      { label: 'Transferred', value: String(data.transferred) },
      { label: 'Avg Wait', value: formatDurationSec(data.avgWaitSec) },
    ];
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Dashboard</h2>
        <ToggleGroup
          type="single"
          value={range}
          onValueChange={(v) => v && setRange(v as DashboardRange)}
          variant="outline"
        >
          {RANGE_OPTIONS.map((opt) => (
            <ToggleGroupItem key={opt.value} value={opt.value} aria-label={opt.label}>
              {opt.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {loading || data == null ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : (
        <>
          <div
            key={`kpis-${range}`}
            className="grid grid-cols-2 gap-4 sm:grid-cols-4 motion-safe:animate-in motion-safe:fade-in motion-reduce:animate-none"
          >
            {kpiCards.map((k) => (
              <KpiCard key={k.label} label={k.label} value={k.value} />
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Completion Rate</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                <p className="text-sm font-semibold tabular-nums">{formatPercent(data.completionRate)}</p>
                <Progress value={data.completionRate * 100} aria-label="Completion rate" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">No-Show Rate</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                <p className="text-sm font-semibold tabular-nums">{formatPercent(data.noShowRate)}</p>
                <Progress value={data.noShowRate * 100} aria-label="No-show rate" className="[&>div]:bg-destructive" />
              </CardContent>
            </Card>
          </div>

          {isPremium && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Hourly Traffic</CardTitle>
              </CardHeader>
              <CardContent>
                <HourlyTrafficChart data={data.hourlyTraffic} />
              </CardContent>
            </Card>
          )}

          {isPremium && data.perService.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Per-Transaction Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {data.perService.map((svc) => (
                  <div key={svc.serviceId} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{svc.serviceName}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {svc.completed}/{svc.issued} completed · avg wait {formatDurationSec(svc.avgWaitSec)}
                      </span>
                    </div>
                    <Progress value={svc.issued > 0 ? (svc.completed / svc.issued) * 100 : 0} />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {data.perWindow.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-3">
              {data.perWindow.map((w) => (
                <Card key={w.windowId}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{w.windowName}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold tabular-nums">{w.served}</p>
                    <p className="text-xs text-muted-foreground">served</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {isPremium && data.employeePerformance.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Employee Performance</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 pr-4 font-medium">Employee</th>
                      <th className="py-2 pr-4 font-medium">Served</th>
                      <th className="py-2 pr-4 font-medium">Avg Service</th>
                      <th className="py-2 pr-4 font-medium">Fastest</th>
                      <th className="py-2 pr-4 font-medium">Slowest</th>
                      <th className="py-2 pr-4 font-medium">Avg Idle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.employeePerformance.map((e) => (
                      <tr key={e.userId} className="border-b last:border-0">
                        <td className="py-2 pr-4">{e.userName}</td>
                        <td className="py-2 pr-4 tabular-nums">{e.served}</td>
                        <td className="py-2 pr-4 tabular-nums">{formatDurationSec(e.avgServiceSec)}</td>
                        <td className="py-2 pr-4 tabular-nums">{formatDurationSec(e.fastestSec)}</td>
                        <td className="py-2 pr-4 tabular-nums">{formatDurationSec(e.slowestSec)}</td>
                        <td className="py-2 pr-4 tabular-nums">{formatDurationSec(e.avgIdleSec)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-sm font-medium">Ticket Log</CardTitle>
          <Input
            placeholder="Search ticket # or service…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
        </CardHeader>
        <CardContent>
          <DataTable
            columns={ticketLogColumns}
            data={ticketLog}
            emptyMessage={logLoading ? 'Loading…' : 'No tickets in this range.'}
          />
        </CardContent>
      </Card>
    </div>
  );
}
