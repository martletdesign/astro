# Martlet — source-derived Astro reference

This is a **standalone Astro application**, not a special deployment of the component library. It is a content-neutral adaptation of [jameshoward.us](https://jameshoward.us/), with representative, fictional material. Its source stylesheet and layout treatment are retained for comparison while the reusable Martlet Core grammar is reconstructed.

## Clone, edit, run

```sh
git clone --branch feature/martlet-canonical-neutral-baseline https://github.com/martletdesign/astro.git
cd astro/reference-baseline
npm ci
npm run dev
```

Edit `src/pages/`, `src/components/`, and `public/`. To produce the same static site Cloudflare deploys:

```sh
npm run build
npm run preview
```

The build output is `dist/`. There are **no special build commands, signed manifests, hidden source exports, or GitHub/Cloudflare release dependencies** in this application. The ordinary `wrangler.json` supports optional Cloudflare Workers deployment with `npx wrangler preview` for branches. Do not deploy to production during this development phase.

**Temporary repository location:** We have not yet created a dedicated public site repository. This root-level Astro application lives in `reference-baseline/` inside the public Astro component repository so it can be developed on a feature branch without replacing the library's main branch. This is a working interim location, **not** the final public clone URL or an npm-published scaffolder.

## Design authority

- Canonical source: `k3jph/k3jph.github.io` pinned to `d52c7193ea9090ed11fdc8b3f2fd454c0e77d50c`.
- Retained source: `src/styles/{tokens,global,content,document-pages}.css`, `src/components/PageIntro.astro`, and the original homepage scoped CSS.
- Representative routes: `/`, `/article/`, and `/document/`.
- Martlet and Krigsvold both contain blue, gold and white; their **distribution and composition differ**. Martlet uses stronger bronze/gold accents while retaining blue/navy.
- Site pages mix light and dark regions by design. Configurable semantic color roles and optional application appearance presets will be built in Core; this source specimen does not assume a global toggle.
- When Core is capable, this site must use **published** Core and Astro packages, with no private reference-only CSS. The current source CSS is a **comparison baseline**, not an assertion of package feature completeness.
- Source hero imagery and identity assets must be reviewed for reuse/licensing before general public template publication. See `EXTRACTION-MAP.md`.

Only feature branches and `develop` are in scope. No changes to `main`, tags, npm, or production deployment.
