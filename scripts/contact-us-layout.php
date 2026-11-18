<?php

/**
 * @file
 * Contact Us: switch the staff rows to the "Photo + text" two-column style.
 *
 * Only touches two-column rows that have never had a layout chosen (no stored
 * value), so a row someone has since set — either way — is left alone. Nothing
 * else on the page is changed. Matched by title (node IDs differ per
 * environment). Safe to re-run.
 *
 * Preview:  DRY_RUN=1 drush php:script scripts/contact-us-layout.php
 * Apply:    drush php:script scripts/contact-us-layout.php
 */

$dry = (bool) getenv('DRY_RUN');

foreach (\Drupal::entityTypeManager()->getStorage('node')->loadByProperties(['type' => 'landing_page', 'title' => 'Contact Us']) as $node) {
  $n = 0;
  foreach ($node->get('field_p_content')->referencedEntities() as $row) {
    if ($row->bundle() !== 'layout_two_column') {
      continue;
    }
    if (!$row->get('field_column_layout')->isEmpty()) {
      echo "paragraph {$row->id()}: already set ({$row->get('field_column_layout')->value}), left alone\n";
      continue;
    }
    if (!$dry) {
      $row->set('field_column_layout', 'profile');
      $row->save();
    }
    echo ($dry ? '[dry-run] ' : '') . "paragraph {$row->id()}: -> photo + text\n";
    $n++;
  }
  echo "node {$node->id()} (Contact Us): $n row(s) changed\n";
}
echo "DONE\n";
