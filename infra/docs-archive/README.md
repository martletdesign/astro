# Documentation archive gateway — nonproduction candidate

This draft implements an R2-backed write-once gateway and integrity-checking reader. It is **not production-ready** and is not wired to the release workflow. `scripts/docs-versions/verify-published.mjs` must continue to block releases. The starter documentation is not the complete reference site.

The client verifies an existing local snapshot against its expected manifest SHA-256, uploads each object using authenticated PUT and uploads `manifest.json` last. R2 `If-None-Match: *` conditional creation rejects replacement. The gateway verifies all listed object bytes and lengths before creating the manifest, and exposes only listed files after commit. Public reads verify bytes again before serving. The private GET is restricted to the writer and enables a safe retry only when the existing object's bytes exactly match. An unexpected byte or failed write is a hard failure: there is no automatic deletion or overwrite.

The public client independently downloads every file and validates its hash against a caller-supplied trusted manifest digest. A digest returned by the gateway alone is **not** a trust anchor. The independently authenticated, append-only catalog of manifests, protected latest-stable pointer and rollback protocol are not yet implemented. The candidate does not support a deployment subpath and has not been checked against a real Cloudflare account. Do not activate releases or deploy this adapter until those gaps and a full review are complete.

## Required production controls before any future activation

- Use one dedicated private R2 bucket for each independent archive authority. Only this reviewed Worker may write to it; do not expose S3 or other Worker write/delete credentials. Separate and tightly control administrator rights. R2 conditional requests protect this gateway's writes, but R2 is not a WORM store: a privileged administrator or direct bucket credential can change or delete data. External append-only trust and monitoring must detect that.
- Create a high-entropy `ARCHIVE_WRITE_TOKEN` as a Worker secret and release workflow secret only after authorization; never put it in source or logs. Restrict access to the secret and Worker deployment authority. This example token mechanism and rotation/revocation policy require security review; no secret is configured by this proposal.
- Supply an independently authenticated baseline catalog, and retain every historical manifest digest outside the bucket under protected immutable release identities. Before advancing a catalog, verify previous history and all remote bytes. Explicitly decide on authenticated catalog publication, rollback and atomic promotion; the current code does not implement them.
- Configure a dedicated, same-origin HTTPS route and version/subpath handling, validate caching and access policies, and test real R2 consistency, administrator changes, concurrency, failed writes and recovery. No Cloudflare configuration or DNS is changed here.
- Preserve the existing disabled tag-release workflow and its fail-closed archive verification. Full canonical content, accessible selector, historical serving and no-JavaScript navigation need separate verification.

## Local verification

`npm test` at the repository root covers authorization, replacement, incomplete uploads, corrupt bytes, wrong trust anchor and retry after interruption with an in-memory R2 test double. To test Cloudflare's local Workers runtime and R2 adapter, run `npm ci --prefix infra/docs-archive` and `npm test --prefix infra/docs-archive`. This is local emulation, not a live R2 or OIDC test.

Cloudflare's [R2 Workers API reference](https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/docs/r2/api/workers/workers-api-reference.mdx) documents conditional `put` and strongly consistent writes. Production bucket isolation and independent history remain operational prerequisites.
