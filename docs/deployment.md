# Native Cloudflare static reference

The reference is built from this repository's shipped Astro starter, public exact Core pin, and accepted source package. No sibling checkout, Ruby renderer, competing foundation, R2 writer, or deployed secret is required. The first Worker/domain provisioning is performed separately by the coordinator; these scripts refuse unknown source authority.

Worker: `martletdesign-astro-reference`. Production: `https://astro.martletdesign.dev`. Development: `https://develop-martletdesign-astro-reference.k3jph.workers.dev`.

Native Git connection commands:

- Build: `bash scripts/deployment/build-cloudflare.sh`
- Production deploy: `bash scripts/deployment/deploy-cloudflare.sh`
- Preview deploy: `bash scripts/deployment/preview-cloudflare.sh`
- Production branch `main`; preview branch `develop` only.

The native `WORKERS_CI_BRANCH`/`WORKERS_CI_COMMIT_SHA` are checked against the checkout and current accepted GitHub ref. Local coordinator execution supplies `ASTRO_DEPLOY_BRANCH` explicitly. A superseded SHA fails closed. No PR approvals or historical CI reconstruction is consulted: branch acceptance is GitHub's responsibility.

The build copies the exact Git source, installs the local source archive and integrity-pinned public Core, builds root and `/preview/`, and runs existing canonical50/science and HTML/link verification. It records source/tree/package/Core/toolchain identities, a sorted SHA256 inventory, and native configuration. Development is noindex. Delivery is native static assets with no runtime bindings or application secrets.

The pinned Wrangler helper checks an existing Worker's empty runtime bindings, records its current version, rechecks accepted source immediately before upload, and verifies every public payload byte with bounded4-request concurrency and deadlines. On failure it restores only its own replacement while preserving a newer actor. A successful build is not deployment evidence. Deployment receipts must contain the actual sourceSHA and live verification results. Initial provisioning must establish a known rollback revision before normal production deployment.

Advanced archival remains disabled. Static delivery makes no immutability or administrator anti-rollback claim. Existing historical archive rehearsals remain available without gating ordinary deployment.
