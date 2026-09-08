<?php

/**
 * @file
 * Component showcase — a landing page (/wiche-design-demo) rendering (nearly)
 * every paragraph type so the client can review that each is styled.
 *
 * Covers 16 of the 18 bundles. Not shown: single_video + single_svg (dead
 * bundles — no field references them, so they can't be placed) and
 * reference_block (embeds an arbitrary block, no styling of its own).
 *
 * Idempotent (delete-by-title). Run: drush php:script scripts/demo-landing.php
 */

use Drupal\node\Entity\Node;
use Drupal\paragraphs\Entity\Paragraph;

/** Create a paragraph, return its ERR reference value. */
function wp(string $type, array $fields): array {
  $p = Paragraph::create(['type' => $type] + $fields);
  $p->save();
  return ['target_id' => $p->id(), 'target_revision_id' => $p->getRevisionId()];
}

foreach (\Drupal::entityTypeManager()->getStorage('node')
  ->loadByProperties(['title' => 'Wiche Design Demo', 'type' => 'landing_page']) as $n) {
  $n->delete();
}

// Sample media (from prod content) for the single_image / single_file demos.
$img_media = current(\Drupal::entityQuery('media')->condition('bundle', 'image')->accessCheck(FALSE)->range(0, 1)->execute()) ?: NULL;
$file_media = current(\Drupal::entityQuery('media')->condition('bundle', 'file')->accessCheck(FALSE)->range(0, 1)->execute()) ?: NULL;
$topics = [['target_id' => 6], ['target_id' => 1], ['target_id' => 4], ['target_id' => 614]];

// --- Hero (compound_header_content) + single_text_area in its secondary slot -
$hero = wp('compound_header_content', [
  'field_subheader' => 'The State Authorization Network',
  'field_header' => 'The leader for guidance and support for navigating state and federal regulatory compliance for out-of-state activities of postsecondary institutions.',
  'field_subheader_as_h1' => TRUE,
  'field_p_secondary_content' => [
    wp('single_text_area', [
      'field_text_area' => ['value' => '<p><strong>single_text_area</strong> — a rich-text block. SAN sponsored analysis, best practices, training, timely updates, and resources are provided for members.</p>', 'format' => 'full_html'],
    ]),
  ],
]);

$content = [];

// 1. compound_card_row — CTA cards (simple_card with body + link)
$content[] = wp('compound_card_row', [
  'field_header' => 'Federal Policy update',
  'field_p_cards' => [
    wp('simple_card', ['field_header' => 'AHEAD Committee Pell & Workforce Pell', 'field_subheader' => 'Final Regulations released May 19, 2026. Effective date 7/20/2026.', 'field_link' => ['uri' => 'https://www.ed.gov', 'title' => 'Visit external website']]),
    wp('simple_card', ['field_header' => 'RISE Committee', 'field_subheader' => 'Final Regulations released 5/1/26. Effective 7/1/26 (Loan Limits & Definition of Professional Student).', 'field_link' => ['uri' => 'https://www.ed.gov', 'title' => 'Visit website']]),
    wp('simple_card', ['field_header' => 'AIM (Accreditation) Committee Rulemaking; Consensus Reached', 'field_subheader' => 'Visit the ED website for posted documents and the consensus language (PDF).', 'field_link' => ['uri' => 'https://www.ed.gov', 'title' => 'Visit website']]),
  ],
]);

// 2. compound_card_row — Quick-link cards (simple_card, link only)
$content[] = wp('compound_card_row', [
  'field_header' => 'Quick Links',
  'field_p_cards' => [
    wp('simple_card', ['field_header' => 'Federal Regulations', 'field_link' => ['uri' => 'internal:/resources/federal-regulations', 'title' => 'Read more']]),
    wp('simple_card', ['field_header' => 'Professional Licensure', 'field_link' => ['uri' => 'internal:/resources/professional-licensure', 'title' => 'Read more']]),
    wp('simple_card', ['field_header' => 'Reciprocity (SARA)', 'field_link' => ['uri' => 'internal:/resources/reciprocity-sara', 'title' => 'Read more']]),
  ],
]);

