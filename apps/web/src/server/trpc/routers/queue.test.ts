// Wave 7.1-T3 — queueRouter tRPC tests (TDD: written before the router implementation).
// Runs against the REAL dev Postgres DB via createCaller — no mocks — using ephemeral fixture
// tenants (a premium one + a free one, for the Return-After-Done premium-gate test) created in
// beforeAll and torn down in afterAll.
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
  return {
    session: null,
    userId: null,
    roles: [],
    tenantId: null,
    req: fakeReq(),
    ...overrides,
  };
}

describe('queueRouter (Wave 7.1)', () => {
  let premiumTenantId: string;
  let premiumServiceId: string;
  let premiumWindowId: string;
  let premiumEmployeeId: string;
  let premiumTenantSlug: string;

  let freeTenantId: string;
  let freeServiceId: string;
  let freeWindowId: string;
  let freeEmployeeId: string;
  let freeTenantSlug: string;
  let freeDestWindowId: string;

  beforeAll(async () => {
    premiumTenantSlug = `test-qr-premium-${Date.now()}`;
    const premiumTenant = await prismaRaw.tenant.create({
      data: { slug: premiumTenantSlug, companyName: 'Premium Test Co.', tagline: 'x', tier: 'premium' },
    });
    premiumTenantId = premiumTenant.id;
    const premiumService = await prismaRaw.service.create({
      data: { tenantId: premiumTenantId, number: 1, name: 'Svc', icon: 'S', color: '#111111', avgTime: 5 },
    });
    premiumServiceId = premiumService.id;
    const premiumWindow = await prismaRaw.window.create({ data: { tenantId: premiumTenantId, name: 'W1' } });
    premiumWindowId = premiumWindow.id;
    const premiumEmployee = await prismaRaw.user.create({
      data: { tenantId: premiumTenantId, name: 'Emp', role: 'employee', pin: 'x' },
    });
    premiumEmployeeId = premiumEmployee.id;
    await prismaRaw.userService.create({
      data: { tenantId: premiumTenantId, userId: premiumEmployeeId, serviceId: premiumServiceId },
    });

    freeTenantSlug = `test-qr-free-${Date.now()}`;
    const freeTenant = await prismaRaw.tenant.create({
      data: { slug: freeTenantSlug, companyName: 'Free Test Co.', tagline: 'x', tier: 'free' },
    });
    freeTenantId = freeTenant.id;
    const freeService = await prismaRaw.service.create({
      data: { tenantId: freeTenantId, number: 1, name: 'Svc', icon: 'S', color: '#111111', avgTime: 5 },
    });
    freeServiceId = freeService.id;
    const freeWindow = await prismaRaw.window.create({ data: { tenantId: freeTenantId, name: 'W1' } });
    freeWindowId = freeWindow.id;
    const freeDestWindow = await prismaRaw.window.create({ data: { tenantId: freeTenantId, name: 'W2' } });
    freeDestWindowId = freeDestWindow.id;
    const freeEmployee = await prismaRaw.user.create({
      data: { tenantId: freeTenantId, name: 'Emp', role: 'employee', pin: 'x' },
    });
    freeEmployeeId = freeEmployee.id;
    await prismaRaw.userService.create({
      data: { tenantId: freeTenantId, userId: freeEmployeeId, serviceId: freeServiceId },
    });
  });

  afterAll(async () => {
    await prismaRaw.tenant.delete({ where: { id: premiumTenantId } });
    await prismaRaw.tenant.delete({ where: { id: freeTenantId } });
  });

  it('kiosk issue works with NO session', async () => {
    const caller = createCaller(ctxFor({}));
    const result = await caller.queue.issue({ tenantSlug: premiumTenantSlug, serviceId: premiumServiceId, priority: false });
    expect(result.number).toMatch(/^1-\d{3}$/);
    expect(result.ticketId).toBeTruthy();
  });

  it('kiosk counts is callable with NO session', async () => {
    const caller = createCaller(ctxFor({}));
    const counts = await caller.queue.counts({ tenantSlug: premiumTenantSlug });
    expect(typeof counts.waiting).toBe('number');
    expect(typeof counts.serving).toBe('number');
  });

  it('kiosk listActive returns this tenant\'s services, ordered by number, with NO session', async () => {
    const caller = createCaller(ctxFor({}));
    const services = await caller.queue.listActive({ tenantSlug: premiumTenantSlug });
    expect(services.length).toBeGreaterThanOrEqual(1);
    expect(services.some((s) => s.id === premiumServiceId)).toBe(true);
    const numbers = services.map((s) => s.number);
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
    // Never leaks another tenant's services (L6 tenant-isolation lesson).
    expect(services.every((s) => s.id !== freeServiceId)).toBe(true);
  });

  it('callNext is UNAUTHORIZED without a session', async () => {
    const caller = createCaller(ctxFor({}));
    await expect(caller.queue.callNext({ windowId: premiumWindowId })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('callNext is FORBIDDEN for an authenticated caller with no employee/admin role', async () => {
    const caller = createCaller(
      ctxFor({
        session: { user: { id: 'x' } } as unknown as Context['session'],
        userId: 'some-user-id',
        roles: [],
        tenantId: premiumTenantId,
      }),
    );
    await expect(caller.queue.callNext({ windowId: premiumWindowId })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('free-tier Return-After-Done transfer is FORBIDDEN (Premium gate)', async () => {
    const employeeCtx = ctxFor({
      session: { user: { id: freeEmployeeId } } as unknown as Context['session'],
      userId: freeEmployeeId,
      roles: [Role.Employee],
      tenantId: freeTenantId,
    });
    const kioskCaller = createCaller(ctxFor({}));
    const issued = await kioskCaller.queue.issue({ tenantSlug: freeTenantSlug, serviceId: freeServiceId, priority: false });

    const staffCaller = createCaller(employeeCtx);
    const called = await staffCaller.queue.callNext({ windowId: freeWindowId });
    expect(called?.id).toBe(issued.ticketId);

    await expect(
      staffCaller.queue.transfer({
        ticketId: issued.ticketId,
        toWindowId: freeDestWindowId,
        returnAfterDone: true,
        returnToWindowId: freeWindowId,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('a full issue → callNext → complete sequence returns coherent state', async () => {
    // A fully dedicated service + employee (single assignment) keeps this test's waiting pool
    // isolated — the "kiosk issue works with NO session" test above already left a waiting
    // ticket on premiumServiceId/premiumEmployeeId, which callNext would otherwise pick first.
    const freshSvc = await prismaRaw.service.create({
      data: { tenantId: premiumTenantId, number: 99, name: 'Fresh', icon: 'F', color: '#444444', avgTime: 5 },
    });
    const freshEmployee = await prismaRaw.user.create({
      data: { tenantId: premiumTenantId, name: 'Fresh Emp', role: 'employee', pin: 'x' },
    });
    await prismaRaw.userService.create({
      data: { tenantId: premiumTenantId, userId: freshEmployee.id, serviceId: freshSvc.id },
    });

    const kioskCaller = createCaller(ctxFor({}));
    const issued = await kioskCaller.queue.issue({ tenantSlug: premiumTenantSlug, serviceId: freshSvc.id, priority: false });

    const staffCaller = createCaller(
      ctxFor({
        session: { user: { id: freshEmployee.id } } as unknown as Context['session'],
        userId: freshEmployee.id,
        roles: [Role.Employee],
        tenantId: premiumTenantId,
      }),
    );

    const called = await staffCaller.queue.callNext({ windowId: premiumWindowId });
    expect(called?.id).toBe(issued.ticketId);
    expect(called?.status).toBe('serving');

    const completed = await staffCaller.queue.complete({ ticketId: issued.ticketId, outcome: 'done' });
    expect(completed.status).toBe('completed');
  });

  // Wave 7.4 — station-facing additions: recallSkipped, listSkipped, listWindows.
  describe('Wave 7.4 station additions', () => {
    it('listWindows returns this tenant\'s windows only, ordered by name, and requires a session', async () => {
      const unauthed = createCaller(ctxFor({}));
      await expect(unauthed.queue.listWindows()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });

      const staffCaller = createCaller(
        ctxFor({
          session: { user: { id: premiumEmployeeId } } as unknown as Context['session'],
          userId: premiumEmployeeId,
          roles: [Role.Employee],
          tenantId: premiumTenantId,
        }),
      );
      const windows = await staffCaller.queue.listWindows();
      expect(windows.some((w) => w.id === premiumWindowId)).toBe(true);
      expect(windows.every((w) => w.id !== freeWindowId)).toBe(true); // no cross-tenant leakage
    });

    it('recallSkipped brings a skipped ticket back to serving at the caller\'s window; listSkipped reflects it', async () => {
      const svc = await prismaRaw.service.create({
        data: { tenantId: premiumTenantId, number: 77, name: 'Skip Fixture', icon: 'K', color: '#777777', avgTime: 5 },
      });
      const employee = await prismaRaw.user.create({
        data: { tenantId: premiumTenantId, name: 'Skip Fixture Emp', role: 'employee', pin: 'x' },
      });
      await prismaRaw.userService.create({ data: { tenantId: premiumTenantId, userId: employee.id, serviceId: svc.id } });

      const kioskCaller = createCaller(ctxFor({}));
      const issued = await kioskCaller.queue.issue({ tenantSlug: premiumTenantSlug, serviceId: svc.id, priority: false });

      const staffCaller = createCaller(
        ctxFor({
          session: { user: { id: employee.id } } as unknown as Context['session'],
          userId: employee.id,
          roles: [Role.Employee],
          tenantId: premiumTenantId,
        }),
      );

      const called = await staffCaller.queue.callNext({ windowId: premiumWindowId });
      expect(called?.id).toBe(issued.ticketId);
      await staffCaller.queue.skip({ ticketId: issued.ticketId });

      const skippedList = await staffCaller.queue.listSkipped();
      expect(skippedList.some((t) => t.id === issued.ticketId)).toBe(true);

      const recalled = await staffCaller.queue.recallSkipped({ ticketId: issued.ticketId, windowId: premiumWindowId });
      expect(recalled.status).toBe('serving');
      expect(recalled.windowId).toBe(premiumWindowId);
      expect(recalled.servedBy).toBe(employee.id);

      const skippedAfter = await staffCaller.queue.listSkipped();
      expect(skippedAfter.some((t) => t.id === issued.ticketId)).toBe(false);
    });

    it('recallSkipped rejects a ticket that is not skipped (e.g. still waiting)', async () => {
      const staffCaller = createCaller(
        ctxFor({
          session: { user: { id: premiumEmployeeId } } as unknown as Context['session'],
          userId: premiumEmployeeId,
          roles: [Role.Employee],
          tenantId: premiumTenantId,
        }),
      );
      const kioskCaller = createCaller(ctxFor({}));
      const issued = await kioskCaller.queue.issue({ tenantSlug: premiumTenantSlug, serviceId: premiumServiceId, priority: false });

      await expect(
        staffCaller.queue.recallSkipped({ ticketId: issued.ticketId, windowId: premiumWindowId }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    });
  });
});
