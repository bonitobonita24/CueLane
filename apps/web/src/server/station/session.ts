// Wave 7.4-T1 — Employee Station selected-window session. A lightweight Valkey-backed pointer
// (NOT a Postgres row — this is UI state, not domain state) so an employee's chosen window
// survives a page refresh without re-selecting it every time. Mirrors the singleton-ioredis-
// client pattern already established by server/realtime/publisher.ts (its own dedicated
// connection — a pub/sub SUBSCRIBE connection cannot issue other commands in ioredis, and this
// module does plain GET/SET/DEL, so it stays independent of both the publisher's and the SSE
// route's clients).

import Redis from 'ioredis';

let sessionClient: Redis | null = null;

function getSessionClient(): Redis {
  if (sessionClient == null) {
    const url = process.env['VALKEY_URL'] ?? 'redis://localhost:41708';
    sessionClient = new Redis(url, {
      maxRetriesPerRequest: 1,
      lazyConnect: false,
    });
    sessionClient.on('error', (err) => {
      // ioredis requires an 'error' listener or it crashes the process on connection failure.
      console.error('[station/session] Valkey connection error:', err);
    });
  }
  return sessionClient;
}

/** Key convention: `station:{tenantId}:{userId}` — strict per-tenant, per-employee isolation. */
function stationKey(tenantId: string, userId: string): string {
  return `station:${tenantId}:${userId}`;
}

// 12h TTL — long enough to cover a full shift without re-selecting a window, short enough that a
// stale pointer from a long-gone session doesn't linger forever.
const WINDOW_SESSION_TTL_SECONDS = 12 * 60 * 60;

/** Reads the employee's currently-selected window, if any. Never throws — a Valkey outage
 *  degrades to "no window selected yet" (the station UI just re-prompts for a window), it must
 *  never break the page. */
export async function getStationWindow(tenantId: string, userId: string): Promise<string | null> {
  try {
    const value = await getSessionClient().get(stationKey(tenantId, userId));
    return value != null && value !== '' ? value : null;
  } catch (err) {
    console.error('[station/session] failed to read selected window', err);
    return null;
  }
}

/** Persists the employee's selected window (refreshing the TTL). Never throws — a Valkey outage
 *  must never fail the mutation; the window selection just won't survive a refresh this time. */
export async function setStationWindow(tenantId: string, userId: string, windowId: string): Promise<void> {
  try {
    await getSessionClient().set(stationKey(tenantId, userId), windowId, 'EX', WINDOW_SESSION_TTL_SECONDS);
  } catch (err) {
    console.error('[station/session] failed to persist selected window', err);
  }
}

/** Test-only: allows the test suite to inject a fake client and reset the singleton. */
export function __setSessionClientForTests(client: Redis | null): void {
  sessionClient = client;
}
