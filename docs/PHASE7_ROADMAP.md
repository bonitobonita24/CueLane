# CueLane — Phase 7 Feature Buildout Roadmap

> Plan only. HARD HOLD: local dev, no push. shadcn/ui only. TDD mandatory.
> Authored by the Architect (co-planning with PM) at HEAD `f99916a`.

## 0. Scaffold Reality (what EXISTS vs what's placeholder)

**Contract/data layer is ~90% complete. The gap is business logic, realtime, and UI.**

### Prisma schema — COMPLETE (all PRODUCT.md entities present)
`packages/db/prisma/schema.prisma`, 2 migrations applied (`_init`, `_rls_tenant_isolation`).
Present: Tenant, Service, Window, User, UserService, Ticket (with **all** transfer/priority/return
fields: priority, transferred, transferredFrom, returnTo, returnedFromTransfer, calledAt, completedAt),
PlaylistEntry, SystemAd, TenantAd, Subscription, PasswordResetToken, AuditLog. All enums present.
`@@map` snake_case plural, tenant_id on every scoped table, RLS migration active.

**⚠️ TWO REAL SCHEMA GAPS the queue engine needs (fix in Wave 7.1):**
1. **Ticket has NO stored display number.** The `{serviceNumber}-NNN` / `P-NNN` string (schema comment
   line 166 says "generated in app logic") is not persisted, and there is no numeric `sequence` field.
   Deriving it by `count()` at issue time is race-prone. → Add `Ticket.number String` + `Ticket.sequence Int`.
2. **Service has NO ordinal number.** PRODUCT.md uses `{serviceNumber}` as the regular-ticket prefix,
   but Service only has name/icon/color/avgTime. → Add `Service.number Int` (per-tenant ordinal, unique
   per tenant). Plus an atomic daily sequence source (a `sequence_counters` table) so numbering is
   correct under concurrency and resets per day.

### tRPC — mostly greenfield
`apps/web/src/server/trpc/`: infra is solid and reusable — `publicProcedure` (rate-limited),
`protectedProcedure` (session guard), `requireTenant`, `requireRole(...)` middleware, superjson, context
(session/userId/roles/tenantId). **Only two routers exist:** `health`, `tenant` (getCurrent, listAll).
**Missing routers:** queue/ticket, service, window, user, media/playlist, ads (system+tenant),
subscription, superAdmin, auth/signup, passwordReset.

### DB client — L6 pattern ready (respect the lesson)
`packages/db/src/`: exports `prisma` (L6-guarded), `prismaRaw` (unguarded), `withTenantContext(tenantId, fn)`
(AsyncLocalStorage), `withTenant(tenantId, tx=>…)` (RLS transaction), `writeAuditLog`, repositories
(ticket has list/find/count helpers only — no mutations). GLOBAL_MODELS bypass the guard:
Tenant, AuditLog, SystemAd, Subscription.
**MANDATORY PATTERN for every new tenant-scoped procedure:** wrap prisma calls in
`withTenantContext(ctx.tenantId, () => prisma.…)`. For the **unauthenticated kiosk** (customer has no
session), resolve tenantId from the route slug via **`prismaRaw`** (guard throws with no context), THEN
`withTenantContext(tenantId, …)` for the scoped writes. This is the exact /login lesson.

### Realtime — GREENFIELD (does not exist)
`packages/jobs/` is BullMQ only (email/reports/webhooks queues + processors in `apps/worker`). There is
**no Valkey pub/sub, no WebSocket, no SSE.** A reusable Valkey connection parser exists
(`getConnectionOptions()` from `VALKEY_URL`). `apps/web` runs `next start` (output: standalone) with **no
custom server** and CSP `connect-src 'self'`.

### @cuelane/ui inventory — 9 primitives
`packages/ui/src/components/ui/`: badge, button, card, dialog, input, label, select, sonner (toast), table.
**Missing (add via shadcn CLI as waves need them):** form, tabs, dropdown-menu, switch, checkbox, tooltip,
separator, progress, sheet, avatar, skeleton, radio-group, alert-dialog.

