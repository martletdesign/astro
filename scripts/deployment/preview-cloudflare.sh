#!/usr/bin/env bash
set -euo pipefail
if [[ -n "${WORKERS_CI_BRANCH:-}" && -n "${ASTRO_DEPLOY_BRANCH:-}" && "$WORKERS_CI_BRANCH" != "$ASTRO_DEPLOY_BRANCH" ]]; then
  echo 'Conflicting native and local GitFlow branch signals' >&2; exit 1
fi
branch="${WORKERS_CI_BRANCH:-${ASTRO_DEPLOY_BRANCH:-}}"
[[ "$branch" = develop ]] || { echo 'Preview delivery requires accepted develop' >&2; exit 1; }
sha=$(git rev-parse HEAD)
python3 scripts/deployment/artifact.py guard --branch develop --sha "$sha"
python3 scripts/deployment/artifact.py verify-artifact --branch develop --sha "$sha" --directory .cloudflare-site
timeout 300s node infra/deployment/node_modules/wrangler/bin/wrangler.js preview --name develop --config .cloudflare-wrangler.develop.json --ignore-base-config --message "$sha" --json > .cloudflare-preview-result.json
python3 scripts/deployment/record-preview.py
