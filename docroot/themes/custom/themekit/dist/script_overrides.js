/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, { enumerable: true, get: getter });
/******/ 		}
/******/ 	};
/******/
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = function(exports) {
/******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		}
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/
/******/ 	// create a fake namespace object
/******/ 	// mode & 1: value is a module id, require it
/******/ 	// mode & 2: merge all properties of value into the ns
/******/ 	// mode & 4: return value when already ns object
/******/ 	// mode & 8|1: behave like require
/******/ 	__webpack_require__.t = function(value, mode) {
/******/ 		if(mode & 1) value = __webpack_require__(value);
/******/ 		if(mode & 8) return value;
/******/ 		if((mode & 4) && typeof value === 'object' && value && value.__esModule) return value;
/******/ 		var ns = Object.create(null);
/******/ 		__webpack_require__.r(ns);
/******/ 		Object.defineProperty(ns, 'default', { enumerable: true, value: value });
/******/ 		if(mode & 2 && typeof value != 'string') for(var key in value) __webpack_require__.d(ns, key, function(key) { return value[key]; }.bind(null, key));
/******/ 		return ns;
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = "./js/src/script_overrides.js");
/******/ })
/************************************************************************/
/******/ ({

/***/ "./js/src/script_overrides.js":
/*!************************************!*\
  !*** ./js/src/script_overrides.js ***!
  \************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var _jquery = __webpack_require__(/*! jquery */ "jquery");

var _jquery2 = _interopRequireDefault(_jquery);

function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : { default: obj };
}

var tableElement = (0, _jquery2.default)(".node--type-resource-table .field--name-body > table");

(0, _jquery2.default)(tableElement).on("scroll", function () {
  if ((0, _jquery2.default)(this).scrollLeft() > 0) {
    (0, _jquery2.default)(this).hasClass("scrolling") ? "" : (0, _jquery2.default)(this).addClass("scrolling");
  } else {
    (0, _jquery2.default)(this).hasClass("scrolling") ? (0, _jquery2.default)(this).removeClass("scrolling") : "";
  }
});

function checkOverflow(el) {
  // If node--type-resource-table is found
  if (el.length > 0) {
    var headerOverflow = (0, _jquery2.default)(el).find('thead')[0].clientWidth - 25;
    var curOverflow = el[0].clientWidth;
    var isOverflowing = curOverflow < headerOverflow;

    return isOverflowing;
  }
}

if (checkOverflow(tableElement) === true) {
  (0, _jquery2.default)(tableElement).addClass("scrollable");
  var scroll_hint = document.createElement("span");
  (0, _jquery2.default)(scroll_hint).addClass("scroll-hint");
  (0, _jquery2.default)(tableElement)[0].parentElement.classList.add("show-scroll-hint");
  (0, _jquery2.default)(tableElement)[0].parentElement.prepend(scroll_hint);
}

if ((0, _jquery2.default)(tableElement).length > 0) {
  (0, _jquery2.default)(tableElement)[0].parentElement.classList.add("has-embed-table");
}

var tableTopRows = tableElement.find("> tbody > tr");

tableTopRows.map(function (key, row) {
  var tallestTableHeight = 0;
  var tables = (0, _jquery2.default)(row).find("table");

  // Find the tallest table in the row and set the tallestTableHeight to be used for the row height
  tables.map(function (key, table) {
    (0, _jquery2.default)(table)[0].parentElement.classList.add("has-nested-table");
    tallestTableHeight = (0, _jquery2.default)(table)[0].clientHeight > tallestTableHeight ? (0, _jquery2.default)(table)[0].clientHeight : tallestTableHeight;
  });

  // Here attempt to find in each row if there is a table that has a row that is larger than usual which will affect the alignment
  tables.map(function (key, table) {
    var rows = (0, _jquery2.default)(table).find("tr");
    var rowHeights = [];
    var outlierHeight = 0;
    var flexRowRatio = 0;

    rows.map(function (key, row) {
      rowHeights.push(row.clientHeight);
    });

    // Set flex basis values
    flexRowRatio = Number(Math.abs(100 / rowHeights.length).toPrecision(2));
    rows.map(function (key, row) {
      row.style.flex = "0 0 " + flexRowRatio + "%";
    });

    // Special case - if you find a table that has a taller cell than the table rows / amount of cells then recalculate entire base row height.
    outlierHeight = Math.max.apply(Math, rowHeights) + 5;

    // if there is a outlier (larger table row that forces out of its container) take it recalculate the tallestTableHeight based on that outlier multiplied by the amount of rows that table has - this will become the increased table height used instead to maintain row alignment throughout
    tallestTableHeight = outlierHeight * rowHeights.length > tallestTableHeight ? outlierHeight * rowHeights.length : tallestTableHeight;
  });

  // Set all tds in the row that contains nested element to the tallest table
  tables.map(function (key, table) {
    (0, _jquery2.default)(table)[0].parentElement.style.height = tallestTableHeight + "px";
  });
});

