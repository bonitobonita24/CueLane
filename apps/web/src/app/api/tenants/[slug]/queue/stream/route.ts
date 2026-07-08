// Wave 7.2-T3 — SSE stream route handler. Server→client fanout for a tenant's queue events.
//
// Transport choice (PM [HOW], locked in docs/DECISIONS_LOG.md): SSE, not WebSocket — `next start`
// standalone has no custom server, and the need here is pure server→client push (no client→server
// realtime messages), which SSE covers natively via a Route Handler `ReadableStream`.
//
// Tenant resolution follows the same pattern as `kioskProcedure`
// (apps/web/src/server/trpc/trpc.ts): resolve tenantId via the UNGUARDED `prismaRaw` client (no
// AsyncLocalStorage tenant context exists yet at this point — the L6-guarded `prisma` extension
// would throw). This route never needs `withTenantContext` beyond that lookup — it does no other
// Prisma access.
//
// SECURITY — strict per-tenant channel isolation: this handler subscribes to EXACTLY ONE channel,
// `tenant:{tenantId}:queue` (derived server-side from the resolved tenantId, never from client
// input), and never subscribes to a wildcard or another tenant's channel. Publishing uses a
// SEPARATE ioredis client (server/realtime/publisher.ts) — an ioredis connection in subscriber
// mode cannot issue other commands, so subscribe and publish always use distinct clients.
import Redis from 'ioredis';
import { queueChannel } from '@/server/realtime/publisher';
import { resolveTenantIdBySlug } from '@/server/realtime/resolveTenant';

// ioredis needs a real Node socket — not Edge-safe. Also force dynamic: this is a live stream,
// never statically optimized or cached.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HEARTBEAT_INTERVAL_MS = 25_000;

function getValkeyUrl(): string {
  return process.env['VALKEY_URL'] ?? 'redis://localhost:41708';
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  const tenantId = await resolveTenantIdBySlug(slug);
  if (tenantId == null) {
    return new Response('Unknown tenant.', { status: 404 });
  }

  const channel = queueChannel(tenantId);
  const encoder = new TextEncoder();
  // Dedicated subscriber client — separate from the publisher singleton (a subscriber-mode
  // ioredis connection cannot also PUBLISH).
  const subscriber = new Redis(getValkeyUrl());

  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (chunk: string): void => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // Controller already closed (client disconnected mid-write) — safe to ignore, cleanup
          // runs via the abort handler below.
        }
      };

      subscriber.on('error', (err) => {
        console.error('[realtime/stream] Valkey subscriber error:', err);
      });

      subscriber.on('message', (subscribedChannel, message) => {
        if (subscribedChannel !== channel) return; // defense-in-depth: only this tenant's channel
        send(`data: ${message}\n\n`);
      });

      await subscriber.subscribe(channel);

      // Initial comment so the client's EventSource fires `onopen` promptly even before the
      // first real event, and so intermediate proxies see bytes flowing immediately.
      send(': connected\n\n');

      heartbeat = setInterval(() => {
        send(': heartbeat\n\n');
      }, HEARTBEAT_INTERVAL_MS);

      const cleanup = (): void => {
        if (heartbeat != null) clearInterval(heartbeat);
        subscriber.unsubscribe(channel).catch(() => {});
        subscriber.quit().catch(() => {});
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      request.signal.addEventListener('abort', cleanup);
    },
    cancel() {
      if (heartbeat != null) clearInterval(heartbeat);
      subscriber.unsubscribe(channel).catch(() => {});
      subscriber.quit().catch(() => {});
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
