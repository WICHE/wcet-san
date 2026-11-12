<?php

/**
 * @file
 * Go-live URL work, from the client's "Website URL and Redirects" document:
 *
 *   1. Give each topic landing page a clean, consistent address — /history,
 *      /federal-regulations, … instead of /resources/history,
 *      /topics/federal-regulations, /global-compliance-0 — and 301 the old
 *      address to it so existing links keep working.
 *   2. Redirect the old-site addresses in the document's first table to
 *      their new pages.
 *
 * Safe to re-run: every step checks before it writes. Preview without changing
 * anything:   DRY_RUN=1 drush php:script scripts/url-redirects.php
 * Apply:      drush php:script scripts/url-redirects.php
 *
 * Why this is more than "add some redirects":
 *  - The clean topic addresses are currently held by the topic TERM pages'
 *    auto-generated aliases (that's why Global Compliance got "-0"). Those
 *    term pages are retired (cards link to the landing pages), so the term
 *    aliases are removed and the term's system path (taxonomy/term/N) is
 *    redirected to its landing page instead.
 *  - The redirect module matches AFTER alias resolution and never fires for an
 *    address that is still a live alias. So a live old page is RETIRED: its
 *    alias is removed (content stays published and untouched) and the address
 *    plus its system path are redirected to the replacement. Anything live that
 *    isn't an alias is only REPORTED.
 *  - Aliases are changed on the node's own path alias, not by retyping links,
 *    so internal references that point at the node (menu links, link fields,
 *    "Learn more" cards) follow automatically; links hard-coded in body text
 *    keep working through the redirects.
 */

use Drupal\path_alias\Entity\PathAlias;

$dry = (bool) getenv('DRY_RUN');
$etm = \Drupal::entityTypeManager();
$alias_storage = $etm->getStorage('path_alias');
$redirect_storage = $etm->getStorage('redirect');
$notes = [];

$say = function (string $msg) use ($dry) { echo ($dry ? '[dry-run] ' : '') . $msg . "\n"; };

// Redirect from $source (no leading slash) to $uri, unless one already exists.
$redirect = function (string $source, string $uri, string $why = '') use ($redirect_storage, $dry, $say) {
  $existing = $redirect_storage->loadByProperties(['redirect_source__path' => $source]);
  if ($existing) {
    $say("redirect /$source: already exists, skipped");
    return;
  }
  if (!$dry) {
    $redirect_storage->create([
      'redirect_source' => ['path' => $source, 'query' => []],
      'redirect_redirect' => ['uri' => $uri],
      'language' => 'und',
      'status_code' => 301,
    ])->save();
  }
  $say("redirect /$source -> $uri" . ($why ? "  ($why)" : ''));
};

// System path (/node/N) behind an alias, or NULL.
$resolve = function (string $alias) {
  $hit = \Drupal::service('path_alias.repository')->lookupByAlias($alias, 'en');
  return $hit['path'] ?? NULL;
};

// ---------------------------------------------------------------- 1. Topics
// Landing page title => clean address.
$topics = [
  'Federal Regulations' => '/federal-regulations',
  'Global Compliance' => '/global-compliance',
  'History' => '/history',
  'Military Students' => '/military-students',
  'Professional Licensure' => '/professional-licensure',
  'Reciprocity (SARA)' => '/reciprocity-sara',
  'Student Complaints' => '/student-complaints',
  'Other Higher Education Issues' => '/other-higher-education-issues',
  'SANsational Awards' => '/sansational-awards',
  'Beyond Reciprocity' => '/beyond-reciprocity',
];

$landing = [];
foreach ($etm->getStorage('node')->loadByProperties(['type' => 'landing_page']) as $node) {
  $landing[trim($node->label())] = $node;
}
$node_pathauto = \Drupal::keyValue('pathauto_state.node');
$term_pathauto = \Drupal::keyValue('pathauto_state.taxonomy_term');

foreach ($topics as $title => $new) {
  if (!isset($landing[$title])) {
    $say("topic \"$title\": no landing page with that title here, skipped");
    continue;
  }
  $node = $landing[$title];
  $system = '/node/' . $node->id();
  $current = $alias_storage->loadByProperties(['path' => $system]);
  $old_aliases = array_map(fn($a) => $a->getAlias(), $current);

  if (in_array($new, $old_aliases, TRUE)) {
    $say("topic \"$title\": already $new, skipped");
  }
  else {
    // Who holds the clean address now?
    $blockers = array_filter($alias_storage->loadByProperties(['alias' => $new]), fn($a) => $a->getPath() !== $system);
    $blocked = FALSE;
    foreach ($blockers as $b) {
      if (str_starts_with($b->getPath(), '/taxonomy/term/')) {
        $say("topic \"$title\": $new is the retired topic-term page ({$b->getPath()}) — removing that alias");
        if (!$dry) {
          $b->delete();
        }
      }
      else {
        $say("topic \"$title\": !! $new is already used by {$b->getPath()} — NOT changed, needs a human decision");
        $notes[] = "$title: $new is taken by {$b->getPath()}";
        $blocked = TRUE;
      }
    }
    if ($blocked) {
      continue;
    }
    if (!$dry) {
      if ($current) {
        $first = array_shift($current);
        $first->setAlias($new)->save();
        foreach ($current as $extra) {
          $extra->delete();
        }
      }
      else {
        PathAlias::create(['path' => $system, 'alias' => $new, 'langcode' => 'en'])->save();
      }
      // Keep it: a later save must not let the "[node:title]" pattern rewrite it.
      $node_pathauto->set($node->id(), 0);
    }
    $say("topic \"$title\": " . implode(', ', $old_aliases ?: ['(none)']) . " -> $new");
    foreach ($old_aliases as $old) {
      $redirect(ltrim($old, '/'), 'internal:' . $system, 'old topic address');
    }
  }
}

