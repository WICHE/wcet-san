<?php

/**
 * @file
 * Rebuilds the main navigation + utility bar to match the Figma nav design
 * (component 177:4303 / header 26:323): six top-level items each with a
 * mega-menu, and a utility bar of Search · Policy Tracker · Contact Us · Login.
 *
 * Menu links are content (not config), so this script is the reproducible
 * artifact — run it on each environment:
 *   drush php:script scripts/nav-menu.php     (or `lando drush php:script …`)
 *
 * It is idempotent: it clears the existing `main` + `util-navigation` links
 * first, then recreates the structure below. A JSON backup of the pre-existing
 * links is written to the public files dir before anything is deleted.
 *
 * Items marked with the TODO sentinel had no matching page at build time — they
 * are pointed at their section's landing page as a placeholder so every item is
 * a working link (matching the design). Repoint them at the exact URL in
 * Manage » Menus once the content exists (search the list below for TODO).
 */

use Drupal\menu_link_content\Entity\MenuLinkContent;

// Placeholder sentinel: a child carrying this is linked to its section's
// top-level URL until the client sets the real target.
const TODO = '__TODO__';

/** [title, uri, [children...]]. A child is [title, uri] or [title, uri, [grandchildren]]. */
$UTIL = [
  ['Search', 'internal:/search'],
  ['Policy Tracker', 'https://policytracker.wiche.edu/'],
  ['Contact Us', 'entity:node/28'],
  ['Login', 'route:user.login'],
];

$MAIN = [
  ['Home', 'internal:/', []],

  ['Our Network', 'internal:/about-san', [
    ['Overview', 'internal:/about-san'],
    ['SAN Statement of Work', 'internal:/about-san/statement-work'],
    ['SAN Institutions / Groups', 'internal:/member-institutions-organizations'],
    ['SAN Coordinator List', TODO],
    ['SAN Advisory Group', TODO],
    ['SAN Special Interest Teams (SIT)', TODO],
    ['SANsational Awards', 'internal:/resources/sansational-awards'],
    ['WCET Job Posts', TODO],
    ['WCET Mix', TODO],
  ]],

  ['Learning Center', 'internal:/state-authorization-101', [
    ['Overview', 'internal:/state-authorization-101'],
    ['SAN Essentials', TODO],
    ['SAN Charts & Tools', TODO],
    ['SAN Next Level', TODO],
    ['SAN Publications', TODO],
    ['SAN Training', TODO],
    ['WCET Frontiers', 'internal:/resources/all?topic=All&resource_type=18'],
    ['Policy Tracker', 'https://policytracker.wiche.edu/'],
  ]],

  ['Compliance Topics', 'internal:/resources', [
    ['Overview', 'internal:/resources'],
    ['History of State Authority', 'internal:/resources/history'],
    ['Federal Regulations', 'internal:/resources/federal-regulations'],
    ['Professional Licensure', 'internal:/resources/professional-licensure'],
    ['Reciprocity (SARA)', 'internal:/resources/reciprocity-sara'],
    ['Military Students', 'internal:/resources/military-students'],
    ['Global Compliance', TODO],
    ['Beyond Reciprocity', TODO],
    ['Student Complaints', 'internal:/resources/student-complaints'],
    ['Other Higher Education Issues', 'internal:/resources/other-higher-education-issues'],
    // Second column in the design: external resources (client to supply exact URLs).
    ['External Resources', TODO],
    ['NC-SARA Website', 'https://www.nc-sara.org/'],
    ['U.S. Department of Education', 'https://www.ed.gov/'],
    ['USDE Knowledge Center', TODO],
    ['State Authorization Guide', TODO],
    ['NASASPS', 'https://www.nasasps.org/'],
  ]],

  ['Events', 'internal:/events', [
    ['Overview', 'internal:/events'],
    ['Events', 'internal:/events/upcoming'],
    ['Past Events', 'internal:/events/past'],
    ['Open Forums', TODO],
    ['Coordinator Calls', 'internal:/resources/all?topic=All&resource_type=20'],
    ['SAN Training', TODO],
  ]],

  ['Join SAN', 'internal:/membership', [
    ['Overview', 'internal:/membership'],
    ['SAN Membership Benefits', TODO],
    ['WCET + SAN Benefits', 'https://wcet.wiche.edu/join-us/wcet-san-benefits/'],
    ['SAN Membership Fees', TODO],
    ['SAN Membership Application', 'internal:/form/join-san'],
  ]],
];

