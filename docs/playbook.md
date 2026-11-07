# Extract a design system and migrate its consumers

## Ownership

| Repository | Responsibility |
| --- | --- |
| `martletdesign/core` | Authoritative JSON, color roles, typography roles, layout dimensions, shape, depth, motion, optional CSS and font dependencies |
| `martletdesign/astro` | Reusable document shell and Astro components; neutral starter |
| `k3jph/k3jph.github.io` | Personal content, branding, navigation, metadata, consent, seasonal behavior, and page composition |
| `martletdesign/core` | Theme demonstrations and application-specific port generators; consumes the core |

The npm package names are `@martlet/core` and `@martlet/astro`. GitHub ownership and npm scope are independent.

## 1. Audit the originating site

Use the originating website, not its theme demonstration, as the design source. Record the repository and commit. Capture serif, sans, display, and monospace roles separately. Extract spacing, reading/content widths, corners, borders, shadows, focus, and motion. Preserve current content, routes, metadata, behavior, and brand assets as site responsibilities.

Martlet's source is jameshoward.us at commit 471abfe. Cambo is the serif; Lato the sans; Cinzel the display accent. IBM Plex Mono is the redistributable monospace default; Berkeley Mono remains an optional personal override. Krigsvold must be audited independently and use its own roles, including the agreed Roboto Mono choice.

## 2. Establish the core

Edit `source.json` in the npm repository. It is authoritative; `dist/` is generated. Separate historical/reference colors, semantic Light/Dark application colors, and originating-site identity tokens. Do not equate those different roles simply because their hues are similar.

Keep color-only CSS free of typography, font loading, layout, and global rules. Offer foundation variables, typography, fonts, and components as separate imports. Keep source JSON and ESM/CommonJS exports available to non-web generators. Record applied, optional, separately configured, and unsupported capabilities for each host.

Font assets resolve through exact Fontsource dependencies and are bundled by each site's normal build. Retain font licenses. Never distribute proprietary font files. Use semantic font variables for personal overrides.

## 3. Add the framework package

Depend on the core as a peer, with an explicit supported version range. Keep shared components free of site identity. Provide slots for navigation, footer, head metadata, consent, and scripts. Reuse existing site components for specialized functions. Keep starter content separate from maintained library code.

## 4. Release and migrate in order

Build/test/pack the core, then test/pack the Astro package. Install both actual tarballs together in a neutral starter and in both existing sites. Before registry publication, commit versioned archives under each consumer's `vendor/` and use `file:vendor/...` dependencies with lockfile integrity. They are release snapshots, not editable sources. No build may depend on a sibling checkout or an unpublished registry version.

After publication under the authorized npm scope, switch dependencies to released versions and regenerate lockfiles. Remove vendor archives only after clean installs succeed. Updating packages should be deliberate; do not load a moving main branch or CDN latest URL in production.

Replace local design literals with references to the package. An optional alias stylesheet keeps an existing site's variable names without duplicating their values. Remove alternative font declarations from the demonstration site. Import the same Astro document shell in both consumers. Application-port generators must read the installed core rather than regenerate it downstream.

## 5. Verify

- Compare original Light/Dark color exports against the v1 fixture.
- Verify each optional import and every font dependency resolves from a packed installation.
- Build the neutral starter and both consumer sites, including their existing checks.
- Compare route inventories and main content before and after the originating-site migration.
- Check document title, canonical/robots metadata, feeds, consent controls, and site scripts.
- Check serif/sans/display/monospace rendering, Light/Dark specimens, focus, reduced motion, and narrow viewports.
- Confirm production downloads reference the actual current archive names.

## 6. Repeat for Krigsvold

Keep the same ownership and package boundaries, but extract its own design. Migrate krigsvold.org from Jekyll only after the Martlet consumers are verified. Preserve existing URLs and content as a separate migration requirement. No Krigsvold repository is changed during the Martlet pilot.

## Current publication authority

The Core integration shipped in Astro 2.0.0. Local tarballs remain useful for candidate verification; they are not required for ordinary installation. Keep original extraction decisions above as historical rationale. Use the [current release procedure](releasing.md) and canonical GitFlow acceptance; do not reconstruct historical reviews or CI in deployment.
