# Staged npm publication and source releases

`@martlet/astro@2.0.0` is genuinely published. The source manifest remains `private:true` as an accidental-publication guard; the workflow exports the exact accepted source and changes only that flag before packing.

## Publication

1. Accept compatible Core changes first, then Astro through `develop` and a release branch into `main`. The canonical GitFlow policy requires one fast check, no human review gate; extended suites are advisory.
2. Compute the normalized package archive with Node 24.19.0 and npm 11.15.0. Dispatch existing `stage.yml` on `main` with its exact SHA, archive SHA-256 and intended `latest`/`next` tag. It checks current main, exact package identity and registry absence before staging.
3. The existing trusted publisher is repository `martletdesign/astro`, workflow `stage.yml`, environment `astro-production-release`, **stage-only**. Preserve 2FA. An npm owner approves the genuine stage identity; never approve a bootstrap sentinel. No broad token or direct publication is permitted.
4. Verify registry version, tarball bytes, signatures and SLSA provenance. Its actual source is the accepted main commit and `stage.yml` dispatched on `refs/heads/main`.
5. Create the new protected `v` + exact package version tag on eligible main history only after publication and production verification. Never overwrite a tag or release. Existing `tag-release.yml` verifies exact published bytes and provenance and then creates the absent GitHub source Release with the package archive and `SHA256SUMS`. It never publishes to npm.

Registry uncertainty, provenance mismatch, source mismatch, or an existing GitHub Release fails closed. Repair the cause rather than republishing an existing version. Advanced R2 archival remains disabled and is not a prerequisite for static reference delivery or this source Release.

See [GitFlow acceptance](https://github.com/k3jph/design-workbench/blob/develop/docs/GITFLOW-ACCEPTANCE.md) and [native delivery](deployment.md).
