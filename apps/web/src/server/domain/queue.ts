// Wave 7.1-T2 — Queue domain module. Pure-ish functions that receive an RLS transaction client
// (see packages/db/src/rls.ts withTenant) and return `{ ticket, events }` — they NEVER publish
// directly; Wave 7.2 (realtime transport) wires `events` to Valkey pub/sub with zero refactor.
//
// L2/L6 note: these functions run INSIDE `withTenant(tenantId, tx => ...)` (a
// `prismaRaw.$transaction`, RLS-scoped via `set_config('app.current_tenant_id', ...)`), so `tx`
// is the UNGUARDED transaction client — every query below filters `tenantId` explicitly. This is
// deliberate: the atomic sequence-counter allocation in `issueTicket` needs a single serializable
// transaction, which is what the repo's `withTenant` RLS helper is built for (the L6-guarded
// `prisma` client extension does not offer an equivalent transactional entry point here). Simple,
// non-transactional reads (list/count) stay on the L6-guarded `prisma` client at the router layer.
//
// PRODUCT.md line 32 is the source of truth for `transfer` + Return-After-Done semantics — see
// the two functions below for the specific behavior this encodes (transfer routes ticket→WINDOW,
// not ticket→service; and Return-After-Done re-serves at the origin window, it does not requeue
// to `waiting`).

import { Prisma } from '@cuelane/db';

type Tx = Prisma.TransactionClient;

async function findTicket(tx: Tx, tenantId: string, id: string) {
  return tx.ticket.findFirst({ where: { id, tenantId } });
}
type TicketRecord = NonNullable<Awaited<ReturnType<typeof findTicket>>>;

export interface DomainCtx {
  tenantId: string;
  tx: Tx;
}

export type QueueEventType =
  | 'ticket.issued'
  | 'ticket.called'
  | 'ticket.completed'
  | 'ticket.noshow'
  | 'ticket.skipped'
  | 'ticket.recalled'
  | 'ticket.transferred';

export interface DomainEvent {
  type: QueueEventType;
  tenantId: string;
  ticketId: string;
  payload?: Record<string, unknown>;
}

/** Domain-layer error — the router translates `code` into the matching TRPCError code. */
export class QueueDomainError extends Error {
  public readonly code: 'NOT_FOUND' | 'BAD_REQUEST';

