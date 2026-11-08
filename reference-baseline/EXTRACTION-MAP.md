# Martlet extraction map — source-derived baseline

## Authority and status

Canonical: `k3jph/k3jph.github.io` at `d52c7193ea9090ed11fdc8b3f2fd454c0e77d50c`, a functioning Astro site. The baseline in this directory is a **first editable specimen**, not a complete copy of all original routes or an accepted new Core. Styling has not been altered, except that identities and content are replaced with synthetic examples; original home CSS, global/content/document styles and source header/footer component styling are retained.

## Source to fixture mapping

| Source construct | Origin | Neutral fixture | Verification |
| --- | --- | --- | --- |
| Global prose, headings, links, focus, spacing | `src/styles/global.css`, `tokens.css` | All routes | Compare computed type roles, spacing and links to source |
| Personal-site homepage structure | `src/pages/index.astro` and its scoped `<style>` | `/` | Compare hero, editorial story, project feature, subject index and breakpoints |
| Header and mobile navigation | `src/components/SiteHeader.astro` | All routes | Compare fixed position, scroll transitions, Menu, Escape and keyboard |
| Footer columns and identity area | `src/components/SiteFooter.astro` | All routes | Compare columns, link styling, focus and mobile stacking |
| Page-intro masthead | `src/components/PageIntro.astro` | `/article/`, `/document/` | Compare backdrop, overlay, title/eyebrow, text measure |
| Long-form article typography | `src/styles/content.css` | `/article/` | Compare quote, table, code, contents and media behavior |
| Documentation and sticky index | `src/styles/document-pages.css` | `/document/` | Compare 16rem side index, 48rem reading measure, portrait stacking |
| Source-site forms and controls | `src/styles/global.css` | `/article/#forms` | Compare label, input, select, button and focus |
| Native article and content data | Various original collections/components | Synthetic static examples | No original personal facts, news, history or legal notices retained |

### Coverage not yet claimed

The original site contains many additional route-level components: archives, bibliographic material, image and figure variants, media grids, ancestry/document pages, seasonal presentation, footnotes and mathematical material. These **must be inventoried against the source before Core completeness is claimed**. A three-page specimen cannot establish all 50 canonical application patterns, dashboard behavior or external adoption readiness.

### Color and appearance decision

Both families use **blue, gold and white**; colors alone do not define the language. Martlet has a stronger gold/bronze/brown *distribution*, but source blue/navy roles remain. Do not convert every instance of blue into gold. The source website's simultaneous light content, dark navigation and dark photographic regions are structural, not evidence of a whole-site light/dark switch. Application dashboards may later offer coordinated appearance presets with configurable semantic roles.

### Extract into Core

For each required construct: (1) retain original rule and observable behavior as the oracle; (2) identify reusable semantics and documented variants; (3) implement in `@martlet/core` (and native reusable behavior as appropriate); (4) replace the baseline's source CSS with published Core exports in a **separate consumer fixture**; (5) show equivalence without any reference-only styling; (6) make Jekyll, Astro and React genuine consumers.

Until step 5 is demonstrated, keep this baseline's source CSS as a **read-only comparison artifact**, not a new implementation dependency.

### Deployment

No changes to existing `starter/`, Cloudflare target, `main`, protected tags, npm, or release workflows. Develop previews may be configured after standalone build verification. This baseline has not yet been independently rendered or compared in a browser.
