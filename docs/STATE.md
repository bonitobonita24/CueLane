# Project State — CueLane

_V32 memory-governance tracker. Auto-updated at every Smart Checkpoint. Migrated from
`.cline/STATE.md` (Cline deprecated V31) on 2026-07-08 at framework sync V32.18 → V32.24._

PHASE:        **Phase 4 Part 3 complete → Phase 4 Parts 5-6 NEXT** (apps/web + apps/worker)
LAST_DONE:    Phase 4 Part 3 — packages/db: Prisma schema (13 entities, 7 enums), L6 tenant-guard ($allOperations + AsyncLocalStorage), L2 RLS helper, L5 audit helper, repositories, init+RLS migrations, dev seed (2026-07-08, swarm S4 run-11).
              Code review: 3 critical guard bypass bugs fixed (WHERE unconditional injection; upsert create/update branch; createMany array map). Lint/typecheck = 0 errors.
NEXT:         Phase 4 Parts 5-6 — apps/web (Next.js 15 App Router) + apps/worker (tRPC + BullMQ workers).
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
