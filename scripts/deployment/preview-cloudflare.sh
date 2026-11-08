#!/usr/bin/env bash
set -euo pipefail
if [[ -n "${WORKERS_CI_BRANCH:-}" && -n "${ASTRO_DEPLOY_BRANCH:-}" && "$WORKERS_CI_BRANCH" != "$ASTRO_DEPLOY_BRANCH" ]]; then
  echo 'Conflicting native and local GitFlow branch signals' >&2; exit 1
fi
branch="${WORKERS_CI_BRANCH:-${ASTRO_DEPLOY_BRANCH:-}}"
sha=$(git rev-parse HEAD)
case "$branch" in
  develop)
    python3 scripts/deployment/artifact.py guard --branch develop --sha "$sha"
    python3 scripts/deployment/artifact.py verify-artifact --branch develop --sha "$sha" --directory .cloudflare-site
    timeout 300s node infra/deployment/node_modules/wrangler/bin/wrangler.js preview --name develop --config .cloudflare-wrangler.develop.json --ignore-base-config --message "$sha" --json > .cloudflare-preview-result.json
    python3 scripts/deployment/record-preview.py
    ;;
  feature/*|fix/*|hotfix/*|release/*)
    if [[ -n "${GITHUB_REPOSITORY:-}" && "$GITHUB_REPOSITORY" != "martletdesign/astro" ]]; then
      echo 'Unexpected GitHub repository identity for candidate preview' >&2; exit 1
    fi
    [[ -s .cloudflare-site/index.html && -s .cloudflare-feature-wrangler.json ]] || { echo 'Missing built candidate preview'; exit 1; }
    preview_name=$(node scripts/deployment/feature-preview-config.mjs name "$branch")
    timeout 300s node infra/deployment/node_modules/wrangler/bin/wrangler.js preview --name "$preview_name" --config .cloudflare-feature-wrangler.json --ignore-base-config --message "$sha" --json | tee .cloudflare-preview-result.json
    ;;
  *) echo 'Preview delivery only supports develop and candidate branches' >&2; exit 1 ;;
esac
