# Project State — CueLane

_V32 memory-governance tracker. Auto-updated at every Smart Checkpoint. Migrated from
`.cline/STATE.md` (Cline deprecated V31) on 2026-07-08 at framework sync V32.18 → V32.24._

PHASE:        **Phase 7 (Feature Buildout) IN PROGRESS — Wave 7.5 DONE + PM-verified**
LAST_DONE:    Phase 7 Wave 7.5 — Big Display (2026-07-08). Sonnet worker (died mid-verify on an API drop; PM
              finished container-rebuild + E2E + commit). Commits e3d4278 (T0 — public queue.state read:
              kioskProcedure, tenantSlug-resolved, single round-trip returning now-serving/up-next(6, prio-FIFO)/
              totalWaiting/branding(companyName+tier); Tenant is GLOBAL_MODEL so no withTenantContext wrap; test
              covers unauth wall-display path for free + premium), 0362ed4 (T1 — dark 16:9-locked wall screen:
              2×2 now-serving grid (gold #FCD34D, clamp() sizing, pulse-glow flash on change), up-next strip,
              total-waiting bar green/amber/red bands, live clock, marquee ticker; live via Wave 7.2 SSE
              (refetch queue.state on ticket.* events, no polling); free-tier "Powered by Powerbyte IT
              Solutions" shown/paid hidden; both CSS animations honor prefers-reduced-motion R13/motion.md).
              PM re-verified INDEPENDENTLY: typecheck 8/8 ✓; queue.test.ts 11/11 green (incl. new display.state)
              with DATABASE_URL loaded; pnpm -w build 8/8 ✓ (/[tenant]/display compiles 2.88 kB/126 kB); LIVE
              two-tab SSE proof — station Call Next → display grid showed 1-002@Window 1 within 2s WITH NO
              RELOAD, up-next dropped to 1-003, waiting 2→1 (screenshots wave75-display-baseline/after-call.png);
              demo tenant restored to pristine canonical 3 tickets (1-001 waiting / 2-001 serving@Win1 /
              P-001 completed@Win2) — deleted leftover 1-002/1-003 pollution from prior E2E. 57 commits ahead,
              0 pushed (HARD HOLD).
              Prior: 7.4 Employee Station (ec1575e/d2f5f9f/8bb268d/d794ec0/b8c068f). Single Sonnet worker, TDD, real dev stack.
              Commits ec1575e (T0 — queue.integration.test.ts afterAll teardown; restored demo to seed baseline
              4 svc/3 tickets/3 windows/3 users — RESOLVES prior DEFERRED #2), d2f5f9f (fix: admin-credentials
              authorize() filtered role:{in:['admin']} → silently blocked EVERY employee login despite the code
              supporting Role.Employee — real latent Phase-4 bug, caught because 7.4 finally tests a tenant
              EMPLOYEE path), 8bb268d (T1 backend — recallSkipped domain fn + tRPC procedure, listSkipped/
              listWindows queries, Valkey-backed station.getWindow/setWindow session keyed station:{tenantId}:
              {userId}), d794ec0 (T2/T3 frontend — station page/client: window-select→serve cycle→skipped
              panel→transfer dialog + useAnnounce chime/voice hook; reuses Auth.js session, protected route
              redirects unauth→/login?callbackUrl; tRPC v11 vanilla proxy client per kiosk pattern), b8c068f
              (fix: 3 bugs found live-testing — missing withTenantContext wrap; the wrap needed an ASYNC
              callback (a plain arrow returning a Prisma lazy-thenable loses AsyncLocalStorage context — new
              L6 lesson); React controlled/uncontrolled <Select> via empty-string sentinel).
              PM re-verified INDEPENDENTLY against ground truth: typecheck 8/8 ✓; pnpm -w test 58 green
              (shared 3, db 2, web 53) with DATABASE_URL+VALKEY_URL loaded; pnpm -w build 8/8 ✓ (/[tenant]/
              station compiles 3.72 kB/176 kB); live GET /demo/station → 307 → /login?callbackUrl (auth guard
              works); demo tenant DB re-confirmed CLEAN post-run (services=4/tickets=3/windows=3); two-tab SSE
              flow + transfer+Return-After-Done DB-verified per test-artifacts/phase7-station/NOTES.md +3 png.
              Prior waves: 7.3 Kiosk (b8797d9/0aaf118/cc2fca2), 7.2 SSE (07b792b/83c38a7/cc2dc13/d1ca600),
              7.1 Queue Engine (f1fa3a1/90627a7/afb709f/a937cf8), /login (f99916a). 55 commits ahead, 0 pushed (HARD HOLD).
NEXT:         Phase 7 Wave 7.6 — Admin Core CRUD. services / windows / users (+userServices) / tenant settings
              (printer, theme) routers + UI; tier usage meters + limit enforcement (API + UI). Deps: 7.1 (done).
              Verify: CRUD each entity; free-tier caps (10 users / 6 svc / 4 win) block AT limit; Service.number
              auto-assigned. Bigger multi-file wave (≤~12 files / a few Sonnet tasks) — plan-first: PM+Architect
              co-plan the router+UI+tier-gating decomposition before dispatch. Then 7.7 Dashboard/Media/Ads →
              7.9 Landing/Signup. Phase 6 (deploy) gated on owner CREDENTIALS.md + explicit word (HARD HOLD).
              REMINDER: every new feature's validation MUST exercise a TENANT path, not just super-admin (that
              gap hid the L6 auth bug + the employee-login-filter bug). For any Prisma access in a server
              component / non-staff resolver, wrap tenant-scoped reads in withTenantContext with an ASYNC callback.
DEFERRED (task-boundary fast-follows, non-blocking):
              1. Pre-existing @cuelane/shared lint failure (packages/shared schemas.smoke.test.ts, ESLint
                 TS-project-service parse error, from commit 7910825 BEFORE Wave 7.2). `pnpm -w lint` = 7/8.
                 Does not block dev/typecheck/tests (the smoke suite itself PASSES as a test — this is the
                 LINT parse step only). Fix at a task boundary.
              2. [RESOLVED in 7.4-T0 commit ec1575e] queue.integration.test.ts demo-tenant pollution — now
                 has afterAll teardown; demo re-verified clean (4 svc/3 tickets/3 windows).
              3. Ops note for Phase 6+: true zero-touch kiosk auto-print needs the kiosk browser launched
                 with a silent-print flag (Chrome --kiosk-printing); until then keep printerConfig.enabled
                 false. Not app code — deployment/runbook concern.
              4. Station "Change Window" button is a disabled placeholder (fast-follow); chime/voice actual
                 AUDIO output unasserted headless (code path verified error-free only); a second REAL employee
                 session completing a Return-After-Done ticket at the destination window not driven live
                 (domain behavior covered by queue.integration.test.ts's Return-After-Done test, passing).
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

---
## Wave 7.6 BACKEND (T1–T4,T8) — DONE + PM-VERIFIED (2026-07-08)
Commits c746895(T1 shared consts+schema+seed) 2df9a72(T2 admin domain+adminProcedure) 75e3117(T3 service+window)
bf9ef5e(T4 user+tenantAdmin) e7a3df6(T8 integration). PM ground-truth: typecheck 8/8, `pnpm -w test` 97/97 (14 files),
demo pristine (4svc/3win/3usr/3tkt, theme string). MULTI-TENANCY PROVEN (owner directive): full CRUD matrix vs
Tenant A+B independently + brand-new Tenant C zero-bootstrap; A-at-cap never blocks B/C; tenantId only from ctx;
all writes findFirst({id,tenantId})-guarded; no super-admin in new tests. Locked: block-AT-cap, theme=8-preset
string (custom→7.7), Tenant.tier source. 64 ahead, 0 pushed (HARD HOLD).
NEXT: Wave 7.6 UI (T5 foundation→T6 svc/win UI→T7 user/printer/theme/tenant UI) + T9 demo dataset (enrich premium
`demo` + add free-tier demo at caps; owner directive). Deferred: updateUserRoleSchema unwired; create limit-check
not race-hardened (documented, low-freq admin surface).

---
## Wave 7.6 UI (T5–T7) — DONE + PM-VERIFIED (2026-07-09)
Commits 698f0cc(T5 UI foundation: 9 shadcn primitives via CLI; `[tenant]/admin/layout.tsx` role-guard + tier tab-nav
Free-hides-Theme, logic in unit-tested `_lib/access.ts`+`limits.ts`; `_components/UsageMeter`+`DataTable`)
8b70c3c(T6 services+windows admin: TanStack tables + RHF/Zod dialogs, icon/color pickers, at-cap disable; fixed real
RSC bug — RHF `react-server` export condition broke the @cuelane/ui barrel → dedicated subpath exports `/form`+`/toaster`)
4a2fc2d(T7 users+service-assign+printer+theme[8-preset,Free-gated]+usage UI). All via tRPC vanilla proxy client.
PM ground-truth: typecheck clean, `pnpm -w test` 121/121 (shared6/db2/web113), build 8/8 (6 admin routes), container
rebuilt+serving, /demo/admin unauth→307. LIVE tenant-Admin browser render (Branch Admin/0000@demo, NOT super-admin):
services tab real data + "4·Unlimited" premium meter + tab nav + CRUD. Deferred: theme swatches picker-only preview,
NOT wired to runtime Kiosk/Station/Display CSS → Wave 7.7.

## Wave 7.6-T9 demo dataset — DONE + PM-VERIFIED (2026-07-09)
Commit cd5e320. seed.ts rewritten data-driven (`TenantSeedSpec`/`seedTenant()`), idempotent, real cuids. TWO tenants:
`demo`(PREMIUM, "Bayanihan Rural Bank — Lipa Branch") 8svc/5win/6usr/9tkt, theme=emerald+ticker, admin Branch Admin/0000;
NEW `clinic`(FREE, "Barangay Bagong Pag-asa Health Station") 6svc/4win/9usr/6tkt AT/NEAR caps, admin Nurse Admin/0001.
PM ground-truth (psql): demo premium 8/5/6/9, clinic free 6/4/9/6; seed idempotent (counts stable on re-run); typecheck
clean, `pnpm -w test` 121/121, build 8/8. LIVE browser as clinic tenant-Admin (Nurse Admin/0001): services "6/6" +
progressbar + "Free tier limit reached" msg + **Add Service DISABLED** + NO Theme tab (free-gated) — at-cap gating &
multi-tenancy proven live. Only test baseline needing update was seed.test.ts (asserts the demo fixture's own counts,
4/3/3/3→8/5/6/9); all other tests already ephemeral-tenant/counter-relative. 69 ahead, 0 pushed (HARD HOLD).
WAVE 7.6 COMPLETE (backend+UI+demo). NEXT: Wave 7.7 (Dashboard + Media + Display video/ads; incl. wiring theme presets
to runtime CSS — the T7 deferral). Then 7.8 Super Admin → 7.9 Landing/Signup.
New demo logins: demo(premium) Branch Admin/0000 · clinic(free) Nurse Admin/0001 · super-admin webmaster@localhost.com.
