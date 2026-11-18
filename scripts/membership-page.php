<?php

/**
 * Rebuilds the /membership landing page (node 25) to match the Figma
 * "Memberships - overview" design (72:1528): half-image hero → "Quick links"
 * 3-card band → "Join SAN" text → CTA banner → "SAN Benefits at a Glance" →
 * "Membership Fee Structure".
 *
 * Body copy is transcribed from the mockup and should be proofread against the
 * real source (emails / phone numbers / dates especially). The node's previous
 * field_p_content is backed up to public:// first, so this is reversible.
 */

use Drupal\node\Entity\Node;
use Drupal\paragraphs\Entity\Paragraph;

// Resolve the membership landing page by its alias (node id may differ per env).
$path = \Drupal::service('path_alias.manager')->getPathByAlias('/membership');
$node = preg_match('#/node/(\d+)#', $path, $m) ? Node::load($m[1]) : NULL;
if (!$node || $node->bundle() !== 'landing_page') {
  echo "membership landing page (/membership) not found — skipping\n";
  return;
}
echo "membership page = node " . $node->id() . "\n";

// --- Back up current paragraphs -------------------------------------------
$backup = ['field_p_header' => [], 'field_p_content' => []];
foreach (['field_p_header', 'field_p_content'] as $f) {
  foreach ($node->get($f) as $item) {
    if ($item->entity) { $backup[$f][] = ['bundle' => $item->entity->bundle(), 'values' => $item->entity->toArray()]; }
  }
}
\Drupal::service('file_system')->saveData(json_encode($backup, JSON_PRETTY_PRINT), 'public://membership-node25-backup-' . date('Ymd-His') . '.json');
echo "backed up node 25 paragraphs\n";

/** Save a paragraph and return the field reference value. */
$ref = function (Paragraph $p): array {
  $p->save();
  return ['target_id' => $p->id(), 'target_revision_id' => $p->getRevisionId()];
};

// --- Hero (keep the existing image; refresh the copy) ----------------------
$hero = $node->get('field_p_header')->entity;
if ($hero && $hero->bundle() === 'compound_header_content') {
  $hero->set('field_subheader', 'Membership');
  $hero->set('field_header', 'Memberships - overview');
  $hero->set('field_subheader_as_h1', TRUE);
  $node->set('field_p_header', [$ref($hero)]);
}

// --- Quick links (compound_card_row + 3 simple_card link cards) ------------
$cards = [];
foreach ([
  ['How to Join?', '/membership'],
  ['SAN Benefits at a Glance', '/membership'],
  ['Membership Fee Structure', '/membership'],
] as $c) {
  $cards[] = $ref(Paragraph::create([
    'type' => 'simple_card',
    'field_header' => $c[0],
    'field_link' => ['uri' => 'internal:' . $c[1], 'title' => 'Read more'],
  ]));
}
$quicklinks = $ref(Paragraph::create([
  'type' => 'compound_card_row',
  'field_header' => 'Quick links',
  'field_p_cards' => $cards,
]));

// --- Join SAN --------------------------------------------------------------
$join_body = <<<HTML
<p>What is the relationship between the federal state authorization regulations and state level state authorization regulations?</p>
<h3>How to Join?</h3>
<p><strong>Step 1:</strong> Review the <a href="/about-san/statement-work">Statement of Work and Call for Participation / Invitation</a>.</p>
<p><strong>Step 2:</strong> New members must complete a short online application: <a href="/form/join-san">SAN Member Form</a>.</p>
<p><strong>Step 3:</strong> An invoice for payment will be sent shortly after receipt of the online membership application.</p>
<p><strong>Deadline:</strong> Deadline for new member application submission is June 1, with payment due by July 1 each year. The SAN Year runs July 1 – June 30.</p>
<p><strong>Beyond the Deadline?</strong> Contact us about the possibility of a partial-year membership.</p>
<p><strong>Renewals?</strong> Please review the information on the <a href="/about-san/statement-work">Statement of Work webpage</a>.</p>
<p>For any questions about the application, please contact Cheryl Dowd or Leigha Wade via the <a href="/contact">Contact Us</a> page. See also <a href="/member-institutions-organizations">Current SAN Institutions and Organizations</a>.</p>
HTML;
$join = $ref(Paragraph::create([
  'type' => 'simple_content',
  'field_header' => 'Join SAN',
  'field_body' => ['value' => $join_body, 'format' => 'full_html'],
]));

