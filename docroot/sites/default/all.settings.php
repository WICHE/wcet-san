<?php
/**
 * @file
 * amazee.io Drupal 8 all environment configuration file.
 *
 * This file should contain all settings.php configurations that are needed by all environments.
 *
 * It contains some defaults that the amazee.io team suggests, please edit them as required.
 */

// Config settings
// $config_directories = array(
//     CONFIG_SYNC_DIRECTORY => '../config/default',
// );

// Set default paths to public, private and temp directories.
$settings['file_public_path'] = 'sites/default/files';
$settings['file_private_path'] = 'sites/default/files/private';

// Temp directory.
if (getenv('TMP')) {
    $config['system.file']['path']['temporary'] = getenv('TMP');
  }

// Access control for update.php script.
$settings['update_free_access'] = FALSE;

//Authorized file system operations.
$settings['allow_authorize_operations'] = FALSE;

// Default mode for directories and files written by Drupal.

$settings['file_chmod_directory'] = 0775;
$settings['file_chmod_file'] = 0664;

// Environment Indicator settings
$config['environment_indicator.indicator']['bg_color'] = '#930007';
$config['environment_indicator.indicator']['fg_color'] = '#ffffff';
$config['environment_indicator.indicator']['name'] = 'amazee.io ' . getenv('LAGOON_ENVIRONMENT_TYPE');

// Install profile settings
$settings['install_profile'] = 'standard';

$settings['config_exclude_modules'] = ['upgrade_rector', 'upgrade_status'];
