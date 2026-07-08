// Wave 7.6-T4 — tenantAdminRouter tRPC tests (TDD). Fresh ephemeral tenants (never `demo`), every
// caller a tenant-ADMIN session (never super_admin).
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

describe('tenantAdminRouter (Wave 7.6-T4)', () => {
  let freeTenantId: string;
  let freeAdminId: string;
  let freeEmployeeId: string;

  let premiumTenantId: string;
  let premiumAdminId: string;

  beforeAll(async () => {
    const freeTenant = await prismaRaw.tenant.create({
      data: {
        slug: `test-tadmin-free-${Date.now()}`,
        companyName: 'Free Tadmin Co.',
        tagline: 'Original tagline',
        tier: 'free',
        settings: { businessName: 'Free Tadmin Co.', tickerText: 'Welcome!', printerConfig: { autoCut: true, paperWidth: '80mm' } },
      },
    });
    freeTenantId = freeTenant.id;
    freeAdminId = (await prismaRaw.user.create({ data: { tenantId: freeTenantId, name: 'Admin', role: 'admin', pin: 'x' } })).id;
    freeEmployeeId = (await prismaRaw.user.create({ data: { tenantId: freeTenantId, name: 'Emp', role: 'employee', pin: 'x' } })).id;

    const premiumTenant = await prismaRaw.tenant.create({
      data: { slug: `test-tadmin-premium-${Date.now()}`, companyName: 'Premium Tadmin Co.', tagline: 'x', tier: 'premium' },
    });
    premiumTenantId = premiumTenant.id;
    premiumAdminId = (await prismaRaw.user.create({ data: { tenantId: premiumTenantId, name: 'Admin', role: 'admin', pin: 'x' } })).id;
  });

  afterAll(async () => {
    await prismaRaw.tenant.deleteMany({ where: { id: { in: [freeTenantId, premiumTenantId] } } });
  });

  it('getUsage reports correct counts + free-tier limits for a fresh free tenant', async () => {
    const admin = adminCallerFor(freeTenantId, freeAdminId);
    const usage = await admin.tenantAdmin.getUsage();
    expect(usage.tier).toBe('free');
    expect(usage.users.count).toBe(2); // adminA + employeeA seeded in beforeAll
    expect(usage.users.limit).toBe(10);
    expect(usage.services).toEqual({ count: 0, limit: 6, atLimit: false });
    expect(usage.windows).toEqual({ count: 0, limit: 4, atLimit: false });
  });

  it('getUsage reports unlimited (null limits) for a premium tenant', async () => {
    const admin = adminCallerFor(premiumTenantId, premiumAdminId);
    const usage = await admin.tenantAdmin.getUsage();
    expect(usage.tier).toBe('premium');
    expect(usage.services.limit).toBeNull();
  });

  it('updateSettings round-trips a printerConfig patch WITHOUT clobbering sibling fields or tickerText/businessName', async () => {
    const admin = adminCallerFor(freeTenantId, freeAdminId);

    const updated = await admin.tenantAdmin.updateSettings({
      settings: { printerConfig: { autoCut: false } }, // only patches autoCut
    });

    const settings = updated.settings as {
      printerConfig?: { autoCut?: boolean; paperWidth?: string };
      tickerText?: string;
      businessName?: string;
    };
    expect(settings.printerConfig?.autoCut).toBe(false);
    expect(settings.printerConfig?.paperWidth).toBe('80mm'); // sibling field preserved
    expect(settings.tickerText).toBe('Welcome!'); // unrelated key preserved
    expect(settings.businessName).toBe('Free Tadmin Co.'); // unrelated key preserved
  });

  it('updateSettings accepts a valid theme preset id and rejects an unknown one', async () => {
    const admin = adminCallerFor(freeTenantId, freeAdminId);
    const updated = await admin.tenantAdmin.updateSettings({ settings: { theme: 'ocean' } });
    expect((updated.settings as { theme?: string }).theme).toBe('ocean');

    const invalidThemeInput = { settings: { theme: 'not-a-real-preset' } } as unknown as Parameters<
      typeof admin.tenantAdmin.updateSettings
    >[0];
    await expect(admin.tenantAdmin.updateSettings(invalidThemeInput)).rejects.toBeDefined();
  });

  it('updateSettings can update companyName/tagline without touching settings JSON', async () => {
    const admin = adminCallerFor(freeTenantId, freeAdminId);
    const before = await admin.tenantAdmin.getSettings();
    const updated = await admin.tenantAdmin.updateSettings({ companyName: 'Renamed Co.' });
    expect(updated.companyName).toBe('Renamed Co.');
    expect(updated.tagline).toBe(before.tagline);
    expect(updated.settings).toEqual(before.settings);
  });

  it('an Employee-role caller is rejected with FORBIDDEN', async () => {
    const employee = employeeCallerFor(freeTenantId, freeEmployeeId);
    await expect(employee.tenantAdmin.getUsage()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(employee.tenantAdmin.getSettings()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('a free tenant admin cannot see or affect a separate premium tenant\'s usage', async () => {
    const freeAdmin = adminCallerFor(freeTenantId, freeAdminId);
    const premiumAdmin = adminCallerFor(premiumTenantId, premiumAdminId);

    const freeUsage = await freeAdmin.tenantAdmin.getUsage();
    const premiumUsage = await premiumAdmin.tenantAdmin.getUsage();
    expect(freeUsage.tier).toBe('free');
    expect(premiumUsage.tier).toBe('premium');
  });
});
