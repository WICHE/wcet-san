<?php

//Trusted host patterns
$settings['trusted_host_patterns'] = array(
    '^amazee\.io$',
    '^.+\.amazee\.io$',
    '^wiche\.edu$',
    '^.+\.wiche\.edu$'
);

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

// amazee.io Varnish & Reverse proxy settings
if (getenv('AMAZEEIO_VARNISH_HOSTS') && getenv('AMAZEEIO_VARNISH_SECRET')) {
    $varnish_hosts = explode(',', getenv('AMAZEEIO_VARNISH_HOSTS'));
    array_walk($varnish_hosts, function(&$value, $key) { $value .= ':6082'; });
    $settings['reverse_proxy'] = TRUE;
    $settings['reverse_proxy_addresses'] = array_merge(explode(',', getenv('AMAZEEIO_VARNISH_HOSTS')), array('127.0.0.1'));
    $config['varnish.settings']['varnish_control_terminal'] = implode($varnish_hosts, " ");
    $config['varnish.settings']['varnish_control_key'] = getenv('AMAZEEIO_VARNISH_SECRET');
    $config['varnish.settings']['varnish_version'] = 4;
}

// Hash Salt
if (getenv('AMAZEEIO_HASH_SALT')) {
    $settings['hash_salt'] = getenv('AMAZEEIO_HASH_SALT');
}

// Settings for all environments
if (file_exists(__DIR__ . '/all.settings.php')) {
    include __DIR__ . '/all.settings.php';
}
// Services for all environments
if (file_exists(__DIR__ . '/all.services.yml')) {
    $settings['container_yamls'][] = __DIR__ . '/all.services.yml';
}
if(getenv('AMAZEEIO_SITE_ENVIRONMENT')){
    // Environment specific settings files.
    if (file_exists(__DIR__ . '/' . getenv('AMAZEEIO_SITE_ENVIRONMENT') . '.settings.php')) {
        include __DIR__ . '/' . getenv('AMAZEEIO_SITE_ENVIRONMENT') . '.settings.php';
    }
    // Environment specific services files.
    if (file_exists(__DIR__ . '/' . getenv('AMAZEEIO_SITE_ENVIRONMENT') . '.services.yml')) {
        $settings['container_yamls'][] = __DIR__ . '/' . getenv('AMAZEEIO_SITE_ENVIRONMENT') . '.services.yml';
    }
}
// Last: this servers specific settings files.
if (file_exists(__DIR__ . '/settings.local.php')) {
    include __DIR__ . '/settings.local.php';
}
// Last: This server specific services file.
if (file_exists(__DIR__ . '/local.services.yml')) {
    $settings['container_yamls'][] = __DIR__ . '/local.services.yml';
}$settings['install_profile'] = 'standard';
