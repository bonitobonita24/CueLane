// Wave 7.4-T1/T2/T3 — Employee Station client component. Owns window selection (persisted via
// the Wave 7.4 station.getWindow/setWindow tRPC endpoints, Valkey-backed), the serve cycle
// (Call Next / Complete / Skip / Recall / Transfer), the Skipped panel + stats sidebar, live
// updates via the Wave 7.2 SSE stream (no polling), and the Wave 7.4-T3 chime + voice announce.
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@cuelane/ui';
import { createClient } from '@/lib/trpc';
import { useQueueStream } from '@/lib/useQueueStream';
import type { DomainEvent } from '@/server/domain/queue';
import { useAnnounce } from './useAnnounce';

interface StationWindow {
  id: string;
  name: string;
}

interface StationClientProps {
  tenantSlug: string;
  windows: StationWindow[];
}

interface TicketRow {
  id: string;
  number: string;
  status: string;
  priority: boolean;
  serviceId: string;
  windowId: string | null;
  returnTo: string | null;
}

const client = createClient('/api/trpc');

export function StationClient({ tenantSlug, windows }: StationClientProps) {
  const [windowId, setWindowIdState] = useState<string | null | undefined>(undefined); // undefined = loading
  const [nowServing, setNowServing] = useState<TicketRow | null>(null);
  const [waitingCount, setWaitingCount] = useState<number>(0);
  const [skipped, setSkipped] = useState<TicketRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [transferTarget, setTransferTarget] = useState<TicketRow | null>(null);
  const [isPremium, setIsPremium] = useState(false);

  const { unlock, announce, muted, toggleMute } = useAnnounce();
  const gestureUnlockedRef = useRef(false);

  // ─── Window selection (persisted, Wave 7.4-T1) ───────────────────────────────
  useEffect(() => {
    client.station.getWindow
      .query()
      .then((r) => setWindowIdState(r.windowId))
      .catch(() => setWindowIdState(null));
  }, []);

  async function selectWindow(id: string): Promise<void> {
    setError(null);
    try {
      const result = await client.station.setWindow.mutate({ windowId: id });
      setWindowIdState(result.windowId);
    } catch {
      setError('Could not select that window. Please try again.');
    }
  }

  // ─── Data refresh helpers ─────────────────────────────────────────────────────
  const refreshServing = useCallback(() => {
    client.queue.nowServing
      .query()
      .then((tickets) => {
        // The window this station currently owns should surface exactly one serving ticket.
        const mine = windowId != null ? (tickets.find((t) => t.windowId === windowId) ?? null) : null;
        setNowServing(mine);
      })
      .catch(() => {
        // Live serving state is best-effort here — a transient failure shouldn't crash the
        // station; the next SSE event or manual action will resync.
      });
  }, [windowId]);

  const refreshWaitingCount = useCallback(() => {
    client.queue.listWaiting
      .query()
      .then((tickets) => setWaitingCount(tickets.length))
      .catch(() => undefined);
  }, []);

  const refreshSkipped = useCallback(() => {
    client.queue.listSkipped
      .query()
      .then((tickets) => setSkipped(tickets as TicketRow[]))
      .catch(() => undefined);
  }, []);

  const refreshAll = useCallback(() => {
    refreshServing();
    refreshWaitingCount();
    refreshSkipped();
  }, [refreshServing, refreshWaitingCount, refreshSkipped]);

  useEffect(() => {
    if (windowId == null) return;
    refreshAll();
  }, [windowId, refreshAll]);

  useEffect(() => {
    client.tenant.getCurrent
      .query()
      .then((t) => setIsPremium(t.tier === 'premium'))
      .catch(() => setIsPremium(false));
  }, []);

  // ─── Live updates (Wave 7.2 SSE — no polling) + Wave 7.4-T3 announce ─────────
  useQueueStream(
    tenantSlug,
    useCallback(
      (event: DomainEvent) => {
        if (!event.type.startsWith('ticket.')) return;
        refreshAll();

        // Announce only when THIS station's window is the one being called/recalled — a
        // multi-window tenant must not chime for every other counter's activity.
        if (
          (event.type === 'ticket.called' || event.type === 'ticket.recalled') &&
          windowId != null &&
          event.payload?.['windowId'] === windowId
        ) {
          const windowName = windows.find((w) => w.id === windowId)?.name ?? 'your window';
          client.queue.nowServing
            .query()
            .then((tickets) => {
              const ticket = tickets.find((t) => t.id === event.ticketId);
              if (ticket != null) announce(ticket.number, windowName);
            })
            .catch(() => undefined);
        }
      },
      [refreshAll, windowId, windows, announce],
    ),
  );

  function ensureUnlocked(): void {
    if (!gestureUnlockedRef.current) {
      unlock();
      gestureUnlockedRef.current = true;
    }
  }

  // ─── Serve-cycle actions ──────────────────────────────────────────────────────
  async function handleCallNext(): Promise<void> {
    if (windowId == null || busy) return;
    ensureUnlocked();
    setBusy(true);
    setError(null);
    try {
      const ticket = await client.queue.callNext.mutate({ windowId });
      if (ticket == null) {
        setError('No tickets waiting for your assigned services.');
      } else {
        const windowName = windows.find((w) => w.id === windowId)?.name ?? 'your window';
        announce(ticket.number, windowName);
      }
      refreshAll();
    } catch {
      setError('Could not call the next ticket. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleComplete(ticketId: string, outcome: 'done' | 'noshow'): Promise<void> {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await client.queue.complete.mutate({ ticketId, outcome });
      refreshAll();
    } catch {
      setError('Could not complete that ticket. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSkip(ticketId: string): Promise<void> {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await client.queue.skip.mutate({ ticketId });
      refreshAll();
    } catch {
      setError('Could not skip that ticket. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRecall(ticketId: string): Promise<void> {
    if (busy) return;
    ensureUnlocked();
    setBusy(true);
    setError(null);
    try {
      await client.queue.recall.mutate({ ticketId });
      refreshAll();
    } catch {
      setError('Could not recall that ticket. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRecallSkipped(ticketId: string): Promise<void> {
    if (windowId == null || busy) return;
    ensureUnlocked();
    setBusy(true);
    setError(null);
    try {
      await client.queue.recallSkipped.mutate({ ticketId, windowId });
      refreshAll();
    } catch {
      setError('Could not recall that ticket. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleTransfer(
    ticketId: string,
    toWindowId: string,
    returnAfterDone: boolean,
  ): Promise<void> {
    if (windowId == null || busy) return;
    setBusy(true);
    setError(null);
    try {
      await client.queue.transfer.mutate({
        ticketId,
        toWindowId,
        returnAfterDone,
        ...(returnAfterDone ? { returnToWindowId: windowId } : {}),
      });
      setTransferTarget(null);
      refreshAll();
    } catch {
      setError('Could not transfer that ticket. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (windowId === undefined) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-8">
        <p className="text-muted-foreground">Loading station…</p>
      </main>
    );
  }

  if (windowId == null) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-8">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="font-display text-xl">Select Your Window</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {error != null ? (
              <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            ) : null}
            {windows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No windows configured for this tenant yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {windows.map((w) => (
                  <Button key={w.id} variant="outline" onClick={() => void selectWindow(w.id)} data-testid={`select-window-${w.id}`}>
                    {w.name}
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    );
  }

  const currentWindowName = windows.find((w) => w.id === windowId)?.name ?? 'Window';

  return (
    <main className="flex min-h-screen flex-col gap-6 bg-background p-6 md:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Employee Station</h1>
          <p className="text-sm text-muted-foreground">
            {currentWindowName} · Tenant: <code className="font-mono">{tenantSlug}</code>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={toggleMute} aria-pressed={muted}>
            {muted ? 'Unmute' : 'Mute'}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void selectWindow('')} disabled>
            {/* Window switching is a fast-follow — deliberately disabled placeholder for now */}
            Change Window
          </Button>
        </div>
      </header>

      {error != null ? (
        <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        {/* ─── Serve cycle ─────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Now Serving</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {nowServing == null ? (
              <div className="flex flex-col items-center gap-4 py-10 text-center">
                <p className="text-muted-foreground">No ticket currently serving at this window.</p>
                <Button size="lg" onClick={() => void handleCallNext()} disabled={busy} data-testid="call-next">
                  Call Next
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 py-6 text-center">
                <p className="font-display text-7xl font-bold tabular-nums tracking-tight" aria-live="polite">
                  {nowServing.number}
                </p>
                {nowServing.priority ? <Badge>Priority Lane</Badge> : null}
                <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                  <Button onClick={() => void handleComplete(nowServing.id, 'done')} disabled={busy} data-testid="complete-done">
                    Done
                  </Button>
                  <Button variant="secondary" onClick={() => void handleComplete(nowServing.id, 'noshow')} disabled={busy} data-testid="complete-noshow">
                    No-show
                  </Button>
                  <Button variant="outline" onClick={() => void handleSkip(nowServing.id)} disabled={busy} data-testid="skip">
                    Skip
                  </Button>
                  <Button variant="outline" onClick={() => void handleRecall(nowServing.id)} disabled={busy} data-testid="recall">
                    Recall
                  </Button>
                  <Button variant="outline" onClick={() => setTransferTarget(nowServing)} disabled={busy} data-testid="open-transfer">
                    Transfer
                  </Button>
                </div>
                <Button size="lg" variant="secondary" onClick={() => void handleCallNext()} disabled={busy} className="mt-2">
                  Call Next
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ─── Stats + Skipped panel ───────────────────────────────────── */}
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Queue Stats</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-4">
              <div className="flex flex-col">
                <span className="text-2xl font-bold tabular-nums">{waitingCount}</span>
                <span className="text-xs uppercase tracking-wide text-muted-foreground">Waiting</span>
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-bold tabular-nums">{skipped.length}</span>
                <span className="text-xs uppercase tracking-wide text-muted-foreground">Skipped</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Skipped Tickets</CardTitle>
            </CardHeader>
            <CardContent>
              {skipped.length === 0 ? (
                <p className="text-sm text-muted-foreground">No skipped tickets.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {skipped.map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => void handleRecallSkipped(t.id)}
                        disabled={busy}
                        className="flex w-full items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-left text-sm transition-colors hover:bg-accent disabled:opacity-60"
                        data-testid={`recall-skipped-${t.id}`}
                      >
                        <span className="font-mono font-semibold">{t.number}</span>
                        <span className="text-xs text-muted-foreground">Tap to recall</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <TransferDialog
        ticket={transferTarget}
        windows={windows.filter((w) => w.id !== windowId)}
        isPremium={isPremium}
        busy={busy}
        onCancel={() => setTransferTarget(null)}
        onConfirm={(toWindowId, returnAfterDone) => void handleTransfer(transferTarget!.id, toWindowId, returnAfterDone)}
      />
    </main>
  );
}

interface TransferDialogProps {
  ticket: TicketRow | null;
  windows: StationWindow[];
  isPremium: boolean;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (toWindowId: string, returnAfterDone: boolean) => void;
}

function TransferDialog({ ticket, windows, isPremium, busy, onCancel, onConfirm }: TransferDialogProps) {
  // Empty-string sentinel (never null/undefined) — Radix Select's `value` prop must be present
  // from the FIRST render or React warns "Select is changing from uncontrolled to controlled"
  // the moment a real window id is first assigned. '' safely means "no selection yet" (Radix
  // SelectItem values are always non-empty window ids, so '' can never collide with a real one).
  const [toWindowId, setToWindowId] = useState<string>('');
  const [returnAfterDone, setReturnAfterDone] = useState(false);

  useEffect(() => {
    if (ticket == null) {
      setToWindowId('');
      setReturnAfterDone(false);
    }
  }, [ticket]);

  return (
    <Dialog open={ticket != null} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transfer {ticket?.number ?? ''}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Select onValueChange={setToWindowId} value={toWindowId}>
            <SelectTrigger data-testid="transfer-window-select">
              <SelectValue placeholder="Choose destination window" />
            </SelectTrigger>
            <SelectContent>
              {windows.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Return After Done is a Premium-tier feature (PRODUCT.md line 32) — mirrors the
              kiosk priority-toggle pattern (a plain toggle button) rather than adding a new
              shadcn Checkbox primitive for a single boolean. */}
          <button
            type="button"
            onClick={() => isPremium && setReturnAfterDone((v) => !v)}
            aria-pressed={returnAfterDone}
            disabled={!isPremium}
            data-testid="return-after-done-toggle"
            title={isPremium ? undefined : 'Return After Done is a Premium feature.'}
            className={`flex items-center justify-center gap-2 rounded-md border-2 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              returnAfterDone ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground hover:bg-accent'
            }`}
          >
            {returnAfterDone ? '✓ ' : ''}Return to this window after done
            {!isPremium ? ' (Premium)' : ''}
          </button>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={() => toWindowId !== '' && onConfirm(toWindowId, returnAfterDone)}
            disabled={toWindowId === '' || busy}
            data-testid="confirm-transfer"
          >
            Transfer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
