// Typed tRPC client for use within apps/web.
// This imports the real AppRouter type (no circular dep since we're IN apps/web).
// For cross-package consumers (worker, scripts), use @cuelane/api-client instead.
import type { AppRouter } from '@/server/trpc/root';
import { createTRPCReact } from '@trpc/react-query';
import { createTRPCClient, httpBatchLink, type HTTPHeaders } from '@trpc/client';
import superjson from 'superjson';

export const trpc = createTRPCReact<AppRouter>();

export function createClient(
  url: string,
  getHeaders?: () => HTTPHeaders | Promise<HTTPHeaders>,
) {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url,
        transformer: superjson,
        ...(getHeaders !== undefined ? { headers: getHeaders } : {}),
      }),
    ],
  });
}
