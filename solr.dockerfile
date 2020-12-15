FROM amazeeio/solr:6.6-drupal

COPY .lagoon/solr /solr-conf

RUN precreate-core drupal /solr-conf

CMD ["solr-foreground"]