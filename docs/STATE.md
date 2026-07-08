# Project State — CueLane

_V32 memory-governance tracker. Auto-updated at every Smart Checkpoint. Migrated from
`.cline/STATE.md` (Cline deprecated V31) on 2026-07-08 at framework sync V32.18 → V32.24._

PHASE:        **Phase 7 (Feature Buildout) IN PROGRESS — Wave 7.3 DONE + PM-verified**
LAST_DONE:    Phase 7 Wave 7.3 — Customer Kiosk (2026-07-08). Single Sonnet worker, TDD, real dev stack.
              Commits b8797d9 (T0 seed-cuid BLOCKER fix — seed.ts emits REAL Prisma cuids, never literal
              `seed-*` ids; Service upserts by natural unique (tenantId,number), Window/User/Ticket via
              find-by-natural-key-then-create; + packages/db/prisma/seed.test.ts TDD runs real seed CLI
              twice, asserts cuid shape + idempotency), 0aaf118 (T1 Kiosk UI — [tenant]/kiosk server shell
              + kiosk-client.tsx: transaction grid, priority-lane, issue→number→hidden-iframe-receipt→5s
              auto-reset, LIVE waiting counts via Wave-7.2 useQueueStream SSE (no polling); added kiosk-safe
              queueRouter.listActive query + its test; uses tRPC v11 vanilla proxy client — no react-query
              provider exists yet, avoided an unscoped cross-cutting add), cc2fca2 (fix: gate auto-print
              behind Tenant.settings.printerConfig.enabled — window.print() is modal/thread-blocking, hangs
              headless/kiosk if unconditional).
              PM re-verified INDEPENDENTLY against ground truth: typecheck 8/8 ✓; pnpm -w test 39/39 ✓
              (shared 3, db 2, web 34) with DATABASE_URL loaded (turbo test task is envMode=strict → needs
              DATABASE_URL in shell + dev DB up — established convention, NOT a bug); seed emits real cuids
              (tenant+all services match /^c[a-z0-9]{24}$/); live GET /demo/kiosk → 200 ("Demo Branch Co.",
              priority lane rendered); worker Playwright artifacts test-artifacts/phase7-kiosk/ (grid,
              regular ticket 2-002, priority P-002 verified in DB priority:true). NOAUTH publisher log-spam
              during web tests = BY DESIGN (fire-and-forget-safe), tests still 34/34.
              Prior waves: 7.2 SSE (07b792b/83c38a7/cc2dc13/d1ca600), 7.1 Queue Engine
              (f1fa3a1/90627a7/afb709f/a937cf8), /login (f99916a). 49 commits ahead of origin, 0 pushed (HARD HOLD).
NEXT:         Phase 7 Wave 7.4 — Employee Station (desktop). PIN login → window select (SessionMap in
              Valkey) → call/complete(3-option: done/noshow/return-after-done)/skip/recall/transfer,
              skipped panel, stats sidebar, Web Audio chime + SpeechSynthesis voice. Consumes the queueRouter
              staff procedures (callNext/complete/skip/recall/transfer, all built in 7.1) + useQueueStream.
              Verify: full serve cycle across two devices reflects instantly; voice announces. Then 7.5 Big
              Display → 7.6+ Admin. Phase 6 (deploy) gated on owner CREDENTIALS.md + explicit word (HARD HOLD).
DEFERRED (task-boundary fast-follows, non-blocking):
              1. Pre-existing @cuelane/shared lint failure (packages/shared schemas.smoke.test.ts, ESLint
                 TS-project-service parse error, from commit 7910825 BEFORE Wave 7.2). `pnpm -w lint` = 7/8.
                 Does not block dev/typecheck/tests. Fix at next boundary (before or alongside 7.4).
              2. queue.integration.test.ts pollutes the SHARED `demo` tenant with orphaned fixture rows
                 (no afterAll teardown) — demo now has 7 services / 9 tickets vs seeded 4/3, visible on the
                 real kiosk grid. Fix: give the integration test its OWN ephemeral tenant OR add teardown;
                 then re-seed demo clean. (Discovered by PM during 7.3 verify.)
              3. Ops note for Phase 6+: true zero-touch kiosk auto-print needs the kiosk browser launched
                 with a silent-print flag (Chrome --kiosk-printing); until then keep printerConfig.enabled
                 false. Not app code — deployment/runbook concern.
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
