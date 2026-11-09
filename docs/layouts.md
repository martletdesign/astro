# Martlet layout extraction

Release candidate: core 2.1.0 and Astro 1.1.0. Existing color, font, and component contracts remain available.

## Source observations

- Originating site: [jameshoward.us](https://github.com/k3jph/k3jph.github.io/tree/32b7166a629ea696147d0d779d911b713e4baf7e). Inspected files: `src/styles/global.css`, `src/styles/document-pages.css`, `src/styles/content.css`, `src/components/PageIntro.astro`, `src/components/ProjectShowcase.astro`.
- Demonstration site: [martlettheme.dev](https://github.com/martlettheme/martlettheme/tree/39bf200d265ced6b893fa4ad186c75691ba2ec94). Inspected files: `site/src/pages/index.astro`, `site/src/styles/global.css`.

The originating site pairs a 16rem documentary index with a 48rem reading column and uses 3:2 introduction features, two- and three-column editorial grids, and constrained prose within wider documents. The demonstration site adds facing specimens, a split title/introduction, and a token-reference/contrast-inspector workspace.

## Reusable contract

The core retains its original reading/content/archive widths. New layout variables normalize recurring gaps, a 16rem sidebar, a 30rem minimum main region, a 18rem card minimum, and a 20rem split-panel basis. These are documented defaults, not a claim that every source element used exactly the same values. Martlet's default split is `wide-start`.

Use `@martlet/core/layout.css` with foundation variables for structural classes; it loads no fonts or palette. `full.css` includes it. `layout.json` and the ESM/CommonJS `layout` export describe defaults and provenance. No existing source value is silently replaced.

Intrinsic wrapping responds to the containing region. Grid `columns` is a maximum, not a promise to fit that many columns at every width. Sidebars use a separate main-content minimum; splits retain DOM order. There is no overflow-hiding workaround. Wide tables belong in a labelled `.martlet-scroll` region with `tabindex="0"` when keyboard scrolling is needed.

The Astro package supplies wrappers, site chrome, and complete article, landing, and documentation compositions. Identity, route generation, content rendering, analytics, and consent remain host-owned. Header links wrap naturally; this release does not implement dropdown or disclosure-menu behavior.

## Astro API

```astro
---
import { ArticleLayout, SiteHeader, SiteFooter } from '@martlet/astro';
---
<ArticleLayout title="An article" summary="A short introduction.">
  <SiteHeader slot="header" name="Your site" links={[{href:'/',label:'Home'}]} />
  <p>Your content.</p>
  <div slot="sidebar"><h2>Related material</h2><p>Supporting context.</p></div>
  <SiteFooter slot="footer"><p>Your own footer.</p></SiteFooter>
</ArticleLayout>
```

`Stack`, `Cluster`, and `Grid` accept native attributes, `class`, `as` (`div`, `section`, `article`, `nav`, `ul`, or `ol`), and `space` (`small`, `regular`, or `large`). When using list tags, supply `li` children. Cluster adds `justify` (`start`, `end`, or `between`); Grid adds maximum `columns` (1–4).

`Sidebar` has a default main-content slot, named `sidebar` slot, `side` (`start` or `end`, default end), `sidebarLabel`, and `space`. Its aside wrapper is supplied automatically; place sidebar content directly in the named slot. `Split` has default and `secondary` slots, `ratio` (`equal`, `wide-start`, `wide-end`), `align` (`center` or `start`), and `space`. Structural components have class hooks and forward native attributes. Override layout tokens through those hooks for deliberate custom composition.

`Section` provides a full-width section band and its own Container. It accepts `width`, optional `mode`, class and native section attributes. Give sections an accessible name through `aria-labelledby` when appropriate. `PageHeader` accepts `title`, `summary`, `eyebrow`, `class`, optional `media` slot, and default metadata slot. Strings are escaped by Astro.

The three page layouts share required `title`, optional `documentTitle`, `description`, `summary`, `eyebrow`, `mode`, `lang`, `mainId`, `class`, and `bodyClass`. They forward `head`, `header`, `footer`, and `body-end` slots. They use one main landmark and one page h1 by default. ArticleLayout adds an optional `sidebar` slot after its article. DocumentationLayout adds an optional `navigation` slot before its article. Both expose `metadata` and `sidebarLabel`. LandingLayout exposes optional `hero` and `metadata` slots; a custom hero is responsible for its heading.

SiteHeader requires `name`; accepts `home`, `links` (href, label, optional current), `navigationLabel`, `class`; slots: brand, navigation, actions. SiteFooter accepts links, navigationLabel, class and default content. Brand slots contain text/artwork rather than another link. Header/footer links wrap rather than becoming a JavaScript-controlled mobile menu.

Existing `Layout`, `Container`, `SectionHeading`, `Card`, and `Button` APIs remain available. The adjacent reference application demonstrates article, landing, documentation, and structural examples.
