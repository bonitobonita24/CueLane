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
_Not yet scaffolded — Phase 4 Parts 5-6_

## Infrastructure
_Not yet scaffolded — Phase 4 Part 7_

## CI/CD
_Not yet scaffolded — Phase 4 Part 8_

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
