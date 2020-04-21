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


## Local Setup
**Requirements**
- Pygmy `sudo gem install pygmy`
- Docker for Mac

1. From project root run `pygmy up`
2. Inject custom SSH key if none was picked up `pygmy addkey [path/to/key]`
3. Composer Docker containers `docker-compose up -d`
3. Sometimes need to force recreate `docker-compose up -d --force-recreate`
4. SSH into container `docker-compose exec cli sh`
5. Composer install `composer install`
3. Stop development by running `pygmy stop`
4. Remove all containers by running `pygmy down`
5. Check status and SSH keys by running `pygmy status`

Need to log into Amazee UI dashboard to add SSH keys and check on environment setups.
May need to be added by Amazee support via Rocket Chat
Solr dashboard http://localhost:32781/solr/#/
