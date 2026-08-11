export { prisma, prismaRaw } from './client.js';
export { withTenant } from './rls.js';
export { writeAuditLog, type AuditLogEntry } from './audit.js';
export { tenantGuardExtension, currentTenantId, withTenantContext } from './middleware/tenant-guard.js';
export * from './repositories/index.js';

// Re-export Prisma namespace for consumers that need types
export { Prisma, type PrismaClient } from '@prisma/client';

// RBAC view-access retrofit (Wave 0b): FeatureKey/RolePreset enums used by
// apps/web/src/lib/rbac/* — re-exported here so consumers never import '@prisma/client' directly.
export { FeatureKey, RolePreset, UserRole } from '@prisma/client';
