<?php

/**
 * @file
 * Content-side setup for the native search page.
 *
 * The search view + database server + index are config (applied by `drush cim`).
 * This handles the two CONTENT bits config can't carry:
 *   - frees the /search path (prod's old React "Search" landing node owns that
 *     alias, which would otherwise shadow the search view's /search route),
 *   - unpublishes that old landing node.
 *
 * Run after `drush cim`, then reindex:
 *   drush php:script scripts/search-setup.php
 *   drush search-api:index index
 *
 * Idempotent.
 */

$path = \Drupal::service('path_alias.manager')->getPathByAlias('/search');

$storage = \Drupal::entityTypeManager()->getStorage('path_alias');
$aliases = $storage->loadByProperties(['alias' => '/search']);
foreach ($aliases as $alias) {
  $alias->delete();
}
echo 'removed ' . count($aliases) . " /search alias(es)\n";

if (preg_match('#/node/(\d+)#', $path, $m)) {
  $node = \Drupal\node\Entity\Node::load($m[1]);
  if ($node && $node->isPublished()) {
    $node->setUnpublished()->save();
    echo "unpublished old search landing node {$m[1]}\n";
  }
}

echo "DONE — now reindex:  drush search-api:index index\n";
