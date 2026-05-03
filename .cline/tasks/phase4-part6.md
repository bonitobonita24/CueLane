# Phase 4 Part 6 — apps/mobile (Expo scaffold)
# Fresh session. Read STATE.md first.
TASK: Generate the Expo mobile application scaffold (Part 6 of 8).
- Read .cline/STATE.md first. Confirm LAST_DONE shows Part 5 complete.
- Read inputs.yml (apps section — check if mobile app declared). Read PRODUCT.md (mobile workflows).
- IF no mobile app declared in inputs.yml → skip this Part entirely:
  Rewrite STATE.md: PHASE="Phase 4 Part 6 skipped (no mobile)", NEXT="Start Part 7"
  Output: "Part 6 skipped — no mobile app declared. Open phase4-part7.md in a NEW Claude Code session."
  STOP HERE.
- IF mobile app declared:
  Create scaffold/part-6 branch.
  Generate:
    app.json / app.config.ts — Expo config
    eas.json — EAS Build config
    src/env.ts — typed env vars for mobile
    src/components/ui/ — React Native Reusables + NativeWind
    src/app/ — Expo Router screens for mobile workflows
    src/api/ — uses packages/api-client/ ONLY (NEVER packages/db — Rule 13)
    src/storage/ — WatermelonDB / AsyncStorage / MMKV for local persistence
    src/sync/ — offline queue + sync (if offline-first declared)
    src/notifications/ — Expo Push / FCM+APNs (if declared)
  Run: pnpm typecheck. Fix all errors.
  Rewrite STATE.md. Commit. Squash-merge. Delete branch.
  Output: "Part 6 complete. Open phase4-part7.md in a NEW Claude Code session."
STOP HERE.
