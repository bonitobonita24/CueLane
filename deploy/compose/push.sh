#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# CueLane — push.sh: manual image promotion pipeline
#
# Stages:
#   dev     Build from source, tag dev-{sha} + dev-latest, push to Docker Hub
#   staging Re-tag last dev image as staging-{sha} + staging-latest, push
#   prod    Re-tag last staging image as prod-{sha} + latest, push
#
# Usage:
#   bash deploy/compose/push.sh dev       # build + push dev image
#   bash deploy/compose/push.sh staging   # promote dev → staging
#   bash deploy/compose/push.sh prod      # promote staging → prod (CAREFUL)
#
# Required: DOCKERHUB_USERNAME env var or Docker Hub login in ~/.docker/config.json
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

APP_NAME="cuelane"
IMAGE_NAME="bonitobonita24/cuelane"
WORKER_IMAGE="bonitobonita24/cuelane-worker"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# ── Docker login guard (C6) ───────────────────────────────────────────────────
if ! docker info --format '{{.RegistryConfig.IndexConfigs}}' 2>/dev/null | grep -q '"https://index.docker.io/v1/"'; then
  echo "⚠  Not logged in to Docker Hub. Attempting login..."
  docker login || { echo "✗ Docker Hub login failed. Aborting."; exit 1; }
fi

# ── Helpers ───────────────────────────────────────────────────────────────────
SHA="$(git -C "$REPO_ROOT" rev-parse --short HEAD)"
TARGET="${1:-}"

push_tags() {
  local -a TAGS=("$@")
  for t in "${TAGS[@]}"; do
    echo "  → Pushing $t"
    docker push "$t"
  done
}

# ── Dev-freshness coupling (fleet standard: ~/.claude/rules/deploy-discipline.md) ──
# A staging/prod ship is NOT complete until local dev is rebuilt off the same main/sha —
# app AND worker (an app-only --build leaves the worker stale). Dev serves a prebuilt image
# with no source bind-mount, so code only appears on REBUILD; a ship recreates staging/prod
# but never touches dev, so dev would silently serve STALE code. Set DEV_REBUILD=0 to skip
# (e.g. "just promote, no dev rebuild").
DEV_REBUILD="${DEV_REBUILD:-1}"

rebuild_local_dev() {
  if [[ "$DEV_REBUILD" != "1" ]]; then
    echo "⏭  DEV_REBUILD=0 — skipping coupled local-dev rebuild (dev may now be STALE vs main)."
    return 0
  fi
  echo "=== Coupled step: rebuilding local dev off main (app + worker, sha=$SHA) ==="
  bash "$REPO_ROOT/deploy/compose/start.sh" dev up -d --build
  echo "=== Verifying dev freshness vs main ==="
  if command -v dev-freshness-check.sh >/dev/null 2>&1; then
    dev-freshness-check.sh "$REPO_ROOT" || {
      echo "✗ Local dev is BEHIND main after rebuild — investigate before considering the ship complete." >&2
      return 2
    }
  else
    echo "⚠  dev-freshness-check.sh not on PATH — skipped freshness verification."
  fi
  echo "✓ Local dev rebuilt + verified fresh vs main."
}

# ── Stages ───────────────────────────────────────────────────────────────────
case "$TARGET" in
  dev)
    echo "=== Building $APP_NAME web image (sha=$SHA) ==="
    docker buildx build \
      --platform linux/amd64,linux/arm64 \
      --file "$REPO_ROOT/apps/web/Dockerfile" \
      --tag "$IMAGE_NAME:dev-$SHA" \
      --tag "$IMAGE_NAME:dev-latest" \
      --push \
      "$REPO_ROOT"
    echo "✓ Web image pushed: $IMAGE_NAME:dev-$SHA + :dev-latest"

    echo "=== Building $APP_NAME worker image (sha=$SHA) ==="
    docker buildx build \
      --platform linux/amd64,linux/arm64 \
      --file "$REPO_ROOT/apps/worker/Dockerfile" \
      --tag "$WORKER_IMAGE:dev-$SHA" \
      --tag "$WORKER_IMAGE:dev-latest" \
      --push \
      "$REPO_ROOT"
    echo "✓ Worker image pushed: $WORKER_IMAGE:dev-$SHA + :dev-latest"
    ;;

  staging)
    echo "=== Promoting dev → staging (sha=$SHA) ==="
    docker pull "$IMAGE_NAME:dev-latest"
    docker tag "$IMAGE_NAME:dev-latest" "$IMAGE_NAME:staging-$SHA"
    docker tag "$IMAGE_NAME:dev-latest" "$IMAGE_NAME:staging-latest"
    push_tags "$IMAGE_NAME:staging-$SHA" "$IMAGE_NAME:staging-latest"
    echo "✓ Web staging image pushed: $IMAGE_NAME:staging-$SHA + :staging-latest"

    docker pull "$WORKER_IMAGE:dev-latest"
    docker tag "$WORKER_IMAGE:dev-latest" "$WORKER_IMAGE:staging-$SHA"
    docker tag "$WORKER_IMAGE:dev-latest" "$WORKER_IMAGE:staging-latest"
    push_tags "$WORKER_IMAGE:staging-$SHA" "$WORKER_IMAGE:staging-latest"
    echo "✓ Worker staging image pushed: $WORKER_IMAGE:staging-$SHA + :staging-latest"
    rebuild_local_dev
    ;;

  prod)
    echo "=== Promoting staging → PRODUCTION (sha=$SHA) ==="
    echo "⚠  This will push to :latest (the production tag). Are you sure? [y/N]"
    read -r CONFIRM
    [[ "$CONFIRM" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 0; }
    docker pull "$IMAGE_NAME:staging-latest"
    docker tag "$IMAGE_NAME:staging-latest" "$IMAGE_NAME:prod-$SHA"
    docker tag "$IMAGE_NAME:staging-latest" "$IMAGE_NAME:latest"
    push_tags "$IMAGE_NAME:prod-$SHA" "$IMAGE_NAME:latest"
    echo "✓ Web production image pushed: $IMAGE_NAME:prod-$SHA + :latest"

    docker pull "$WORKER_IMAGE:staging-latest"
    docker tag "$WORKER_IMAGE:staging-latest" "$WORKER_IMAGE:prod-$SHA"
    docker tag "$WORKER_IMAGE:staging-latest" "$WORKER_IMAGE:latest"
    push_tags "$WORKER_IMAGE:prod-$SHA" "$WORKER_IMAGE:latest"
    echo "✓ Worker production image pushed: $WORKER_IMAGE:prod-$SHA + :latest"
    echo "  Next: update APP_IMAGE_TAG in .env.prod and run:"
    echo "    bash deploy/compose/start.sh prod up -d"
    rebuild_local_dev
    ;;

  *)
    echo "Usage: $0 <dev|staging|prod>" >&2
    exit 1
    ;;
esac
