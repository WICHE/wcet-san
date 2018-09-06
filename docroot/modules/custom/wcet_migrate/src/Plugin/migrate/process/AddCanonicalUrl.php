<?php

namespace Drupal\wcet_migrate\Plugin\migrate\process;

use Drupal\migrate\Annotation\MigrateProcessPlugin;
use Drupal\migrate\MigrateExecutableInterface;
use Drupal\migrate\ProcessPluginBase;
use Drupal\migrate\Row;

/**
 * Populate Meta Tags canonical url.
 *
 * @MigrateProcessPlugin(
 *   id = "add_canonical_url",
 * )
 */
class AddCanonicalUrl extends ProcessPluginBase {

  /**
   * {@inheritdoc}
   */
  public function transform($value, MigrateExecutableInterface $migrate_executable, Row $row, $destination_property) {

    // Meta tags are serialized, create an appropriate array and serialize it.
    $meta_tags = [
      'canonical_url' => $value,
    ];

    return serialize($meta_tags);
  }

}
