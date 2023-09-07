import $ from "jquery";
import filterItem from "./search-main/components/FilterItem";

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
let pos = {left: 0, x: 0};

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

navDropdowns.forEach(function (dropdown) {
  dropdown.addEventListener('focusout', function (event) {

    // Use setTimeout to delay the check until after the focus has fully moved
    setTimeout(function () {
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
  window.innerWidth < 900 && setTimeout(function () {
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
window.addEventListener('load', function () {
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

  firstLvlNavLinks.forEach(nav => nav.setAttribute('aria-expanded', 'false'));
  nestedNavs.forEach(nestedNav => nestedNav.setAttribute('role', 'menu'));
})

/*
  Operate the dropdown label for screen reader's readability.
  Open/hide the search box inside dropdowns.
  Add aria for the search bar.
 */
window.addEventListener('load', function () {
  const selects = document.querySelectorAll('.js-form-type-select');

  selects.forEach((select) => {
    const label = select.querySelector('label');
    const dropDownTrigger = select.querySelector('.select2-selection');
    const selectElem = select.querySelector('select');
    const id = label.getAttribute('for');

    if (dropDownTrigger) {
      label.setAttribute('id', id);
      dropDownTrigger.setAttribute('aria-labelledby', id);
      selectElem.removeAttribute('id');
    }
  });

  const select2s = document.querySelectorAll('.select2-selection');

  function operateAttributes(e) {
    const select2Element = e.target.closest('.select2-selection');

    if (select2Element && select2Element.getAttribute('aria-expanded') === 'true') {
      const selectElem = e.target.closest('.js-form-type-select');
      const labelID = selectElem.querySelector('label').getAttribute('id');
      const dropDownMenu = document.querySelector('.select2-results__options');
      const searchBar = document.querySelector('.select2-search--dropdown');
      const optionsNum = dropDownMenu.querySelectorAll('.select2-results__option').length;

      if (searchBar) {
        searchBar.querySelector('input').setAttribute('aria-labelledby', labelID);

        optionsNum > 15
          ? searchBar.classList.add('searchable')
          : searchBar.classList.remove('searchable');
      }
    }
  }

  select2s.forEach(select => {
    select.addEventListener('click', (e) => operateAttributes(e));
    select.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === 'Space') {
        operateAttributes(e);
      }

      if (e.key === 'ArrowDown' && select.getAttribute('aria-expanded') === 'true') {
        const options = document.querySelectorAll('.select2-results__option');

        if (options && options.length > 15) {
          document.querySelector('.select2-search__field').focus();
        }
      }
    });
  });
});

/*
  Rm img redundant attrs.
 */
window.addEventListener('load', () => {
  const cards = document.querySelectorAll('.paragraph--type--simple-card');
  const header = document.querySelector('.paragraph--type--compound-header-content')
  const thumbnails = document.querySelectorAll('.field--name-thumbnail');

  cards && cards.forEach(card => makeAltEmpty(card.querySelector('img')))
  header && makeAltEmpty(header.querySelector('img'));
  thumbnails && thumbnails.forEach(thumbnail => makeAltEmpty(thumbnail.querySelector('img[alt="thumbnail"]')))
})

function makeAltEmpty(el) {
  el && el.setAttribute('alt', '');
}

/*
 Add pdf indicators to links with pdf.
 */
document.querySelectorAll('a').forEach(function (a) {
  if (a.href.endsWith('.pdf')) {
    a.setAttribute('data-content-type', 'pdf');
    a.innerHTML += ' (PDF)';
  }
});

/*
  Join san web-form fields attributes.
 */
window.addEventListener('load', () => {
  const joinSanForm = document.querySelector('.webform-submission-join-san-form');
  const loginForm = document.querySelector('.user-login-form');
  const formTable = joinSanForm && joinSanForm.querySelector('table');
  const ariaLvlLi = document.querySelectorAll('li[aria-level]');
  const summaryElements = document.querySelectorAll('summary');
  const h3Elements = document.querySelectorAll('h3.form-required');

  // Add role attr to 2-layout table.
  formTable && formTable.setAttribute('role', 'presentation');

  // Remove redundant attrs from listst.
  ariaLvlLi && ariaLvlLi.forEach((li) => li.removeAttribute('aria-level'));

  // Summary elements operations.
  summaryElements && summaryElements.forEach(summary => {
    const detailsTitleLink = summary.querySelector('.details-title');

    if(detailsTitleLink) {
      const span = document.createElement('span');
      span.innerHTML = detailsTitleLink.innerHTML;

      // Replace the link with the span content
      summary.replaceChild(span, detailsTitleLink);
    }

    summary.removeAttribute('aria-expanded');
    summary.removeAttribute('tabindex');
    summary.removeAttribute('role');
    summary.removeAttribute('aria-pressed');
  });

  // Replace all the redundant h3s into labels.
  h3Elements && h3Elements.forEach(h3 => {
    // Create a label element
    const label = document.createElement('label');

    // Copy the contents of h3 to the label
    label.innerHTML = h3.innerHTML;

    // Copy the class from h3 to label
    label.className = h3.className;

    // Replace the h3 with the label
    h3.parentNode.replaceChild(label, h3);
  });

  if (joinSanForm) {
    const fields= [
      { name: 'first_name', autocomplete: 'given-name', selector: '[name^="full_name"][name$="[first]"]' },
      { name: 'last_name', autocomplete: 'family-name', selector: '[name^="full_name"][name$="[last]"]' },
      { name: 'job', autocomplete: 'organization-title', selector: '[name^="full_name"][name$="[degree]"]' },
      { name: 'institution', autocomplete: 'organization', selector: '[name^="institution_organization"]' },
      { name: 'address', autocomplete: 'street-address', selector: '[name^="address"][name$="[address]"]' },
      { name: 'city', autocomplete: 'address-level2', selector: '[name^="address"][name$="[city]"]' },
      { name: 'state', autocomplete: 'address-level1', selector: '[name^="address"][name$="[state_province]"]' },
      { name: 'zip', autocomplete: 'postal-code', selector: '[name^=""][name$="[postal_code]"]' },
      { name: 'country', autocomplete: 'country-name', selector: '[name^=""][name$="[country]"]' },
      { name: 'email', autocomplete: 'email', selector: '[name^="contact_information"][name$="[email]"]' },
      { name: 'phone_number', autocomplete: 'tel-national', selector: '[name^="contact_information"][name$="[phone]"]' },
    ];

    fields.forEach(field => {
      const { autocomplete, selector } = field;
      const keyElements = document.querySelectorAll(selector);

      keyElements.forEach(el => {
        el.setAttribute('autocomplete', autocomplete);
      })
    })
  }

  if (loginForm) {
    loginForm.querySelector('input[name="name"]').setAttribute('autocomplete', 'username');
    loginForm.querySelector('input[name="pass"]').setAttribute('autocomplete', 'current-password');
  }
})

/*
  Url copy button.
 */
window.addEventListener('load', () => {
  const copyButton = document.querySelector('.share-url-btn');

  if (copyButton) {
    const copyToClipboard = () => {
      const copyText = copyButton.getAttribute('data-clipboard-text');
      navigator.clipboard.writeText(copyText)
        .then(() => {
          console.log('Copying to clipboard was successful!');
          copyButton.classList.add('copied');
        })
        .catch(err => {
          console.error('Could not copy text: ', err);
        });
    };

    copyButton.addEventListener('click', copyToClipboard);
    copyButton.addEventListener('keyup', (event) => {
      if (event.key === 'Enter') {
        copyToClipboard();
      }
    });
  }
});

/*
  Remove all the aria-invalids, where they're not necessary.
  Note, it targets 'data-prevent-aria-invalid' elements only.
 */
window.addEventListener('load', () => {
  const targetNodes = document.querySelectorAll('input[data-prevent-aria-invalid="true"]');
  targetNodes && targetNodes.forEach(targetNode => targetNode.removeAttribute('aria-invalid'));
});

/*
  Removing the redundant accordion attributes.
 */
window.addEventListener('load', () => {
  const accordion = document.querySelector('.accordion');
  const accordionItems = document.querySelectorAll('.accordion-item');

  if (accordion) accordion.removeAttribute('role');

  if (accordionItems.length) {
    accordionItems.forEach((item) => {
      const trigger = item.querySelector('a[role="tab"]');
      if (trigger) trigger.removeAttribute('role');

      const content = item.querySelector('div[role="tabpanel"]');
      if (content) content.removeAttribute('role');
    });
  }
});

/*
  Add resource table heading vertical data-attr.
 */
window.addEventListener('load', () => {
  const table = document.querySelector('.node--type-resource-table table');

  if (table) {
    const horizontalHeaders = table.querySelectorAll('tbody tr > th:first-child');
    horizontalHeaders && horizontalHeaders.forEach(header => header.setAttribute('scope', 'row'));

    const nestedTables = table.querySelectorAll('table');
    nestedTables && nestedTables.forEach(table => table.setAttribute('role', 'presentation'));
  }
});

/*
  Replace all the Thumbnails' alt text with its title if exist.
 */
window.addEventListener('load', () => {
  const images = document.querySelectorAll('img[alt="Thumbnail"]');

  images.forEach(function(img) {
    if (img.hasAttribute('title')) {
      img.setAttribute('alt', img.getAttribute('title'));
    }
  });
});

/*
  Select2 attributes.
 */
window.addEventListener('load', () => {
  const selects = document.querySelectorAll('.select2 .select2-selection__rendered');

  $('.select2-selection__rendered').hover(function () {
    $(this).removeAttr('title');
  });

  selects &&  selects.forEach(function(select) {
    if (select.hasAttribute('title')) {
      select.removeAttribute('title');
    }
  });
});

/*
  Remove redundant pager attributes.
 */
window.addEventListener('load', () => {
  const pagerItems = document.querySelectorAll('nav.pager .pager__item a');

  pagerItems &&  pagerItems.forEach(function(item) {
    if (item.hasAttribute('title')) {
      item.removeAttribute('title');
    }
  });
});

/*
  Hide the scroll down after 3s.
 */
window.addEventListener('load', () => {
  const arrow = document.querySelector('.paragraph .view-more');

  if (!arrow) return;

  setTimeout(function () {
    arrow.classList.add('transparent');
  }, 3000);
});

/*
  Remove attrs.
 */
window.addEventListener('load', () => {
  const selectors = ['article', 'header', 'nav', 'main', 'footer'];

  selectors.forEach(function(selector) {
    const elements = document.querySelectorAll(selector);

    elements.forEach(function(el) {
      el.hasAttribute('role') && el.removeAttribute('role');
    });
  });
});

/*
  Remove data attrs from navigation.
 */
window.addEventListener('load', () => {
  const menus = document.querySelectorAll('ul.menu');
  const menuItems = document.querySelectorAll('ul.menu .menu-item a');
  const utilNav = document.querySelector('.menu--util-navigation');

  utilNav && utilNav.removeAttribute('aria-labelledby');

  menuItems && menuItems.forEach(function (el) {
    el.removeAttribute('role');
  });

  menus && menus.forEach(function(element) {
    element.removeAttribute('role');
  });
});
