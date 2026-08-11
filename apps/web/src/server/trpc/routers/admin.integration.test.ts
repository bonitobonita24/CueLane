// Wave 7.6-T8 — cross-cutting Admin Core CRUD integration harness. Drives the FULL matrix
// (services/windows/users limits + settings round-trip) against MULTIPLE independent, freshly
// created ephemeral tenants — proving tenant-agnosticism end-to-end, per the owner's hard
// multi-tenancy requirement: "design this in a real multi-tenant setup to avoid re-setting up
// later."
//
// What this file specifically proves (owner add-on, verbatim requirements):
//  (a) each tenant's Admin sees/mutates ONLY its own services/windows/users/settings
//  (b) a brand-new tenant (Tenant C, created mid-test, not part of any earlier setup) works with
//      NO seed/bootstrapping beyond the normal create path — same routers, zero special-casing
//  (c) limits are enforced per-tenant independently — Tenant A sitting AT its cap never blocks
//      Tenant B or Tenant C
//  NO super_admin session is ever constructed anywhere in this file — every caller is a
//  tenant-scoped Admin session (the CRITICAL testing rule this whole wave was built under).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NextRequest } from 'next/server';
import { prismaRaw } from '@cuelane/db';
import { Role, SERVICE_ICON_OPTIONS, SERVICE_COLOR_OPTIONS } from '@cuelane/shared';
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
/** Always a tenant-Admin session — NEVER super_admin (this wave's non-negotiable testing rule). */
function adminCallerFor(tenantId: string, userId: string) {
  return createCaller(
    ctxFor({ session: { user: { id: userId } } as unknown as Context['session'], userId, roles: [Role.TenantSuperadmin], tenantId }),
  );
}

