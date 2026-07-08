import { createTRPCClient, httpBatchLink, type HTTPHeaders } from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';

/**
 * TODO(S5): Replace this placeholder with the real AppRouter type.
 * Import path: import type { AppRouter } from '../../../apps/web/src/server/api/root.js'
 * Do NOT import from packages/db — Rule 13 prohibits it in api-client.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AppRouter = any;

export type GetHeaders = () => HTTPHeaders | Promise<HTTPHeaders>;

export interface ClientOptions {
  url: string;
  /** Optional header factory — e.g. to inject auth tokens */
  getHeaders?: GetHeaders;
}

/**
 * Creates a vanilla tRPC client (use in Node.js workers, scripts, or outside React).
 * Transformer is set server-side on initTRPC (tRPC v11); client needs no transformer config.
 */
export function createClient({ url, getHeaders }: ClientOptions) {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url,
        ...(getHeaders !== undefined ? { headers: getHeaders } : {}),
      }),
    ],
  });
}

/**
 * Typed tRPC React hooks.
 * Usage in apps/web:
 *   import { trpc, createClient } from '@cuelane/api-client';
 *   const client = createClient({ url: '/api/trpc', getHeaders });
 *   <trpc.Provider client={client} queryClient={queryClient}>...</trpc.Provider>
 */
export const trpc = createTRPCReact<AppRouter>();