// Make table draggable for better ui
var pos = { left: 0, x: 0 };

var mouseDownHandler = function mouseDownHandler(e) {
  pos = {
    // The current scroll
    left: (0, _jquery2.default)(tableElement)[0].clientLeft,
    // Get the current mouse position
    x: e.clientX
  };

  (0, _jquery2.default)(tableElement).on('mousemove', mouseMoveHandler);
  (0, _jquery2.default)(tableElement).on('mouseup', mouseUpHandler);
};

var mouseMoveHandler = function mouseMoveHandler(e) {
  var dx = e.clientX - pos.x;

  // Scroll the element
  (0, _jquery2.default)(tableElement).scrollLeft(pos.left - dx);
};

var mouseUpHandler = function mouseUpHandler() {
  (0, _jquery2.default)(tableElement).off('mousemove');
  (0, _jquery2.default)(tableElement).off('mouseup');
};

(0, _jquery2.default)(tableElement).on('mousedown', mouseDownHandler);

/*
  Close the dropdown menu nav once user's focus is out.
 */
var navDropdowns = document.querySelectorAll('.submenu.is-dropdown-submenu.first-sub');

navDropdowns.forEach(function (dropdown) {
  dropdown.addEventListener('focusout', function (event) {

    // Use setTimeout to delay the check until after the focus has fully moved
    setTimeout(function () {
      var isFocusedOutsideMenu = !dropdown.contains(document.activeElement);

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
var mainNav = document.querySelector('.menu--main');
var hamburgerButton = document.querySelector('.hamburger .menu-button');

function updateMenuInertness() {
  !mainNav.classList.contains('open') && window.innerWidth < 900 ? mainNav.setAttribute('inert', '') : mainNav.removeAttribute('inert');
}

function closeMobileNavOnFocusOut() {
  // Use setTimeout to delay the check until after the focus has fully moved
  window.innerWidth < 900 && setTimeout(function () {
    var isFocusedOutsideMenu = !mainNav.contains(document.activeElement);

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
  var drupalMessagesWrapper = document.querySelector('.drupal-messages-wrapper');

  // If we have messages on the page-wait till focus appears (1s max) and refocus to message.
  drupalMessagesWrapper && setTimeout(function () {
    return drupalMessagesWrapper.focus();
  }, 1000);
});

/*
  Operate the aria-attributes of the navigation correctly.
 */
window.addEventListener('load', function () {
  var firstLvlNavLinks = document.querySelectorAll('.is-dropdown-submenu-parent:not(.is-submenu-item) > a');
  var nestedNavs = document.querySelectorAll('.is-dropdown-submenu[role="menubar"]');

  firstLvlNavLinks.forEach(function (nav) {
    return nav.setAttribute('aria-expanded', 'false');
  });
  nestedNavs.forEach(function (nestedNav) {
    return nestedNav.setAttribute('role', 'menu');
  });
});

/***/ }),

/***/ "jquery":
/*!*************************!*\
  !*** external "jQuery" ***!
  \*************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = jQuery;

/***/ })

/******/ });
//# sourceMappingURL=script_overrides.js.map