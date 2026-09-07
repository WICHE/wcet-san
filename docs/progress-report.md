# WCET · SAN — Drupal 11 upgrade & theme refresh — Progress report

_Last updated: 2026-09-06 · branch `feature/refresh`_

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
| 5 · Page templates | ⏳ Todo | Resource overview (184:5646), article page (53:499) |

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

## Remaining work (recommended order)
1. **`drush cex`** — capture the theme switch, block/footer placements, and teaser wiring into `config/default` (deploy-readiness). Review the diff before committing.
2. **Content-model tweaks** — add image field to `topic` (Resources overlay cards) and `event` (image event cards); un-hide `field_summary_topics` in the summary displays; reconsider the `/resources/all` CAPTCHA.
3. **Page templates** — resource overview, article page.
4. **Footer links** — wire the placeholder columns to real menus.

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
