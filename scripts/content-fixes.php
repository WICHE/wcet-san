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

// --- Topic cards' "Learn more" sent people to the raw, unstyled "all
//     resources tagged X" term page. Point each topic at its curated
//     landing page instead (field_landing_page), matching where the nav
//     menu's "Topics" dropdown already sends them. A topic with no
//     dedicated landing page is left unset — the template falls back to the
//     term's own page.
//
//     Matched by TITLE, not node ID: node IDs for these landing pages are
//     NOT the same across environments (e.g. "Beyond Reciprocity" is node 40
//     on feature-refresh but node 40 is a completely different page — Non-
//     SARA Compliance Requirements — on this DB's own dump), so a hardcoded
//     ID would silently wire a topic to the wrong page depending on where
//     this runs. Title match is slower but environment-safe, matching how
//     this mapping was discovered in the first place. ----------------------
$topic_landing_page_titles = [
  1 => 'Federal Regulations',
  2 => 'Reciprocity (SARA)',
  3 => 'Professional Licensure',
  4 => 'Getting Started',
  5 => 'Student Complaints',
  7 => 'History',
  8 => 'Other Higher Education Issues',
  9 => 'SANsational Awards',
  10 => 'Military Students',
  613 => 'Global Compliance',
  614 => 'Beyond Reciprocity',
];
$node_storage = \Drupal::entityTypeManager()->getStorage('node');
foreach ($topic_landing_page_titles as $tid => $title) {
  $term = \Drupal\taxonomy\Entity\Term::load($tid);
  if (!$term) {
    echo "topic term $tid: not found, skipped\n";
    continue;
  }
  $matches = $node_storage->loadByProperties([
    'type' => 'landing_page',
    'title' => $title,
  ]);
  if (!$matches) {
    echo "topic term $tid ({$term->label()}): no landing_page titled \"$title\" found, skipped\n";
    continue;
  }
  if (count($matches) > 1) {
    echo "topic term $tid ({$term->label()}): " . count($matches) . " landing pages titled \"$title\" found, using the first (review manually)\n";
  }
  $node = reset($matches);
  $nid = (int) $node->id();
  $current = (int) $term->get('field_landing_page')->target_id;
  if ($current !== $nid) {
    $term->set('field_landing_page', ['target_id' => $nid]);
    $term->save();
    echo "topic term $tid ({$term->label()}): landing page -> node $nid ({$title})\n";
  }
  else {
    echo "topic term $tid ({$term->label()}): already correct (node $nid), skipped\n";
  }
}

echo "DONE\n";
