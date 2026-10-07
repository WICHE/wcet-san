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

// --- Backfill field_link_alignment (simple_content) and field_hero_bg
//     (compound_header_content): both were briefly required:true, which
//     blocked saving ANY page containing an existing paragraph of either
//     bundle (pre-dating the field, so no stored value) with "This value
//     should not be null." Now required:false, but existing paragraphs
//     still have no stored value — backfill the same default the template
//     already falls back to, so the data is explicit rather than relying on
//     the Twig fallback forever. ------------------------------------------
$paragraph_storage = \Drupal::entityTypeManager()->getStorage('paragraph');

$ids = $paragraph_storage->getQuery()->condition('type', 'simple_content')->accessCheck(FALSE)->execute();
$n = 0;
foreach (\Drupal\paragraphs\Entity\Paragraph::loadMultiple($ids) as $p) {
  if ($p->get('field_link_alignment')->isEmpty()) {
    $p->set('field_link_alignment', 'left');
    $p->save();
    $n++;
  }
}
echo "backfilled field_link_alignment (-> left) on $n simple_content paragraph(s)\n";

$ids2 = $paragraph_storage->getQuery()->condition('type', 'compound_header_content')->accessCheck(FALSE)->execute();
$n2 = 0;
foreach (\Drupal\paragraphs\Entity\Paragraph::loadMultiple($ids2) as $p) {
  if ($p->get('field_hero_bg')->isEmpty()) {
    $p->set('field_hero_bg', 'gradient');
    $p->save();
    $n2++;
  }
}
echo "backfilled field_hero_bg (-> gradient) on $n2 compound_header_content paragraph(s)\n";

// --- Card CTAs: the same card showed "Read more" on one page and "Learn
//     more" on another (the link's own Link text was typed in as "Read
//     more"). Client wants one consistent label — blank the typed
//     "Read more" so the card's "Learn more" default applies. ------------
$card_ids = \Drupal::entityTypeManager()->getStorage('paragraph')->getQuery()
  ->condition('type', 'simple_card')->accessCheck(FALSE)->execute();
$n = 0;
foreach (\Drupal\paragraphs\Entity\Paragraph::loadMultiple($card_ids) as $card) {
  if (!$card->get('field_link')->isEmpty() && strcasecmp(trim((string) $card->get('field_link')->title), 'Read more') === 0) {
    $link = $card->get('field_link')->first()->getValue();
    $link['title'] = '';
    $card->set('field_link', [$link]);
    $card->save();
    $n++;
  }
}
echo "cleared \"Read more\" link text on $n simple_card paragraph(s)\n";

// --- Institutions & Organizations: client wants the plain, hero-less layout
//     (like the Coordinator List) — just the intro + the filterable table.
//     Detach the hero paragraph from the node (the paragraph stays in its
//     revisions, so it's recoverable from the revision history). ----------
foreach (['Institutions & Organizations', 'Member Institutions & Organizations'] as $title) {
  foreach (\Drupal::entityTypeManager()->getStorage('node')->loadByProperties(['type' => 'landing_page', 'title' => $title]) as $node) {
    if (!$node->get('field_p_header')->isEmpty()) {
      $node->set('field_p_header', []);
      $node->save();
      echo "node {$node->id()} ($title): hero removed\n";
    }
    else {
      echo "node {$node->id()} ($title): already hero-less, skipped\n";
    }
  }
}

echo "DONE\n";
