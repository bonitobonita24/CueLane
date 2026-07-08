import { createTRPCRouter } from './trpc';
import { healthRouter } from './routers/health';
import { tenantRouter } from './routers/tenant';
import { queueRouter } from './routers/queue';
import { stationRouter } from './routers/station';
import { serviceRouter } from './routers/service';
import { windowRouter } from './routers/window';

// Root application router — extend with feature routers in Phase 4 Parts 5-6
export const appRouter = createTRPCRouter({
  health: healthRouter,
  tenant: tenantRouter,
  queue: queueRouter,
  station: stationRouter,
  service: serviceRouter,
  window: windowRouter,
});

// Export the router type — used by api-client and apps/web typed client
export type AppRouter = typeof appRouter;
