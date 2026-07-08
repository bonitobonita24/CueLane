// Wave 7.6-T3 — shared error translation for every Admin Core CRUD router (service/window/user/
// tenantAdmin). Mirrors queue.ts's local `rethrow` (AdminDomainError → matching TRPCError code);
// factored out once here since 4 sibling router files need the identical mapping.
import { TRPCError } from '@trpc/server';
import { AdminDomainError } from '@/server/domain/admin';

/** Translates an `AdminDomainError` into the matching TRPCError; unknown errors pass through
 *  unchanged (tRPC's default error formatter turns those into INTERNAL_SERVER_ERROR). */
export function rethrowAdmin(e: unknown): never {
  if (e instanceof AdminDomainError) {
    throw new TRPCError({ code: e.code, message: e.message });
  }
  throw e;
}

// Shared id validator for path-style { id } inputs merged with an update*Schema (none of the
// shared package's exported schemas expose a bare `idSchema` — it's a private const in
// packages/shared/src/schemas/index.ts — so every Admin CRUD router validates ids the same way
// here instead of re-declaring the cuid check per file).
import { z } from 'zod';
export const idInputSchema = z.object({ id: z.string().cuid() });

/**
 * Drops `undefined`-valued keys from a partial update payload before handing it to Prisma.
 * Required because `tsconfig.base.json` sets `exactOptionalPropertyTypes: true` — a zod
 * `.partial()` schema types omitted fields as `T | undefined`, which Prisma's generated
 * `*UpdateInput` types reject under that flag (they expect the key absent entirely, not present
 * with an explicit `undefined`). Every Admin CRUD `update` mutation runs its `{ id, ...data }`
 * through this before `prisma.<model>.update({ where, data })`.
 */
// Return type deliberately drops `| undefined` from each value (`Exclude<T[K], undefined>`) rather
// than reusing `Partial<T>` — under `exactOptionalPropertyTypes: true`, a mapped `?:` property
// whose value type still unions `undefined` is NOT the same as "key may be absent"; Prisma's
// generated Update input types require the former.
type Stripped<T> = { [K in keyof T]?: Exclude<T[K], undefined> };

export function stripUndefined<T extends Record<string, unknown>>(obj: T): Stripped<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out as Stripped<T>;
}
