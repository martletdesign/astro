# Upgrading to Martlet Astro 3

Astro 3 requires Core 3. Update both dependencies together:

```sh
npm install @martlet/astro@^3.0.0 @martlet/core@^3.0.0
```

Core 2 is outside the supported peer range. Astro 5, 6, and 7 remain supported. Component export names, props, and slots are retained.

Replace `@martlet/core/reference.css` imports with `@martlet/core/martlet.css`. If the site copies the canonical stylesheet into public assets, update the copy source and stylesheet URL together. The stylesheet remains authored only in Core and is shared byte-for-byte with React and Jekyll.

The reference application is in `reference/` and uses published packages. The npm package contains reusable components and documentation. New sites use the separate `martletdesign/astro-starter` repository; existing sites keep their content and host configuration.

Release preparation publishes Core first, records its exact registry version and integrity in `docs-release-lock.json`, and then publishes Astro. Once Astro is available on npm, the reference application's manifest and lockfile can adopt the published pair. This avoids a build depending on an unpublished version of its own package.

The package version follows its public compatibility contract. Reference-only changes do not require another npm version. Use a `release/*` branch from `develop`, merge to `main`, and merge the release back to `develop`.
