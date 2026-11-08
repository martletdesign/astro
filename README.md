# Martlet for Astro

`@martlet/astro` 2.x integrates the independently published `@martlet/core` package. Version 2.0.2 corrects the shipped starter and native reference site to follow the accepted Martlet Jekyll visual baseline while retaining the existing component APIs.

`@martlet/astro` provides reusable Astro layouts and components. The framework-independent [`@martlet/core`](https://github.com/martletdesign/core) package owns the design definitions and font roles, extracted from jameshoward.us. Astro adds composition, never a competing palette.

## Install

```sh
npm install @martlet/core @martlet/astro astro
```

The GitHub organization is `martletdesign`; the npm scope is `martlet`.

## Use

```astro
---
import { Layout, Container, SectionHeading, Card, Button } from '@martlet/astro';
---
<Layout title="Your website" description="Your own description.">
  <Container>
    <h1>Your own identity</h1>
    <SectionHeading title="An example" />
    <Card><p>Your content.</p><Button href="/about/">About</Button></Card>
  </Container>
</Layout>
```

`Layout` loads core colors, foundation variables, typography, optional component styles, and local fonts. Set `mode="dark"` for Dark (default: Light). It provides head, header, footer, and body-end slots; it supplies no favicon, branding, analytics, navigation, or consent behavior. Use `mainId`, `mainTabindex`, `lang`, `class`, and `bodyClass` to adapt the shell. Metadata text uses Astro's normal escaping.

Components also have direct exports such as `@martlet/astro/Container.astro`. For an existing document shell, import `@martlet/astro/styles.css`, set `data-martlet="light"` or `dark`, and add `class="martlet"` around the styled content. The framework-independent core offers narrower imports if you do not want fonts or element styling.

`Container` supports content, reading, and archive widths. `SectionHeading` supports h2/h3, alignment, eyebrow, description, class hooks, and a divider slot. `Card` is an article wrapper. `Button` accepts native anchor/button attributes and defaults buttons to `type="button"`.

## Starter

Obtain the matching shipped starter without a repository checkout after verifying the version is available from npm:

```sh
mkdir example && cd example
npm pack @martlet/astro@2.0.2
# Extract the downloaded martlet-astro-*.tgz into this directory.
tar -xzf martlet-astro-2.0.2.tgz
cp -R package/starter/. .
rm -rf package
npm install
npm run dev
```

Alternatively copy `node_modules/@martlet/astro/starter/` from an existing installation. It demonstrates the Martlet family’s canonical header, navigation, typography, hero tiers, approved imagery, and footer using native Astro components. Replace the example identity and content for your own site, and retain the supplied image attribution when reusing the artwork. The starter is initial project scaffolding; package updates supply the shared functionality afterward.

## Compatibility and maintenance

Astro 5–7 is the supported peer range. Packed consumers exercise Astro 5.14.0, 6.0.0 and 7.3.2; the advisory hosted browser matrix covers 5.18.2 and 7.3.2. See [the extraction and migration playbook](docs/playbook.md) for release ordering, provenance, and validation. Acceptance follows the [canonical GitFlow policy](https://github.com/k3jph/design-workbench/blob/develop/docs/GITFLOW-ACCEPTANCE.md): one fast required check and zero required reviewers. Browser and compatibility suites provide advisory evidence.

## Layout system

Version 1.1 adds `Stack`, `Cluster`, `Grid`, `Sidebar`, `Split`, `Section`, `PageHeader`, `SiteHeader`, `SiteFooter`, `ArticleLayout`, `LandingLayout`, and `DocumentationLayout`. The historical 1.1 release consumed `@martlet/theme@^2.1.0`; visual defaults and structural CSS live in the core. See [layout contracts, source observations, and examples](docs/layouts.md). Existing components and Layout behavior remain available.

## Releases

npm publication uses the existing stage-only trusted publisher and an explicit npm owner approval. Protected tags subsequently complete verified GitHub source releases. See [release setup](docs/releasing.md) for the one-time package authorization and release order.

## Experimental UI language

The 1.2.x line historically used `@martlet/theme`. Astro 2.0.2 requires `@martlet/core@^2.2.4`; existing component APIs and slots remain available. [New contents/footer contracts and migration](docs/consolidation.md) are additive; existing slots, default footer, and supporting sidebar behavior remain available. The article starter exercises the additions.

## Forms

The starter `/form/` demonstrates native HTML with supported core form classes, explicit submit/reset types, validation, retained input, simulated failure/retry, and a changed-reset dialog. Nothing is sent or stored durably. Its local controls start disabled and are enabled only after initialization completes. If JavaScript is disabled, blocked, or fails during setup, an unavailable message remains visible and values cannot be submitted to the hosting server. Core owns the appearance; the small controller is host example code, not a new Astro API. See the core [form styling contract](https://github.com/martletdesign/core/blob/main/docs/form-styling.md). A `Button` accepts `type="submit"`, `type="reset"`, or its default `type="button"` without duplicate attributes; modifiers use `class="martlet-button--secondary"`.

## Reference delivery

The starter includes all 50 canonical examples, three dashboards, and a separate scientific workspace. These are explicitly simulated host applications, not exported Astro controllers. See [native Cloudflare delivery](docs/deployment.md) for source identity, integrity, previews, and rollback.
