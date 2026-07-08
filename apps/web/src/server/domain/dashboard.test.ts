// Wave 7.7a-T1 — dashboard domain unit tests (TDD: written before/alongside dashboard.ts).
// Runs against the REAL dev Postgres DB (no mocks), in an isolated ephemeral fixture tenant —
// torn down in afterAll. All ticket timestamps are anchored to `getRangeBounds('daily').start`
// (not to `Date.now()`) so the expected KPI math is deterministic regardless of what time of day
// this suite actually runs.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prismaRaw } from '@cuelane/db';
import { computeDashboard, getRangeBounds } from './dashboard';

describe('dashboard domain (Wave 7.7a-T1)', () => {
  let tenantId: string;
  let serviceAId: string;
  let serviceBId: string;
  let windowId: string;
  let employeeId: string;
  const now = new Date();
  const { start } = getRangeBounds('daily', now);

  function at(offsetSec: number): Date {
    return new Date(start.getTime() + offsetSec * 1000);
  }

  beforeAll(async () => {
    const tenant = await prismaRaw.tenant.create({
      data: { slug: `test-dashboard-${Date.now()}`, companyName: 'Dashboard Test Co.', tagline: 'x', tier: 'premium' },
    });
    tenantId = tenant.id;

    const serviceA = await prismaRaw.service.create({
      data: { tenantId, number: 1, name: 'Service A', icon: 'A', color: '#111111', avgTime: 5 },
    });
    serviceAId = serviceA.id;
    const serviceB = await prismaRaw.service.create({
      data: { tenantId, number: 2, name: 'Service B', icon: 'B', color: '#222222', avgTime: 5 },
    });
    serviceBId = serviceB.id;

    const window = await prismaRaw.window.create({ data: { tenantId, name: 'Window 1' } });
    windowId = window.id;

    const employee = await prismaRaw.user.create({
      data: { tenantId, name: 'Employee 1', role: 'employee', pin: 'x' },
    });
    employeeId = employee.id;

    // ── The 7-ticket fixture (see Wave 7.7a-T1 prompt design notes) ─────────
    // ticket1: waiting, serviceId=A
    await prismaRaw.ticket.create({
      data: {
        tenantId, serviceId: serviceAId, number: '1', sequence: 1, status: 'waiting',
        createdAt: at(600),
      },
    });
    // ticket2: serving, serviceId=A, calledAt=createdAt (wait=0s), servedBy/windowId set
    await prismaRaw.ticket.create({
      data: {
        tenantId, serviceId: serviceAId, number: '2', sequence: 2, status: 'serving',
        createdAt: at(500), calledAt: at(500), windowId, servedBy: employeeId,
      },
    });
    // ticket3: completed, serviceId=A, wait=30s, service=120s
    await prismaRaw.ticket.create({
      data: {
        tenantId, serviceId: serviceAId, number: '3', sequence: 3, status: 'completed',
        createdAt: at(0), calledAt: at(30), completedAt: at(150), windowId, servedBy: employeeId,
      },
    });
    // ticket4: completed, serviceId=B, wait=90s, service=60s
    await prismaRaw.ticket.create({
      data: {
        tenantId, serviceId: serviceBId, number: '4', sequence: 4, status: 'completed',
        createdAt: at(200), calledAt: at(290), completedAt: at(350), windowId, servedBy: employeeId,
      },
    });
    // ticket5: noshow, serviceId=B
    await prismaRaw.ticket.create({
      data: {
        tenantId, serviceId: serviceBId, number: '5', sequence: 5, status: 'noshow',
        createdAt: at(700),
      },
    });
    // ticket6: skipped, serviceId=B
    await prismaRaw.ticket.create({
      data: {
        tenantId, serviceId: serviceBId, number: '6', sequence: 6, status: 'skipped',
        createdAt: at(800),
      },
    });
    // ticket7: completed + transferred=true, serviceId=A, wait=10s, service=50s
    await prismaRaw.ticket.create({
      data: {
        tenantId, serviceId: serviceAId, number: '7', sequence: 7, status: 'completed',
        transferred: true, createdAt: at(400), calledAt: at(410), completedAt: at(460),
        windowId, servedBy: employeeId,
      },
    });
  });

  afterAll(async () => {
    await prismaRaw.tenant.delete({ where: { id: tenantId } });
  });

  it('computes the 8 KPIs correctly for range=daily', async () => {
    const result = await computeDashboard(prismaRaw, tenantId, { range: 'daily' }, now);

    expect(result.ticketsIssued).toBe(7);
    expect(result.completed).toBe(3); // tickets 3, 4, 7
    expect(result.waitingNow).toBe(1); // ticket1
    expect(result.servingNow).toBe(1); // ticket2
    expect(result.noShows).toBe(1); // ticket5
    expect(result.skipped).toBe(1); // ticket6
    expect(result.transferred).toBe(1); // ticket7
    // avgWaitSec over calledAt!=null tickets: ticket2=0, ticket3=30, ticket4=90, ticket7=10 -> 130/4
    expect(result.avgWaitSec).toBeCloseTo(32.5, 5);
  });

  it('computes completionRate + noShowRate, guarding div-by-zero', async () => {
    const result = await computeDashboard(prismaRaw, tenantId, { range: 'daily' }, now);
    expect(result.completionRate).toBeCloseTo(3 / 7, 5);
    expect(result.noShowRate).toBeCloseTo(1 / 7, 5);
  });

  it('returns 0 rates for a tenant with zero issued tickets in range', async () => {
    const emptyTenant = await prismaRaw.tenant.create({
      data: { slug: `test-dashboard-empty-${Date.now()}`, companyName: 'Empty Co.', tagline: 'x', tier: 'free' },
    });
    try {
      const result = await computeDashboard(prismaRaw, emptyTenant.id, { range: 'daily' }, now);
      expect(result.ticketsIssued).toBe(0);
      expect(result.completionRate).toBe(0);
      expect(result.noShowRate).toBe(0);
      expect(result.avgWaitSec).toBe(0);
      expect(result.hourlyTraffic).toHaveLength(24);
      expect(result.hourlyTraffic.every((b) => b.count === 0)).toBe(true);
    } finally {
      await prismaRaw.tenant.delete({ where: { id: emptyTenant.id } });
    }
  });

  it('buckets hourlyTraffic into the correct hour (all 7 tickets fall in the same hour as `start`)', async () => {
    const result = await computeDashboard(prismaRaw, tenantId, { range: 'daily' }, now);
    const expectedHour = start.getHours();
    const bucket = result.hourlyTraffic.find((b) => b.hour === expectedHour);
    expect(bucket).toBeDefined();
    expect(bucket!.count).toBe(7);
    const otherTotal = result.hourlyTraffic
      .filter((b) => b.hour !== expectedHour)
      .reduce((sum, b) => sum + b.count, 0);
    expect(otherTotal).toBe(0);
  });

  it('computes perService issued/completed/avgWaitSec per service', async () => {
    const result = await computeDashboard(prismaRaw, tenantId, { range: 'daily' }, now);
    const svcA = result.perService.find((s) => s.serviceId === serviceAId);
    const svcB = result.perService.find((s) => s.serviceId === serviceBId);

    expect(svcA).toBeDefined();
    expect(svcA!.issued).toBe(4); // tickets 1,2,3,7
    expect(svcA!.completed).toBe(2); // tickets 3,7
    // waits for A: ticket2=0, ticket3=30, ticket7=10 -> 40/3
    expect(svcA!.avgWaitSec).toBeCloseTo(40 / 3, 5);

    expect(svcB).toBeDefined();
    expect(svcB!.issued).toBe(3); // tickets 4,5,6
    expect(svcB!.completed).toBe(1); // ticket4
    expect(svcB!.avgWaitSec).toBeCloseTo(90, 5);
  });

  it('computes perWindow served count', async () => {
    const result = await computeDashboard(prismaRaw, tenantId, { range: 'daily' }, now);
    const win = result.perWindow.find((w) => w.windowId === windowId);
    expect(win).toBeDefined();
    // tickets 2,3,4,7 all carry windowId
    expect(win!.served).toBe(4);
  });

  it('computes employeePerformance timing metrics for the servedBy user', async () => {
    const result = await computeDashboard(prismaRaw, tenantId, { range: 'daily' }, now);
    const emp = result.employeePerformance.find((e) => e.userId === employeeId);
    expect(emp).toBeDefined();
    expect(emp!.served).toBe(4); // tickets 2,3,4,7

    // service durations (completedAt-calledAt) for 3,4,7: 120, 60, 50
    expect(emp!.avgServiceSec).toBeCloseTo((120 + 60 + 50) / 3, 5);
    expect(emp!.fastestSec).toBeCloseTo(50, 5);
    expect(emp!.slowestSec).toBeCloseTo(120, 5);

    // calledAt sorted ascending: ticket3=30, ticket4=290, ticket7=410, ticket2=500
    // gaps: 260, 120, 90 -> avg 156.6667
    expect(emp!.avgIdleSec).toBeCloseTo((260 + 120 + 90) / 3, 5);
  });
});
