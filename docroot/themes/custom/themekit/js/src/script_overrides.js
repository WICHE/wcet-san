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

if ($(tableElement).length > 0) {
  $(tableElement)[0].parentElement.classList.add("has-embed-table");
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
};

$(tableElement).on('mousedown', mouseDownHandler);

/*
  Close the dropdown menu nav once user's focus is out.
 */
const navDropdowns = document.querySelectorAll('.submenu.is-dropdown-submenu.first-sub');

navDropdowns.forEach(function(dropdown) {
  dropdown.addEventListener('focusout', function(event) {

    // Use setTimeout to delay the check until after the focus has fully moved
    setTimeout(function() {
      const isFocusedOutsideMenu = !dropdown.contains(document.activeElement);

      if (isFocusedOutsideMenu) {
        dropdown.classList.toggle('js-dropdown-active');
        dropdown.closest('.menu-item').classList.toggle('is-active');
      }
    }, 0);
  });
});

/*
  Prevent mobile nav from focusing while collapsed.
 */
const mainNav = document.querySelector('.menu--main');
const hamburgerButton = document.querySelector('.hamburger .menu-button');

function updateMenuInertness() {
  (!mainNav.classList.contains('open') && window.innerWidth < 900)
    ? mainNav.setAttribute('inert', '')
    : mainNav.removeAttribute('inert');
}

function closeMobileNavOnFocusOut() {
  // Use setTimeout to delay the check until after the focus has fully moved
  window.innerWidth < 900 && setTimeout(function() {
    const isFocusedOutsideMenu = !mainNav.contains(document.activeElement);

    isFocusedOutsideMenu && hamburgerButton.click();
  }, 0);
}

updateMenuInertness();

mainNav.addEventListener('focusout', closeMobileNavOnFocusOut);
window.addEventListener('resize', updateMenuInertness);
hamburgerButton.addEventListener('click', updateMenuInertness);

/*
  Focus on error messages once page is loaded.
 */
window.addEventListener('load', function()  {
  const drupalMessagesWrapper = document.querySelector('.drupal-messages-wrapper');

  // If we have messages on the page-wait till focus appears (1s max) and refocus to message.
  drupalMessagesWrapper && setTimeout(() => drupalMessagesWrapper.focus(), 1000);
})

/*
  Operate the aria-attributes of the navigation correctly.
 */
window.addEventListener('load', function () {
  const firstLvlNavLinks = document.querySelectorAll('.is-dropdown-submenu-parent:not(.is-submenu-item) > a');
  const nestedNavs = document.querySelectorAll('.is-dropdown-submenu[role="menubar"]');

  firstLvlNavLinks.forEach(nav =>  nav.setAttribute('aria-expanded', 'false'));
  nestedNavs.forEach(nestedNav => nestedNav.setAttribute('role', 'menu'));
})
