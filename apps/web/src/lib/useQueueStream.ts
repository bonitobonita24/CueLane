// Wave 7.2-T4 — client hook for the SSE queue stream (apps/web/src/app/api/tenants/[slug]/queue/stream/route.ts).
// Opens an EventSource per tenant slug, parses each `data:` frame as a DomainEvent, and calls
// `onEvent`. Auto-reconnects with exponential backoff (capped) on error/close — EventSource
// natively retries on network drop, but a server-side abort/close needs us to re-open explicitly.
'use client';

import { useEffect, useRef } from 'react';
import type { DomainEvent } from '@/server/domain/queue';

const INITIAL_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;

/**
 * Subscribes to a tenant's realtime queue event stream. SSR-safe (no-op on the server — only
 * opens the connection once `window`/`EventSource` are available, i.e. in the browser).
 *
 * @param tenantSlug - the tenant slug to stream events for; pass `null`/`undefined` to disable.
 * @param onEvent - called with each parsed DomainEvent as it arrives.
 */
export function useQueueStream(
  tenantSlug: string | null | undefined,
  onEvent: (event: DomainEvent) => void,
): void {
  // Keep the latest callback in a ref so the effect below doesn't need `onEvent` as a dependency
  // (avoids tearing down/reopening the connection on every render when the caller passes an
  // inline function).
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;
    if (tenantSlug == null || tenantSlug === '') return;

    let source: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let backoffMs = INITIAL_BACKOFF_MS;
    let cancelled = false;

    const connect = (): void => {
      if (cancelled) return;

      source = new EventSource(`/api/tenants/${encodeURIComponent(tenantSlug)}/queue/stream`);

      source.onopen = () => {
        backoffMs = INITIAL_BACKOFF_MS; // reset backoff on a successful (re)connect
      };

      source.onmessage = (msg: MessageEvent<string>) => {
        try {
          const parsed = JSON.parse(msg.data) as DomainEvent;
          onEventRef.current(parsed);
        } catch {
          // Malformed payload (should not happen — the publisher only ever sends JSON
          // DomainEvents) — ignore rather than crash the stream.
        }
      };

      source.onerror = () => {
        source?.close();
        source = null;
        if (cancelled) return;
        reconnectTimer = setTimeout(() => {
          backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
          connect();
        }, backoffMs);
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer != null) clearTimeout(reconnectTimer);
      source?.close();
    };
  }, [tenantSlug]);
}