### Pages — all placeholders
`/` (15-line landing), `[tenant]/{kiosk,station,display}` (~21-line stubs), `[tenant]/admin` +
`super-admin/dashboard` (have working role-guards already). `apps/web/src/components/` is empty;
`apps/web/src/lib/trpc.ts` is the typed client. Seed (`packages/db/prisma/seed.ts`) creates tenant
`demo` (premium), 4 services, 3 windows, users with bcrypt PINs, sample tickets.

---

## 1. Wave Roadmap (dependency-ordered; backbone before surfaces)

| Wave | Goal | Depends on | Done/Verify |
|------|------|-----------|-------------|
| **7.1 Queue Engine Backbone** (API + domain + tests, NO UI) | Schema addendum (Ticket.number/sequence, Service.number, sequence_counters) + migration; `queue` domain module (numbering, call-next routing, complete/skip/noshow/recall/transfer+return); `queueRouter` tRPC with tenant+RBAC guards + withTenantContext + kiosk prismaRaw path; unit + integration tests. | — | `pnpm test` green; a caller integration test issues→calls→completes a ticket; numbering `1-001`/`P-001` correct, priority-first-then-FIFO proven, transfer-return proven. |
| **7.2 Realtime Transport** | Valkey pub/sub publisher (`packages/realtime` or in `jobs`); SSE route `GET /api/[tenant]/stream` subscribing to `tenant:{id}:queue`; client hook `useQueueStream` w/ exponential-backoff reconnect; wire 7.1 mutations to publish domain events. | 7.1 | Two tabs on the stream; a `callNext` in one appears in the other <1s; drop+reconnect works. |
| **7.3 Customer Kiosk** | Transaction grid, priority-lane button, issue ticket (kiosk unauth path), auto-print hidden iframe, 5s auto-reset, live waiting counts via stream. | 7.1, 7.2 | Issue a ticket end-to-end; receipt prints; grid resets; counts update live. |
| **7.4 Employee Station (desktop)** | PIN login → window select (SessionMap in Valkey) → call/complete(3-option)/skip/recall/transfer(+Return-After-Done), skipped panel, stats sidebar, Web Audio chime + SpeechSynthesis voice. | 7.1, 7.2 | Full serve cycle across two devices reflects instantly; voice announces. |
| **7.5 Big Display** | 2×2 now-serving grid (gold names, clamp sizing, pulse-glow), up-next, total-waiting bar (color bands), ticker, 16:9 lock, live updates. (Video/ads panel → 7.7.) | 7.1, 7.2 | A call updates the grid instantly; layout locks 16:9; free-tier Powerbyte branding shows. |
| **7.6 Admin Core CRUD** | services / windows / users(+userServices) / tenant settings / printer / theme routers + UI; tier usage meters + limit enforcement (API + UI). | 7.1 | CRUD each entity; free-tier caps (10 users/6 svc/4 win) block at limit; Service.number auto-assigned. |
| **7.7 Admin Dashboard + Media + Display Video/Ads** | 8-KPI dashboard + charts (Recharts); Media manager (playlist/LIVE modes, uploads via MinIO); Big Display video panel + System/Tenant ad interrupt-every-5-min engine; tier gating. | 7.1, 7.5, 7.6 | KPIs match DB; playlist/live plays; system ad interrupts on free tier every 5 min then resumes. |
| **7.8 Super Admin** | Tenant directory, tier toggle, suspend/reactivate, platform analytics, System Ads Manager CRUD (global `system-ads/` prefix). | 7.1, 7.7 | Toggle tier / suspend reflected in tenant surfaces; system ad appears on free displays. |
| **7.9 Landing + Signup + Auth polish** | Marketing landing (`/`), signup → creates tenant + admin, password-reset flow (email via MailHog), tier-gating polish. Xendit + Turnstile **stubbed** in dev (owner-pending keys). | 7.1, 7.6 | Signup creates a working tenant + redirects to admin; reset email lands in MailHog. |

