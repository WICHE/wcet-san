<?php
/**
 * @file
 * amazee.io Drupal 8 production environment configuration file.
 *
 * This file will only be included on production environments.
 */

// Set GTM Code
$config['e3_google_tag.settings']['gtm_code'] = 'GTM-WCL5JC8';

// Don't show any error messages on the site (will still be shown in watchdog)
$config['system.logging']['error_level'] = 'hide';

// Expiration of cached pages on Varnish to 15 min
$config['system.performance']['cache']['page']['max_age'] = 900;

// Aggregate CSS files on
$config['system.performance']['css']['preprocess'] = TRUE;

// Aggregate JavaScript files on
$config['system.performance']['js']['preprocess'] = TRUE;

// Environment Indicator Settings
$config['environment_indicator.indicator']['name'] = 'Amazee ' . getenv('AMAZEEIO_SITE_ENVIRONMENT') . ' [Master DB]';
$config['environment_indicator.indicator']['bg_color'] = '#930007';
$config['environment_indicator.indicator']['fg_color'] = '#ffffff';