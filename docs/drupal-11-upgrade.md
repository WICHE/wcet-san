# WCET · SAN — Drupal 11 upgrade & theme refresh

Working record of the Drupal 10 → 11 upgrade and theme refresh for
`wcetsan-wiche-edu` (branch `feature/refresh`). Keep this updated as the work
proceeds.

- **Started from:** Drupal 10.6.9, PHP 8.2, Lagoon build pipeline for local.
- **Now on:** **Drupal 11.4.5**, PHP 8.3, Drush 13, MySQL 8.0, local dev via **Lando**.
- **Live tracker (visual):** https://claude.ai/code/artifact/c3a3539a-e942-4af1-96c3-f449b0a94c78

---

## 1. Local development with Lando

We run locally with **Lando** instead of the Lagoon build pipeline. Config is
[`.lando.yml`](../.lando.yml).

### Why it works with zero settings.php changes

`docroot/sites/default/settings.php` reads all DB / Solr / host / hash-salt
settings **only inside `if (getenv('LAGOON'))`** guards. So `.lando.yml` injects
`LAGOON=enabled` plus the same `MARIADB_*` / `SOLR_*` env vars Lagoon injects,
pointed at Lando's own services — the site boots locally through the exact same
code path as production, with no edits to committed code.

### Stack

| Service | Value | Note |
| --- | --- | --- |
| PHP | 8.3 | D11 requires 8.3+ |
| Database | **MySQL 8.0** | Prod (Lagoon dbaas) is MySQL 8.0.44 — dumps use the MySQL-only collation `utf8mb4_0900_ai_ci`, which fails to import on MariaDB |
| Solr | 8 (core `wcet`) | Prod is 7.7; search_api_solr auto-detects |
| Web | nginx (via) | mirrors prod |
| URL | https://wcetsan.lndo.site | |
| DB creds | `drupal` / `drupal` / `drupal` on host `database` | |
| Drush | site-local `/app/vendor/bin/drush` | |

### Common commands

```bash
lando start | stop | rebuild
lando drush <cmd>
lando composer <cmd>
lando db-import <file.sql.gz>     # import a DB dump
lando db-export <file.sql>        # snapshot the DB
lando info                        # ports / creds
```

> Composer note: this project's local Composer has a security-advisory gate. Run
> Composer on the **host** (`composer …`) if a `lando composer` invocation ever
> chokes on the project autoloader. A plain `composer install` (from the lock)
> is never blocked by the gate; only `require`/`update` resolution is.

---

## 2. What was done

### Phase 3 — latest Drupal 10 + contrib compatibility

- Updated core **10.6.9 → 10.6.15** (latest D10). This also pulled patched
  **Twig 3.28.0**, which cleared a Composer security gate that was blocking all
  dependency resolution (the gate excluded every Twig 3.x affected by the
  2024–2026 sandbox CVEs).
- Updated 8 contrib modules to D11-ready releases: `linkit 7.0.16` (also fixed a
  `<10.5.0` cap that made it incompatible with 10.6), `address 2.0.4`,
  `coffee 2.0.1`, `inline_entity_form 3.0.0`, `security_review 3.1.3`,
  `video_embed_field 3.1.0`, `search_api_exclude_entity 3.0.1`, `webform 6.3.0`.
- **Dropped**: `advagg` (core aggregation replaces it), `rdf` (only stock
  mappings), `system_status` (dev-only D11), `adminimal_theme` (legacy; Gin is
  the admin theme), and the cascaded legacy `seven` theme.
- Cleaned stale D9 schema entries: `ckeditor`, `color`, `upgrade_status`,
  `adminimal_admin_toolbar`.

### Security

- Applied security updates on already-D11-ready packages: `paragraphs → 1.23.0`
  (SA-CONTRIB-2026-061 access bypass), `entity_browser → 2.17.0` (XSS),
  `dompdf → 3.1.6` (6 CVEs). `composer audit` is now clean.
- **Repaired a pre-existing broken config**: the `video` entity browser pointed
  at a deleted view `entity_browser_video`; repointed to the existing
  `duplicate_of_entity_browser_video` (same base table + `entity_browser_1`
  display). This was breaking an update hook **and** the `single_video`
  paragraph's media picker on prod. (Follow-up: rename that view to a clean
  machine name.)