Each wave ≤ ~12 files / a few Sonnet tasks. Waves 7.3–7.5 are independently demo-able and could run
in parallel once 7.1+7.2 land (they touch disjoint page trees), but keep them sequential per the
swarm sequential-by-default rule unless proven file-disjoint.

### ⚠️ [WHAT]/[HOW] flag for PM — realtime transport choice
PRODUCT.md literally says "WebSocket." Next.js `output: standalone` + `next start` has **no custom
server**, so true WS needs a `server.ts` that replaces `next start` (complicates the already-built
Docker/compose). **Architect [HOW] recommendation: use SSE** (`ReadableStream` in a Next route handler
subscribing to Valkey pub/sub). SSE satisfies every functional realtime requirement — per-tenant channel,
the 6 ticket events, native `EventSource` auto-reconnect, no polling — because all surfaces need only
server→client fanout (publishers already act via tRPC mutations client→server). `connect-src 'self'`
already permits it. This deviates from the word "WebSocket" but not the behavior; surfacing to PM in case
it is a [WHAT]. If WS is required, add a Wave-7.2 sub-task for a custom server + Traefik route.

---

## 2. WAVE 7.1 — Detailed Worker Prompts (execute now)

**Recommendation: Wave 7.1 = PURE QUEUE-ENGINE BACKBONE (API + domain + tests, NO UI, NO realtime transport).**
One-line rationale: the numbering + call-next routing + transfer/return logic is the highest-risk,
most-shared code — locking it with tests once prevents four-fold rework across kiosk/station/display/admin.
The domain layer returns event descriptors (no direct publish), so 7.2 wires realtime with zero refactor.

Dependency chain is serial (T1→T2→T3→T4). Within T2/T3 the worker writes tests FIRST (TDD skill).

---

### W7.1-T1 — Schema addendum + migration (SERIAL, first)
- **Skills:** context7 (Prisma schema/migrate current syntax), test-driven-development (seed/migrate verify).
- **Files:** `packages/db/prisma/schema.prisma`, new migration under `packages/db/prisma/migrations/`,
  `packages/db/prisma/seed.ts` (backfill), `packages/shared/src/types/index.ts` + `schemas/index.ts` (extend Ticket/Service types).
- **Contract:**
  - `Ticket`: add `number String` (display, e.g. `"1-003"`/`"P-001"`), `sequence Int` (numeric part). Index `@@index([tenantId, createdAt])` for FIFO reads.
  - `Service`: add `number Int` (per-tenant ordinal; enforce uniqueness per tenant via `@@unique([tenantId, number])`).
  - New model `SequenceCounter` (NOT a global model — tenant-scoped): `{ id, tenantId @map("tenant_id"), key String, value Int @default(0), @@unique([tenantId, key]), @@map("sequence_counters") }`. Key convention: regular = `"<serviceId>:<YYYYMMDD>"`, priority = `"priority:<YYYYMMDD>"`.
  - Seed: assign `Service.number` 1..N in creation order; leave tickets’ `number`/`sequence` backfilled deterministically.
- **Done/Verify:** `pnpm --filter @cuelane/db prisma migrate dev` runs clean; `pnpm --filter @cuelane/db db:seed` succeeds; `pnpm --filter @cuelane/db build` green; new fields visible in generated client.

