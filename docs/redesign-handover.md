# WCET · SAN — Redesign handover (theme refresh + design QA + content)

_Technical companion to [client-guide.md](client-guide.md) (client-facing) and
[progress-report.md](progress-report.md) (living status). Covers the Figma theme
refresh, the design-QA/build pass, and how to rebuild it on a fresh database._

_Branch `feature/refresh` · last updated 2026-09-08_

---

## 1. Where things stand

- **Drupal 11.4.5**, custom **`wiche`** theme (build-less, `stable9` base), default.
  themekit / classy / graphql_search_api retired. `composer audit` clean.
- Component library **matches the Figma design** (hero, cards, accordion, CTA,
  footer, mega-menu).
- Page templates built to design: **resource overview** (`/resources/all`),
  **article/resource full page** (53:499), **membership overview** (72:1528).
- **Navigation** restructured to the design IA (177:4303).
- All content types **author-ready**; image fields on topic/event; demo templates.

Full upgrade history is in [drupal-11-upgrade.md](drupal-11-upgrade.md).

## 2. Design QA (Figma → build)

Each frame was pulled and compared to the live build (renders in `.figma-refs/qa/`,
gitignored):

| Design | Figma node | Verdict |
| --- | --- | --- |
| Hero (solid / half-image / full-image) | 154:1209 | ✅ |
| Cards — single CTA (bg + no-bg) | 154:1663 | ✅ |
| Accordion (default / hover / open) | 161:2043 | ✅ |
| CTA banner + components | 26:32 | ✅ |
| Footer (5-col light + dark WCET band) | 53:499 | ✅ |
| Article / resource full page | 53:499 | ✅ rebuilt |
| Resource overview | 184:5646 | ✅ |
| Mega-menu IA | 177:4303 | ✅ rebuilt |
| Membership overview | 72:1528 | ✅ rebuilt |

## 3. What was built / changed this pass

- **Article page** — `templates/content/node--resource--full.html.twig` +
  `wiche_preprocess_node()`. Two columns when the resource has prose
  (`field_p_content` via a `simple_content` paragraph): body + a **Quick links**
  sidebar (`field_p_resources`). A **"More {topic} Resources"** related-cards row
  follows. Link/file-only resources (275/290, no prose) keep a single-column
  **Downloads & links** panel; `has_body` uses `striptags` so an empty layout
  paragraph doesn't falsely trigger the split.
- **Resource overview** — `templates/views/views-view-unformatted--resources--page-resources.html.twig`
  lays the teasers in the 3-up card grid; exposed Types/Topics filters styled as a
  filter bar; duplicate page title suppressed.
- **Membership** — `/membership` rebuilt from paragraph components to 72:1528
  (see `scripts/membership-page.php`).
- **Navigation** — `scripts/nav-menu.php` rebuilds the main + utility menus to
  the design IA (see §5).
- **Local task tabs** — styled as a pill row (`#block-wiche-tabs`, a classless
  `<ul>`); **contextual-link** dropdowns re-hidden at theme level.
- **Page-title de-duplication** — the block is `<div id="block-wiche-pagetitle">`
  (no class); hidden by **id**, scoped via a `page-node-type-*` body class
  (`wiche_preprocess_html`) to resource / event / landing_page pages that render
  their own H1.

## 4. Config vs content (what deploys how)

**Config** (in `config/default`, applied by `drush cim`): default theme, block
placements, image field storage/config + form displays (topic + event), views
(resources, coordinator_list menu removal), `captcha.settings` (global off),
summary-paragraph display (`field_summary_topics` un-hidden).

**Content** (NOT in config — recreated by `scripts/`): menu links, the two custom
**footer block bodies** (referenced by fixed UUID in config), the membership page
body, and the demo nodes. See [scripts/README.md](../scripts/README.md).

## 5. Rebuilding on a fresh database

The prod DB is **D10**; this codebase is **D11**. Sequence:
**import DB → `drush updb` → `drush cim` (review with `--preview=diff`) → run the
`scripts/*.php` → `drush cr` → verify.** The full runbook, per-script table, and
caveats are in **[scripts/README.md](../scripts/README.md)**.

Load-bearing gotcha: `scripts/footer-blocks.php` recreates the footer blocks with
the **exact UUIDs** in `block.block.wiche_footer_*.yml` — otherwise the footer
renders empty after an import.

## 6. Gotchas worth knowing

- **Menu links are content** — `drush cex` never captures them; deleting them
  leaves **stale `menu_tree` rows** (the nav script truncates + rebuilds the tree).
- **`route:<nolink>` and external menu links don't appear in `menuTree()->load()`
  (drush) dumps** but **do render in the block** — verify against the rendered
  page, not the drush tree.
- **Browser QA trick** — the in-app browser blocks localhost CSS, and files
  outside the project render static-only. To screenshot the theme, write a
  snapshot HTML (page markup + inlined theme CSS) **inside the project dir**
  (`.figma-refs/qa/`) and open it — it renders and screenshots.
- **`.lagoon.yml` has `drush cim` commented out** — prod runs on DB config, so
  applying repo config to a prod DB is a deliberate, reviewed step.

## 7. Open items (content / client)

1. Repoint `TODO` nav items (search `scripts/nav-menu.php`) at real URLs.
2. Proofread the membership page copy (transcribed from the mock-up).
3. Wire the footer links (currently `#`).
4. Upload topic/event images.
5. Build the native **Search** page (retired graphql/React search) for the Search link.
6. Decide **CAPTCHA** per-form before launch (currently global-off).

## 8. Key files

```
docroot/themes/custom/wiche/            the theme
  css/{tokens,base,layout,components}.css
  wiche.theme                            preprocess (body classes, related resources)
  templates/content/node--resource--full.html.twig
  templates/views/views-view-unformatted--resources--page-resources.html.twig
  templates/paragraph/*.html.twig
scripts/                                 reproducible content rebuild (see README.md)
  nav-menu.php · footer-blocks.php · membership-page.php · demo-*.php
  content/footer-*.html
config/default/                          exported config (drush cim)
docs/                                    client-guide · redesign-handover · progress-report · drupal-11-upgrade
```

## 9. Commit trail (this pass)

`675a4d7` overview + article templates · `42521db` tabs + contextual ·
`cbff515` article 2-col + Quick links + related · `dccc3be` nav IA restructure ·
`faa5324` landing-page title fix · plus docs + scripts.
