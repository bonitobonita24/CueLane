# CueLane — Command Reference

All commands run from the project root unless noted otherwise.
ENV = dev | stage | prod

---

## 🐳 Docker — Start / Stop / Rebuild

| Command | What it does |
|---|---|
| `bash deploy/compose/start.sh dev up -d` | Start all dev services (DB + cache + storage + app). App rebuilds from source. |
| `bash deploy/compose/start.sh dev down` | Stop all dev services (containers removed, volumes preserved) |
| `bash deploy/compose/start.sh dev restart` | Restart all dev services |
| `bash deploy/compose/start.sh stage up -d` | Start staging services (pulls image from Docker Hub) |
| `bash deploy/compose/start.sh prod up -d` | Start production services (pulls image from Docker Hub) |
| `docker compose -f deploy/compose/dev/docker-compose.app.yml logs -f` | Tail app logs in real time |
| `docker compose -f deploy/compose/dev/docker-compose.app.yml logs -f app` | Tail app container logs only |
| `docker compose -f deploy/compose/dev/docker-compose.app.yml ps` | Check service health status |
| `docker compose -f deploy/compose/dev/docker-compose.infra.yml ps` | Check DB + Valkey + MinIO health |

---

## 🧹 Docker — Clean / Clear / Reset

> ⚠ These commands are destructive. Read carefully before running.

| Command | What it does | Data lost? |
|---|---|---|
| `bash deploy/compose/start.sh dev down` | Stop + remove containers | ❌ No (volumes kept) |
| `bash deploy/compose/start.sh dev down --volumes` | Stop + remove containers + volumes | ✅ YES — all DB data |
| `docker compose -f deploy/compose/dev/docker-compose.app.yml build --no-cache` | Rebuild app image from scratch (ignores layer cache) | ❌ No |
| `docker builder prune -f` | Remove all dangling build cache | ❌ No |
| `docker builder prune -a -f` | Remove ALL build cache (free up disk space) | ❌ No |
| `docker system prune -f` | Remove stopped containers + dangling images + cache | ❌ No |
| `docker system prune -a -f` | Remove ALL unused images + containers + cache | ❌ No |
| `docker system prune -a -f --volumes` | Remove everything including volumes | ✅ YES — all data |
| `docker volume rm cuelane_dev_postgres_data` | Remove dev PostgreSQL volume only | ✅ YES — dev DB data |
| `docker volume rm cuelane_dev_valkey_data` | Remove dev Valkey volume only | ✅ YES — dev cache |
| `docker volume rm cuelane_dev_minio_data` | Remove dev MinIO volume only | ✅ YES — dev files |
| `docker volume ls` | List all Docker volumes | — |
| `docker image ls` | List all Docker images | — |
| `docker image prune -f` | Remove all dangling images | ❌ No |
| `docker image rm cuelane:dev-latest` | Remove specific image | ❌ No |

**Full dev environment reset (nuclear — wipes all dev data and rebuilds):**
```bash
bash deploy/compose/start.sh dev down --volumes   # stop + remove volumes
docker builder prune -f                            # clear build cache
bash deploy/compose/start.sh dev up -d             # rebuild + restart
pnpm db:migrate                                    # re-run migrations
pnpm db:seed                                       # re-seed (creates webmaster account)
```

---

## 📦 Docker — Image Build & Push (Manual Pipeline)

| Command | What it does |
|---|---|
| `bash deploy/compose/push.sh dev` | Build app image from source, push dev tags to Docker Hub |
| `bash deploy/compose/push.sh staging` | Re-tag last dev image as staging, push to Docker Hub |
| `bash deploy/compose/push.sh prod` | Re-tag last staging image as production, push to Docker Hub |
| `docker pull bonitobonita24/cuelane:staging-latest` | Pull staging image on staging server |
| `docker pull bonitobonita24/cuelane:latest` | Pull prod image on production server |

**Tag format:**
- `:dev-latest` — latest dev build (mutable)
- `:dev-sha-{hash}` — specific dev commit (immutable)
- `:staging-latest` — latest promoted to staging (mutable)
- `:staging-sha-{hash}` — specific staging commit (immutable)
- `:latest` — current production (mutable)
- `:prod-sha-{hash}` — specific production commit (immutable)

**Rollback:** change image tag in docker-compose.app.yml → `docker compose up -d`

---

## 🗄️ Database

