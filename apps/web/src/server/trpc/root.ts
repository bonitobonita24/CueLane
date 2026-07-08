import { createTRPCRouter } from './trpc';
import { healthRouter } from './routers/health';
import { tenantRouter } from './routers/tenant';

// Root application router — extend with feature routers in Phase 4 Parts 5-6
export const appRouter = createTRPCRouter({
  health: healthRouter,
  tenant: tenantRouter,
});

// Export the router type — used by api-client and apps/web typed client
export type AppRouter = typeof appRouter;
