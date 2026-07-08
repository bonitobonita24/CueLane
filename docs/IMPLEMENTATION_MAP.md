# Implementation Map — CueLane

Current build state. Rewritten after every feature update to reflect what exists.

---

## Root Config
✅ Phase 4 Part 1 complete (swarm/phase4-scaffold, 2026-07-08)
- `pnpm-workspace.yaml` — workspace globs: apps/*, packages/*
- `turbo.json` — tasks: build (^build), lint (^lint), typecheck (^typecheck), test (^test), dev (cache:false)
- `package.json` — name @cuelane/root, turbo/typescript/eslint/prettier devDeps, db:* passthroughs
- `tsconfig.base.json` — strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes + Bundler moduleResolution + ES2022
- `.editorconfig` — utf-8, lf, 2-space indent, final newline
- `.prettierrc` — singleQuote, semi, tabWidth:2, trailingComma:es5
- `eslint.config.mjs` — ESLint v9 flat config; typescript-eslint recommendedTypeChecked; no-explicit-any/no-unsafe-assignment/strict-boolean-expressions as errors
- `.gitignore` — updated: added coverage/, patches/
- `.nvmrc` — 22 (pre-existing)
- `deploy/compose/dev/docker-compose.infra.yml` — Postgres:41706, PgBouncer:41707, Valkey:41708, MinIO:41709/41710, MailHog:41711/41712, pgAdmin:41713; healthchecks on all services; named volumes; cuelane_dev network
- `.env.example` — added DIRECT_URL (postgres direct, migrations) + DATABASE_URL (pgbouncer pooled, runtime) + STORAGE_PORT

## Packages
_Not yet scaffolded — Phase 4 Parts 2-4_

## Apps
_Not yet scaffolded — Phase 4 Parts 5-6_

## Infrastructure
_Not yet scaffolded — Phase 4 Part 7_

## CI/CD
_Not yet scaffolded — Phase 4 Part 8_

## Governance
- docs/PRODUCT.md — complete (written by human)
- docs/DESIGN.md — complete (HashiCorp aesthetic, prompt 4.8)
- docs/DECISIONS_LOG.md — updated (11 entries: HashiCorp aesthetic, dev environment mode, + 9 Phase 3 locked decisions)
- docs/CHANGELOG_AI.md — active (Phase 3 entry + Phase 3 continuation entry written)
- docs/IMPLEMENTATION_MAP.md — this file
- .cline/STATE.md — Phase 3 complete; ports assigned (base 41706)
- .cline/memory/lessons.md — WSL2 gotchas + Edit-before-read fix
- .cline/memory/agent-log.md — initialized
- project.memory.md — initialized

## Spec Files (Phase 3 — complete)
- inputs.yml — v3; slug=cuelane, multi-tenant/subdirectory, xendit, ports.dev.base=41706, docker hub=bonitobonita24/cuelane
- inputs.schema.json — strict JSON Schema draft-07
- .env.dev — non-standard ports (base 41706), Turnstile test keys, Xendit ⏳
- .env.staging — standard ports, APP_IMAGE_TAG=staging-latest, APP_DOMAIN=cuelane-staging.powerbyte.app
- .env.prod — standard ports, APP_IMAGE_TAG=latest, APP_DOMAIN=cuelane.powerbyte.app, Turnstile LIVE ⏳
- .env.example — safe committed template (all placeholders)
- CREDENTIALS.md — AI secrets filled; human ⏳ sections: Docker Hub token, SMTP (Host/Port/Username/Password/From address/From name), Xendit keys, Turnstile LIVE keys, Komodo UI URL
- scripts/sync-credentials-to-env.sh — propagates CREDENTIALS.md → env files; chmod +x
- .cline/handoffs/2026-05-03-phase3-complete-pause.md — pause handoff with resume instructions
