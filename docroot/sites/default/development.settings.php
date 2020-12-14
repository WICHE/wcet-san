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
$config['environment_indicator.indicator']['name'] = 'Amazee ' . getenv('AMAZEEIO_SITE_ENVIRONMENT') . ' [Master DB]';
$config['environment_indicator.indicator']['bg_color'] = '#000000';

// Disable Tag Manager
$config['e3_google_tag.settings']['gtm_code'] = '';

// Solr config
//$config['search_api.server.solr']['backend_config']['connector_config']['host'] = 'localhost';
//$config['search_api.server.solr']['backend_config']['connector_config']['port'] = 32772;
//$config['search_api.server.solr']['backend_config']['connector_config']['path'] = '';

// Stage file proxy URL from production URL.
if (getenv('LAGOON_PRODUCTION_URL')){
  $config['stage_file_proxy.settings']['origin'] = getenv('LAGOON_PRODUCTION_URL');
}
