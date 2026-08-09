// Wave 1 (Rule 34 Part B) — matrixProcedure enforcement tests. Proves the NEW capability the
// view-access matrix adds: an `employee` holding a tenant custom role reaches exactly the
// (feature, action) cells the role_permissions matrix grants — and nothing else (deny-by-default).
// Exercised through the real windowRouter (now matrix-governed) with the same ephemeral-fixture
// conventions as window.test.ts: fresh Free-tier tenants, real DB rows, TRPC callers.
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
// An `employee`-role caller — the matrix path (fixed tiers short-circuit; employees resolve through
// role_permissions). userId MUST be a real DB row so resolvePrincipal finds it.
function employeeCallerFor(tenantId: string, userId: string) {
  return createCaller(
    ctxFor({ session: { user: { id: userId } } as unknown as Context['session'], userId, roles: [Role.Employee], tenantId }),
  );
}

describe('matrixProcedure (Wave 1 — custom-role view-access)', () => {
  let tenantId: string;
  let viewOnlyEmpId: string; // employee with a custom role granting windows:view only
  let writerEmpId: string; // employee with a custom role granting windows:view + write
  let plainEmpId: string; // employee with NO custom role (deny-by-default)

  beforeAll(async () => {
    // The role_permissions.featureKey FK targets the global Feature registry — ensure the row exists
    // (idempotent; the seed also creates it).
    await prismaRaw.feature.upsert({
      where: { featureKey: 'windows' },
      update: {},
      create: { featureKey: 'windows', surface: '/admin/windows' },
    });

    const tenant = await prismaRaw.tenant.create({
      data: { slug: `test-matrix-${Date.now()}`, companyName: 'Matrix Tenant', tagline: 'x', tier: 'free' },
    });
    tenantId = tenant.id;

    const viewRole = await prismaRaw.customRole.create({
      data: {
        tenantId,
        name: 'Window Viewer',
        preset: 'viewer',
        rolePermissions: { create: [{ tenantId, featureKey: 'windows', view: true }] },
      },
    });
    const writerRole = await prismaRaw.customRole.create({
      data: {
        tenantId,
        name: 'Window Writer',
        preset: 'contributor',
        rolePermissions: { create: [{ tenantId, featureKey: 'windows', view: true, write: true }] },
      },
    });

    viewOnlyEmpId = (await prismaRaw.user.create({ data: { tenantId, name: 'Viewer', role: 'employee', pin: 'x', customRoleId: viewRole.id } })).id;
    writerEmpId = (await prismaRaw.user.create({ data: { tenantId, name: 'Writer', role: 'employee', pin: 'x', customRoleId: writerRole.id } })).id;
    plainEmpId = (await prismaRaw.user.create({ data: { tenantId, name: 'Plain', role: 'employee', pin: 'x' } })).id;
  });

  afterAll(async () => {
    // Cascades custom roles + role_permissions + users.
    await prismaRaw.tenant.deleteMany({ where: { id: tenantId } });
  });

  it('a custom role granting windows:view lets the employee LIST windows', async () => {
    const caller = employeeCallerFor(tenantId, viewOnlyEmpId);
    await expect(caller.window.list()).resolves.toBeInstanceOf(Array);
  });

  it('view-only does NOT grant write — create is FORBIDDEN', async () => {
    const caller = employeeCallerFor(tenantId, viewOnlyEmpId);
    await expect(caller.window.create({ name: 'Nope' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('a custom role granting windows:write lets the employee CREATE a window', async () => {
    const caller = employeeCallerFor(tenantId, writerEmpId);
    const win = await caller.window.create({ name: 'Matrix Window' });
    expect(win.name).toBe('Matrix Window');
  });

  it('an employee with NO custom role is denied by default (view FORBIDDEN)', async () => {
    const caller = employeeCallerFor(tenantId, plainEmpId);
    await expect(caller.window.list()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
