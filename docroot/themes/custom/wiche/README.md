# WCET SAN theme (`wiche`)

A clean, custom Drupal 11 theme for the WCET State Authorization Network. It
replaces the old `themekit` (Elevated Third starter, which depended on the
deprecated `classy` base theme).

## Principles

- **Built on `stable9`** — core's minimal, stable-markup base. No `classy`, no
  extra wrapper classes.
- **Build-less** — plain CSS with custom properties and a little vanilla JS.
  No webpack/Sass toolchain to maintain; Drupal aggregates the assets.
- **Token-driven** — every color, font, size, and space is a CSS custom
  property in `css/tokens.css`. Components never hard-code values.

## Art-directing the look

Almost everything visual lives in **`css/tokens.css`**. To restyle the site:

1. Set the brand palette — `--brand-600/700/050`, `--accent`.
2. Pick typefaces — `--font-sans`, `--font-display` (uncomment the `fonts`
   library in `wiche.libraries.yml` to load a Google font, then reference it).
3. Adjust the type scale (`--step-*`), spacing (`--space-*`), radius/shadow.
4. Tune the dark palette in the `@media (prefers-color-scheme: dark)` block so
   both themes stay legible.

Because components only reference tokens, these edits cascade everywhere.

## Structure

```
wiche.info.yml          Theme metadata, regions, libraries
wiche.libraries.yml     The single global CSS/JS library
wiche.theme             Preprocess + template suggestions (paragraphs)
css/tokens.css          ← ART-DIRECT HERE (design tokens)
css/base.css            Reset + element defaults
css/layout.css          Page shell, regions, content grid
css/components.css      Buttons, cards, nav, pills (grows over time)
js/wiche.js             Minimal behaviours (mobile nav toggle)
templates/layout/       page.html.twig (region layout)
```

## Regions

Machine names mirror the old `themekit` theme so existing block placements can
be re-created 1:1 when the default theme is switched over: `header`,
`primary_menu`, `breadcrumb`, `highlighted`, `featured`, `help`, `page_top`,
`content`, `sidebar_first`, `sidebar_second`, `footer_top`, `footer`,
`page_bottom`.

## Still to build (Phase 5)

- Real design direction applied to the tokens.
- Block placements for this theme.
- Paragraph templates/components for the 18 existing types (+ any new ones).
- Native Search API results page (replaces the old GraphQL/React search).
- Switch the site default theme from `themekit` to `wiche`, then remove
  `themekit`/`classy`.
