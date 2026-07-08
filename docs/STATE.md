# Project State — CueLane

_V32 memory-governance tracker. Auto-updated at every Smart Checkpoint. Migrated from
`.cline/STATE.md` (Cline deprecated V31) on 2026-07-08 at framework sync V32.18 → V32.24._

PHASE:        Phase 3 complete → **Phase 4 Part 1 (scaffold) NEXT**
LAST_DONE:    Framework synced V32.18 → V32.24 (28 deliverables); V31 orphans removed;
              STATE tracker migrated to docs/STATE.md. Phases 0–3 artifacts complete:
              PRODUCT.md (26 sections), DESIGN.md (HashiCorp aesthetic), inputs.yml v3,
              env files, CREDENTIALS.md, DECISIONS_LOG (11), CHANGELOG_AI, IMPLEMENTATION_MAP.
NEXT:         Phase 4 Part 1 — monorepo root scaffold (pnpm-workspace.yaml, turbo.json,
              root tsconfig/eslint/prettier, apps/web + apps/worker + packages/* skeletons,
              docker-compose dev: Postgres/Valkey/MinIO/MailHog).
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
