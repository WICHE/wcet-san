<?php

/**
 * @file
 * Component QC showcase — a landing page at /wiche-design-demo rendering EVERY
 * paragraph component and every variant, so a designer can review the whole
 * system on one page. Each section is preceded by a purple QC label.
 *
 * Variants covered:
 *   • Hero (compound_header_content): solid colour, half-image, full-bleed image
 *   • Cards (simple_card): image-overlay tile, content/CTA card, quick-link card
 *   • compound_card_row on white AND on a tinted band
 *   • Quick links cards — long-copy, no-button variant (Figma 170:2692)
 *   • Event cards — real .card--event markup with images + Dates/Time (Figma 157:2644)
 *   • Topic tiles + Events + Past events (summary_*)
 *   • simple_content block + CTA banner
 *   • layout_two_column with nested single_image / single_link / single_file
 *   • single_link styles: primary, secondary, tertiary
 *   • single_image, single_video, single_file
 *   • Rich text incl. the "Blue text" style
 *   • Accordion (compound_faq_section / simple_faq)
 *   • table_with_filters
 *   • Spacer: small / medium / large
 *   • Grid reference (8/12 content) — Figma 154:1685
 *
 * Not shown: single_svg (needs an SVG media entity) and reference_block (embeds
 * an arbitrary block; no styling of its own).
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

/** Styled image-derivative URL for a media:image entity, for raw-HTML demo blocks. */
function media_image_url(int $mid, string $style = 'large'): string {
  $media = \Drupal::entityTypeManager()->getStorage('media')->load($mid);
  if (!$media || !$media->hasField('field_image') || $media->get('field_image')->isEmpty()) {
    return '';
  }
  $file = $media->get('field_image')->entity;
  if (!$file) {
    return '';
  }
  $style_entity = \Drupal::entityTypeManager()->getStorage('image_style')->load($style);
  return $style_entity
    ? $style_entity->buildUrl($file->getFileUri())
    : \Drupal::service('file_url_generator')->generateAbsoluteString($file->getFileUri());
}

/**
 * Raw markup for one .card--event (matches node--event--teaser.html.twig
 * exactly, plus a Time line — the live field_event_date is date-only, so this
 * demo-only Time line shows the full design intent; see the runbook note).
 */
function event_card(string $title, string $img_url, string $dates, string $time): string {
  return '<article class="card card--event">'
    . '<div class="card__media"><img src="' . $img_url . '" alt="" loading="eager"></div>'
    . '<h3 class="card__title"><a href="#">' . $title . '</a></h3>'
    . '<div class="card__meta"><strong>Dates:</strong> ' . $dates . '<br><strong>Time:</strong> ' . $time . '</div>'
    . '<div class="card__cta"><a href="#">Learn more</a></div>'
    . '</article>';
}

/** A purple QC section label (single_text_area with inline styles — demo only). */
function label(string $text): array {
  return wp('single_text_area', [
    'field_text_area' => [
      'value' => '<p style="margin:2.5rem 0 0;padding:.55rem 1.1rem;background:#57068C;color:#fff;'
        . 'font:600 .8rem/1.4 Roboto,sans-serif;letter-spacing:.08em;text-transform:uppercase;border-radius:4px">'
        . $text . '</p>',
      'format' => 'full_html',
    ],
  ]);
}

/** A thin marker bar, to make empty Spacers visible for QC. */
function marker(string $text = ''): array {
  return wp('single_text_area', [
    'field_text_area' => [
      'value' => '<div style="height:8px;background:#1468A0;border-radius:4px"></div>'
        . ($text ? '<div style="font:600 .7rem Roboto;color:#1468A0;margin-top:2px">' . $text . '</div>' : ''),
      'format' => 'full_html',
    ],
  ]);
}

foreach (\Drupal::entityTypeManager()->getStorage('node')
  ->loadByProperties(['title' => 'Wiche Design Demo', 'type' => 'landing_page']) as $n) {
  $n->delete();
}

