<?php

/**
 * @file
 * Small, targeted content corrections that can't be captured by config
 * export (they're entity field VALUES, not config) — kept here as a single
 * idempotent, re-runnable script so each fix reaches every environment.
 * Safe to run repeatedly: every fix checks its current value before writing.
 *
 * Run: drush php:script scripts/content-fixes.php
 */

// --- /about-san hero: a long citation-style link was set to "Primary" (solid
//     white button), which looked wrong next to its two sibling CTAs, both
//     "Secondary" (outline). Match the sibling style. -----------------------
$p = \Drupal\paragraphs\Entity\Paragraph::load(4386);
if ($p && $p->bundle() === 'single_link' && $p->get('field_link_style')->value !== 'secondary') {
  $p->set('field_link_style', 'secondary');
  $p->save();
  echo "paragraph 4386 (about-san hero link): style -> secondary\n";
}
else {
  echo "paragraph 4386: already correct or not found, skipped\n";
}

echo "DONE\n";
