<?php
/**
 * @file
 * Contains \Drupal\wcet_migrate\Plugin\migrate\process\AddDate.
 */

namespace Drupal\wcet_migrate\Plugin\migrate\process;

use Drupal\migrate\MigrateExecutableInterface;
use Drupal\migrate\ProcessPluginBase;
use Drupal\migrate\Row;

/**
 * Format the date in the RSS feed to a UNIX timestamp.
 *
 * @MigrateProcessPlugin(
 *   id = "add_date",
 * )
 */
class AddDate extends ProcessPluginBase {

  /**
   * {@inheritdoc}
   */
  public function transform($value, MigrateExecutableInterface $migrate_executable, Row $row, $destination_property) {
    $date = new \DateTime($value);
    return $date->getTimestamp();
  }

}