// Sample media + topics (from the imported content).
$img = [1, 2, 3, 4, 5, 6];            // image media ids
$file_media = 17;                     // file media
$video_media = 18;                    // video media
$topics = [['target_id' => 614], ['target_id' => 6], ['target_id' => 1], ['target_id' => 4]];

// ---- Page header: Hero variant A — solid colour + copy (no image) ----------
$hero = wp('compound_header_content', [
  'field_subheader' => 'The State Authorization Network',
  'field_header' => 'The leader for guidance and support for navigating state and federal regulatory compliance for out-of-state activities of postsecondary institutions.',
  'field_subheader_as_h1' => TRUE,
]);

$c = [];

// ===================================================== HERO VARIANTS =========
$c[] = label('Hero — Half-page image (image set)');
$c[] = wp('compound_header_content', [
  'field_subheader' => 'The State Authorization Network',
  'field_header' => 'Hero variant: half-page image. The image fills the right half beside the copy.',
  'field_media_image' => ['target_id' => $img[0]],
]);

$c[] = label('Hero — Full-width background image (image + full-bleed on)');
$c[] = wp('compound_header_content', [
  'field_subheader' => 'The State Authorization Network',
  'field_header' => 'Hero variant: full-width background image with a dark scrim over the copy.',
  'field_media_image' => ['target_id' => $img[1]],
  'field_hero_full_bleed' => TRUE,
]);

// ===================================================== CARDS — image tiles ===
$c[] = label('Cards — Image tiles (title + "Learn more" at the bottom) · Figma 170:2329');
$c[] = wp('compound_card_row', [
  'field_header' => 'Compliance Topics',
  'field_p_cards' => [
    wp('simple_card', ['field_header' => 'Federal Regulations', 'field_media_image' => ['target_id' => $img[2]], 'field_link' => ['uri' => 'internal:/resources/federal-regulations', 'title' => 'Learn more']]),
    wp('simple_card', ['field_header' => 'Professional Licensure', 'field_media_image' => ['target_id' => $img[3]], 'field_link' => ['uri' => 'internal:/resources/professional-licensure', 'title' => 'Learn more']]),
    wp('simple_card', ['field_header' => 'Reciprocity (SARA)', 'field_media_image' => ['target_id' => $img[4]], 'field_link' => ['uri' => 'internal:/resources/reciprocity-sara', 'title' => 'Learn more']]),
    wp('simple_card', ['field_header' => 'Military Students', 'field_media_image' => ['target_id' => $img[5]], 'field_link' => ['uri' => 'internal:/resources/military-students', 'title' => 'Learn more']]),
  ],
]);

// ===================================================== CARDS — content/CTA ===
$c[] = label('Cards — Content / CTA (header + body + button)');
$c[] = wp('compound_card_row', [
  'field_header' => 'Federal Policy update',
  'field_p_cards' => [
    wp('simple_card', ['field_header' => 'AHEAD Committee Pell & Workforce Pell', 'field_subheader' => 'Final Regulations released May 19, 2026. Effective date 7/20/2026.', 'field_link' => ['uri' => 'https://www.ed.gov', 'title' => 'Visit external website']]),
    wp('simple_card', ['field_header' => 'RISE Committee', 'field_subheader' => 'Final Regulations released 5/1/26. Effective 7/1/26 (Loan Limits & Definition of Professional Student).', 'field_link' => ['uri' => 'https://www.ed.gov', 'title' => 'Visit website']]),
    wp('simple_card', ['field_header' => 'AIM (Accreditation) Committee Rulemaking', 'field_subheader' => 'Consensus reached. Visit the ED website for the posted documents and consensus language (PDF).', 'field_link' => ['uri' => 'https://www.ed.gov', 'title' => 'Visit website']]),
  ],
]);

