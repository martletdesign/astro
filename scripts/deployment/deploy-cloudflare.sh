#!/usr/bin/env bash
set -euo pipefail
if [[ -n "${WORKERS_CI_BRANCH:-}" && -n "${ASTRO_DEPLOY_BRANCH:-}" && "$WORKERS_CI_BRANCH" != "$ASTRO_DEPLOY_BRANCH" ]]; then
  echo 'Conflicting native and local GitFlow branch signals' >&2; exit 1
fi
branch="${WORKERS_CI_BRANCH:-${ASTRO_DEPLOY_BRANCH:-}}"
[[ "$branch" = main ]] || { echo 'Production requires main' >&2; exit 1; }
sha=$(git rev-parse HEAD)
python3 scripts/deployment/artifact.py verify-artifact --branch main --sha "$sha" --directory .cloudflare-site
timeout 900s python3 scripts/deployment/deploy.py --branch main --sha "$sha" --directory .cloudflare-site --receipt .cloudflare-production-receipt.json