// The topic term pages are retired: stop auto-aliasing them and send their
// system path to the landing page the term points at (field_landing_page).
foreach ($etm->getStorage('taxonomy_term')->loadByProperties(['vid' => 'topic']) as $term) {
  if (!$dry) {
    $term_pathauto->set($term->id(), 0);
  }
  if ($term->hasField('field_landing_page') && !$term->get('field_landing_page')->isEmpty()) {
    $nid = $term->get('field_landing_page')->target_id;
    if (!$etm->getStorage('node')->load($nid)) {
      continue;
    }
    $redirect('taxonomy/term/' . $term->id(), 'internal:/node/' . $nid, 'retired topic page: ' . $term->label());
  }
}

// ----------------------------------------------- 2. Old site -> new site
// [old address, new address] — straight from the document's first table.
// An old address that is STILL a live page (alias/route) is reported, not
// redirected: redirecting a live page would also take the page itself away.
$old_site = [
  ['state-authorization/how-it-works', '/learning-center'],
  ['state-authorization/why-comply', '/topics'],
  ['about-san/statement-work', '/enroll'],
  ['member-institutions-organizations', '/institutions-organizations'],
  ['resources/compliance-requirements-non-sara', '/beyond-reciprocity'],
  ['resources/getting-started', '/learning-center'],
  ['form/join-san', '/enroll'],
  ['about-san', '/our-network'],
  ['membership', '/enroll'],
  // The coordinator list view's path is /coordinator-list on the live site; the
  // document keeps /membership/coordinator-list working.
  ['membership/coordinator-list', '/coordinator-list'],
];
foreach ($old_site as [$source, $target]) {
  $target_path = $resolve($target);
  $target_uri = $target_path ? 'internal:' . $target_path : NULL;
  if (!$target_path && \Drupal::service('path.validator')->getUrlIfValidWithoutAccessCheck($target)) {
    $target_uri = 'internal:' . $target;   // a routed path (e.g. a view), not an alias
  }
  if (!$target_uri) {
    $say("old /$source: target $target doesn't exist here, skipped");
    continue;
  }
  $live = (bool) \Drupal::service('path.validator')->getUrlIfValidWithoutAccessCheck($source);
  if ($live) {
    $existing = $redirect_storage->loadByProperties(['redirect_source__path' => $source]);
    if ($existing) {
      $say("old /$source: already redirected, skipped");
      continue;
    }
    // Retire the old page: the client's document replaces it with $target.
    // Only an aliased page can be retired safely — its alias is removed (the
    // redirect module never fires for an address that is still a live alias),
    // the content itself is NOT unpublished or changed, and the system path
    // (node/N, webform/x) is redirected too so search results and any internal
    // links to it land on the replacement. Undo = delete the redirects, re-add
    // the alias.
    $system = $resolve('/' . $source);
    if (!$system) {
      $say("old /$source: !! live but not an alias — NOT redirected, needs a human decision");
      $notes[] = "/$source is still a live page (wanted: -> $target)";
      continue;
    }
    foreach ($alias_storage->loadByProperties(['alias' => '/' . $source]) as $a) {
      if (!$dry) {
        $a->delete();
      }
    }
    if (!$dry && preg_match('#^/node/(\d+)$#', $system, $m)) {
      $node_pathauto->set($m[1], 0);
    }
    $say("old /$source ($system): RETIRED — alias removed, content untouched");
    $redirect($source, $target_uri, 'retired old page');
    $redirect(ltrim($system, '/'), $target_uri, 'retired old page (system path)');
    // Redirects that pointed at the retired page (e.g. a topic term's) go to the replacement.
    foreach ($redirect_storage->loadByProperties(['redirect_redirect__uri' => 'internal:' . $system]) as $r) {
      if (!$dry) {
        $r->set('redirect_redirect', ['uri' => $target_uri])->save();
      }
      $say("redirect {$r->getSourceUrl()}: re-pointed from $system to $target");
    }
    continue;
  }
  $redirect($source, $target_uri, 'old site');
}

if ($notes) {
  echo "\nNEEDS A DECISION:\n - " . implode("\n - ", $notes) . "\n";
}
echo "DONE\n";
