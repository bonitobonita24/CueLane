// T5 — RBAC ownership succession tRPC tests (TDD). Covers the two succession paths:
// 1. In-tenant `user.transferOwnership` — current tenant_superadmin hands ownership to a
//    tenant_admin/employee in the SAME tenant.
// 2. Platform break-glass `platformUser.reassignOwner` — TenantManager reassigns a tenant's
//    owner cross-tenant via prismaRaw.
// Two fresh ephemeral Free tenants (never `demo`, never a hardcoded id/slug). Mirrors the
// harness conventions of user.test.ts / superAdmin.test.ts.
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
function ownerCallerFor(tenantId: string, userId: string) {
  return createCaller(
    ctxFor({ session: { user: { id: userId } } as unknown as Context['session'], userId, roles: [Role.TenantSuperadmin], tenantId }),
  );
}
function adminCallerFor(tenantId: string, userId: string) {
  return createCaller(
    ctxFor({ session: { user: { id: userId } } as unknown as Context['session'], userId, roles: [Role.TenantAdmin], tenantId }),
  );
}
function superAdminCaller() {
  return createCaller(
    ctxFor({ session: { user: { id: 'platform' } } as unknown as Context['session'], userId: 'platform', roles: [Role.TenantManager], tenantId: null }),
  );
}
// A TenantManager caller with an (impersonated) tenant context set — exercises the
// transferOwnership resolver-level guard directly (userManagementProcedure's own middleware
// would otherwise reject a null-tenantId TenantManager with UNAUTHORIZED before the resolver
// guard is ever reached).
function superAdminWithTenantCaller(tenantId: string) {
  return createCaller(
    ctxFor({ session: { user: { id: 'platform' } } as unknown as Context['session'], userId: 'platform', roles: [Role.TenantManager], tenantId }),
  );
}

async function countOwners(tenantId: string): Promise<number> {
  return prismaRaw.user.count({ where: { tenantId, role: 'tenant_superadmin' } });
}

