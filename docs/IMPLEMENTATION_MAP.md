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
- `src/index.ts` — createClient() vanilla tRPC v11 client; trpc = createTRPCReact<AppRouter>(); AppRouter=any placeholder (TODO S5 — replace with import type from apps/web); peerDep react >=18.2.0; no transformer on client (tRPC v11 — lives on server initTRPC)

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
- `src/types.ts` — ALLOWED_MIME_TYPES (jpeg/png/gif/webp/mp4/pdf), BLOCKED_MIME_TYPES (svg+xml/html/js), MAX_FILE_SIZE_BYTES (10MB), MIME_TO_EXT map, SEGMENT_RE (/^[a-z0-9][a-z0-9_-]{0,63}$/), UploadInput/Result/GetSignedUrlInput, StorageValidationError, StorageAuthorizationError
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
- `src/processors/reports.processor.ts` — skeleton; withTenant(tenantId) scoped; TODO Phase 8
- `src/processors/webhooks.processor.ts` — skeleton; withTenant(tenantId) scoped; TODO Phase 8 (Xendit validation)

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
