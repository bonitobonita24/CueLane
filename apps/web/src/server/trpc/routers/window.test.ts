// Wave 7.6-T3 — windowRouter tRPC tests (TDD). Mirrors service.test.ts's conventions: two fresh
// ephemeral Free-tier fixture tenants (never the seeded `demo` tenant), every caller a
// tenant-ADMIN session (never super_admin), explicit cross-tenant + Employee-rejection assertions.
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
    ctxFor({ session: { user: { id: userId } } as unknown as Context['session'], userId, roles: [Role.Admin], tenantId }),
  );
}
function employeeCallerFor(tenantId: string, userId: string) {
  return createCaller(
    ctxFor({ session: { user: { id: userId } } as unknown as Context['session'], userId, roles: [Role.Employee], tenantId }),
  );
}

describe('windowRouter (Wave 7.6-T3)', () => {
  let tenantAId: string;
  let adminAId: string;
  let employeeAId: string;

  let tenantBId: string;
  let adminBId: string;

  beforeAll(async () => {
    const tenantA = await prismaRaw.tenant.create({
      data: { slug: `test-win-a-${Date.now()}`, companyName: 'Win Tenant A', tagline: 'x', tier: 'free' },
    });
    tenantAId = tenantA.id;
    adminAId = (await prismaRaw.user.create({ data: { tenantId: tenantAId, name: 'Admin A', role: 'admin', pin: 'x' } })).id;
    employeeAId = (await prismaRaw.user.create({ data: { tenantId: tenantAId, name: 'Emp A', role: 'employee', pin: 'x' } })).id;

    const tenantB = await prismaRaw.tenant.create({
      data: { slug: `test-win-b-${Date.now()}`, companyName: 'Win Tenant B', tagline: 'x', tier: 'free' },
    });
    tenantBId = tenantB.id;
    adminBId = (await prismaRaw.user.create({ data: { tenantId: tenantBId, name: 'Admin B', role: 'admin', pin: 'x' } })).id;
  });

  afterAll(async () => {
    await prismaRaw.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } });
  });

  it('creates and lists windows ordered by name for a brand-new tenant', async () => {
    const admin = adminCallerFor(tenantAId, adminAId);
    await admin.window.create({ name: 'Window B' });
    await admin.window.create({ name: 'Window A' });
    const list = await admin.window.list();
    expect(list.map((w) => w.name)).toEqual(['Window A', 'Window B']);
  });

  it('blocks the 5th window create on a free tenant', async () => {
    const admin = adminCallerFor(tenantAId, adminAId);
    await admin.window.create({ name: 'Window C' });
    await admin.window.create({ name: 'Window D' });
    // tenantAId now has exactly 4 windows.
    const list = await admin.window.list();
    expect(list.length).toBe(4);

    await expect(admin.window.create({ name: 'Overflow' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('tenant B is unaffected by tenant A being at its window cap', async () => {
    const adminB = adminCallerFor(tenantBId, adminBId);
    const win = await adminB.window.create({ name: 'B Window 1' });
    expect(win.name).toBe('B Window 1');
    expect((await adminB.window.list()).length).toBe(1);
  });

  it('cross-tenant update/delete → NOT_FOUND', async () => {
    const adminA = adminCallerFor(tenantAId, adminAId);
    const adminB = adminCallerFor(tenantBId, adminBId);
    const [winA] = await adminA.window.list();
    expect(winA).toBeDefined();

    await expect(adminB.window.update({ id: winA!.id, name: 'Hijacked' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(adminB.window.delete({ id: winA!.id })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('an Employee-role caller is rejected with FORBIDDEN', async () => {
    const employee = employeeCallerFor(tenantAId, employeeAId);
    await expect(employee.window.create({ name: 'Nope' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(employee.window.list()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('same-tenant admin can update and delete its own window', async () => {
    const admin = adminCallerFor(tenantBId, adminBId);
    const [win] = await admin.window.list();
    expect(win).toBeDefined();

    const updated = await admin.window.update({ id: win!.id, name: 'Renamed' });
    expect(updated.name).toBe('Renamed');

    const deleted = await admin.window.delete({ id: win!.id });
    expect(deleted.id).toBe(win!.id);

    expect((await admin.window.list()).find((w) => w.id === win!.id)).toBeUndefined();
  });
});
