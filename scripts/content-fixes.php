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
//     menu's Compliance Topics dropdown already sends them. A topic with no
//     dedicated landing page (tid 6) is left unset — the template falls
//     back to the term's own page. ----------------------------------------
$topic_landing_pages = [
  1 => 39,    // Federal Regulations
  2 => 45,    // Reciprocity (SARA)
  3 => 43,    // Professional Licensure
  4 => 41,    // Getting Started
  5 => 46,    // Student Complaints
  7 => 42,    // History
  8 => 47,    // Other Higher Education Issues
  9 => 44,    // SANsational Awards
  10 => 48,   // Military Students
  613 => 27,  // Global Compliance -> shared Compliance Topics overview page
  614 => 27,  // Beyond Reciprocity -> shared Compliance Topics overview page
];
foreach ($topic_landing_pages as $tid => $nid) {
  $term = \Drupal\taxonomy\Entity\Term::load($tid);
  if (!$term) {
    echo "topic term $tid: not found, skipped\n";
    continue;
  }
  $current = $term->get('field_landing_page')->target_id;
  if ((int) $current !== $nid) {
    $term->set('field_landing_page', ['target_id' => $nid]);
    $term->save();
    echo "topic term $tid ({$term->label()}): landing page -> node $nid\n";
  }
  else {
    echo "topic term $tid ({$term->label()}): already correct, skipped\n";
  }
}

echo "DONE\n";
