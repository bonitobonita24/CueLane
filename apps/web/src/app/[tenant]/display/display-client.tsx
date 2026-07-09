// Wave 7.5-T1 — Big Display client component. Public, unauthenticated wall screen: dark-themed
// (always dark regardless of the tenant's light/dark preference — DESIGN.md: "the display is
// DARK-themed; kiosk/station/admin are light"), 16:9-locked, 2×2 now-serving grid with a
// tenant-accent "Now Serving" label + a pulse-glow flash on change, an up-next strip, a
// total-waiting bar with color bands, and a bottom ticker. Live updates via the Wave 7.2 SSE
// stream (useQueueStream) — no polling; a fresh `queue.state` fetch is triggered on every
// `ticket.*` lifecycle event, same pattern as kiosk-client.tsx's `refreshCounts`.
//
// Wave 7.7d-T2 — the video/ads panel (VideoPanel) now shares the body region with the Now
// Serving grid: a left column (playlist/live YouTube + local media, System-Ad/Tenant-Ad
// interrupt engine) and a right column (the 2×2 grid, narrower but unchanged otherwise). Also
// folds in the deferred Wave 7.7b item: the accent that was hardcoded `#FCD34D` gold is now
// `hsl(var(--display-accent))` — the tenant's theme primary, lightened for dark-background
// legibility (see packages/ui/src/styles/globals.css + docs/DECISIONS_LOG.md "Wave 7.7d-T2").
// Ticket numbers stay high-contrast white per PRODUCT.md ("white ticket numbers") — the PREVIOUS
// gold ticket-number color was a spec deviation, corrected here as part of this same pass.
'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/trpc';
import { useQueueStream } from '@/lib/useQueueStream';
import type { DomainEvent } from '@/server/domain/queue';
import { VideoPanel } from './video-panel';

interface DisplayClientProps {
  tenantSlug: string;
}

interface NowServingEntry {
  windowId: string | null;
  windowName: string;
  ticketNumber: string;
  serviceName: string;
  priority: boolean;
}

interface UpNextEntry {
  ticketNumber: string;
  serviceName: string;
  priority: boolean;
}

interface QueueState {
  companyName: string;
  tier: string;
  nowServing: NowServingEntry[];
  upNext: UpNextEntry[];
  totalWaiting: number;
}

const GRID_SLOTS = 4;
// Heuristic color bands for the total-waiting bar (tunable later via tenant settings — no
// PRODUCT.md-specified thresholds yet, so these are a reasonable default: short/typical/backed-up).
const WAITING_BAND_GREEN_MAX = 5;
const WAITING_BAND_AMBER_MAX = 15;

const client = createClient('/api/trpc');

