/**
 * paragraphs-improvements.js
 * Improve the paragraphs admin ui
 */

!function($){
  "use strict";

  Drupal.behaviors.paragraphsPreviewerImprover = {
    attach: function(context, settings) {
      var $previewerButtons = $('.link.paragraphs-previewer', context);

      $previewerButtons.each((i, el) => {
        var $previewerButton = $(el);
        replaceParagraphName($previewerButton);
      });

      // Get paragraphs previews by only targeting ones with the .paragraph-type-top as a sibling
      // so nested paragraphs previews don't break
      var $paragraphsTopElements = $('.paragraph-type-top', context);
      var $paragraphsPreviews = $paragraphsTopElements.siblings('.paragraph--view-mode--preview');

      formatParagraphsPreviews($paragraphsPreviews);

      // Necessary for paragraphs previews behind tabs
      $('.vertical-tabs__menu a').on("click", () => {
        formatParagraphsPreviews($paragraphsPreviews);
      });
    }
  };

  // Because drupal behaviors are so annoying, add delegated click handler here, couldn't get it to work properly
  // inside the behavior
  $(document).ready(function() {
    $('body').on('click', '.paragraph--view-mode--preview', function() {
      $(this).toggleClass('expanded');
    });
  });

  /**
   * Add the type to the previewer button if you want
   * @param previewerButton
   */
  function replaceParagraphName(previewerButton) {
    var paragraphName = previewerButton.siblings('.paragraph-type-title').text();
    previewerButton.val(`Preview: ${paragraphName}`);
  }

  /**
   * Format the previews to be expandable
   * @param paragraphsPreviews
   */
  function formatParagraphsPreviews(paragraphsPreviews) {
    paragraphsPreviews.each((i, el) => {
      var $this = $(el);
      if ($this.outerHeight() >= 100) {
        $this.addClass('expandable');
      }
    });
  }

}(jQuery);