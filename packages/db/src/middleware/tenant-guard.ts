// L6 — Prisma tenant guard. Auto-injects tenantId into every query via $allOperations.
// Uses AsyncLocalStorage so the tenant context travels through async call chains without
// explicit parameter threading.
// CRITICAL: uses $allOperations — never replace with a method list; unlisted methods become
// unguarded bypass vectors.

import { AsyncLocalStorage } from 'node:async_hooks';
import { Prisma } from '@prisma/client';

const tenantStorage = new AsyncLocalStorage<string>();

// Models that are NOT tenant-scoped. Guard passes these through unmodified.
// - Tenant: the root identity table itself
// - AuditLog: platform-level events have no tenant; tenantId is nullable
// - SystemAd: global, managed by Super Admin across all tenants
// - Subscription: webhook handlers operate outside tenant context; guard skipped here
const GLOBAL_MODELS = new Set(['AuditLog', 'Tenant', 'SystemAd', 'Subscription']);

/** Returns the active tenant ID from AsyncLocalStorage. Throws if no context is active. */
export function currentTenantId(): string {
  const id = tenantStorage.getStore();
  if (id === undefined) {
    throw new Error(
      '[L6 tenant-guard] No tenant context active. Wrap the call in withTenantContext(tenantId, fn).'
    );
  }
  return id;
}

/**
 * Runs fn inside a tenant context. All prisma queries within fn will have tenantId
 * automatically injected by the L6 guard extension.
 */
export function withTenantContext<T>(tenantId: string, fn: () => T): T {
  return tenantStorage.run(tenantId, fn);
}

export const tenantGuardExtension = Prisma.defineExtension({
  name: 'tenant-guard',
  query: {
    $allModels: {
      /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call */
      // Prisma $allOperations requires `any` — the callback signature is generic across all
      // models/operations. This is the documented pattern; the eslint disable is intentional.
      async $allOperations(this: any, { args, query, model, operation }: any) {
        if (GLOBAL_MODELS.has(model as string)) return await query(args);
        const tenantId = currentTenantId();

        // Always inject tenantId into WHERE — unconditional so findMany({}) with no where also
        // gets scoped. Covers: findMany, findFirst, findUnique, update, updateMany, delete,
        // deleteMany, count, aggregate, groupBy.
        args.where = { ...args.where, tenantId };

        // Inject tenantId into create/update data. Skip updateMany data to avoid
        // stamping tenantId on bulk-updated rows (WHERE already scopes the update).
        if ((operation === 'create' || operation === 'update') && 'data' in args && !Array.isArray(args.data)) {
          args.data = { ...args.data, tenantId };
        }

        // upsert: inject into create AND update sub-objects (not top-level data key)
        if (operation === 'upsert') {
          if ('create' in args) args.create = { ...args.create, tenantId };
          if ('update' in args && !Array.isArray(args.update)) args.update = { ...args.update, tenantId };
        }

        // createMany: map tenantId into every element in the data array
        if (operation === 'createMany' && Array.isArray(args.data)) {
          args.data = args.data.map((row: any) => ({ ...row, tenantId }));
        }

        return await query(args);
      },
      /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call */
    },
  },
});
