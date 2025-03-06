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
} // Table with Filters JS


(0, _jquery2.default)('.paragraph--type--table-with-filters table thead').append('<tr id="filterRow"></tr><tr id="searchRow"></tr>');

var columns = (0, _jquery2.default)(".paragraph--type--table-with-filters thead tr:first th").length;
var filterRow = "";
var searchRow = "";

for (var i = 0; i < columns; i++) {
    filterRow += '<th><select class="column-filter" data-column="' + i + '"></select></th>';
    searchRow += i === 0 ? '<th><input type="text" class="column-search" data-column="' + i + '" placeholder="Search"></th>' : "<th></th>";
}

(0, _jquery2.default)('#filterRow').html(filterRow);
(0, _jquery2.default)('#searchRow').html(searchRow);

function populateFilters() {
    (0, _jquery2.default)('.column-filter').each(function () {
        var column = (0, _jquery2.default)(this).data('column');
        var uniqueValues = [].concat(_toConsumableArray(new Set((0, _jquery2.default)('.paragraph--type--table-with-filters tbody tr').map(function () {
            return (0, _jquery2.default)(this).find("td").eq(column).text().trim();
        }).get())));

        var options = '<option value="">All</option>';
        uniqueValues.forEach(function (value) {
            options += '<option value="' + value + '">' + value + '</option>';
        });
        (0, _jquery2.default)(this).html(options);
    });
}

populateFilters();

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