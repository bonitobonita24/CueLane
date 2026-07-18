# Project State — CueLane

_V32 memory-governance tracker. Auto-updated at every Smart Checkpoint. Migrated from
`.cline/STATE.md` (Cline deprecated V31) on 2026-07-08 at framework sync V32.18 → V32.24._

PHASE:        **Phase 7 COMPLETE + Phase 8 sweep DONE. v0.1.0 tagged. Build genuinely complete; only deferred future-scope + 2 owner [WHAT]s remain.**
CURRENT:      Resume session 2026-07-19 (Full Auto). ✅ DONE THIS SESSION:
              (1) **Versioning baseline** — cut first annotated git tag **v0.1.0** (SemVer, pre-1.0 dev build;
                  package.json already mirrored 0.1.0). Git tags = fleet source of truth.
              (2) **Sidebar-footer white-label** (design-defaults Entry 3) — new `apps/web/src/lib/app-version.ts`
                  (`APP_VERSION='0.1.0'`) + `SidebarFooter` block in the shared `AppShell` (Tenant Admin / Super
                  Admin / Employee Station): muted `v0.1.0` + single "Developed by Powerbyte IT Solutions" link
                  (new tab, noopener noreferrer), hidden in the collapsed icon-rail so Station keeps max working
                  area. RSC-safe (SidebarFooter from the `@cuelane/ui/sidebar` subpath, never the barrel).
                  Verified: web typecheck 8/8 + full production build 8/8 (all RSC layouts compiled clean).
                  Commit cb49b4f. Live footer screenshot PENDING next dev-stack-up (owner left the stack down).
              (3) **Governance** — created `docs/PENDING_DECISIONS.md` (was missing) with 2 tracked owner [WHAT]s;
                  corrected the stale "polling" memory (Employee Station is SSE, not polling — since Wave 7.2).
              **[WHAT] decisions:**
                • **D1 — real-time transport: RESOLVED 2026-07-19 (owner) = accept SSE + back-port.** PRODUCT.md's
                  12 "WebSocket" mentions reconciled to "SSE over Valkey pub/sub"; DECISIONS_LOG logged
                  `spec-divergent: transport`. No code change (SSE was already shipped in Wave 7.2).
                • **D2 — login identifier: DEFERRED 2026-07-19 (owner) = keep `name`-as-username login** (no
                  `User.email` column). Revisit only if email login becomes a confirmed requirement. Stays open in
                  PENDING_DECISIONS as low-priority.
              **Un-gated BUILD queue is EMPTY** — IMPLEMENTATION_MAP is complete; remaining ⏭ items (native mobile,
              Xendit payments, async report export) are deliberately deferred future-scope, not gaps.
              **116 commits ahead of origin, 0 pushed (HARD HOLD — local dev only).**
              NEXT: owner answers D1/D2 → back-port to PRODUCT.md + DECISIONS_LOG, then execute if D1=B. Otherwise
              the build is genuinely complete; any further work is new PRODUCT.md scope. Phase-6 deploy prep stays
              OWNER-GATED (Docker Hub / SMTP / Xendit / Turnstile creds).
              ── prior session ──
