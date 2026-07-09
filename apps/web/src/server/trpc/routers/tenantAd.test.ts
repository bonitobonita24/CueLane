// Wave 7.7c-T2 — tenantAdRouter tRPC tests (TDD). Premium-only surface: every mutation/query must
// FORBID a Free-tier admin caller. Mirrors mediaRouter.test.ts's fixture conventions.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NextRequest } from 'next/server';
import { prismaRaw } from '@cuelane/db';
import { Role, AdType } from '@cuelane/shared';
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

describe('tenantAdRouter (Wave 7.7c-T2)', () => {
  let freeTenantId: string;
  let freeAdminId: string;

  let premiumTenantId: string;
  let premiumAdminId: string;
  let otherPremiumTenantId: string;
  let otherPremiumAdminId: string;

  beforeAll(async () => {
    const freeTenant = await prismaRaw.tenant.create({
      data: { slug: `test-tad-free-${Date.now()}`, companyName: 'Ad Free Co.', tagline: 'x', tier: 'free' },
    });
    freeTenantId = freeTenant.id;
    freeAdminId = (await prismaRaw.user.create({ data: { tenantId: freeTenantId, name: 'Free Admin', role: 'admin', pin: 'x' } })).id;

    const premiumTenant = await prismaRaw.tenant.create({
      data: { slug: `test-tad-prem-${Date.now()}`, companyName: 'Ad Premium Co.', tagline: 'x', tier: 'premium' },
    });
    premiumTenantId = premiumTenant.id;
    premiumAdminId = (await prismaRaw.user.create({ data: { tenantId: premiumTenantId, name: 'Prem Admin', role: 'admin', pin: 'x' } })).id;

    const otherPremiumTenant = await prismaRaw.tenant.create({
      data: { slug: `test-tad-prem2-${Date.now()}`, companyName: 'Ad Premium Co 2.', tagline: 'x', tier: 'premium' },
    });
    otherPremiumTenantId = otherPremiumTenant.id;
    otherPremiumAdminId = (await prismaRaw.user.create({ data: { tenantId: otherPremiumTenantId, name: 'Prem Admin 2', role: 'admin', pin: 'x' } })).id;
  });

  afterAll(async () => {
    await prismaRaw.tenant.deleteMany({ where: { id: { in: [freeTenantId, premiumTenantId, otherPremiumTenantId] } } });
  });

  it('FORBIDS every tenantAd procedure for a Free-tier admin', async () => {
    const freeAdmin = adminCallerFor(freeTenantId, freeAdminId);
    await expect(freeAdmin.tenantAd.list()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      freeAdmin.tenantAd.create({ type: AdType.YouTube, title: 'Ad', videoId: 'dQw4w9WgXcQ' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('a Premium admin can create/list/reorder/delete tenant ads', async () => {
    const admin = adminCallerFor(premiumTenantId, premiumAdminId);
    const ad1 = await admin.tenantAd.create({ type: AdType.YouTube, title: 'Ad 1', videoId: 'dQw4w9WgXcQ' });
    const ad2 = await admin.tenantAd.create({ type: AdType.YouTube, title: 'Ad 2', videoId: 'dQw4w9WgXcQ' });
    expect((await admin.tenantAd.list()).map((a) => a.id)).toEqual([ad1.id, ad2.id]);

    await admin.tenantAd.reorder({ orderedIds: [ad2.id, ad1.id] });
    expect((await admin.tenantAd.list()).map((a) => a.id)).toEqual([ad2.id, ad1.id]);

    const deleted = await admin.tenantAd.delete({ id: ad1.id });
    expect(deleted.id).toBe(ad1.id);
    expect((await admin.tenantAd.list()).find((a) => a.id === ad1.id)).toBeUndefined();
  });

  it('cross-tenant delete/reorder between two Premium tenants → NOT_FOUND', async () => {
    const adminOther = adminCallerFor(otherPremiumTenantId, otherPremiumAdminId);
    const adminMain = adminCallerFor(premiumTenantId, premiumAdminId);
    const [adMain] = await adminMain.tenantAd.list();
    expect(adMain).toBeDefined();

    await expect(adminOther.tenantAd.delete({ id: adMain!.id })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(adminOther.tenantAd.reorder({ orderedIds: [adMain!.id] })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