  constructor(code: 'NOT_FOUND' | 'BAD_REQUEST', message: string) {
    super(message);
    this.name = 'QueueDomainError';
    this.code = code;
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

export function pad3(n: number): string {
  return String(n).padStart(3, '0');
}

/** YYYYMMDD in UTC — the daily-reset boundary for both sequence-counter key conventions. */
export function todayKey(date: Date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

/**
 * Atomically allocates the next value for a per-tenant counter key via
 * `INSERT ... ON CONFLICT DO UPDATE SET value = value + 1` (Prisma upsert + increment) — the
 * unique (tenant_id, key) index makes this race-safe under Postgres row-level locking: two
 * concurrent transactions allocating the same key serialize on the row lock, never double-issue.
 * Never derive a ticket number via `count()` — that is race-prone (T1 lesson).
 */
async function nextSequence(tx: Tx, tenantId: string, key: string): Promise<number> {
  const counter = await tx.sequenceCounter.upsert({
    where: { tenantId_key: { tenantId, key } },
    create: { tenantId, key, value: 1 },
    update: { value: { increment: 1 } },
  });
  return counter.value;
}

// ─── issueTicket ───────────────────────────────────────────────────────────────

export interface IssueTicketInput {
  serviceId: string;
  priority: boolean;
}

export async function issueTicket(
  input: IssueTicketInput,
  ctx: DomainCtx,
): Promise<{ ticket: TicketRecord; events: DomainEvent[] }> {
  const { tenantId, tx } = ctx;

  const service = await tx.service.findFirst({ where: { id: input.serviceId, tenantId } });
  if (service == null) {
    throw new QueueDomainError('NOT_FOUND', `Unknown service: ${input.serviceId}`);
  }

  const key = input.priority ? `priority:${todayKey()}` : `${service.id}:${todayKey()}`;
  const sequence = await nextSequence(tx, tenantId, key);
  const number = input.priority ? `P-${pad3(sequence)}` : `${service.number}-${pad3(sequence)}`;

  const ticket = await tx.ticket.create({
    data: {
      tenantId,
      serviceId: service.id,
      number,
      sequence,
      priority: input.priority,
      status: 'waiting',
    },
  });

  return {
    ticket,
    events: [{ type: 'ticket.issued', tenantId, ticketId: ticket.id, payload: { number } }],
  };
}

// ─── callNext ──────────────────────────────────────────────────────────────────

export interface CallNextInput {
  windowId: string;
  userId: string;
  serviceIds: string[];
}

export async function callNext(
  input: CallNextInput,
  ctx: DomainCtx,
): Promise<{ ticket: TicketRecord | null; events: DomainEvent[] }> {
  const { tenantId, tx } = ctx;

  if (input.serviceIds.length === 0) {
    return { ticket: null, events: [] };
  }

  // Priority DESC, then FIFO (createdAt ASC). Return-After-Done tickets never re-enter this
  // waiting pool — `complete()` routes them straight to `serving` at the origin window
  // (PRODUCT.md line 32), so no special-casing is needed here.
  const next = await tx.ticket.findFirst({
    where: { tenantId, status: 'waiting', serviceId: { in: input.serviceIds } },
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
  });

  if (next == null) {
    return { ticket: null, events: [] };
  }

  const ticket = await tx.ticket.update({
    where: { id: next.id },
    data: { status: 'serving', windowId: input.windowId, servedBy: input.userId, calledAt: new Date() },
  });

  return {
    ticket,
    events: [{ type: 'ticket.called', tenantId, ticketId: ticket.id, payload: { windowId: input.windowId } }],
  };
}

// ─── complete ──────────────────────────────────────────────────────────────────

export interface CompleteInput {
  ticketId: string;
  outcome: 'done' | 'noshow';
}

export async function complete(
  input: CompleteInput,
  ctx: DomainCtx,
): Promise<{ ticket: TicketRecord; events: DomainEvent[] }> {
  const { tenantId, tx } = ctx;

  const existing = await findTicket(tx, tenantId, input.ticketId);
  if (existing == null) {
    throw new QueueDomainError('NOT_FOUND', `Unknown ticket: ${input.ticketId}`);
  }
  if (existing.status !== 'serving') {
    throw new QueueDomainError('BAD_REQUEST', 'Only a serving ticket can be completed.');
  }

  // PRODUCT.md line 32 — Return-After-Done: when the DESTINATION window marks the ticket done,
  // it auto-returns to the ORIGIN window as SERVING (not completed), with a fresh bell + voice
  // announce — i.e. observably identical to a `callNext` at the origin window, so this emits
  // `ticket.called`, not `ticket.completed`. The `!returnedFromTransfer` guard fires this exactly
  // once — the SECOND completion (at the origin, post-return) falls through to a real completion.
  if (input.outcome === 'done' && existing.returnTo != null && !existing.returnedFromTransfer) {
    const ticket = await tx.ticket.update({
      where: { id: existing.id },
      data: {
        status: 'serving',
        windowId: existing.returnTo,
        servedBy: null,
        calledAt: new Date(),
        returnedFromTransfer: true,
      },
    });
    return {
      ticket,
      events: [{ type: 'ticket.called', tenantId, ticketId: ticket.id, payload: { windowId: existing.returnTo, returned: true } }],
    };
  }

  // Normal completion or No Show. "No Show at destination clears the returnTo flag — no
  // auto-return for abandoned tickets" (PRODUCT.md line 32) — clear it unconditionally on noshow.
  const status = input.outcome === 'done' ? 'completed' : 'noshow';
  const ticket = await tx.ticket.update({
    where: { id: existing.id },
    data: {
      status,
      completedAt: new Date(),
      ...(input.outcome === 'noshow' ? { returnTo: null } : {}),
    },
  });

  return {
    ticket,
    events: [{ type: input.outcome === 'done' ? 'ticket.completed' : 'ticket.noshow', tenantId, ticketId: ticket.id }],
  };
}

// ─── skip ──────────────────────────────────────────────────────────────────────

export interface SkipInput {
  ticketId: string;
}

export async function skip(input: SkipInput, ctx: DomainCtx): Promise<{ ticket: TicketRecord; events: DomainEvent[] }> {
  const { tenantId, tx } = ctx;

  const existing = await findTicket(tx, tenantId, input.ticketId);
  if (existing == null) {
    throw new QueueDomainError('NOT_FOUND', `Unknown ticket: ${input.ticketId}`);
  }
  if (existing.status !== 'serving') {
    throw new QueueDomainError('BAD_REQUEST', 'Only a serving ticket can be skipped.');
  }

  const ticket = await tx.ticket.update({ where: { id: existing.id }, data: { status: 'skipped' } });

  return { ticket, events: [{ type: 'ticket.skipped', tenantId, ticketId: ticket.id }] };
}

// ─── recall ────────────────────────────────────────────────────────────────────

export interface RecallInput {
  ticketId: string;
}

/**
 * Re-announces the currently serving ticket (bumps `calledAt` to re-trigger bell + voice at the
 * Employee Station). Scope note: this Wave-7.1 contract covers ONLY "re-announce current serving
 * ticket" — recalling a ticket OUT OF the skipped list back into serving (a distinct UI affordance
 * in PRODUCT.md's "Skipped Tickets (tap to recall)") is a station-level interaction not specified
 * in this wave's domain contract; deferred to Wave 7.4 (Employee Station).
 */
export async function recall(input: RecallInput, ctx: DomainCtx): Promise<{ ticket: TicketRecord; events: DomainEvent[] }> {
  const { tenantId, tx } = ctx;

  const existing = await findTicket(tx, tenantId, input.ticketId);
  if (existing == null) {
    throw new QueueDomainError('NOT_FOUND', `Unknown ticket: ${input.ticketId}`);
  }
  if (existing.status !== 'serving') {
    throw new QueueDomainError('BAD_REQUEST', 'Only a serving ticket can be recalled.');
  }

  const ticket = await tx.ticket.update({ where: { id: existing.id }, data: { calledAt: new Date() } });

  return { ticket, events: [{ type: 'ticket.recalled', tenantId, ticketId: ticket.id }] };
}

// ─── transfer ──────────────────────────────────────────────────────────────────

export interface TransferInput {
  ticketId: string;
  toWindowId: string;
  returnAfterDone: boolean;
  // `| undefined` (not just `?`) — exactOptionalPropertyTypes: the Zod-inferred
  // transferTicketSchema output type has an explicit `string | undefined`, not an absent key.
  returnToWindowId?: string | undefined;
}

// ─── recallSkipped ─────────────────────────────────────────────────────────────

export interface RecallSkippedInput {
  ticketId: string;
  windowId: string;
  userId: string;
}

/**
 * Wave 7.4 — "Skipped Tickets (tap to recall)" (PRODUCT.md line 32). `recall()` above only
 * re-announces a ticket that is ALREADY `serving` (its own docstring explicitly defers this
 * interaction). This is the station-level counterpart: bring a `skipped` ticket back into
 * `serving` at the CALLING employee's window — observably identical to `callNext` (fresh bell +
 * voice announce), so it emits `ticket.called`, not a new event type.
 */
export async function recallSkipped(
  input: RecallSkippedInput,
  ctx: DomainCtx,
): Promise<{ ticket: TicketRecord; events: DomainEvent[] }> {
  const { tenantId, tx } = ctx;

  const existing = await findTicket(tx, tenantId, input.ticketId);
  if (existing == null) {
    throw new QueueDomainError('NOT_FOUND', `Unknown ticket: ${input.ticketId}`);
  }
  if (existing.status !== 'skipped') {
    throw new QueueDomainError('BAD_REQUEST', 'Only a skipped ticket can be recalled from the skipped list.');
  }

  const ticket = await tx.ticket.update({
    where: { id: existing.id },
    data: { status: 'serving', windowId: input.windowId, servedBy: input.userId, calledAt: new Date() },
  });

  return {
    ticket,
    events: [{ type: 'ticket.called', tenantId, ticketId: ticket.id, payload: { windowId: input.windowId } }],
  };
}

/**
 * PRODUCT.md line 32: "employee picks destination → ticket immediately set to serving at target
 * window." Transfer routes a ticket to a WINDOW (a different employee), not to a different
 * service — the ticket's `serviceId` is unchanged. (The Wave-7.1 roadmap's shorthand pseudocode
 * described a `toServiceId`/`status=waiting` shape; PRODUCT.md is the authoritative product spec
 * per the framework's cross-alignment rule, so this implementation follows PRODUCT.md and the
 * pre-existing `transferTicketSchema` — `toWindowId`, immediate `serving` — over the roadmap's
 * inline shorthand.)
 */
export async function transfer(input: TransferInput, ctx: DomainCtx): Promise<{ ticket: TicketRecord; events: DomainEvent[] }> {
  const { tenantId, tx } = ctx;

  const existing = await findTicket(tx, tenantId, input.ticketId);
  if (existing == null) {
    throw new QueueDomainError('NOT_FOUND', `Unknown ticket: ${input.ticketId}`);
  }
  if (existing.status !== 'serving' || existing.windowId == null) {
    throw new QueueDomainError('BAD_REQUEST', 'Only a serving ticket can be transferred.');
  }

  const originWindowId = existing.windowId;
  const returnTo = input.returnAfterDone ? (input.returnToWindowId ?? originWindowId) : null;

  const ticket = await tx.ticket.update({
    where: { id: existing.id },
    data: {
      transferred: true,
      transferredFrom: originWindowId,
      windowId: input.toWindowId,
      servedBy: null,
      status: 'serving',
      calledAt: new Date(),
      returnTo,
    },
  });

  return { ticket, events: [{ type: 'ticket.transferred', tenantId, ticketId: ticket.id, payload: { toWindowId: input.toWindowId } }] };
}
