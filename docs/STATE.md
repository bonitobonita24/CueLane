# Project State — CueLane

_V32 memory-governance tracker. Auto-updated at every Smart Checkpoint. Migrated from
`.cline/STATE.md` (Cline deprecated V31) on 2026-07-08 at framework sync V32.18 → V32.24._

PHASE:        **Phase 4 Part 2 complete → Phase 4 Part 3 NEXT**
LAST_DONE:    Phase 4 Part 2 — packages/shared (TS types+Zod schemas) + packages/api-client (tRPC v11 client) (2026-07-08, swarm S2 run-9).
              Created: packages/shared/{package.json,tsconfig.json,src/types/index.ts,src/schemas/index.ts,src/index.ts},
              packages/api-client/{package.json,tsconfig.json,src/index.ts}.
              Entities typed: Tenant, Service, Window, User, Ticket, PlaylistEntry, TenantAd, SystemAd, Subscription, PasswordResetToken, SessionMapEntry.
              Zod schemas: create/update/action per entity; discriminated unions; cross-field superRefine; bounded reorder arrays.
              tRPC v11 client: createClient() + createTRPCReact<AppRouter>(); AppRouter=any placeholder (TODO S5).
              pnpm install: +10 packages. lint/typecheck/build: 0 errors.
NEXT:         Phase 4 Part 3 — packages/db (Prisma ORM schema, migrations, audit/tenant-guard middleware, seed).
EVIDENCE:     Framework sync verified — grep CLAUDE_compact.md = V32.24; 28/28 deliverables
              deployed; spec-gap-check ran (all findings expected pre-scaffold).
BLOCKERS:     Human ⏳ in CREDENTIALS.md before Phase 5 deploy (NOT Phase 4 dev): Docker Hub
              token, SMTP creds, Xendit API keys (TEST+LIVE), Turnstile LIVE keys. Phase 4
              dev uses MailHog + Turnstile test keys — not blocked.
GIT_BRANCH:   main (framework sync merged local; UNPUSHED — HARD HOLD, local dev only)
DEPLOY_HOLD:  ⛔ LOCAL DEV ONLY. No staging/prod push without explicit owner word.
PORTS (dev):  APP=41716 WORKER=41717 DB=41706 PGBOUNCER=41707 CACHE=41708 MINIO=41709
              MINIO_CONSOLE=41710 MAILHOG_SMTP=41711 MAILHOG_UI=41712 PGADMIN=41713
              PRISMA_STUDIO=41726
MODELS:
  planning:   Opus 4.8 (PM/architect)
  execution:  claude-sonnet-4-6 (swarm workers, per battle-test discipline)
TENANCY:      multi (subdirectory /{tenant}/), tenant_id on all entities, L6 Prisma RLS
SECURITY:     level=none (no gov/LGU/regulated flag); L3 RBAC + L5 AuditLog + L6 guardrails active
