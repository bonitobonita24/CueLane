# Task Queue — CueLane

Fleet-standard task backlog (`task-capture-discipline.md`). Status: **TODO 🔴 · PARTIAL 🟡 · DONE ✅**.
Captures owner-dumped asks AND agent-found out-of-scope items. Distilled spec only — never raw prose.
Not a decisions log — owner-gated `[WHAT]`s live in `PENDING_DECISIONS.md`. Board mirror: Squirlnote project CueLane (CUE-n).

## 🔴 / 🟡 Open
- 🟡 **Staging live deploy (Item 3)** — OWNER-GATED (HARD HOLD); runbook `docs/planning/STAGING_STANDUP_HANDOFF.md`. `chore/staging-standup` now rebased onto main (contains pnpm@10 pin + worker perms) — ready when owner says ship. `owner 2026-08-13`
- 🟡 **In-flight branches** — `feat/dashboard-ai-insights`, `chore/framework-sync-v32-wip`, `docs/admincn-adoption-plan`: parked, owner-gated. `agent-found 2026-09-27`

## ✅ Done recently
- ✅ **Tenant dark-sidebar logo contrast** — PowerbyteBrandMark picks variant by rendered background luminance (WCAG); replaces `.dark`-class swap that couldn't see tenant inline-CSS-var surfaces. Branch `fix/tenant-sidebar-logo-contrast` (`a18f9ff`, LOCAL/HARD HOLD). Note: `--sidebar-background` not yet in tenant ThemeVars, so dark sidebar not reachable via UI today — fix is future-proof. (2026-09-27, CUE-4)
- ✅ **Rebase `chore/staging-standup` onto main** — new tip `e62f42a` atop `5b4529d`; `4fddd50` pnpm pin now an ancestor; staging compose config valid. LOCAL/HARD HOLD. (2026-09-27, CUE-6)
- ✅ **Dev compose restart "no"** — dev stack no longer auto-starts (`63705c7`, 2026-09-27, CUE-2)
- ✅ **Official Powerbyte favicon kit + theme-aware brand mark** (`94ae10f`, 2026-09-27, CUE-1)
- ✅ **pnpm@10.0.0 pin in web+worker Dockerfiles** — pnpm 12 fails on Alpine (`4fddd50`, 2026-09-27)
- ✅ **APP_VERSION drift fix** — sidebar version derived from `apps/web/package.json` via next.config env (`7395a39`, 2026-09-27)
