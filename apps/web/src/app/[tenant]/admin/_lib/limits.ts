// Wave 7.6-T6 — pure helpers shared by the Services/Windows/Users admin list pages: whether the
// "Add" action should be disabled (at-cap, non-Premium) and the next-service-number preview shown
// in the Create Service dialog. Kept as plain functions (no DB/tRPC calls) so they're unit-
// testable in this repo's node-environment vitest setup, same convention as _lib/access.ts.
//
// `nextNumberPreview` mirrors `nextServiceNumber` in server/domain/admin.ts (max + 1, not a
// gap-fill) — it's a client-side PREVIEW only; the server is always the source of truth and
// re-derives the real number atomically inside the `service.create` transaction. If two admins
// race, the preview may be off by one; the server number is what actually gets persisted.
export interface EntityUsageLike {
  count: number;
  limit: number | null;
}

/** True when the "Add" button for an entity should be disabled — at or over cap, non-Premium. */
export function isAddDisabled(usage: EntityUsageLike): boolean {
  return usage.limit != null && usage.count >= usage.limit;
}

/** Preview of the next Service.number a create will receive, given the currently-loaded list. */
export function nextNumberPreview(existingNumbers: readonly number[]): number {
  if (existingNumbers.length === 0) return 1;
  return Math.max(...existingNumbers) + 1;
}
