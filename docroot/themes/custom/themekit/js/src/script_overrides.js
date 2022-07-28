import $ from "jquery";

const tableElement = $(".node--type-resource-table .field--name-body > table");

$(tableElement).on("scroll", function () {
  if ($(this).scrollLeft() > 0) {
    $(this).hasClass("scrolling") ? "" : $(this).addClass("scrolling");
  } else {
    $(this).hasClass("scrolling") ? $(this).removeClass("scrolling") : "";
  }
});

const tableTopRows = tableElement.find("> tbody > tr");

tableTopRows.map(function (key, row) {
  let tallestTableHeight = 0;
  const tables = $(row).find("table");

  console.log(`row ${key}:`)

  // Find the tallest table in the row
  tables.map(function (key, table) {
    console.log($(table)[0].clientHeight);

    $(table)[0].parentElement.classList.add("has-nested-table");
    tallestTableHeight = $(table)[0].clientHeight > tallestTableHeight ? $(table)[0].clientHeight : tallestTableHeight;
  });


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

      outlierHeight = (Math.max(...rowHeights) + 5);

      tallestTableHeight = (outlierHeight * rowHeights.length > tallestTableHeight) ? outlierHeight * rowHeights.length : tallestTableHeight;

    // Special case - if you find a table that has a taller cell than the table rows / amount of cells then recalculate entire base row height.
    // let rows = $(table).find("tr");
    // console.log("")
    // tallestTable = $(table)[0].clientHeight > tallestTable ? $(table)[0].clientHeight : tallestTable;
  });

  // Set all tds in the row that contains nested element to the tallest table
  tables.map(function (key, table) {
    $(table)[0].parentElement.style.height = `${tallestTableHeight}px`;
  });
});

function checkOverflow(el) {
  // If node--type-resource-table is found
  if (el.length > 0) {
    const headerOverflow = el[0].tHead.clientWidth;
    const curOverflow = el[0].clientWidth;

    if (!curOverflow || curOverflow === "visible") {
      el.style.overflow = "hidden";
    }

    const isOverflowing = curOverflow < headerOverflow;

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
