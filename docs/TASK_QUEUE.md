# Task Queue — CueLane

Fleet-standard task backlog (`task-capture-discipline.md`). Status: **TODO 🔴 · PARTIAL 🟡 · DONE ✅**.
Captures owner-dumped asks AND agent-found out-of-scope items. Distilled spec only — never raw prose.
Not a decisions log — owner-gated `[WHAT]`s live in `PENDING_DECISIONS.md`. Board mirror: Squirlnote project CueLane (CUE-n).

## 🔴 / 🟡 Open
- 🔴 **Tenant dark-sidebar logo contrast** — tenant themes set colors inline (no `.dark` class), so PowerbyteBrandMark (`apps/web/src/components/PowerbyteBrandMark.tsx`) shows the LightBG logo on a tenant-chosen dark sidebar. Fix: pick variant by sidebar background luminance (or use a Badge variant). Done: correct-contrast mark under a dark tenant theme, screenshot. `agent-found 2026-09-27`
- 🔴 **Rebase `chore/staging-standup` onto main** — it predates the pnpm@10 Docker pin (`4fddd50`) + worker perms fix; CI image builds need them. Done: branch rebased, compose config valid. (Live staging deploy itself stays owner-gated.) `agent-found 2026-09-27`
- 🟡 **Staging live deploy (Item 3)** — OWNER-GATED (HARD HOLD); runbook `docs/planning/STAGING_STANDUP_HANDOFF.md`. `owner 2026-08-13`
- 🟡 **In-flight branches** — `feat/dashboard-ai-insights`, `chore/framework-sync-v32-wip`, `docs/admincn-adoption-plan`: parked, owner-gated. `agent-found 2026-09-27`

## ✅ Done recently
- ✅ **Dev compose restart "no"** — dev stack no longer auto-starts (`63705c7`, 2026-09-27, CUE-2)
- ✅ **Official Powerbyte favicon kit + theme-aware brand mark** (`94ae10f`, 2026-09-27, CUE-1)
- ✅ **pnpm@10.0.0 pin in web+worker Dockerfiles** — pnpm 12 fails on Alpine (`4fddd50`, 2026-09-27)
- ✅ **APP_VERSION drift fix** — sidebar version derived from `apps/web/package.json` via next.config env (`7395a39`, 2026-09-27)
