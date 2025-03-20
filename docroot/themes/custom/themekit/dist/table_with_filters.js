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
/******/ 	return __webpack_require__(__webpack_require__.s = "./js/src/table_with_filters.js");
/******/ })
/************************************************************************/
/******/ ({

/***/ "./js/src/table_with_filters.js":
/*!**************************************!*\
  !*** ./js/src/table_with_filters.js ***!
  \**************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var _jquery = __webpack_require__(/*! jquery */ "jquery");

var _jquery2 = _interopRequireDefault(_jquery);

function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : { default: obj };
}

function _toConsumableArray(arr) {
    if (Array.isArray(arr)) {
        for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) {
            arr2[i] = arr[i];
        }return arr2;
    } else {
        return Array.from(arr);
    }
}

// Append a single filter row instead of two separate rows
(0, _jquery2.default)('.paragraph--type--table-with-filters table thead').append('<tr id="filterRow"></tr>');

var columns = (0, _jquery2.default)(".paragraph--type--table-with-filters thead tr:first th").length;
var filterRow = "";

for (var i = 0; i < columns; i++) {
    if (i === 0) {
        // First column has a search input instead of a dropdown
        filterRow += '<th><input type="text" class="column-search" data-column="' + i + '" placeholder="Search"></th>';
    } else {
        // Other columns have dropdown filters
        filterRow += '<th><select class="column-filter" data-column="' + i + '"></select></th>';
    }
}

(0, _jquery2.default)('#filterRow').html(filterRow);

function populateFilters() {
    (0, _jquery2.default)('.column-filter').each(function () {
        var column = (0, _jquery2.default)(this).data('column');
        var uniqueValues = [].concat(_toConsumableArray(new Set((0, _jquery2.default)('.paragraph--type--table-with-filters tbody tr').map(function () {
            return (0, _jquery2.default)(this).find("td").eq(column).text().trim();
        }).get())));

        var options = '<option value="">All</option>';
        uniqueValues.sort(); // Sort dropdown values alphabetically
        uniqueValues.forEach(function (value) {
            options += '<option value="' + value + '">' + value + '</option>';
        });
        (0, _jquery2.default)(this).html(options);
    });
}

// Function to sort table by column 1 (index 0)
function sortTableByColumn1() {
    var rows = (0, _jquery2.default)('.paragraph--type--table-with-filters tbody tr').get();

    rows.sort(function (a, b) {
        var A = (0, _jquery2.default)(a).find("td").eq(0).text().trim().toLowerCase();
        var B = (0, _jquery2.default)(b).find("td").eq(0).text().trim().toLowerCase();
        return A.localeCompare(B);
    });

    // Append rows in sorted order
    _jquery2.default.each(rows, function (index, row) {
        (0, _jquery2.default)('.paragraph--type--table-with-filters tbody').append(row);
    });
}

// Populate filters and sort table initially
populateFilters();
sortTableByColumn1();

function filterTable() {
    (0, _jquery2.default)('.paragraph--type--table-with-filters tbody tr').each(function () {
        var row = (0, _jquery2.default)(this);
        var showRow = true;

        (0, _jquery2.default)('.column-search').each(function () {
            var column = (0, _jquery2.default)(this).data('column');
            var value = (0, _jquery2.default)(this).val().toLowerCase();
            var cell = row.find("td").eq(column).text().toLowerCase();
            if (value && !(cell.indexOf(value) !== -1)) {
                showRow = false;
            }
        });

        (0, _jquery2.default)('.column-filter').each(function () {
            var column = (0, _jquery2.default)(this).data('column');
            var value = (0, _jquery2.default)(this).val();
            var cell = row.find("td").eq(column).text().trim();
            if (value && cell !== value) {
                showRow = false;
            }
        });

        row.toggle(showRow);
    });
}

// Event listeners
(0, _jquery2.default)('.column-search').on('keyup', filterTable);
(0, _jquery2.default)('.column-filter').on('change', filterTable);

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
//# sourceMappingURL=table_with_filters.js.map