// In-memory rate limiter — works for single-instance deployments (default).
// For multi-instance (multiple app containers): replace LRUCache with Redis store.
// Import: import { rateLimiters } from '@/server/lib/rate-limit'

import { LRUCache } from 'lru-cache';
import { TRPCError } from '@trpc/server';

type Options = {
  uniqueTokenPerInterval?: number;
  interval?: number;
  limit?: number;
};

export function rateLimit(options?: Options) {
  const tokenCache = new LRUCache<string, number[]>({
    max: options?.uniqueTokenPerInterval ?? 500,
    ttl: options?.interval ?? 60_000,
  });

  return {
    check: (token: string, limit?: number) => {
      const maxRequests = limit ?? options?.limit ?? 60;
      const existing = tokenCache.get(token) ?? [];
      const now = Date.now();
      const windowStart = now - (options?.interval ?? 60_000);
      const requestsInWindow = existing.filter((t) => t > windowStart);

      if (requestsInWindow.length >= maxRequests) {
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: 'Rate limit exceeded. Try again later.',
        });
      }

      tokenCache.set(token, [...requestsInWindow, now]);
    },
  };
}

export const rateLimiters = {
  // Public endpoints (unauthenticated) — strict (30 req/min)
  public: rateLimit({ interval: 60_000, limit: 30 }),
  // Auth endpoints (login, register, password reset) — very strict (10 req/min)
  auth: rateLimit({ interval: 60_000, limit: 10 }),
  // PIN auth — very strict with lockout (10 req/min)
  pinAuth: rateLimit({ interval: 60_000, limit: 10 }),
  // Authenticated API calls — generous (120 req/min)
  api: rateLimit({ interval: 60_000, limit: 120 }),
  // File upload — conservative (20 req/min)
  upload: rateLimit({ interval: 60_000, limit: 20 }),
  // Password reset — hourly (5 req/hr per email)
  passwordReset: rateLimit({ interval: 3_600_000, limit: 5 }),
};
