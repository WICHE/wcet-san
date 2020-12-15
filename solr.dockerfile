FROM amazeeio/solr-6.6

COPY .lagoon/solr /solr-conf

RUN precreate-core drupal /solr-conf

CMD ["solr-foreground"]