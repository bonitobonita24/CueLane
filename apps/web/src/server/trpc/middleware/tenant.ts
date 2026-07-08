import { TRPCError } from '@trpc/server';
import { middleware } from '../trpc';

// L1 Tenant Guard — asserts that ctx.tenantId is set.
// Super admins (tenantId=null, role=super_admin) bypass this guard.
// Usage: protectedProcedure.use(requireTenant)
export const requireTenant = middleware(({ ctx, next }) => {
  const isSuperAdmin = ctx.roles.includes('super_admin' as (typeof ctx.roles)[number]);

  if (!isSuperAdmin && ctx.tenantId == null) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'No tenant context in session.',
    });
  }

  return next({ ctx });
});
