<?php
/**
 * Created by PhpStorm.
 * User: mike
 * Date: 10/25/16
 * Time: 11:27 AM
 */

namespace DrupalProject\composer;

use Composer\Script\Event;
use Composer\Semver\Comparator;
use Symfony\Component\Filesystem\Filesystem;


class ParagonScriptHandler extends ScriptHandler {
  public static function removeGitSubmodules (Event $event) {
    exec("find " . getcwd() . "'/vendor' | grep .git | xargs rm -rf");
    exec("find " . getcwd() . "'/docroot/modules/contrib' | grep .git | xargs rm -rf");
    $event->getIO()->write("Removed all .git files from vendor and contrib.");
  }

  public static function createPrivateTempDirectories (Event $event) {
    $fs = new Filesystem();
    $root = '.';

    $dirs = array(
      'private',
      'private/tmp',
    );

    // Required for unit testing
    foreach ($dirs as $dir) {
      if (!$fs->exists($root . '/'. $dir)) {
        $fs->mkdir($root . '/'. $dir);
        $event->getIO()->write("Created directory \"$dir\".");
      }
    }
  }

  public static function makeRobotsHidden (Event $event) {
    $fs = new Filesystem();
    $root = static::getDrupalRoot(getcwd());
    $robots_hidden_path = $root . '/robots_hidden.txt';
    if(!$fs->exists($robots_hidden_path)) {
      $fs->touch($robots_hidden_path);
      // Open the file to get existing content
      $current = file_get_contents($robots_hidden_path);
      $current .= "#\n";
      $current .= "# robots.txt\n";
      $current .= "#\n";
      $current .= "# This file is to prevent the crawling and indexing of certain parts\n";
      $current .= "# of your site by web crawlers and spiders run by sites like Yahoo!\n";
      $current .= "# and Google. By telling these \"robots\" where not to go on your site,\n";
      $current .= "# you save bandwidth and server resources.\n";
      $current .= "#\n";
      $current .= "# This file will be ignored unless it is at the root of your host:\n";
      $current .= "# Used:    http://example.com/robots.txt\n";
      $current .= "# Ignored: http://example.com/site/robots.txt\n";
      $current .= "#\n";
      $current .= "# For more information about the robots.txt standard, see:\n";
      $current .= "# http://www.robotstxt.org/robotstxt.html\n";
      $current .= "\n";
      $current .= "User-agent: *\n";
      $current .= "Disallow: /\n";

      file_put_contents($robots_hidden_path, $current);


      $event->getIO()->write("Created a robots_hidden.txt file for non-production environments.");
    }
  }
}