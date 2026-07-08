#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# CueLane — start.sh: convenience wrapper for docker compose across environments
#
# Usage:
#   bash deploy/compose/start.sh <ENV> [COMPOSE_ARGS...]
#   ENV = dev | stage | prod
#
# Examples:
#   bash deploy/compose/start.sh dev up -d            # start dev (builds app from source)
#   bash deploy/compose/start.sh dev down             # stop dev
#   bash deploy/compose/start.sh dev down --volumes   # stop + wipe dev volumes
#   bash deploy/compose/start.sh stage up -d          # start staging (pulls Docker Hub image)
#   bash deploy/compose/start.sh prod up -d           # start prod (pulls Docker Hub image)
#
# C7 compliance: COMPOSE_PROJECT_NAME is derived from the stack name per environment.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV="${1:-dev}"
shift || true  # remaining args passed to docker compose

case "$ENV" in
  dev)
    COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-cuelane_dev}"
    export COMPOSE_PROJECT_NAME
    # Dev: run infra + app together; app service uses build: (rebuilds from source)
    # --project-directory is required: Docker Compose v5 resolves --env-file and
    # relative build contexts (build.context: .) against the project directory,
    # which otherwise defaults to the first -f file's directory (deploy/compose/dev/),
    # not the repo root — causing a false "env file not found" and a wrong build context.
    exec docker compose \
      --project-name "$COMPOSE_PROJECT_NAME" \
      --project-directory "$REPO_ROOT" \
      -f "$SCRIPT_DIR/dev/docker-compose.infra.yml" \
      -f "$SCRIPT_DIR/dev/docker-compose.app.yml" \
      --env-file "$REPO_ROOT/.env.dev" \
      "$@"
    ;;
  stage|staging)
    COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-cuelane_staging}"
    export COMPOSE_PROJECT_NAME
    # Staging: app services only — infra is a separate pre-existing stack on the server
    exec docker compose \
      --project-name "$COMPOSE_PROJECT_NAME" \
      --project-directory "$REPO_ROOT" \
      -f "$SCRIPT_DIR/stage/docker-compose.app.yml" \
      --env-file "$REPO_ROOT/.env.staging" \
      "$@"
    ;;
  prod)
    COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-cuelane_prod}"
    export COMPOSE_PROJECT_NAME
    # Production: app services only — manual promotion, never auto-deployed
    exec docker compose \
      --project-name "$COMPOSE_PROJECT_NAME" \
      --project-directory "$REPO_ROOT" \
      -f "$SCRIPT_DIR/prod/docker-compose.app.yml" \
      --env-file "$REPO_ROOT/.env.prod" \
      "$@"
    ;;
  *)
    echo "Usage: $0 <dev|stage|prod> [docker compose args...]" >&2
    exit 1
    ;;
esac