// ===================================================== CARDS — quick links ===
$c[] = label('Cards — Quick links (header + read-more link)');
$c[] = wp('compound_card_row', [
  'field_header' => 'Quick Links',
  'field_p_cards' => [
    wp('simple_card', ['field_header' => 'Federal Regulations', 'field_link' => ['uri' => 'internal:/resources/federal-regulations', 'title' => 'Read more']]),
    wp('simple_card', ['field_header' => 'Professional Licensure', 'field_link' => ['uri' => 'internal:/resources/professional-licensure', 'title' => 'Read more']]),
    wp('simple_card', ['field_header' => 'Reciprocity (SARA)', 'field_link' => ['uri' => 'internal:/resources/reciprocity-sara', 'title' => 'Read more']]),
  ],
]);

// ===================================================== CARDS — quick links (long copy) ===
// Figma 170:2692 "Card - Quick links": white shadow card, header + divider rule
// + a longer paragraph of body copy, usually with NO button — this is the
// existing .card--cta look (simple_card, no image, has body); a card only gets
// its CTA row if field_link is set, so leaving it empty already reproduces the
// no-button variant. Body copy trimmed to fit field_subheader's 255-char cap
// (shared with 3 other bundles — see the note in the runbook, not widened here).
$c[] = label('Cards — Quick links, long copy (header + body, no button) · Figma 170:2692');
$c[] = wp('compound_card_row', [
  'field_header' => 'Quick Links',
  'field_p_cards' => [
    wp('simple_card', [
      'field_header' => 'Member links',
      'field_subheader' => 'Are you new to State Authorization? Start with State Authorization 101! Scroll down for the 9 Key Areas, or use the Resources menu. SAN Coordinators: see the Membership Coordinator Welcome Information.',
    ]),
    wp('simple_card', [
      'field_header' => 'Comms Platform for SAN',
      'field_subheader' => 'SAN member updates and discussions happen on MIX, including the monthly eNewsletters (SAN News & Announcements, Newsletters tab) and the Member-Only Community. See the MIX Rules of Use and Etiquette.',
    ]),
    wp('simple_card', [
      'field_header' => 'Other helpful links',
      'field_subheader' => 'NC-SARA Website. U.S. Department of Education Knowledge Center (notices, Dear Colleague Letters, FSA Handbook). WCET Frontiers articles. WCET Job Posts. Follow SAN on LinkedIn.',
    ]),
  ],
]);

// ===================================================== SUMMARIES =============
$c[] = label('Topic tiles — summary_resources');
$c[] = wp('summary_resources', ['field_summary_topics' => $topics, 'field_link' => ['uri' => 'internal:/resources/all', 'title' => 'View all resources']]);
$c[] = label('Topic tiles — summary_events (site\'s "Events" topic browser, not event cards)');
$c[] = wp('summary_events', ['field_summary_topics' => $topics, 'field_link' => ['uri' => 'internal:/events', 'title' => 'View all events']]);
$c[] = label('Past events — summary_past_events');
$c[] = wp('summary_past_events', ['field_summary_topics' => $topics, 'field_link' => ['uri' => 'internal:/events/past', 'title' => 'View past events']]);

// ===================================================== EVENT CARDS ===========
// Figma 157:2644 "Card - Events": the ACTUAL event listing card
// (node--event--teaser.html.twig / .card--event) — image-led, borderless,
// blue title, bold "Dates:"/"Time:" labels, "Learn more" button. Raw markup
// here matches the real template 1:1; live events use only "Dates:" (see the
// runbook note — field_event_date has no time component).
$c[] = label('Event cards — real .card--event markup, verified vs Figma 157:2644');
$c[] = wp('single_text_area', [
  'field_text_area' => [
    'value' => '<section class="section section--tint"><div class="wrap">'
      . '<div class="section-head"><h2 class="section-head__title">Events</h2></div>'
      . '<div class="card-grid card-grid--resources">'
      . '<div class="views-row">' . event_card(
        "SAN's Summer Webinar Series – Registration is Open (SAN Member Exclusive)!",
        media_image_url($img[0]),
        'June 16–18, 2026 (you may register for one, two, or all three sessions of the series)',
        '2:30 – 4:00 PM (Eastern time)'
      ) . '</div>'
      . '<div class="views-row">' . event_card(
        'WCET and SAN Webinar - Understanding Recent Federal Department of Education Policy and Practice Updates',
        media_image_url($img[1]),
        'July 15, 2026',
        '2 PM – 3 PM (Eastern time)'
      ) . '</div>'
      . '<div class="views-row">' . event_card(
        'Open Forum',
        media_image_url($img[2]),
        '2nd Tuesday of each month. July 14, 2026!',
        '10 AM Alaska, 11 AM PT, Noon MT, 1 PM CT, 2 PM ET'
      ) . '</div>'
      . '</div>'
      . '<div class="section-cta"><a href="#" class="btn">View all updates</a></div>'
      . '</div></section>',
    'format' => 'full_html',
  ],
]);