PREV_SESSION: Post-Phase-7 polish + Phase-8 sweep (2026-07-10). Phase 7 (waves 7.1–7.9) is COMPLETE; that session
              added four things on top:
              (1) **Phase-8 completeness sweep DONE** — 031f0af docs(state) + 1516d78 docs(impl-map). Gates green
                  (typecheck 8/8, test 252/252, build 8/8); data canonical (demo 9 / clinic 6, 2 tenants, system_ads 1);
                  full Playwright regression both tenants + super-admin; IMPLEMENTATION_MAP reconciled to built reality.
              (2) **Cross-tenant page-guard HARDENING** — 7dae7ca. middleware now enforces URL-tenant ↔ session-tenant
                  match (JWT carries tenantSlug; a mismatched non-superadmin redirects to their own tenant; super-admin
                  exempt). DB/L6/RLS guard intact (defense-in-depth). +6 TDD tests (suite 252→258).
              (3) **SIDEBAR APP-SHELL REDESIGN** — b1598b3 / d59003b / f4998bd / 0ed0787. Admin + Super-Admin moved off
                  top-tabs onto a collapsible left-sidebar shell (shadcn `sidebar`, RSC-safe SUBPATH export
                  `@cuelane/ui/sidebar` — NEVER the barrel; hamburger + off-canvas on mobile; content in
                  `mx-auto max-w-7xl px-4 sm:px-6 lg:px-8` gutter container). Employee Station = NON-OBTRUSIVE
                  collapsed icon-rail (max working area). Kiosk + Display stay full-bleed. Embodies the new global design
                  defaults. build 8/8; tier-gating/theme/auth preserved; live-verified desktop+mobile both tenants.
                  Evidence test-artifacts/phase8-sidebar/.
              (4) **SUPER-ADMIN LOGIN RE-SEEDED** — platform super-admin is now the fleet `tenant_manager` =
                  **`tenantadmin@powerbyteitsolutions.com`** (was webmaster@localhost.com). bcrypt cost 10 in gitignored
                  `.env.dev` — ⚠ the hash MUST be `$$`-escaped (compose `env_file` interpolates `$`; see LESSONS_GLOBAL
                  `docker-compose.env-file.bcrypt-hash-dollar-interpolation`). Password ONLY in the vault
                  (`Server-Setups/secrets/universal-login-credentials.enc.yaml`, nested schema). Tenant admins unchanged
                  (demo `Branch Admin`/0000 · clinic `Nurse Admin`/0001).
              Dev stack UP + healthy (app http://localhost:41716). **113 commits ahead of origin, 0 pushed (HARD HOLD —
              local dev only; no staging/prod without explicit owner word).**
              NEXT: continue Phase-7/8 follow-ups + fix any bugs; keep gates green. Eventual **fleet 3-tier RBAC retrofit**
              (Scenario 42 · `.ai_prompt/rbac.md` · MG `feat/tenant-rbac-3tier`) — CueLane is tenant-based but not yet on
              `tenant_manager`/`tenant_superadmin`/`tenant_admin`; adopt on owner word, dev-first. Phase-6 deploy prep is
              OWNER-GATED (needs Docker Hub / SMTP / Xendit / Turnstile creds).
              ── history ──
PREV_DONE:    Phase 7 Wave 7.7a — Admin Dashboard (2026-07-09). 146ecbd/d2531ba/8595d4f. 8 KPIs, tier-gated advanced
              blocks, searchable ticket log. Barrel/RSC bug found+fixed (ToggleGroup → dedicated subpaths). PM-verified
              typecheck 8/8, test 130/130, build 8/8, live both tenants match psql. See memory for detail.
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

---
## Wave 7.7c (Media Manager) — DONE + PM-VERIFIED (2026-07-09)
Commits c818f80(T1 storage tier caps+widened mime) fc01226(T1 decision log) efc43f4(T2a media domain)
0646e10(T2 media+tenantAd routers) ef09b13(T3 upload route+T4 admin UI) 3a24ae5(T3 decision log)
721d1a3(T5 integration test) + fix(db) tenant-guard create/createMany bug found+fixed during live
verification (regression test added, packages/db/src/middleware/tenant-guard.test.ts).
Schema was ALREADY COMPLETE (PlaylistEntry/SystemAd/TenantAd) — no migration this wave. New:
`@cuelane/storage` tier-aware upload caps (free=300MB/premium=800MB) + widened video mime allowlist
(mp4/webm/mov/avi/mkv); `mediaRouter`+`tenantAdRouter` tRPC (list/createYoutube/reorder/delete,
Premium-gated ads); multipart upload Route Handler (`/api/tenants/[slug]/media/upload`, manual
adminProcedure-equivalent guard, tier cap enforcement, real MinIO round-trip); Media admin tab
(VideoMode toggle, playlist manager w/ YouTube-URL parser + XHR upload progress + up/down reorder,
Tenant Ads section Premium+LIVE-only).
PM ground-truth: typecheck 8/8, `pnpm -w test` 196/196 (storage11/shared18/db5/web162), build 8/8.
Container rebuilt (`start.sh dev up -d --build`). LIVE verified via real HTTP session (Auth.js
credentials login as Branch Admin/0000@demo, not super-admin): unauth `/demo/admin/media`→307→
/login; authed→200; `media.createYoutube`→200 real row persisted+listed; multipart upload (2MB
fake video/mp4)→201, real row w/ correct fileSize+storageKey, verified present in MinIO then
absent after `media.delete` (storage cleanup confirmed); cross-tenant upload attempt (demo session
→ clinic slug)→403; unauthenticated upload→401. All test artifacts cleaned from demo/clinic
(playlist_entries + tenant_ads both 0 rows post-cleanup, confirmed via psql).
REAL BUG FOUND+FIXED: L6 tenant-guard (`packages/db/src/middleware/tenant-guard.ts`) unconditionally
injected `where:{tenantId}` into EVERY Prisma op including create/createMany (which have no `where`
arg) — 500 the moment ANY code calls the guarded `prisma.<model>.create()` directly (every prior
caller happened to go through `tx.<model>.create()` inside `withTenant()`, a different raw client,
so this was latent). Fixed + regression-tested (3 new tests) + logged to global lessons ledger.
Deferred (not fixed, flagged): (1) dev MinIO has no bucket auto-create step in compose — a fresh
volume has zero buckets (worked around manually this session); (2) upload route buffers the whole
file in memory + real 300-800MB upload / Traefik-Next.js body-size-limit interplay not verified
with an actual large file. Both recorded in docs/DECISIONS_LOG.md 2026-07-09.
NEXT: Wave 7.8 (Super Admin: tenant directory, tier override, SystemAd CRUD) → 7.9 Landing/Signup.
Nothing owner-gated open for 7.7c.

