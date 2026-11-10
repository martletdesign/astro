# Changelog

## 3.0.0

- **Breaking:** require `@martlet/core@^3.0.0`; Core 2 is no longer supported. Update canonical stylesheet imports from `reference.css` to `martlet.css`.
- Retain exported Astro component names, props, and slots, with Astro 5–7 support.
- Keep the reference application in `reference/` and the clonable starter in its independent repository; neither is bundled into the npm component package.
- Deliver the reviewed dashboards, scientific workspace, article metadata, and keyboard-navigation fixes through the shared Core stylesheet and framework markup.
- Use standard Astro reference builds and the existing trusted-publisher release workflow.

## 2.1.0 — 2026-11-09

- Add an optional external stylesheet URL to the base, article, documentation, and landing layouts so references can share Core CSS.
- Require Core 2.3.0, which exports the canonical Astro/Jekyll reference stylesheets.

## 2.0.3

- Restore the canonical single `nav.page-index` contents region instead of a nested navigation wrapper that draws a second border.
- Use the native `p.eyebrow` heading and `li.page-index__section` items while retaining the existing section links and destinations.

## 2.0.2

- Replace the generic starter shell with native Astro compositions following the accepted Martlet Jekyll visual baseline.
- Include the approved responsive signature and section imagery, image attribution, and compact page mastheads.
- Give the reference site a real root homepage, with the example catalog kept at `/examples/`.
- Apply the family’s navigation, typography, colors, footer, and canonical example compositions to the shipped starter and hosted reference.
- Retain the existing component APIs and the 50 canonical examples’ content and interactions.

## 2.0.1

- Require Core 2.2.4 so native input placeholders retain readable contrast in both appearances.
- Give the analytics table scroll region its own accessible name.
- Fix independently installed dashboard family tokens and source styling without build-only environment variables.
- Correct installation and publication guidance for the published Core integration.
- Complete stage-only trusted publication and verified GitHub source releases.
- Add native static reference delivery with accepted-source and artifact verification.

## 2.0.0 — core migration candidate

- Prepare the independent core peer and versioned documentation archive; publication remains disabled pending immutable storage verification.

## 1.2.2 — adoption repair preview

- Honor native button type without duplicate attributes. Add a complete simulated form starter and rendered regression assertions; document exact starter retrieval. Pair with core ^2.2.2.

## Unreleased — source consolidation

- Add versioned source guidance, optional source roles, and contents/footer pattern support. Existing defaults remain compatible; see docs/consolidation.md.


## 1.1.0

- Add structural primitives, responsive site chrome, and article, landing, and documentation layouts.
- Expand the neutral starter with complete page and layout examples.
- Require core 2.1 for optional layout styling; retain existing component APIs.
- Record extraction provenance and test both appearances, narrow and nested layouts, source order, and enlarged text.

## 1.0.0

Initial published Astro wrapper and neutral starter.