async function makeFreeTenant(label: string): Promise<{ tenantId: string; adminId: string }> {
  const tenant = await prismaRaw.tenant.create({
    data: { slug: `test-admin-integ-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, companyName: `Integ ${label}`, tagline: 'x', tier: 'free' },
  });
  const admin = await prismaRaw.user.create({ data: { tenantId: tenant.id, name: `Admin ${label}`, role: 'tenant_superadmin', pin: 'x' } });
  return { tenantId: tenant.id, adminId: admin.id };
}

/** Runs the full services (1..6 contiguous + 7th FORBIDDEN) / windows (1..4 + 5th FORBIDDEN) /
 *  users (up to 10, counting the 1 seeded admin, + 11th FORBIDDEN) matrix against a single fresh
 *  tenant, driven entirely through the caller's own routers — no direct DB writes for the entity
 *  types under test (only the tenant/admin-user fixture itself is created directly). */
async function runFullAdminMatrix(tenantId: string, adminId: string): Promise<void> {
  const admin = adminCallerFor(tenantId, adminId);

  // ── Services: 1..6 contiguous, 7th FORBIDDEN ──────────────────────────────
  for (let i = 0; i < 6; i++) {
    const svc = await admin.service.create({
      name: `Svc ${i + 1}`,
      icon: SERVICE_ICON_OPTIONS[i % SERVICE_ICON_OPTIONS.length]!,
      color: SERVICE_COLOR_OPTIONS[i % SERVICE_COLOR_OPTIONS.length]!,
      avgTime: 5,
    });
    expect(svc.number).toBe(i + 1);
  }
  const services = await admin.service.list();
  expect(services.map((s) => s.number)).toEqual([1, 2, 3, 4, 5, 6]);
  await expect(
    admin.service.create({ name: 'Overflow', icon: SERVICE_ICON_OPTIONS[0], color: SERVICE_COLOR_OPTIONS[0], avgTime: 5 }),
  ).rejects.toMatchObject({ code: 'FORBIDDEN' });

  // ── Windows: 1..4, 5th FORBIDDEN ──────────────────────────────────────────
  for (let i = 0; i < 4; i++) {
    await admin.window.create({ name: `Window ${i + 1}` });
  }
  const windows = await admin.window.list();
  expect(windows.length).toBe(4);
  await expect(admin.window.create({ name: 'Overflow' })).rejects.toMatchObject({ code: 'FORBIDDEN' });

  // ── Users: cap is 10 total, 1 already exists (the fixture admin) — create 9 more, 11th FORBIDDEN
  for (let i = 0; i < 9; i++) {
    await admin.user.create({ name: `User ${i + 1}`, role: Role.Employee, pin: '1234', services: [] });
  }
  const users = await admin.user.list();
  expect(users.length).toBe(10);
  await expect(admin.user.create({ name: 'Overflow', role: Role.Employee, pin: '1234', services: [] })).rejects.toMatchObject({
    code: 'FORBIDDEN',
  });

  // ── Settings round-trip ────────────────────────────────────────────────────
  const updated = await admin.tenantAdmin.updateSettings({
    settings: { theme: 'emerald', tickerText: `Hello from ${tenantId}` },
  });
  expect((updated.settings as { theme?: string }).theme).toBe('emerald');
  expect((updated.settings as { tickerText?: string }).tickerText).toBe(`Hello from ${tenantId}`);

  // ── getUsage reflects reality: at-cap on every limited entity ─────────────
  const usage = await admin.tenantAdmin.getUsage();
  expect(usage.services).toEqual({ count: 6, limit: 6, atLimit: true });
  expect(usage.windows).toEqual({ count: 4, limit: 4, atLimit: true });
  expect(usage.users).toEqual({ count: 10, limit: 10, atLimit: true });
}

describe('Admin Core CRUD — cross-tenant integration harness (Wave 7.6-T8)', () => {
  let tenantA: { tenantId: string; adminId: string };
  let tenantB: { tenantId: string; adminId: string };
  let tenantC: { tenantId: string; adminId: string } | undefined;
  const cleanupTenantIds: string[] = [];

  beforeAll(async () => {
    tenantA = await makeFreeTenant('A');
    tenantB = await makeFreeTenant('B');
    cleanupTenantIds.push(tenantA.tenantId, tenantB.tenantId);
  });

  afterAll(async () => {
    await prismaRaw.tenant.deleteMany({ where: { id: { in: cleanupTenantIds } } });
  });

  it('runs the full services/windows/users/settings matrix against Tenant A independently', async () => {
    await runFullAdminMatrix(tenantA.tenantId, tenantA.adminId);
  });

  it('runs the SAME full matrix against Tenant B — proving Tenant A being fully AT CAP never blocks Tenant B (independent per-tenant limits)', async () => {
    await runFullAdminMatrix(tenantB.tenantId, tenantB.adminId);
  });

  it('(c) independent limits — re-confirms Tenant A is still exactly at its own cap after Tenant B ran the identical matrix', async () => {
    const adminA = adminCallerFor(tenantA.tenantId, tenantA.adminId);
    const usage = await adminA.tenantAdmin.getUsage();
    expect(usage.services.count).toBe(6);
    expect(usage.windows.count).toBe(4);
    expect(usage.users.count).toBe(10);
  });

  it('(a) tenant isolation — Tenant A admin sees ONLY Tenant A rows, Tenant B admin sees ONLY Tenant B rows', async () => {
    const adminA = adminCallerFor(tenantA.tenantId, tenantA.adminId);
    const adminB = adminCallerFor(tenantB.tenantId, tenantB.adminId);

    const [servicesA, servicesB, windowsA, windowsB, usersA, usersB] = await Promise.all([
      adminA.service.list(),
      adminB.service.list(),
      adminA.window.list(),
      adminB.window.list(),
      adminA.user.list(),
      adminB.user.list(),
    ]);

    const idsA = new Set([...servicesA.map((s) => s.id), ...windowsA.map((w) => w.id), ...usersA.map((u) => u.id)]);
    const idsB = new Set([...servicesB.map((s) => s.id), ...windowsB.map((w) => w.id), ...usersB.map((u) => u.id)]);
    for (const id of idsA) expect(idsB.has(id)).toBe(false);
    for (const id of idsB) expect(idsA.has(id)).toBe(false);

    // Every row Tenant A's admin sees genuinely belongs to Tenant A (ground-truth via prismaRaw).
    for (const s of servicesA) {
      const row = await prismaRaw.service.findUniqueOrThrow({ where: { id: s.id } });
      expect(row.tenantId).toBe(tenantA.tenantId);
    }

    // Tenant A's settings patch (from the matrix run) never touched Tenant B's settings.
    const settingsA = await adminA.tenantAdmin.getSettings();
    const settingsB = await adminB.tenantAdmin.getSettings();
    expect((settingsA.settings as { tickerText?: string }).tickerText).toBe(`Hello from ${tenantA.tenantId}`);
    expect((settingsB.settings as { tickerText?: string }).tickerText).toBe(`Hello from ${tenantB.tenantId}`);
  });

  it('(a) cross-tenant mutation attempts are rejected — Tenant B admin cannot update/delete a Tenant A service', async () => {
    const adminA = adminCallerFor(tenantA.tenantId, tenantA.adminId);
    const adminB = adminCallerFor(tenantB.tenantId, tenantB.adminId);
    const [svcA] = await adminA.service.list();
    expect(svcA).toBeDefined();

    await expect(adminB.service.update({ id: svcA!.id, name: 'Hijacked by B' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(adminB.service.delete({ id: svcA!.id })).rejects.toMatchObject({ code: 'NOT_FOUND' });

    // Ground truth: the row is untouched.
    const stillA = await prismaRaw.service.findUniqueOrThrow({ where: { id: svcA!.id } });
    expect(stillA.name).not.toBe('Hijacked by B');
    expect(stillA.tenantId).toBe(tenantA.tenantId);
  });

  it('(b) a BRAND-NEW Tenant C — created here, never touched by any earlier setup or fixture — works with zero bootstrapping', async () => {
    tenantC = await makeFreeTenant('C');
    cleanupTenantIds.push(tenantC.tenantId);

    const adminC = adminCallerFor(tenantC.tenantId, tenantC.adminId);

    // No special-casing: the exact same create/list calls every other tenant in this suite used.
    const svc = await adminC.service.create({ name: 'C Svc 1', icon: SERVICE_ICON_OPTIONS[0], color: SERVICE_COLOR_OPTIONS[0], avgTime: 5 });
    expect(svc.number).toBe(1); // starts fresh at 1 — no leaked numbering from A/B

    const win = await adminC.window.create({ name: 'C Window 1' });
    expect(win.name).toBe('C Window 1');

    const usage = await adminC.tenantAdmin.getUsage();
    expect(usage.services).toEqual({ count: 1, limit: 6, atLimit: false });
    expect(usage.windows).toEqual({ count: 1, limit: 4, atLimit: false });
    expect(usage.users).toEqual({ count: 1, limit: 10, atLimit: false }); // just the fixture admin

    // Tenant C is fully isolated from A and B despite running the identical code path.
    const listA = await adminCallerFor(tenantA.tenantId, tenantA.adminId).service.list();
    expect(listA.find((s) => s.id === svc.id)).toBeUndefined();
  });

  it('(c) Tenant C at 1/6 services is unaffected by Tenant A sitting at 6/6 — limits are per-tenant, not global', async () => {
    expect(tenantC).toBeDefined();
    const adminC = adminCallerFor(tenantC!.tenantId, tenantC!.adminId);
    // Tenant A (from the earlier test in this file) is fully at cap; Tenant C must still create freely.
    const svc = await adminC.service.create({ name: 'C Svc 2', icon: SERVICE_ICON_OPTIONS[1], color: SERVICE_COLOR_OPTIONS[1], avgTime: 5 });
    expect(svc.number).toBe(2);
  });
});
