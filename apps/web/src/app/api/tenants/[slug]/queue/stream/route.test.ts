// Wave 7.2-T3 — SSE route handler tests: tenant→channel resolution + 404 path. Runs against the
// REAL dev Postgres DB (no mocks, per framework convention), using the seeded `demo` tenant plus
// an ephemeral suspended fixture to prove the 404/suspended path.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prismaRaw } from '@cuelane/db';
import { resolveTenantIdBySlug } from '@/server/realtime/resolveTenant';
import { queueChannel } from '@/server/realtime/publisher';

describe('SSE stream route — tenant resolution (Wave 7.2)', () => {
  let suspendedSlug: string;

  beforeAll(async () => {
    suspendedSlug = `test-suspended-${Date.now()}`;
    await prismaRaw.tenant.create({
      data: {
        slug: suspendedSlug,
        companyName: 'Suspended Co.',
        tagline: 'suspended fixture',
        tier: 'free',
        status: 'suspended',
      },
    });
  });

  afterAll(async () => {
    await prismaRaw.tenant.deleteMany({ where: { slug: suspendedSlug } });
  });

  it('resolves the known, active seeded demo tenant to its id', async () => {
    const demo = await prismaRaw.tenant.findUniqueOrThrow({ where: { slug: 'demo' } });
    const resolved = await resolveTenantIdBySlug('demo');
    expect(resolved).toBe(demo.id);
  });

  it('returns null for an unknown slug (route returns 404)', async () => {
    const resolved = await resolveTenantIdBySlug(`does-not-exist-${Date.now()}`);
    expect(resolved).toBeNull();
  });

  it('returns null for a suspended tenant (route returns 404, never streams a suspended tenant)', async () => {
    const resolved = await resolveTenantIdBySlug(suspendedSlug);
    expect(resolved).toBeNull();
  });

  it('derives a distinct, strictly per-tenant channel name for the resolved id', async () => {
    const demo = await prismaRaw.tenant.findUniqueOrThrow({ where: { slug: 'demo' } });
    const channel = queueChannel(demo.id);
    expect(channel).toBe(`tenant:${demo.id}:queue`);
    expect(channel).not.toBe(queueChannel('some-other-tenant-id'));
  });
});
