# Pending Decisions — CueLane

Open `[WHAT]` / product / scope decisions awaiting the owner. `[HOW]` technical calls are made by
the PM and are NOT listed here. Each item carries a PM recommendation; the loop keeps advancing
un-gated work and re-surfaces these until answered. When answered, back-port to `docs/PRODUCT.md` +
`docs/DECISIONS_LOG.md` before acting.

---

## [ ] D1 — Real-time transport: PRODUCT.md says "WebSocket", the build ships "SSE" (over Valkey pub/sub)

**Type:** `[WHAT]` — spec ↔ implementation divergence (Back-Port Candidate; Rule 1 LIVING-SPEC / Flow-Back).
**Surfaced:** 2026-07-19 (corrects the stale "polling" note — the Employee Station/Display do NOT poll).

**The divergence**
- `docs/PRODUCT.md` (lines 58/68/80/90) specifies: *"Real-time sync: WebSocket connection per tenant
  via Valkey pub/sub — display updates immediately on ticket call, complete, skip, transfer."*
- The built system (Wave 7.2) uses **Server-Sent Events (SSE)** for the browser transport, backed by
  **Valkey pub/sub** with strict per-tenant channel isolation
  (`apps/web/src/app/api/tenants/[slug]/queue/stream/route.ts` + `server/realtime/publisher.ts`).
- So the spec's SUBSTANCE (live per-tenant updates via Valkey pub/sub on every queue event) is fully
  satisfied. Only the client transport word differs: **SSE vs WebSocket**.

**PM recommendation (strong): Option A — accept SSE, back-port PRODUCT.md.**
Queue updates are unidirectional (server → client); clients send actions via tRPC mutations, not the
socket. SSE fits this exactly, auto-reconnects, and avoids WebSocket's bidirectional overhead — it is
the better engineering choice here, and it is already live + tested across Kiosk, Display, and Station.
Recommend editing PRODUCT.md's four "WebSocket connection" lines to
*"SSE (Server-Sent Events) per tenant over Valkey pub/sub"* and logging `spec-divergent: transport`
in DECISIONS_LOG. (PRODUCT.md is human-only — owner edits, or asks the PM to draft the edit for review.)

- **Option A** — accept SSE, back-port the spec wording. *(recommended)*
- **Option B** — implement true WebSocket per tenant (keep the Valkey pub/sub backbone; swap the
  browser transport to WS across Kiosk/Display/Station). Real work; no functional gain for this use case.

---

## [ ] D2 — Login identifier: match by `name`-as-username vs add an `email` column to `User`

**Type:** `[WHAT]` — schema/scope decision (documented deferral).
**Surfaced:** 2026-07-19 (from `apps/web/src/server/auth/config.ts:53` TODO(schema-gap)).

Tenant-user login currently resolves the user by `name` (acting as a unique username per tenant); the
`User` model has no `email` column. PRODUCT.md scenario 13 mentions super-admin "email/password"
(super-admin is a separate platform account, so this may already be satisfied). Decision: is
email-based login required for tenant users? If yes → add `User.email` (migration) + switch the
credentials `authorize()` to match by email. If no → keep name-as-username and close this TODO.

**PM recommendation:** low priority — the current name-as-username login works and is tested. Defer
until the owner confirms email login is an actual product requirement for tenant users.
