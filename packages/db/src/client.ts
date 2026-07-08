import { PrismaClient } from '@prisma/client';
import { tenantGuardExtension } from './middleware/tenant-guard.js';

const globalStore = globalThis as unknown as {
  prismaRaw: PrismaClient;
};

/** Unguarded client — for super-admin / system bootstrap where no AsyncLocalStorage context is active. */
export const prismaRaw = globalStore.prismaRaw ?? new PrismaClient();

if (process.env['NODE_ENV'] !== 'production') {
  globalStore.prismaRaw = prismaRaw;
}

/** L6-guarded client — use for all tenant-scoped application queries.
 *  Requires withTenantContext(tenantId, fn) active in the call chain. */
export const prisma = prismaRaw.$extends(tenantGuardExtension);