// 3. simple_content — content block (header + body, no link)
$content[] = wp('simple_content', [
  'field_header' => 'About the network',
  'field_subheader' => 'A national community of practice.',
  'field_body' => ['value' => '<p>For 15 years, the State Authorization Network has supported higher education institutions navigating the complexities of interstate compliance for distance education. SAN currently serves more than 975 institutions and organizations nationwide.</p>', 'format' => 'full_html'],
]);

// 4. layout_two_column — nesting single_image, single_link, single_file
$left = [];
if ($img_media) {
  $left[] = wp('single_image', ['field_media_image' => ['target_id' => $img_media]]);
}
$left[] = wp('single_link', ['field_link' => ['uri' => 'internal:/membership', 'title' => 'Become a member'], 'field_link_style' => 'primary']);
$right = [
  wp('simple_content', ['field_header' => 'Two-column layout', 'field_body' => ['value' => '<p>The <strong>layout_two_column</strong> paragraph places content side by side. This column holds a content block and a downloadable file.</p>', 'format' => 'full_html']]),
];
if ($file_media) {
  $right[] = wp('single_file', ['field_header' => 'Sample document', 'field_media_file' => ['target_id' => $file_media], 'field_link_style' => 'secondary']);
}
$content[] = wp('layout_two_column', [
  'field_header' => 'Layout: two column',
  'field_p_left_column' => $left,
  'field_p_right_column' => $right,
]);

// 5. compound_faq_section (+ simple_faq)
$content[] = wp('compound_faq_section', [
  'field_header' => 'Resources to Manage Compliance',
  'field_p_faq' => [
    wp('simple_faq', ['field_header' => 'SAN Essentials', 'field_body' => ['value' => '<p>One or two page abstracts of basic compliance areas to provide general understanding.</p>', 'format' => 'basic_html']]),
    wp('simple_faq', ['field_header' => 'SAN Tables', 'field_body' => ['value' => '<p>Resource tables and charts to find links and directions for compliance research.</p>', 'format' => 'basic_html']]),
    wp('simple_faq', ['field_header' => 'SAN Next Level', 'field_body' => ['value' => '<p>Abstracts of beyond-basic compliance issues to consider when managing compliance.</p>', 'format' => 'basic_html']]),
    wp('simple_faq', ['field_header' => 'SAN Papers', 'field_body' => ['value' => '<p>Short papers on various compliance issues providing greater nuance.</p>', 'format' => 'basic_html']]),
  ],
]);

// 6-8. summaries (topic-driven card grids)
$content[] = wp('summary_resources', ['field_summary_topics' => $topics, 'field_link' => ['uri' => 'internal:/resources/all', 'title' => 'View all resources']]);
$content[] = wp('summary_events', ['field_summary_topics' => $topics, 'field_link' => ['uri' => 'internal:/events', 'title' => 'View all events']]);
$content[] = wp('summary_past_events', ['field_summary_topics' => $topics, 'field_link' => ['uri' => 'internal:/events/past', 'title' => 'View past events']]);

// 9. table_with_filters
$content[] = wp('table_with_filters', [
  'field_header' => 'Table with filters',
  'field_table_data' => ['value' => '<table><thead><tr><th>State</th><th>SARA member</th><th>Notes</th></tr></thead><tbody><tr><td>Colorado</td><td>Yes</td><td>—</td></tr><tr><td>California</td><td>No</td><td>Non-SARA requirements apply</td></tr><tr><td>Texas</td><td>Yes</td><td>—</td></tr></tbody></table>', 'format' => 'full_html'],
]);

// 10. simple_content — CTA banner (link + no body)
$content[] = wp('simple_content', [
  'field_header' => 'Join SAN and Become a Member',
  'field_link' => ['uri' => 'internal:/membership', 'title' => 'Learn more'],
]);

$node = Node::create([
  'type' => 'landing_page',
  'title' => 'Wiche Design Demo',
  'status' => 1,
  'uid' => 1,
  'field_p_header' => [$hero],
  'field_p_content' => $content,
]);
$node->save();

echo 'DEMO_NODE_ID=' . $node->id() . "\n";
echo 'url: ' . $node->toUrl()->toString() . "\n";
