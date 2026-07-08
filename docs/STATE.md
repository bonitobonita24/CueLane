# Project State — CueLane

_V32 memory-governance tracker. Auto-updated at every Smart Checkpoint. Migrated from
`.cline/STATE.md` (Cline deprecated V31) on 2026-07-08 at framework sync V32.18 → V32.24._

PHASE:        **Phase 7 (Feature Buildout) IN PROGRESS — Wave 7.1 DONE + PM-verified**
LAST_DONE:    Phase 7 Wave 7.1 — Queue Engine Backbone (2026-07-08). TDD, real dev Postgres.
              Commits f1fa3a1 (schema: Service.number, Ticket.number/sequence, atomic SequenceCounter +
              migration 20260708120000_queue_engine_backbone + seed backfill), 90627a7 (domain/queue.ts:
              race-safe numbering, priority-first→FIFO callNext, complete/skip/noshow/recall/transfer+
              Return-After-Done), afb709f (queueRouter tRPC + kioskProcedure), a937cf8 (integration test).
              PM re-verified independently: typecheck 8/8, tests shared 3/3 + web 25/25, migrate up-to-date.
              Prior: /login page (f99916a) + SSE realtime decision (88624f5). Roadmap docs/PHASE7_ROADMAP.md.
              41 commits ahead of origin, 0 pushed (HARD HOLD). App + worker containers healthy.
NEXT:         Phase 7 Wave 7.2 — Realtime Transport (SSE: Valkey pub/sub → Route Handler ReadableStream →
              EventSource; per-tenant channel, 6 events). Then 7.3 Kiosk (⚠ FIX seed non-cuid IDs vs .cuid()
              schemas FIRST — see PHASE7_ROADMAP PM Addendum) → 7.4 Station → 7.5 Display → 7.6+ Admin.
              Phase 6 (deploy) is gated on owner CREDENTIALS.md items + explicit word (HARD HOLD).
EVIDENCE:     Ground-truth verified by exercising the REAL running dev stack (PM, 2026-07-08):
              • Gates: pnpm -w typecheck 8/8 ✓ · pnpm -w lint 8/8 ✓ · pnpm -w build 8/8 ✓ ·
                pnpm -w test 3/3 ✓ (new @cuelane/shared smoke suite; repo previously had 0 tests).
              • Stack up via `bash deploy/compose/start.sh dev up -d --build` — 8 services:
                postgres/pgbouncer/valkey/minio/mailhog/pgadmin all healthy; app healthy
                (GET /api/health → 200 {"status":"ok","db":"up"}); worker steady Up, 0 restarts,
                clean logs (queues: email, reports, webhooks).
              • Migrate + seed against the running DB: `prisma migrate deploy` applied 2/2
                (20260708000000_init, 20260708000001_rls_tenant_isolation); seed created tenant
                "Demo Branch Co." (slug demo, premium/active) + subscription + 4 services +
                3 windows + admin(Branch Admin PIN 0000) + 2 employees + 6 service-assignments +
                3 tickets. Verified live via authenticated tRPC read.
              • Playwright E2E (screenshots in test-artifacts/phase5/):
                (a) home / renders (title CueLane) — 01-home.png; /api/health 200.
                (b) tenant subdirectory routing /demo/kiosk + /demo/display render with the
                    DB-resolved tenant name — 02-demo-kiosk.png, 03-demo-display.png.
                (c) super-admin login WORKS: session null→{roles:[super_admin]} via the credentials
                    flow using the official LOCAL-DEV cred (Server-Setups; NOT stored here); protected
                    /super-admin/dashboard then rendered (not redirected) — 04-superadmin-dashboard.png.
                (d) CRUD round-trip: seed create → authenticated super-admin tRPC tenant.listAll read
                    returned the demo tenant (HTTP→tRPC→RBAC→Prisma→Postgres), 200.
                (e) email→MailHog: enqueued an email job → worker processed+sent → MailHog received
                    (to validator@example.com, subj "Phase5 MailHog Test") — 05-mailhog.png.
              • react-doctor: 80/100, 0 errors, 7 warnings. High-sev (advisory, NOT fixed):
                Bug "sequential independent awaits" [tenant]/admin/page.tsx:11;
                Perf "array lookup in loop" server/trpc/middleware/rbac.ts:9. Low-priority nits skipped.
FIXES (local main, no push):
              8c9560b fix(deploy): start.sh --project-directory (compose v5 env-file/build-context)
              152b941 fix(worker): Docker runner — root manifest + per-pkg node_modules + openssl (bug 1)
              575dc8f fix(web): Docker monorepo standalone + Prisma engine + tailwindcss-animate
              6b6423a fix(jobs,db,storage): Node ESM .js import extensions + DLQ names off ':' (BullMQ)
              9a2da21 fix(db): Prisma binaryTargets linux-musl-openssl-3 (alpine runtime)
              5a38fdf fix(auth): edge-safe split config — Prisma out of Edge middleware bundle (bug 2)
              c2c775e feat(web): /api/health readiness route (healthchecks 404'd before)
              31c4384 fix(db): seed uses bcrypt to match the auth provider (was SHA-256 → login failed)
              803738a feat(deploy): dev compose in-network env overrides (app/worker → service names)
              (+ test(shared) smoke suite)
KNOWN GAPS (Phase 7/8 follow-ups — NOT blockers):
              • No /login page exists (auth is fully wired + middleware-protected, but the sign-in
                UI was never scaffolded; pages.signIn:'/login' 404s). UI login E2E was validated at
                the backend/credentials level instead. Build /login in Phase 7.
              • App pages ([tenant]/kiosk|display|station|admin, super-admin/dashboard) are Phase-4
                placeholders; real feature UI + full CRUD flows are Phase 7/8.
              • Test coverage is one smoke suite only — grow it in Phase 8.
BLOCKERS:     Human ⏳ in CREDENTIALS.md before Phase 6 DEPLOY (NOT dev): Docker Hub token, SMTP
              creds, Xendit API keys (TEST+LIVE), Turnstile LIVE keys. Dev uses MailHog +
              Turnstile test keys + the official local-dev super-admin cred (Server-Setups) — not blocked.
GIT_BRANCH:   main (Phase 5 fixes committed local; UNPUSHED — HARD HOLD, local dev only)
DEPLOY_HOLD:  ⛔ LOCAL DEV ONLY. No staging/prod push without explicit owner word.
PORTS (dev):  APP=41716 WORKER=41717 DB=41706 PGBOUNCER=41707 CACHE=41708 MINIO=41709
              MINIO_CONSOLE=41710 MAILHOG_SMTP=41711 MAILHOG_UI=41712 PGADMIN=41713
              PRISMA_STUDIO=41726
MODELS:
  planning:   Opus 4.8 (PM/architect)
  execution:  claude-sonnet-4-6 (swarm workers, per battle-test discipline)
TENANCY:      multi (subdirectory /{tenant}/), tenant_id on all entities, L6 Prisma RLS
SECURITY:     level=none (no gov/LGU/regulated flag); L3 RBAC + L5 AuditLog + L6 guardrails active
