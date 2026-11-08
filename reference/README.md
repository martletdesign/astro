# Martlet Astro reference

The complete Martlet reference application: 50 canonical examples, three dashboards, a scientific workspace, and layout and form specimens. It consumes the published `@martlet/astro` and `@martlet/core` packages at exact versions recorded in `package.json` and `package-lock.json`.

```sh
npm ci
npm run dev
npm run build
npm run preview
```

## Hosting

Use the Astro package repository as the Cloudflare project source. Root directory: `reference`; build command: `npm run build`; static output: `dist`. `develop` is the development branch and `main` is the release branch. Branch selection provides deployment approval; no separate attestation, archive reconstruction, package assembly, or deployment script is required.

For Cloudflare Workers static assets, the included `wrangler.json` uses `dist`. The standard deploy command is `npx wrangler deploy`; for a Workers preview use `npx wrangler versions upload`. Cloudflare Pages uses `dist` directly without a deploy command.

## Package boundary

Update dependency pins and the lockfile together with npm, then build the reference. Unreleased library code is tested in the library repository, not silently substituted for registry packages here. This app is private and is never published to npm.

The clonable starting point is [martletdesign/astro-starter](https://github.com/martletdesign/astro-starter). The component package lives alongside this app in the same [martletdesign/astro](https://github.com/martletdesign/astro) repository. `reference/` is excluded from the npm archive. The primary design website remains `martletdesign/website`.

## Source and examples

Application content was extracted from `martletdesign/astro` at `d9db9e4d2287d114d94b44ffd92202e2a0b87624`. Existing asset credits and provenance files are retained. Reference records are fictional; interactive examples run locally in the browser and do not submit to a service.
