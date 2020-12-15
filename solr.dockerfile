FROM amazeeio/solr:6.6

COPY .lagoon/solr /solr-conf

RUN precreate-core drupal /solr-conf
RUN chmod -R 777 /opt/solr/server/solr/mycores/drupal/conf

CMD ["solr-foreground"]