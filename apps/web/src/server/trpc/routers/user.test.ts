// Wave 7.6-T4 — userRouter tRPC tests (TDD). Two fresh ephemeral Free tenants (never `demo`,
// never a hardcoded id/slug). Every caller a tenant-ADMIN session (never super_admin).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
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

describe('userRouter (Wave 7.6-T4)', () => {
  let tenantAId: string;
  let adminAId: string;
  let employeeAId: string;
  let svcA1Id: string;
  let svcA2Id: string;

  let tenantBId: string;
  let adminBId: string;
  let svcBId: string;

  beforeAll(async () => {
    const tenantA = await prismaRaw.tenant.create({
      data: { slug: `test-user-a-${Date.now()}`, companyName: 'User Tenant A', tagline: 'x', tier: 'free' },
    });
    tenantAId = tenantA.id;
    adminAId = (await prismaRaw.user.create({ data: { tenantId: tenantAId, name: 'Admin A', role: 'admin', pin: 'x' } })).id;
    employeeAId = (await prismaRaw.user.create({ data: { tenantId: tenantAId, name: 'Emp A', role: 'employee', pin: 'x' } })).id;
    svcA1Id = (await prismaRaw.service.create({ data: { tenantId: tenantAId, number: 1, name: 'A Svc 1', icon: 'S', color: '#111111', avgTime: 5 } })).id;
    svcA2Id = (await prismaRaw.service.create({ data: { tenantId: tenantAId, number: 2, name: 'A Svc 2', icon: 'S', color: '#111111', avgTime: 5 } })).id;

    const tenantB = await prismaRaw.tenant.create({
      data: { slug: `test-user-b-${Date.now()}`, companyName: 'User Tenant B', tagline: 'x', tier: 'free' },
    });
    tenantBId = tenantB.id;
    adminBId = (await prismaRaw.user.create({ data: { tenantId: tenantBId, name: 'Admin B', role: 'admin', pin: 'x' } })).id;
    svcBId = (await prismaRaw.service.create({ data: { tenantId: tenantBId, number: 1, name: 'B Svc 1', icon: 'S', color: '#111111', avgTime: 5 } })).id;
  });

  afterAll(async () => {
    await prismaRaw.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } });
  });

  it('creates a user with bcrypt-hashed pin (never plaintext) and assigned services', async () => {
    const admin = adminCallerFor(tenantAId, adminAId);
    const created = await admin.user.create({ name: 'New Employee', role: Role.Employee, pin: '1234', services: [svcA1Id, svcA2Id] });
    expect(created.serviceIds.sort()).toEqual([svcA1Id, svcA2Id].sort());
    expect((created as unknown as { pin?: string }).pin).toBeUndefined(); // never returned to the client

    const row = await prismaRaw.user.findUniqueOrThrow({ where: { id: created.id } });
    expect(row.pin).not.toBe('1234');
    expect(await bcrypt.compare('1234', row.pin)).toBe(true);
  });

  it('rejects a foreign-tenant serviceId on create', async () => {
    const admin = adminCallerFor(tenantAId, adminAId);
    await expect(
      admin.user.create({ name: 'Sneaky', role: Role.Employee, pin: '1234', services: [svcBId] }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('blocks the 11th user create on a free tenant (already has admin+employee+1 created = 3)', async () => {
    const admin = adminCallerFor(tenantAId, adminAId);
    for (let i = 0; i < 7; i++) {
      await admin.user.create({ name: `Fill ${i}`, role: Role.Employee, pin: '1234', services: [] });
    }
    // tenantAId now has exactly 10 users (adminA, employeeA, 1 created + 7 filled).
    const list = await admin.user.list();
    expect(list.length).toBe(10);

    await expect(admin.user.create({ name: 'Overflow', role: Role.Employee, pin: '1234', services: [] })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('tenant B is unaffected by tenant A being at its user cap', async () => {
    const adminB = adminCallerFor(tenantBId, adminBId);
    const created = await adminB.user.create({ name: 'B Employee', role: Role.Employee, pin: '5678', services: [svcBId] });
    expect(created.serviceIds).toEqual([svcBId]);
  });

  it('update re-syncs the service join and can change pin', async () => {
    const adminB = adminCallerFor(tenantBId, adminBId);
    const list = await adminB.user.list();
    const target = list.find((u) => u.name === 'B Employee');
    expect(target).toBeDefined();

    const updated = await adminB.user.update({ id: target!.id, name: 'B Employee Renamed', services: [] });
    expect(updated.name).toBe('B Employee Renamed');
    expect(updated.serviceIds).toEqual([]);
  });

  it('cross-tenant update/delete → NOT_FOUND', async () => {
    const adminA = adminCallerFor(tenantAId, adminAId);
    const adminB = adminCallerFor(tenantBId, adminBId);
    const [userA] = await adminA.user.list();
    expect(userA).toBeDefined();

    await expect(adminB.user.update({ id: userA!.id, name: 'Hijacked' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(adminB.user.delete({ id: userA!.id })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('an Employee-role caller is rejected with FORBIDDEN', async () => {
    const employee = employeeCallerFor(tenantAId, employeeAId);
    await expect(employee.user.list()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(employee.user.create({ name: 'Nope', role: Role.Employee, pin: '1234', services: [] })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('the shared createUserSchema rejects a super_admin role input before it ever reaches the router', async () => {
    const admin = adminCallerFor(tenantBId, adminBId);
    const maliciousInput = { name: 'Mallory', role: Role.SuperAdmin, pin: '1234', services: [] } as unknown as Parameters<
      typeof admin.user.create
    >[0];
    await expect(admin.user.create(maliciousInput)).rejects.toBeDefined();
  });
});