// --- Back up existing links -------------------------------------------------
$storage = \Drupal::entityTypeManager()->getStorage('menu_link_content');
$backup = [];
foreach (['main', 'util-navigation'] as $mn) {
  foreach ($storage->loadByProperties(['menu_name' => $mn]) as $l) {
    $uri = '';
    try { $uri = $l->getUrlObject()->toUriString(); } catch (\Throwable $e) { $uri = '?'; }
    $backup[] = ['menu' => $mn, 'title' => $l->getTitle(), 'uri' => $uri, 'weight' => $l->getWeight()];
  }
}
$dir = 'public://nav-menu-backup-' . date('Ymd-His') . '.json';
\Drupal::service('file_system')->saveData(json_encode($backup, JSON_PRETTY_PRINT), $dir);
echo 'backed up ' . count($backup) . " links → $dir\n";

// --- Clear existing main + util links --------------------------------------
foreach (['main', 'util-navigation'] as $mn) {
  $existing = $storage->loadByProperties(['menu_name' => $mn]);
  if ($existing) {
    $storage->delete($existing);
    echo 'cleared ' . count($existing) . " links from $mn\n";
  }
}

// --- Recreate ---------------------------------------------------------------
$is_external = fn(string $uri): bool => str_starts_with($uri, 'http://') || str_starts_with($uri, 'https://');

$make = function (string $title, string $uri, string $menu, ?string $parent, int $weight) use ($is_external): MenuLinkContent {
  $link = ['uri' => $uri];
  if ($is_external($uri)) {
    $link['options'] = ['attributes' => ['target' => '_blank', 'rel' => 'noopener noreferrer']];
  }
  $item = MenuLinkContent::create([
    'title' => $title,
    'link' => $link,
    'menu_name' => $menu,
    'weight' => $weight,
    'expanded' => TRUE,
    'parent' => $parent,
  ]);
  $item->save();
  return $item;
};

$w = 0;
foreach ($UTIL as $entry) {
  $make($entry[0], $entry[1], 'util-navigation', NULL, $w++);
}

$w = 0;
foreach ($MAIN as $top) {
  [$title, $uri, $children] = $top + [2 => []];
  $parent = $make($title, $uri, 'main', NULL, $w++);
  $cw = 0;
  foreach ($children as $child) {
    // Placeholder children link to their section's landing page for now.
    $child_uri = $child[1] === TODO ? $uri : $child[1];
    $make($child[0], $child_uri, 'main', 'menu_link_content:' . $parent->uuid(), $cw++);
  }
}

// --- The coordinator_list view adds its own link to the main menu; take it out
//     so the top level is exactly the six designed items. ---
$view = \Drupal::entityTypeManager()->getStorage('view')->load('coordinator_list');
if ($view) {
  $display = &$view->getDisplay('page_1');
  if (($display['display_options']['menu']['type'] ?? '') !== 'none') {
    $display['display_options']['menu']['type'] = 'none';
    $view->save();
    echo "removed coordinator_list view's main-menu link\n";
  }
}

// --- Purge stale menu_tree rows left by deleted links, then rebuild so the
//     rendered tree matches the entities exactly. ---
\Drupal::database()->truncate('menu_tree')->execute();
\Drupal::service('plugin.manager.menu.link')->rebuild();

echo "rebuilt main (" . count($MAIN) . " top-level) + util-navigation (" . count($UTIL) . ")\n";
echo "DONE\n";
