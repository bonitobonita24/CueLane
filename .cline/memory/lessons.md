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
