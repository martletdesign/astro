# Core dependency migration preview

This private candidate changes the peer and CSS imports from `@martlet/theme` to the separate, unpublished `@martlet/core` identity. Its `2.0.0` version is a proposed breaking-version boundary, not a published or reserved release. Old `@martlet/astro@1.2.2` and `@martlet/theme` remain unchanged; installing `/core` does not satisfy a `/theme` peer.

The review-only verification workflow builds the core source at `4bc45ff0bd1ee2e93ee61917b023f7b45686895f` and packs it locally. Verify its tarball hash against the separately reviewed core candidate before using it. The starter manifest names `/core` for the future; until a new package is approved and available it must be installed from the actual local tarball. No trusted-publisher, production or release workflow change is made here. Review the existing `docs/` as historical `/theme` guidance unless explicitly migrated; old links and immutable provenance must not be rewritten.

Do not publish this private candidate. Publication, selecting an actual version, downstream adoption and deployment need separate approvals after the new core package and its publisher identity are verified.

The hosted Martlet Astro 5 Chromium run exposed button contrast while enabling. The paired core contrast follow-up removes only the background transition; it changes the unpublished tarball bytes and remains a separate draft from the original migration candidate. The original core tarball was tested separately, and must not be confused with the corrected derivative.
