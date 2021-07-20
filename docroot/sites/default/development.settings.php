<?php
/**
 * @file
 * amazee.io Drupal 8 development environment configuration file.
 *
 * This file will only be included on development environments.
 */

// Show all error messages on the site
$config['system.logging']['error_level'] = 'all';

// Aggregate CSS files on
$config['system.performance']['css']['preprocess'] = TRUE;

// Aggregate JavaScript files on
$config['system.performance']['js']['preprocess'] = TRUE;

// Environment Indicator Settings
$config['environment_indicator.indicator']['name'] = 'amazee.io ' . getenv('LAGOON_ENVIRONMENT_TYPE') . ' [Development DB]';
$config['environment_indicator.indicator']['bg_color'] = '#000000';

// Disable Tag Manager
$config['e3_google_tag.settings']['gtm_code'] = '';
