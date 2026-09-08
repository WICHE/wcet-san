<?php

/**
 * @file
 * Recreates the two custom footer blocks (content, not config) that the theme's
 * footer regions render. Their placements live in config
 * (block.block.wiche_footer_cols / _wcet) and reference these block_content
 * entities by a fixed UUID, so they MUST be recreated with the SAME UUIDs or
 * the footer renders empty after a database import.
 *
 * Run after `drush cim`, on each environment:
 *   drush php:script scripts/footer-blocks.php
 *
 * Idempotent: updates the block in place if it already exists. Body HTML lives
 * in scripts/content/*.html so it is easy to edit.
 */

use Drupal\block_content\Entity\BlockContent;

$blocks = [
  ['uuid' => '4c6674a7-5234-4cdb-9a9c-912237b4e280', 'info' => 'Wiche footer columns', 'file' => 'footer-cols.html'],
  ['uuid' => '592ad313-085d-4141-898b-08935f191f01', 'info' => 'Wiche footer WCET band', 'file' => 'footer-wcet.html'],
];

$storage = \Drupal::entityTypeManager()->getStorage('block_content');
$dir = __DIR__ . '/content/';

foreach ($blocks as $b) {
  $html = file_get_contents($dir . $b['file']);
  if ($html === FALSE) { echo "  ! missing {$b['file']}\n"; continue; }

  $existing = $storage->loadByProperties(['uuid' => $b['uuid']]);
  $block = $existing ? reset($existing) : BlockContent::create(['type' => 'basic', 'uuid' => $b['uuid']]);
  $block->set('info', $b['info']);
  $block->set('reusable', TRUE);
  $block->set('body', ['value' => $html, 'format' => 'full_html']);
  $block->save();
  echo ($existing ? 'updated' : 'created') . " \"{$b['info']}\" (uuid {$b['uuid']})\n";
}

echo "DONE\n";
