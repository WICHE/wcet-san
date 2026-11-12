<?php

/**
 * Creates a demo "article" resource with real prose + Quick links so the
 * two-column article design (Figma 53:499) can be validated and used as an
 * authoring template. Idempotent-ish: deletes a prior demo by title first.
 */

use Drupal\node\Entity\Node;
use Drupal\paragraphs\Entity\Paragraph;

$title = 'DEMO: 15 Years of Connection — How SAN Built a National Compliance Community';

// Clean up any prior demo.
$old = \Drupal::entityQuery('node')->condition('type', 'resource')
  ->condition('title', $title)->accessCheck(FALSE)->execute();
if ($old) {
  foreach (Node::loadMultiple($old) as $n) { $n->delete(); }
  echo "removed " . count($old) . " prior demo(s)\n";
}

// Prose body (simple_content → field_body).
$body = <<<HTML
<p>For 15 years, the State Authorization Network has supported higher education institutions navigating the complexities of interstate compliance for distance education.</p>
<p>SAN currently serves more than 975 institutions and organizations nationwide. What began as a response to emerging federal regulations in late 2010 has grown into a national community of practice, connecting professionals, shaping institutional approaches, and advancing shared understanding across an evolving regulatory landscape.</p>
<p>This anniversary offers an opportunity to reflect on how SAN has built that community through collaboration, resources, and engagement; strengthened connections across key higher education organizations; and expanded its work to support institutions managing increasingly complex state, federal, and professional licensure requirements.</p>
<p>In 2010, when institutions across the country were expanding online offerings and facing the first iteration of federal regulations for state authorization of distance education, the staff supporting this work discovered that crossing state lines meant navigating a patchwork of different requirements, rules, and expectations with very little shared guidance.</p>
HTML;

$prose = Paragraph::create([
  'type' => 'simple_content',
  'field_body' => ['value' => $body, 'format' => 'full_html'],
]);
$prose->save();

// Quick links (single_link × 4).
$links = [];
foreach ([
  ['State Authorization 101', 'https://wcetsan.wiche.edu/'],
  ['Federal Regulations overview', 'https://wcetsan.wiche.edu/'],
  ['Professional Licensure resources', 'https://wcetsan.wiche.edu/'],
  ['Reciprocity (SARA) guidance', 'https://wcetsan.wiche.edu/'],
] as $l) {
  $p = Paragraph::create([
    'type' => 'single_link',
    'field_link' => ['uri' => $l[1], 'title' => $l[0]],
    'field_link_style' => 'link',
  ]);
  $p->save();
  $links[] = ['target_id' => $p->id(), 'target_revision_id' => $p->getRevisionId()];
}

$node = Node::create([
  'type' => 'resource',
  'title' => $title,
  'status' => 1,
  'uid' => 1,
  'field_resource_type' => ['target_id' => 18],           // Article (WCET Frontiers)
  'field_topic' => [['target_id' => 1], ['target_id' => 614]],
  'field_content_access' => 'public',
  'field_p_content' => [
    ['target_id' => $prose->id(), 'target_revision_id' => $prose->getRevisionId()],
  ],
  'field_p_resources' => $links,
]);
$node->save();

echo "created demo article: node " . $node->id() . "\n";
echo "url: " . $node->toUrl()->toString() . "\n";
