# WCET · SAN — Drupal 11 upgrade & theme refresh — Progress report

_Last updated: 2026-09-07 · branch `feature/refresh`_

## TL;DR
The site is **fully upgraded to Drupal 11.4.5** and running the **new `wiche` theme**
built from the Figma "Wiche-Refresh" design. All extensions are D11-compatible,
`composer audit` is clean, and the component library matches the design (verified
against real content). What remains is **config export for deploy-readiness** plus
a few **content-model tweaks** and two page templates.

- Live locally: <https://wcetsan.lndo.site> · demo: `/wiche-design-demo`
- Visual tracker: <https://claude.ai/code/artifact/c3a3539a-e942-4af1-96c3-f449b0a94c78>
- Detail/history: [drupal-11-upgrade.md](drupal-11-upgrade.md)

## Status by phase

| Phase | State | Notes |
| --- | --- | --- |
| 1 · Local dev (Lando) | ✅ Done | MySQL 8.0 (matches prod), PHP 8.3, Solr 8; boots committed `settings.php` unchanged |
| 2 · Prod DB import | ✅ Done | 82 MB dump, 246 tables, MySQL 8.0 |
| 3 · Latest Drupal 10 | ✅ Done | 10.6.9 → 10.6.15; pulled patched Twig 3.28, cleared the composer audit gate |
| 3 · Module + security sort | ✅ Done | 8 modules updated, 4 dropped (advagg/rdf/system_status/adminimal), 3 security fixes; audit clean |
| 4 · Drupal 11 flip | ✅ Done | 10.6.15 → **11.4.5**; drush 13, Symfony 7, gin 5/gin_toolbar 3, `symfony/runtime`, action+tour contrib; `updb` clean |
| 5 · New `wiche` theme | ✅ Done | Built from Figma, default; retired themekit + classy + graphql_search_api |
| 5 · Component library | ✅ Done | Hero, all card types, accordion, CTA banner, mega-menu, two-tier footer, buttons — verified vs Figma |
| 5 · Content teaser wiring | ✅ Done (theme side) | 601 resources → article cards; event + topic teasers wired |
| 5 · Config export | ⏳ Next | Theme switch + block placements are DB-only; capture into `config/default` |
| 5 · Content-model tweaks | ⏳ Next | Topic/event image fields, un-hide summary field, `/resources/all` CAPTCHA |
| 5 · Page templates | ✅ Done | Resource overview (184:5646) + article/resource full page (53:499) built & verified vs real content |
| 5 · Design QA vs Figma | ✅ Done | Hero, cards, accordion, CTA, footer, article page all reviewed against Figma frames & fixed; see below |
| 6 · Content readiness | ⏳ In progress | All content types author-ready; images + menus + footer links are the remaining content tasks |

## The `wiche` theme
Build-less Drupal 11 theme (base `stable9`, CSS custom properties + vanilla JS, no webpack).

- **Tokens** ([css/tokens.css](../docroot/themes/custom/wiche/css/tokens.css)) — single art-direction source: brand blue `#1468A0`, red `#DF1D20`, SAN magenta, Roboto + Inter, type scale, spacing, shadows, hero gradient.
- **CSS layers** — `base.css` generic element styles are in `@layer wiche-base` so Drupal's admin chrome (toolbar, contextual links, off-canvas) always wins; component/layout styles stay unlayered.
- **Header** — utility bar + logo + accessible mega-menu (`menu--main.html.twig` + JS; wide dropdowns flow to 2 columns).
- **Footer** — light 5-column band + dark WCET band (editable custom blocks; links are `#` placeholders for now).
- **Paragraph templates** — every one of the 18 bundles has a template (hero, card rows, cards, summaries, FAQ accordion, CTA banner, media, table, etc.).
- **Content teasers** — `node--resource--teaser` → article card; `node--event--teaser` → event card; `taxonomy-term--topic` → topic card.

