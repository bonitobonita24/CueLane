// Wave 7.3-T1 — Customer Kiosk client component. Owns every interactive piece: transaction grid,
// priority-lane toggle, ticket issuance, auto-print, 5s auto-reset, and live waiting/serving
// counts (via the Wave 7.2 SSE stream — no polling).
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/trpc';
import { useQueueStream } from '@/lib/useQueueStream';
import type { DomainEvent } from '@/server/domain/queue';

interface KioskClientProps {
  tenantSlug: string;
  companyName: string;
  tagline: string;
}

interface KioskService {
  id: string;
  name: string;
  number: number;
  icon: string;
  color: string;
  avgTime: number;
}

interface IssuedTicket {
  number: string;
  serviceName: string;
  priority: boolean;
}

const AUTO_RESET_MS = 5_000;

const client = createClient('/api/trpc');

export function KioskClient({ tenantSlug, companyName, tagline }: KioskClientProps) {
  const [services, setServices] = useState<KioskService[]>([]);
  const [counts, setCounts] = useState<{ waiting: number; serving: number } | null>(null);
  const [priorityMode, setPriorityMode] = useState(false);
  const [issuing, setIssuing] = useState<string | null>(null); // serviceId currently in-flight
  const [issued, setIssued] = useState<IssuedTicket | null>(null);
  const [error, setError] = useState<string | null>(null);

  const printFrameRef = useRef<HTMLIFrameElement | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const refreshCounts = useCallback(() => {
    client.queue.counts
      .query({ tenantSlug })
      .then(setCounts)
      .catch(() => {
        // Live counts are a nice-to-have on the kiosk — a transient failure shouldn't block
        // ticket issuance, so this is intentionally silent (no error banner for a counts fetch).
      });
  }, [tenantSlug]);

  // Initial load: services for the transaction grid + starting counts.
  useEffect(() => {
    client.queue.listActive
      .query({ tenantSlug })
      .then(setServices)
      .catch(() => setError('Could not load services. Please tell a staff member.'));
    refreshCounts();
  }, [tenantSlug, refreshCounts]);

  // Live counts — refresh on every ticket lifecycle event instead of polling.
  useQueueStream(tenantSlug, useCallback((event: DomainEvent) => {
    if (event.type.startsWith('ticket.')) refreshCounts();
  }, [refreshCounts]));

  useEffect(() => {
    return () => {
      if (resetTimerRef.current != null) clearTimeout(resetTimerRef.current);
    };
  }, []);

  function printReceipt(ticket: IssuedTicket): void {
    const frame = printFrameRef.current;
    if (frame == null) return; // no printer surface available — degrade silently

    try {
      const doc = frame.contentDocument;
      if (doc == null) return;

      doc.open();
      doc.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Ticket</title>
    <style>
      @page { margin: 4mm; }
      body { font-family: monospace; text-align: center; width: 72mm; margin: 0 auto; }
      .number { font-size: 40px; font-weight: 700; margin: 8px 0; }
      .service { font-size: 14px; margin-bottom: 4px; }
      .meta { font-size: 11px; color: #444; }
    </style>
  </head>
  <body>
    <div class="service">${escapeHtml(companyName)}</div>
    <div class="number">${escapeHtml(ticket.number)}</div>
    <div class="service">${escapeHtml(ticket.serviceName)}${ticket.priority ? ' — Priority Lane' : ''}</div>
    <div class="meta">${new Date().toLocaleString()}</div>
  </body>
</html>`);
      doc.close();

      const win = frame.contentWindow;
      if (win == null) return;
      // Give the frame a tick to lay out before invoking print — degradable: a headless/no-printer
      // dev environment throws here, which we swallow rather than crash the kiosk flow.
      setTimeout(() => {
        try {
          win.print();
        } catch {
          // No printer / print() unsupported in this environment — the on-screen number is
          // still the source of truth for the customer, so this is a silent no-op.
        }
      }, 50);
    } catch {
      // Printing is a best-effort enhancement, never a blocker for ticket issuance.
    }
  }

  async function handleIssue(service: KioskService): Promise<void> {
    if (issuing != null) return; // debounce double-taps
    setError(null);
    setIssuing(service.id);
    try {
      const result = await client.queue.issue.mutate({
        tenantSlug,
        serviceId: service.id,
        priority: priorityMode,
      });
      const ticket: IssuedTicket = {
        number: result.number,
        serviceName: service.name,
        priority: priorityMode,
      };
      setIssued(ticket);
      setPriorityMode(false);
      printReceipt(ticket);
      refreshCounts();

      if (resetTimerRef.current != null) clearTimeout(resetTimerRef.current);
      resetTimerRef.current = setTimeout(() => setIssued(null), AUTO_RESET_MS);
    } catch {
      setError('Could not issue a ticket right now. Please tell a staff member.');
    } finally {
      setIssuing(null);
    }
  }

  return (
    <>
      {issued != null ? (
        <TicketDisplay ticket={issued} companyName={companyName} />
      ) : (
        <main className="flex min-h-screen flex-col bg-background p-6 md:p-10">
          <header className="mb-8 flex flex-col items-center gap-2 text-center">
            <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">{companyName}</h1>
            <p className="text-muted-foreground">{tagline}</p>
            {counts != null ? (
              <div className="mt-3 flex gap-3">
                <CountPill label="Waiting" value={counts.waiting} />
                <CountPill label="Now Serving" value={counts.serving} />
              </div>
            ) : null}
          </header>

          {error != null ? (
            <div
              role="alert"
              className="mx-auto mb-6 max-w-xl rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-center text-sm text-destructive"
            >
              {error}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => setPriorityMode((v) => !v)}
            aria-pressed={priorityMode}
            className={`mx-auto mb-8 flex w-full max-w-md items-center justify-center gap-2 rounded-xl border-2 py-4 text-lg font-semibold uppercase tracking-wide transition-colors ${
              priorityMode
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-foreground hover:bg-accent'
            }`}
          >
            {priorityMode ? '✓ Priority Lane Selected — Tap Your Transaction' : 'Priority Lane (Senior / PWD)'}
          </button>

          <div className="mx-auto grid w-full max-w-4xl flex-1 grid-cols-2 gap-5 md:grid-cols-3">
            {services.map((service) => (
              <button
                key={service.id}
                type="button"
                disabled={issuing != null}
                onClick={() => void handleIssue(service)}
                className="flex min-h-[180px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-border bg-card p-6 text-center shadow-sm transition-transform active:scale-95 disabled:opacity-60 md:min-h-[220px]"
                style={{ borderColor: service.color }}
              >
                <span className="text-5xl leading-none" aria-hidden="true">
                  {service.icon}
                </span>
                <span className="text-lg font-semibold leading-tight md:text-xl">{service.name}</span>
                <span className="text-xs text-muted-foreground">~{service.avgTime} min</span>
              </button>
            ))}
            {services.length === 0 && error == null ? (
              <p className="col-span-full py-16 text-center text-muted-foreground">Loading services…</p>
            ) : null}
          </div>
        </main>
      )}

      {/* Hidden print surface — a single persistent iframe outside the grid/ticket-display
          switch, so `printFrameRef.current` stays stable across the issue → display → auto-reset
          cycle instead of being torn down and recreated with each branch. Never visible on
          screen, only used to render + print a receipt. */}
      <iframe ref={printFrameRef} title="Ticket receipt" className="hidden" />
    </>
  );
}

function CountPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline gap-1.5 rounded-full border border-border bg-card px-4 py-1.5">
      <span className="text-lg font-bold tabular-nums">{value}</span>
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
    </div>
  );
}

function TicketDisplay({ ticket, companyName }: { ticket: IssuedTicket; companyName: string }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-8 text-center">
      <p className="text-muted-foreground">{companyName}</p>
      <p className="text-xl font-medium text-muted-foreground">{ticket.serviceName}</p>
      {ticket.priority ? (
        <span className="rounded-full border border-primary px-3 py-1 text-sm font-semibold uppercase tracking-wide text-primary">
          Priority Lane
        </span>
      ) : null}
      <p className="font-display text-8xl font-bold tabular-nums tracking-tight md:text-9xl" aria-live="polite">
        {ticket.number}
      </p>
      <p className="text-muted-foreground">Please keep your ticket and wait to be called.</p>
    </main>
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