### Phase 4 — the Drupal 11 core flip

Mapped every conflict via `composer require … --dry-run` before the destructive
step. The flip required:

- `drupal/core ^11` (resolves to **11.4.5**), `drush ^13` (D10's Drush 12 pinned
  Symfony 6 via its codegen/robo deps), `symfony/css-selector ^7` (D11 = Symfony 7),
  `gin ^5` / `gin_toolbar ^3` (older Gin capped `<11.2`; core is 11.4.5).
- Added **`symfony/runtime` to `config.allow-plugins`** — a new D11 dependency
  that is itself a Composer plugin; without allowing it the entire install aborts.
- Removed the D10 `drupal/core` `ckeditor5tableResize` patch (won't apply to D11).
- Added `drupal/classy` to the `drupal-lenient` allow-list (bridge until the theme
  refresh removes it).
- **Added `drupal/action` + `drupal/tour` contrib** — D11 removed both from core,
  and `updb` hard-errors on removed-core modules until their contrib versions are
  present.
- Bumped custom modules + `themekit` `core_version_requirement` to include `^11`,
  and fixed a return-type covariance in `wcet_migrate`
  (`CoordinatorMembership::entity(): array`).
- `drush updb` ran clean (37 updates). Custom-code readiness was verified with
  `drush upgrade_status` (only trivial items, now fixed).

> **Gotcha:** an aborted first `updb` left the site in **maintenance mode** (HTTP
> 503). Clear with `lando drush sset system.maintenance_mode 0`.

**Rollback point:** `d10.6.15-pre-d11-checkpoint.sql.gz` (repo root, gitignored).
To roll back: `git checkout composer.* && composer install && lando db-import
d10.6.15-pre-d11-checkpoint.sql.gz`.

---

## 3. Current state

- Site runs on **Drupal 11.4.5**, all content pages HTTP 200, no PHP fatals,
  `updb` clean, `composer audit` clean.
- **Two known stragglers**, both handled in Phase 5:
  - `graphql_search_api` — no D11 release; currently loaded via lenient+patch but
    runtime-incompatible. Being replaced by a native Search API search.
  - `classy` — deprecated base theme, only needed by the old `themekit`; removed
    when the site switches to the new theme.

### Not yet done

- **Config export** (`drush cex`) — the module uninstalls + the video-browser
  repair changed *active (DB)* config but have **not** been exported to
  `config/default`. Needs review (prod drift + `config_ignore`). Note deploys run
  on DB config — `drush cim` is commented out in `.lagoon.yml`.
- **Cleanup**: `core-dev` / `core-recommended` / `core-composer-scaffold` were
  moved to `require` by the flip command — move them back to `require-dev`.
  Decide keep-or-drop for `action` / `tour`. `.lando.yml` recipe name still says
  `drupal10` (cosmetic).

---

## 4. Phase 5 — new theme + paragraph types (in progress)

Decisions: **fresh redesign, art-directed by the client**; **native Search API**
search (dropping GraphQL/React + `graphql_search_api`); new theme machine name
**`wiche`** (label "WCET SAN").

New theme scaffolded at [`docroot/themes/custom/wiche`](../docroot/themes/custom/wiche)
— see its [README](../docroot/themes/custom/wiche/README.md). Built on **stable9**
(not classy), **build-less** (CSS custom properties + vanilla JS, no webpack).
Installed but **not yet the default** (site still on `themekit`). Art-direct the
whole look from [`css/tokens.css`](../docroot/themes/custom/wiche/css/tokens.css).
Foundation preview: https://claude.ai/code/artifact/9f56ad09-12f7-4e29-88ee-55bf576ce5e3

### Remaining Phase 5 work

1. Apply real design direction to the tokens.
2. Re-create block placements for the `wiche` theme.
3. Port/rework the 18 existing paragraph types (+ any new ones) as templates/
   components in `wiche`. Existing types: `single_*` (text_area, image, video,
   file, link, svg), `simple_*` (content, card, faq), `compound_*`
   (header_content, card_row, faq_section), `layout_two_column`, `summary_*`
   (events, past_events, resources), `reference_block`, `table_with_filters`.
4. Build the native Search API results page; remove `graphql_search_api`.
5. Switch the default theme to `wiche`; remove `themekit` + `classy`.