| Command | What it does |
|---|---|
| `pnpm db:migrate` | Run all pending Prisma migrations |
| `pnpm db:generate` | Regenerate Prisma client after schema change |
| `pnpm db:seed` | Run seed script — creates webmaster account + demo data |
| `pnpm db:reset` | Drop + recreate + migrate + seed (**dev only** — destroys all dev data) |
| `pnpm db:studio` | Open Prisma Studio at http://localhost:41726 (visual DB browser) |
| `pnpm db:migrate --create-only` | Create migration file without running it |
| `pnpm db:migrate deploy` | Run migrations on staging/prod (safe — no data loss) |

**First admin account** (created by `pnpm db:seed`):
| Field | Value |
|-------|-------|
| Username | `webmaster` |
| Password | `[22-char generated — stored in CREDENTIALS.md under "First Admin Account"]` |
| URL | http://localhost:41716/login |

⚠ Change the webmaster password immediately after first production login.

---

## 🧪 Testing

| Command | What it does |
|---|---|
| `pnpm test` | Run all tests (unit + integration) |
| `pnpm test --watch` | Watch mode (re-runs on file change) |
| `pnpm test --coverage` | With coverage report |
| `pnpm test --passWithNoTests` | No-fail if no test files yet |

---

## 🔍 Code Quality

| Command | What it does |
|---|---|
| `pnpm lint` | ESLint across all packages |
| `pnpm lint --fix` | Auto-fix lint issues |
| `pnpm typecheck` | TypeScript type check (tsc --noEmit) |
| `pnpm format` | Prettier format all files |
| `pnpm build` | Full production build via Turborepo |
| `pnpm audit --audit-level=high` | Dependency CVE scan |
| `pnpm audit --fix` | Auto-fix CVEs where possible |

---

## ⚙️ Governance & Validation

| Command | What it does |
|---|---|
| `pnpm tools:validate-inputs` | Validate inputs.yml against schema |
| `pnpm tools:check-env` | Check all required env vars are set |
| `pnpm tools:check-product-sync` | Validate PRODUCT.md ↔ inputs.yml alignment + private tag check |
| `pnpm tools:hydration-lint` | Check for SSR hydration mismatches |
| `bash scripts/lint-deploy.sh deploy/compose` | Pre-deploy footgun gate (C1–C8 checks) |
| `bash scripts/spec-gap-check.sh --report-only` | PRODUCT.md ↔ schema ↔ implementation gap check |
| `bash scripts/sync-context.sh` | Refresh CLAUDE.md live-state block from STATE.md |

---

## 🌿 Git Workflow (Rule 23)

| Command | What it does |
|---|---|
| `git checkout -b feat/{slug}` | Create feature branch before any work |
| `git add -A && git commit -m "feat(module): description"` | Atomic conventional commit |
| `git checkout main && git merge --squash feat/{slug}` | Squash-merge to main |
| `git branch -d feat/{slug}` | Delete feature branch after merge |
| `git rev-parse --short HEAD` | Get short SHA (used in image tags) |

---

## 🤖 AI Agent Triggers

| What to say in Claude Code | What it does |
|---|---|
| `Feature Update` | Start Phase 7 — implement a PRODUCT.md change |
| `Start Phase 8` | Begin iterative buildout loop |
| `Resume Session` + 3 docs | Resume from STATE.md position |
| `Governance Sync` + 9 docs | Reconcile code ↔ governance docs |
| `Governance Retro` | Run retrospective on last session |

---

## 🔌 Dev Services — URLs

| Service | URL | Credentials |
|---|---|---|
| App | http://localhost:41716 | — |
| pgAdmin | http://localhost:41713 | See CREDENTIALS.md |
| MinIO Console | http://localhost:41710 | See CREDENTIALS.md |
| MailHog | http://localhost:41712 | No auth |
| Prisma Studio | http://localhost:41726 | No auth |

> All ports are in `.env.dev` — run `grep _PORT .env.dev` to see them all.

---

## 🔐 Credentials & Secrets

| Command | What it does |
|---|---|
| `cat CREDENTIALS.md` | View all credentials (gitignored — safe to view locally) |
| `grep -i password CREDENTIALS.md` | Quick lookup of all passwords |
| `openssl rand -base64 32` | Generate a strong 32-char secret |
| `openssl rand -hex 24` | Generate a strong 48-char hex secret |
| `openssl rand -base64 32 \| tr -d '\n' \| head -c 22` | Generate a strong 22-char mixed password |
| `git status \| grep CREDENTIALS` | Verify CREDENTIALS.md is NOT tracked by git |
| `git rm --cached CREDENTIALS.md` | Untrack CREDENTIALS.md if accidentally committed |

> ⚠ CREDENTIALS.md is gitignored. If others clone your repo they will NOT see it.
> They must run Phase 3 to generate their own credentials from .env.example.
