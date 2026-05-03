# Phase 4 Part 7 — tools/ + deploy/compose/ + SocratiCode artifacts
# Fresh session. Read STATE.md first.
TASK: Generate tooling, Docker Compose files, and SocratiCode config (Part 7 of 8).
- Read .cline/STATE.md first. Confirm LAST_DONE shows Part 5 or Part 6 complete.
- Read inputs.yml (all sections). Read all prior Part summaries.
- Create scaffold/part-7 branch.
- Generate:
  tools/ — validate-inputs.mjs, check-env.mjs, check-product-sync.mjs, hydration-lint.mjs
  deploy/compose/dev|stage|prod/ — split compose files per service group:
    docker-compose.db.yml (creates shared network)
    docker-compose.cache.yml
    docker-compose.storage.yml
    docker-compose.infra.yml (dev only — MailHog)
    docker-compose.pgadmin.yml (all envs)
    docker-compose.app.yml (dev: build key; stage/prod: NO build key — Docker Hub pull ONLY)
    pgadmin-servers.json (per env)
  deploy/compose/start.sh — convenience startup script
  deploy/compose/push.sh — manual image promotion (if docker.publish: true)
  COMMANDS.md — master command reference (if docker.publish: true)
  .socraticodecontextartifacts.json — MERGE with existing entries (design-system if present)
  deploy/k8s-scaffold/ — inactive placeholder with README
- Run: pnpm typecheck. Fix all errors.
- Rewrite STATE.md. Commit. Squash-merge. Delete branch.
- Output: "Part 7 complete. Open phase4-part8.md in a NEW Claude Code session."
STOP HERE.
