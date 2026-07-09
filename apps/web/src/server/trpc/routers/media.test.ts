// Wave 7.7c-T2 — mediaRouter tRPC tests (TDD: written before the router implementation).
// Mirrors window.test.ts/service.test.ts conventions: fresh ephemeral fixture tenants (never the
// seeded `demo`/`clinic` tenants), every caller a tenant-ADMIN session (never super_admin),
// explicit cross-tenant + Employee-rejection + tier-limit assertions.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NextRequest } from 'next/server';
import { prismaRaw } from '@cuelane/db';
import { Role, MediaType } from '@cuelane/shared';
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

describe('mediaRouter (Wave 7.7c-T2)', () => {
  let tenantAId: string; // free
  let adminAId: string;
  let employeeAId: string;

  let tenantBId: string; // premium
  let adminBId: string;

  beforeAll(async () => {
    const tenantA = await prismaRaw.tenant.create({
      data: { slug: `test-media-a-${Date.now()}`, companyName: 'Media Tenant A', tagline: 'x', tier: 'free' },
    });
    tenantAId = tenantA.id;
    adminAId = (await prismaRaw.user.create({ data: { tenantId: tenantAId, name: 'Admin A', role: 'admin', pin: 'x' } })).id;
    employeeAId = (await prismaRaw.user.create({ data: { tenantId: tenantAId, name: 'Emp A', role: 'employee', pin: 'x' } })).id;

    const tenantB = await prismaRaw.tenant.create({
      data: { slug: `test-media-b-${Date.now()}`, companyName: 'Media Tenant B', tagline: 'x', tier: 'premium' },
    });
    tenantBId = tenantB.id;
    adminBId = (await prismaRaw.user.create({ data: { tenantId: tenantBId, name: 'Admin B', role: 'admin', pin: 'x' } })).id;
  });

  afterAll(async () => {
    await prismaRaw.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } });
  });

  it('creates a YouTube playlist entry and lists it ordered by sortOrder', async () => {
    const admin = adminCallerFor(tenantAId, adminAId);
    const created = await admin.media.createYoutube({ type: MediaType.YouTube, title: 'Intro Video', videoId: 'dQw4w9WgXcQ', isLive: false });
    expect(created.type).toBe('youtube');
    const list = await admin.media.list();
    expect(list.map((e) => e.id)).toContain(created.id);
  });

  it('blocks the 4th playlist entry on a free tenant (max 3 items)', async () => {
    const admin = adminCallerFor(tenantAId, adminAId);
    // tenantAId already has 1 entry from the prior test.
    await admin.media.createYoutube({ type: MediaType.YouTube, title: 'Vid 2', videoId: 'dQw4w9WgXcQ', isLive: false });
    const list = await admin.media.list();
    expect(list.length).toBe(2);
    await admin.media.createYoutube({ type: MediaType.YouTube, title: 'Vid 3', videoId: 'dQw4w9WgXcQ', isLive: false });
    expect((await admin.media.list()).length).toBe(3);

    await expect(
      admin.media.createYoutube({ type: MediaType.YouTube, title: 'Overflow', videoId: 'dQw4w9WgXcQ', isLive: false }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it("rejects a 'local' type payload on createYoutube (BAD_REQUEST — use the upload route)", async () => {
    const admin = adminCallerFor(tenantBId, adminBId);
    await expect(
      admin.media.createYoutube({
        type: MediaType.Local,
        title: 'Should fail',
        storageKey: `${tenantBId}/media/abc123.mp4`,
        fileName: 'clip.mp4',
        fileSize: 1000,
        fileExt: 'mp4',
      } as never),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('reorders playlist entries within a tenant', async () => {
    const admin = adminCallerFor(tenantBId, adminBId);
    const e1 = await admin.media.createYoutube({ type: MediaType.YouTube, title: 'B1', videoId: 'dQw4w9WgXcQ', isLive: false });
    const e2 = await admin.media.createYoutube({ type: MediaType.YouTube, title: 'B2', videoId: 'dQw4w9WgXcQ', isLive: false });
    await admin.media.reorder({ orderedIds: [e2.id, e1.id] });
    const list = await admin.media.list();
    expect(list.map((e) => e.id)).toEqual([e2.id, e1.id]);
  });

  it('cross-tenant delete/reorder → rejected', async () => {
    const adminA = adminCallerFor(tenantAId, adminAId);
    const adminB = adminCallerFor(tenantBId, adminBId);
    const [entryA] = await adminA.media.list();
    expect(entryA).toBeDefined();

    await expect(adminB.media.delete({ id: entryA!.id })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(adminB.media.reorder({ orderedIds: [entryA!.id] })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('deletes a playlist entry (same-tenant admin)', async () => {
    const admin = adminCallerFor(tenantBId, adminBId);
    const [entry] = await admin.media.list();
    expect(entry).toBeDefined();
    const deleted = await admin.media.delete({ id: entry!.id });
    expect(deleted.id).toBe(entry!.id);
    expect((await admin.media.list()).find((e) => e.id === entry!.id)).toBeUndefined();
  });

  it('an Employee-role caller is rejected with FORBIDDEN', async () => {
    const employee = employeeCallerFor(tenantAId, employeeAId);
    await expect(employee.media.list()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      employee.media.createYoutube({ type: MediaType.YouTube, title: 'Nope', videoId: 'dQw4w9WgXcQ', isLive: false }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
