import $ from "jquery";

const tableElement = $(".node--type-resource-table .field--name-body > table");

$(tableElement).on("scroll", function () {
  if ($(this).scrollLeft() > 0) {
    $(this).hasClass("scrolling") ? "" : $(this).addClass("scrolling");
  } else {
    $(this).hasClass("scrolling") ? $(this).removeClass("scrolling") : "";
  }
});


function checkOverflow(el) {
  // If node--type-resource-table is found
  if (el.length > 0) {
    const headerOverflow = $(el).find('thead')[0].clientWidth - 25
    const curOverflow = el[0].clientWidth;
    const isOverflowing = curOverflow < headerOverflow

    return isOverflowing;
  }
}

if (checkOverflow(tableElement) === true) {
  $(tableElement).addClass("scrollable");
  var scroll_hint = document.createElement("span");
  $(scroll_hint).addClass("scroll-hint");
  $(tableElement)[0].parentElement.classList.add("show-scroll-hint");
  $(tableElement)[0].parentElement.prepend(scroll_hint);
}

const tableTopRows = tableElement.find("> tbody > tr");

tableTopRows.map(function (key, row) {
  let tallestTableHeight = 0;
  const tables = $(row).find("table");

  // Find the tallest table in the row and set the tallestTableHeight to be used for the row height
  tables.map(function (key, table) {
    $(table)[0].parentElement.classList.add("has-nested-table");
    tallestTableHeight = $(table)[0].clientHeight > tallestTableHeight ? $(table)[0].clientHeight : tallestTableHeight;
  });

  // Here attempt to find in each row if there is a table that has a row that is larger than usual which will affect the alignment
  tables.map(function (key, table) {
      let rows = $(table).find("tr");
      let rowHeights = []
      let outlierHeight = 0;
      let flexRowRatio = 0;

      rows.map(function (key, row) {
        rowHeights.push(row.clientHeight)
      });

      // Set flex basis values
      flexRowRatio = Number((Math.abs(100 / rowHeights.length)).toPrecision(2));
      rows.map(function (key, row) {
        row.style.flex = `0 0 ${flexRowRatio}%`;
      });

      // Special case - if you find a table that has a taller cell than the table rows / amount of cells then recalculate entire base row height.
      outlierHeight = (Math.max(...rowHeights) + 5);

      // if there is a outlier (larger table row that forces out of its container) take it recalculate the tallestTableHeight based on that outlier multiplied by the amount of rows that table has - this will become the increased table height used instead to maintain row alignment throughout
      tallestTableHeight = (outlierHeight * rowHeights.length > tallestTableHeight) ? outlierHeight * rowHeights.length : tallestTableHeight;
  });

  // Set all tds in the row that contains nested element to the tallest table
  tables.map(function (key, table) {
    $(table)[0].parentElement.style.height = `${tallestTableHeight}px`;
  });
});


// Make table draggable for better ui
let pos = { left: 0, x: 0 };

const mouseDownHandler = function (e) {
  pos = {
      // The current scroll
      left: $(tableElement)[0].clientLeft,
      // Get the current mouse position
      x: e.clientX,
  };

  // Change the cursor and prevent user from selecting the text
  $(tableElement).css("cursor", "grabbing");
  $(tableElement).css("user-select", "none");

  $(tableElement).on('mousemove', mouseMoveHandler);
  $(tableElement).on('mouseup', mouseUpHandler);
};

const mouseMoveHandler = function (e) {
  const dx = e.clientX - pos.x;

  // Scroll the element
  $(tableElement).scrollLeft(pos.left - dx);
};

const mouseUpHandler = function () {
  $(tableElement).off('mousemove');
  $(tableElement).off('mouseup');

  // Set some styling on mouse up
  $(tableElement).css("cursor", "grab");
  $(tableElement).css("user-select", "none");
};

$(tableElement).on('mousedown', mouseDownHandler);
