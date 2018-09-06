(function ($, Drupal, drupalSettings, CKEDITOR) {

  Drupal.behaviors.draggableItems = {
    attach: function (context, settings) {

      $('.draggable-items-container').each(function(e) {
        if (!$(this).hasClass('dragula-processed')) {
          initDraggableItems($(this));
          $(this).addClass('dragula-processed');
        }
      });

    }
  };

  // Make sure this WAS a wysiwyg initially, not any textarea, maybe selectors or something
  function initCkeditorFromSavedStatus(el, draggedItems) {
    $.each(draggedItems, function(i, value) {
      if ($(el).find('#'+value.id).length && value.config) {
        var newEditor = CKEDITOR.replace(value.id, value.config);
        newEditor.on('instanceReady', function() {
          newEditor.setData(value.content);
        });
      }
    });
  }

  function initDraggableItems($draggableItemContainers) {
    // Declare variables for the currently dragged item so they can be accessed in any even handler
    var draggedItems = [];

    // Initialize dragula on draggable containers
    var drake = dragula([$draggableItemContainers[0]], {
      // Only handle drags items
      moves: function (el, container, handle) {
        return $(el).children('.dragula-handle')[0] === $(handle)[0];
      },
      // Drop can only happen in source element
      accepts: function (el, target, source, sibling) {
        return target === source;
      }
    });

    // On drop we need to recreate the editor from saved config
    drake.on('drop', function(el, target, source, sibling) {
      adjustOrder(drake);
      initCkeditorFromSavedStatus(el, draggedItems);
    });

    // On cancel we need to recreate the editor from saved config
    drake.on('cancel', function(el, container, source) {
      initCkeditorFromSavedStatus(el, draggedItems);
    });

    // On drag start we need to save the config from the ckeditor instance and destroy it
    drake.on('drag', function(el, source) {
      // On drag start, reset the array to empty so you don't try to initialize the same element multiple times
      draggedItems = [];
      // Get id from textarea
      var $wysiwygs = $(el).find('.cke').siblings('textarea');
      $wysiwygs.each(function(i, el) {
        var draggedItemId = $(this).attr('id');
        if (CKEDITOR.instances[draggedItemId]) {
          var draggedItemInstance = CKEDITOR.instances[draggedItemId];
          var draggedItemConfig = draggedItemInstance.config;
          var draggedItemContent = draggedItemInstance.getData();
          draggedItems.push({
            id: draggedItemId,
            instance: draggedItemInstance,
            config: draggedItemConfig,
            content: draggedItemContent
          });
          if (draggedItemInstance) { draggedItemInstance.destroy(true); }
        }
      });
    });

    // Init dom-autoscroller for each drake instance
    var scroll = autoScroll([
      window
    ],{
      margin: 70,
      maxSpeed: 14,
      autoScroll: function(){
        return this.down && drake.dragging;
      }
    });
  }

  function adjustOrder(dragulaObject) {
    var $draggableItems = $(dragulaObject.containers[0]).children();
    $draggableItems.each(function(i, el) {
      // Because drupal has no useful selectors on the admin side and adds wrappers for newly created paragraphs,
      // we need to do this hanky panky to make sure we are only adjusting the weights of the currently adjusted items
      var $weightSelect = $(this).children('div').children('div').children('.form-type-select').children('select'),
          $weightSelectAjax = $(this).children('.ajax-new-content').children('div').children('div').children('.form-type-select').children('select');
      if ($weightSelect.length > 0) {
        $weightSelect.val(i);
      } else if ($weightSelectAjax.length > 0) {
        $weightSelectAjax.val(i);
      } else {
        console.log('Error: Cannot find valid paragraph weight to adjust!');
      }
    });
  }

})(jQuery, Drupal, drupalSettings, CKEDITOR);