// --- CTA banner ------------------------------------------------------------
$cta = $ref(Paragraph::create([
  'type' => 'simple_content',
  'field_header' => 'Join SAN and Become a Member',
  'field_link' => ['uri' => 'internal:/form/join-san', 'title' => 'Learn more'],
]));

// --- SAN Benefits at a Glance ---------------------------------------------
$benefits_body = <<<HTML
<h3>Coordinators for each membership</h3>
<p><a href="/membership">SAN Membership Coordinator Welcome Information</a></p>
<p>Additional interactions for the coordinators who manage the SAN memberships:</p>
<ul>
<li><strong>SAN Coordinator Annual Meeting</strong> (in person) — update / feedback session.</li>
<li><strong>SAN Monthly Coordinator conference calls</strong> — 4th Tuesday of each month (10AM Alaska, 11AM Pacific, Noon Mountain, 1PM Central, 2PM Eastern).</li>
</ul>
<h3>All SAN institution / organization staff within the membership may have access to benefits</h3>
<h4>Resources, Research, and Support</h4>
<ul>
<li><strong>Password-protected website</strong> — library of resources, including SAN-developed research and external resources.</li>
<li><strong>Members-only digital community</strong> — timely updates on emerging issues and member discussions.</li>
<li>SAN Monthly eNewsletter</li>
<li>Advocacy</li>
<li>Responsive SAN staff members</li>
</ul>
<h4>Events &amp; Training</h4>
<ul>
<li><strong>Open Forum</strong> — monthly themed virtual Q&amp;A sessions with experts (2nd Tuesday of the month).</li>
<li><strong>Virtual Training Courses and Webinars</strong> — asynchronous, themed training open to the membership.</li>
<li><strong>Workshops</strong> — training at a highly discounted rate for SAN institutions (foundational implementation &amp; advanced topics).</li>
<li><strong>NASASPS</strong> (state regulator) Conference with SAN institutions (spring) — member fee and SAN-only sessions.</li>
</ul>
<h4>Member Interaction</h4>
<ul>
<li><strong>SAN Advisory Group</strong> — member representatives who advise on the issues and interests of SAN members.</li>
<li><strong>Special Interest Teams (SIT)</strong> — small member-led workgroups researching identified topics. Current SIT topics include Institutional Engagement, Professional Licensure, and Global Compliance.</li>
<li><strong>SANsational Annual Awards</strong> — recognising member development of high-quality compliance solutions.</li>
<li><strong>Professional Development</strong> — member presentations on webcasts, monthly calls, and face-to-face meetings.</li>
<li>A network of peers from across the country working on the same issues.</li>
</ul>
HTML;
$benefits = $ref(Paragraph::create([
  'type' => 'simple_content',
  'field_header' => 'SAN Benefits at a Glance',
  'field_body' => ['value' => $benefits_body, 'format' => 'full_html'],
]));

// --- Membership Fee Structure ---------------------------------------------
$fees_body = <<<HTML
<p>SAN memberships may be held by individual institutions or as group memberships for partnerships, systems, consortia, or organizations.</p>
<ul>
<li>SAN Membership Pricing Option (see chart below):
<ul>
<li>The SAN membership fee is discounted if at least one institution or entity within the SAN individual or SAN group membership has <a href="https://wcet.wiche.edu/join-us/wcet-san-benefits/">separately joined WCET</a>, SAN's parent organization.</li>
<li><strong>Example 1</strong> — Ontario State System group membership: if a university within the group holds a WCET membership, the discounted rate applies to the group membership.</li>
</ul>
</li>
</ul>
HTML;
$fees = $ref(Paragraph::create([
  'type' => 'simple_content',
  'field_header' => 'Membership Fee Structure',
  'field_body' => ['value' => $fees_body, 'format' => 'full_html'],
]));

// --- Assemble --------------------------------------------------------------
$node->set('field_p_content', [$quicklinks, $join, $cta, $benefits, $fees]);
$node->save();

echo "rebuilt /membership (node 25): hero + quick links + 4 sections\n";
echo "url: " . $node->toUrl()->toString() . "\n";
