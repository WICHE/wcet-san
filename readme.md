# WCET - SAN

## Git workflow

Since this site is hosted with Amazee.io, we use git flow. The develop branch is deployed to the development environment and the master branch is deployed to the production environment. Deployment happens when either of these branches receive a push.

## Hosting

* Platform: Amazee.io
* Dev URL: http://portal.stateauthorization.org.develop.us2.compact.amazee.io/
* Prod URL: https://wcetsan.wiche.edu

### Shield credentials

* Username: san
* Password: 3ditsan

## Config workflow

This project uses CMI for all configuration changes. To make a configuration update, first, sync the production database to your local environment and export and commit any config changes from the production environment to the project repo. After that, make your new configuration changes on your local environment, export those changes and commit them to the project repo. Once you've finished push those changes to the remote environment and run `drush cim` to import all new configuration.


## Composer

All packages in this project are managed using Composer - see composer.json for detailed information about each package. This project is built serverside, so none of the vendor directories are commited. Be sure to run `composer install` when you first download the site and `composer update` when you are pulling updates.