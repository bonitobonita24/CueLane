// Wave 7.6-T3 — serviceRouter tRPC tests (TDD: written before the router implementation).
// Runs against the REAL dev Postgres DB via createCaller — no mocks — using two FRESH ephemeral
// Free-tier fixture tenants (never the seeded `demo` tenant, never a hardcoded id/slug) so this
// proves tenant-agnosticism: a brand-new tenant needs zero bootstrapping beyond the normal create
// path exercised below.
//
// CRITICAL testing rule: every caller below is a tenant-ADMIN session (never super_admin) —
// see the Wave 7.6 task brief's "hidden bugs behind super-admin-only testing" lesson.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NextRequest } from 'next/server';
import { prismaRaw } from '@cuelane/db';
import { Role, SERVICE_ICON_OPTIONS, SERVICE_COLOR_OPTIONS } from '@cuelane/shared';
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

describe('serviceRouter (Wave 7.6-T3)', () => {
  let tenantAId: string;
  let adminAId: string;
  let employeeAId: string;

  let tenantBId: string;
  let adminBId: string;

  beforeAll(async () => {
    const tenantA = await prismaRaw.tenant.create({
      data: { slug: `test-svc-a-${Date.now()}`, companyName: 'Svc Tenant A', tagline: 'x', tier: 'free' },
    });
    tenantAId = tenantA.id;
    adminAId = (await prismaRaw.user.create({ data: { tenantId: tenantAId, name: 'Admin A', role: 'tenant_superadmin', pin: 'x' } })).id;
    employeeAId = (await prismaRaw.user.create({ data: { tenantId: tenantAId, name: 'Emp A', role: 'employee', pin: 'x' } })).id;

    const tenantB = await prismaRaw.tenant.create({
      data: { slug: `test-svc-b-${Date.now()}`, companyName: 'Svc Tenant B', tagline: 'x', tier: 'free' },
    });
    tenantBId = tenantB.id;
    adminBId = (await prismaRaw.user.create({ data: { tenantId: tenantBId, name: 'Admin B', role: 'tenant_superadmin', pin: 'x' } })).id;
  });

  afterAll(async () => {
    await prismaRaw.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } });
  });

  it('auto-numbers services 1..N for a brand-new tenant and lists them ordered by number', async () => {
    const admin = adminCallerFor(tenantAId, adminAId);
    const s1 = await admin.service.create({ name: 'Svc 1', icon: SERVICE_ICON_OPTIONS[0], color: SERVICE_COLOR_OPTIONS[0], avgTime: 5 });
    const s2 = await admin.service.create({ name: 'Svc 2', icon: SERVICE_ICON_OPTIONS[1], color: SERVICE_COLOR_OPTIONS[1], avgTime: 10 });
    expect(s1.number).toBe(1);
    expect(s2.number).toBe(2);

    const list = await admin.service.list();
    expect(list.map((s) => s.number)).toEqual([1, 2]);
  });

  it('blocks the 7th service create on a free tenant (already has 2, needs 4 more to hit 6)', async () => {
    const admin = adminCallerFor(tenantAId, adminAId);
    for (let i = 0; i < 4; i++) {
      await admin.service.create({ name: `Fill ${i}`, icon: SERVICE_ICON_OPTIONS[2], color: SERVICE_COLOR_OPTIONS[2], avgTime: 5 });
    }
    // tenantAId now has exactly 6 services (2 from the previous test + 4 here).
    const list = await admin.service.list();
    expect(list.length).toBe(6);

    await expect(
      admin.service.create({ name: 'Overflow', icon: SERVICE_ICON_OPTIONS[3], color: SERVICE_COLOR_OPTIONS[3], avgTime: 5 }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('tenant B (a separate fresh tenant) is unaffected by tenant A being at its cap', async () => {
    const adminB = adminCallerFor(tenantBId, adminBId);
    const svc = await adminB.service.create({ name: 'B Svc 1', icon: SERVICE_ICON_OPTIONS[0], color: SERVICE_COLOR_OPTIONS[0], avgTime: 5 });
    expect(svc.number).toBe(1);
    const list = await adminB.service.list();
    expect(list.length).toBe(1);
  });

  it('update/delete guard cross-tenant access — tenant B admin cannot touch tenant A services', async () => {
    const adminA = adminCallerFor(tenantAId, adminAId);
    const adminB = adminCallerFor(tenantBId, adminBId);
    const [svcA] = await adminA.service.list();
    expect(svcA).toBeDefined();

    await expect(adminB.service.update({ id: svcA!.id, name: 'Hijacked' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(adminB.service.delete({ id: svcA!.id })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('an Employee-role caller is rejected with FORBIDDEN', async () => {
    const employee = employeeCallerFor(tenantAId, employeeAId);
    await expect(
      employee.service.create({ name: 'Nope', icon: SERVICE_ICON_OPTIONS[0], color: SERVICE_COLOR_OPTIONS[0], avgTime: 5 }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(employee.service.list()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('same-tenant admin can update and delete its own service', async () => {
    const admin = adminCallerFor(tenantBId, adminBId);
    const [svc] = await admin.service.list();
    expect(svc).toBeDefined();

    const updated = await admin.service.update({ id: svc!.id, name: 'Renamed' });
    expect(updated.name).toBe('Renamed');

    const deleted = await admin.service.delete({ id: svc!.id });
    expect(deleted.id).toBe(svc!.id);

    const listAfter = await admin.service.list();
    expect(listAfter.find((s) => s.id === svc!.id)).toBeUndefined();
  });
});
