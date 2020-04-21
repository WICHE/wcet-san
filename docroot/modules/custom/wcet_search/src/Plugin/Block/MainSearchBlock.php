<?php

namespace Drupal\wcet_search\Plugin\Block;

use Drupal\Core\Block\BlockBase;

/**
 * Provides a block for a complex site-wide search with filters and facets.
 *
 * @Block(
 *  id = "main_search_block",
 *  admin_label = @Translation("Main Search Form"),
 *  category = @Translation("WCET|SAN Search"),
 * )
 */
class MainSearchBlock extends BlockBase {
  /**
   * {@inheritDoc}
   */
  public function build() {
    $build = [];
    $build['main_search_block'] = [
      '#markup' => '<div id="search-app--main"></div>',
      '#attached' => [
        'library' => ['themekit/main_search_block'],
      ],
    ];
    return $build;
  }
}
