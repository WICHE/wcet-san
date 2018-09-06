<?php

namespace Drupal\wcet_migrate\Plugin\migrate\process;

use CommerceGuys\Addressing\Subdivision\SubdivisionRepository;
use Drupal\migrate\Annotation\MigrateProcessPlugin;
use Drupal\migrate\MigrateExecutableInterface;
use Drupal\migrate\ProcessPluginBase;
use Drupal\migrate\Row;

/**
 * Imports address fields using the csv address columns.
 *
 * @MigrateProcessPlugin(
 *   id = "coordinator_address"
 * )
 */
class CoordinatorAddress extends ProcessPluginBase {

  /**
   * {@inheritdoc}
   */
  public function transform($value, MigrateExecutableInterface $migrate_executable, Row $row, $destination_property) {

    $state_name = $row->getSourceProperty('state');
    $subdivision_repo = new SubdivisionRepository();
    $states = $subdivision_repo->getList(['US']);
    $state_key = array_search($state_name, $states);

    if (!empty($state_key)) {
      $parsed = [
        'country_code' => 'US',
        'administrative_area' => $state_key,
        'address_line1' => $row->getSourceProperty('street_address'),
        'address_line2' => '',
        'locality' => $row->getSourceProperty('city'),
        'postal_code' => $row->getSourceProperty('zip_code'),
        'organization' => '',
      ];
    }
    else {
      $parsed = [
        'country_code' => 'US',
      ];
    }

    return $parsed;
  }

}
