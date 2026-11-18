<?php

/**
 * @file
 * Pre-flight for a freshly-imported prod database.
 *
 * Prod runs the OLD theme (themekit) and a few modules this D11 codebase no
 * longer ships (advagg, rdf, system_status, graphql_search_api) — plus D10
 * themes (classy, seven, stable, adminimal_theme). A fresh import therefore
 * references extensions with no code, and the container can't build
 * ("Base theme classy has not been installed."), which blocks `updb` and `cim`.
 *
 * This script reconciles `core.extension` with what's actually on disk so the
 * container can build. Run it FIRST, right after importing the DB:
 *   drush php:script scripts/preflight-reconcile.php && drush cr
 * then continue with updb → cim → content scripts (see scripts/README.md).
 *
 * It only edits config (does not run uninstall hooks); the subsequent `drush cim`
 * reconciles the full config set and clears any orphaned config left behind.
 * Idempotent.
 */

use Drupal\Core\Extension\ExtensionDiscovery;
use Drupal\views\Entity\View;

$disc = new ExtensionDiscovery(DRUPAL_ROOT);
$modules_on_disk = array_merge(array_keys($disc->scan('module')), array_keys($disc->scan('profile')));
$themes_on_disk = array_keys($disc->scan('theme'));

$ext = \Drupal::configFactory()->getEditable('core.extension');
$modules = $ext->get('module') ?: [];
$themes = $ext->get('theme') ?: [];

// Modules to disable for the upgrade even though they have code: graphql's
// schema deriver queries users during route rebuild and fails against the
// not-yet-updated D10 address-field schema, aborting `updb`. They are in the
// target config, so `drush cim` re-installs them afterwards on D11 schema.
$disable_for_upgrade = ['graphql_core', 'graphql'];

// Drop modules with no code + the upgrade-blockers above.
$removed_modules = [];
foreach (array_keys($modules) as $m) {
  if (!in_array($m, $modules_on_disk, TRUE) || in_array($m, $disable_for_upgrade, TRUE)) {
    unset($modules[$m]); $removed_modules[] = $m;
  }
}

// Ensure the wiche theme stack is enabled (all present in this codebase).
foreach (['stable9', 'gin', 'wiche'] as $t) {
  if (in_array($t, $themes_on_disk, TRUE) && !isset($themes[$t])) { $themes[$t] = 0; }
}

// Drop themes with no code (classy/seven/stable/adminimal_theme + any themekit
// that can no longer initialise).
$removed_themes = [];
foreach (array_keys($themes) as $t) {
  if (!in_array($t, $themes_on_disk, TRUE)) { unset($themes[$t]); $removed_themes[] = $t; }
}

$ext->set('module', $modules)->set('theme', $themes)->save();

// Point the site at the new theme so it can render.
\Drupal::configFactory()->getEditable('system.theme')
  ->set('default', 'wiche')->set('admin', 'gin')->save();

// The `video` entity_browser references view `entity_browser_video`, which is
// missing on prod — this aborts entity_browser_update_8202 during `updb`.
// Recreate it (cloned from entity_browser_file, bundle=video) before updb.
if (class_exists(View::class) && !View::load('entity_browser_video') && ($file = View::load('entity_browser_file'))) {
  $data = $file->toArray();
  unset($data['uuid'], $data['_core']);
  $data['id'] = 'entity_browser_video';
  $data['label'] = 'Entity Browser - Video';
  if (isset($data['dependencies']['config'])) {
    $data['dependencies']['config'] = array_map(fn($d) => $d === 'media.type.file' ? 'media.type.video' : $d, $data['dependencies']['config']);
  }
  foreach ($data['display'] as &$disp) {
    if (isset($disp['display_options']['filters']['bundle']['value'])) {
      $disp['display_options']['filters']['bundle']['value'] = ['video' => 'video'];
    }
  }
  unset($disp);
  View::create($data)->save();
  echo "recreated entity_browser_video view\n";
}

echo 'removed missing/blocking modules: ' . (implode(', ', $removed_modules) ?: '(none)') . "\n";
echo 'removed missing themes:  ' . (implode(', ', $removed_themes) ?: '(none)') . "\n";
echo "default theme → wiche, admin → gin\n";
echo "DONE — now run: drush cr\n";