// ===================================================== CONTENT + CTA =========
$c[] = label('Content block — simple_content (header + subheader + body)');
$c[] = wp('simple_content', [
  'field_header' => 'About the network',
  'field_subheader' => 'A national community of practice.',
  'field_body' => ['value' => '<p>For 15 years, the State Authorization Network has supported higher education institutions navigating the complexities of interstate compliance for distance education. SAN currently serves more than 975 institutions and organizations nationwide.</p>', 'format' => 'full_html'],
]);

$c[] = label('CTA banner — simple_content (header + button, no body)');
$c[] = wp('simple_content', [
  'field_header' => 'Join SAN and become a member',
  'field_link' => ['uri' => 'internal:/membership', 'title' => 'Learn more'],
]);

// ===================================================== TWO-COLUMN ============
$c[] = label('Two-column layout — layout_two_column (nested singles)');
$c[] = wp('layout_two_column', [
  'field_header' => 'Layout: two column',
  'field_p_left_column' => [
    wp('single_image', ['field_media_image' => ['target_id' => $img[0]]]),
    wp('single_link', ['field_link' => ['uri' => 'internal:/membership', 'title' => 'Become a member'], 'field_link_style' => 'primary']),
  ],
  'field_p_right_column' => [
    wp('simple_content', ['field_header' => 'Two-column layout', 'field_body' => ['value' => '<p>The <strong>layout_two_column</strong> paragraph places content side by side. This column holds a content block and a downloadable file.</p>', 'format' => 'full_html']]),
    wp('single_file', ['field_header' => 'Sample document', 'field_media_file' => ['target_id' => $file_media], 'field_link_style' => 'secondary']),
  ],
]);

// ===================================================== BUTTONS / LINKS =======
$c[] = label('Buttons / links — single_link: primary, secondary, tertiary');
$c[] = wp('single_link', ['field_link' => ['uri' => 'internal:/membership', 'title' => 'Primary button'], 'field_link_style' => 'primary']);
$c[] = wp('single_link', ['field_link' => ['uri' => 'internal:/resources', 'title' => 'Secondary button'], 'field_link_style' => 'secondary']);
$c[] = wp('single_link', ['field_link' => ['uri' => 'internal:/events', 'title' => 'Tertiary link'], 'field_link_style' => 'tertiary']);

// ===================================================== MEDIA SINGLES =========
$c[] = label('Media singles — single_image, single_video, single_file');
$c[] = wp('single_image', ['field_media_image' => ['target_id' => $img[1]]]);
$c[] = wp('single_video', ['field_media_video' => ['target_id' => $video_media]]);
$c[] = wp('single_file', ['field_header' => 'Download: sample document', 'field_media_file' => ['target_id' => $file_media], 'field_link_style' => 'secondary']);

// ===================================================== RICH TEXT + BLUE ======
$c[] = label('Rich text + "Blue text" style — single_text_area');
$c[] = wp('single_text_area', [
  'field_text_area' => ['value' =>
    '<h3>Rich text block</h3>'
    . '<p>Body copy with <strong>bold</strong>, <em>italic</em>, a <a href="/resources">link</a>, and the '
    . '<span class="text-blue">Blue text style</span> applied to a phrase.</p>'
    . '<ul><li>Bulleted list item one</li><li>Bulleted list item two</li></ul>',
    'format' => 'full_html'],
]);

