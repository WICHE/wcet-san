<?php
/**
 * @file
 * amazee.io Drupal 8 development environment configuration file.
 *
 * This file will only be included on development environments.
 */

// Show all error messages on the site
$config['system.logging']['error_level'] = 'verbose';

/**
 * Load services definition file.
 */
$settings['container_yamls'][] = $app_root . '/' . $site_path . '/local.services.yml';

/**
 * Disable the render cache (this includes the page cache).
 *
 * Note: you should test with the render cache enabled, to ensure the correct
 * cacheability metadata is present. However, in the early stages of
 * development, you may want to disable it.
 *
 * This setting disables the render cache by using the Null cache back-end
 * defined by the development.services.yml file above.
 *
 * Do not use this setting until after the site is installed.
 */
$settings['cache']['bins']['render'] = 'cache.backend.null';

/**
 * Disable Dynamic Page Cache.
 *
 * Note: you should test with Dynamic Page Cache enabled, to ensure the correct
 * cacheability metadata is present (and hence the expected behavior). However,
 * in the early stages of development, you may want to disable it.
 */
$settings['cache']['bins']['dynamic_page_cache'] = 'cache.backend.null';
$settings['cache']['bins']['page'] = 'cache.backend.null';

// Configure shield for test environment.
$config['shield.settings']['user'] = '';
$config['shield.settings']['pass'] = '';

// Environment Indicator Settings
$config['environment_indicator.indicator']['name'] = 'Amazee ' . 'local';
$config['environment_indicator.indicator']['bg_color'] = '#000000';

$config['system.performance']['css']['preprocess'] = FALSE;
$config['system.performance']['js']['preprocess'] = FALSE;
$settings['twig_debug'] = TRUE;

// Disable Tag Manager
$config['e3_google_tag.settings']['gtm_code'] = '';