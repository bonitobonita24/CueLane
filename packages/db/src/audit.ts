// L5 — AuditLog write helper. Always active in both single and multi-tenant modes.
// Call inside a transaction so audit record and the mutation commit atomically.

import { type Prisma } from '@prisma/client';

export interface AuditLogEntry {
  tenantId?: string | null;
  userId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  entity: string;  // table name, e.g. 'tickets'
  entityId: string;
  before?: unknown;
  after?: unknown;
}

export async function writeAuditLog(
  tx: Prisma.TransactionClient,
  { tenantId, userId, action, entity, entityId, before, after }: AuditLogEntry
): Promise<void> {
  await tx.auditLog.create({
    data: {
      tenantId: tenantId ?? null,
      userId,
      action,
      entity,
      entityId,
      // Prisma NullableJson: pass Prisma.JsonNull for explicit null, omit key to leave as DB null
      ...(before !== undefined ? { before: before as Prisma.InputJsonValue } : {}),
      ...(after !== undefined ? { after: after as Prisma.InputJsonValue } : {}),
    },
  });
}
