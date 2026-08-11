// Wave 7.7a-T2 — dashboardRouter tRPC tests (TDD). Fresh ephemeral tenants (never `demo`), every
// caller a tenant-ADMIN session (never super_admin — this wave's non-negotiable testing rule).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NextRequest } from 'next/server';
import { prismaRaw } from '@cuelane/db';
import { Role } from '@cuelane/shared';
import { appRouter } from '../root';
import { createCallerFactory } from '../trpc';
import type { Context } from '../context';

const createCaller = createCallerFactory(appRouter);

function fakeReq(): NextRequest {
  return { headers: new Headers() } as unknown as NextRequest;
}
function ctxFor(overrides: Partial<Context>): Context {
  return { session: null, userId: null, roles: [], tenantId: null, req: fakeReq(), ...overrides };
}
function adminCallerFor(tenantId: string, userId: string) {
  return createCaller(
    ctxFor({ session: { user: { id: userId } } as unknown as Context['session'], userId, roles: [Role.TenantSuperadmin], tenantId }),
  );
}
function employeeCallerFor(tenantId: string, userId: string) {
  return createCaller(
    ctxFor({ session: { user: { id: userId } } as unknown as Context['session'], userId, roles: [Role.Employee], tenantId }),
  );
}
function unauthedCaller() {
  return createCaller(ctxFor({}));
}

describe('dashboardRouter (Wave 7.7a-T2)', () => {
  let tenantAId: string;
  let adminAId: string;
  let employeeAId: string;
  let serviceAId: string;

  let tenantBId: string;
  let adminBId: string;
  let serviceBId: string;

  beforeAll(async () => {
    const tenantA = await prismaRaw.tenant.create({
      data: { slug: `test-dboard-a-${Date.now()}`, companyName: 'Dboard A Co.', tagline: 'x', tier: 'premium' },
    });
    tenantAId = tenantA.id;
    adminAId = (await prismaRaw.user.create({ data: { tenantId: tenantAId, name: 'Admin A', role: 'tenant_superadmin', pin: 'x' } })).id;
    employeeAId = (await prismaRaw.user.create({ data: { tenantId: tenantAId, name: 'Emp A', role: 'employee', pin: 'x' } })).id;
    serviceAId = (
      await prismaRaw.service.create({ data: { tenantId: tenantAId, number: 1, name: 'Service A1', icon: 'A', color: '#111111', avgTime: 5 } })
    ).id;

    const tenantB = await prismaRaw.tenant.create({
      data: { slug: `test-dboard-b-${Date.now()}`, companyName: 'Dboard B Co.', tagline: 'x', tier: 'free' },
    });
    tenantBId = tenantB.id;
    adminBId = (await prismaRaw.user.create({ data: { tenantId: tenantBId, name: 'Admin B', role: 'tenant_superadmin', pin: 'x' } })).id;
    serviceBId = (
      await prismaRaw.service.create({ data: { tenantId: tenantBId, number: 1, name: 'Service B1', icon: 'B', color: '#222222', avgTime: 5 } })
    ).id;

    // Tenant A: 3 tickets issued today, 1 completed
    await prismaRaw.ticket.create({
      data: { tenantId: tenantAId, serviceId: serviceAId, number: '1', sequence: 1, status: 'waiting' },
    });
    await prismaRaw.ticket.create({
      data: { tenantId: tenantAId, serviceId: serviceAId, number: '2', sequence: 2, status: 'completed', calledAt: new Date(), completedAt: new Date(), servedBy: employeeAId },
    });
    await prismaRaw.ticket.create({
      data: { tenantId: tenantAId, serviceId: serviceAId, number: '3', sequence: 3, status: 'noshow' },
    });

    // Tenant B: 1 ticket issued today
    await prismaRaw.ticket.create({
      data: { tenantId: tenantBId, serviceId: serviceBId, number: '1', sequence: 1, status: 'waiting' },
    });
  });

  afterAll(async () => {
    await prismaRaw.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } });
  });

  it('get returns coherent KPIs + tier for an Admin session', async () => {
    const admin = adminCallerFor(tenantAId, adminAId);
    const result = await admin.dashboard.get({ range: 'daily' });
    expect(result.tier).toBe('premium');
    expect(result.ticketsIssued).toBe(3);
    expect(result.completed).toBe(1);
    expect(result.noShows).toBe(1);
    expect(result.waitingNow).toBe(1);
  });

  it('get is UNAUTHORIZED without a session', async () => {
    const caller = unauthedCaller();
    await expect(caller.dashboard.get({ range: 'daily' })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('get is FORBIDDEN for a non-Admin (Employee) caller', async () => {
    const employee = employeeCallerFor(tenantAId, employeeAId);
    await expect(employee.dashboard.get({ range: 'daily' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('tenant isolation — Tenant A and Tenant B each see only their own counts', async () => {
    const adminA = adminCallerFor(tenantAId, adminAId);
    const adminB = adminCallerFor(tenantBId, adminBId);

    const [resultA, resultB] = await Promise.all([
      adminA.dashboard.get({ range: 'daily' }),
      adminB.dashboard.get({ range: 'daily' }),
    ]);

    expect(resultA.ticketsIssued).toBe(3);
    expect(resultA.tier).toBe('premium');
    expect(resultB.ticketsIssued).toBe(1);
    expect(resultB.tier).toBe('free');
  });

  it('ticketLog returns range-scoped rows and supports a case-insensitive search', async () => {
    const admin = adminCallerFor(tenantAId, adminAId);
    const all = await admin.dashboard.ticketLog({ range: 'daily' });
    expect(all.length).toBe(3);

    const searched = await admin.dashboard.ticketLog({ range: 'daily', search: 'service a1' });
    expect(searched.length).toBe(3); // all 3 tickets belong to "Service A1"

    const noMatch = await admin.dashboard.ticketLog({ range: 'daily', search: 'no-such-service-xyz' });
    expect(noMatch.length).toBe(0);
  });

  it('ticketLog is tenant-scoped — Tenant B admin never sees Tenant A rows', async () => {
    const adminB = adminCallerFor(tenantBId, adminBId);
    const rows = await adminB.dashboard.ticketLog({ range: 'daily' });
    expect(rows.length).toBe(1);
    expect(rows[0]!.serviceName).toBe('Service B1');
  });
});
