#!/usr/bin/env bash
set -euo pipefail
if [[ -n "${WORKERS_CI_BRANCH:-}" && -n "${ASTRO_DEPLOY_BRANCH:-}" && "$WORKERS_CI_BRANCH" != "$ASTRO_DEPLOY_BRANCH" ]]; then
  echo 'Conflicting native and local GitFlow branch signals' >&2; exit 1
fi
branch="${WORKERS_CI_BRANCH:-${ASTRO_DEPLOY_BRANCH:-}}"
[[ "$branch" = main || "$branch" = develop ]] || { echo 'Only accepted main/develop builds may deploy' >&2; exit 1; }
sha=$(git rev-parse HEAD)
python3 scripts/deployment/artifact.py guard --branch "$branch" --sha "$sha"
if [[ "$branch" = develop ]]; then
  CANONICAL_SOURCE_REPO="k3jph/k3jph.github.io" CANONICAL_SOURCE_SHA="d52c7193ea9090ed11fdc8b3f2fd454c0e77d50c" timeout 600s npm exec --yes --package=npm@11.15.0 -- node scripts/deployment/build-neutral-baseline.mjs
else
  timeout 600s npm exec --yes --package=npm@11.15.0 -- node scripts/deployment/build-reference.mjs
fi
python3 scripts/deployment/artifact.py finalize --branch "$branch" --sha "$sha" --directory .cloudflare-site
npm ci --prefix infra/deployment --ignore-scripts --no-audit --no-fund
python3 scripts/deployment/artifact.py config --branch "$branch" --sha "$sha" --directory .cloudflare-site --output ".cloudflare-wrangler.$branch.json"
