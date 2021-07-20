<?php

// Trusted Host Patterns.
// Trusted host patterns are not necessary on lagoon as traffic will only
// be routed to your site via the routes (hosts) defined in .lagoon.yml.
if (getenv('LAGOON')) {
  $settings['trusted_host_patterns'][] = '.*';
}

### Lagoon Database connection
if(getenv('LAGOON')){
  $databases['default']['default'] = array(
    'driver' => 'mysql',
    'database' => getenv('MARIADB_DATABASE') ?: 'drupal',
    'username' => getenv('MARIADB_USERNAME') ?: 'drupal',
    'password' => getenv('MARIADB_PASSWORD') ?: 'drupal',
    'host' => getenv('MARIADB_HOST') ?: 'mariadb',
    'port' => 3306,
    'prefix' => '',
  );
}

### Lagoon Solr connection.
// WARNING: you have to create a search_api server having "solr" machine name at
// /admin/config/search/search-api/add-server to make this work.
if (getenv('LAGOON')) {
  $config['search_api.server.solr']['backend_config']['connector_config']['host'] = getenv('SOLR_HOST') ?: 'solr';
  $config['search_api.server.solr']['backend_config']['connector_config']['path'] = '';
  $config['search_api.server.solr']['backend_config']['connector_config']['core'] = getenv('SOLR_CORE') ?: 'wcet';
  $config['search_api.server.solr']['backend_config']['connector_config']['port'] = 8983;
  $config['search_api.server.solr']['backend_config']['connector_config']['http_user'] = (getenv('SOLR_USER') ?: '');
  $config['search_api.server.solr']['backend_config']['connector_config']['http']['http_user'] = (getenv('SOLR_USER') ?: '');
  $config['search_api.server.solr']['backend_config']['connector_config']['http_pass'] = (getenv('SOLR_PASSWORD') ?: '');
  $config['search_api.server.solr']['backend_config']['connector_config']['http']['http_pass'] = (getenv('SOLR_PASSWORD') ?: '');
  $config['search_api.server.solr']['name'] = 'Lagoon Solr - Environment: ' . getenv('LAGOON_PROJECT');
}

// Lagoon reverse proxy settings.
if (getenv('LAGOON')) {
  $settings['reverse_proxy'] = TRUE;
}
  
// Hash salt.
// Use HASH_SALT if found in the current environment otherwise fallback on
// MARIADB_HOST which is a randomly generated service name.
if (getenv('LAGOON')) {
  $settings['hash_salt'] = hash('sha256', getenv('HASH_SALT') ?: getenv('MARIADB_HOST'));
}

// The default list of directories that will be ignored by Drupal's file API.
if (empty($settings['file_scan_ignore_directories'])) {
  $settings['file_scan_ignore_directories'] = [
    'node_modules',
    'bower_components',
  ];
}

// Settings for all environments.
if (file_exists(__DIR__ . '/all.settings.php')) {
  include __DIR__ . '/all.settings.php';
}

// Services for all environments.
if (file_exists(__DIR__ . '/all.services.yml')) {
  $settings['container_yamls'][] = __DIR__ . '/all.services.yml';
}

if (getenv('LAGOON_ENVIRONMENT_TYPE')) {
  // Environment specific settings files.
  if (file_exists(__DIR__ . '/' . getenv('LAGOON_ENVIRONMENT_TYPE') . '.settings.php')) {
    include __DIR__ . '/' . getenv('LAGOON_ENVIRONMENT_TYPE') . '.settings.php';
  }

  // Environment specific services files.
  if (file_exists(__DIR__ . '/' . getenv('LAGOON_ENVIRONMENT_TYPE') . '.services.yml')) {
    $settings['container_yamls'][] = __DIR__ . '/' . getenv('LAGOON_ENVIRONMENT_TYPE') . '.services.yml';
  }
}

// Set config directory
$settings['config_sync_directory'] = '../config/default';