describe('RBAC ownership succession (T5)', () => {
  let tenantAId: string;
  let ownerAId: string;
  let adminAId: string;
  let employeeAId: string;

  let tenantBId: string;
  let ownerBId: string;
  let adminBId: string;

  beforeAll(async () => {
    const tenantA = await prismaRaw.tenant.create({
      data: { slug: `test-succession-a-${Date.now()}`, companyName: 'Succession Tenant A', tagline: 'x', tier: 'free' },
    });
    tenantAId = tenantA.id;
    ownerAId = (await prismaRaw.user.create({ data: { tenantId: tenantAId, name: 'Owner A', role: 'tenant_superadmin', pin: 'x' } })).id;
    adminAId = (await prismaRaw.user.create({ data: { tenantId: tenantAId, name: 'Admin A', role: 'tenant_admin', pin: 'x' } })).id;
    employeeAId = (await prismaRaw.user.create({ data: { tenantId: tenantAId, name: 'Emp A', role: 'employee', pin: 'x' } })).id;

    const tenantB = await prismaRaw.tenant.create({
      data: { slug: `test-succession-b-${Date.now()}`, companyName: 'Succession Tenant B', tagline: 'x', tier: 'free' },
    });
    tenantBId = tenantB.id;
    ownerBId = (await prismaRaw.user.create({ data: { tenantId: tenantBId, name: 'Owner B', role: 'tenant_superadmin', pin: 'x' } })).id;
    adminBId = (await prismaRaw.user.create({ data: { tenantId: tenantBId, name: 'Admin B', role: 'tenant_admin', pin: 'x' } })).id;
  });

  afterAll(async () => {
    await prismaRaw.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } });
  });

  describe('user.transferOwnership (in-tenant)', () => {
    it('owner transfers ownership to a tenant_admin: roles swap + audit rows written + exactly one owner remains', async () => {
      const owner = ownerCallerFor(tenantAId, ownerAId);
      const result = await owner.user.transferOwnership({ newOwnerUserId: adminAId });
      expect(result.previousOwnerId).toBe(ownerAId);
      expect(result.newOwnerId).toBe(adminAId);

      const prevOwner = await prismaRaw.user.findUniqueOrThrow({ where: { id: ownerAId } });
      const newOwner = await prismaRaw.user.findUniqueOrThrow({ where: { id: adminAId } });
      expect(prevOwner.role).toBe('tenant_admin');
      expect(newOwner.role).toBe('tenant_superadmin');
      expect(await countOwners(tenantAId)).toBe(1);

      const auditRows = await prismaRaw.auditLog.findMany({
        where: { tenantId: tenantAId, entity: 'users', action: 'UPDATE', entityId: { in: [ownerAId, adminAId] } },
      });
      expect(auditRows.length).toBeGreaterThanOrEqual(2);

      // Transfer back so subsequent tests in this file can rely on ownerA holding ownership again.
      const newOwnerCaller = ownerCallerFor(tenantAId, adminAId);
      await newOwnerCaller.user.transferOwnership({ newOwnerUserId: ownerAId });
      expect(await countOwners(tenantAId)).toBe(1);
      expect((await prismaRaw.user.findUniqueOrThrow({ where: { id: ownerAId } })).role).toBe('tenant_superadmin');
    });

    it('rejects when the caller is a tenant_admin (not the owner)', async () => {
      const admin = adminCallerFor(tenantAId, adminAId);
      await expect(admin.user.transferOwnership({ newOwnerUserId: employeeAId })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('rejects a null-tenant TenantManager caller on the tenant-scoped path (no tenant context)', async () => {
      const sa = superAdminCaller();
      await expect(sa.user.transferOwnership({ newOwnerUserId: employeeAId })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    });

    it('rejects an impersonated-tenant TenantManager caller via the resolver-level owner-only guard', async () => {
      const sa = superAdminWithTenantCaller(tenantAId);
      await expect(sa.user.transferOwnership({ newOwnerUserId: employeeAId })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('rejects a target user in a different tenant', async () => {
      const owner = ownerCallerFor(tenantAId, ownerAId);
      await expect(owner.user.transferOwnership({ newOwnerUserId: adminBId })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('rejects transferring ownership to self', async () => {
      const owner = ownerCallerFor(tenantAId, ownerAId);
      await expect(owner.user.transferOwnership({ newOwnerUserId: ownerAId })).rejects.toThrow();
    });
  });

  describe('platformUser.reassignOwner (platform break-glass)', () => {
    it('TenantManager reassigns tenant B ownership across the demote/promote boundary + audit written', async () => {
      const sa = superAdminCaller();
      const result = await sa.platformUser.reassignOwner({ tenantId: tenantBId, newOwnerUserId: adminBId });
      expect(result.newOwnerId).toBe(adminBId);

      expect((await prismaRaw.user.findUniqueOrThrow({ where: { id: ownerBId } })).role).toBe('tenant_admin');
      expect((await prismaRaw.user.findUniqueOrThrow({ where: { id: adminBId } })).role).toBe('tenant_superadmin');
      expect(await countOwners(tenantBId)).toBe(1);

      const auditRows = await prismaRaw.auditLog.findMany({
        where: { tenantId: tenantBId, entity: 'users', action: 'UPDATE' },
      });
      expect(auditRows.length).toBeGreaterThanOrEqual(2);
    });

    it('rejects a non-TenantManager caller (a real TenantSuperadmin)', async () => {
      const owner = ownerCallerFor(tenantAId, ownerAId);
      await expect(
        owner.platformUser.reassignOwner({ tenantId: tenantAId, newOwnerUserId: adminAId }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('rejects a target user not belonging to the named tenant', async () => {
      const sa = superAdminCaller();
      await expect(
        sa.platformUser.reassignOwner({ tenantId: tenantAId, newOwnerUserId: adminBId }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });
});
