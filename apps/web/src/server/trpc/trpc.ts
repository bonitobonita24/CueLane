import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import type { Context } from './context';
import { rateLimiters } from '@/server/lib/rate-limit';

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
// Export raw middleware builder so rbac/tenant guards share the same t instance
export const middleware = t.middleware;

// Derive the client IP for rate-limiting.
// Priority: x-real-ip (set by nginx/Cloudflare, cannot be spoofed by clients)
// → last entry in x-forwarded-for (added by a trusted upstream proxy)
// → 'unknown' (rate-limit all unknown-origin requests to a shared bucket).
// SECURITY: Never use the FIRST x-forwarded-for entry as the rate-limit key —
// it is attacker-controlled and can be rotated to bypass per-IP limits.
function extractClientIp(req: { headers: { get(name: string): string | null } }): string {
  const realIp = req.headers.get('x-real-ip');
  if (realIp != null && realIp !== '') return realIp;

  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded != null && forwarded !== '') {
    // Last entry is the IP appended by the closest trusted proxy (least spoofable)
    const last = forwarded.split(',').at(-1)?.trim();
    if (last != null && last !== '') return last;
  }

  return 'unknown';
}

// Public procedure — applies public rate limiting (30 req/min per IP)
export const publicProcedure = t.procedure.use(({ ctx, next }) => {
  rateLimiters.public.check(extractClientIp(ctx.req));
  return next({ ctx });
});

// Protected procedure — requires a valid session + API rate limiting.
// Guards against both null userId (no session) AND empty-string userId
// (stale JWT from before the jwt callback was wired: String(undefined ?? '') = '').
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (ctx.session == null || ctx.userId == null || ctx.userId === '') {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  rateLimiters.api.check(ctx.userId);
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
      userId: ctx.userId,
    },
  });
});
