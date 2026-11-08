# Martlet canonical Astro source baseline (content neutral)

This **source specimen**, not the deployable public reference application, starts from the real Astro implementation of `jameshoward.us`. It is isolated from the `starter/` project. Once integrated into `develop`, the existing Cloudflare development preview builds this specimen; `main` remains on the pre-existing release build.

Origin repository: `k3jph/k3jph.github.io`. Pinned origin commit: `d52c7193ea9090ed11fdc8b3f2fd454c0e77d50c`.

The files `src/styles/{tokens,global,content,document-pages}.css` and `src/lib/markdown.ts` are copied without style changes. `src/components/PageIntro.astro` is copied without style changes. The canonical homepage's original scoped `<style>` block is retained verbatim; the markup, header/footer site data, and images contain fictional or abstract placeholders. Header/footer inline styles and navigation interaction code are preserved, with links and identity substituted. The hero photo is an original source asset retained solely as a layout/contrast reference. This is not a duplicate personal website.

## Run

From this directory: `npm install --ignore-scripts`, then `npm run build` or `npm run dev`. This initial baseline intentionally pins the same historical `@martlet/astro@1.0.0` and `@martlet/theme@2.0.0` as the source; they are **measurement dependencies**, not the future Core architecture. Do not switch to the experimental v2 packages until the extracted grammar is verified.

Routes: `/` (original home composition), `/article/` (editorial content), `/document/` (documentary index). No dashboard is asserted to exist in the original source. It will be designed as an explicit language extension after the baseline is accepted.

## Extraction boundary

1. Compare rendered typography, spacing, layout, navigation and responsive behavior with the source site at the pinned commit.
2. Preserve **blue, gold, and white**; distinguish source website colors from Martlet's intentional stronger gold/bronze/brown composition. Do not replace blue wholesale.
3. The original website's light and dark *regions* are structural; no global dark-mode switch is presumed. A configurable palette and optional application appearance presets are separate future language capabilities.
4. Extract standard presentation and reusable behavior into `@martlet/core` and `@martlet/astro`. The final consumer reference must not need this source CSS or private site-specific styling.
5. All changes target feature branches and `develop` only. Never tag, publish, or merge to `main` during this work.

Source blobs: {
  "global": "f029a14eb593f8a16cf2f1fa0d50a62968a5be2c",
  "tokens": "bdf2d28b8d8462b6675b6d8b9fe016381380d3aa",
  "content": "14077a2d9d12e4bddb592415e2b4506625a77c41",
  "documents": "48f61ada079f03ef9e7b121e04e1355bd711042f",
  "header": "0abf653223d9ace8960ba8f3903cf508ebdd072e",
  "footer": "b04eda1d1807bd2fbdbaf4952a9ad28603a187b9",
  "intro": "04d847a56efda0b490db7e9519d60a14ab89c9e2",
  "markdown": "b2a59591c8f9485f625f1771dc94073b2e25c265",
  "home": "45d09a88d7339687309a88f3421bb9f6c777a2fe"
}

## Cloudflare preview

The accepted `develop` build uses `scripts/deployment/build-neutral-baseline.mjs` to serve this specimen at the existing preview Worker (no custom production domain, no npm publication). The `main` builder remains unchanged. Candidate feature branches do not deploy. An advisory PR check builds the actual payload before integration; the existing Cloudflare Git connection must then run on `develop`. No live Cloudflare deployment is claimed by PR CI alone.
