# Project State — CueLane

_V32 memory-governance tracker. Auto-updated at every Smart Checkpoint. Migrated from
`.cline/STATE.md` (Cline deprecated V31) on 2026-07-08 at framework sync V32.18 → V32.24._

PHASE:        **Phase 4 complete (all 7 Parts) — ready for Phase 5**
LAST_DONE:    Phase 4 Part 7 — infra + CI: Dockerfiles (web+worker) + deploy/compose stage/prod (Traefik) + start.sh/push.sh + tools/ + COMMANDS.md + GitHub Actions ci.yml + docker-publish.yml (2026-07-08, swarm S7 run-15).
              Code review: 5 confirmed findings fixed: (1) CI only built web image → added worker image build; (2) per-package node_modules COPY removed (pnpm hoists); (3) pgbouncer/pgAdmin localhost→127.0.0.1 (C4); (4) PRIVATE_TAG_RE /g flag dropped; (5) SHA computation via ${GITHUB_SHA:0:7}. lint-deploy C1-C8 all PASS.
NEXT:         Phase 5 — Validation (human trigger: "Start Phase 5").
EVIDENCE:     Phase 4 scaffold ground-truth verified (PM, 2026-07-08): 130 files/+13.3K lines;
              `pnpm -w typecheck` = 8/8 ✓ · `pnpm -w lint` = 8/8 ✓ · `pnpm -w build` = 8/8 ✓
              (incl. real Next.js prod build of @cuelane/web + worker tsc build). Post-wave fix
              `8fc1176`: worker had 14 ESLint errors (wave lint was best-effort `|| true`, didn't
              gate) — type-safe email coercion + awaited stub processors → lint now green.
              Built via swarm (conductor.sh, 7 sequential sessions, Sonnet-4.6, worktree-isolated).
              ⚠ swarm halted once on a case-status false-negative (S5 "DONE") — fixed in the
              orchestrator (`12d61f6`) + resumed clean; findings in ~/.claude/LESSONS_GLOBAL.md.
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
