# Phase 4 Part 8 — CI + governance docs + MANIFEST.txt + SocratiCode index
# Fresh session. Read STATE.md first.
TASK: Generate CI workflows, finalize governance docs, create manifest (Part 8 of 8).
- Read .cline/STATE.md first. Confirm LAST_DONE shows Part 7 complete.
- Read ALL 9 governance docs + IMPLEMENTATION_MAP.md.
- Create scaffold/part-8 branch.
- Generate:
  .github/workflows/ci.yml — governance gates + quality matrix + security audit
  .github/workflows/docker-publish.yml (if docker.publish: true) — Docker Hub push on main merge
  docs/CHANGELOG_AI.md — append full Phase 4 summary entry (Agent: CLAUDE_CODE)
  docs/IMPLEMENTATION_MAP.md — rewrite with complete current state snapshot
  MANIFEST.txt — list EVERY file generated across ALL 8 Parts
- After Part 8 complete:
  Trigger SocratiCode initial index:
    codebase_index {}
    codebase_status {} (poll until complete)
    codebase_context_index {}
- Run: pnpm lint + pnpm typecheck + pnpm test + pnpm build. Fix all errors.
- Rewrite STATE.md: PHASE="Phase 4 complete", NEXT="Start Phase 5 in new session"
- Commit. Squash-merge. Delete branch.
- GOVERNANCE SELF-CHECK:
  CHANGELOG_AI.md: entry for Phase 4 Part 8 with timestamp
  IMPLEMENTATION_MAP.md: reflects complete scaffold state
  STATE.md: PHASE="Phase 4 complete"
- Output: "Phase 4 complete. Say 'Start Phase 5' in a NEW Claude Code session."
STOP HERE. Human manually triggers Phase 5.
