// RBAC Wave 2 (Rule 34 Part B) — rolesRouter tests. Exercises the real router through
// createCaller against the dev Postgres DB (no mocks), mirroring matrixProcedure.test.ts's
// ephemeral-fixture conventions: fresh Free-tier tenants, real DB rows, TRPC callers.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NextRequest } from 'next/server';
import { prismaRaw, FeatureKey, RolePreset } from '@cuelane/db';
import { Role, FeatureKey as SharedFeatureKey, RolePreset as SharedRolePreset } from '@cuelane/shared';
import { presetMatrix } from '@/lib/rbac';
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
function tenantAdminCallerFor(tenantId: string, userId: string) {
  return createCaller(
    ctxFor({ session: { user: { id: userId } } as unknown as Context['session'], userId, roles: [Role.TenantAdmin], tenantId }),
  );
}

describe('rolesRouter (Wave 2 — custom-role builder)', () => {
  let tenantAId: string;
  let ownerAId: string;
  let tenantAdminAId: string;

  let tenantBId: string;
  let ownerBId: string;

  beforeAll(async () => {
    // role_permissions.featureKey FK targets the global Feature registry — ensure the rows
    // this suite exercises exist (idempotent; the seed also creates them).
    await prismaRaw.feature.upsert({
      where: { featureKey: 'windows' },
      update: {},
      create: { featureKey: 'windows', surface: '/admin/windows' },
    });
    await prismaRaw.feature.upsert({
      where: { featureKey: 'services' },
      update: {},
      create: { featureKey: 'services', surface: '/admin/services' },
    });

    const tenantA = await prismaRaw.tenant.create({
      data: { slug: `test-roles-a-${Date.now()}`, companyName: 'Roles Tenant A', tagline: 'x', tier: 'free' },
    });
    tenantAId = tenantA.id;
    ownerAId = (await prismaRaw.user.create({ data: { tenantId: tenantAId, name: 'Owner A', role: 'tenant_superadmin', pin: 'x' } })).id;
    tenantAdminAId = (await prismaRaw.user.create({ data: { tenantId: tenantAId, name: 'Admin A', role: 'tenant_admin', pin: 'x' } })).id;

    const tenantB = await prismaRaw.tenant.create({
      data: { slug: `test-roles-b-${Date.now()}`, companyName: 'Roles Tenant B', tagline: 'x', tier: 'free' },
    });
    tenantBId = tenantB.id;
    ownerBId = (await prismaRaw.user.create({ data: { tenantId: tenantBId, name: 'Owner B', role: 'tenant_superadmin', pin: 'x' } })).id;
  });

  afterAll(async () => {
    await prismaRaw.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } });
  });

  it('a plain tenant_admin caller is FORBIDDEN — role-authoring is owner-only', async () => {
    const admin = tenantAdminCallerFor(tenantAId, tenantAdminAId);
    await expect(admin.roles.list()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      admin.roles.create({ name: 'Nope', preset: SharedRolePreset.Viewer, permissions: [] }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('create rejects an OWNER_ONLY grant (users/roles) with BAD_REQUEST, even from the owner', async () => {
    const owner = ownerCallerFor(tenantAId, ownerAId);
    await expect(
      owner.roles.create({
        name: 'Sneaky',
        preset: SharedRolePreset.Viewer,
        permissions: [{ featureKey: SharedFeatureKey.Users, view: true, write: false, update: false, delete: false }],
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('create + get round-trips the permission matrix, filling ungranted features as all-false', async () => {
    const owner = ownerCallerFor(tenantAId, ownerAId);
    const { id } = await owner.roles.create({
      name: 'Window Viewer',
      preset: SharedRolePreset.Viewer,
      permissions: [{ featureKey: SharedFeatureKey.Windows, view: true, write: false, update: false, delete: false }],
    });

    const fetched = await owner.roles.get({ id });
    expect(fetched.name).toBe('Window Viewer');
    expect(fetched.preset).toBe('viewer');

    const windowsRow = fetched.permissions.find((p) => p.featureKey === FeatureKey.windows);
    expect(windowsRow).toMatchObject({ view: true, write: false, update: false, delete: false });

    const servicesRow = fetched.permissions.find((p) => p.featureKey === FeatureKey.services);
    expect(servicesRow).toMatchObject({ view: false, write: false, update: false, delete: false });

    const list = await owner.roles.list();
    expect(list.find((r) => r.id === id)).toMatchObject({ featureCount: 1 });
  });

  it('delete is blocked while a user is assigned to the role (CONFLICT)', async () => {
    const owner = ownerCallerFor(tenantAId, ownerAId);
    const { id } = await owner.roles.create({
      name: 'Assigned Role',
      preset: SharedRolePreset.Viewer,
      permissions: [{ featureKey: SharedFeatureKey.Windows, view: true, write: false, update: false, delete: false }],
    });

    const assignedUserId = (
      await prismaRaw.user.create({ data: { tenantId: tenantAId, name: 'Assignee', role: 'employee', pin: 'x', customRoleId: id } })
    ).id;

    await expect(owner.roles.delete({ id })).rejects.toMatchObject({ code: 'CONFLICT' });

    // Unassign, then the delete succeeds.
    await prismaRaw.user.update({ where: { id: assignedUserId }, data: { customRoleId: null } });
    await expect(owner.roles.delete({ id })).resolves.toMatchObject({ id });
  });

  it('tenant isolation — a role in tenant A is NOT_FOUND for tenant B', async () => {
    const ownerA = ownerCallerFor(tenantAId, ownerAId);
    const ownerB = ownerCallerFor(tenantBId, ownerBId);

    const { id } = await ownerA.roles.create({
      name: 'A-Only Role',
      preset: SharedRolePreset.Viewer,
      permissions: [{ featureKey: SharedFeatureKey.Windows, view: true, write: false, update: false, delete: false }],
    });

    await expect(ownerB.roles.get({ id })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      ownerB.roles.update({ id, name: 'Hijacked', preset: SharedRolePreset.Viewer, permissions: [] }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(ownerB.roles.delete({ id })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('presetMatrix (Wave 2 — preset → matrix expansion)', () => {
  it('viewer is view-only on every writable feature', () => {
    const rows = presetMatrix(RolePreset.viewer);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row).toMatchObject({ view: true, write: false, update: false, delete: false });
      expect(row.featureKey).not.toBe(FeatureKey.users);
      expect(row.featureKey).not.toBe(FeatureKey.roles);
    }
  });
});
