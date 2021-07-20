FROM uselagoon/solr-7.7-drupal:latest

RUN precreate-core wcet /solr-conf

CMD ["solr-foreground"]
