/**
 * @file entity-browser-improvements.js
 *
 * Adds extra UI improvements to all entity browsers in the admin theme.
 */

!function($){
  "use strict";

  Drupal.behaviors.entityBrowserImprover = {
    attach: function(context, settings) {
      // Add .view-entity-browser-BROWSER-NAME to this list for browsers you want to add the click item functionality
      let $browserSelectors = [
        '.view-entity-browser-image',
        '.view-entity-browser-video',
        '.view-entity-browser-svg'
      ];

      let $browserCol = $($browserSelectors.join(', '), context).find('.views-row');

      $browserCol.click(function() {
        const $col = $(this);

        if ($col.hasClass('column-selected')) {
          uncheckColumn($col);
          return;
        }

        $browserCol.each(function() {
          uncheckColumn($(this));
        });

        checkColumn($col);
      });
    }
  };

  function uncheckColumn($target) {
    $target.find('input[type="checkbox"]').prop("checked", false);
    $target.removeClass('column-selected');
  }

  function checkColumn($target) {
    $target.find('input[type="checkbox"]').prop("checked", true);
    $target.addClass('column-selected');
  }
}(jQuery);