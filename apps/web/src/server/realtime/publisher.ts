// Wave 7.2-T1 — Valkey pub/sub publisher. Wires the Wave 7.1 domain layer's `events[]` output to
// realtime fanout. Publishing is fire-and-forget-safe: a Valkey outage must NEVER fail the
// mutation it's attached to (the ticket state change already committed in Postgres before this
// runs) — every publish is wrapped so a Valkey error only logs, it never throws into the caller.
//
// Channel convention: `tenant:{tenantId}:queue` — strict per-tenant isolation (the SSE route
// handler subscribes to exactly one of these per connection, never a wildcard).
//
// Lazy singleton publisher client — a single ioredis connection is reused across every
// publishEvents() call in this process (dedicated to publishing; the SSE route handler uses ITS
// OWN separate ioredis client for subscribing, since a subscriber connection in ioredis cannot
// issue other commands, including PUBLISH).

import Redis from 'ioredis';
import type { DomainEvent } from '@/server/domain/queue';

let publisherClient: Redis | null = null;

function getPublisherClient(): Redis {
  if (publisherClient == null) {
    const url = process.env['VALKEY_URL'] ?? 'redis://localhost:41708';
    publisherClient = new Redis(url, {
      // Never let a connection retry storm block the process; publishEvents() already
      // swallows failures, so a lazily-reconnecting client is fine to leave in the background.
      maxRetriesPerRequest: 1,
      lazyConnect: false,
    });
    publisherClient.on('error', (err) => {
      // ioredis requires an 'error' listener or it crashes the process on connection failure.
      console.error('[realtime/publisher] Valkey connection error:', err);
    });
  }
  return publisherClient;
}

/** Channel name for a given tenant's queue events — the single source of truth for both the
 *  publisher and the SSE route handler's subscriber. */
export function queueChannel(tenantId: string): string {
  return `tenant:${tenantId}:queue`;
}

/**
 * Publishes each domain event as JSON to its tenant's channel. Best-effort: any failure
 * (connection down, publish rejected, etc.) is caught and logged, never re-thrown — the calling
 * tRPC mutation must succeed regardless of realtime transport availability.
 */
export async function publishEvents(events: DomainEvent[]): Promise<void> {
  if (events.length === 0) return;

  const client = getPublisherClient();
  await Promise.all(
    events.map(async (event) => {
      try {
        await client.publish(queueChannel(event.tenantId), JSON.stringify(event));
      } catch (err) {
        console.error('[realtime/publisher] failed to publish event', event.type, err);
      }
    }),
  );
}

/** Test-only: allows the test suite to inject a fake client and reset the singleton. */
export function __setPublisherClientForTests(client: Redis | null): void {
  publisherClient = client;
}
