import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../trpc';

export const healthRouter = createTRPCRouter({
  ping: publicProcedure
    .meta({ openapi: { method: 'GET', path: '/health/ping' } })
    .input(z.void())
    .output(z.object({ ok: z.boolean(), ts: z.number() }))
    .query(() => ({ ok: true, ts: Date.now() })),
});
