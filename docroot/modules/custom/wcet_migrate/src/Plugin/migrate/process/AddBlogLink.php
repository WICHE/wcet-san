<?php
/**
 * @file
 * Contains \Drupal\wcet_migrate\Plugin\migrate\process\AddBlogLink.
 */

namespace Drupal\wcet_migrate\Plugin\migrate\process;

use Drupal\migrate\MigrateExecutableInterface;
use Drupal\migrate\ProcessPluginBase;
use Drupal\migrate\Row;
use Drupal\paragraphs\Entity\Paragraph;

/**
 * Create a Single - Link paragraph containing a link to the full blog post.
 *
 * @MigrateProcessPlugin(
 *   id = "add_blog_link",
 * )
 */
class AddBlogLink extends ProcessPluginBase {

  /**
   * {@inheritdoc}
   */
  public function transform($value, MigrateExecutableInterface $migrate_executable, Row $row, $destination_property) {
    // Get the link for the blog and create a Single - Link paragraph with it
    $paragraph = Paragraph::create([
      'type'       => 'single_link',
      'field_link' => [
        'uri'     => $value,
        'title'   => 'Read More',
        'options' => [
          'target' => '_blank',
        ],
      ],
    ]);
    $paragraph->save();
    return $paragraph;
  }

}