### W7.1-T2 — Queue domain module (SERIAL, after T1; TDD tests-first)
- **Skills:** test-driven-development (MANDATORY — write the spec test before impl), systematic-debugging (routing bugs), context7 (Prisma transactions/serializable).
- **Files:** `apps/web/src/server/domain/queue.ts` (+ `queue.test.ts`). Pure-ish functions receiving a Prisma client/tx; return `{ ticket, events: DomainEvent[] }` — NEVER publish directly.
- **Contract (functions):**
  - `issueTicket({ serviceId, priority }, ctx)`: atomically allocate sequence via `SequenceCounter` upsert-increment inside `withTenant(tenantId, tx=>…)` (RLS tx); format `number` = priority ? `` `P-${pad3(seq)}` `` : `` `${service.number}-${pad3(seq)}` ``; create Ticket(status=waiting). Emits `ticket.issued` (internal) — no external event required by PRODUCT but return counts.
  - `callNext({ windowId, userId, serviceIds }, ctx)`: pick next among the employee’s serviceIds, **priority DESC then createdAt ASC** (FIFO), including transfer-return tickets due to this window first; set status=serving, windowId, servedBy, calledAt. Emits `ticket.called`.
  - `complete({ ticketId, outcome: 'done'|'noshow' }, ctx)`: set completed/noshow + completedAt; **if `returnTo` set AND outcome==='done' AND !returnedFromTransfer** → requeue (status=waiting, windowId=null, returnedFromTransfer=true, windowId target = returnTo on next call). Emits `ticket.completed`|`ticket.noshow`.
  - `skip({ ticketId }, ctx)` → status=skipped, emits `ticket.skipped`.
  - `recall({ ticketId }, ctx)` → re-announce current serving ticket, emits `ticket.recalled`.
  - `transfer({ ticketId, toServiceId, returnAfterDone }, ctx)` → set transferred, transferredFrom=current window, serviceId=toServiceId, returnTo = returnAfterDone ? original window : null, status=waiting. Emits `ticket.transferred`. (Return-After-Done is Premium-gated — enforce tier at router layer, T3.)
  - Helpers: `pad3(n)`, `todayKey()`.
- **Done/Verify:** `queue.test.ts` covers: numbering (regular per-service, priority tenant-wide, daily reset, 3-digit pad, no collisions under 2 concurrent issues), call-next ordering (priority beats older regular), transfer+return round-trip, skip/recall/noshow transitions. All green.

### W7.1-T3 — queueRouter tRPC + wiring (SERIAL, after T2; TDD tests-first)
- **Skills:** test-driven-development, owasp-security + secure-code-guardian (RBAC depth, tenant scoping, the kiosk-unauth surface, L6/prismaRaw correctness), context7 (tRPC v11 procedure/middleware API).
- **Files:** `apps/web/src/server/trpc/routers/queue.ts`, edit `apps/web/src/server/trpc/root.ts` (register), add a `kioskProcedure` helper in `apps/web/src/server/trpc/trpc.ts` (publicProcedure that takes `tenantSlug`, resolves tenantId via **`prismaRaw`**, then runs the handler inside `withTenantContext(tenantId, …)`).
- **Contract (procedures — all tenant-scoped calls wrapped in `withTenantContext`):**
  - `issue` — **kioskProcedure** (unauthenticated), input `{ tenantSlug, serviceId, priority }` (reuse `createTicketSchema`), resolve tenant via prismaRaw, call domain `issueTicket`. Returns `{ number, ticketId }`.
  - `callNext` / `complete` / `skip` / `recall` / `transfer` — `protectedProcedure.use(requireTenant).use(requireRole(Role.Employee, Role.Admin))`; validate with existing `updateTicketStatusSchema`/`transferTicketSchema`/`recallTicketSchema`; **enforce Premium gate on transfer Return-After-Done** (read tenant.tier via prismaRaw or ctx, FORBIDDEN if free + returnAfterDone).
  - `listWaiting` / `nowServing` / `counts` — queries. `counts` callable from kiosk (kioskProcedure) for live badges; `listWaiting`/`nowServing` protected.
  - Every mutation returns the domain `events[]` for 7.2 to publish (7.1 does not publish yet — stub/no-op).
- **Done/Verify:** router-level tests via `createCaller` prove: kiosk `issue` works with NO session; `callNext` requires employee role (UNAUTHORIZED without session, FORBIDDEN for customer); free-tier Return-After-Done → FORBIDDEN; a full issue→callNext→complete sequence returns coherent state. `pnpm --filter @cuelane/web typecheck` + tests green.

