import { createTRPCClient, httpBatchLink, type HTTPHeaders } from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';

// AppRouter is kept as `any` here to avoid a circular dependency:
// apps/web depends on @cuelane/api-client, so api-client cannot import from apps/web.
// For strongly-typed usage IN apps/web, import from '@/lib/trpc' instead:
//   import { trpc } from '@/lib/trpc';   ← typed with real AppRouter
// This any-typed export is for cross-package consumers (e.g. apps/worker).
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
 * Untyped tRPC React hooks — for use outside apps/web.
 * In apps/web, use the typed version from '@/lib/trpc' instead.
 */
export const trpc = createTRPCReact<AppRouter>();
