// Wave 7.6-T2 — Admin domain module. Shared helpers for the Wave 7.6 Admin Core CRUD routers
// (service/window/user/tenantAdmin). Mirrors the L2/L6 convention from server/domain/queue.ts:
// callers pass a transaction/db client (`Prisma.TransactionClient` or the raw `PrismaClient`) and
// this module filters `tenantId` explicitly on every query — NEVER trust an implicit tenant
// scope, and NEVER let a caller omit the tenantId filter.
//
// Tier source of truth = `Tenant.tier` (PM decision 5, docs/DECISIONS_LOG.md 2026-07-08) — NOT
// Subscription.tier, which can drift.
//
// Multi-tenancy hard requirement (owner add-on): every function here takes tenantId as an
// explicit parameter resolved by the CALLER from request context (session) — this module never
// hardcodes or assumes a tenant. A brand-new tenant needs zero changes here: `getUsage` and
// `assertWithinLimit` both read counts fresh from the DB, scoped to whatever tenantId is passed.

import type { Prisma, PrismaClient } from '@cuelane/db';
import { TIER_LIMITS, TenantTier } from '@cuelane/shared';

type Db = Prisma.TransactionClient | PrismaClient;

/** Domain-layer error — the router translates `code` into the matching TRPCError code. */
export class AdminDomainError extends Error {
  public readonly code: 'FORBIDDEN' | 'NOT_FOUND' | 'BAD_REQUEST';

  constructor(code: 'FORBIDDEN' | 'NOT_FOUND' | 'BAD_REQUEST', message: string) {
    super(message);
    this.name = 'AdminDomainError';
    this.code = code;
  }
}

export type LimitedEntity = 'users' | 'services' | 'windows';

export interface EntityUsage {
  count: number;
  limit: number | null; // null = unlimited (premium)
  atLimit: boolean;
}

export interface Usage {
  tier: TenantTier;
  users: EntityUsage;
  services: EntityUsage;
  windows: EntityUsage;
}

async function countEntity(db: Db, entity: LimitedEntity, tenantId: string): Promise<number> {
  switch (entity) {
    case 'users':
      return db.user.count({ where: { tenantId } });
    case 'services':
      return db.service.count({ where: { tenantId } });
    case 'windows':
      return db.window.count({ where: { tenantId } });
  }
}

/**
 * Reads the tenant's current usage against its tier's caps (PM decision 1 — TIER_LIMITS).
 * `Tenant` is a GLOBAL_MODEL (bypasses the L6 guard) so a plain `db.tenant.findUnique` needs no
 * tenant-context wrap; every other read below is explicitly `tenantId`-filtered.
 */
export async function getUsage(db: Db, tenantId: string): Promise<Usage> {
  const tenant = await db.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { tier: true } });
  const limits = TIER_LIMITS[tenant.tier as TenantTier];

  const [users, services, windows] = await Promise.all([
    countEntity(db, 'users', tenantId),
    countEntity(db, 'services', tenantId),
    countEntity(db, 'windows', tenantId),
  ]);

  const build = (count: number, limit: number | null | undefined): EntityUsage => {
    const l = limit ?? null;
    return { count, limit: l, atLimit: l != null && count >= l };
  };

  return {
    tier: tenant.tier as TenantTier,
    users: build(users, limits?.users),
    services: build(services, limits?.services),
    windows: build(windows, limits?.windows),
  };
}

/**
 * Block-AT-cap semantics (PM decision 1): throws `AdminDomainError('FORBIDDEN')` when
 * `existingCount >= limit` for the given tier. Premium (`limits === null`) never blocks. Callers
 * pass the ALREADY-RESOLVED tier for this request's tenant (router reads `Tenant.tier` — decision
 * 5) so this function never has to re-derive tier itself, and never assumes a tenant.
 */
export async function assertWithinLimit(
  db: Db,
  entity: LimitedEntity,
  tenantId: string,
  tier: TenantTier,
): Promise<void> {
  const limits = TIER_LIMITS[tier];
  if (limits == null) return; // premium — unlimited

  const limit = limits[entity];
  const count = await countEntity(db, entity, tenantId);
  if (count >= limit) {
    throw new AdminDomainError('FORBIDDEN', `Free tier limit reached: ${limit} ${entity} max.`);
  }
}

/**
 * Per-tenant next Service.number — `max(number) + 1`, never a gap-fill. SequenceCounter (T1's
 * atomic allocator) is TICKET-only (see queue.ts) — Service.number has no counterpart, so this
 * derives it directly from the current max. Not race-safe under true concurrency (fine: Admin
 * CRUD is a low-frequency, single-admin-at-a-time surface, unlike ticket issuance).
 */
export async function nextServiceNumber(db: Db, tenantId: string): Promise<number> {
  const agg = await db.service.aggregate({ where: { tenantId }, _max: { number: true } });
  return (agg._max.number ?? 0) + 1;
}
