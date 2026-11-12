<?php

/**
 * @file
 * Go-live clean-up: content that was pasted from a test environment carries
 * that environment's hostname (https://nginx.feature-refresh.….amazee.io/foo,
 * the old portal …develop….amazee.io host). Copied to production those links
 * would point at the test site. Rewrite them to plain site-relative links
 * (/foo), which work on every environment.
 *
 * Only the host is removed — path, query and anchor stay. Touches paragraph
 * body / text-area / link fields and custom block bodies, nothing else.
 * Safe to re-run (nothing left to change = no writes). Run it BEFORE copying
 * the database to production, and once more on production afterwards.
 *
 * Preview:  DRY_RUN=1 drush php:script scripts/env-hostnames.php
 * Apply:    drush php:script scripts/env-hostnames.php
 */

$dry = (bool) getenv('DRY_RUN');
$etm = \Drupal::entityTypeManager();
$db = \Drupal::database();

// Any Lagoon / amazee.io environment host.
$host = 'https?://[a-z0-9.\-]*amazee\.io';
$text_re = '#' . $host . '(?=[/?\#"\'<>\s]|$)#i';

$targets = [
  // [entity type, field, kind, base table, value column]
  ['paragraph', 'field_body', 'text', 'paragraph__field_body', 'field_body_value'],
  ['paragraph', 'field_text_area', 'text', 'paragraph__field_text_area', 'field_text_area_value'],
  ['paragraph', 'field_link', 'link', 'paragraph__field_link', 'field_link_uri'],
  ['block_content', 'body', 'text', 'block_content__body', 'body_value'],
];

$changed_entities = 0;
foreach ($targets as [$type, $field, $kind, $table, $col]) {
  if (!$db->schema()->tableExists($table)) {
    continue;
  }
  $ids = $db->select($table, 't')->fields('t', ['entity_id'])->condition($col, '%amazee.io%', 'LIKE')
    ->condition('deleted', 0)->distinct()->execute()->fetchCol();
  foreach ($etm->getStorage($type)->loadMultiple($ids) as $entity) {
    $items = $entity->get($field)->getValue();
    $n = 0;
    foreach ($items as &$item) {
      if ($kind === 'text') {
        $new = preg_replace_callback($text_re, function () use (&$n) { $n++; return ''; }, $item['value']);
        // A bare host (href="https://host") must still be a valid link.
        $new = preg_replace('#(href=["\'])(["\'])#i', '$1/$2', $new);
        $item['value'] = $new;
      }
      elseif (preg_match('#^' . $host . '(/.*)?$#i', $item['uri'], $m)) {
        $item['uri'] = 'internal:' . (($m[1] ?? '') ?: '/');
        $n++;
      }
    }
    unset($item);
    if ($n) {
      echo ($dry ? '[dry-run] ' : '') . "$type {$entity->id()} $field: $n link(s) made relative\n";
      if (!$dry) {
        $entity->set($field, $items);
        $entity->save();
      }
      $changed_entities++;
    }
  }
}
echo "$changed_entities item(s) " . ($dry ? 'would be ' : '') . "updated\nDONE\n";
