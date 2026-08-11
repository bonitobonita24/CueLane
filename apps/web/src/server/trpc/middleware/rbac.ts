import { TRPCError } from '@trpc/server';
import { middleware } from '../trpc';
import type { Role } from '@cuelane/shared';

// L3 RBAC — always active. Throw FORBIDDEN if caller lacks any of the allowed roles.
// Usage: protectedProcedure.use(requireRole(Role.TenantAdmin, Role.TenantManager))
export const requireRole = (...allowedRoles: Role[]) =>
  middleware(({ ctx, next }) => {
    const hasRole = ctx.roles.some((r) => allowedRoles.includes(r));
    if (!hasRole) {
      throw new TRPCError({ code: 'FORBIDDEN' });
    }
    return next({ ctx });
  });
