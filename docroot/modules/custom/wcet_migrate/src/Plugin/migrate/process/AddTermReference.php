<?php
/**
 * @file
 * Contains \Drupal\wcet_migrate\Plugin\migrate\process\AddTermReference.
 */

namespace Drupal\wcet_migrate\Plugin\migrate\process;

use Drupal\migrate\MigrateExecutableInterface;
use Drupal\migrate\ProcessPluginBase;
use Drupal\migrate\Row;
use Drupal\taxonomy\Entity\Term;

/**
 * Add a term reference to a node.
 *
 * @MigrateProcessPlugin(
 *   id = "add_term_reference",
 * )
 */
class AddTermReference extends ProcessPluginBase {

  /**
   * {@inheritdoc}
   */
  public function transform($value, MigrateExecutableInterface $migrate_executable, Row $row, $destination_property) {
    // Get the term name defined in the migration YAML file
    $vocabulary = $this->configuration['vocabulary'];
    $term_name = $this->configuration['term_name'];
    // Load the taxonomy term if it exists, create it if it doesn't, and return its TID
    $terms = \Drupal::entityTypeManager()
      ->getStorage('taxonomy_term')
      ->loadByProperties(['name' => $term_name]);
    if (!empty($terms)) {
      $term = reset($terms);
    }
    else {
      $term = Term::create([
        'name' => $term_name,
        'vid'  => $vocabulary,
      ]);
      $term->save();
    }
    return $term;
  }

}
