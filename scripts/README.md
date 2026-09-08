# Rebuild scripts — content that config export can't capture

These scripts recreate the parts of the redesign that live as **content**
(entities in the database), not **config**. `drush cex/cim` captures config
(theme, blocks placements, fields, views, CAPTCHA); it does **not** capture menu
links, block-content bodies, or nodes. So after any fresh database is imported,
config is applied with `drush cim` and then these scripts are re-run.

Run each with:

```bash
drush php:script scripts/<name>.php      # or: lando drush php:script scripts/<name>.php
```

| Script | Recreates | Idempotent |
| --- | --- | --- |
| `preflight-reconcile.php` | Reconciles a freshly-imported **D10 prod** DB with this D11 codebase so `updb`/`cim` can run: drops extensions with no code (advagg, rdf, system_status, graphql_search_api) + graphql (blocks updb; cim restores it), installs the wiche theme stack, sets the default theme, and recreates the `entity_browser_video` view. Run FIRST, before `updb`. | ✅ |
| `footer-blocks.php` | The two custom footer blocks (fixed UUIDs the config placements reference). Body HTML in `content/`. | ✅ updates in place |
| `nav-menu.php` | Main nav (6 mega-menu items) + utility bar, per Figma IA. Backs up + purges stale `menu_tree`. | ✅ clears + rebuilds |
| `membership-page.php` | `/membership` landing page rebuilt to design 72:1528. Backs up prior content to `public://`. | ✅ resolves by alias |
| `demo-landing.php` | `/wiche-design-demo` component showcase (landing page). | ✅ delete-by-title |
| `demo-article.php` | The "DEMO: 15 Years…" article (two-column resource template). | ✅ delete-by-title |
| `search-setup.php` | Frees `/search` (unpublishes prod's old React search landing) so the search view owns it. Reindex after: `drush search-api:index index`. | ✅ |

---

## Full rebuild sequence (fresh prod DB → design-ready DB)

The prod database is **Drupal 10**; this codebase is **Drupal 11**. So a fresh
import must be upgraded, then have config applied, then content rebuilt.

This is the exact sequence used on the 2026-09-08 prod dump.

```bash
# 0. Import the fresh prod DB (into Lando: `lando db-import <dump>.sql.gz`)

# 1. Reconcile the D10 DB with the D11 codebase so the container can build,
#    then rebuild caches.
lando drush php:script scripts/preflight-reconcile.php
lando drush cr

# 2. Upgrade the DB to D11 (runs all pending update hooks).
lando drush updb -y
lando drush cr

# 3. Apply the design config (theme, blocks, image fields, views, CAPTCHA).
#    REVIEW FIRST — prod may carry config/modules this repo doesn't.
lando drush config:status            # inspect what will change
lando drush cim -y                   # re-installs graphql on the D11 schema
lando drush cr

# 4. Rebuild the content the config can't carry.
lando drush php:script scripts/footer-blocks.php
lando drush php:script scripts/nav-menu.php
lando drush php:script scripts/membership-page.php
lando drush php:script scripts/demo-landing.php     # optional (demo/template)
lando drush php:script scripts/demo-article.php     # optional (demo/template)
lando drush php:script scripts/search-setup.php     # free /search for the search view
lando drush search-api:index index                  # build the DB search index
lando drush cr

# 5. Verify
#    - https://<site>/ (header nav = Home · Our Network · Learning Center ·
#      Compliance Topics · Events · Join SAN; footer populated)
#    - /resources/all (card grid + filters)
#    - /membership (design layout)
```

### Issues seen on the 2026-09-08 dump (handled by the steps above)
- **`updb` aborted at a webform update** because `graphql_core` queried users
  during route rebuild before the address-field D11 schema update ran → preflight
  now disables graphql for the upgrade (cim restores it).
- **`updb` aborted at `entity_browser_update_8202`** — the `video` entity_browser
  referenced a missing `entity_browser_video` view → preflight recreates it.
- **`cim` aborted** on the `stable` theme (removed in D11) that was stale in
  `core.extension.yml` → fixed in the repo.

### Caveats & notes
- **`drush cim` is risky on a raw prod DB.** Prod may have modules/config not in
  this repo (and `.lagoon.yml` has `drush cim` commented out — prod normally runs
  on DB config). Always `--preview=diff` first; watch for unexpected deletions and
  for config depending on modules the D11 codebase dropped.
- **Menu links are content** — re-run `nav-menu.php` on every environment; it is
  not in `cex`.
- **Footer UUIDs are load-bearing** — `footer-blocks.php` must create the blocks
  with the exact UUIDs in `config/default/block.block.wiche_footer_*.yml`, or the
  footer regions render empty.
- **Placeholder targets** — several nav items point at their section page for now
  (search `TODO` in `nav-menu.php`); the membership body copy is transcribed from
  the mock-up. Both need a human pass before launch.
- **Demos are optional** — the two demo scripts are authoring templates for the
  client; skip them for a clean production content set.
