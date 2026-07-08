# Changelog AI — CueLane

Chronological log of all agent-made changes. Every entry includes attribution.
Format: Rule 15 — Agent attribution required on every entry.

---

## 2026-07-08 — Phase 4 Part 7: infra + CI (Docker images, Compose stage/prod, GitHub Actions)

- Agent:               CLAUDE_CODE (swarm S7, headless worker session)
- Branch:              swarm/phase4-scaffold
- Session:             S7 — Part 7

### apps/worker/Dockerfile (new)
- Multi-stage build (deps → builder → runner); context: monorepo root
- pnpm install --frozen-lockfile in deps stage; workspace package.json stubs for correct resolution
- builder stage: root node_modules only (pnpm hoists — no per-package dirs); tsc build of all workspace deps in order then worker; inline Node script patches workspace exports from ./src/*.ts → ./dist/*.js so plain `node` resolves @cuelane/* at runtime
- runner stage: scoped COPY only (no COPY . .) — node_modules + packages/*/dist + packages/*/package.json + apps/worker/dist + apps/worker/package.json; non-root user worker:nodejs
- Code review fix: removed non-existent per-package node_modules COPY lines (pnpm hoists to root)

### apps/worker/.dockerignore (new)
- node_modules, dist, .turbo, .git, .env*, *.md, coverage

### deploy/compose/dev/docker-compose.app.yml (new)
- build: key (dev only) for web + worker; external network cuelane_dev
- Healthcheck: wget http://127.0.0.1:3000/api/health (C4 compliant)

### deploy/compose/stage/docker-compose.app.yml (new)
- Web: image bonitobonita24/cuelane:${STAGING_IMAGE_TAG:-staging-latest}; NO build: key (C5)
- Worker: image bonitobonita24/cuelane-worker:${STAGING_IMAGE_TAG:-staging-latest} (separate image)
- Traefik: Host(cuelane-staging.powerbyte.app), certresolver=letsencrypt (lowercase, C2), tls=true (C3)
- Resource limits: app mem_limit=640m/192m/cpus=1.0; worker mem_limit=512m/128m/cpus=1.0 (top-level, not deploy:)
- Code review fix: worker now references cuelane-worker image (separate from web)

### deploy/compose/prod/docker-compose.app.yml (new)
- Web: image bonitobonita24/cuelane:${APP_IMAGE_TAG:-latest}
- Worker: image bonitobonita24/cuelane-worker:${APP_IMAGE_TAG:-latest}
- Host(cuelane.powerbyte.app); same certresolver/tls/resource-limit pattern as staging

### deploy/compose/dev/docker-compose.infra.yml (updated)
- Code review fix: pgbouncer healthcheck `nc -z localhost 5432` → `nc -z 127.0.0.1 5432` (C4)
- Code review fix: pgAdmin healthcheck `http://localhost:80` → `http://127.0.0.1:80` (C4)

### .env.staging.example + .env.prod.example (new)
- All required vars: DATABASE_URL, DIRECT_URL, REDIS_URL, AUTH_SECRET, SMTP_*, XENDIT_*, TURNSTILE_*, STAGING_IMAGE_TAG/APP_IMAGE_TAG, TRAEFIK_NETWORK=proxy

### deploy/compose/start.sh (new, +x)
- Dispatches dev|stage|prod; sets COMPOSE_PROJECT_NAME per env (C7); dev runs infra+app compose; stage/prod app-only

### deploy/compose/push.sh (new, +x)
- docker login guard (C6); dev builds web (apps/web/Dockerfile) AND worker (apps/worker/Dockerfile) with buildx multi-arch; staging/prod re-tags both web + worker images atomically
- Code review fix: builds both images (previously web only); WORKER_IMAGE=bonitobonita24/cuelane-worker

### deploy/komodo-deploy.sh (new, +x)
- Vendored from Server-Setups/Powerbyte-Hostinger/komodo/ci-deploy/komodo-deploy.sh

### tools/validate-inputs.mjs (new)
- Validates inputs.yml against schema; checks required fields + port uniqueness

### tools/check-env.mjs (new)
- Checks required env vars are set in .env files

### tools/check-product-sync.mjs (new)
- Rule 20 private tag leak check (GOVERNANCE_DOCS); PRODUCT.md ↔ inputs.yml alignment
- Code review fix: dropped /g flag from PRIVATE_TAG_RE (stateful lastIndex unnecessary)

### tools/hydration-lint.mjs (new)
- Scans .tsx/.ts for SSR hydration mismatch patterns

### COMMANDS.md (new)
- Master operational reference: Docker start/stop/rebuild/push, DB, test, lint, governance, git, services URLs, credentials

### deploy/k8s-scaffold/README.md (new)
- Placeholder; K8s inactive by default (Rule 6); describes what Phase 7 would scaffold

### .github/workflows/ci.yml (new)
- pnpm/action-setup@v4 + setup-node@v4; pnpm install --frozen-lockfile; lint, typecheck, build; triggers on push+PR to all branches

### .github/workflows/docker-publish.yml (new)
- Push to main: builds BOTH web (apps/web/Dockerfile → bonitobonita24/cuelane) AND worker (apps/worker/Dockerfile → bonitobonita24/cuelane-worker) with buildx linux/amd64+arm64; tags sha-{7char} + staging-latest
- Code review fix: added worker image build step (previously web only — worker CMD would crash); SHA via ${GITHUB_SHA:0:7}
- Calls deploy/komodo-deploy.sh to pin CUELANE_STAGING_TAG + DeployStack

### package.json (updated)
- Added tools:* scripts; yaml ^2 devDependency (lockfile updated)

### .gitignore (updated)
- Added !.env.staging.example + !.env.prod.example exceptions

### Code review gate (S7)
- 5 confirmed findings fixed: (1) CI only built web image — worker CMD would crash on every staging deploy → added worker image build in CI; (2) per-package node_modules COPY → removed (pnpm hoists); (3) pgbouncer/pgAdmin localhost in healthchecks → 127.0.0.1 (C4); (4) PRIVATE_TAG_RE /g flag with stateful lastIndex → dropped /g; (5) ${github.sha | cut} → ${GITHUB_SHA:0:7}
- lint-deploy.sh gate: all C1-C8 PASS (3 expected C1 WARNs: unset env vars at lint-time)

---

## 2026-07-08 — Phase 4 Part 6: apps/worker (BullMQ worker boot — email/reports/webhooks)

- Agent:               CLAUDE_CODE (swarm S6, headless worker session)
- Branch:              swarm/phase4-scaffold
- Session:             S6 — Part 6

### apps/worker (@cuelane/worker)
- Added `package.json` — @cuelane/worker; runtime deps: bullmq, nodemailer, zod, @cuelane/jobs, @cuelane/db, @cuelane/shared, @cuelane/storage; devDeps: @types/nodemailer, tsx, typescript
- Added `tsconfig.json` — extends tsconfig.base.json (strict + Bundler moduleResolution + exactOptionalPropertyTypes)
- Added `src/env.ts` — Zod-validated startup env: VALKEY_URL (dev default: redis://localhost:41708), DATABASE_URL, SMTP_HOST/PORT/SECURE/USER/PASS/FROM/FROM_NAME, MINIO_ENDPOINT/PORT/USE_SSL/ACCESS_KEY/SECRET_KEY/BUCKET; process.exit(1) on validation failure
- Added `src/index.ts` — BullMQ Worker per queue (email concurrency=5, reports=2, webhooks=10); getConnectionOptions() from @cuelane/jobs; completed/failed event listeners; graceful shutdown on SIGTERM/SIGINT with double-shutdown guard and error-tolerant Promise.all
- Added `src/processors/email.processor.ts` — nodemailer SMTP transporter; renderTemplate() switch (email_verification, password_reset, subscription_confirmation, subscription_cancellation, subscription_renewal_reminder, default); escapeHtml() helper prevents HTML injection in all interpolated fields; SMTP_SECURE env-driven (fixes port-465 TLS); removed unnecessary withTenant DB coupling (email sends are pure SMTP, no DB query)
- Added `src/processors/reports.processor.ts` — skeleton withTenant(tenantId) scoped; console.log stub; TODO Phase 8
- Added `src/processors/webhooks.processor.ts` — skeleton withTenant(tenantId) scoped; TODO Phase 8 Xendit signature validation

### Code review gate (S6)
- 3 findings confirmed and fixed: (1) HTML injection via unescaped template data → fixed with escapeHtml(); (2) `secure: false` hardcoded regardless of SMTP port → fixed via SMTP_SECURE env var; (3) `withTenant` DB transaction wrapping pure SMTP send — DB outage blocks email delivery → removed withTenant from email processor
- 1 finding fixed proactively: double-shutdown on concurrent SIGTERM+SIGINT → shutdown guard flag added
- typecheck: 0 errors; build: 0 errors

---

## 2026-07-08 — Phase 4 Part 3: packages/db (Prisma schema + L6 tenant-guard + RLS + audit helper + seed)

- Agent:               CLAUDE_CODE (swarm S4, headless worker session)
- Branch:              swarm/phase4-scaffold
- Session:             S4 — Part 3

### packages/db (@cuelane/db)
- Added `prisma/schema.prisma` — all 13 entities: Tenant (+ slug @unique for URL routing), Service, Window (3 named back-relations: WindowTickets/TransferredFromWindow/ReturnToWindow), User, UserService (explicit join table with tenantId for L6 coverage), Ticket (all transfer fields), PlaylistEntry, SystemAd (global, no tenantId), TenantAd, Subscription (@unique tenantId), PasswordResetToken, AuditLog (tenantId nullable, onDelete:SetNull per phases.md spec). 7 enums: TenantTier, TenantStatus, VideoMode, UserRole, TicketStatus, PaymentStatus, MediaType, AdType. All tables @@map("snake_case").
- Added `src/client.ts` — PrismaClient singleton (globalThis guard for hot-reload); exports prismaRaw (unextended) + prisma (L6 extended)
- Added `src/middleware/tenant-guard.ts` — L6 $allOperations guard via AsyncLocalStorage: unconditional WHERE injection (covers findMany/findFirst/findUnique/update/updateMany/delete/deleteMany/count/aggregate/groupBy); upsert create+update branch; createMany array map; GLOBAL_MODELS bypass set (AuditLog/Tenant/SystemAd/Subscription)
- Added `src/rls.ts` — L2 withTenant() helper: opens prismaRaw.$transaction + SET app.current_tenant_id for PG RLS
- Added `src/audit.ts` — L5 writeAuditLog(): runs inside caller's transaction; exactOptionalPropertyTypes-safe conditional spread for nullable JSON fields
- Added `src/repositories/` — tenant.ts (prismaRaw, super-admin unguarded), service.ts, ticket.ts, user.ts (all prisma, L6-guarded), plus index.ts barrel
- Added `prisma/migrations/20260708000000_init/migration.sql` — CREATE TYPE for all enums + CREATE TABLE for all 13 models + FK constraints
- Added `prisma/migrations/20260708000001_rls_tenant_isolation/migration.sql` — ENABLE ROW LEVEL SECURITY + tenant_isolation POLICY on 9 tables; excluded: tenants / system_ads / audit_logs
- Added `prisma/seed.ts` — demo tenant (slug: 'demo', premium), Subscription, 4 Services, 3 Windows, 3 Users (admin/Alice/Bob with dev SHA-256 PIN hashes), UserService assignments, 3 Tickets (waiting/serving/completed), 1 SystemAd placeholder. Super admin NOT seeded (handled by Auth.js v5 + Server-Setups SOPS).

### Code review fixes (3 critical in-scope guard bypass bugs resolved)
- Fixed: WHERE injection conditional `if ('where' in args)` missed findMany({}) with no where key → unconditional `args.where = { ...args.where, tenantId }` (data exfiltration bypass)
- Fixed: upsert args use create/update keys not data — guard never injected → added explicit upsert branch (write bypass)
- Fixed: createMany with Array.isArray(args.data) blocked injection for bulk inserts → added createMany branch mapping tenantId into each element (multi-row write bypass)

### Hook 3 — Rule 15 attribution: CLAUDE_CODE
### Hook 18 — Part 3 privacy scan: N/A (no auth/RBAC written; data-layer only); security=none (no gov/LGU flag)

---

## 2026-07-08 — Phase 4 Part 4: packages/ui + packages/jobs + packages/storage

- Agent:               CLAUDE_CODE (swarm S3, worktree-isolated parallel agents)
- Branch:              swarm/phase4-scaffold
- Session:             S3 — Part 4

### packages/ui (@cuelane/ui)
- Added `tailwind.config.ts` — Tailwind v3, CSS-var colour system; fonts: DM Sans/Outfit/Space Mono; tailwindcss-animate plugin
- Added `postcss.config.mjs` — tailwindcss + autoprefixer
- Added `components.json` — shadcn New York style, cssVariables:true
- Added `src/styles/globals.css` — full :root + .dark shadcn CSS variable blocks from HashiCorp DESIGN.md token mapping; 8 [data-theme] accent presets (default/terraform/vault/waypoint/vagrant/purple/bright/amber-gold); .cl-label utility
- Added `src/lib/utils.ts` — cn() via clsx + tailwind-merge
- Added 9 shadcn/ui New York style components: Button, Card, Input, Label, Select, Dialog, Badge, Table, Sonner
- Added `src/index.ts` — barrel export

### packages/jobs (@cuelane/jobs)
- Added typed BullMQ queue definitions for 3 queues (email/reports/webhooks): Queue + DLQ pair each; 3 attempts/exponential backoff/removeOnFail:false per inputs.yml
- Added `src/connection.ts` — getConnectionOptions() parses VALKEY_URL (dev: redis://localhost:41708); TLS/password-aware; maxRetriesPerRequest:null (BullMQ required)
- Added `src/types.ts` — BaseTenantPayload (tenantId+userId), per-queue payload interfaces, DlqPayload<T>
- Added addEmailJob/addReportsJob/addWebhookJob typed helpers

### packages/storage (@cuelane/storage)
- Added typed MinIO/S3 wrapper using @aws-sdk/client-s3
- Added path-traversal guard: validatePathSegment() — SEGMENT_RE /^[a-z0-9][a-z0-9_-]{0,63}$/ on tenantId+entityType
- Added MIME extension from MIME_TO_EXT map (not originalFilename — eliminates .jpg.php bypass)
- Added body.byteLength size validation (not caller-supplied sizeBytes — eliminates size bypass)
- Added assertTenantKey() — cross-tenant read/delete/sign guard
- Added requireEnv() — production fails-fast if storage env vars missing
- putObject/getObject(tenantId)/deleteObject(tenantId)/getSignedDownloadUrl

### Code review fixes (in-scope blocking findings resolved)
- Fixed: `.js` imports in packages/storage/src/ violated CLAUDE.md Rule 12 → removed .js extensions
- Fixed: validateUpload() used caller-supplied sizeBytes instead of body.byteLength → now validates actual body
- Deferred: DLQ queue objects defined but worker failure-event wiring missing → bucket-A question raised

---

## 2026-06-30 — Framework sync V31.3 → V32.18 (governance layer only)

- Agent:               CLAUDE_CODE
- Why:                 Governance-only framework upgrade from V31.3 to V32.18. Migrated versioned _v31 filenames to unversioned canonical names (Master_Prompt.md, CLAUDE_compact.md, etc.); removed 6 _v31 orphan files from .ai_prompt/; deployed 26 framework deliverables including new layers: V32.7 on-demand loading, V32.8 design-as-contract (LESSONS_REGISTRY.md, design-stop-hook.sh), V32.9 compliance (privacy.md), V32.12 design-principles.md, V32.14 motion.md, V32.17 lint-design.sh, V32.18 App-Hardening Harvest (AI/LLM/MCP + API-authz + injection security layer, Security_Checklist 98→114 items). No app source code touched.
- Files removed:
  - `.ai_prompt/AI_Tools_Skills_MCPs_Reference_v31.md` — replaced by `.ai_prompt/AI_Tools_Reference.md`
  - `.ai_prompt/CLAUDE_v31_compact.md` — replaced by `.ai_prompt/CLAUDE_compact.md` + `CLAUDE.md`
  - `.ai_prompt/ChatGPT_V31_Cross_Audit_Prompt.md` — replaced by `.ai_prompt/ChatGPT_Cross_Audit.md`
  - `.ai_prompt/Framework_Feature_Index_v31.md` — replaced by `.ai_prompt/Framework_Feature_Index.md`
  - `.ai_prompt/Master_Prompt_v31.md` — replaced by `AI/Master_Prompt.md`
  - `.ai_prompt/Post_Generation_Security_Checklist_v31.md` — replaced by `.ai_prompt/Security_Checklist.md`
  - `.ai_prompt/Product_md_Planning_Assistant_v31.md` — replaced by `.ai_prompt/Planning_Assistant.md`
- Files added (new deliverables):
  - `AI/Master_Prompt.md` — unversioned canonical, V32.18
  - `.claude/agents/spec-executor.md` — Sonnet executor subagent (V32.7.2)
  - `scripts/lint-deploy.sh` — pre-deploy footgun gate (V32.7.5)
  - `scripts/design-stop-hook.sh` — Stop hook (V32.8)
  - `scripts/lint-design.sh` — design anti-slop gate (V32.17)
  - `.ai_prompt/privacy.md` — PH Data Privacy + WCAG 2.2 AA gate (V32.9)
  - `.ai_prompt/design-principles.md` — design-principles reference (V32.12)
  - `.ai_prompt/motion.md` — motion-principles reference (V32.14)
  - `.ai_prompt/LESSONS_REGISTRY.md` — append-only learning registry (V32.8)
- Files overwritten (framework governance):
  - `CLAUDE.md` — compact rules card, now V32.18
  - `.claude/settings.json` — framework keys injected, existing keys preserved

---

## 2026-05-17 — Email provider swap: Resend → SMTP

- Agent:               CLAUDE_CODE
- Why:                 Human decided to switch from Resend API to standard SMTP relay (generic provider, same account staging + prod). Decision captured in DECISIONS_LOG.md entry "2026-05-17 — Email provider: SMTP (was Resend)".
- Files added:
  - `upgrade-credentials-smtp.sh` — local script (Scenario 34 pattern) to swap `## 📧 Resend API Key` section in CREDENTIALS.md for V31 `## 📧 SMTP` section. Atomic backup + section replace. Runs in human terminal — credential values never enter AI context.
- Files modified:
  - `inputs.yml` — `tech_stack.email: resend → smtp`; `email.provider: resend → smtp`; added `email.relay_type: generic` + `email.same_account_for_staging_prod: true`
  - `.env.dev` — removed `# RESEND (email provider — dev uses MailHog, not Resend)` comment + `RESEND_API_KEY` line (MailHog SMTP unchanged)
  - `.env.staging` — removed `RESEND_API_KEY` line (SMTP_HOST/USER/PASSWORD/FROM/FROM_NAME remain ⏳)
  - `.env.prod` — removed `RESEND_API_KEY` line (SMTP_HOST/USER/PASSWORD/FROM/FROM_NAME remain ⏳)
  - `.env.example` — removed Resend placeholder block (`# For staging/prod (Resend):` + `# RESEND_API_KEY=...`)
  - `docs/DECISIONS_LOG.md` — appended locked decision entry
  - `docs/IMPLEMENTATION_MAP.md` — updated CREDENTIALS.md note: `Resend/SMTP` → `SMTP`
  - `docs/CHANGELOG_AI.md` — this entry
- Files deleted:       none
- Schema/migrations:   none (Phase 4 has not started — no Prisma models or application code to migrate)
- Errors encountered:  none
- Errors resolved:     none
- Pending human action:
  1. Edit `docs/PRODUCT.md` lines 16, 190, 205 to replace Resend wording with SMTP (per H4 — PRODUCT.md is human-owned; agent provided exact diffs)
  2. Run `bash upgrade-credentials-smtp.sh` in terminal to swap the CREDENTIALS.md section structure
  3. Fill the 6 SMTP fields in CREDENTIALS.md (Host, Port, Username, Password, From address, From name) before Phase 5

---

## 2026-05-03 — Phase 3 continuation: STATE.md + handoff + pause governance

- Agent:               CLAUDE_CODE
- Why:                 Continuation session after context window boundary. STATE.md was still showing Phase 0 (Bootstrap complete) — the prior session ran out of context before writing the final STATE.md update. This session completed that update and executed the human-requested pause governance sequence.
- Files added:
  - `.cline/handoffs/2026-05-03-phase3-complete-pause.md` — Phase 3 complete handoff note with output contract verification, pending ⏳ items, resume instructions, and locked decisions summary
- Files modified:
  - `.cline/STATE.md` — updated from "Phase 0 — Bootstrap complete" to "Phase 3 complete" with all port assignments, blockers, and NEXT pointer
  - `docs/CHANGELOG_AI.md` — this entry
  - `docs/IMPLEMENTATION_MAP.md` — updated Governance section to reflect Phase 3 state
  - `.cline/memory/lessons.md` — added 🟡 fix entry for Edit-before-read pattern
- Files deleted:       none
- Schema/migrations:   none
- Errors encountered:  (1) Edit tool rejected on STATE.md — "File has not been read yet in this session." Same pattern as prior session's CHANGELOG_AI.md error. Fix: Read before Edit. (2) Vercel plugin hook fired again on pause request (matched "pause"/"resume" keywords). Hook suggested Skill(workflow). Correctly identified as irrelevant — Vercel Workflow is a compute product, not a governance pause. Skipped per H1 priority order (plugin skills priority 7 < phase execution rules priority 3).
- Errors resolved:     Both resolved. Edit-before-read pattern logged to lessons.md.

---

## 2026-05-03 — Phase 3: Generate Spec Files

- Agent:               CLAUDE_CODE
- Why:                 Phase 3 triggered by human ("Start Phase 3"). Generates all spec files from PRODUCT.md and Phase 2 interview answers. Locks tech stack, ports, credentials, and governance decisions before Phase 4 scaffold begins.
- Files added:
  - `inputs.yml` — complete app spec (v3): app, apps, packages, tech_stack, tenancy, auth, payment, storage, jobs, realtime, email, turnstile, subscription_tiers, environments, domains, cors, docker, git, models, vibe_test, context7, accessibility, security, ports.dev
  - `inputs.schema.json` — strict JSON Schema draft-07 for inputs.yml validation
  - `.env.dev` — development environment with non-standard ports (base 41706), all AI-generated credentials filled
  - `.env.staging` — staging environment with standard ports, Traefik config, APP_IMAGE_TAG=staging-latest
  - `.env.prod` — production environment with standard ports, Traefik config, APP_IMAGE_TAG=latest
  - `.env.example` — safe committed template (all placeholders, no real values)
  - `CREDENTIALS.md` — Phase 3 authoritative master credentials (AI-generated secrets filled; human-provided sections marked ⏳)
  - `scripts/sync-credentials-to-env.sh` — propagates CREDENTIALS.md human-filled values to env files
- Files modified:
  - `docs/DECISIONS_LOG.md` — added 9 locked decision entries: port strategy, git branching, model routing, docker publishing, Xendit payment, vibe_test, tenancy mode, auth strategy, Turnstile config
- Files deleted:       none
- Schema/migrations:   none (Phase 3 pre-code — no Prisma schema yet)
- Errors encountered:  Vercel plugin hook fired on .env.example write — correctly identified as irrelevant (CueLane deploys via Komodo+Docker, not Vercel; plugin skills at priority 7 do not override Phase 3 at priority 3). Skipped without action.
- Errors resolved:     none

---

## Phase 4 Part 1 — Monorepo Root Config + Dev Infra Compose
- Date:                2026-07-08
- Agent:               CLAUDE_CODE (swarm worker S1, run-8)
- Attribution:         CLAUDE_CODE
- Why:                 Phase 4 Part 1 scaffold. Establishes monorepo workspace, toolchain config, and dev infrastructure stack before any app code is written.
- Files added:
  - `pnpm-workspace.yaml` — workspace globs (apps/*, packages/*)
  - `turbo.json` — Turborepo v2 tasks: build (outputs .next/** dist/**), lint, typecheck, test, dev
  - `tsconfig.base.json` — strict TypeScript base: strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes + Bundler moduleResolution + ESNext module + ES2022 target
  - `.editorconfig` — editor consistency (utf-8, lf, 2-space, final newline)
  - `.prettierrc` — Prettier config (singleQuote, semi, tabWidth:2, trailingComma:es5)
  - `eslint.config.mjs` — ESLint v9 flat config with typescript-eslint recommendedTypeChecked; no-explicit-any/no-unsafe-assignment/strict-boolean-expressions as errors
  - `deploy/compose/dev/docker-compose.infra.yml` — dev infra stack: Postgres:41706, PgBouncer:41707(transaction mode), Valkey:41708, MinIO:41709/41710, MailHog:41711/41712, pgAdmin:41713; healthchecks; named volumes; cuelane_dev network
- Files modified:
  - `package.json` — updated to @cuelane/root with turbo/typescript/eslint/prettier devDeps and all turbo scripts + db:* passthroughs
  - `.gitignore` — appended coverage/ and patches/
  - `.env.example` — added DIRECT_URL (Prisma migrations via postgres:41706), renamed PGBOUNCER_DATABASE_URL to DATABASE_URL (runtime via pgbouncer:41707 with ?pgbouncer=true), added STORAGE_PORT
- Files deleted:       none
- Schema/migrations:   none (root config only)
- Errors encountered:  none
- Errors resolved:     none

---

## 2026-07-08 — Phase 4 Part 2: packages/shared + packages/api-client

- Agent:               CLAUDE_CODE (swarm S2, run-9)
- Branch:              swarm/phase4-scaffold
- Files added:
  - `packages/shared/package.json` — name @cuelane/shared; exports ./src/index.ts; dep zod ^3.25
  - `packages/shared/tsconfig.json` — extends ../../tsconfig.base.json; composite; outDir dist
  - `packages/shared/src/types/index.ts` — TS enums (Role, TenantTier, TenantStatus, VideoMode, TicketStatus, PaymentStatus, MediaType, AdType) + interfaces for all 11 entities (Tenant, Service, Window, User, Ticket, PlaylistEntry, TenantAd, SystemAd, Subscription, PasswordResetToken) + SessionMapEntry (Valkey in-memory type only)
  - `packages/shared/src/schemas/index.ts` — Zod create/update schemas for all entities; discriminated unions for PlaylistEntry and Ad types; cross-field superRefine on transferTicketSchema; bounded reorder arrays (.max(500/.max(100)); inferred input types
  - `packages/shared/src/index.ts` — barrel: export * from types + schemas
  - `packages/api-client/package.json` — name @cuelane/api-client; deps @trpc/client+server+react-query ^11 + @tanstack/react-query ^5; peerDep react >=18.2.0; no superjson dep (transformer lives on server per tRPC v11)
  - `packages/api-client/tsconfig.json` — extends base; composite; jsx react-jsx
  - `packages/api-client/src/index.ts` — createClient() (vanilla tRPC v11 httpBatchLink); createTRPCReact<AppRouter>() export; AppRouter=any TODO(S5) placeholder; no transformer on client (tRPC v11)
- Files modified:
  - `pnpm-lock.yaml` — added zod, @trpc/*, @tanstack/react-query, superjson, react snapshots
- Schema/migrations:   none (types/schemas layer only)
- Errors encountered:  ZodNativeEnum.exclude() does not exist (fixed: z.enum literal); tRPC v11 removed client-side transformer (fixed: dropped superjson from httpBatchLink); ESLint strict-boolean-expressions on optional string (fixed: explicit === undefined); unused PaymentStatus import in schemas (removed)
- Errors resolved:     All — lint/typecheck/build green
- Code review:         4 confirmed findings fixed in-scope: (1) transferTicketSchema missing cross-field guard for returnAfterDone=true+no returnToWindowId; (2) updatePlaylistEntrySchema allowed isLive on Local entries; (3) reorder schemas unbounded arrays; (4) orphaned superjson dep + missing react peer dep. 2 deferred findings raised as bucket-A questions for conductor.

---

---

## Phase 4 Part 5 — apps/web: Next.js 15 App Router + tRPC v11 + Auth.js v5 + Security

- Date:                2026-07-08
- Agent:               CLAUDE_CODE (swarm S5, run-12)
- Branch:              swarm/phase4-scaffold
- Files added:
  - `apps/web/package.json` — @cuelane/web; next@^15.1.0, react@^19, @trpc/server+client+react-query@^11, @tanstack/react-query@^5, superjson@^2, next-auth@^5.0.0-beta.28, @auth/prisma-adapter@^2, zod@^3, lru-cache@^11, isomorphic-dompurify@^2, bcryptjs@^2; all @cuelane/* workspace:*
  - `apps/web/tsconfig.json` — extends ../../tsconfig.base.json; dom+ES2022 libs; paths @/*; Next.js plugin; allowJs+noEmit (Next.js auto-set)
  - `apps/web/next.config.ts` — output:standalone; security headers (X-Frame-Options, HSTS, CSP, Permissions-Policy, Referrer-Policy, X-Content-Type-Options, X-XSS-Protection); transpilePackages all @cuelane/*; serverExternalPackages @prisma/client; webpack extensionAlias (.js→.ts) for ESM workspace packages
  - `apps/web/tailwind.config.ts` — content: src/**+packages/ui/src/**; require() for tailwindcss-animate (no @types)
  - `apps/web/src/env.ts` — Zod-validated env schema (DATABASE_URL, AUTH_SECRET, NEXTAUTH_URL, SUPER_ADMIN_EMAIL/PASSWORD_HASH, TURNSTILE_SECRET_KEY, MINIO_*, VALKEY_URL, NEXT_PUBLIC_*); SKIP_ENV_VALIDATION bypass for Docker build; NEXT_PHASE guard
  - `apps/web/src/server/lib/rate-limit.ts` — LRUCache-backed per-IP rate limiter; rateLimiters: {public:30, auth:10, pinAuth:10, api:120, upload:20, passwordReset:5}
  - `apps/web/src/server/lib/sanitize.ts` — isomorphic-dompurify; ALLOWED_TAGS/ATTR; afterSanitizeAttributes hook: rel=noopener noreferrer on target=_blank (tabnapping guard); sanitizePlainText() strips all HTML
  - `apps/web/src/types/next-auth.d.ts` — module augmentation: Session.user+JWT gain tenantId:string|null, roles:Role[]
  - `apps/web/src/server/auth/config.ts` — NextAuthConfig; Credentials provider admin-credentials (name lookup scoped by tenantSlug→tenant.id → prevents cross-tenant auth; bcrypt compare on pin; roleMap); super-admin-credentials (env SUPER_ADMIN_EMAIL+PASSWORD_HASH); JWT/session callbacks (block-disable any casts for Auth.js v5 type limitations); jwt uses trigger=signIn guard; cookies: httpOnly, sameSite:lax, secure:prod
  - `apps/web/src/server/auth/index.ts` — re-exports NextAuth(authConfig) → auth, handlers, signIn, signOut
  - `apps/web/src/server/trpc/context.ts` — createTRPCContext: auth() no-arg call → Session|null; ctx: {session, userId, roles, tenantId, req}
  - `apps/web/src/server/trpc/trpc.ts` — initTRPC+superjson; extractClientIp (x-real-ip primary → last x-forwarded-for entry → unknown; SECURITY: first XFF entry not used — attacker-controlled); publicProcedure (rate limit); protectedProcedure (session==null || userId==null || userId==='' → UNAUTHORIZED; empty-string guard catches stale JWTs)
  - `apps/web/src/server/trpc/middleware/rbac.ts` — requireRole(...allowedRoles): middleware checks ctx.roles, throws FORBIDDEN if missing
  - `apps/web/src/server/trpc/middleware/tenant.ts` — requireTenant: super-admin bypass (Role.SuperAdmin); throws UNAUTHORIZED if tenantId==null for non-super-admin
  - `apps/web/src/server/trpc/root.ts` — appRouter: {health, tenant}; exports AppRouter type
  - `apps/web/src/server/trpc/routers/health.ts` — health.ping: 'pong' + timestamp
  - `apps/web/src/server/trpc/routers/tenant.ts` — tenant.getCurrent (requireTenant, Prisma findUnique); tenant.listAll (requireRole(SuperAdmin), paginated cursor, conditional spread for exactOptionalPropertyTypes)
  - `apps/web/src/lib/trpc.ts` — createTRPCReact<AppRouter> (typed); createClient (httpBatchLink+superjson)
  - `apps/web/src/middleware.ts` — Auth.js v5 auth() callback middleware; isInternalPath: fixed to STATIC_EXT_RE (trailing extension regex) instead of pathname.includes('.') which bypassed super-admin auth; super-admin role check; tenant-slug extraction; matchesSegment guard (exact-segment prefix to avoid '/stationery' false-positive); protected/public path routing
  - `apps/web/src/app/layout.tsx` — root layout + Geist fonts + globals.css
  - `apps/web/src/app/page.tsx` — home placeholder
  - `apps/web/src/app/[tenant]/layout.tsx` — tenant shell layout
  - `apps/web/src/app/[tenant]/kiosk/page.tsx` — kiosk surface placeholder
  - `apps/web/src/app/[tenant]/display/page.tsx` — display surface placeholder
  - `apps/web/src/app/[tenant]/station/page.tsx` — employee station placeholder
  - `apps/web/src/app/[tenant]/admin/page.tsx` — admin panel placeholder
  - `apps/web/src/app/super-admin/dashboard/page.tsx` — super-admin dashboard placeholder (static path, not under [tenant])
  - `apps/web/src/app/api/auth/[...nextauth]/route.ts` — Auth.js v5 handlers
  - `apps/web/src/app/api/trpc/[trpc]/route.ts` — fetchRequestHandler; two code paths for exactOptionalPropertyTypes (dev: with onError, prod: without)
  - `apps/web/Dockerfile` — 3-stage (deps→builder→runner); standalone output; SKIP_ENV_VALIDATION=true in builder; non-root user
  - `apps/web/.dockerignore`
  - `apps/web/components.json` — shadcn/ui config
  - `apps/web/postcss.config.mjs`
  - `apps/web/next-env.d.ts`
- Files modified:
  - `packages/api-client/src/index.ts` — updated TODO comment: AppRouter=any intentional (circular-dep prevention); direct apps/web to @/lib/trpc for typed client
  - `pnpm-lock.yaml` — new deps for apps/web
- Schema/migrations:   none
- Errors encountered:  packages/shared ESM .js imports unresolvable → webpack extensionAlias; Auth.js v5 JWT base Record<string,unknown> type conflict → block eslint-disable + trigger=signIn guard; exactOptionalPropertyTypes throughout (onError, cursor, httpBatchLink transformer) → conditional spreads + two code paths; @typescript-eslint/strict-boolean-expressions for all nullable string checks → explicit ==null; @typescript-eslint/require-await on non-async callbacks → removed async; rbac/tenant had duplicate initTRPC → export middleware from trpc.ts; tailwindcss-animate no @types → require()
- Errors resolved:     All — lint/typecheck/build/ESLint green
- Code review:         6 confirmed findings fixed: (1) pathname.includes('.') bypassed super-admin auth for dot-paths → STATIC_EXT_RE trailing extension; (2) admin findFirst no tenantId scope → added tenantSlug credential + tenant.id lookup; (3) X-Forwarded-For spoofable rate-limit key → x-real-ip primary + last-XFF entry; (4) String(tok.userId??'') empty string passes null guard → added ==='' check; (5) startsWith('/station') too broad → matchesSegment exact-segment; (6) tabnapping no rel=noopener noreferrer → DOMPurify afterSanitizeAttributes hook
- Schema gaps (TODO):  User has `pin` (not `email`) → admin auth uses `name` as identifier + bcrypt against `pin`; tracked in lessons.md. UserRole has no super_admin value → super-admin is env-only, not DB-stored.
