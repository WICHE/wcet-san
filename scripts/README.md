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
| `footer-blocks.php` | The two custom footer blocks (fixed UUIDs the config placements reference). Body HTML in `content/`. | ✅ updates in place |
| `nav-menu.php` | Main nav (6 mega-menu items) + utility bar, per Figma IA. Backs up + purges stale `menu_tree`. | ✅ clears + rebuilds |
| `membership-page.php` | `/membership` landing page rebuilt to design 72:1528. Backs up prior content to `public://`. | ✅ resolves by alias |
| `demo-landing.php` | `/wiche-design-demo` component showcase (landing page). | ✅ delete-by-title |
| `demo-article.php` | The "DEMO: 15 Years…" article (two-column resource template). | ✅ delete-by-title |

---

## Full rebuild sequence (fresh prod DB → design-ready DB)

The prod database is **Drupal 10**; this codebase is **Drupal 11**. So a fresh
import must be upgraded, then have config applied, then content rebuilt.

```bash
# 0. Import the fresh prod DB (into Lando: `lando db-import <dump>.sql.gz`)

# 1. Upgrade the DB to D11 (this codebase). See docs/drupal-11-upgrade.md for the
#    module drops that make updb clean (advagg, rdf, system_status, adminimal).
lando drush updb -y
lando drush cr

# 2. Apply the design config (theme, blocks, image fields, views, CAPTCHA).
#    REVIEW FIRST — prod may carry config/modules this repo doesn't.
lando drush cim --preview=diff        # inspect
lando drush cim -y
lando drush cr

# 3. Rebuild the content the config can't carry.
lando drush php:script scripts/footer-blocks.php
lando drush php:script scripts/nav-menu.php
lando drush php:script scripts/membership-page.php
lando drush php:script scripts/demo-landing.php     # optional (demo/template)
lando drush php:script scripts/demo-article.php     # optional (demo/template)
lando drush cr

# 4. Verify
#    - https://<site>/ (header nav = Home · Our Network · Learning Center ·
#      Compliance Topics · Events · Join SAN; footer populated)
#    - /resources/all (card grid + filters)
#    - /membership (design layout)
```

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
