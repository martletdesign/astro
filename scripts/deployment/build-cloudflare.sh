#!/usr/bin/env bash
set -euo pipefail
if [[ -n "${WORKERS_CI_BRANCH:-}" && -n "${ASTRO_DEPLOY_BRANCH:-}" && "$WORKERS_CI_BRANCH" != "$ASTRO_DEPLOY_BRANCH" ]]; then
  echo 'Conflicting native and local GitFlow branch signals' >&2; exit 1
fi
branch="${WORKERS_CI_BRANCH:-${ASTRO_DEPLOY_BRANCH:-}}"
sha=$(git rev-parse HEAD)
if [[ -n "${WORKERS_CI_COMMIT_SHA:-}" && "$WORKERS_CI_COMMIT_SHA" != "$sha" ]]; then
  echo 'Cloudflare source commit differs from checkout' >&2; exit 1
fi
case "$branch" in
  main|develop)
    python3 scripts/deployment/artifact.py guard --branch "$branch" --sha "$sha"
    timeout 600s npm exec --yes --package=npm@11.15.0 -- node scripts/deployment/build-reference.mjs
    python3 scripts/deployment/artifact.py finalize --branch "$branch" --sha "$sha" --directory .cloudflare-site
    npm ci --prefix infra/deployment --ignore-scripts --no-audit --no-fund
    python3 scripts/deployment/artifact.py config --branch "$branch" --sha "$sha" --directory .cloudflare-site --output ".cloudflare-wrangler.$branch.json"
    ;;
  feature/*|fix/*|hotfix/*|release/*)
    if [[ -n "${GITHUB_REPOSITORY:-}" && "$GITHUB_REPOSITORY" != "martletdesign/astro" ]]; then
      echo 'Unexpected GitHub repository identity for candidate preview' >&2; exit 1
    fi
    if [[ "$branch" = "feature/martlet-canonical-neutral-baseline" ]]; then
      CANONICAL_SOURCE_REPO="k3jph/k3jph.github.io" CANONICAL_SOURCE_SHA="d52c7193ea9090ed11fdc8b3f2fd454c0e77d50c" \
        timeout 600s npm exec --yes --package=npm@11.15.0 -- node scripts/deployment/build-neutral-baseline.mjs
    else
      timeout 600s npm exec --yes --package=npm@11.15.0 -- node scripts/deployment/build-reference.mjs
    fi
    printf 'User-agent: *\nDisallow: /\n' > .cloudflare-site/robots.txt
    printf '/*\n  X-Robots-Tag: noindex, nofollow, noarchive\n  X-Content-Type-Options: nosniff\n' > .cloudflare-site/_headers
    npm ci --prefix infra/deployment --ignore-scripts --no-audit --no-fund
    node scripts/deployment/feature-preview-config.mjs config "$branch"
    ;;
  *) echo 'Unknown Cloudflare build branch' >&2; exit 1 ;;
esac
