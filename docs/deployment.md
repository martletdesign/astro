# Astro reference hosting

The reference is an ordinary Astro application at `reference/`, maintained with the `martlet` Astro component package. It consumes the published npm packages at exact versions with a committed lockfile. The npm package contains reusable source, not the reference app or the independently clonable starter.

## Local build

```sh
cd reference
npm ci
npm run dev
npm run build
npm run preview
```

The build output is `reference/dist/` from the repository root (`dist/` inside the app).

## Cloudflare settings

| Setting | Value |
| --- | --- |
| GitHub repository | `martletdesign/astro` |
| Root directory | `reference` |
| Build command | `npm run build` |
| Output directory (Pages) | `dist` |
| Production branch | `main` |
| Development branch | `develop` |

Cloudflare Workers static hosting may use the standard `npx wrangler deploy` command and the app's `wrangler.json`; preview uploads use `npx wrangler versions upload`. Pages needs no deploy command. The app does not require attestation variables, a custom shell/Python deployment pipeline, reconstructed Git archives, or npm package packing during deployment.

The root package is a component library and intentionally has no website build command. Set Cloudflare's root to `reference`, rather than installing or building the package root.

## Package versions

Update reference dependency pins and the lockfile after a package release. Stable deployments demonstrate stable registry versions; a development reference can explicitly pin a published prerelease. There are no local `file:` packages or automatic source substitutions in the deployable app. Library tests may separately install a packed source build in a temporary consumer.

## Starter migration

`starter/` is no longer shipped with the Astro npm package. Clone https://github.com/martletdesign/astro-starter for a new project. Existing starter-derived sites remain independent consumers. This change is recorded for the next package release; this development change does not publish a new npm version.

The primary design website remains `martletdesign/website`.
