import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import type { NextRequest } from 'next/server';
import { appRouter } from '@/server/trpc/root';
import { createTRPCContext } from '@/server/trpc/context';

const baseOptions = (req: NextRequest) => ({
  endpoint: '/api/trpc',
  req,
  router: appRouter,
  createContext: () => createTRPCContext({ req }),
});

// Use two code paths to avoid exactOptionalPropertyTypes conflict on onError
function handler(req: NextRequest) {
  if (process.env['NODE_ENV'] === 'development') {
    return fetchRequestHandler({
      ...baseOptions(req),
      onError: (opts) => {
        console.error(`tRPC error on ${opts.path ?? '<no-path>'}:`, opts.error);
      },
    });
  }
  return fetchRequestHandler(baseOptions(req));
}

export { handler as GET, handler as POST };
