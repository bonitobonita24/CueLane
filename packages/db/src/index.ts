export { prisma, prismaRaw } from './client';
export { withTenant } from './rls';
export { writeAuditLog, type AuditLogEntry } from './audit';
export { tenantGuardExtension, currentTenantId, withTenantContext } from './middleware/tenant-guard';
export * from './repositories/index';

// Re-export Prisma namespace for consumers that need types
export { Prisma, type PrismaClient } from '@prisma/client';
