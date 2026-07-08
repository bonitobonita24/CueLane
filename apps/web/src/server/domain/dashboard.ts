// Wave 7.7a-T1 — Dashboard domain module. Computes Admin Dashboard KPIs for a tenant over a
// range window ('daily' | 'monthly' | 'yearly'), server-local-tz boundaries (consistent with the
// rest of the codebase's date handling — see queue.ts's `todayKey` comment for the sibling UTC
// convention used by the ticket-numbering daily reset; this dashboard uses SERVER LOCAL time
// since it is a human-facing reporting surface, not a numbering key). Mirrors the L2/L6 `Db`
// param convention from domain/admin.ts and domain/queue.ts: callers pass a transaction/db
// client and this module filters `tenantId` explicitly on every query — never trust an implicit
// tenant scope.
//
// Anti-slop note (owner rule): exactly 8 KPIs + 2 rates + 4 breakdown blocks are computed here —
// do not invent additional metrics. See the Wave 7.7a-T1 prompt for the authoritative list.

import type { Prisma, PrismaClient } from '@cuelane/db';

type Db = Prisma.TransactionClient | PrismaClient;

export type DashboardRange = 'daily' | 'monthly' | 'yearly';

export interface DashboardInput {
  range: DashboardRange;
}

export interface RangeBounds {
  start: Date;
  end: Date;
}

/**
 * `[start, end)` window for the given range, anchored to `now` (defaults to the real clock —
 * callers may pass a fixed `now` for deterministic tests). Server-local tz throughout (no UTC
 * conversion) — daily = today 00:00 -> tomorrow 00:00; monthly = 1st -> next 1st; yearly =
 * Jan 1 -> next Jan 1.
 */
