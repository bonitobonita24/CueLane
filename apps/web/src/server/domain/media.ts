// Wave 7.7c-T2 — Media domain module (Media Manager: PlaylistEntry + TenantAd). Mirrors the
// L2/L6 convention already established in domain/admin.ts: callers pass a transaction/db client
// and every function filters `tenantId` explicitly — never an implicit tenant scope.
//
// Tier source of truth = `Tenant.tier` (same PM decision 5 as admin.ts), never Subscription.tier.
import type { Prisma, PrismaClient } from '@cuelane/db';
import { MEDIA_LIMITS, type TenantTier } from '@cuelane/shared';
import { AdminDomainError } from './admin';

type Db = Prisma.TransactionClient | PrismaClient;

/**
 * Block-AT-cap semantics (same convention as `assertWithinLimit` in admin.ts): throws
 * `AdminDomainError('FORBIDDEN')` once `existingCount >= limit` for the tenant's tier.
 * Counts ALL PlaylistEntry rows (uploaded + YouTube combined) — PRODUCT.md "Max playlist items
 * (uploaded files + YouTube links combined)".
 */
export async function assertWithinPlaylistLimit(db: Db, tenantId: string, tier: TenantTier): Promise<void> {
  const limit = MEDIA_LIMITS[tier].maxPlaylistItems;
  const count = await db.playlistEntry.count({ where: { tenantId } });
  if (count >= limit) {
    throw new AdminDomainError('FORBIDDEN', `Playlist limit reached: ${limit} items max for this tier.`);
  }
}

/**
 * Block-AT-cap for LOCALLY-UPLOADED playlist entries only (`type: 'local'`) — PRODUCT.md
 * "Max saved video files (uploaded to storage)". YouTube-link entries never count against this
 * cap (they consume no storage).
 */
export async function assertWithinUploadedFilesLimit(db: Db, tenantId: string, tier: TenantTier): Promise<void> {
  const limit = MEDIA_LIMITS[tier].maxUploadedFiles;
  const count = await db.playlistEntry.count({ where: { tenantId, type: 'local' } });
  if (count >= limit) {
    throw new AdminDomainError('FORBIDDEN', `Uploaded file limit reached: ${limit} files max for this tier.`);
  }
}

/**
 * Re-applies `sortOrder` to match `orderedIds` (0-indexed position). Validates every id belongs
 * to `tenantId` FIRST (all-or-nothing) — a single foreign/unknown id rejects the whole reorder
 * rather than partially applying it. Not wrapped in `withTenant`/RLS here — callers running this
 * inside an already-tenant-scoped adminProcedure context pass the plain `prisma` (L6-guarded)
 * client, which independently enforces tenant isolation; `db` is typed to accept either.
 */
export async function reorderPlaylistEntries(db: Db, tenantId: string, orderedIds: string[]): Promise<void> {
  const existing = await db.playlistEntry.findMany({ where: { tenantId, id: { in: orderedIds } }, select: { id: true } });
  const existingIds = new Set(existing.map((e) => e.id));
  const unknown = orderedIds.filter((id) => !existingIds.has(id));
  if (unknown.length > 0) {
    throw new AdminDomainError('NOT_FOUND', `Unknown playlist entry id(s): ${unknown.join(', ')}`);
  }
  await Promise.all(orderedIds.map((id, index) => db.playlistEntry.update({ where: { id }, data: { sortOrder: index } })));
}

/** Same all-or-nothing reorder contract as `reorderPlaylistEntries`, for TenantAd. */
export async function reorderTenantAds(db: Db, tenantId: string, orderedIds: string[]): Promise<void> {
  const existing = await db.tenantAd.findMany({ where: { tenantId, id: { in: orderedIds } }, select: { id: true } });
  const existingIds = new Set(existing.map((e) => e.id));
  const unknown = orderedIds.filter((id) => !existingIds.has(id));
  if (unknown.length > 0) {
    throw new AdminDomainError('NOT_FOUND', `Unknown tenant ad id(s): ${unknown.join(', ')}`);
  }
  await Promise.all(orderedIds.map((id, index) => db.tenantAd.update({ where: { id }, data: { sortOrder: index } })));
}
