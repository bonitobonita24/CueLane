# Lessons Memory — Spec-Driven Platform V31
# Entry format: ## YYYY-MM-DD — [ICON] [Title]
# Types: gotcha | fix | decision | trade-off | change
# READ ORDER: gotcha first → decision second → rest by relevance
# ---

## BOOTSTRAP — WSL2 + Docker Desktop known pitfalls
- Type:      gotcha
- Phase:     Phase 0 Bootstrap / Phase 1 dev environment open
- Files:     .env.dev, docker-compose.*.yml, .nvmrc
- Concepts:  wsl2, docker-desktop, pnpm, nvm, permissions
- Narrative: Real failures on WSL2 + Docker Desktop. All fixes baked into Bootstrap template.
  (1) Never use corepack enable — use npm install -g pnpm. corepack symlinks fail in some WSL2 setups.
  (2) pnpm install must run from WSL2 terminal — not Windows PowerShell or CMD.
  (3) Docker Desktop must be running before any docker compose command. Check with: docker ps.
  (4) Port conflicts: dev services use non-standard random ports (Rule 22). If conflict occurs,
      regenerate ports in inputs.yml → run Phase 7 → restart services.
  (5) nvm must be sourced in .bashrc — add: [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
  (6) WSL2 file permissions: always develop inside WSL2 filesystem (/home/user/) not /mnt/c/.
      Working in /mnt/c/ causes severe pnpm and docker performance issues.
# ---

## 2026-07-08 — 🔴 Prisma $allOperations L6 tenant-guard: three write/read bypass vectors
- Type:      🔴 gotcha
- Phase:     Phase 4 Part 3 (packages/db L6 guard) — any phase using Prisma $allOperations
- Files:     packages/db/src/middleware/tenant-guard.ts
- Concepts:  prisma, tenant-guard, allOperations, L6, multi-tenant, security
- Narrative: Three critical bypass vectors in the initial Prisma $allOperations tenant-guard, caught in code review:
  (1) WHERE conditional guard: original code used `if ('where' in args) { args.where = {...args.where, tenantId} }`.
      This missed calls like findMany({}) where args has no 'where' key — rows from ALL tenants returned.
      Fix: unconditional `args.where = { ...args.where, tenantId }` — always safe (spreads undefined cleanly).
  (2) Upsert bypass: upsert args use 'create' and 'update' sub-keys, NOT the top-level 'data' key.
      The data-injection branch never matched, so upsert wrote rows without tenantId.
      Fix: dedicated `if (operation === 'upsert')` branch injecting into args.create and args.update.
  (3) createMany bypass: original code skipped injection when `Array.isArray(args.data)` (which is always
      true for createMany). Bulk inserts wrote rows without tenantId.
      Fix: dedicated `if (operation === 'createMany')` branch mapping tenantId into each array element.
  Rule: for $allOperations guards, enumerate EVERY write operation explicitly — create/update/upsert/createMany
  all have different arg shapes. Default to unconditional WHERE injection (never conditional).
# ---

## 2026-05-03 — 🟡 Edit tool requires file to be Read in same session before editing
- Type:      🟡 fix
- Phase:     Any phase — affects every session
- Files:     Any file targeted by Edit tool
- Concepts:  edit-tool, read-first, session-start, claude-code
- Narrative: The Edit tool rejects writes with "File has not been read yet in this session" if the file
  was not explicitly Read via the Read tool earlier in the same Claude Code session. This occurs even
  if the file was read in a prior session. Fix: always call Read on the target file before calling Edit.
  This pattern hit twice across Phase 3 sessions — CHANGELOG_AI.md in the prior session and STATE.md
  in this session. Prevention: before any Edit call, verify the file has been read in the current session.
  The Write tool does NOT have this restriction (it overwrites unconditionally), but Write should only
  be used for new files or complete rewrites — not for targeted edits.
# ---