export function getRangeBounds(range: DashboardRange, now: Date = new Date()): RangeBounds {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();

  switch (range) {
    case 'daily':
      return { start: new Date(y, m, d), end: new Date(y, m, d + 1) };
    case 'monthly':
      return { start: new Date(y, m, 1), end: new Date(y, m + 1, 1) };
    case 'yearly':
      return { start: new Date(y, 0, 1), end: new Date(y + 1, 0, 1) };
  }
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function safeDiv(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

export interface HourlyBucket {
  hour: number; // 0-23, server-local hour
  count: number;
}

export interface PerServiceMetric {
  serviceId: string;
  serviceName: string;
  issued: number;
  completed: number;
  avgWaitSec: number;
}

export interface PerWindowMetric {
  windowId: string;
  windowName: string;
  served: number;
}

export interface EmployeeMetric {
  userId: string;
  userName: string;
  served: number;
  avgServiceSec: number;
  fastestSec: number;
  slowestSec: number;
  avgIdleSec: number;
}

export interface DashboardResult {
  // ── 8 KPIs ──────────────────────────────────────────────────────────────
  ticketsIssued: number;
  completed: number;
  waitingNow: number; // LIVE — ignores range
  servingNow: number; // LIVE — ignores range
  noShows: number;
  skipped: number;
  transferred: number;
  avgWaitSec: number;
  // ── rates ───────────────────────────────────────────────────────────────
  completionRate: number; // 0 if ticketsIssued=0
  noShowRate: number; // 0 if ticketsIssued=0
  // ── breakdowns ──────────────────────────────────────────────────────────
  hourlyTraffic: HourlyBucket[]; // 24 buckets, index = hour
  perService: PerServiceMetric[];
  perWindow: PerWindowMetric[];
  employeePerformance: EmployeeMetric[];
}

interface TicketSlice {
  id: string;
  status: string;
  transferred: boolean;
  serviceId: string;
  windowId: string | null;
  servedBy: string | null;
  createdAt: Date;
  calledAt: Date | null;
  completedAt: Date | null;
}

/**
 * Computes the full Admin Dashboard KPI set for `tenantId` over `input.range`. `now` is an
 * optional deterministic clock override for tests — production callers omit it (defaults to the
 * real clock). Uses the passed `db` (L6 tenant-scoped in production via the caller's
 * `withTenantContext`) — never constructs a raw client itself.
 */
export async function computeDashboard(
  db: Db,
  tenantId: string,
  input: DashboardInput,
  now: Date = new Date(),
): Promise<DashboardResult> {
  const { start, end } = getRangeBounds(input.range, now);

  const [rangeTickets, waitingNow, servingNow, services, windows, users] = await Promise.all([
    db.ticket.findMany({
      where: { tenantId, createdAt: { gte: start, lt: end } },
      select: {
        id: true,
        status: true,
        transferred: true,
        serviceId: true,
        windowId: true,
        servedBy: true,
        createdAt: true,
        calledAt: true,
        completedAt: true,
      },
    }) as Promise<TicketSlice[]>,
    db.ticket.count({ where: { tenantId, status: 'waiting' } }),
    db.ticket.count({ where: { tenantId, status: 'serving' } }),
    db.service.findMany({ where: { tenantId }, select: { id: true, name: true } }),
    db.window.findMany({ where: { tenantId }, select: { id: true, name: true } }),
    db.user.findMany({ where: { tenantId }, select: { id: true, name: true } }),
  ]);

  const serviceNameById = new Map(services.map((s) => [s.id, s.name]));
  const windowNameById = new Map(windows.map((w) => [w.id, w.name]));
  const userNameById = new Map(users.map((u) => [u.id, u.name]));

  const ticketsIssued = rangeTickets.length;
  const completed = rangeTickets.filter((t) => t.status === 'completed').length;
  const noShows = rangeTickets.filter((t) => t.status === 'noshow').length;
  const skipped = rangeTickets.filter((t) => t.status === 'skipped').length;
  const transferred = rangeTickets.filter((t) => t.transferred).length;

  const waitSecs = rangeTickets
    .filter((t) => t.calledAt != null)
    .map((t) => (t.calledAt!.getTime() - t.createdAt.getTime()) / 1000);
  const avgWaitSec = avg(waitSecs);

  const completionRate = safeDiv(completed, ticketsIssued);
  const noShowRate = safeDiv(noShows, ticketsIssued);

  const hourlyBuckets: number[] = new Array<number>(24).fill(0);
  for (const t of rangeTickets) {
    const hour = t.createdAt.getHours();
    hourlyBuckets[hour] = (hourlyBuckets[hour] ?? 0) + 1;
  }
  const hourlyTraffic: HourlyBucket[] = hourlyBuckets.map((count, hour) => ({ hour, count }));

  const serviceIds = Array.from(new Set(rangeTickets.map((t) => t.serviceId)));
  const perService: PerServiceMetric[] = serviceIds.map((serviceId) => {
    const forSvc = rangeTickets.filter((t) => t.serviceId === serviceId);
    const svcCompleted = forSvc.filter((t) => t.status === 'completed').length;
    const svcWaits = forSvc
      .filter((t) => t.calledAt != null)
      .map((t) => (t.calledAt!.getTime() - t.createdAt.getTime()) / 1000);
    return {
      serviceId,
      serviceName: serviceNameById.get(serviceId) ?? 'Unknown',
      issued: forSvc.length,
      completed: svcCompleted,
      avgWaitSec: avg(svcWaits),
    };
  });

  const windowIds = Array.from(
    new Set(rangeTickets.map((t) => t.windowId).filter((w): w is string => w != null)),
  );
  const perWindow: PerWindowMetric[] = windowIds.map((windowId) => ({
    windowId,
    windowName: windowNameById.get(windowId) ?? 'Unknown',
    served: rangeTickets.filter((t) => t.windowId === windowId).length,
  }));

  const employeeIds = Array.from(
    new Set(rangeTickets.map((t) => t.servedBy).filter((u): u is string => u != null)),
  );
  const employeePerformance: EmployeeMetric[] = employeeIds.map((userId) => {
    const forUser = rangeTickets.filter((t) => t.servedBy === userId);
    const served = forUser.length;

    const withCompletion = forUser.filter((t) => t.calledAt != null && t.completedAt != null);
    const serviceSecs = withCompletion.map(
      (t) => (t.completedAt!.getTime() - t.calledAt!.getTime()) / 1000,
    );
    const avgServiceSec = avg(serviceSecs);
    const fastestSec = serviceSecs.length > 0 ? Math.min(...serviceSecs) : 0;
    const slowestSec = serviceSecs.length > 0 ? Math.max(...serviceSecs) : 0;

    const calledTimes = forUser
      .filter((t) => t.calledAt != null)
      .map((t) => t.calledAt!.getTime())
      .sort((a, b) => a - b);
    const gaps: number[] = [];
    for (let i = 1; i < calledTimes.length; i++) {
      gaps.push((calledTimes[i]! - calledTimes[i - 1]!) / 1000);
    }
    const avgIdleSec = avg(gaps);

    return {
      userId,
      userName: userNameById.get(userId) ?? 'Unknown',
      served,
      avgServiceSec,
      fastestSec,
      slowestSec,
      avgIdleSec,
    };
  });

  return {
    ticketsIssued,
    completed,
    waitingNow,
    servingNow,
    noShows,
    skipped,
    transferred,
    avgWaitSec,
    completionRate,
    noShowRate,
    hourlyTraffic,
    perService,
    perWindow,
    employeePerformance,
  };
}
