// L2 — PostgreSQL Row-Level Security helper.
// Sets app.current_tenant_id for the duration of a transaction so RLS policies
// on all tenant-scoped tables enforce isolation at the DB level.

import { type Prisma } from '@prisma/client';
import { prismaRaw } from './client.js';

export async function withTenant<T>(
  tenantId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return prismaRaw.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
    return fn(tx);
  });
}
