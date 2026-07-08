export { prisma, prismaRaw } from './client.js';
export { withTenant } from './rls.js';
export { writeAuditLog, type AuditLogEntry } from './audit.js';
export { tenantGuardExtension, currentTenantId, withTenantContext } from './middleware/tenant-guard.js';
export * from './repositories/index.js';

// Re-export Prisma namespace for consumers that need types
export { Prisma, type PrismaClient } from '@prisma/client';
