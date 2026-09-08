<?php

use Drupal\paragraphs\Entity\Paragraph;
use Drupal\node\Entity\Node;

/** Create a paragraph, return the ERR field value [target_id, target_revision_id]. */
function wiche_p(string $type, array $fields): array {
  $p = Paragraph::create(['type' => $type] + $fields);
  $p->save();
  return ['target_id' => $p->id(), 'target_revision_id' => $p->getRevisionId()];
}

// If a demo node already exists, delete it so this is repeatable.
$existing = \Drupal::entityTypeManager()->getStorage('node')
  ->loadByProperties(['title' => 'Wiche Design Demo', 'type' => 'landing_page']);
foreach ($existing as $n) { $n->delete(); }

// --- Hero (field_p_header) ---
$hero = wiche_p('compound_header_content', [
  'field_subheader' => 'The State Authorization Network',
  'field_header' => 'The leader for guidance and support for navigating state and federal regulatory compliance for out-of-state activities of postsecondary institutions.',
  'field_subheader_as_h1' => TRUE,
]);

// --- Federal Policy update: CTA cards ---
$fed = wiche_p('compound_card_row', [
  'field_header' => 'Federal Policy update',
  'field_p_cards' => [
    wiche_p('simple_card', [
      'field_header' => 'AHEAD Committee Pell & Workforce Pell',
      'field_subheader' => 'Final Regulations released May 19, 2026. Effective date 7/20/2026.',
      'field_link' => ['uri' => 'https://www.ed.gov', 'title' => 'Visit external website'],
    ]),
    wiche_p('simple_card', [
      'field_header' => 'RISE Committee',
      'field_subheader' => 'Final Regulations released 5/1/26. Effective 7/1/26. (Loan Limits & Definition of Professional Student).',
      'field_link' => ['uri' => 'https://www.ed.gov', 'title' => 'Visit website'],
    ]),
    wiche_p('simple_card', [
      'field_header' => 'AIM (Accreditation) Committee Rulemaking Meetings; Consensus Reached',
      'field_subheader' => 'Visit the ED website for posted documents and view the consensus language (PDF).',
      'field_link' => ['uri' => 'https://www.ed.gov', 'title' => 'Visit website'],
    ]),
  ],
]);

// --- Quick Links: link cards (no body → "Read more") ---
$quick = wiche_p('compound_card_row', [
  'field_header' => 'Quick Links',
  'field_p_cards' => [
    wiche_p('simple_card', ['field_header' => 'Federal Regulations', 'field_link' => ['uri' => 'internal:/', 'title' => 'Read more']]),
    wiche_p('simple_card', ['field_header' => 'U.S. Department of Education Rulemaking Process', 'field_link' => ['uri' => 'internal:/', 'title' => 'Read more']]),
    wiche_p('simple_card', ['field_header' => 'Higher Education Act (HEA)', 'field_link' => ['uri' => 'internal:/', 'title' => 'Read more']]),
  ],
]);

// --- FAQ / accordion ---
$faq = wiche_p('compound_faq_section', [
  'field_header' => 'Resources to Manage Compliance',
  'field_p_faq' => [
    wiche_p('simple_faq', ['field_header' => 'SAN Essentials', 'field_body' => ['value' => '<p>One or two page abstracts of basic compliance areas to provide general understanding.</p>', 'format' => 'basic_html']]),
    wiche_p('simple_faq', ['field_header' => 'SAN Tables', 'field_body' => ['value' => '<p>Resource tables and charts to find links and directions for compliance research.</p>', 'format' => 'basic_html']]),
    wiche_p('simple_faq', ['field_header' => 'SAN Next Level', 'field_body' => ['value' => '<p>One or two page abstracts of beyond-basic compliance issues to consider to manage compliance.</p>', 'format' => 'basic_html']]),
    wiche_p('simple_faq', ['field_header' => 'SAN Papers', 'field_body' => ['value' => '<p>Short papers on various compliance issues providing greater nuance to the issue.</p>', 'format' => 'basic_html']]),
  ],
]);

// --- CTA banner (simple_content with link + no body) ---
$cta = wiche_p('simple_content', [
  'field_header' => 'Join SAN and Become a Member',
  'field_link' => ['uri' => 'internal:/', 'title' => 'Learn more'],
]);

// --- Resources summary (topic terms → cards) ---
$resources = wiche_p('summary_resources', [
  'field_summary_topics' => [['target_id' => 6], ['target_id' => 1], ['target_id' => 4], ['target_id' => 614], ['target_id' => 613], ['target_id' => 7]],
  'field_link' => ['uri' => 'internal:/resources/all', 'title' => 'View all resources'],
]);

$node = Node::create([
  'type' => 'landing_page',
  'title' => 'Wiche Design Demo',
  'field_p_header' => [$hero],
  'field_p_content' => [$fed, $quick, $faq, $resources, $cta],
  'status' => 1,
  'uid' => 1,
]);
$node->save();

echo "DEMO_NODE_ID=" . $node->id() . "\n";
echo "DEMO_URL=/node/" . $node->id() . "\n";
