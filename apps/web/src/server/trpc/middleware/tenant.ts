import { TRPCError } from '@trpc/server';
import { Role } from '@cuelane/shared';
import { middleware } from '../trpc';

// L1 Tenant Guard — asserts that ctx.tenantId is set.
// Super admins (tenantId=null, role=tenant_manager) bypass this guard.
// Usage: protectedProcedure.use(requireTenant)
export const requireTenant = middleware(({ ctx, next }) => {
  const isSuperAdmin = ctx.roles.includes(Role.TenantManager);

  if (!isSuperAdmin && ctx.tenantId == null) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'No tenant context in session.',
    });
  }

  return next({ ctx });
});
