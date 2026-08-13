# Changelog

All notable changes per release. A version is assigned at each push/merge to `main`;
entries are auto-derived from Conventional-Commit types. See
`~/.claude/rules/release-changelog-discipline.md`.

## v1.2.0 — 2026-08-13

### [FEATURE]
- demo quick-login rail — one-click sign-in per RBAC tier (`ab8f3d3`)
- Station "Change Window" — wire the placeholder button (DEFERRED #4) (`55567e3`)

### [FIXED]
- landing footer address → Calapan City (canonical company identity) (`f0e89c1`)

### [CHORE]
- couple local-dev rebuild + freshness check into staging/prod ship (`fc04405`)


## v1.1.0 — 2026-08-13

### [FEATURE]
- promote platform tenant_manager to a vault-backed DB user (D-RBAC-1) (`ec5e53a`)

### [DOCS]
- resolve D-RBAC-1, Free Theme tab, storage-origin; Rule-32 evidence (`98bd46f`)


## v1.0.0 — 2026-08-11

### [FEATURE]
- Wave 2 — custom-role builder UI + customRoles router (Rule 34 Part B) (`9f3db93`)
- Wave 1 — matrix-driven view-access enforcement (Rule 34 Part B) (`ae8b333`)
- Wave 0 — view-access matrix schema + resolver + Feature seed (`36a637d`)
- RBAC 3-tier — ownership succession (T5) (`7ff65ca`)
- RBAC admin-tier widen + user-management narrow + signup owner (`f73385f`)
- RBAC platform-tier -> tenant_manager + roleMap for renamed enum (`a8fb45a`)
- RBAC 3-tier Role enum + assignable-role schemas (`c109a28`)
- RBAC 3-tier UserRole enum migration + one-owner-per-tenant index (`9ad3d6d`)

### [FIXED]
- drop now-unnecessary type assertions in RoleFormDialog (`19c2e4a`)
- RBAC T5 — coerce Prisma UserRole to shared Role in transferOwnership compare (`535c9c7`)
- RBAC 3-tier — seed owner role admin→tenant_superadmin (T6 partial) (`c653acf`)
- make the workspace lint gate genuinely green (was turbo-cache-masked) (`b8fb256`)

### [REFACTOR]
- rename /super-admin route to /superadmin (match PRODUCT.md) (`95e0063`)

### [DOCS]
- resolve /super-admin→/superadmin decision; RBAC Wave 3 verified (`a74d29b`)
- fix stale managed Next → RBAC Wave 2 (owner-gated) (`0eff09b`)
- RBAC Wave 1 done — enforcement wired + verified (ae8b333) (`d7aa1a1`)
- resolve D-RBAC-3 — build custom-role view-access matrix (Full Part B) (`a9f0920`)
- 2026-08-08 — RBAC 3-tier backbone (T1–T8) complete + verified (`2a6313c`)
- back-port 3-tier role model to PRODUCT.md + DECISIONS_LOG (T8) (`78a483a`)
- 3-tier retrofit plan + defer platform-identity/matrix WHATs (`e6c98db`)
- 2026-07-19d — session handoff; RBAC 3-tier retrofit owner-APPROVED as next task (`c21bc64`)
- 2026-07-19c — lint gate genuinely green (turbo-cache false-read corrected) (`68a7b3a`)
- Milestone 2 — full 258-test regression green + footer live-verified (`80fa947`)
- back-port real-time transport WebSocket → SSE (D1 resolved) (`2a37842`)
- v0.1.0 + footer done; track SSE-vs-WebSocket + login [WHAT]s (`dc451f0`)

### [TEST]
- Wave 3 verify-all-pages per role (Playwright) + fixtures + evidence (`53775a4`)
- RBAC 3-tier — sweep test suite to renamed Role enum (T7) (`e0b97e3`)

### [CHORE]
- make staging workflow manual-only (Model B) until staging stood up (`c3b1652`)
- sync-context managed region — RBAC backbone complete (`2316b05`)
- attack-informed hardening scan — CLEAN (semgrep 246 files/0 findings) (`37e0c6c`)
- gitignore screenshots/ + .playwright-mcp/ scratch dirs (`5b72991`)
- sync CLAUDE.md managed region (Milestone 2 verification) (`47fbf33`)
- sync CLAUDE.md managed region (D1 SSE back-port) (`5cece10`)
- sync CLAUDE.md managed region (v0.1.0 resume session) (`9999f6d`)

