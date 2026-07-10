# Implementation Map — CueLane

Current build state. Rewritten after every feature update to reflect what exists.

---

## Root Config
✅ Phase 4 Part 1 complete (swarm/phase4-scaffold, 2026-07-08)
- `pnpm-workspace.yaml` — workspace globs: apps/*, packages/*
- `turbo.json` — tasks: build (^build), lint (^lint), typecheck (^typecheck), test (^test), dev (cache:false)
- `package.json` — name @cuelane/root, turbo/typescript/eslint/prettier devDeps, db:* passthroughs
- `tsconfig.base.json` — strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes + Bundler moduleResolution + ES2022
- `.editorconfig` — utf-8, lf, 2-space indent, final newline
- `.prettierrc` — singleQuote, semi, tabWidth:2, trailingComma:es5
- `eslint.config.mjs` — ESLint v9 flat config; typescript-eslint recommendedTypeChecked; no-explicit-any/no-unsafe-assignment/strict-boolean-expressions as errors
- `.gitignore` — updated: added coverage/, patches/
- `.nvmrc` — 22 (pre-existing)
- `deploy/compose/dev/docker-compose.infra.yml` — Postgres:41706, PgBouncer:41707, Valkey:41708, MinIO:41709/41710, MailHog:41711/41712, pgAdmin:41713; healthchecks on all services; named volumes; cuelane_dev network
- `.env.example` — added DIRECT_URL (postgres direct, migrations) + DATABASE_URL (pgbouncer pooled, runtime) + STORAGE_PORT

## Packages

### @cuelane/shared ✅ Phase 4 Part 2 complete (swarm/phase4-scaffold, 2026-07-08)
- `src/types/index.ts` — enums: Role (employee|admin|super_admin), TenantTier, TenantStatus, VideoMode, TicketStatus, PaymentStatus, MediaType, AdType. Interfaces: Tenant, Service, Window, User, Ticket, PlaylistEntry, TenantAd, SystemAd, Subscription, PasswordResetToken. Plus: SessionMapEntry (Valkey in-memory, NOT a DB entity)
- `src/schemas/index.ts` — Zod create/update/action schemas for all entities; discriminated unions for playlist/ad types; cross-field validation on transfer (returnAfterDone requires returnToWindowId); bounded reorder arrays; inferred z.infer<> types exported
- `src/index.ts` — barrel export

### @cuelane/api-client ✅ Phase 4 Part 2 complete (swarm/phase4-scaffold, 2026-07-08)
- `src/index.ts` — createClient() vanilla tRPC v11 client; trpc = createTRPCReact<AppRouter>(); AppRouter=any by deliberate design (avoids a package→app circular dependency; the web app's own `@/lib/trpc` carries the real typed AppRouter — see source comment); peerDep react >=18.2.0; no transformer on client (tRPC v11 — lives on server initTRPC)

### @cuelane/db ✅ Phase 4 Part 3 complete (swarm/phase4-scaffold, 2026-07-08)
- `prisma/schema.prisma` — 13 models (Tenant+slug, Service, Window×3 back-relations, User, UserService explicit join table, Ticket, PlaylistEntry, SystemAd, TenantAd, Subscription, PasswordResetToken, AuditLog); 7 enums; all tables @@map("snake_case")
- `src/client.ts` — PrismaClient singleton with globalThis hot-reload guard; exports prismaRaw (unguarded) + prisma (L6 extended)
- `src/middleware/tenant-guard.ts` — L6 $allOperations via AsyncLocalStorage: unconditional WHERE injection, upsert create/update branch, createMany array map, GLOBAL_MODELS bypass (AuditLog/Tenant/SystemAd/Subscription)
- `src/rls.ts` — L2 withTenant(): prismaRaw.$transaction + SET app.current_tenant_id for PG RLS
- `src/audit.ts` — L5 writeAuditLog(): transaction-scoped; exactOptionalPropertyTypes-safe conditional JSON spread
- `src/repositories/` — tenant.ts (unguarded, super-admin), service.ts + ticket.ts + user.ts (L6-guarded)
- `prisma/migrations/20260708000000_init/` — full schema DDL (enums + 13 tables + FK constraints)
- `prisma/migrations/20260708000001_rls_tenant_isolation/` — RLS ENABLE + tenant_isolation POLICY on 9 tables
- `prisma/seed.ts` — demo tenant (premium), 4 Services, 3 Windows, 3 Users (dev SHA-256 PINs), 3 Tickets, 1 SystemAd placeholder

### @cuelane/ui ✅ Phase 4 Part 4 complete (swarm/phase4-scaffold, 2026-07-08)
- `tailwind.config.ts` — Tailwind v3, CSS-var colour tokens; fontFamily: DM Sans (sans), Outfit (display), Space Mono (mono); tailwindcss-animate plugin
- `postcss.config.mjs` — tailwindcss + autoprefixer
- `components.json` — shadcn New York style, cssVariables: true, tsx: true
- `src/styles/globals.css` — full :root + .dark CSS variable blocks; HashiCorp DESIGN.md token mapping (Link Blue #2264d6 → --primary, Dark Charcoal #15181e → .dark --background, etc.); 8 [data-theme] accent presets (default/terraform/vault/waypoint/vagrant/purple/bright/amber-gold); .cl-label utility (13px uppercase 600 1.3px tracking)
- `src/lib/utils.ts` — cn() via clsx + tailwind-merge
- `src/components/ui/` — Button, Card, Input, Label, Select, Dialog, Badge, Table, Sonner (all New York style, forwardRef, TypeScript strict)
- `src/index.ts` — barrel export

### @cuelane/jobs ✅ Phase 4 Part 4 complete (swarm/phase4-scaffold, 2026-07-08)
- `src/types.ts` — BaseTenantPayload (tenantId+userId), EmailJobPayload, ReportsJobPayload, WebhooksJobPayload, DlqPayload<T>
- `src/connection.ts` — getConnectionOptions(): RedisOptions from VALKEY_URL (dev fallback: redis://localhost:41708); maxRetriesPerRequest:null (BullMQ required); TLS/password parsing; closeConnection() stub
- `src/queues/email.ts` — emailQueue + emailDlq (BullMQ Queue<EmailJobPayload>); 3 attempts, exponential backoff, removeOnFail:false; addEmailJob() helper
- `src/queues/reports.ts` — reportsQueue + reportsDlq; same pattern
- `src/queues/webhooks.ts` — webhooksQueue + webhooksDlq; same pattern

### @cuelane/storage ✅ Phase 4 Part 4 complete (swarm/phase4-scaffold, 2026-07-08)
- `src/types.ts` — MIME allow-list (jpeg/png/gif/webp/mp4/pdf) + deny-list (svg+xml/html/js) constants, MAX_FILE_SIZE_BYTES (10MB), MIME_TO_EXT map, SEGMENT_RE (/^[a-z0-9][a-z0-9_-]{0,63}$/), UploadInput/Result/GetSignedUrlInput, StorageValidationError, StorageAuthorizationError
- `src/config.ts` — S3Client singleton from env (MINIO_ENDPOINT:41709 dev); requireEnv() fails-fast in production; getDefaultBucket()
- `src/storage.ts` — validatePathSegment() (tenantId+entityType against SEGMENT_RE, prevents traversal); validateUpload() (blocklist→allowlist→path→size via body.byteLength); buildStorageKey (MIME_TO_EXT not originalFilename extension); assertTenantKey() (cross-tenant guard on read/delete/sign); putObject/getObject(tenantId)/deleteObject(tenantId)/getSignedDownloadUrl

## Apps

### @cuelane/web ✅ Phase 4 Part 5 complete (swarm/phase4-scaffold, 2026-07-08)
- Next.js 15 App Router, tRPC v11 server + routers (tenant, auth, service, window, ticket, queue), Auth.js v5 (bcrypt-PIN admin + super-admin env), tenant subdirectory middleware, security (CSP headers, rate-limit, DOMPurify sanitize, L1 routing guard). 6 security fixes applied post-review.

### @cuelane/worker ✅ Phase 4 Part 6 complete (swarm/phase4-scaffold, 2026-07-08)
- `package.json` — @cuelane/worker; deps: bullmq, nodemailer, zod, @cuelane/jobs/db/shared/storage; devDeps: @types/nodemailer, tsx
- `tsconfig.json` — extends tsconfig.base.json; strict; Bundler moduleResolution
- `src/env.ts` — Zod-validated env: VALKEY_URL (dev:41708), DATABASE_URL, SMTP_HOST/PORT/SECURE/USER/PASS/FROM/FROM_NAME, MINIO_* vars; process.exit(1) on invalid
- `src/index.ts` — BullMQ Worker per queue (email:concurrency=5, reports:2, webhooks:10); shared connection options; completed/failed event logging; graceful shutdown (SIGTERM/SIGINT, double-shutdown guard, error-tolerant Promise.all)
- `src/processors/email.processor.ts` — nodemailer SMTP send; renderTemplate() switch (email_verification, password_reset, subscription_confirmation, subscription_cancellation, subscription_renewal_reminder, default); escapeHtml() prevents HTML injection; SMTP_SECURE env-driven; no unnecessary withTenant DB coupling
- `src/processors/reports.processor.ts` — tenant-scoped skeleton (withTenant(tenantId)); background report-generation IO is deferred future scope (report export not yet in active PRODUCT.md scope — see Background Jobs / Reporting & Dashboards). Wired end-to-end (queue → worker → tenant tx), body is a logging placeholder.
- `src/processors/webhooks.processor.ts` — tenant-scoped skeleton (withTenant(tenantId)); Xendit webhook signature-validation + dispatch is deferred future scope (payments/subscription billing not yet active — see Integrations). Wired end-to-end, body is a logging placeholder.

## Infrastructure ✅ Phase 4 Part 7 complete (swarm/phase4-scaffold, 2026-07-08)
- `apps/web/Dockerfile` — multi-stage (deps→builder→runner); Next.js standalone output; non-root user nextjs:nodejs
- `apps/web/.dockerignore` — node_modules, .next, dist, .git, .env*, .turbo
- `apps/worker/Dockerfile` — multi-stage (deps→builder→runner); pnpm root node_modules only (hoisted); inline exports patch (src→dist); CMD node apps/worker/dist/index.js; non-root user worker:nodejs
- `apps/worker/.dockerignore` — node_modules, dist, .turbo, .git, .env*, *.md, coverage
- `deploy/compose/dev/docker-compose.app.yml` — build: (dev only) web + worker; healthcheck 127.0.0.1; cuelane_dev network
- `deploy/compose/stage/docker-compose.app.yml` — image-only (C5); web=bonitobonita24/cuelane, worker=bonitobonita24/cuelane-worker; Traefik labels (certresolver=letsencrypt C2, tls=true C3); healthcheck 127.0.0.1 (C4); resource limits top-level (mem_limit/mem_reservation/cpus)
- `deploy/compose/prod/docker-compose.app.yml` — same pattern as stage; Host(cuelane.powerbyte.app); APP_IMAGE_TAG
- `deploy/compose/dev/docker-compose.infra.yml` — pgbouncer+pgAdmin healthchecks use 127.0.0.1 (C4 fix)
- `.env.staging.example` + `.env.prod.example` — all required vars including STAGING_IMAGE_TAG/APP_IMAGE_TAG
- `deploy/compose/start.sh` — dispatches dev|stage|prod; COMPOSE_PROJECT_NAME isolation (C7)
- `deploy/compose/push.sh` — builds/promotes BOTH web + worker images; docker login guard (C6)
- `deploy/komodo-deploy.sh` — vendored from Server-Setups komodo/ci-deploy; pins CUELANE_STAGING_TAG + DeployStack
- `COMMANDS.md` — master operational reference (Docker, DB, test, lint, governance, git, service URLs)
- `deploy/k8s-scaffold/README.md` — K8s inactive placeholder (Rule 6)
- `tools/validate-inputs.mjs` — inputs.yml schema validation
- `tools/check-env.mjs` — required env var check
- `tools/check-product-sync.mjs` — Rule 20 private tag leak + PRODUCT.md ↔ inputs.yml alignment
- `tools/hydration-lint.mjs` — SSR hydration mismatch scanner
- `package.json` — tools:* scripts wired; yaml ^2 devDependency

## CI/CD ✅ Phase 4 Part 7 complete (swarm/phase4-scaffold, 2026-07-08)
- `.github/workflows/ci.yml` — pnpm/action-setup@v4; lint + typecheck + build; triggers push+PR all branches
- `.github/workflows/docker-publish.yml` — push to main; buildx multi-arch (linux/amd64+arm64); builds web (→bonitobonita24/cuelane) AND worker (→bonitobonita24/cuelane-worker); tags sha-{7} + staging-latest; calls komodo-deploy.sh (CUELANE_STAGING_TAG)

## Governance
- docs/PRODUCT.md — complete (written by human)
- docs/DESIGN.md — complete (HashiCorp aesthetic, prompt 4.8)
- docs/DECISIONS_LOG.md — updated (11 entries: HashiCorp aesthetic, dev environment mode, + 9 Phase 3 locked decisions)
- docs/CHANGELOG_AI.md — active (Phase 3 entry + Phase 3 continuation entry written)
- docs/IMPLEMENTATION_MAP.md — this file
- .cline/STATE.md — Phase 3 complete; ports assigned (base 41706)
- .cline/memory/lessons.md — WSL2 gotchas + Edit-before-read fix
- .cline/memory/agent-log.md — initialized
- project.memory.md — initialized

## Spec Files (Phase 3 — complete)
- inputs.yml — v3; slug=cuelane, multi-tenant/subdirectory, xendit, ports.dev.base=41706, docker hub=bonitobonita24/cuelane
- inputs.schema.json — strict JSON Schema draft-07
- .env.dev — non-standard ports (base 41706), Turnstile test keys, Xendit ⏳
- .env.staging — standard ports, APP_IMAGE_TAG=staging-latest, APP_DOMAIN=cuelane-staging.powerbyte.app
- .env.prod — standard ports, APP_IMAGE_TAG=latest, APP_DOMAIN=cuelane.powerbyte.app, Turnstile LIVE ⏳
- .env.example — safe committed template (all placeholders)
- CREDENTIALS.md — AI secrets filled; human ⏳ sections: Docker Hub token, SMTP (Host/Port/Username/Password/From address/From name), Xendit keys, Turnstile LIVE keys, Komodo UI URL
- scripts/sync-credentials-to-env.sh — propagates CREDENTIALS.md → env files; chmod +x
- .cline/handoffs/2026-05-03-phase3-complete-pause.md — pause handoff with resume instructions

---

## PRODUCT.md Feature-Section → Built Implementation (Phase 7 COMPLETE — waves 7.1–7.9, 2026-07-09)

Each PRODUCT.md section (§) mapped to the real routes/files that implement it. ✅ = built + PM-verified;
⏭ = deliberately deferred future scope (documented, not a Phase-7 gap). No invented mappings — every path
below exists in the tree.

| PRODUCT.md section | Status | Implemented by (real routes/files) |
|---|---|---|
| **App Identity** | ✅ | `docs/PRODUCT.md`, branding surfaced across landing + per-tenant screens (companyName/tagline/logoUrl on Tenant model) |
| **Problem Statement** | ✅ | Queue-management product; realized across kiosk/station/display/admin surfaces below |
| **Core User Flows** | ✅ | Kiosk issue → Station call/serve → Display show → Admin manage; wired via tRPC routers `ticket.ts`/`queue.ts`/`station.ts` |
| **Modules + Features** | ✅ | See per-module rows below (kiosk, station, display, admin, super-admin) |
| **Big Display Screen (🖥)** | ✅ | route `apps/web/src/app/[tenant]/display/`; router `display.ts`; live via SSE `api/tenants/[slug]/queue/stream/route.ts` (Wave 7.5) |
| **Customer Kiosk (🎫)** | ✅ | route `apps/web/src/app/[tenant]/kiosk/`; ticket issuance via `ticket.ts` (kioskProcedure) |
| **Employee Station (👤 — Desktop)** | ✅ | route `apps/web/src/app/[tenant]/station/` (auth-guarded); router `station.ts` + `src/server/station/session.ts` (Valkey session map); Call-Next/serve/transfer |
| **Mobile Employee (📱 — Premium only)** | ⏭ | Native Expo mobile app deferred future scope (WatermelonDB/Expo Push not yet built — see Mobile Needs / Out of Scope) |
| **Admin Panel (⚙️)** | ✅ | routes `apps/web/src/app/[tenant]/admin/{services,windows,users,media,theme,settings,usage}/`; routers `tenantAdmin.ts`/`service.ts`/`window.ts`/`user.ts`/`media.ts`/`tenantAd.ts`; access control `admin/_lib/access.ts` |
| **Platform Super Admin (CueLane internal — /superadmin)** | ✅ | routes `apps/web/src/app/super-admin/{dashboard,tenants,system-ads}/`; router `superAdmin.ts`; super-admin auth (env cred) |
| **Platform Landing Page (/)** | ✅ | route `apps/web/src/app/page.tsx` + `_components/landing/` |
| **Subscription Tiers** | ✅ | Tenant.tier (free/premium) enum; tier-gating across admin/display/dashboard; `subscriptions` table |
| **Free Tier** | ✅ | tier=free gating (Powerbyte attribution shown, advanced blocks hidden) — enforced in admin/dashboard/display |
| **Premium Tier** | ✅ | tier=premium unlocks custom theme picker, advanced dashboard blocks, media manager, attribution hidden |
| **Roles + Permissions** | ✅ | Role enum (employee/admin/super_admin); `admin/_lib/access.ts`; Auth.js v5 config `src/server/auth/config.ts`; L3 RBAC |
| **Data Entities** | ✅ | `packages/db/prisma/schema.prisma` (13 models); see Packages → @cuelane/db above |
| **Integrations** | ⏭ (Xendit deferred) | tRPC/Auth.js/MinIO/Valkey/BullMQ all live; Xendit payment webhook is deferred future scope (`webhooks.processor.ts` skeleton) |
| **File Uploads** | ✅ | `packages/storage/` (S3/MinIO); routes `api/tenants/[slug]/media/upload/route.ts` + `api/system-ads/upload/route.ts`; validation in `storage.ts` |
| **Background Jobs** | ✅ (email) / ⏭ (reports) | `packages/jobs/` queues + `apps/worker/` processors; email processor live; reports processor is deferred future scope |
| **Realtime Features** | ✅ | SSE `api/tenants/[slug]/queue/stream/route.ts`; `src/server/realtime/publisher.ts`; live Display/Station updates (Wave 7.2/7.5) |
| **Reporting & Dashboards** | ✅ | route `apps/web/src/app/[tenant]/admin/` dashboard + `admin/usage/`; router `dashboard.ts` (8 KPIs, tier-gated); async report export deferred |
| **Deployment Config** | ✅ | `deploy/compose/{dev,stage,prod}/`; `start.sh`/`push.sh`; `.github/workflows/` |
| **Mobile Needs** | ⏭ | Native mobile (Expo) deferred future scope; web surfaces are responsive |
| **Non-functional Requirements** | ✅ | security (L1-L6), rate-limit, CSP, SSE realtime, multi-tenant isolation (RLS + L6 guard) |
| **Tenancy Model** | ✅ | shared-schema + tenant_id; subdirectory `/[tenant]/` middleware; RLS `packages/db/src/rls.ts` + L6 tenant-guard middleware |
| **User-Facing URLs** | ✅ | `/`, `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/[tenant]/{kiosk,display,station,admin/*}`, `/super-admin/*` |
| **Access Control** | ✅ | `admin/_lib/access.ts`; Auth.js middleware; L1 routing guard; super-admin gate |
| **Data Sensitivity** | ✅ | PIN auth (bcrypt/SHA-256 dev), tenant isolation, audit_logs (L5), no cross-tenant leakage (assertTenantKey) |
| **Security Requirements** | ✅ | L1-L6 stack; CSP headers, DOMPurify sanitize, rate-limit, RLS; `packages/db/src/middleware/tenant-guard.ts` |
| **Environments Needed** | ✅ | dev/stage/prod compose stacks + `.env.{dev,staging,prod}` |
| **Domain / Base URL Expectations** | ✅ | cuelane.powerbyte.app (prod), cuelane-staging.powerbyte.app (stage) — Traefik labels in stage/prod compose |
| **Infrastructure Notes** | ✅ | Postgres/PgBouncer/Valkey/MinIO/MailHog/pgAdmin compose (dev base port 41706); Docker + Komodo + Traefik |
| **Tech Stack Preferences** | ✅ | Next.js 15 · tRPC v11 · Prisma · Auth.js v5 · PostgreSQL · Valkey · BullMQ · MinIO · shadcn/ui · Tailwind (locked stack) |
| **Design Identity** | ✅ | `docs/DESIGN.md` (HashiCorp aesthetic); `packages/ui/` tokens; per-tenant theme presets + premium custom picker (Wave 7.7) |
| **Out of Scope** | ✅ | Native mobile, Xendit payments, async report export explicitly out of current scope (deferred future work) |