## Content model (learned during wiring)
- "Articles" **are `resource` nodes**: `field_resource_type` = category label, `field_content_access` (public/**private** = lock), `field_topic` = tags, created = date.
- `event` nodes: `field_event_date`, `field_event_type`, `field_topic` (no image field yet).
- `topic` terms have no fields (name only). `summary_resources`/`summary_events` reference topic terms via `field_summary_topics`, which is **hidden in the paragraph display** (old site likely used a custom formatter) → those home sections render empty until re-enabled.
- The `resources` view lists at `/resources/all` (teaser mode) but its exposed filter is **CAPTCHA-gated**.

## Remaining work
1. ✅ **`drush cex`** — done; `config/default` now matches the running site.
2. ✅ **Content-model tweaks** — done: un-hid `field_summary_topics` (Resources/Events sections populate); added `field_image` to `topic` + `event`; **disabled the global CAPTCHA** (see note below) so `/resources/all` shows the article grid.
3. ✅ **Page templates** — done:
   - **Resource overview** (`/resources/all`) — `views-view-unformatted--resources--page-resources.html.twig` lays the resource teasers out in the 3-up card grid; the exposed Types/Topics filters are styled as a filter bar; the duplicate generic "All Resources" page title is hidden (the view's own "Resource Library" header is the H1). Route-scoped via a `route--…` body class from `wiche_preprocess_html`.
   - **Article / resource full page** — `node--resource--full.html.twig`. Rebuilt to the Figma layout (53:499): **two columns** when the resource has prose (`field_p_content` via a `simple_content` paragraph) — article body (left) + a **"Quick links"** sidebar (right) from `field_p_resources` — plus a **"More {topic} Resources"** related-cards section (`wiche_preprocess_node`) with a "See all resources" button. Link/file-only resources (**275/290**, no prose) keep the single-column **"Downloads & links"** panel; `has_body` uses `striptags` so an empty layout paragraph doesn't falsely trigger the split. Full-node pages hide the page-title block by id (`#block-wiche-pagetitle`).
4. ⏳ **Footer links** — placeholders (`#`); wire to real menus (content).

## Design QA vs Figma (2026-09-07)
Reviewed each built component/page against its Figma frame (renders in `.figma-refs/qa/`, gitignored):

| Design | Node | Verdict |
| --- | --- | --- |
| Hero (solid / half-image / full-image) | 154:1209 | ✅ Matches — blue→navy gradient, eyebrow, left copy |
| Cards — single CTA (bg + no-bg) | 154:1663 | ✅ Matches — title · rule · body · outline/filled CTA |
| Accordion (default / hover / open) | 161:2043 | ✅ Matches — blue open bar, white text, left accent |
| CTA banner | 26:32 | ✅ Matches — gradient band + outline button |
| Footer (light 5-col + dark WCET band) | 53:499 | ✅ Structure matches (headings/links are content) |
| Article page (2-col + Quick links + related) | 53:499 | ✅ Rebuilt to match |
| Resource overview | 184:5646 | ✅ Card grid + filter bar |

**Gaps that are content, not theme** (need client input / authoring — see below):
- **Navigation IA** — main nav (currently *State Authorization 101 · About SAN · Membership · Events · Resources*, 40 links) and the utility bar (missing *Search*) don't match the design's IA (*Home · Our Network · Learning Center · Compliance Topics · Events · Join SAN*). Restructuring the real 40-link menu is a client IA decision, not done unilaterally.
- **Footer** menu links are `#` placeholders.
- **Topic / event images** not yet uploaded.
- Card "*External link" magenta note + per-card button fill are driven by paragraph fields (author choices), not the theme.

## Content readiness (for client authoring)
All content types are **author-ready** — editors can create everything from the node forms:

| Type | Author fields | Notes |
| --- | --- | --- |
| Resource | title, resource_type, topic, content_access, `field_p_content` (prose via `simple_content`), `field_p_resources` (links/files) | Demo article **node 815** (`DEMO: 15 Years…`) is a ready template |
| Event | title, event_date, event_type, topic, **field_image**, featured, resources | Image field in the form → image-topped cards |
| Landing Page | `field_p_header`, `field_p_content` (paragraphs) | Demo landing **node 814** |
| Basic page | title, body | |
| Resource Table | title, resource_type, topic, intro copy | |
| Topic (term) | name, **field_image** | Image → overlay Resource cards |

**Demo content** (created to validate designs / act as templates; delete before launch if unwanted): landing node **814** (`/wiche-design-demo`), article node **815**.

### Content still needed (authoring, on the client side)
- Upload an **image per topic** (`field_image`) → Resources cards become the image-overlay design (theme already renders them when present).
- Upload an **image per event** (`field_image`) → image-topped event cards.
- Decide the **navigation IA** (see Design QA gaps) and wire the **footer** links.

### ⚠️ CAPTCHA note (changed 2026-09-06)
`captcha.settings: enable_globally` was **`1`** (CAPTCHA on **every** form, including
Views exposed filters — which blocked the `/resources/all` article grid from
rendering). Set to **`0`** so CAPTCHA now applies only to explicitly-enabled
captcha points. **Before launch**, decide which forms need CAPTCHA (login,
register, password reset, contact, node create) and enable those points at
`/admin/config/people/captcha` — or re-enable `enable_globally` and instead
exempt only the exposed-filter forms.

### Known issue
Some existing entity **view displays have a broken component** (`getConfigDependencyName()
on null`, a leftover from a removed module) that throws when the display is
re-saved. Worked around by rendering `field_image` directly in the templates;
worth cleaning up (find the null component and remove it) during config tidy-up.

## How to run / verify
```bash
lando start
lando drush uli            # admin login link
# view: https://wcetsan.lndo.site  and  /wiche-design-demo
```
Rollback point for the D11 flip: `d10.6.15-pre-d11-checkpoint.sql.gz` (repo root, gitignored).

## Commit trail (branch feature/refresh)
`27daa9f` build theme · `202afda` header fix · `4ab5ae0` card grid · `99a9083` polish ·
`24ed947` contextual/buttons/accordion · `70c176f` mega-menu/topic cards ·
`c7ad49b` article card · `ebf28b2` resource+event teasers.
