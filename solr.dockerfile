FROM amazeeio/solr:6.6

COPY .lagoon/solr /solr-conf

RUN precreate-core drupal /solr-conf

# we need root for the fix-permissions to work
USER root

RUN mkdir -p /var/solr
RUN fix-permissions /var/solr \
    && chown solr:solr /var/solr \
    && fix-permissions /opt/solr/server/logs \
    && fix-permissions /opt/solr/server/solr \
    && fix-permissions /opt/solr/server/solr/mycores/drupal/data


# solr really doesn't like to be run as root, so we define the default user agin
USER solr

CMD ["solr-foreground"]