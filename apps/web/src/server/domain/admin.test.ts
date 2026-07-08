// Wave 7.6-T2 — admin domain unit tests (TDD: written before this wave's router implementation).
// Runs against the REAL dev Postgres DB (no mocks), in isolated ephemeral fixture tenants —
// a fresh Free tenant AND a fresh Premium tenant, created in beforeAll and torn down in
// afterAll — so limit assertions can use exact literal values without colliding with the
// persistent seeded `demo` tenant or any other test file's fixtures.
//
// Multi-tenancy proof (owner add-on): both tenants are brand-new (created here, not the seeded
// `demo` tenant), proving getUsage/assertWithinLimit/nextServiceNumber require zero per-tenant
// bootstrapping — they work against any tenantId resolved at call time.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prismaRaw } from '@cuelane/db';
import { TenantTier } from '@cuelane/shared';
import { AdminDomainError, assertWithinLimit, getUsage, nextServiceNumber } from './admin';

describe('admin domain (Wave 7.6-T2)', () => {
  let freeTenantId: string;
  let premiumTenantId: string;

  beforeAll(async () => {
    const freeTenant = await prismaRaw.tenant.create({
      data: { slug: `test-admin-free-${Date.now()}`, companyName: 'Free Admin Test Co.', tagline: 'x', tier: 'free' },
    });
    freeTenantId = freeTenant.id;

    const premiumTenant = await prismaRaw.tenant.create({
      data: { slug: `test-admin-premium-${Date.now()}`, companyName: 'Premium Admin Test Co.', tagline: 'x', tier: 'premium' },
    });
    premiumTenantId = premiumTenant.id;
  });

  afterAll(async () => {
    // FK-safe order — Service/Window/User all cascade from Tenant (onDelete: Cascade), so
    // deleting the tenants is sufficient teardown.
    await prismaRaw.tenant.deleteMany({ where: { id: { in: [freeTenantId, premiumTenantId] } } });
  });

  describe('getUsage', () => {
    it('reports zero counts + free-tier limits + atLimit=false for a brand-new free tenant', async () => {
      const usage = await getUsage(prismaRaw, freeTenantId);
      expect(usage.tier).toBe('free');
      expect(usage.services).toEqual({ count: 0, limit: 6, atLimit: false });
      expect(usage.windows).toEqual({ count: 0, limit: 4, atLimit: false });
      expect(usage.users).toEqual({ count: 0, limit: 10, atLimit: false });
    });

    it('reports null limits + atLimit=false for a brand-new premium tenant', async () => {
      const usage = await getUsage(prismaRaw, premiumTenantId);
      expect(usage.tier).toBe('premium');
      expect(usage.services).toEqual({ count: 0, limit: null, atLimit: false });
      expect(usage.windows).toEqual({ count: 0, limit: null, atLimit: false });
      expect(usage.users).toEqual({ count: 0, limit: null, atLimit: false });
    });
  });

  describe('assertWithinLimit — block AT the cap (PM decision 1)', () => {
    it('free tenant: allows up to 6 services, blocks the 6th->7th create attempt (i.e. once count===6)', async () => {
      for (let i = 0; i < 6; i++) {
        await expect(assertWithinLimit(prismaRaw, 'services', freeTenantId, TenantTier.Free)).resolves.toBeUndefined();
        await prismaRaw.service.create({
          data: { tenantId: freeTenantId, number: i + 1, name: `Svc ${i + 1}`, icon: 'S', color: '#111111', avgTime: 5 },
        });
      }
      // 6 services now exist — the 7th check must FORBID.
      await expect(assertWithinLimit(prismaRaw, 'services', freeTenantId, TenantTier.Free)).rejects.toThrow(AdminDomainError);
      await expect(assertWithinLimit(prismaRaw, 'services', freeTenantId, TenantTier.Free)).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    });

    it('free tenant: allows up to 4 windows, blocks the 5th', async () => {
      for (let i = 0; i < 4; i++) {
        await expect(assertWithinLimit(prismaRaw, 'windows', freeTenantId, TenantTier.Free)).resolves.toBeUndefined();
        await prismaRaw.window.create({ data: { tenantId: freeTenantId, name: `Win ${i + 1}` } });
      }
      await expect(assertWithinLimit(prismaRaw, 'windows', freeTenantId, TenantTier.Free)).rejects.toThrow(AdminDomainError);
    });

    it('free tenant: allows up to 10 users, blocks the 11th', async () => {
      for (let i = 0; i < 10; i++) {
        await expect(assertWithinLimit(prismaRaw, 'users', freeTenantId, TenantTier.Free)).resolves.toBeUndefined();
        await prismaRaw.user.create({ data: { tenantId: freeTenantId, name: `User ${i + 1}`, role: 'employee', pin: 'x' } });
      }
      await expect(assertWithinLimit(prismaRaw, 'users', freeTenantId, TenantTier.Free)).rejects.toThrow(AdminDomainError);
    });

    it('premium tenant never blocks, no matter how many rows exist', async () => {
      for (let i = 0; i < 8; i++) {
        await prismaRaw.service.create({
          data: { tenantId: premiumTenantId, number: i + 1, name: `P-Svc ${i + 1}`, icon: 'S', color: '#111111', avgTime: 5 },
        });
      }
      await expect(assertWithinLimit(prismaRaw, 'services', premiumTenantId, TenantTier.Premium)).resolves.toBeUndefined();
    });

    it('a free tenant AT its cap does not affect a separate tenant (per-tenant isolation of limits)', async () => {
      // freeTenantId is already at 6/6 services from the earlier test in this describe block.
      const otherFree = await prismaRaw.tenant.create({
        data: { slug: `test-admin-free-isolated-${Date.now()}`, companyName: 'Isolated Free Co.', tagline: 'x', tier: 'free' },
      });
      try {
        await expect(assertWithinLimit(prismaRaw, 'services', otherFree.id, TenantTier.Free)).resolves.toBeUndefined();
        const usage = await getUsage(prismaRaw, otherFree.id);
        expect(usage.services.count).toBe(0);
      } finally {
        await prismaRaw.tenant.delete({ where: { id: otherFree.id } });
      }
    });
  });

  describe('nextServiceNumber', () => {
    it('starts at 1 for a tenant with no services', async () => {
      const tenant = await prismaRaw.tenant.create({
        data: { slug: `test-admin-numbering-${Date.now()}`, companyName: 'Numbering Co.', tagline: 'x', tier: 'free' },
      });
      try {
        await expect(nextServiceNumber(prismaRaw, tenant.id)).resolves.toBe(1);
      } finally {
        await prismaRaw.tenant.delete({ where: { id: tenant.id } });
      }
    });

    it('is contiguous max+1 after a mid-delete (never gap-fills)', async () => {
      const tenant = await prismaRaw.tenant.create({
        data: { slug: `test-admin-numbering-gap-${Date.now()}`, companyName: 'Numbering Gap Co.', tagline: 'x', tier: 'free' },
      });
      try {
        const s1 = await prismaRaw.service.create({
          data: { tenantId: tenant.id, number: await nextServiceNumber(prismaRaw, tenant.id), name: 'S1', icon: 'A', color: '#111111', avgTime: 5 },
        });
        const s2Number = await nextServiceNumber(prismaRaw, tenant.id);
        expect(s2Number).toBe(2);
        const s2 = await prismaRaw.service.create({
          data: { tenantId: tenant.id, number: s2Number, name: 'S2', icon: 'B', color: '#222222', avgTime: 5 },
        });
        const s3Number = await nextServiceNumber(prismaRaw, tenant.id);
        expect(s3Number).toBe(3);
        await prismaRaw.service.create({
          data: { tenantId: tenant.id, number: s3Number, name: 'S3', icon: 'C', color: '#333333', avgTime: 5 },
        });

        // Delete the middle service (number=2) — the gap at 2 must NOT be filled; next is max(1,3)+1=4.
        await prismaRaw.service.delete({ where: { id: s2.id } });
        await expect(nextServiceNumber(prismaRaw, tenant.id)).resolves.toBe(4);

        void s1; // used only to anchor number=1 in the fixture
      } finally {
        await prismaRaw.tenant.delete({ where: { id: tenant.id } });
      }
    });
  });
});