---
## Wave 7.7d (Display Video/Ads Interrupt Engine) — DONE + PM-VERIFIED (2026-07-09)
Commits 5120291(T1 storage public-URL+global ns) 78f7368(T1 env wiring) e12a226(T1 CSP)
6944279(T1 displayRouter) 49348e3(T3a MinIO bucket auto-init) 19803ca(T2 VideoPanel+ad engine+theming)
07b2ba7(T3 large-upload verify) bcef97a(T4 integration) 5be166d(lint/typecheck fixes).
Closes both Wave 7.7c deferrals: MinIO bucket now auto-created on a fresh `start.sh dev up`
(idempotent `minio-init` one-shot service); large-upload path verified end-to-end with a real 60MB
file (byte-exact round trip, ~400-650ms — no framework-level body-size rejection observed at this
app's pinned next@15.1.x).
New: `displayRouter.media` (public kioskProcedure, one round trip: videoMode/liveStreamUrl,
playlist w/ presigned local-media URLs, tier-gated ads — Free=SystemAd interrupt always, Premium+
LIVE=TenantAd interrupt, Premium+Playlist=none, per PRODUCT.md exactly); `VideoPanel` client
component (YouTube IFrame API via a lean custom hook, local `<video>`, 5-minute ad-interrupt timer
w/ local-playback-position resume, live-embed dwell fallback); CSP extended (frame-src youtube(-
nocookie), script-src youtube.com for the IFrame bootstrap, media-src env-derived public storage
origin); `--display-accent` (packages/ui) replaces hardcoded `#FCD34D` gold with the tenant's theme
primary lightened via color-mix() for dark-bg legibility — also fixes a real pre-existing spec
deviation (ticket numbers were gold, PRODUCT.md says white — now `#efeff1`).
[HOW] decisions (docs/DECISIONS_LOG.md): public-vs-internal MinIO endpoint split (browser can't
resolve the container-network hostname); YouTube embeds use the standard youtube.com IFrame API
path, NOT an unverified `host` nocookie param (context7 didn't confirm it for next@15.1.8);
color-mix ratio for `--display-accent` is a heuristic, not a per-preset computed-contrast guarantee.
PM ground-truth: typecheck 8/8, `pnpm -w test` 210/210 (storage15/shared18/db5/web172), build 8/8
(no RSC/CSP/barrel regressions). Container rebuilt (`start.sh dev up -d --build`) — `/api/health`
200, `minio-init` succeeded (bucket auto-created). LIVE Playwright verification: `/demo/display`
(premium, no playlist) → "No video playing" placeholder, no Powerbyte branding, ZERO console
errors/warnings; `/clinic/display` (free, 1 YouTube playlist entry seeded for the check) → video
panel renders + plays the real YouTube embed, Powerbyte branding footer present, only console
entries were a pre-existing unrelated `/favicon.ico` 404 and a benign YouTube-internal
`web-share` permissions-policy warning (from inside their own iframe) — **zero CSP violations**.
All verification fixtures cleaned up (playlist_entries + tenant_ads both 0 rows post-cleanup,
confirmed via psql; demo tenant settings byte-exact restored to pristine baseline).
NOT independently verified (flagged, not fixed): staging/prod `MINIO_PUBLIC_ENDPOINT`/
`STORAGE_PUBLIC_ENDPOINT` are placeholders (`CHANGE_ME_public_storage_origin`) — local-upload
Display playback will be broken there until an owner fills in the real public storage origin;
the full 800MB Premium upload cap and Traefik proxy body-size behavior (staging/prod only, no
proxy in dev) remain unverified; `--display-accent` contrast is heuristic-tested on 2 of 8 presets,
not computed per-preset.
NEXT: this was flagged as the FINAL piece of the Big Display — Wave 7.8 (Super Admin: tenant
directory, tier override, SystemAd CRUD) is next. Nothing owner-gated open for 7.7d.

---
## Wave 7.8 (Super Admin) — DONE + PM-VERIFIED (2026-07-09)
Commits: storage global put/delete (`putGlobalObject`/`deleteGlobalObject`), shared
`setTenantTierSchema`, `superAdminProcedure` + `assertTenantActive` (trpc.ts), staffProcedure
suspension check (queue.ts), `superAdminRouter` (routers/superAdmin.ts, TDD), suspension
integration tests, global upload Route Handler (`/api/system-ads/upload`), Super Admin UI
(layout + nav + dashboard/tenants/system-ads pages+clients).

**T1 — `superAdminProcedure` + `superAdminRouter`.** New procedure asserts `Role.SuperAdmin`,
deliberately NOT wrapped in `withTenantContext` (platform-global, no single tenant). Router:
`listTenants`/`getTenant` (counts via Prisma `_count`), `setTier`/`setStatus` (manual override),
`platformStats` (tenant-by-tier/status, total users, tickets today/all-time — every KPI pinned to
an exact field, no invented metrics), `listSystemAds`/`createSystemAd`/`setSystemAdEnabled`/
`reorderSystemAds`/`deleteSystemAd`. All resolvers use `prismaRaw` (unguarded) — no single-tenant
AsyncLocalStorage context exists for a platform-wide query.

**T2 — Suspension enforcement.** New shared helper `assertTenantActive(tenantId)` (trpc.ts),
called from `adminProcedure` (Admin Panel) and `staffProcedure` (queue.ts, Employee Station) —
both throw `FORBIDDEN "This branch is suspended."` for a suspended tenant's session-based calls,
mid-session, no re-login needed. `kioskProcedure` already enforced this for the unauth kiosk/
display path (pre-existing). Uniform coverage across all 4 tenant surfaces now confirmed by test
+ live verification.

**T3 — UI.** `/super-admin/layout.tsx` (role-guard + 3-tab nav) + `/super-admin/dashboard`
(6 KPI cards + Recharts "Tenants by Tier" bar chart, `prefers-reduced-motion` gated) +
`/super-admin/tenants` (directory table, tier-toggle + suspend/reactivate each behind an
AlertDialog confirm) + `/super-admin/system-ads` (list, enabled Switch, up/down reorder,
Add-YouTube dialog, Upload dialog via the new global upload route, delete-with-confirm).

**T4 — Integration + live verification (Playwright, real dev stack, no mocks).**
PM ground truth: typecheck 8/8; `pnpm -w test` 184/184 web (+5 db, unchanged shared/storage) —
new files `superAdmin.test.ts` (8 tests, incl. FORBIDDEN/UNAUTHORIZED matrix) +
`suspension.integration.test.ts` (4 tests); `pnpm -w build` 8/8 (no RSC/barrel regressions).
Dev container rebuilt (`start.sh dev up -d --build`), `/api/health` 200. LIVE Playwright:
logged in as `webmaster@localhost.com` (super-admin) → dashboard renders real counts (2 tenants,
15 users, 9 tickets today) → suspended `clinic` via the Tenants UI (confirm dialog) → verified via
`curl` that `display.media` for `clinic` now returns 403 FORBIDDEN "Tenant is suspended." →
reactivated → 200 OK confirmed → added a real YouTube SystemAd via the UI → confirmed via curl it
appears in `clinic`'s (Free tier) `display.media.ads[]` → deleted it. Then logged out, logged in as
`Branch Admin`/`0000` (demo tenant admin, NOT super-admin) → page nav to `/super-admin/dashboard`
redirected to `/login` (middleware) → direct `fetch('/api/trpc/superAdmin.listTenants')` from that
session → 403 FORBIDDEN (proves the tRPC guard itself denies, not just the page redirect).
Post-verification DB state confirmed pristine: `clinic` free/active, `demo` premium/active, exactly
1 SystemAd row (the original seed) — no stray rows left behind.

[HOW] decisions (docs/DECISIONS_LOG.md): Tenant.tier (not Subscription.tier) is the tier
source-of-truth for `setTier` — Subscription.tier is mirrored best-effort if a row exists, never
blocking; suspended-tenant UX is a plain `FORBIDDEN` tRPC error surfaced per-call (no dedicated
"branch suspended" screen built this wave — flagged as a fast-follow if the owner wants a friendlier
page); System Ads Manager exposes ONE discriminated-union `createSystemAd` (mirrors tenantAdRouter's
convention) rather than split youtube/upload mutations; System Ad uploads reuse the Premium 800MB
cap (not gated by any tenant's tier — Super Admin isn't a tenant).

NOT built this wave (flagged, not fixed): a dedicated "this branch is suspended" end-user page for
kiosk/station/admin (currently a raw tRPC FORBIDDEN error, caught generically by existing toast/error
handling — not verified to render a friendly message on every surface); System Ads reorder uses a
simple up/down control, not drag-and-drop; the PRODUCT.md route is `/superadmin` while the actual
(pre-existing, Wave-7.7-scaffolded) route is `/super-admin` — this wave built on the EXISTING scaffold
path per explicit task instruction, discrepancy flagged for an owner call if the PRODUCT.md path is
load-bearing anywhere external.

NEXT: nothing owner-gated open for Wave 7.8. Continue Phase 7 buildout per PRODUCT.md remaining
gaps (Xendit billing webhooks, mobile employee station, printer template editor, etc. — check
docs/IMPLEMENTATION_MAP.md for the current gap list).

## Wave 7.9 — Landing + Signup + Auth Polish (FINAL Phase-7 wave)

**T1 — Signup + password-reset backend.** `packages/shared/src/slug.ts` (slugify + reserved-slug
set + shape validation, 14 tests) + `signupSchema`/`requestPasswordResetSchema` (redefined as
`{identifier, tenantSlug}` — User has no `email` column without a migration, same schema-gap
`server/auth/config.ts` already documents; NOT the PRODUCT.md-literal `email` field)/
`consumePasswordResetSchema` in `packages/shared/src/schemas/index.ts`. New public `authRouter`
(`apps/web/src/server/trpc/routers/auth.ts`): `signup` (transactional Tenant+admin User+default
Service+Window create, server-side slug re-derivation/re-validation, reserved/taken rejection),
`checkSlugAvailability` (live UX hint, never authoritative), `requestPasswordReset`
(anti-enumeration — identical `{success:true}` for unknown tenant/user/no-contact-email-on-file;
SHA-256-hashed single-use token, 1h expiry, enqueues the existing `password_reset` email template
via `@cuelane/jobs`), `confirmPasswordReset` (validates hash/expiry/used, bcrypt-updates
`User.pin`, marks token used). Turnstile seam: `server/lib/turnstile.ts` no-ops on the dev dummy
key, real `siteverify` call wired for when the owner supplies a live key at Phase-6 (recorded in
DECISIONS_LOG). Xendit: signup always creates a FREE tenant — the upgrade-to-Premium payment path
is untouched/still a separate, later flow (unchanged from Wave 7.8).

**T2 — Public marketing landing page `/`.** Replaced the Phase-4 placeholder with a real page:
sticky header, hero (shape-accurate Big Display mockup, no stock photo/invented metric), a
4-module features grid (Kiosk/Station/Display/Dashboard — real shipped modules only), a
Free-vs-Premium comparison table sourced from the actual `TIER_LIMITS`/`MEDIA_LIMITS` constants +
PRODUCT.md tier prose (no invented price — PRODUCT.md itself leaves the number unspecified), a
closing CTA, and a footer. Added `lucide-react` as a direct `apps/web` dependency (icons, not
emoji, per the anti-slop D3 rule). `lint-design.sh --report-only`: 0 findings.

**T3 — Signup + reset UI + auth polish.** `/signup` (company/slug/adminName/adminEmail/password;
slug auto-derives from company name until edited, debounced live availability check),
`/forgot-password` (workspace+username request, prefillable via `?tenantSlug=`, identical
post-submit message regardless of match), `/reset-password` (reads `?token=`, new+confirm
password). Added a "Forgot password?" link on `/login` (tenant mode only) carrying the current
tenant slug. `resetUrlFor()` targets the top-level `/reset-password` route (matches PRODUCT.md's
top-level `/forgot-password` convention) rather than a tenant-scoped path.

**T4 — Integration + live verification (Playwright, real dev stack, no mocks).**
PM ground truth: typecheck 8/8 (`pnpm -w typecheck`); `pnpm -w test` — apps/web 200/200 (+18
auth.test.ts incl. checkSlugAvailability + 1 new `auth.e2e.integration.test.ts` full-journey test),
shared 32/32 (+14 slug.test.ts), storage 15/15, db 5/5, all unchanged suites still green; `pnpm -w
build` 8/8 (no RSC/barrel regressions; `/` and `/signup` prerender static, `/login` /
`/forgot-password` / `/reset-password` dynamic as expected). Dev container rebuilt (app + worker —
`packages/jobs`-adjacent surface touched), `/api/health` 200. LIVE Playwright end-to-end: signed up
a brand-new tenant (`verify-test-co`) at `/signup` → redirected to `/login?callbackUrl=/verify-test-co/admin`
→ logged in as the new admin with the just-created password → landed on `/verify-test-co/admin`
(correct company name in the page title) → navigated to `/forgot-password?tenantSlug=verify-test-co`
(prefilled) → submitted → confirmed via MailHog API (`:41712`) the real email arrived: To
`verify-admin@example.test`, Subject "Reset your CueLane password", body containing the correct
`http://localhost:41716/reset-password?token=…` link → opened that exact link → set a new password
→ redirected to `/login?reset=success` → logged in again with the NEW password → success. DB
verified pristine after cleanup (`DELETE FROM tenants WHERE slug='verify-test-co'`): exactly `demo`
(premium/active) + `clinic` (free/active), no stray rows.

[HOW]/stub decisions (docs/DECISIONS_LOG.md "Wave 7.9 stub seams"): Turnstile — dev/test runs
against Cloudflare's official dummy always-pass key, `verifyTurnstile()` no-ops on it; the signup
form only mounts the widget placeholder once a real `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is configured.
Xendit — untouched this wave; every new signup is Free-tier only, the paid-upgrade flow remains
Wave 7.8's existing (separate) surface. Both are OWNER-KEY-GATED — do not wire live credentials
without the owner's explicit CREDENTIALS.md rollout at Phase-6.

NOT built this wave (flagged, not fixed): no rate-limit-specific UI messaging (a 429 surfaces as
the form's generic "Something went wrong" — matches existing app-wide error handling, not a Wave
7.9 regression); the signup form does not yet collect/display a Turnstile challenge in dev (by
design — see stub decision above); no dedicated confirmation toast on `/login?reset=success` (the
query param is present but unused — a fast-follow if the owner wants an explicit "password updated"
banner on the login page).

## Phase 7 completeness — Waves 7.1 through 7.9 (Landing + Signup + Auth Polish) are ALL DONE.

Every Phase-7 wave (Kiosk, Employee Station, Admin Core CRUD, Media Manager, Dashboard, Super
Admin, Landing/Signup/Auth) has shipped, is PM-verified against a live dev stack (not just
typecheck/build), and leaves the `demo`+`clinic` seed baseline pristine. Remaining known gaps are
owner-key-gated (Xendit live billing, Turnstile live site key) or explicit fast-follow items noted
per-wave above — none block using the app end-to-end today. Phase 6 (Docker/deploy) stays gated on
the owner's CREDENTIALS.md rollout + explicit go-ahead (HARD HOLD, unchanged).

NEXT: Phase 6 deploy prep is owner-gated. Otherwise, work the fast-follow list above or return to
docs/IMPLEMENTATION_MAP.md for any remaining PRODUCT.md gap.