// ===================================================== ACCORDION =============
$c[] = label('Accordion — compound_faq_section / simple_faq');
$c[] = wp('compound_faq_section', [
  'field_header' => 'Resources to manage compliance',
  'field_p_faq' => [
    wp('simple_faq', ['field_header' => 'SAN Essentials', 'field_body' => ['value' => '<p>One or two page abstracts of basic compliance areas to provide general understanding.</p>', 'format' => 'basic_html']]),
    wp('simple_faq', ['field_header' => 'SAN Tables', 'field_body' => ['value' => '<p>Resource tables and charts to find links and directions for compliance research.</p>', 'format' => 'basic_html']]),
    wp('simple_faq', ['field_header' => 'SAN Next Level', 'field_body' => ['value' => '<p>Abstracts of beyond-basic compliance issues to consider when managing compliance.</p>', 'format' => 'basic_html']]),
  ],
]);

// ===================================================== TABLE =================
$c[] = label('Table with filters — table_with_filters');
$c[] = wp('table_with_filters', [
  'field_table_data' => ['value' => '<table><thead><tr><th>State</th><th>SARA member</th><th>Notes</th></tr></thead><tbody><tr><td>Colorado</td><td>Yes</td><td>—</td></tr><tr><td>California</td><td>No</td><td>Non-SARA requirements apply</td></tr><tr><td>Texas</td><td>Yes</td><td>—</td></tr></tbody></table>', 'format' => 'full_html'],
]);

// ===================================================== SPACERS ===============
$c[] = label('Spacer — small / medium / large (blue bars mark the gap)');
$c[] = marker('below: SMALL spacer');
$c[] = wp('spacer', ['field_spacer_size' => 'small']);
$c[] = marker('below: MEDIUM spacer');
$c[] = wp('spacer', ['field_spacer_size' => 'medium']);
$c[] = marker('below: LARGE spacer');
$c[] = wp('spacer', ['field_spacer_size' => 'large']);
$c[] = marker('end of spacers');

// ===================================================== GRID (8/12) ===========
$c[] = label('Grid — content 8/12, sidebar 4/12 (Figma 154:1685)');
$c[] = wp('single_text_area', [
  'field_text_area' => ['value' =>
    '<p>The page content region uses a 12-column grid: main content spans 8 columns, a sidebar 4 (two sidebars → 3 + 6 + 3). Illustration:</p>'
    . '<div style="display:grid;grid-template-columns:repeat(12,1fr);gap:6px;margin:1rem 0">'
    . '<div style="grid-column:span 8;background:#1468A0;color:#fff;padding:14px;border-radius:4px;font:600 .85rem Roboto">Content · 8 / 12</div>'
    . '<div style="grid-column:span 4;background:rgba(20,104,160,.15);color:#1468A0;padding:14px;border-radius:4px;font:600 .85rem Roboto">Sidebar · 4 / 12</div>'
    . '</div>'
    . '<div style="display:grid;grid-template-columns:repeat(12,1fr);gap:4px">'
    . str_repeat('<div style="background:#e6edf3;height:20px;border-radius:2px"></div>', 12)
    . '</div>',
    'format' => 'full_html'],
]);

$node = Node::create([
  'type' => 'landing_page',
  'title' => 'Wiche Design Demo',
  'status' => 1,
  'uid' => 1,
  'field_p_header' => [$hero],
  'field_p_content' => $c,
]);
$node->save();

echo 'DEMO_NODE_ID=' . $node->id() . "\n";
echo 'url: ' . $node->toUrl()->toString() . "\n";
echo "components: hero×3, image/CTA/quick-link cards, quick-links long-copy cards,\n";
echo "event cards, topic tiles, events, past events,\n";
echo "content, CTA banner, two-column, link styles×3, image/video/file singles,\n";
echo "rich text + blue text, accordion, table, spacers×3, grid reference\n";
echo "DONE\n";