### W7.1-T4 — Cross-cutting integration test + PM verify harness (SERIAL, after T3)
- **Skills:** test-driven-development, systematic-debugging.
- **Files:** `apps/web/src/server/trpc/routers/queue.integration.test.ts` (against a test DB or seeded transaction), plus a short `docs/STATE.md` evidence note (append, no framework changes).
- **Contract:** exercise the real caller against the seeded `demo` tenant: issue 2 regular + 1 priority across 2 services → assert numbers `1-001`, `1-002`, `P-001`; callNext twice → priority served first; transfer with Return-After-Done → complete → assert requeue to origin window.
- **Done/Verify:** integration test green; PM re-runs `pnpm test` + spot-checks numbers against ground truth (not just self-report).

**Sequencing:** T1 → T2 → T3 → T4, strictly serial (dependency chain). No parallelism inside 7.1 — it is
the foundation the whole phase stands on. TDD is enforced per-task (tests precede impl within T2/T3).

---

## PM Addendum (2026-07-08, post-Wave-7.1)

**Wave 7.1 = DONE + PM-verified.** Gates green (typecheck 8/8, build 8/8, lint clean), tests `@cuelane/shared` 3/3 + `@cuelane/web` 25/25 (15 domain + 6 router + 4 integration vs the real seeded `demo` DB), migration `20260708120000_queue_engine_backbone` applied. Commits `f1fa3a1` (T1 schema+migration+seed), `90627a7` (T2 domain), `afb709f` (T3 router+kioskProcedure), `a937cf8` (T4 integration). No push (HARD HOLD).

**Wave 7.2 = DONE + PM-verified (SSE realtime transport).** Domain `events[]` (returned since 7.1, never published) now wired to Valkey pub/sub → SSE. `queueChannel(tenantId)` = `tenant:{tenantId}:queue`; publisher is fire-and-forget-safe (Valkey outage never fails a mutation). SSE Route Handler `app/api/tenants/[slug]/queue/stream` (runtime=nodejs, force-dynamic, dedicated per-tenant subscriber client, `: connected`+25s heartbeat, abort cleanup, **strict per-tenant isolation — tenantId derived server-side, never from client**). Client `useQueueStream` EventSource hook with backoff reconnect. Added `ioredis` as a direct `apps/web` dep. Gates: typecheck 8/8 ✓, web tests 33/33 ✓ (5 files, +publisher.test.ts +route.test.ts). PM SSE E2E by hand: published a real event to the tenant channel, observed it arrive on a live `curl -N …/stream` as a `data:` frame (subscribers delivered=1). Commits `07b792b` (T1 publisher), `83c38a7` (T2 router wiring), `cc2dc13` (T3 route handler), `d1ca600` (T4 hook). No push (HARD HOLD). NOTE: pre-existing `@cuelane/shared` smoke-test lint parse error (commit `7910825`, pre-dates this wave) deferred — out of scope.

**T2 transfer/complete semantics — correction to the pseudocode above:** implemented per **PRODUCT.md line 32** (transfer routes a ticket to a WINDOW and it becomes `serving`; Return-After-Done auto-returns to `serving` at the origin window), NOT the roadmap's inline `toServiceId`/`status=waiting` shorthand, which conflicted with both PRODUCT.md and the pre-existing `transferTicketSchema`. Treat PRODUCT.md line 32 as authoritative for transfer.

**`recall()` scope:** Wave 7.1 implements recall = "re-announce the CURRENT serving ticket" only. Recalling a *skipped* ticket back into serving (a separate Employee-Station affordance) is deferred to **Wave 7.4**.

**⚠️ Wave 7.3 PRE-REQ (BLOCKER for kiosk/station UI):** `packages/db/prisma/seed.ts` assigns non-cuid custom string IDs to seeded rows, but every shared zod schema validates entity IDs with `.cuid()`. No tRPC input referencing a seeded entity's id will validate → kiosk/station calls against `demo` will 400. **Fix at the start of Wave 7.3** — preferred direction: make the seed generate real cuids (matches Prisma `@default(cuid())` runtime behavior) so seeded data is indistinguishable from runtime-created data; do NOT loosen the schemas (they correctly mirror runtime). Re-verify the seed + integration tests after.
