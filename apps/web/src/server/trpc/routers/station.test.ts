// Wave 7.4-T1 — stationRouter tests. Runs against the REAL dev Postgres DB (window validation)
// AND the real dev Valkey (session persistence) — no mocks, an ephemeral fixture tenant per the
// repo's DB-testing convention (beforeAll create, afterAll cascade-delete).
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

describe('stationRouter (Wave 7.4-T1)', () => {
  let tenantId: string;
  let otherTenantId: string;
  let windowId: string;
  let otherTenantWindowId: string;
  let employeeId: string;

  beforeAll(async () => {
    const tenant = await prismaRaw.tenant.create({
      data: { slug: `test-station-${Date.now()}`, companyName: 'Station Test Co.', tagline: 'x', tier: 'premium' },
    });
    tenantId = tenant.id;
    const window = await prismaRaw.window.create({ data: { tenantId, name: 'W1' } });
    windowId = window.id;
    const employee = await prismaRaw.user.create({ data: { tenantId, name: 'Emp', role: 'employee', pin: 'x' } });
    employeeId = employee.id;

    const otherTenant = await prismaRaw.tenant.create({
      data: { slug: `test-station-other-${Date.now()}`, companyName: 'Other Co.', tagline: 'x', tier: 'premium' },
    });
    otherTenantId = otherTenant.id;
    const otherWindow = await prismaRaw.window.create({ data: { tenantId: otherTenantId, name: 'OW1' } });
    otherTenantWindowId = otherWindow.id;
  });

  afterAll(async () => {
    await prismaRaw.tenant.delete({ where: { id: tenantId } });
    await prismaRaw.tenant.delete({ where: { id: otherTenantId } });
  });

  function staffCaller(): ReturnType<typeof createCaller> {
    return createCaller(
      ctxFor({
        session: { user: { id: employeeId } } as unknown as Context['session'],
        userId: employeeId,
        roles: [Role.Employee],
        tenantId,
      }),
    );
  }

  it('getWindow requires a session', async () => {
    const unauthed = createCaller(ctxFor({}));
    await expect(unauthed.station.getWindow()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('getWindow returns null before any window has been selected', async () => {
    const result = await staffCaller().station.getWindow();
    expect(result.windowId).toBeNull();
  });

  it('setWindow persists the selection; getWindow then reflects it', async () => {
    const caller = staffCaller();
    const set = await caller.station.setWindow({ windowId });
    expect(set.windowId).toBe(windowId);

    const got = await caller.station.getWindow();
    expect(got.windowId).toBe(windowId);
  });

  it('setWindow rejects a window that belongs to a DIFFERENT tenant (L6 tenant-isolation)', async () => {
    const caller = staffCaller();
    await expect(caller.station.setWindow({ windowId: otherTenantWindowId })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('setWindow rejects an unknown windowId', async () => {
    const caller = staffCaller();
    await expect(caller.station.setWindow({ windowId: 'cknonexistentcuid00000000' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