export function DisplayClient({ tenantSlug }: DisplayClientProps) {
  const [state, setState] = useState<QueueState | null>(null);
  const [error, setError] = useState(false);
  const [now, setNow] = useState<Date | null>(null); // null until mount — avoids SSR/CSR clock mismatch
  const [reducedMotion, setReducedMotion] = useState(false);

  const refresh = useCallback(() => {
    client.queue.state
      .query({ tenantSlug })
      .then((result) => {
        setState(result);
        setError(false);
      })
      .catch(() => setError(true));
  }, [tenantSlug]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Live updates — refetch the whole state snapshot on every ticket lifecycle event instead of
  // polling (Wave 7.2 SSE stream, same pattern as kiosk-client.tsx).
  useQueueStream(
    tenantSlug,
    useCallback(
      (event: DomainEvent) => {
        if (event.type.startsWith('ticket.')) refresh();
      },
      [refresh],
    ),
  );

  // Wall-clock header — client-only (Date.now() would mismatch between server render and
  // hydration), ticks once a second.
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1_000);
    return () => clearInterval(id);
  }, []);

  // R13/motion.md mandatory prefers-reduced-motion guard — ties the pulse-glow/ticker CSS
  // animations (globals.css .cl-pulse-glow / .cl-ticker-scroll) to the user's OS preference.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mql.matches);
    const onChange = (e: MediaQueryListEvent): void => setReducedMotion(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  const slots: (NowServingEntry | null)[] = state != null
    ? [...state.nowServing.slice(0, GRID_SLOTS), ...Array<null>(Math.max(0, GRID_SLOTS - state.nowServing.length)).fill(null)]
    : Array<null>(GRID_SLOTS).fill(null);

  const totalWaiting = state?.totalWaiting ?? 0;
  const waitingBand =
    totalWaiting <= WAITING_BAND_GREEN_MAX ? 'green' : totalWaiting <= WAITING_BAND_AMBER_MAX ? 'amber' : 'red';
  const waitingBandColor = waitingBand === 'green' ? '#14c6cb' : waitingBand === 'amber' ? '#bb5a00' : '#731e25';

  const isFreeTier = state?.tier === 'free';

  return (
    <main className="flex min-h-screen items-center justify-center bg-black p-2 md:p-4">
      <div
        className="relative overflow-hidden rounded-2xl text-white"
        style={{
          // 16:9 lock: width is capped by both the viewport width AND (viewport height × 16/9), so
          // the box always letterboxes to true 16:9 on any screen — matches the mockup's
          // "aspect-ratio: 16/9; max-height: 80vh" but locked to the full available viewport here.
          aspectRatio: '16 / 9',
          width: 'min(100%, calc(100vh * 16 / 9))',
          maxHeight: '100vh',
          background: 'linear-gradient(135deg, #15181e 0%, #0d0e12 100%)',
        }}
        data-testid="big-display-frame"
      >
        {/* Header — branding (+ free-tier Powerbyte attribution) + live clock */}
        <div
          className="absolute inset-x-0 top-0 flex items-center justify-between border-b px-[clamp(0.75rem,2vw,1.5rem)] py-[clamp(0.4rem,1.2vw,0.75rem)]"
          style={{ borderColor: 'rgba(178, 182, 189, 0.2)', background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(8px)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center rounded-md font-bold"
              style={{
                width: 'clamp(1.75rem, 3vw, 2.25rem)',
                height: 'clamp(1.75rem, 3vw, 2.25rem)',
                background: 'hsl(var(--display-accent))',
                color: '#15181e',
                fontSize: 'clamp(0.6rem, 1vw, 0.75rem)',
              }}
              aria-hidden="true"
            >
              {(state?.companyName ?? tenantSlug).slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="font-semibold leading-tight" style={{ fontSize: 'clamp(0.8rem, 1.6vw, 1.1rem)' }}>
                {state?.companyName ?? tenantSlug}
                {isFreeTier ? (
                  <span style={{ color: '#b2b6bd', fontWeight: 400 }}> — Powered by Powerbyte IT Solutions</span>
                ) : null}
              </div>
              <div className="cl-label" style={{ color: '#b2b6bd', fontSize: '0.625rem' }}>
                Live Queue
              </div>
            </div>
          </div>
          <div className="text-right">
            <div
              className="font-mono font-bold tabular-nums"
              style={{ fontSize: 'clamp(0.85rem, 1.8vw, 1.25rem)', color: '#efeff1' }}
              aria-live="off"
            >
              {now != null ? now.toLocaleTimeString('en-US') : '—'}
            </div>
            <div className="hc-caption" style={{ color: '#b2b6bd', fontSize: '0.625rem' }}>
              {now != null ? now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : ''}
            </div>
          </div>
        </div>

        {/* Body — Video panel (left) + 2×2 Now Serving grid (right), Wave 7.7d-T2 */}
        <div
          className="absolute inset-x-0 flex gap-[clamp(0.5rem,1.2vw,0.75rem)] p-[clamp(0.5rem,1.2vw,0.75rem)]"
          style={{ top: 'clamp(3.25rem, 8vw, 4rem)', bottom: 'clamp(3.5rem, 8vw, 4.25rem)' }}
        >
          <div className="h-full" style={{ flex: '3 1 0%', minWidth: 0 }}>
            <VideoPanel tenantSlug={tenantSlug} reducedMotion={reducedMotion} />
          </div>

          <div className="grid h-full grid-cols-2 gap-[clamp(0.5rem,1.2vw,0.75rem)]" style={{ flex: '2 1 0%', minWidth: 0 }}>
          {slots.map((entry, i) =>
            entry != null ? (
              <div
                key={`${entry.windowId ?? i}-${entry.ticketNumber}`}
                className="flex flex-col justify-between rounded-lg p-[clamp(0.6rem,1.5vw,1rem)]"
                style={{
                  background: entry.priority
                    ? 'color-mix(in srgb, hsl(var(--display-accent)) 8%, transparent)'
                    : 'rgba(0,0,0,0.3)',
                  border: `1px solid color-mix(in srgb, hsl(var(--display-accent)) ${entry.priority ? 40 : 30}%, transparent)`,
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="cl-label" style={{ color: 'hsl(var(--display-accent))', fontSize: 'clamp(0.55rem, 1vw, 0.7rem)' }}>
                    {entry.windowName}
                  </span>
                  {entry.priority ? (
                    <span className="cl-label" style={{ color: 'hsl(var(--display-accent))', fontSize: 'clamp(0.5rem, 0.9vw, 0.625rem)' }}>
                      ⭐ Priority
                    </span>
                  ) : (
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: '#14c6cb' }}
                      aria-hidden="true"
                    />
                  )}
                </div>
                <div className="py-1 text-center">
                  <div
                    className={reducedMotion ? undefined : 'cl-pulse-glow'}
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      fontSize: 'clamp(1.5rem, 5vw, 3.5rem)',
                      color: '#efeff1',
                      lineHeight: 1,
                    }}
                  >
                    {entry.ticketNumber}
                  </div>
                  <div className="mt-1" style={{ color: '#d5d7db', fontSize: 'clamp(0.6rem, 1.3vw, 0.9rem)' }}>
                    {entry.serviceName}
                  </div>
                </div>
              </div>
            ) : (
              <div
                key={`idle-${i}`}
                className="flex flex-col justify-between rounded-lg p-[clamp(0.6rem,1.5vw,1rem)]"
                style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(178, 182, 189, 0.15)', opacity: 0.55 }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="cl-label"
                    style={{ color: 'color-mix(in srgb, hsl(var(--display-accent)) 60%, transparent)', fontSize: 'clamp(0.55rem, 1vw, 0.7rem)' }}
                  >
                    Window
                  </span>
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: '#656a76' }} aria-hidden="true" />
                </div>
                <div className="py-1 text-center">
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      fontSize: 'clamp(1.1rem, 3vw, 2rem)',
                      color: 'rgba(255,255,255,0.4)',
                    }}
                  >
                    — IDLE —
                  </div>
                  <div className="mt-1" style={{ color: 'rgba(255,255,255,0.4)', fontSize: 'clamp(0.6rem, 1.3vw, 0.9rem)' }}>
                    Waiting for next call
                  </div>
                </div>
              </div>
            ),
          )}
          </div>
        </div>

        {/* Up Next + Total Waiting strip */}
        <div className="absolute inset-x-0 px-[clamp(0.5rem,1.2vw,0.75rem)]" style={{ bottom: 'clamp(1.75rem, 4vw, 2rem)' }}>
          <div
            className="flex items-center gap-3 rounded-lg p-[clamp(0.4rem,1vw,0.75rem)]"
            style={{ background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(178, 182, 189, 0.15)' }}
          >
            <span className="cl-label shrink-0" style={{ color: 'hsl(var(--display-accent))', fontSize: 'clamp(0.55rem, 1vw, 0.7rem)' }}>
              Up Next
            </span>
            <div className="flex flex-1 items-center gap-2 overflow-hidden">
              {(state?.upNext ?? []).map((entry, i) => (
                <span
                  key={i}
                  className="shrink-0 rounded-full px-2 py-0.5"
                  style={{
                    background: entry.priority
                      ? 'color-mix(in srgb, hsl(var(--display-accent)) 18%, transparent)'
                      : 'rgba(255,255,255,0.08)',
                    color: entry.priority ? 'hsl(var(--display-accent))' : '#efeff1',
                    border: entry.priority ? '1px solid color-mix(in srgb, hsl(var(--display-accent)) 40%, transparent)' : undefined,
                    fontSize: 'clamp(0.6rem, 1.1vw, 0.8rem)',
                  }}
                >
                  {entry.priority ? '⭐ ' : ''}
                  {entry.ticketNumber} · {entry.serviceName}
                </span>
              ))}
              {state != null && state.upNext.length === 0 ? (
                <span style={{ color: '#656a76', fontSize: 'clamp(0.6rem, 1.1vw, 0.8rem)' }}>Nobody else waiting</span>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-3 border-l pl-3" style={{ borderColor: 'rgba(178, 182, 189, 0.2)' }}>
              <div className="text-right">
                <div className="cl-label" style={{ fontSize: '0.625rem', color: '#b2b6bd' }}>
                  Waiting
                </div>
                <div className="font-bold tabular-nums" style={{ fontSize: 'clamp(0.85rem, 1.6vw, 1.125rem)', color: waitingBandColor }}>
                  {totalWaiting}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom ticker */}
        <div
          className="absolute inset-x-0 bottom-0 flex items-center overflow-hidden border-t"
          style={{ height: 'clamp(1.5rem, 3vw, 1.75rem)', background: '#000', borderColor: 'rgba(178, 182, 189, 0.15)' }}
        >
          <div
            className={reducedMotion ? 'whitespace-nowrap px-3' : 'cl-ticker-scroll whitespace-nowrap px-3'}
            style={{ color: '#d5d7db', fontSize: 'clamp(0.6rem, 1vw, 0.75rem)' }}
          >
            {error
              ? 'Reconnecting to the live queue…'
              : `${state?.companyName ?? tenantSlug} — Thank you for your patience while we serve you · Please keep your ticket number in view.`}
          </div>
        </div>
      </div>
    </main>
  );
}
