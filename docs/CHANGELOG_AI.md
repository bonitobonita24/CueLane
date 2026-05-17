# Changelog AI — CueLane

Chronological log of all agent-made changes. Every entry includes attribution.
Format: Rule 15 — Agent attribution required on every entry.

---

## 2026-05-17 — Email provider swap: Resend → SMTP

- Agent:               CLAUDE_CODE
- Why:                 Human decided to switch from Resend API to standard SMTP relay (generic provider, same account staging + prod). Decision captured in DECISIONS_LOG.md entry "2026-05-17 — Email provider: SMTP (was Resend)".
- Files added:
  - `upgrade-credentials-smtp.sh` — local script (Scenario 34 pattern) to swap `## 📧 Resend API Key` section in CREDENTIALS.md for V31 `## 📧 SMTP` section. Atomic backup + section replace. Runs in human terminal — credential values never enter AI context.
- Files modified:
  - `inputs.yml` — `tech_stack.email: resend → smtp`; `email.provider: resend → smtp`; added `email.relay_type: generic` + `email.same_account_for_staging_prod: true`
  - `.env.dev` — removed `# RESEND (email provider — dev uses MailHog, not Resend)` comment + `RESEND_API_KEY` line (MailHog SMTP unchanged)
  - `.env.staging` — removed `RESEND_API_KEY` line (SMTP_HOST/USER/PASSWORD/FROM/FROM_NAME remain ⏳)
  - `.env.prod` — removed `RESEND_API_KEY` line (SMTP_HOST/USER/PASSWORD/FROM/FROM_NAME remain ⏳)
  - `.env.example` — removed Resend placeholder block (`# For staging/prod (Resend):` + `# RESEND_API_KEY=...`)
  - `docs/DECISIONS_LOG.md` — appended locked decision entry
  - `docs/IMPLEMENTATION_MAP.md` — updated CREDENTIALS.md note: `Resend/SMTP` → `SMTP`
  - `docs/CHANGELOG_AI.md` — this entry
- Files deleted:       none
- Schema/migrations:   none (Phase 4 has not started — no Prisma models or application code to migrate)
- Errors encountered:  none
- Errors resolved:     none
- Pending human action:
  1. Edit `docs/PRODUCT.md` lines 16, 190, 205 to replace Resend wording with SMTP (per H4 — PRODUCT.md is human-owned; agent provided exact diffs)
  2. Run `bash upgrade-credentials-smtp.sh` in terminal to swap the CREDENTIALS.md section structure
  3. Fill the 6 SMTP fields in CREDENTIALS.md (Host, Port, Username, Password, From address, From name) before Phase 5

---

## 2026-05-03 — Phase 3 continuation: STATE.md + handoff + pause governance

- Agent:               CLAUDE_CODE
- Why:                 Continuation session after context window boundary. STATE.md was still showing Phase 0 (Bootstrap complete) — the prior session ran out of context before writing the final STATE.md update. This session completed that update and executed the human-requested pause governance sequence.
- Files added:
  - `.cline/handoffs/2026-05-03-phase3-complete-pause.md` — Phase 3 complete handoff note with output contract verification, pending ⏳ items, resume instructions, and locked decisions summary
- Files modified:
  - `.cline/STATE.md` — updated from "Phase 0 — Bootstrap complete" to "Phase 3 complete" with all port assignments, blockers, and NEXT pointer
  - `docs/CHANGELOG_AI.md` — this entry
  - `docs/IMPLEMENTATION_MAP.md` — updated Governance section to reflect Phase 3 state
  - `.cline/memory/lessons.md` — added 🟡 fix entry for Edit-before-read pattern
- Files deleted:       none
- Schema/migrations:   none
- Errors encountered:  (1) Edit tool rejected on STATE.md — "File has not been read yet in this session." Same pattern as prior session's CHANGELOG_AI.md error. Fix: Read before Edit. (2) Vercel plugin hook fired again on pause request (matched "pause"/"resume" keywords). Hook suggested Skill(workflow). Correctly identified as irrelevant — Vercel Workflow is a compute product, not a governance pause. Skipped per H1 priority order (plugin skills priority 7 < phase execution rules priority 3).
- Errors resolved:     Both resolved. Edit-before-read pattern logged to lessons.md.

---

## 2026-05-03 — Phase 3: Generate Spec Files

- Agent:               CLAUDE_CODE
- Why:                 Phase 3 triggered by human ("Start Phase 3"). Generates all spec files from PRODUCT.md and Phase 2 interview answers. Locks tech stack, ports, credentials, and governance decisions before Phase 4 scaffold begins.
- Files added:
  - `inputs.yml` — complete app spec (v3): app, apps, packages, tech_stack, tenancy, auth, payment, storage, jobs, realtime, email, turnstile, subscription_tiers, environments, domains, cors, docker, git, models, vibe_test, context7, accessibility, security, ports.dev
  - `inputs.schema.json` — strict JSON Schema draft-07 for inputs.yml validation
  - `.env.dev` — development environment with non-standard ports (base 41706), all AI-generated credentials filled
  - `.env.staging` — staging environment with standard ports, Traefik config, APP_IMAGE_TAG=staging-latest
  - `.env.prod` — production environment with standard ports, Traefik config, APP_IMAGE_TAG=latest
  - `.env.example` — safe committed template (all placeholders, no real values)
  - `CREDENTIALS.md` — Phase 3 authoritative master credentials (AI-generated secrets filled; human-provided sections marked ⏳)
  - `scripts/sync-credentials-to-env.sh` — propagates CREDENTIALS.md human-filled values to env files
- Files modified:
  - `docs/DECISIONS_LOG.md` — added 9 locked decision entries: port strategy, git branching, model routing, docker publishing, Xendit payment, vibe_test, tenancy mode, auth strategy, Turnstile config
- Files deleted:       none
- Schema/migrations:   none (Phase 3 pre-code — no Prisma schema yet)
- Errors encountered:  Vercel plugin hook fired on .env.example write — correctly identified as irrelevant (CueLane deploys via Komodo+Docker, not Vercel; plugin skills at priority 7 do not override Phase 3 at priority 3). Skipped without action.
- Errors resolved:     none

---
