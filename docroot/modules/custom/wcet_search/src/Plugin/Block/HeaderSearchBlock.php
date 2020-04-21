<?php

namespace Drupal\wcet_search\Plugin\Block;

use Drupal\Core\Block\BlockBase;

/**
 * Provides a block for a simply keyword input filter, connecting to site-wide search
 *
 * @Block(
 *  id = "header_search_block",
 *  admin_label = @Translation("Header Search Form"),
 *  category = @Translation("WCET|SAN Search"),
 * )
 */
class HeaderSearchBlock extends BlockBase {
  /**
   * {@inheritDoc}
   */
  public function build() {
    $build = [];
    $build['header_search_block'] = [
      '#markup' => '<div id="search-app--header"></div>',
      '#attached' => [
        'library' => ['themekit/header_search_block'],
      ],
    ];
    return $build;
  }
}
