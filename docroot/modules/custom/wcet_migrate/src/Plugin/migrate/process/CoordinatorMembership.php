<?php
/**
 * @file
 * Contains \Drupal\wcet_migrate\Plugin\migrate\process\AddTermReference.
 */

namespace Drupal\wcet_migrate\Plugin\migrate\process;

use Drupal\migrate\Annotation\MigrateProcessPlugin;
use Drupal\migrate\MigrateExecutableInterface;
use Drupal\migrate\Row;
use Drupal\migrate_plus\Plugin\migrate\process\EntityGenerate;

/**
 * Extends the EntityGenerate plugin, allowing to set the value of the 'Compact' field.
 *
 * @MigrateProcessPlugin(
 *   id = "coordinator_membership",
 * )
 */
class CoordinatorMembership extends EntityGenerate {

  /**
   * Currently processed row.
   *
   * @var \Drupal\migrate\Row
   */
  protected $currentRow;

  /**
   * {@inheritdoc}
   */
  public function transform($value, MigrateExecutableInterface $migrate_executable, Row $row, $destination_property) {
    // Save the current row so it's values can be used later.
    $this->currentRow = $row;

    return parent::transform($value, $migrate_executable, $row, $destination_property);
  }

  /**
   * {@inheritdoc}
   */
  protected function entity($value) {
    $entity_values = parent::entity($value);

    // Set Compact value from the csv.
    $compact = $this->currentRow->getSourceProperty('compact');

    if ($compact) {
      $entity_values['field_membership_compact'] = $this->currentRow->getSourceProperty('compact');
    }

    return $entity_values;
  }
}
