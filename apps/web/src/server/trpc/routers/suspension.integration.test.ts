// Wave 7.8-T2 — suspension enforcement (TDD). A `suspended` tenant (Super Admin action) must be
// blocked on EVERY one of its own tenant surfaces, enforced uniformly at the tenant-resolution
// layer: kioskProcedure (unauth kiosk/display — pre-existing, verified here for completeness),
// adminProcedure (Admin Panel — trpc.ts's `assertTenantActive`), and staffProcedure (Employee
// Station — queue.ts). An active tenant must be entirely unaffected by another tenant's suspension.
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

describe('Suspension enforcement (Wave 7.8-T2)', () => {
  let suspendedTenantId: string;
  let suspendedAdminId: string;
  let suspendedEmployeeId: string;
  let activeTenantId: string;
  let activeAdminId: string;

  beforeAll(async () => {
    const suspended = await prismaRaw.tenant.create({
      data: {
        slug: `test-susp-${Date.now()}`,
        companyName: 'Suspended Co.',
        tagline: 'x',
        tier: 'free',
        status: 'suspended',
      },
    });
    suspendedTenantId = suspended.id;
    suspendedAdminId = (
      await prismaRaw.user.create({ data: { tenantId: suspendedTenantId, name: 'Susp Admin', role: 'tenant_superadmin', pin: 'x' } })
    ).id;
    suspendedEmployeeId = (
      await prismaRaw.user.create({ data: { tenantId: suspendedTenantId, name: 'Susp Employee', role: 'employee', pin: 'x' } })
    ).id;

    const active = await prismaRaw.tenant.create({
      data: { slug: `test-active-${Date.now()}`, companyName: 'Active Co.', tagline: 'x', tier: 'free', status: 'active' },
    });
    activeTenantId = active.id;
    activeAdminId = (
      await prismaRaw.user.create({ data: { tenantId: activeTenantId, name: 'Active Admin', role: 'tenant_superadmin', pin: 'x' } })
    ).id;
  });

  afterAll(async () => {
    await prismaRaw.tenant.deleteMany({ where: { id: { in: [suspendedTenantId, activeTenantId] } } });
  });

  it('a suspended tenant admin is FORBIDDEN on adminProcedure-backed calls', async () => {
    const admin = adminCallerFor(suspendedTenantId, suspendedAdminId);
    await expect(admin.tenantAdmin.getSettings()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(admin.tenantAdmin.getUsage()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('a suspended tenant employee is FORBIDDEN on staffProcedure-backed calls (Employee Station)', async () => {
    const employee = employeeCallerFor(suspendedTenantId, suspendedEmployeeId);
    await expect(employee.queue.listWaiting()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(employee.queue.nowServing()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('kioskProcedure (unauth ticket issuance) is FORBIDDEN for a suspended tenant', async () => {
    const anon = createCaller(ctxFor({}));
    const suspendedTenant = await prismaRaw.tenant.findUniqueOrThrow({ where: { id: suspendedTenantId } });
    await expect(
      anon.queue.issue({ tenantSlug: suspendedTenant.slug, serviceId: 'c0000000000000000000000000' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('an ACTIVE tenant is entirely unaffected by another tenant being suspended', async () => {
    const admin = adminCallerFor(activeTenantId, activeAdminId);
    await expect(admin.tenantAdmin.getSettings()).resolves.toBeDefined();
    await expect(admin.tenantAdmin.getUsage()).resolves.toBeDefined();
  });
});
