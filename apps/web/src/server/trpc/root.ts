import { createTRPCRouter } from './trpc';
import { healthRouter } from './routers/health';
import { tenantRouter } from './routers/tenant';
import { queueRouter } from './routers/queue';
import { stationRouter } from './routers/station';
import { serviceRouter } from './routers/service';
import { windowRouter } from './routers/window';
import { userRouter } from './routers/user';
import { platformUserRouter } from './routers/platformUser';
import { tenantAdminRouter } from './routers/tenantAdmin';
import { dashboardRouter } from './routers/dashboard';
import { mediaRouter } from './routers/media';
import { tenantAdRouter } from './routers/tenantAd';
import { displayRouter } from './routers/display';
import { superAdminRouter } from './routers/superAdmin';
import { authRouter } from './routers/auth';

// Root application router — extend with feature routers in Phase 4 Parts 5-6
export const appRouter = createTRPCRouter({
  health: healthRouter,
  tenant: tenantRouter,
  queue: queueRouter,
  station: stationRouter,
  service: serviceRouter,
  window: windowRouter,
  user: userRouter,
  platformUser: platformUserRouter,
  tenantAdmin: tenantAdminRouter,
  dashboard: dashboardRouter,
  media: mediaRouter,
  tenantAd: tenantAdRouter,
  display: displayRouter,
  superAdmin: superAdminRouter,
  auth: authRouter,
});

// Export the router type — used by api-client and apps/web typed client
export type AppRouter = typeof appRouter;
