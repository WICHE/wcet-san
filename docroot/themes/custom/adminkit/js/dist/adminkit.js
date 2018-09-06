/**
 * SVGInjector v1.1.3 - Fast, caching, dynamic inline SVG DOM injection library
 * https://github.com/iconic/SVGInjector
 *
 * Copyright (c) 2014-2015 Waybury <hello@waybury.com>
 * @license MIT
 */

(function (window, document) {

  'use strict';

  // Environment

  var isLocal = window.location.protocol === 'file:';
  var hasSvgSupport = document.implementation.hasFeature('http://www.w3.org/TR/SVG11/feature#BasicStructure', '1.1');

  function uniqueClasses(list) {
    list = list.split(' ');

    var hash = {};
    var i = list.length;
    var out = [];

    while (i--) {
      if (!hash.hasOwnProperty(list[i])) {
        hash[list[i]] = 1;
        out.unshift(list[i]);
      }
    }

    return out.join(' ');
  }

  /**
   * cache (or polyfill for <= IE8) Array.forEach()
   * source: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/forEach
   */
  var forEach = Array.prototype.forEach || function (fn, scope) {
    if (this === void 0 || this === null || typeof fn !== 'function') {
      throw new TypeError();
    }

    /* jshint bitwise: false */
    var i,
        len = this.length >>> 0;
    /* jshint bitwise: true */

    for (i = 0; i < len; ++i) {
      if (i in this) {
        fn.call(scope, this[i], i, this);
      }
    }
  };

  // SVG Cache
  var svgCache = {};

  var injectCount = 0;
  var injectedElements = [];

  // Request Queue
  var requestQueue = [];

  // Script running status
  var ranScripts = {};

  var cloneSvg = function (sourceSvg) {
    return sourceSvg.cloneNode(true);
  };

  var queueRequest = function (url, callback) {
    requestQueue[url] = requestQueue[url] || [];
    requestQueue[url].push(callback);
  };

  var processRequestQueue = function (url) {
    for (var i = 0, len = requestQueue[url].length; i < len; i++) {
      // Make these calls async so we avoid blocking the page/renderer
      /* jshint loopfunc: true */
      (function (index) {
        setTimeout(function () {
          requestQueue[url][index](cloneSvg(svgCache[url]));
        }, 0);
      })(i);
      /* jshint loopfunc: false */
    }
  };

  var loadSvg = function (url, callback) {
    if (svgCache[url] !== undefined) {
      if (svgCache[url] instanceof SVGSVGElement) {
        // We already have it in cache, so use it
        callback(cloneSvg(svgCache[url]));
      } else {
        // We don't have it in cache yet, but we are loading it, so queue this request
        queueRequest(url, callback);
      }
    } else {

      if (!window.XMLHttpRequest) {
        callback('Browser does not support XMLHttpRequest');
        return false;
      }

      // Seed the cache to indicate we are loading this URL already
      svgCache[url] = {};
      queueRequest(url, callback);

      var httpRequest = new XMLHttpRequest();

      httpRequest.onreadystatechange = function () {
        // readyState 4 = complete
        if (httpRequest.readyState === 4) {

          // Handle status
          if (httpRequest.status === 404 || httpRequest.responseXML === null) {
            callback('Unable to load SVG file: ' + url);

            if (isLocal) callback('Note: SVG injection ajax calls do not work locally without adjusting security setting in your browser. Or consider using a local webserver.');

            callback();
            return false;
          }

          // 200 success from server, or 0 when using file:// protocol locally
          if (httpRequest.status === 200 || isLocal && httpRequest.status === 0) {

            /* globals Document */
            if (httpRequest.responseXML instanceof Document) {
              // Cache it
              svgCache[url] = httpRequest.responseXML.documentElement;
            }
            /* globals -Document */

            // IE9 doesn't create a responseXML Document object from loaded SVG,
            // and throws a "DOM Exception: HIERARCHY_REQUEST_ERR (3)" error when injected.
            //
            // So, we'll just create our own manually via the DOMParser using
            // the the raw XML responseText.
            //
            // :NOTE: IE8 and older doesn't have DOMParser, but they can't do SVG either, so...
            else if (DOMParser && DOMParser instanceof Function) {
                var xmlDoc;
                try {
                  var parser = new DOMParser();
                  xmlDoc = parser.parseFromString(httpRequest.responseText, 'text/xml');
                } catch (e) {
                  xmlDoc = undefined;
                }

                if (!xmlDoc || xmlDoc.getElementsByTagName('parsererror').length) {
                  callback('Unable to parse SVG file: ' + url);
                  return false;
                } else {
                  // Cache it
                  svgCache[url] = xmlDoc.documentElement;
                }
              }

            // We've loaded a new asset, so process any requests waiting for it
            processRequestQueue(url);
          } else {
            callback('There was a problem injecting the SVG: ' + httpRequest.status + ' ' + httpRequest.statusText);
            return false;
          }
        }
      };

      httpRequest.open('GET', url);

      // Treat and parse the response as XML, even if the
      // server sends us a different mimetype
      if (httpRequest.overrideMimeType) httpRequest.overrideMimeType('text/xml');

      httpRequest.send();
    }
  };

  // Inject a single element
  var injectElement = function (el, evalScripts, pngFallback, callback) {

    // Grab the src or data-src attribute
    var imgUrl = el.getAttribute('data-src') || el.getAttribute('src');

    // We can only inject SVG
    if (!/\.svg/i.test(imgUrl)) {
      callback('Attempted to inject a file with a non-svg extension: ' + imgUrl);
      return;
    }

    // If we don't have SVG support try to fall back to a png,
    // either defined per-element via data-fallback or data-png,
    // or globally via the pngFallback directory setting
    if (!hasSvgSupport) {
      var perElementFallback = el.getAttribute('data-fallback') || el.getAttribute('data-png');

      // Per-element specific PNG fallback defined, so use that
      if (perElementFallback) {
        el.setAttribute('src', perElementFallback);
        callback(null);
      }
      // Global PNG fallback directoriy defined, use the same-named PNG
      else if (pngFallback) {
          el.setAttribute('src', pngFallback + '/' + imgUrl.split('/').pop().replace('.svg', '.png'));
          callback(null);
        }
        // um...
        else {
            callback('This browser does not support SVG and no PNG fallback was defined.');
          }

      return;
    }

    // Make sure we aren't already in the process of injecting this element to
    // avoid a race condition if multiple injections for the same element are run.
    // :NOTE: Using indexOf() only _after_ we check for SVG support and bail,
    // so no need for IE8 indexOf() polyfill
    if (injectedElements.indexOf(el) !== -1) {
      return;
    }

    // Remember the request to inject this element, in case other injection
    // calls are also trying to replace this element before we finish
    injectedElements.push(el);

    // Try to avoid loading the orginal image src if possible.
    el.setAttribute('src', '');

    // Load it up
    loadSvg(imgUrl, function (svg) {

      if (typeof svg === 'undefined' || typeof svg === 'string') {
        callback(svg);
        return false;
      }

      var imgId = el.getAttribute('id');
      if (imgId) {
        svg.setAttribute('id', imgId);
      }

      var imgTitle = el.getAttribute('title');
      if (imgTitle) {
        svg.setAttribute('title', imgTitle);
      }

      // Concat the SVG classes + 'injected-svg' + the img classes
      var classMerge = [].concat(svg.getAttribute('class') || [], 'injected-svg', el.getAttribute('class') || []).join(' ');
      svg.setAttribute('class', uniqueClasses(classMerge));

      var imgStyle = el.getAttribute('style');
      if (imgStyle) {
        svg.setAttribute('style', imgStyle);
      }

      // Copy all the data elements to the svg
      var imgData = [].filter.call(el.attributes, function (at) {
        return (/^data-\w[\w\-]*$/.test(at.name)
        );
      });
      forEach.call(imgData, function (dataAttr) {
        if (dataAttr.name && dataAttr.value) {
          svg.setAttribute(dataAttr.name, dataAttr.value);
        }
      });

      // Make sure any internally referenced clipPath ids and their
      // clip-path references are unique.
      //
      // This addresses the issue of having multiple instances of the
      // same SVG on a page and only the first clipPath id is referenced.
      //
      // Browsers often shortcut the SVG Spec and don't use clipPaths
      // contained in parent elements that are hidden, so if you hide the first
      // SVG instance on the page, then all other instances lose their clipping.
      // Reference: https://bugzilla.mozilla.org/show_bug.cgi?id=376027

      // Handle all defs elements that have iri capable attributes as defined by w3c: http://www.w3.org/TR/SVG/linking.html#processingIRI
      // Mapping IRI addressable elements to the properties that can reference them:
      var iriElementsAndProperties = {
        'clipPath': ['clip-path'],
        'color-profile': ['color-profile'],
        'cursor': ['cursor'],
        'filter': ['filter'],
        'linearGradient': ['fill', 'stroke'],
        'marker': ['marker', 'marker-start', 'marker-mid', 'marker-end'],
        'mask': ['mask'],
        'pattern': ['fill', 'stroke'],
        'radialGradient': ['fill', 'stroke']
      };

      var element, elementDefs, properties, currentId, newId;
      Object.keys(iriElementsAndProperties).forEach(function (key) {
        element = key;
        properties = iriElementsAndProperties[key];

        elementDefs = svg.querySelectorAll('defs ' + element + '[id]');
        for (var i = 0, elementsLen = elementDefs.length; i < elementsLen; i++) {
          currentId = elementDefs[i].id;
          newId = currentId + '-' + injectCount;

          // All of the properties that can reference this element type
          var referencingElements;
          forEach.call(properties, function (property) {
            // :NOTE: using a substring match attr selector here to deal with IE "adding extra quotes in url() attrs"
            referencingElements = svg.querySelectorAll('[' + property + '*="' + currentId + '"]');
            for (var j = 0, referencingElementLen = referencingElements.length; j < referencingElementLen; j++) {
              referencingElements[j].setAttribute(property, 'url(#' + newId + ')');
            }
          });

          elementDefs[i].id = newId;
        }
      });

      // Remove any unwanted/invalid namespaces that might have been added by SVG editing tools
      svg.removeAttribute('xmlns:a');

      // Post page load injected SVGs don't automatically have their script
      // elements run, so we'll need to make that happen, if requested

      // Find then prune the scripts
      var scripts = svg.querySelectorAll('script');
      var scriptsToEval = [];
      var script, scriptType;

      for (var k = 0, scriptsLen = scripts.length; k < scriptsLen; k++) {
        scriptType = scripts[k].getAttribute('type');

        // Only process javascript types.
        // SVG defaults to 'application/ecmascript' for unset types
        if (!scriptType || scriptType === 'application/ecmascript' || scriptType === 'application/javascript') {

          // innerText for IE, textContent for other browsers
          script = scripts[k].innerText || scripts[k].textContent;

          // Stash
          scriptsToEval.push(script);

          // Tidy up and remove the script element since we don't need it anymore
          svg.removeChild(scripts[k]);
        }
      }

      // Run/Eval the scripts if needed
      if (scriptsToEval.length > 0 && (evalScripts === 'always' || evalScripts === 'once' && !ranScripts[imgUrl])) {
        for (var l = 0, scriptsToEvalLen = scriptsToEval.length; l < scriptsToEvalLen; l++) {

          // :NOTE: Yup, this is a form of eval, but it is being used to eval code
          // the caller has explictely asked to be loaded, and the code is in a caller
          // defined SVG file... not raw user input.
          //
          // Also, the code is evaluated in a closure and not in the global scope.
          // If you need to put something in global scope, use 'window'
          new Function(scriptsToEval[l])(window); // jshint ignore:line
        }

        // Remember we already ran scripts for this svg
        ranScripts[imgUrl] = true;
      }

      // :WORKAROUND:
      // IE doesn't evaluate <style> tags in SVGs that are dynamically added to the page.
      // This trick will trigger IE to read and use any existing SVG <style> tags.
      //
      // Reference: https://github.com/iconic/SVGInjector/issues/23
      var styleTags = svg.querySelectorAll('style');
      forEach.call(styleTags, function (styleTag) {
        styleTag.textContent += '';
      });

      // Replace the image with the svg
      el.parentNode.replaceChild(svg, el);

      // Now that we no longer need it, drop references
      // to the original element so it can be GC'd
      delete injectedElements[injectedElements.indexOf(el)];
      el = null;

      // Increment the injected count
      injectCount++;

      callback(svg);
    });
  };

  /**
   * SVGInjector
   *
   * Replace the given elements with their full inline SVG DOM elements.
   *
   * :NOTE: We are using get/setAttribute with SVG because the SVG DOM spec differs from HTML DOM and
   * can return other unexpected object types when trying to directly access svg properties.
   * ex: "className" returns a SVGAnimatedString with the class value found in the "baseVal" property,
   * instead of simple string like with HTML Elements.
   *
   * @param {mixes} Array of or single DOM element
   * @param {object} options
   * @param {function} callback
   * @return {object} Instance of SVGInjector
   */
  var SVGInjector = function (elements, options, done) {

    // Options & defaults
    options = options || {};

    // Should we run the scripts blocks found in the SVG
    // 'always' - Run them every time
    // 'once' - Only run scripts once for each SVG
    // [false|'never'] - Ignore scripts
    var evalScripts = options.evalScripts || 'always';

    // Location of fallback pngs, if desired
    var pngFallback = options.pngFallback || false;

    // Callback to run during each SVG injection, returning the SVG injected
    var eachCallback = options.each;

    // Do the injection...
    if (elements.length !== undefined) {
      var elementsLoaded = 0;
      forEach.call(elements, function (element) {
        injectElement(element, evalScripts, pngFallback, function (svg) {
          if (eachCallback && typeof eachCallback === 'function') eachCallback(svg);
          if (done && elements.length === ++elementsLoaded) done(elementsLoaded);
        });
      });
    } else {
      if (elements) {
        injectElement(elements, evalScripts, pngFallback, function (svg) {
          if (eachCallback && typeof eachCallback === 'function') eachCallback(svg);
          if (done) done(1);
          elements = null;
        });
      } else {
        if (done) done(0);
      }
    }
  };

  /* global module, exports: true, define */
  // Node.js or CommonJS
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = exports = SVGInjector;
  }
  // AMD support
  else if (typeof define === 'function' && define.amd) {
      define(function () {
        return SVGInjector;
      });
    }
    // Otherwise, attach to window as global
    else if (typeof window === 'object') {
        window.SVGInjector = SVGInjector;
      }
  /* global -module, -exports, -define */
})(window, document);
var autoScroll = function () {
    'use strict';

    function getDef(f, d) {
        if (typeof f === 'undefined') {
            return typeof d === 'undefined' ? f : d;
        }

        return f;
    }
    function boolean(func, def) {

        func = getDef(func, def);

        if (typeof func === 'function') {
            return function f() {
                var arguments$1 = arguments;

                for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
                    args[_key] = arguments$1[_key];
                }

                return !!func.apply(this, args);
            };
        }

        return !!func ? function () {
            return true;
        } : function () {
            return false;
        };
    }

    var prefix = ['webkit', 'moz', 'ms', 'o'];

    var requestAnimationFrame = function () {

        for (var i = 0, limit = prefix.length; i < limit && !window.requestAnimationFrame; ++i) {
            window.requestAnimationFrame = window[prefix[i] + 'RequestAnimationFrame'];
        }

        if (!window.requestAnimationFrame) {
            (function () {
                var lastTime = 0;

                window.requestAnimationFrame = function (callback) {
                    var now = new Date().getTime();
                    var ttc = Math.max(0, 16 - now - lastTime);
                    var timer = window.setTimeout(function () {
                        return callback(now + ttc);
                    }, ttc);

                    lastTime = now + ttc;

                    return timer;
                };
            })();
        }

        return window.requestAnimationFrame.bind(window);
    }();

    var cancelAnimationFrame = function () {

        for (var i = 0, limit = prefix.length; i < limit && !window.cancelAnimationFrame; ++i) {
            window.cancelAnimationFrame = window[prefix[i] + 'CancelAnimationFrame'] || window[prefix[i] + 'CancelRequestAnimationFrame'];
        }

        if (!window.cancelAnimationFrame) {
            window.cancelAnimationFrame = function (timer) {
                window.clearTimeout(timer);
            };
        }

        return window.cancelAnimationFrame.bind(window);
    }();

    var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
        return typeof obj;
    } : function (obj) {
        return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj;
    };

    /**
     * Returns `true` if provided input is Element.
     * @name isElement
     * @param {*} [input]
     * @returns {boolean}
     */
    var isElement = function (input) {
        return input != null && (typeof input === 'undefined' ? 'undefined' : _typeof(input)) === 'object' && input.nodeType === 1 && _typeof(input.style) === 'object' && _typeof(input.ownerDocument) === 'object';
    };

    // Production steps of ECMA-262, Edition 6, 22.1.2.1
    // Reference: http://www.ecma-international.org/ecma-262/6.0/#sec-array.from

    /**
     * isArray
     */

    function indexOfElement(elements, element) {
        element = resolveElement(element, true);
        if (!isElement(element)) {
            return -1;
        }
        for (var i = 0; i < elements.length; i++) {
            if (elements[i] === element) {
                return i;
            }
        }
        return -1;
    }

    function hasElement(elements, element) {
        return -1 !== indexOfElement(elements, element);
    }

    function pushElements(elements, toAdd) {

        for (var i = 0; i < toAdd.length; i++) {
            if (!hasElement(elements, toAdd[i])) {
                elements.push(toAdd[i]);
            }
        }

        return toAdd;
    }

    function addElements(elements) {
        var arguments$1 = arguments;

        for (var _len2 = arguments.length, toAdd = Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
            toAdd[_key2 - 1] = arguments$1[_key2];
        }

        toAdd = toAdd.map(resolveElement);
        return pushElements(elements, toAdd);
    }

    function removeElements(elements) {
        var arguments$1 = arguments;

        for (var _len3 = arguments.length, toRemove = Array(_len3 > 1 ? _len3 - 1 : 0), _key3 = 1; _key3 < _len3; _key3++) {
            toRemove[_key3 - 1] = arguments$1[_key3];
        }

        return toRemove.map(resolveElement).reduce(function (last, e) {

            var index$$1 = indexOfElement(elements, e);

            if (index$$1 !== -1) {
                return last.concat(elements.splice(index$$1, 1));
            }
            return last;
        }, []);
    }

    function resolveElement(element, noThrow) {
        if (typeof element === 'string') {
            try {
                return document.querySelector(element);
            } catch (e) {
                throw e;
            }
        }

        if (!isElement(element) && !noThrow) {
            throw new TypeError(element + ' is not a DOM element.');
        }
        return element;
    }

    var index$2 = function createPointCB(object, options) {

        // A persistent object (as opposed to returned object) is used to save memory
        // This is good to prevent layout thrashing, or for games, and such

        // NOTE
        // This uses IE fixes which should be OK to remove some day. :)
        // Some speed will be gained by removal of these.

        // pointCB should be saved in a variable on return
        // This allows the usage of element.removeEventListener

        options = options || {};

        var allowUpdate;

        if (typeof options.allowUpdate === 'function') {
            allowUpdate = options.allowUpdate;
        } else {
            allowUpdate = function () {
                return true;
            };
        }

        return function pointCB(event) {

            event = event || window.event; // IE-ism
            object.target = event.target || event.srcElement || event.originalTarget;
            object.element = this;
            object.type = event.type;

            if (!allowUpdate(event)) {
                return;
            }

            // Support touch
            // http://www.creativebloq.com/javascript/make-your-site-work-touch-devices-51411644

            if (event.targetTouches) {
                object.x = event.targetTouches[0].clientX;
                object.y = event.targetTouches[0].clientY;
                object.pageX = event.pageX;
                object.pageY = event.pageY;
            } else {

                // If pageX/Y aren't available and clientX/Y are,
                // calculate pageX/Y - logic taken from jQuery.
                // (This is to support old IE)
                // NOTE Hopefully this can be removed soon.

                if (event.pageX === null && event.clientX !== null) {
                    var eventDoc = event.target && event.target.ownerDocument || document;
                    var doc = eventDoc.documentElement;
                    var body = eventDoc.body;

                    object.pageX = event.clientX + (doc && doc.scrollLeft || body && body.scrollLeft || 0) - (doc && doc.clientLeft || body && body.clientLeft || 0);
                    object.pageY = event.clientY + (doc && doc.scrollTop || body && body.scrollTop || 0) - (doc && doc.clientTop || body && body.clientTop || 0);
                } else {
                    object.pageX = event.pageX;
                    object.pageY = event.pageY;
                }

                // pageX, and pageY change with page scroll
                // so we're not going to use those for x, and y.
                // NOTE Most browsers also alias clientX/Y with x/y
                // so that's something to consider down the road.

                object.x = event.clientX;
                object.y = event.clientY;
            }
        };

        //NOTE Remember accessibility, Aria roles, and labels.
    };

    function createWindowRect() {
        var props = {
            top: { value: 0, enumerable: true },
            left: { value: 0, enumerable: true },
            right: { value: window.innerWidth, enumerable: true },
            bottom: { value: window.innerHeight, enumerable: true },
            width: { value: window.innerWidth, enumerable: true },
            height: { value: window.innerHeight, enumerable: true },
            x: { value: 0, enumerable: true },
            y: { value: 0, enumerable: true }
        };

        if (Object.create) {
            return Object.create({}, props);
        } else {
            var rect = {};
            Object.defineProperties(rect, props);
            return rect;
        }
    }

    function getClientRect(el) {
        if (el === window) {
            return createWindowRect();
        } else {
            try {
                var rect = el.getBoundingClientRect();
                if (rect.x === undefined) {
                    rect.x = rect.left;
                    rect.y = rect.top;
                }
                return rect;
            } catch (e) {
                throw new TypeError("Can't call getBoundingClientRect on " + el);
            }
        }
    }

    function pointInside(point, el) {
        var rect = getClientRect(el);
        return point.y > rect.top && point.y < rect.bottom && point.x > rect.left && point.x < rect.right;
    }

    var objectCreate = void 0;
    if (typeof Object.create != 'function') {
        objectCreate = function (undefined) {
            var Temp = function Temp() {};
            return function (prototype, propertiesObject) {
                if (prototype !== Object(prototype) && prototype !== null) {
                    throw TypeError('Argument must be an object, or null');
                }
                Temp.prototype = prototype || {};
                var result = new Temp();
                Temp.prototype = null;
                if (propertiesObject !== undefined) {
                    Object.defineProperties(result, propertiesObject);
                }

                // to imitate the case of Object.create(null)
                if (prototype === null) {
                    result.__proto__ = null;
                }
                return result;
            };
        }();
    } else {
        objectCreate = Object.create;
    }

    var objectCreate$1 = objectCreate;

    var mouseEventProps = ['altKey', 'button', 'buttons', 'clientX', 'clientY', 'ctrlKey', 'metaKey', 'movementX', 'movementY', 'offsetX', 'offsetY', 'pageX', 'pageY', 'region', 'relatedTarget', 'screenX', 'screenY', 'shiftKey', 'which', 'x', 'y'];

    function createDispatcher(element) {

        var defaultSettings = {
            screenX: 0,
            screenY: 0,
            clientX: 0,
            clientY: 0,
            ctrlKey: false,
            shiftKey: false,
            altKey: false,
            metaKey: false,
            button: 0,
            buttons: 1,
            relatedTarget: null,
            region: null
        };

        if (element !== undefined) {
            element.addEventListener('mousemove', onMove);
        }

        function onMove(e) {
            for (var i = 0; i < mouseEventProps.length; i++) {
                defaultSettings[mouseEventProps[i]] = e[mouseEventProps[i]];
            }
        }

        var dispatch = function () {
            if (MouseEvent) {
                return function m1(element, initMove, data) {
                    var evt = new MouseEvent('mousemove', createMoveInit(defaultSettings, initMove));

                    //evt.dispatched = 'mousemove';
                    setSpecial(evt, data);

                    return element.dispatchEvent(evt);
                };
            } else if (typeof document.createEvent === 'function') {
                return function m2(element, initMove, data) {
                    var settings = createMoveInit(defaultSettings, initMove);
                    var evt = document.createEvent('MouseEvents');

                    evt.initMouseEvent("mousemove", true, //can bubble
                    true, //cancelable
                    window, //view
                    0, //detail
                    settings.screenX, //0, //screenX
                    settings.screenY, //0, //screenY
                    settings.clientX, //80, //clientX
                    settings.clientY, //20, //clientY
                    settings.ctrlKey, //false, //ctrlKey
                    settings.altKey, //false, //altKey
                    settings.shiftKey, //false, //shiftKey
                    settings.metaKey, //false, //metaKey
                    settings.button, //0, //button
                    settings.relatedTarget //null //relatedTarget
                    );

                    //evt.dispatched = 'mousemove';
                    setSpecial(evt, data);

                    return element.dispatchEvent(evt);
                };
            } else if (typeof document.createEventObject === 'function') {
                return function m3(element, initMove, data) {
                    var evt = document.createEventObject();
                    var settings = createMoveInit(defaultSettings, initMove);
                    for (var name in settings) {
                        evt[name] = settings[name];
                    }

                    //evt.dispatched = 'mousemove';
                    setSpecial(evt, data);

                    return element.dispatchEvent(evt);
                };
            }
        }();

        function destroy() {
            if (element) {
                element.removeEventListener('mousemove', onMove, false);
            }
            defaultSettings = null;
        }

        return {
            destroy: destroy,
            dispatch: dispatch
        };
    }

    function createMoveInit(defaultSettings, initMove) {
        initMove = initMove || {};
        var settings = objectCreate$1(defaultSettings);
        for (var i = 0; i < mouseEventProps.length; i++) {
            if (initMove[mouseEventProps[i]] !== undefined) {
                settings[mouseEventProps[i]] = initMove[mouseEventProps[i]];
            }
        }

        return settings;
    }

    function setSpecial(e, data) {
        console.log('data ', data);
        e.data = data || {};
        e.dispatched = 'mousemove';
    }

    function AutoScroller(elements, options) {
        if (options === void 0) options = {};

        var self = this;
        var maxSpeed = 4,
            scrolling = false;

        this.margin = options.margin || -1;
        //this.scrolling = false;
        this.scrollWhenOutside = options.scrollWhenOutside || false;

        var point = {},
            pointCB = index$2(point),
            dispatcher = createDispatcher(),
            down = false;

        window.addEventListener('mousemove', pointCB, false);
        window.addEventListener('touchmove', pointCB, false);

        if (!isNaN(options.maxSpeed)) {
            maxSpeed = options.maxSpeed;
        }

        this.autoScroll = boolean(options.autoScroll);
        this.syncMove = boolean(options.syncMove, false);

        this.destroy = function () {
            window.removeEventListener('mousemove', pointCB, false);
            window.removeEventListener('touchmove', pointCB, false);
            window.removeEventListener('mousedown', onDown, false);
            window.removeEventListener('touchstart', onDown, false);
            window.removeEventListener('mouseup', onUp, false);
            window.removeEventListener('touchend', onUp, false);

            window.removeEventListener('mousemove', onMove, false);
            window.removeEventListener('touchmove', onMove, false);

            window.removeEventListener('scroll', setScroll, true);
            elements = [];
        };

        this.add = function () {
            var element = [],
                len = arguments.length;
            while (len--) element[len] = arguments[len];

            addElements.apply(void 0, [elements].concat(element));
            return this;
        };

        this.remove = function () {
            var element = [],
                len = arguments.length;
            while (len--) element[len] = arguments[len];

            return removeElements.apply(void 0, [elements].concat(element));
        };

        var hasWindow = null,
            windowAnimationFrame;

        if (Object.prototype.toString.call(elements) !== '[object Array]') {
            elements = [elements];
        }

        (function (temp) {
            elements = [];
            temp.forEach(function (element) {
                if (element === window) {
                    hasWindow = window;
                } else {
                    self.add(element);
                }
            });
        })(elements);

        Object.defineProperties(this, {
            down: {
                get: function () {
                    return down;
                }
            },
            maxSpeed: {
                get: function () {
                    return maxSpeed;
                }
            },
            point: {
                get: function () {
                    return point;
                }
            },
            scrolling: {
                get: function () {
                    return scrolling;
                }
            }
        });

        var n = 0,
            current = null,
            animationFrame;

        window.addEventListener('mousedown', onDown, false);
        window.addEventListener('touchstart', onDown, false);
        window.addEventListener('mouseup', onUp, false);
        window.addEventListener('touchend', onUp, false);

        window.addEventListener('mousemove', onMove, false);
        window.addEventListener('touchmove', onMove, false);

        window.addEventListener('mouseleave', onMouseOut, false);

        window.addEventListener('scroll', setScroll, true);

        function setScroll(e) {

            for (var i = 0; i < elements.length; i++) {
                if (elements[i] === e.target) {
                    scrolling = true;
                    break;
                }
            }

            if (scrolling) {
                requestAnimationFrame(function () {
                    return scrolling = false;
                });
            }
        }

        function onDown() {
            down = true;
        }

        function onUp() {
            down = false;
            cancelAnimationFrame(animationFrame);
            cancelAnimationFrame(windowAnimationFrame);
        }

        function onMouseOut() {
            down = false;
        }

        function getTarget(target) {
            if (!target) {
                return null;
            }

            if (current === target) {
                return target;
            }

            if (hasElement(elements, target)) {
                return target;
            }

            while (target = target.parentNode) {
                if (hasElement(elements, target)) {
                    return target;
                }
            }

            return null;
        }

        function getElementUnderPoint() {
            var underPoint = null;

            for (var i = 0; i < elements.length; i++) {
                if (inside(point, elements[i])) {
                    underPoint = elements[i];
                }
            }

            return underPoint;
        }

        function onMove(event) {

            if (!self.autoScroll()) {
                return;
            }

            if (event['dispatched']) {
                return;
            }

            var target = event.target,
                body = document.body;

            if (current && !inside(point, current)) {
                if (!self.scrollWhenOutside) {
                    current = null;
                }
            }

            if (target && target.parentNode === body) {
                //The special condition to improve speed.
                target = getElementUnderPoint();
            } else {
                target = getTarget(target);

                if (!target) {
                    target = getElementUnderPoint();
                }
            }

            if (target && target !== current) {
                current = target;
            }

            if (hasWindow) {
                cancelAnimationFrame(windowAnimationFrame);
                windowAnimationFrame = requestAnimationFrame(scrollWindow);
            }

            if (!current) {
                return;
            }

            cancelAnimationFrame(animationFrame);
            animationFrame = requestAnimationFrame(scrollTick);
        }

        function scrollWindow() {
            autoScroll(hasWindow);

            cancelAnimationFrame(windowAnimationFrame);
            windowAnimationFrame = requestAnimationFrame(scrollWindow);
        }

        function scrollTick() {

            if (!current) {
                return;
            }

            autoScroll(current);

            cancelAnimationFrame(animationFrame);
            animationFrame = requestAnimationFrame(scrollTick);
        }

        function autoScroll(el) {
            var rect = getClientRect(el),
                scrollx,
                scrolly;

            if (point.x < rect.left + self.margin) {
                scrollx = Math.floor(Math.max(-1, (point.x - rect.left) / self.margin - 1) * self.maxSpeed);
            } else if (point.x > rect.right - self.margin) {
                scrollx = Math.ceil(Math.min(1, (point.x - rect.right) / self.margin + 1) * self.maxSpeed);
            } else {
                scrollx = 0;
            }

            if (point.y < rect.top + self.margin) {
                scrolly = Math.floor(Math.max(-1, (point.y - rect.top) / self.margin - 1) * self.maxSpeed);
            } else if (point.y > rect.bottom - self.margin) {
                scrolly = Math.ceil(Math.min(1, (point.y - rect.bottom) / self.margin + 1) * self.maxSpeed);
            } else {
                scrolly = 0;
            }

            if (self.syncMove()) {
                /*
                Notes about mousemove event dispatch.
                screen(X/Y) should need to be updated.
                Some other properties might need to be set.
                Keep the syncMove option default false until all inconsistencies are taken care of.
                */
                dispatcher.dispatch(el, {
                    pageX: point.pageX + scrollx,
                    pageY: point.pageY + scrolly,
                    clientX: point.x + scrollx,
                    clientY: point.y + scrolly
                });
            }

            setTimeout(function () {

                if (scrolly) {
                    scrollY(el, scrolly);
                }

                if (scrollx) {
                    scrollX(el, scrollx);
                }
            });
        }

        function scrollY(el, amount) {
            if (el === window) {
                window.scrollTo(el.pageXOffset, el.pageYOffset + amount);
            } else {
                el.scrollTop += amount;
            }
        }

        function scrollX(el, amount) {
            if (el === window) {
                window.scrollTo(el.pageXOffset + amount, el.pageYOffset);
            } else {
                el.scrollLeft += amount;
            }
        }
    }

    function AutoScrollerFactory(element, options) {
        return new AutoScroller(element, options);
    }

    function inside(point, el, rect) {
        if (!rect) {
            return pointInside(point, el);
        } else {
            return point.y > rect.top && point.y < rect.bottom && point.x > rect.left && point.x < rect.right;
        }
    }

    /*
    git remote add origin https://github.com/hollowdoor/dom_autoscroller.git
    git push -u origin master
    */

    return AutoScrollerFactory;
}();
//# sourceMappingURL=dom-autoscroller.js.map
(function (f) {
  if (typeof exports === "object" && typeof module !== "undefined") {
    module.exports = f();
  } else if (typeof define === "function" && define.amd) {
    define([], f);
  } else {
    var g;if (typeof window !== "undefined") {
      g = window;
    } else if (typeof global !== "undefined") {
      g = global;
    } else if (typeof self !== "undefined") {
      g = self;
    } else {
      g = this;
    }g.dragula = f();
  }
})(function () {
  var define, module, exports;return function e(t, n, r) {
    function s(o, u) {
      if (!n[o]) {
        if (!t[o]) {
          var a = typeof require == "function" && require;if (!u && a) return a(o, !0);if (i) return i(o, !0);var f = new Error("Cannot find module '" + o + "'");throw f.code = "MODULE_NOT_FOUND", f;
        }var l = n[o] = { exports: {} };t[o][0].call(l.exports, function (e) {
          var n = t[o][1][e];return s(n ? n : e);
        }, l, l.exports, e, t, n, r);
      }return n[o].exports;
    }var i = typeof require == "function" && require;for (var o = 0; o < r.length; o++) s(r[o]);return s;
  }({ 1: [function (require, module, exports) {
      'use strict';

      var cache = {};
      var start = '(?:^|\\s)';
      var end = '(?:\\s|$)';

      function lookupClass(className) {
        var cached = cache[className];
        if (cached) {
          cached.lastIndex = 0;
        } else {
          cache[className] = cached = new RegExp(start + className + end, 'g');
        }
        return cached;
      }

      function addClass(el, className) {
        var current = el.className;
        if (!current.length) {
          el.className = className;
        } else if (!lookupClass(className).test(current)) {
          el.className += ' ' + className;
        }
      }

      function rmClass(el, className) {
        el.className = el.className.replace(lookupClass(className), ' ').trim();
      }

      module.exports = {
        add: addClass,
        rm: rmClass
      };
    }, {}], 2: [function (require, module, exports) {
      (function (global) {
        'use strict';

        var emitter = require('contra/emitter');
        var crossvent = require('crossvent');
        var classes = require('./classes');
        var doc = document;
        var documentElement = doc.documentElement;

        function dragula(initialContainers, options) {
          var len = arguments.length;
          if (len === 1 && Array.isArray(initialContainers) === false) {
            options = initialContainers;
            initialContainers = [];
          }
          var _mirror; // mirror image
          var _source; // source container
          var _item; // item being dragged
          var _offsetX; // reference x
          var _offsetY; // reference y
          var _moveX; // reference move x
          var _moveY; // reference move y
          var _initialSibling; // reference sibling when grabbed
          var _currentSibling; // reference sibling now
          var _copy; // item used for copying
          var _renderTimer; // timer for setTimeout renderMirrorImage
          var _lastDropTarget = null; // last container item was over
          var _grabbed; // holds mousedown context until first mousemove

          var o = options || {};
          if (o.moves === void 0) {
            o.moves = always;
          }
          if (o.accepts === void 0) {
            o.accepts = always;
          }
          if (o.invalid === void 0) {
            o.invalid = invalidTarget;
          }
          if (o.containers === void 0) {
            o.containers = initialContainers || [];
          }
          if (o.isContainer === void 0) {
            o.isContainer = never;
          }
          if (o.copy === void 0) {
            o.copy = false;
          }
          if (o.copySortSource === void 0) {
            o.copySortSource = false;
          }
          if (o.revertOnSpill === void 0) {
            o.revertOnSpill = false;
          }
          if (o.removeOnSpill === void 0) {
            o.removeOnSpill = false;
          }
          if (o.direction === void 0) {
            o.direction = 'vertical';
          }
          if (o.ignoreInputTextSelection === void 0) {
            o.ignoreInputTextSelection = true;
          }
          if (o.mirrorContainer === void 0) {
            o.mirrorContainer = doc.body;
          }

          var drake = emitter({
            containers: o.containers,
            start: manualStart,
            end: end,
            cancel: cancel,
            remove: remove,
            destroy: destroy,
            canMove: canMove,
            dragging: false
          });

          if (o.removeOnSpill === true) {
            drake.on('over', spillOver).on('out', spillOut);
          }

          events();

          return drake;

          function isContainer(el) {
            return drake.containers.indexOf(el) !== -1 || o.isContainer(el);
          }

          function events(remove) {
            var op = remove ? 'remove' : 'add';
            touchy(documentElement, op, 'mousedown', grab);
            touchy(documentElement, op, 'mouseup', release);
          }

          function eventualMovements(remove) {
            var op = remove ? 'remove' : 'add';
            touchy(documentElement, op, 'mousemove', startBecauseMouseMoved);
          }

          function movements(remove) {
            var op = remove ? 'remove' : 'add';
            crossvent[op](documentElement, 'selectstart', preventGrabbed); // IE8
            crossvent[op](documentElement, 'click', preventGrabbed);
          }

          function destroy() {
            events(true);
            release({});
          }

          function preventGrabbed(e) {
            if (_grabbed) {
              e.preventDefault();
            }
          }

          function grab(e) {
            _moveX = e.clientX;
            _moveY = e.clientY;

            var ignore = whichMouseButton(e) !== 1 || e.metaKey || e.ctrlKey;
            if (ignore) {
              return; // we only care about honest-to-god left clicks and touch events
            }
            var item = e.target;
            var context = canStart(item);
            if (!context) {
              return;
            }
            _grabbed = context;
            eventualMovements();
            if (e.type === 'mousedown') {
              if (isInput(item)) {
                // see also: https://github.com/bevacqua/dragula/issues/208
                item.focus(); // fixes https://github.com/bevacqua/dragula/issues/176
              } else {
                e.preventDefault(); // fixes https://github.com/bevacqua/dragula/issues/155
              }
            }
          }

          function startBecauseMouseMoved(e) {
            if (!_grabbed) {
              return;
            }
            if (whichMouseButton(e) === 0) {
              release({});
              return; // when text is selected on an input and then dragged, mouseup doesn't fire. this is our only hope
            }
            // truthy check fixes #239, equality fixes #207
            if (e.clientX !== void 0 && e.clientX === _moveX && e.clientY !== void 0 && e.clientY === _moveY) {
              return;
            }
            if (o.ignoreInputTextSelection) {
              var clientX = getCoord('clientX', e);
              var clientY = getCoord('clientY', e);
              var elementBehindCursor = doc.elementFromPoint(clientX, clientY);
              if (isInput(elementBehindCursor)) {
                return;
              }
            }

            var grabbed = _grabbed; // call to end() unsets _grabbed
            eventualMovements(true);
            movements();
            end();
            start(grabbed);

            var offset = getOffset(_item);
            _offsetX = getCoord('pageX', e) - offset.left;
            _offsetY = getCoord('pageY', e) - offset.top;

            classes.add(_copy || _item, 'gu-transit');
            renderMirrorImage();
            drag(e);
          }

          function canStart(item) {
            if (drake.dragging && _mirror) {
              return;
            }
            if (isContainer(item)) {
              return; // don't drag container itself
            }
            var handle = item;
            while (getParent(item) && isContainer(getParent(item)) === false) {
              if (o.invalid(item, handle)) {
                return;
              }
              item = getParent(item); // drag target should be a top element
              if (!item) {
                return;
              }
            }
            var source = getParent(item);
            if (!source) {
              return;
            }
            if (o.invalid(item, handle)) {
              return;
            }

            var movable = o.moves(item, source, handle, nextEl(item));
            if (!movable) {
              return;
            }

            return {
              item: item,
              source: source
            };
          }

          function canMove(item) {
            return !!canStart(item);
          }

          function manualStart(item) {
            var context = canStart(item);
            if (context) {
              start(context);
            }
          }

          function start(context) {
            if (isCopy(context.item, context.source)) {
              _copy = context.item.cloneNode(true);
              drake.emit('cloned', _copy, context.item, 'copy');
            }

            _source = context.source;
            _item = context.item;
            _initialSibling = _currentSibling = nextEl(context.item);

            drake.dragging = true;
            drake.emit('drag', _item, _source);
          }

          function invalidTarget() {
            return false;
          }

          function end() {
            if (!drake.dragging) {
              return;
            }
            var item = _copy || _item;
            drop(item, getParent(item));
          }

          function ungrab() {
            _grabbed = false;
            eventualMovements(true);
            movements(true);
          }

          function release(e) {
            ungrab();

            if (!drake.dragging) {
              return;
            }
            var item = _copy || _item;
            var clientX = getCoord('clientX', e);
            var clientY = getCoord('clientY', e);
            var elementBehindCursor = getElementBehindPoint(_mirror, clientX, clientY);
            var dropTarget = findDropTarget(elementBehindCursor, clientX, clientY);
            if (dropTarget && (_copy && o.copySortSource || !_copy || dropTarget !== _source)) {
              drop(item, dropTarget);
            } else if (o.removeOnSpill) {
              remove();
            } else {
              cancel();
            }
          }

          function drop(item, target) {
            var parent = getParent(item);
            if (_copy && o.copySortSource && target === _source) {
              parent.removeChild(_item);
            }
            if (isInitialPlacement(target)) {
              drake.emit('cancel', item, _source, _source);
            } else {
              drake.emit('drop', item, target, _source, _currentSibling);
            }
            cleanup();
          }

          function remove() {
            if (!drake.dragging) {
              return;
            }
            var item = _copy || _item;
            var parent = getParent(item);
            if (parent) {
              parent.removeChild(item);
            }
            drake.emit(_copy ? 'cancel' : 'remove', item, parent, _source);
            cleanup();
          }

          function cancel(revert) {
            if (!drake.dragging) {
              return;
            }
            var reverts = arguments.length > 0 ? revert : o.revertOnSpill;
            var item = _copy || _item;
            var parent = getParent(item);
            var initial = isInitialPlacement(parent);
            if (initial === false && reverts) {
              if (_copy) {
                if (parent) {
                  parent.removeChild(_copy);
                }
              } else {
                _source.insertBefore(item, _initialSibling);
              }
            }
            if (initial || reverts) {
              drake.emit('cancel', item, _source, _source);
            } else {
              drake.emit('drop', item, parent, _source, _currentSibling);
            }
            cleanup();
          }

          function cleanup() {
            var item = _copy || _item;
            ungrab();
            removeMirrorImage();
            if (item) {
              classes.rm(item, 'gu-transit');
            }
            if (_renderTimer) {
              clearTimeout(_renderTimer);
            }
            drake.dragging = false;
            if (_lastDropTarget) {
              drake.emit('out', item, _lastDropTarget, _source);
            }
            drake.emit('dragend', item);
            _source = _item = _copy = _initialSibling = _currentSibling = _renderTimer = _lastDropTarget = null;
          }

          function isInitialPlacement(target, s) {
            var sibling;
            if (s !== void 0) {
              sibling = s;
            } else if (_mirror) {
              sibling = _currentSibling;
            } else {
              sibling = nextEl(_copy || _item);
            }
            return target === _source && sibling === _initialSibling;
          }

          function findDropTarget(elementBehindCursor, clientX, clientY) {
            var target = elementBehindCursor;
            while (target && !accepted()) {
              target = getParent(target);
            }
            return target;

            function accepted() {
              var droppable = isContainer(target);
              if (droppable === false) {
                return false;
              }

              var immediate = getImmediateChild(target, elementBehindCursor);
              var reference = getReference(target, immediate, clientX, clientY);
              var initial = isInitialPlacement(target, reference);
              if (initial) {
                return true; // should always be able to drop it right back where it was
              }
              return o.accepts(_item, target, _source, reference);
            }
          }

          function drag(e) {
            if (!_mirror) {
              return;
            }
            e.preventDefault();

            var clientX = getCoord('clientX', e);
            var clientY = getCoord('clientY', e);
            var x = clientX - _offsetX;
            var y = clientY - _offsetY;

            _mirror.style.left = x + 'px';
            _mirror.style.top = y + 'px';

            var item = _copy || _item;
            var elementBehindCursor = getElementBehindPoint(_mirror, clientX, clientY);
            var dropTarget = findDropTarget(elementBehindCursor, clientX, clientY);
            var changed = dropTarget !== null && dropTarget !== _lastDropTarget;
            if (changed || dropTarget === null) {
              out();
              _lastDropTarget = dropTarget;
              over();
            }
            var parent = getParent(item);
            if (dropTarget === _source && _copy && !o.copySortSource) {
              if (parent) {
                parent.removeChild(item);
              }
              return;
            }
            var reference;
            var immediate = getImmediateChild(dropTarget, elementBehindCursor);
            if (immediate !== null) {
              reference = getReference(dropTarget, immediate, clientX, clientY);
            } else if (o.revertOnSpill === true && !_copy) {
              reference = _initialSibling;
              dropTarget = _source;
            } else {
              if (_copy && parent) {
                parent.removeChild(item);
              }
              return;
            }
            if (reference === null && changed || reference !== item && reference !== nextEl(item)) {
              _currentSibling = reference;
              dropTarget.insertBefore(item, reference);
              drake.emit('shadow', item, dropTarget, _source);
            }
            function moved(type) {
              drake.emit(type, item, _lastDropTarget, _source);
            }
            function over() {
              if (changed) {
                moved('over');
              }
            }
            function out() {
              if (_lastDropTarget) {
                moved('out');
              }
            }
          }

          function spillOver(el) {
            classes.rm(el, 'gu-hide');
          }

          function spillOut(el) {
            if (drake.dragging) {
              classes.add(el, 'gu-hide');
            }
          }

          function renderMirrorImage() {
            if (_mirror) {
              return;
            }
            var rect = _item.getBoundingClientRect();
            _mirror = _item.cloneNode(true);
            _mirror.style.width = getRectWidth(rect) + 'px';
            _mirror.style.height = getRectHeight(rect) + 'px';
            classes.rm(_mirror, 'gu-transit');
            classes.add(_mirror, 'gu-mirror');
            o.mirrorContainer.appendChild(_mirror);
            touchy(documentElement, 'add', 'mousemove', drag);
            classes.add(o.mirrorContainer, 'gu-unselectable');
            drake.emit('cloned', _mirror, _item, 'mirror');
          }

          function removeMirrorImage() {
            if (_mirror) {
              classes.rm(o.mirrorContainer, 'gu-unselectable');
              touchy(documentElement, 'remove', 'mousemove', drag);
              getParent(_mirror).removeChild(_mirror);
              _mirror = null;
            }
          }

          function getImmediateChild(dropTarget, target) {
            var immediate = target;
            while (immediate !== dropTarget && getParent(immediate) !== dropTarget) {
              immediate = getParent(immediate);
            }
            if (immediate === documentElement) {
              return null;
            }
            return immediate;
          }

          function getReference(dropTarget, target, x, y) {
            var horizontal = o.direction === 'horizontal';
            var reference = target !== dropTarget ? inside() : outside();
            return reference;

            function outside() {
              // slower, but able to figure out any position
              var len = dropTarget.children.length;
              var i;
              var el;
              var rect;
              for (i = 0; i < len; i++) {
                el = dropTarget.children[i];
                rect = el.getBoundingClientRect();
                if (horizontal && rect.left + rect.width / 2 > x) {
                  return el;
                }
                if (!horizontal && rect.top + rect.height / 2 > y) {
                  return el;
                }
              }
              return null;
            }

            function inside() {
              // faster, but only available if dropped inside a child element
              var rect = target.getBoundingClientRect();
              if (horizontal) {
                return resolve(x > rect.left + getRectWidth(rect) / 2);
              }
              return resolve(y > rect.top + getRectHeight(rect) / 2);
            }

            function resolve(after) {
              return after ? nextEl(target) : target;
            }
          }

          function isCopy(item, container) {
            return typeof o.copy === 'boolean' ? o.copy : o.copy(item, container);
          }
        }

        function touchy(el, op, type, fn) {
          var touch = {
            mouseup: 'touchend',
            mousedown: 'touchstart',
            mousemove: 'touchmove'
          };
          var pointers = {
            mouseup: 'pointerup',
            mousedown: 'pointerdown',
            mousemove: 'pointermove'
          };
          var microsoft = {
            mouseup: 'MSPointerUp',
            mousedown: 'MSPointerDown',
            mousemove: 'MSPointerMove'
          };
          if (global.navigator.pointerEnabled) {
            crossvent[op](el, pointers[type], fn);
          } else if (global.navigator.msPointerEnabled) {
            crossvent[op](el, microsoft[type], fn);
          } else {
            crossvent[op](el, touch[type], fn);
            crossvent[op](el, type, fn);
          }
        }

        function whichMouseButton(e) {
          if (e.touches !== void 0) {
            return e.touches.length;
          }
          if (e.which !== void 0 && e.which !== 0) {
            return e.which;
          } // see https://github.com/bevacqua/dragula/issues/261
          if (e.buttons !== void 0) {
            return e.buttons;
          }
          var button = e.button;
          if (button !== void 0) {
            // see https://github.com/jquery/jquery/blob/99e8ff1baa7ae341e94bb89c3e84570c7c3ad9ea/src/event.js#L573-L575
            return button & 1 ? 1 : button & 2 ? 3 : button & 4 ? 2 : 0;
          }
        }

        function getOffset(el) {
          var rect = el.getBoundingClientRect();
          return {
            left: rect.left + getScroll('scrollLeft', 'pageXOffset'),
            top: rect.top + getScroll('scrollTop', 'pageYOffset')
          };
        }

        function getScroll(scrollProp, offsetProp) {
          if (typeof global[offsetProp] !== 'undefined') {
            return global[offsetProp];
          }
          if (documentElement.clientHeight) {
            return documentElement[scrollProp];
          }
          return doc.body[scrollProp];
        }

        function getElementBehindPoint(point, x, y) {
          var p = point || {};
          var state = p.className;
          var el;
          p.className += ' gu-hide';
          el = doc.elementFromPoint(x, y);
          p.className = state;
          return el;
        }

        function never() {
          return false;
        }
        function always() {
          return true;
        }
        function getRectWidth(rect) {
          return rect.width || rect.right - rect.left;
        }
        function getRectHeight(rect) {
          return rect.height || rect.bottom - rect.top;
        }
        function getParent(el) {
          return el.parentNode === doc ? null : el.parentNode;
        }
        function isInput(el) {
          return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || isEditable(el);
        }
        function isEditable(el) {
          if (!el) {
            return false;
          } // no parents were editable
          if (el.contentEditable === 'false') {
            return false;
          } // stop the lookup
          if (el.contentEditable === 'true') {
            return true;
          } // found a contentEditable element in the chain
          return isEditable(getParent(el)); // contentEditable is set to 'inherit'
        }

        function nextEl(el) {
          return el.nextElementSibling || manually();
          function manually() {
            var sibling = el;
            do {
              sibling = sibling.nextSibling;
            } while (sibling && sibling.nodeType !== 1);
            return sibling;
          }
        }

        function getEventHost(e) {
          // on touchend event, we have to use `e.changedTouches`
          // see http://stackoverflow.com/questions/7192563/touchend-event-properties
          // see https://github.com/bevacqua/dragula/issues/34
          if (e.targetTouches && e.targetTouches.length) {
            return e.targetTouches[0];
          }
          if (e.changedTouches && e.changedTouches.length) {
            return e.changedTouches[0];
          }
          return e;
        }

        function getCoord(coord, e) {
          var host = getEventHost(e);
          var missMap = {
            pageX: 'clientX', // IE8
            pageY: 'clientY' // IE8
          };
          if (coord in missMap && !(coord in host) && missMap[coord] in host) {
            coord = missMap[coord];
          }
          return host[coord];
        }

        module.exports = dragula;
      }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {});
    }, { "./classes": 1, "contra/emitter": 5, "crossvent": 6 }], 3: [function (require, module, exports) {
      module.exports = function atoa(a, n) {
        return Array.prototype.slice.call(a, n);
      };
    }, {}], 4: [function (require, module, exports) {
      'use strict';

      var ticky = require('ticky');

      module.exports = function debounce(fn, args, ctx) {
        if (!fn) {
          return;
        }
        ticky(function run() {
          fn.apply(ctx || null, args || []);
        });
      };
    }, { "ticky": 9 }], 5: [function (require, module, exports) {
      'use strict';

      var atoa = require('atoa');
      var debounce = require('./debounce');

      module.exports = function emitter(thing, options) {
        var opts = options || {};
        var evt = {};
        if (thing === undefined) {
          thing = {};
        }
        thing.on = function (type, fn) {
          if (!evt[type]) {
            evt[type] = [fn];
          } else {
            evt[type].push(fn);
          }
          return thing;
        };
        thing.once = function (type, fn) {
          fn._once = true; // thing.off(fn) still works!
          thing.on(type, fn);
          return thing;
        };
        thing.off = function (type, fn) {
          var c = arguments.length;
          if (c === 1) {
            delete evt[type];
          } else if (c === 0) {
            evt = {};
          } else {
            var et = evt[type];
            if (!et) {
              return thing;
            }
            et.splice(et.indexOf(fn), 1);
          }
          return thing;
        };
        thing.emit = function () {
          var args = atoa(arguments);
          return thing.emitterSnapshot(args.shift()).apply(this, args);
        };
        thing.emitterSnapshot = function (type) {
          var et = (evt[type] || []).slice(0);
          return function () {
            var args = atoa(arguments);
            var ctx = this || thing;
            if (type === 'error' && opts.throws !== false && !et.length) {
              throw args.length === 1 ? args[0] : args;
            }
            et.forEach(function emitter(listen) {
              if (opts.async) {
                debounce(listen, args, ctx);
              } else {
                listen.apply(ctx, args);
              }
              if (listen._once) {
                thing.off(type, listen);
              }
            });
            return thing;
          };
        };
        return thing;
      };
    }, { "./debounce": 4, "atoa": 3 }], 6: [function (require, module, exports) {
      (function (global) {
        'use strict';

        var customEvent = require('custom-event');
        var eventmap = require('./eventmap');
        var doc = global.document;
        var addEvent = addEventEasy;
        var removeEvent = removeEventEasy;
        var hardCache = [];

        if (!global.addEventListener) {
          addEvent = addEventHard;
          removeEvent = removeEventHard;
        }

        module.exports = {
          add: addEvent,
          remove: removeEvent,
          fabricate: fabricateEvent
        };

        function addEventEasy(el, type, fn, capturing) {
          return el.addEventListener(type, fn, capturing);
        }

        function addEventHard(el, type, fn) {
          return el.attachEvent('on' + type, wrap(el, type, fn));
        }

        function removeEventEasy(el, type, fn, capturing) {
          return el.removeEventListener(type, fn, capturing);
        }

        function removeEventHard(el, type, fn) {
          var listener = unwrap(el, type, fn);
          if (listener) {
            return el.detachEvent('on' + type, listener);
          }
        }

        function fabricateEvent(el, type, model) {
          var e = eventmap.indexOf(type) === -1 ? makeCustomEvent() : makeClassicEvent();
          if (el.dispatchEvent) {
            el.dispatchEvent(e);
          } else {
            el.fireEvent('on' + type, e);
          }
          function makeClassicEvent() {
            var e;
            if (doc.createEvent) {
              e = doc.createEvent('Event');
              e.initEvent(type, true, true);
            } else if (doc.createEventObject) {
              e = doc.createEventObject();
            }
            return e;
          }
          function makeCustomEvent() {
            return new customEvent(type, { detail: model });
          }
        }

        function wrapperFactory(el, type, fn) {
          return function wrapper(originalEvent) {
            var e = originalEvent || global.event;
            e.target = e.target || e.srcElement;
            e.preventDefault = e.preventDefault || function preventDefault() {
              e.returnValue = false;
            };
            e.stopPropagation = e.stopPropagation || function stopPropagation() {
              e.cancelBubble = true;
            };
            e.which = e.which || e.keyCode;
            fn.call(el, e);
          };
        }

        function wrap(el, type, fn) {
          var wrapper = unwrap(el, type, fn) || wrapperFactory(el, type, fn);
          hardCache.push({
            wrapper: wrapper,
            element: el,
            type: type,
            fn: fn
          });
          return wrapper;
        }

        function unwrap(el, type, fn) {
          var i = find(el, type, fn);
          if (i) {
            var wrapper = hardCache[i].wrapper;
            hardCache.splice(i, 1); // free up a tad of memory
            return wrapper;
          }
        }

        function find(el, type, fn) {
          var i, item;
          for (i = 0; i < hardCache.length; i++) {
            item = hardCache[i];
            if (item.element === el && item.type === type && item.fn === fn) {
              return i;
            }
          }
        }
      }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {});
    }, { "./eventmap": 7, "custom-event": 8 }], 7: [function (require, module, exports) {
      (function (global) {
        'use strict';

        var eventmap = [];
        var eventname = '';
        var ron = /^on/;

        for (eventname in global) {
          if (ron.test(eventname)) {
            eventmap.push(eventname.slice(2));
          }
        }

        module.exports = eventmap;
      }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {});
    }, {}], 8: [function (require, module, exports) {
      (function (global) {

        var NativeCustomEvent = global.CustomEvent;

        function useNative() {
          try {
            var p = new NativeCustomEvent('cat', { detail: { foo: 'bar' } });
            return 'cat' === p.type && 'bar' === p.detail.foo;
          } catch (e) {}
          return false;
        }

        /**
         * Cross-browser `CustomEvent` constructor.
         *
         * https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent.CustomEvent
         *
         * @public
         */

        module.exports = useNative() ? NativeCustomEvent :

        // IE >= 9
        'function' === typeof document.createEvent ? function CustomEvent(type, params) {
          var e = document.createEvent('CustomEvent');
          if (params) {
            e.initCustomEvent(type, params.bubbles, params.cancelable, params.detail);
          } else {
            e.initCustomEvent(type, false, false, void 0);
          }
          return e;
        } :

        // IE <= 8
        function CustomEvent(type, params) {
          var e = document.createEventObject();
          e.type = type;
          if (params) {
            e.bubbles = Boolean(params.bubbles);
            e.cancelable = Boolean(params.cancelable);
            e.detail = params.detail;
          } else {
            e.bubbles = false;
            e.cancelable = false;
            e.detail = void 0;
          }
          return e;
        };
      }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {});
    }, {}], 9: [function (require, module, exports) {
      var si = typeof setImmediate === 'function',
          tick;
      if (si) {
        tick = function (fn) {
          setImmediate(fn);
        };
      } else {
        tick = function (fn) {
          setTimeout(fn, 0);
        };
      }

      module.exports = tick;
    }, {}] }, {}, [2])(2);
});
(function ($, Drupal, drupalSettings, CKEDITOR) {

  Drupal.behaviors.draggableItems = {
    attach: function (context, settings) {

      $('.draggable-items-container').each(function (e) {
        if (!$(this).hasClass('dragula-processed')) {
          initDraggableItems($(this));
          $(this).addClass('dragula-processed');
        }
      });
    }
  };

  // Make sure this WAS a wysiwyg initially, not any textarea, maybe selectors or something
  function initCkeditorFromSavedStatus(el, draggedItems) {
    $.each(draggedItems, function (i, value) {
      if ($(el).find('#' + value.id).length && value.config) {
        var newEditor = CKEDITOR.replace(value.id, value.config);
        newEditor.on('instanceReady', function () {
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
    drake.on('drop', function (el, target, source, sibling) {
      adjustOrder(drake);
      initCkeditorFromSavedStatus(el, draggedItems);
    });

    // On cancel we need to recreate the editor from saved config
    drake.on('cancel', function (el, container, source) {
      initCkeditorFromSavedStatus(el, draggedItems);
    });

    // On drag start we need to save the config from the ckeditor instance and destroy it
    drake.on('drag', function (el, source) {
      // On drag start, reset the array to empty so you don't try to initialize the same element multiple times
      draggedItems = [];
      // Get id from textarea
      var $wysiwygs = $(el).find('.cke').siblings('textarea');
      $wysiwygs.each(function (i, el) {
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
          if (draggedItemInstance) {
            draggedItemInstance.destroy(true);
          }
        }
      });
    });

    // Init dom-autoscroller for each drake instance
    var scroll = autoScroll([window], {
      margin: 70,
      maxSpeed: 14,
      autoScroll: function () {
        return this.down && drake.dragging;
      }
    });
  }

  function adjustOrder(dragulaObject) {
    var $draggableItems = $(dragulaObject.containers[0]).children();
    $draggableItems.each(function (i, el) {
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
/**
 * @file entity-browser-improvements.js
 *
 * Adds extra UI improvements to all entity browsers in the admin theme.
 */

!function ($) {
  "use strict";

  Drupal.behaviors.entityBrowserImprover = {
    attach: function (context, settings) {
      // Add .view-entity-browser-BROWSER-NAME to this list for browsers you want to add the click item functionality
      let $browserSelectors = ['.view-entity-browser-image', '.view-entity-browser-video', '.view-entity-browser-svg'];

      let $browserCol = $($browserSelectors.join(', '), context).find('.views-row');

      $browserCol.click(function () {
        const $col = $(this);

        if ($col.hasClass('column-selected')) {
          uncheckColumn($col);
          return;
        }

        $browserCol.each(function () {
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
/**
 * paragraphs-improvements.js
 * Improve the paragraphs admin ui
 */

!function ($) {
  "use strict";

  Drupal.behaviors.paragraphsPreviewerImprover = {
    attach: function (context, settings) {
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
  $(document).ready(function () {
    $('body').on('click', '.paragraph--view-mode--preview', function () {
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
/**
 * @file inject-svg.js
 *
 * Use svg-injector.js to replace an svg <img> tag with the inline svg.
 */

!function ($) {
  "use strict";

  $(function () {
    // Elements to inject
    let mySVGsToInject = document.querySelectorAll('img.inject-me');

    // Do the injection
    SVGInjector(mySVGsToInject);
  });
}(jQuery);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInN2Zy1pbmplY3Rvci5qcyIsImRvbS1hdXRvc2Nyb2xsZXIuanMiLCJub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwiY2xhc3Nlcy5qcyIsImRyYWd1bGEuanMiLCJub2RlX21vZHVsZXMvYXRvYS9hdG9hLmpzIiwibm9kZV9tb2R1bGVzL2NvbnRyYS9kZWJvdW5jZS5qcyIsIm5vZGVfbW9kdWxlcy9jb250cmEvZW1pdHRlci5qcyIsIm5vZGVfbW9kdWxlcy9jcm9zc3ZlbnQvc3JjL2Nyb3NzdmVudC5qcyIsIm5vZGVfbW9kdWxlcy9jcm9zc3ZlbnQvc3JjL2V2ZW50bWFwLmpzIiwibm9kZV9tb2R1bGVzL2N1c3RvbS1ldmVudC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy90aWNreS90aWNreS1icm93c2VyLmpzIiwiZHJhZ2dhYmxlLWl0ZW1zLmpzIiwiZW50aXR5LWJyb3dzZXItaW1wcm92bWVudHMuanMiLCJleHBhbmRhYmxlLXBhcmFncmFwaHMuanMiLCJpbmplY3Qtc3ZnLmpzIl0sIm5hbWVzIjpbIndpbmRvdyIsImRvY3VtZW50IiwiaXNMb2NhbCIsImxvY2F0aW9uIiwicHJvdG9jb2wiLCJoYXNTdmdTdXBwb3J0IiwiaW1wbGVtZW50YXRpb24iLCJoYXNGZWF0dXJlIiwidW5pcXVlQ2xhc3NlcyIsImxpc3QiLCJzcGxpdCIsImhhc2giLCJpIiwibGVuZ3RoIiwib3V0IiwiaGFzT3duUHJvcGVydHkiLCJ1bnNoaWZ0Iiwiam9pbiIsImZvckVhY2giLCJBcnJheSIsInByb3RvdHlwZSIsImZuIiwic2NvcGUiLCJUeXBlRXJyb3IiLCJsZW4iLCJjYWxsIiwic3ZnQ2FjaGUiLCJpbmplY3RDb3VudCIsImluamVjdGVkRWxlbWVudHMiLCJyZXF1ZXN0UXVldWUiLCJyYW5TY3JpcHRzIiwiY2xvbmVTdmciLCJzb3VyY2VTdmciLCJjbG9uZU5vZGUiLCJxdWV1ZVJlcXVlc3QiLCJ1cmwiLCJjYWxsYmFjayIsInB1c2giLCJwcm9jZXNzUmVxdWVzdFF1ZXVlIiwiaW5kZXgiLCJzZXRUaW1lb3V0IiwibG9hZFN2ZyIsInVuZGVmaW5lZCIsIlNWR1NWR0VsZW1lbnQiLCJYTUxIdHRwUmVxdWVzdCIsImh0dHBSZXF1ZXN0Iiwib25yZWFkeXN0YXRlY2hhbmdlIiwicmVhZHlTdGF0ZSIsInN0YXR1cyIsInJlc3BvbnNlWE1MIiwiRG9jdW1lbnQiLCJkb2N1bWVudEVsZW1lbnQiLCJET01QYXJzZXIiLCJGdW5jdGlvbiIsInhtbERvYyIsInBhcnNlciIsInBhcnNlRnJvbVN0cmluZyIsInJlc3BvbnNlVGV4dCIsImUiLCJnZXRFbGVtZW50c0J5VGFnTmFtZSIsInN0YXR1c1RleHQiLCJvcGVuIiwib3ZlcnJpZGVNaW1lVHlwZSIsInNlbmQiLCJpbmplY3RFbGVtZW50IiwiZWwiLCJldmFsU2NyaXB0cyIsInBuZ0ZhbGxiYWNrIiwiaW1nVXJsIiwiZ2V0QXR0cmlidXRlIiwidGVzdCIsInBlckVsZW1lbnRGYWxsYmFjayIsInNldEF0dHJpYnV0ZSIsInBvcCIsInJlcGxhY2UiLCJpbmRleE9mIiwic3ZnIiwiaW1nSWQiLCJpbWdUaXRsZSIsImNsYXNzTWVyZ2UiLCJjb25jYXQiLCJpbWdTdHlsZSIsImltZ0RhdGEiLCJmaWx0ZXIiLCJhdHRyaWJ1dGVzIiwiYXQiLCJuYW1lIiwiZGF0YUF0dHIiLCJ2YWx1ZSIsImlyaUVsZW1lbnRzQW5kUHJvcGVydGllcyIsImVsZW1lbnQiLCJlbGVtZW50RGVmcyIsInByb3BlcnRpZXMiLCJjdXJyZW50SWQiLCJuZXdJZCIsIk9iamVjdCIsImtleXMiLCJrZXkiLCJxdWVyeVNlbGVjdG9yQWxsIiwiZWxlbWVudHNMZW4iLCJpZCIsInJlZmVyZW5jaW5nRWxlbWVudHMiLCJwcm9wZXJ0eSIsImoiLCJyZWZlcmVuY2luZ0VsZW1lbnRMZW4iLCJyZW1vdmVBdHRyaWJ1dGUiLCJzY3JpcHRzIiwic2NyaXB0c1RvRXZhbCIsInNjcmlwdCIsInNjcmlwdFR5cGUiLCJrIiwic2NyaXB0c0xlbiIsImlubmVyVGV4dCIsInRleHRDb250ZW50IiwicmVtb3ZlQ2hpbGQiLCJsIiwic2NyaXB0c1RvRXZhbExlbiIsInN0eWxlVGFncyIsInN0eWxlVGFnIiwicGFyZW50Tm9kZSIsInJlcGxhY2VDaGlsZCIsIlNWR0luamVjdG9yIiwiZWxlbWVudHMiLCJvcHRpb25zIiwiZG9uZSIsImVhY2hDYWxsYmFjayIsImVhY2giLCJlbGVtZW50c0xvYWRlZCIsIm1vZHVsZSIsImV4cG9ydHMiLCJkZWZpbmUiLCJhbWQiLCJhdXRvU2Nyb2xsIiwiZ2V0RGVmIiwiZiIsImQiLCJib29sZWFuIiwiZnVuYyIsImRlZiIsImFyZ3VtZW50cyQxIiwiYXJndW1lbnRzIiwiX2xlbiIsImFyZ3MiLCJfa2V5IiwiYXBwbHkiLCJwcmVmaXgiLCJyZXF1ZXN0QW5pbWF0aW9uRnJhbWUiLCJsaW1pdCIsImxhc3RUaW1lIiwibm93IiwiRGF0ZSIsImdldFRpbWUiLCJ0dGMiLCJNYXRoIiwibWF4IiwidGltZXIiLCJiaW5kIiwiY2FuY2VsQW5pbWF0aW9uRnJhbWUiLCJjbGVhclRpbWVvdXQiLCJfdHlwZW9mIiwiU3ltYm9sIiwiaXRlcmF0b3IiLCJvYmoiLCJjb25zdHJ1Y3RvciIsImlzRWxlbWVudCIsImlucHV0Iiwibm9kZVR5cGUiLCJzdHlsZSIsIm93bmVyRG9jdW1lbnQiLCJpbmRleE9mRWxlbWVudCIsInJlc29sdmVFbGVtZW50IiwiaGFzRWxlbWVudCIsInB1c2hFbGVtZW50cyIsInRvQWRkIiwiYWRkRWxlbWVudHMiLCJfbGVuMiIsIl9rZXkyIiwibWFwIiwicmVtb3ZlRWxlbWVudHMiLCJfbGVuMyIsInRvUmVtb3ZlIiwiX2tleTMiLCJyZWR1Y2UiLCJsYXN0IiwiaW5kZXgkJDEiLCJzcGxpY2UiLCJub1Rocm93IiwicXVlcnlTZWxlY3RvciIsImluZGV4JDIiLCJjcmVhdGVQb2ludENCIiwib2JqZWN0IiwiYWxsb3dVcGRhdGUiLCJwb2ludENCIiwiZXZlbnQiLCJ0YXJnZXQiLCJzcmNFbGVtZW50Iiwib3JpZ2luYWxUYXJnZXQiLCJ0eXBlIiwidGFyZ2V0VG91Y2hlcyIsIngiLCJjbGllbnRYIiwieSIsImNsaWVudFkiLCJwYWdlWCIsInBhZ2VZIiwiZXZlbnREb2MiLCJkb2MiLCJib2R5Iiwic2Nyb2xsTGVmdCIsImNsaWVudExlZnQiLCJzY3JvbGxUb3AiLCJjbGllbnRUb3AiLCJjcmVhdGVXaW5kb3dSZWN0IiwicHJvcHMiLCJ0b3AiLCJlbnVtZXJhYmxlIiwibGVmdCIsInJpZ2h0IiwiaW5uZXJXaWR0aCIsImJvdHRvbSIsImlubmVySGVpZ2h0Iiwid2lkdGgiLCJoZWlnaHQiLCJjcmVhdGUiLCJyZWN0IiwiZGVmaW5lUHJvcGVydGllcyIsImdldENsaWVudFJlY3QiLCJnZXRCb3VuZGluZ0NsaWVudFJlY3QiLCJwb2ludEluc2lkZSIsInBvaW50Iiwib2JqZWN0Q3JlYXRlIiwiVGVtcCIsInByb3BlcnRpZXNPYmplY3QiLCJyZXN1bHQiLCJfX3Byb3RvX18iLCJvYmplY3RDcmVhdGUkMSIsIm1vdXNlRXZlbnRQcm9wcyIsImNyZWF0ZURpc3BhdGNoZXIiLCJkZWZhdWx0U2V0dGluZ3MiLCJzY3JlZW5YIiwic2NyZWVuWSIsImN0cmxLZXkiLCJzaGlmdEtleSIsImFsdEtleSIsIm1ldGFLZXkiLCJidXR0b24iLCJidXR0b25zIiwicmVsYXRlZFRhcmdldCIsInJlZ2lvbiIsImFkZEV2ZW50TGlzdGVuZXIiLCJvbk1vdmUiLCJkaXNwYXRjaCIsIk1vdXNlRXZlbnQiLCJtMSIsImluaXRNb3ZlIiwiZGF0YSIsImV2dCIsImNyZWF0ZU1vdmVJbml0Iiwic2V0U3BlY2lhbCIsImRpc3BhdGNoRXZlbnQiLCJjcmVhdGVFdmVudCIsIm0yIiwic2V0dGluZ3MiLCJpbml0TW91c2VFdmVudCIsImNyZWF0ZUV2ZW50T2JqZWN0IiwibTMiLCJkZXN0cm95IiwicmVtb3ZlRXZlbnRMaXN0ZW5lciIsImNvbnNvbGUiLCJsb2ciLCJkaXNwYXRjaGVkIiwiQXV0b1Njcm9sbGVyIiwic2VsZiIsIm1heFNwZWVkIiwic2Nyb2xsaW5nIiwibWFyZ2luIiwic2Nyb2xsV2hlbk91dHNpZGUiLCJkaXNwYXRjaGVyIiwiZG93biIsImlzTmFOIiwic3luY01vdmUiLCJvbkRvd24iLCJvblVwIiwic2V0U2Nyb2xsIiwiYWRkIiwicmVtb3ZlIiwiaGFzV2luZG93Iiwid2luZG93QW5pbWF0aW9uRnJhbWUiLCJ0b1N0cmluZyIsInRlbXAiLCJnZXQiLCJuIiwiY3VycmVudCIsImFuaW1hdGlvbkZyYW1lIiwib25Nb3VzZU91dCIsImdldFRhcmdldCIsImdldEVsZW1lbnRVbmRlclBvaW50IiwidW5kZXJQb2ludCIsImluc2lkZSIsInNjcm9sbFdpbmRvdyIsInNjcm9sbFRpY2siLCJzY3JvbGx4Iiwic2Nyb2xseSIsImZsb29yIiwiY2VpbCIsIm1pbiIsInNjcm9sbFkiLCJzY3JvbGxYIiwiYW1vdW50Iiwic2Nyb2xsVG8iLCJwYWdlWE9mZnNldCIsInBhZ2VZT2Zmc2V0IiwiQXV0b1Njcm9sbGVyRmFjdG9yeSIsIiQiLCJEcnVwYWwiLCJkcnVwYWxTZXR0aW5ncyIsIkNLRURJVE9SIiwiYmVoYXZpb3JzIiwiZHJhZ2dhYmxlSXRlbXMiLCJhdHRhY2giLCJjb250ZXh0IiwiaGFzQ2xhc3MiLCJpbml0RHJhZ2dhYmxlSXRlbXMiLCJhZGRDbGFzcyIsImluaXRDa2VkaXRvckZyb21TYXZlZFN0YXR1cyIsImRyYWdnZWRJdGVtcyIsImZpbmQiLCJjb25maWciLCJuZXdFZGl0b3IiLCJvbiIsInNldERhdGEiLCJjb250ZW50IiwiJGRyYWdnYWJsZUl0ZW1Db250YWluZXJzIiwiZHJha2UiLCJkcmFndWxhIiwibW92ZXMiLCJjb250YWluZXIiLCJoYW5kbGUiLCJjaGlsZHJlbiIsImFjY2VwdHMiLCJzb3VyY2UiLCJzaWJsaW5nIiwiYWRqdXN0T3JkZXIiLCIkd3lzaXd5Z3MiLCJzaWJsaW5ncyIsImRyYWdnZWRJdGVtSWQiLCJhdHRyIiwiaW5zdGFuY2VzIiwiZHJhZ2dlZEl0ZW1JbnN0YW5jZSIsImRyYWdnZWRJdGVtQ29uZmlnIiwiZHJhZ2dlZEl0ZW1Db250ZW50IiwiZ2V0RGF0YSIsImluc3RhbmNlIiwic2Nyb2xsIiwiZHJhZ2dpbmciLCJkcmFndWxhT2JqZWN0IiwiJGRyYWdnYWJsZUl0ZW1zIiwiY29udGFpbmVycyIsIiR3ZWlnaHRTZWxlY3QiLCIkd2VpZ2h0U2VsZWN0QWpheCIsInZhbCIsImpRdWVyeSIsImVudGl0eUJyb3dzZXJJbXByb3ZlciIsIiRicm93c2VyU2VsZWN0b3JzIiwiJGJyb3dzZXJDb2wiLCJjbGljayIsIiRjb2wiLCJ1bmNoZWNrQ29sdW1uIiwiY2hlY2tDb2x1bW4iLCIkdGFyZ2V0IiwicHJvcCIsInJlbW92ZUNsYXNzIiwicGFyYWdyYXBoc1ByZXZpZXdlckltcHJvdmVyIiwiJHByZXZpZXdlckJ1dHRvbnMiLCIkcHJldmlld2VyQnV0dG9uIiwicmVwbGFjZVBhcmFncmFwaE5hbWUiLCIkcGFyYWdyYXBoc1RvcEVsZW1lbnRzIiwiJHBhcmFncmFwaHNQcmV2aWV3cyIsImZvcm1hdFBhcmFncmFwaHNQcmV2aWV3cyIsInJlYWR5IiwidG9nZ2xlQ2xhc3MiLCJwcmV2aWV3ZXJCdXR0b24iLCJwYXJhZ3JhcGhOYW1lIiwidGV4dCIsInBhcmFncmFwaHNQcmV2aWV3cyIsIiR0aGlzIiwib3V0ZXJIZWlnaHQiLCJteVNWR3NUb0luamVjdCJdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7O0FBUUMsV0FBVUEsTUFBVixFQUFrQkMsUUFBbEIsRUFBNEI7O0FBRTNCOztBQUVBOztBQUNBLE1BQUlDLFVBQVVGLE9BQU9HLFFBQVAsQ0FBZ0JDLFFBQWhCLEtBQTZCLE9BQTNDO0FBQ0EsTUFBSUMsZ0JBQWdCSixTQUFTSyxjQUFULENBQXdCQyxVQUF4QixDQUFtQyxtREFBbkMsRUFBd0YsS0FBeEYsQ0FBcEI7O0FBRUEsV0FBU0MsYUFBVCxDQUF1QkMsSUFBdkIsRUFBNkI7QUFDM0JBLFdBQU9BLEtBQUtDLEtBQUwsQ0FBVyxHQUFYLENBQVA7O0FBRUEsUUFBSUMsT0FBTyxFQUFYO0FBQ0EsUUFBSUMsSUFBSUgsS0FBS0ksTUFBYjtBQUNBLFFBQUlDLE1B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MUIsQ0FBckI7O0FBRUE7QUFDQXVCLGdCQUFZMFEsY0FBWjtBQUNELEdBTkQ7QUFRRCxDQVhBLENBV0MxQixNQVhELENBQUQiLCJmaWxlIjoiYWRtaW5raXQuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFNWR0luamVjdG9yIHYxLjEuMyAtIEZhc3QsIGNhY2hpbmcsIGR5bmFtaWMgaW5saW5lIFNWRyBET00gaW5qZWN0aW9uIGxpYnJhcnlcbiAqIGh0dHBzOi8vZ2l0aHViLmNvbS9pY29uaWMvU1ZHSW5qZWN0b3JcbiAqXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTQtMjAxNSBXYXlidXJ5IDxoZWxsb0B3YXlidXJ5LmNvbT5cbiAqIEBsaWNlbnNlIE1JVFxuICovXG5cbihmdW5jdGlvbiAod2luZG93LCBkb2N1bWVudCkge1xuXG4gICd1c2Ugc3RyaWN0JztcblxuICAvLyBFbnZpcm9ubWVudFxuICB2YXIgaXNMb2NhbCA9IHdpbmRvdy5sb2NhdGlvbi5wcm90b2NvbCA9PT0gJ2ZpbGU6JztcbiAgdmFyIGhhc1N2Z1N1cHBvcnQgPSBkb2N1bWVudC5pbXBsZW1lbnRhdGlvbi5oYXNGZWF0dXJlKCdodHRwOi8vd3d3LnczLm9yZy9UUi9TVkcxMS9mZWF0dXJlI0Jhc2ljU3RydWN0dXJlJywgJzEuMScpO1xuXG4gIGZ1bmN0aW9uIHVuaXF1ZUNsYXNzZXMobGlzdCkge1xuICAgIGxpc3QgPSBsaXN0LnNwbGl0KCcgJyk7XG5cbiAgICB2YXIgaGFzaCA9IHt9O1xuICAgIHZhciBpID0gbGlzdC5sZW5ndGg7XG4gICAgdmFyIG91dCA9IFtdO1xuXG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgaWYgKCFoYXNoLmhhc093blByb3BlcnR5KGxpc3RbaV0pKSB7XG4gICAgICAgIGhhc2hbbGlzdFtpXV0gPSAxO1xuICAgICAgICBvdXQudW5zaGlmdChsaXN0W2ldKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gb3V0LmpvaW4oJyAnKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBjYWNoZSAob3IgcG9seWZpbGwgZm9yIDw9IElFOCkgQXJyYXkuZm9yRWFjaCgpXG4gICAqIHNvdXJjZTogaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvSmF2YVNjcmlwdC9SZWZlcmVuY2UvR2xvYmFsX09iamVjdHMvQXJyYXkvZm9yRWFjaFxuICAgKi9cbiAgdmFyIGZvckVhY2ggPSBBcnJheS5wcm90b3R5cGUuZm9yRWFjaCB8fCBmdW5jdGlvbiAoZm4sIHNjb3BlKSB7XG4gICAgaWYgKHRoaXMgPT09IHZvaWQgMCB8fCB0aGlzID09PSBudWxsIHx8IHR5cGVvZiBmbiAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcigpO1xuICAgIH1cblxuICAgIC8qIGpzaGludCBiaXR3aXNlOiBmYWxzZSAqL1xuICAgIHZhciBpLCBsZW4gPSB0aGlzLmxlbmd0aCA+Pj4gMDtcbiAgICAvKiBqc2hpbnQgYml0d2lzZTogdHJ1ZSAqL1xuXG4gICAgZm9yIChpID0gMDsgaSA8IGxlbjsgKytpKSB7XG4gICAgICBpZiAoaSBpbiB0aGlzKSB7XG4gICAgICAgIGZuLmNhbGwoc2NvcGUsIHRoaXNbaV0sIGksIHRoaXMpO1xuICAgICAgfVxuICAgIH1cbiAgfTtcblxuICAvLyBTVkcgQ2FjaGVcbiAgdmFyIHN2Z0NhY2hlID0ge307XG5cbiAgdmFyIGluamVjdENvdW50ID0gMDtcbiAgdmFyIGluamVjdGVkRWxlbWVudHMgPSBbXTtcblxuICAvLyBSZXF1ZXN0IFF1ZXVlXG4gIHZhciByZXF1ZXN0UXVldWUgPSBbXTtcblxuICAvLyBTY3JpcHQgcnVubmluZyBzdGF0dXNcbiAgdmFyIHJhblNjcmlwdHMgPSB7fTtcblxuICB2YXIgY2xvbmVTdmcgPSBmdW5jdGlvbiAoc291cmNlU3ZnKSB7XG4gICAgcmV0dXJuIHNvdXJjZVN2Zy5jbG9uZU5vZGUodHJ1ZSk7XG4gIH07XG5cbiAgdmFyIHF1ZXVlUmVxdWVzdCA9IGZ1bmN0aW9uICh1cmwsIGNhbGxiYWNrKSB7XG4gICAgcmVxdWVzdFF1ZXVlW3VybF0gPSByZXF1ZXN0UXVldWVbdXJsXSB8fCBbXTtcbiAgICByZXF1ZXN0UXVldWVbdXJsXS5wdXNoKGNhbGxiYWNrKTtcbiAgfTtcblxuICB2YXIgcHJvY2Vzc1JlcXVlc3RRdWV1ZSA9IGZ1bmN0aW9uICh1cmwpIHtcbiAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gcmVxdWVzdFF1ZXVlW3VybF0ubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgIC8vIE1ha2UgdGhlc2UgY2FsbHMgYXN5bmMgc28gd2UgYXZvaWQgYmxvY2tpbmcgdGhlIHBhZ2UvcmVuZGVyZXJcbiAgICAgIC8qIGpzaGludCBsb29wZnVuYzogdHJ1ZSAqL1xuICAgICAgKGZ1bmN0aW9uIChpbmRleCkge1xuICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICByZXF1ZXN0UXVldWVbdXJsXVtpbmRleF0oY2xvbmVTdmcoc3ZnQ2FjaGVbdXJsXSkpO1xuICAgICAgICB9LCAwKTtcbiAgICAgIH0pKGkpO1xuICAgICAgLyoganNoaW50IGxvb3BmdW5jOiBmYWxzZSAqL1xuICAgIH1cbiAgfTtcblxuICB2YXIgbG9hZFN2ZyA9IGZ1bmN0aW9uICh1cmwsIGNhbGxiYWNrKSB7XG4gICAgaWYgKHN2Z0NhY2hlW3VybF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgaWYgKHN2Z0NhY2hlW3VybF0gaW5zdGFuY2VvZiBTVkdTVkdFbGVtZW50KSB7XG4gICAgICAgIC8vIFdlIGFscmVhZHkgaGF2ZSBpdCBpbiBjYWNoZSwgc28gdXNlIGl0XG4gICAgICAgIGNhbGxiYWNrKGNsb25lU3ZnKHN2Z0NhY2hlW3VybF0pKTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICAvLyBXZSBkb24ndCBoYXZlIGl0IGluIGNhY2hlIHlldCwgYnV0IHdlIGFyZSBsb2FkaW5nIGl0LCBzbyBxdWV1ZSB0aGlzIHJlcXVlc3RcbiAgICAgICAgcXVldWVSZXF1ZXN0KHVybCwgY2FsbGJhY2spO1xuICAgICAgfVxuICAgIH1cbiAgICBlbHNlIHtcblxuICAgICAgaWYgKCF3aW5kb3cuWE1MSHR0cFJlcXVlc3QpIHtcbiAgICAgICAgY2FsbGJhY2soJ0Jyb3dzZXIgZG9lcyBub3Qgc3VwcG9ydCBYTUxIdHRwUmVxdWVzdCcpO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG5cbiAgICAgIC8vIFNlZWQgdGhlIGNhY2hlIHRvIGluZGljYXRlIHdlIGFyZSBsb2FkaW5nIHRoaXMgVVJMIGFscmVhZHlcbiAgICAgIHN2Z0NhY2hlW3VybF0gPSB7fTtcbiAgICAgIHF1ZXVlUmVxdWVzdCh1cmwsIGNhbGxiYWNrKTtcblxuICAgICAgdmFyIGh0dHBSZXF1ZXN0ID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG5cbiAgICAgIGh0dHBSZXF1ZXN0Lm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgLy8gcmVhZHlTdGF0ZSA0ID0gY29tcGxldGVcbiAgICAgICAgaWYgKGh0dHBSZXF1ZXN0LnJlYWR5U3RhdGUgPT09IDQpIHtcblxuICAgICAgICAgIC8vIEhhbmRsZSBzdGF0dXNcbiAgICAgICAgICBpZiAoaHR0cFJlcXVlc3Quc3RhdHVzID09PSA0MDQgfHwgaHR0cFJlcXVlc3QucmVzcG9uc2VYTUwgPT09IG51bGwpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKCdVbmFibGUgdG8gbG9hZCBTVkcgZmlsZTogJyArIHVybCk7XG5cbiAgICAgICAgICAgIGlmIChpc0xvY2FsKSBjYWxsYmFjaygnTm90ZTogU1ZHIGluamVjdGlvbiBhamF4IGNhbGxzIGRvIG5vdCB3b3JrIGxvY2FsbHkgd2l0aG91dCBhZGp1c3Rpbmcgc2VjdXJpdHkgc2V0dGluZyBpbiB5b3VyIGJyb3dzZXIuIE9yIGNvbnNpZGVyIHVzaW5nIGEgbG9jYWwgd2Vic2VydmVyLicpO1xuXG4gICAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIDIwMCBzdWNjZXNzIGZyb20gc2VydmVyLCBvciAwIHdoZW4gdXNpbmcgZmlsZTovLyBwcm90b2NvbCBsb2NhbGx5XG4gICAgICAgICAgaWYgKGh0dHBSZXF1ZXN0LnN0YXR1cyA9PT0gMjAwIHx8IChpc0xvY2FsICYmIGh0dHBSZXF1ZXN0LnN0YXR1cyA9PT0gMCkpIHtcblxuICAgICAgICAgICAgLyogZ2xvYmFscyBEb2N1bWVudCAqL1xuICAgICAgICAgICAgaWYgKGh0dHBSZXF1ZXN0LnJlc3BvbnNlWE1MIGluc3RhbmNlb2YgRG9jdW1lbnQpIHtcbiAgICAgICAgICAgICAgLy8gQ2FjaGUgaXRcbiAgICAgICAgICAgICAgc3ZnQ2FjaGVbdXJsXSA9IGh0dHBSZXF1ZXN0LnJlc3BvbnNlWE1MLmRvY3VtZW50RWxlbWVudDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8qIGdsb2JhbHMgLURvY3VtZW50ICovXG5cbiAgICAgICAgICAgIC8vIElFOSBkb2Vzbid0IGNyZWF0ZSBhIHJlc3BvbnNlWE1MIERvY3VtZW50IG9iamVjdCBmcm9tIGxvYWRlZCBTVkcsXG4gICAgICAgICAgICAvLyBhbmQgdGhyb3dzIGEgXCJET00gRXhjZXB0aW9uOiBISUVSQVJDSFlfUkVRVUVTVF9FUlIgKDMpXCIgZXJyb3Igd2hlbiBpbmplY3RlZC5cbiAgICAgICAgICAgIC8vXG4gICAgICAgICAgICAvLyBTbywgd2UnbGwganVzdCBjcmVhdGUgb3VyIG93biBtYW51YWxseSB2aWEgdGhlIERPTVBhcnNlciB1c2luZ1xuICAgICAgICAgICAgLy8gdGhlIHRoZSByYXcgWE1MIHJlc3BvbnNlVGV4dC5cbiAgICAgICAgICAgIC8vXG4gICAgICAgICAgICAvLyA6Tk9URTogSUU4IGFuZCBvbGRlciBkb2Vzbid0IGhhdmUgRE9NUGFyc2VyLCBidXQgdGhleSBjYW4ndCBkbyBTVkcgZWl0aGVyLCBzby4uLlxuICAgICAgICAgICAgZWxzZSBpZiAoRE9NUGFyc2VyICYmIChET01QYXJzZXIgaW5zdGFuY2VvZiBGdW5jdGlvbikpIHtcbiAgICAgICAgICAgICAgdmFyIHhtbERvYztcbiAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICB2YXIgcGFyc2VyID0gbmV3IERPTVBhcnNlcigpO1xuICAgICAgICAgICAgICAgIHhtbERvYyA9IHBhcnNlci5wYXJzZUZyb21TdHJpbmcoaHR0cFJlcXVlc3QucmVzcG9uc2VUZXh0LCAndGV4dC94bWwnKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgIHhtbERvYyA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIGlmICgheG1sRG9jIHx8IHhtbERvYy5nZXRFbGVtZW50c0J5VGFnTmFtZSgncGFyc2VyZXJyb3InKS5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjaygnVW5hYmxlIHRvIHBhcnNlIFNWRyBmaWxlOiAnICsgdXJsKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gQ2FjaGUgaXRcbiAgICAgICAgICAgICAgICBzdmdDYWNoZVt1cmxdID0geG1sRG9jLmRvY3VtZW50RWxlbWVudDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBXZSd2ZSBsb2FkZWQgYSBuZXcgYXNzZXQsIHNvIHByb2Nlc3MgYW55IHJlcXVlc3RzIHdhaXRpbmcgZm9yIGl0XG4gICAgICAgICAgICBwcm9jZXNzUmVxdWVzdFF1ZXVlKHVybCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgY2FsbGJhY2soJ1RoZXJlIHdhcyBhIHByb2JsZW0gaW5qZWN0aW5nIHRoZSBTVkc6ICcgKyBodHRwUmVxdWVzdC5zdGF0dXMgKyAnICcgKyBodHRwUmVxdWVzdC5zdGF0dXNUZXh0KTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgICAgIGh0dHBSZXF1ZXN0Lm9wZW4oJ0dFVCcsIHVybCk7XG5cbiAgICAgIC8vIFRyZWF0IGFuZCBwYXJzZSB0aGUgcmVzcG9uc2UgYXMgWE1MLCBldmVuIGlmIHRoZVxuICAgICAgLy8gc2VydmVyIHNlbmRzIHVzIGEgZGlmZmVyZW50IG1pbWV0eXBlXG4gICAgICBpZiAoaHR0cFJlcXVlc3Qub3ZlcnJpZGVNaW1lVHlwZSkgaHR0cFJlcXVlc3Qub3ZlcnJpZGVNaW1lVHlwZSgndGV4dC94bWwnKTtcblxuICAgICAgaHR0cFJlcXVlc3Quc2VuZCgpO1xuICAgIH1cbiAgfTtcblxuICAvLyBJbmplY3QgYSBzaW5nbGUgZWxlbWVudFxuICB2YXIgaW5qZWN0RWxlbWVudCA9IGZ1bmN0aW9uIChlbCwgZXZhbFNjcmlwdHMsIHBuZ0ZhbGxiYWNrLCBjYWxsYmFjaykge1xuXG4gICAgLy8gR3JhYiB0aGUgc3JjIG9yIGRhdGEtc3JjIGF0dHJpYnV0ZVxuICAgIHZhciBpbWdVcmwgPSBlbC5nZXRBdHRyaWJ1dGUoJ2RhdGEtc3JjJykgfHwgZWwuZ2V0QXR0cmlidXRlKCdzcmMnKTtcblxuICAgIC8vIFdlIGNhbiBvbmx5IGluamVjdCBTVkdcbiAgICBpZiAoISgvXFwuc3ZnL2kpLnRlc3QoaW1nVXJsKSkge1xuICAgICAgY2FsbGJhY2soJ0F0dGVtcHRlZCB0byBpbmplY3QgYSBmaWxlIHdpdGggYSBub24tc3ZnIGV4dGVuc2lvbjogJyArIGltZ1VybCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gSWYgd2UgZG9uJ3QgaGF2ZSBTVkcgc3VwcG9ydCB0cnkgdG8gZmFsbCBiYWNrIHRvIGEgcG5nLFxuICAgIC8vIGVpdGhlciBkZWZpbmVkIHBlci1lbGVtZW50IHZpYSBkYXRhLWZhbGxiYWNrIG9yIGRhdGEtcG5nLFxuICAgIC8vIG9yIGdsb2JhbGx5IHZpYSB0aGUgcG5nRmFsbGJhY2sgZGlyZWN0b3J5IHNldHRpbmdcbiAgICBpZiAoIWhhc1N2Z1N1cHBvcnQpIHtcbiAgICAgIHZhciBwZXJFbGVtZW50RmFsbGJhY2sgPSBlbC5nZXRBdHRyaWJ1dGUoJ2RhdGEtZmFsbGJhY2snKSB8fCBlbC5nZXRBdHRyaWJ1dGUoJ2RhdGEtcG5nJyk7XG5cbiAgICAgIC8vIFBlci1lbGVtZW50IHNwZWNpZmljIFBORyBmYWxsYmFjayBkZWZpbmVkLCBzbyB1c2UgdGhhdFxuICAgICAgaWYgKHBlckVsZW1lbnRGYWxsYmFjaykge1xuICAgICAgICBlbC5zZXRBdHRyaWJ1dGUoJ3NyYycsIHBlckVsZW1lbnRGYWxsYmFjayk7XG4gICAgICAgIGNhbGxiYWNrKG51bGwpO1xuICAgICAgfVxuICAgICAgLy8gR2xvYmFsIFBORyBmYWxsYmFjayBkaXJlY3Rvcml5IGRlZmluZWQsIHVzZSB0aGUgc2FtZS1uYW1lZCBQTkdcbiAgICAgIGVsc2UgaWYgKHBuZ0ZhbGxiYWNrKSB7XG4gICAgICAgIGVsLnNldEF0dHJpYnV0ZSgnc3JjJywgcG5nRmFsbGJhY2sgKyAnLycgKyBpbWdVcmwuc3BsaXQoJy8nKS5wb3AoKS5yZXBsYWNlKCcuc3ZnJywgJy5wbmcnKSk7XG4gICAgICAgIGNhbGxiYWNrKG51bGwpO1xuICAgICAgfVxuICAgICAgLy8gdW0uLi5cbiAgICAgIGVsc2Uge1xuICAgICAgICBjYWxsYmFjaygnVGhpcyBicm93c2VyIGRvZXMgbm90IHN1cHBvcnQgU1ZHIGFuZCBubyBQTkcgZmFsbGJhY2sgd2FzIGRlZmluZWQuJyk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBNYWtlIHN1cmUgd2UgYXJlbid0IGFscmVhZHkgaW4gdGhlIHByb2Nlc3Mgb2YgaW5qZWN0aW5nIHRoaXMgZWxlbWVudCB0b1xuICAgIC8vIGF2b2lkIGEgcmFjZSBjb25kaXRpb24gaWYgbXVsdGlwbGUgaW5qZWN0aW9ucyBmb3IgdGhlIHNhbWUgZWxlbWVudCBhcmUgcnVuLlxuICAgIC8vIDpOT1RFOiBVc2luZyBpbmRleE9mKCkgb25seSBfYWZ0ZXJfIHdlIGNoZWNrIGZvciBTVkcgc3VwcG9ydCBhbmQgYmFpbCxcbiAgICAvLyBzbyBubyBuZWVkIGZvciBJRTggaW5kZXhPZigpIHBvbHlmaWxsXG4gICAgaWYgKGluamVjdGVkRWxlbWVudHMuaW5kZXhPZihlbCkgIT09IC0xKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gUmVtZW1iZXIgdGhlIHJlcXVlc3QgdG8gaW5qZWN0IHRoaXMgZWxlbWVudCwgaW4gY2FzZSBvdGhlciBpbmplY3Rpb25cbiAgICAvLyBjYWxscyBhcmUgYWxzbyB0cnlpbmcgdG8gcmVwbGFjZSB0aGlzIGVsZW1lbnQgYmVmb3JlIHdlIGZpbmlzaFxuICAgIGluamVjdGVkRWxlbWVudHMucHVzaChlbCk7XG5cbiAgICAvLyBUcnkgdG8gYXZvaWQgbG9hZGluZyB0aGUgb3JnaW5hbCBpbWFnZSBzcmMgaWYgcG9zc2libGUuXG4gICAgZWwuc2V0QXR0cmlidXRlKCdzcmMnLCAnJyk7XG5cbiAgICAvLyBMb2FkIGl0IHVwXG4gICAgbG9hZFN2ZyhpbWdVcmwsIGZ1bmN0aW9uIChzdmcpIHtcblxuICAgICAgaWYgKHR5cGVvZiBzdmcgPT09ICd1bmRlZmluZWQnIHx8IHR5cGVvZiBzdmcgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIGNhbGxiYWNrKHN2Zyk7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cblxuICAgICAgdmFyIGltZ0lkID0gZWwuZ2V0QXR0cmlidXRlKCdpZCcpO1xuICAgICAgaWYgKGltZ0lkKSB7XG4gICAgICAgIHN2Zy5zZXRBdHRyaWJ1dGUoJ2lkJywgaW1nSWQpO1xuICAgICAgfVxuXG4gICAgICB2YXIgaW1nVGl0bGUgPSBlbC5nZXRBdHRyaWJ1dGUoJ3RpdGxlJyk7XG4gICAgICBpZiAoaW1nVGl0bGUpIHtcbiAgICAgICAgc3ZnLnNldEF0dHJpYnV0ZSgndGl0bGUnLCBpbWdUaXRsZSk7XG4gICAgICB9XG5cbiAgICAgIC8vIENvbmNhdCB0aGUgU1ZHIGNsYXNzZXMgKyAnaW5qZWN0ZWQtc3ZnJyArIHRoZSBpbWcgY2xhc3Nlc1xuICAgICAgdmFyIGNsYXNzTWVyZ2UgPSBbXS5jb25jYXQoc3ZnLmdldEF0dHJpYnV0ZSgnY2xhc3MnKSB8fCBbXSwgJ2luamVjdGVkLXN2ZycsIGVsLmdldEF0dHJpYnV0ZSgnY2xhc3MnKSB8fCBbXSkuam9pbignICcpO1xuICAgICAgc3ZnLnNldEF0dHJpYnV0ZSgnY2xhc3MnLCB1bmlxdWVDbGFzc2VzKGNsYXNzTWVyZ2UpKTtcblxuICAgICAgdmFyIGltZ1N0eWxlID0gZWwuZ2V0QXR0cmlidXRlKCdzdHlsZScpO1xuICAgICAgaWYgKGltZ1N0eWxlKSB7XG4gICAgICAgIHN2Zy5zZXRBdHRyaWJ1dGUoJ3N0eWxlJywgaW1nU3R5bGUpO1xuICAgICAgfVxuXG4gICAgICAvLyBDb3B5IGFsbCB0aGUgZGF0YSBlbGVtZW50cyB0byB0aGUgc3ZnXG4gICAgICB2YXIgaW1nRGF0YSA9IFtdLmZpbHRlci5jYWxsKGVsLmF0dHJpYnV0ZXMsIGZ1bmN0aW9uIChhdCkge1xuICAgICAgICByZXR1cm4gKC9eZGF0YS1cXHdbXFx3XFwtXSokLykudGVzdChhdC5uYW1lKTtcbiAgICAgIH0pO1xuICAgICAgZm9yRWFjaC5jYWxsKGltZ0RhdGEsIGZ1bmN0aW9uIChkYXRhQXR0cikge1xuICAgICAgICBpZiAoZGF0YUF0dHIubmFtZSAmJiBkYXRhQXR0ci52YWx1ZSkge1xuICAgICAgICAgIHN2Zy5zZXRBdHRyaWJ1dGUoZGF0YUF0dHIubmFtZSwgZGF0YUF0dHIudmFsdWUpO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgLy8gTWFrZSBzdXJlIGFueSBpbnRlcm5hbGx5IHJlZmVyZW5jZWQgY2xpcFBhdGggaWRzIGFuZCB0aGVpclxuICAgICAgLy8gY2xpcC1wYXRoIHJlZmVyZW5jZXMgYXJlIHVuaXF1ZS5cbiAgICAgIC8vXG4gICAgICAvLyBUaGlzIGFkZHJlc3NlcyB0aGUgaXNzdWUgb2YgaGF2aW5nIG11bHRpcGxlIGluc3RhbmNlcyBvZiB0aGVcbiAgICAgIC8vIHNhbWUgU1ZHIG9uIGEgcGFnZSBhbmQgb25seSB0aGUgZmlyc3QgY2xpcFBhdGggaWQgaXMgcmVmZXJlbmNlZC5cbiAgICAgIC8vXG4gICAgICAvLyBCcm93c2VycyBvZnRlbiBzaG9ydGN1dCB0aGUgU1ZHIFNwZWMgYW5kIGRvbid0IHVzZSBjbGlwUGF0aHNcbiAgICAgIC8vIGNvbnRhaW5lZCBpbiBwYXJlbnQgZWxlbWVudHMgdGhhdCBhcmUgaGlkZGVuLCBzbyBpZiB5b3UgaGlkZSB0aGUgZmlyc3RcbiAgICAgIC8vIFNWRyBpbnN0YW5jZSBvbiB0aGUgcGFnZSwgdGhlbiBhbGwgb3RoZXIgaW5zdGFuY2VzIGxvc2UgdGhlaXIgY2xpcHBpbmcuXG4gICAgICAvLyBSZWZlcmVuY2U6IGh0dHBzOi8vYnVnemlsbGEubW96aWxsYS5vcmcvc2hvd19idWcuY2dpP2lkPTM3NjAyN1xuXG4gICAgICAvLyBIYW5kbGUgYWxsIGRlZnMgZWxlbWVudHMgdGhhdCBoYXZlIGlyaSBjYXBhYmxlIGF0dHJpYnV0ZXMgYXMgZGVmaW5lZCBieSB3M2M6IGh0dHA6Ly93d3cudzMub3JnL1RSL1NWRy9saW5raW5nLmh0bWwjcHJvY2Vzc2luZ0lSSVxuICAgICAgLy8gTWFwcGluZyBJUkkgYWRkcmVzc2FibGUgZWxlbWVudHMgdG8gdGhlIHByb3BlcnRpZXMgdGhhdCBjYW4gcmVmZXJlbmNlIHRoZW06XG4gICAgICB2YXIgaXJpRWxlbWVudHNBbmRQcm9wZXJ0aWVzID0ge1xuICAgICAgICAnY2xpcFBhdGgnOiBbJ2NsaXAtcGF0aCddLFxuICAgICAgICAnY29sb3ItcHJvZmlsZSc6IFsnY29sb3ItcHJvZmlsZSddLFxuICAgICAgICAnY3Vyc29yJzogWydjdXJzb3InXSxcbiAgICAgICAgJ2ZpbHRlcic6IFsnZmlsdGVyJ10sXG4gICAgICAgICdsaW5lYXJHcmFkaWVudCc6IFsnZmlsbCcsICdzdHJva2UnXSxcbiAgICAgICAgJ21hcmtlcic6IFsnbWFya2VyJywgJ21hcmtlci1zdGFydCcsICdtYXJrZXItbWlkJywgJ21hcmtlci1lbmQnXSxcbiAgICAgICAgJ21hc2snOiBbJ21hc2snXSxcbiAgICAgICAgJ3BhdHRlcm4nOiBbJ2ZpbGwnLCAnc3Ryb2tlJ10sXG4gICAgICAgICdyYWRpYWxHcmFkaWVudCc6IFsnZmlsbCcsICdzdHJva2UnXVxuICAgICAgfTtcblxuICAgICAgdmFyIGVsZW1lbnQsIGVsZW1lbnREZWZzLCBwcm9wZXJ0aWVzLCBjdXJyZW50SWQsIG5ld0lkO1xuICAgICAgT2JqZWN0LmtleXMoaXJpRWxlbWVudHNBbmRQcm9wZXJ0aWVzKS5mb3JFYWNoKGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgZWxlbWVudCA9IGtleTtcbiAgICAgICAgcHJvcGVydGllcyA9IGlyaUVsZW1lbnRzQW5kUHJvcGVydGllc1trZXldO1xuXG4gICAgICAgIGVsZW1lbnREZWZzID0gc3ZnLnF1ZXJ5U2VsZWN0b3JBbGwoJ2RlZnMgJyArIGVsZW1lbnQgKyAnW2lkXScpO1xuICAgICAgICBmb3IgKHZhciBpID0gMCwgZWxlbWVudHNMZW4gPSBlbGVtZW50RGVmcy5sZW5ndGg7IGkgPCBlbGVtZW50c0xlbjsgaSsrKSB7XG4gICAgICAgICAgY3VycmVudElkID0gZWxlbWVudERlZnNbaV0uaWQ7XG4gICAgICAgICAgbmV3SWQgPSBjdXJyZW50SWQgKyAnLScgKyBpbmplY3RDb3VudDtcblxuICAgICAgICAgIC8vIEFsbCBvZiB0aGUgcHJvcGVydGllcyB0aGF0IGNhbiByZWZlcmVuY2UgdGhpcyBlbGVtZW50IHR5cGVcbiAgICAgICAgICB2YXIgcmVmZXJlbmNpbmdFbGVtZW50cztcbiAgICAgICAgICBmb3JFYWNoLmNhbGwocHJvcGVydGllcywgZnVuY3Rpb24gKHByb3BlcnR5KSB7XG4gICAgICAgICAgICAvLyA6Tk9URTogdXNpbmcgYSBzdWJzdHJpbmcgbWF0Y2ggYXR0ciBzZWxlY3RvciBoZXJlIHRvIGRlYWwgd2l0aCBJRSBcImFkZGluZyBleHRyYSBxdW90ZXMgaW4gdXJsKCkgYXR0cnNcIlxuICAgICAgICAgICAgcmVmZXJlbmNpbmdFbGVtZW50cyA9IHN2Zy5xdWVyeVNlbGVjdG9yQWxsKCdbJyArIHByb3BlcnR5ICsgJyo9XCInICsgY3VycmVudElkICsgJ1wiXScpO1xuICAgICAgICAgICAgZm9yICh2YXIgaiA9IDAsIHJlZmVyZW5jaW5nRWxlbWVudExlbiA9IHJlZmVyZW5jaW5nRWxlbWVudHMubGVuZ3RoOyBqIDwgcmVmZXJlbmNpbmdFbGVtZW50TGVuOyBqKyspIHtcbiAgICAgICAgICAgICAgcmVmZXJlbmNpbmdFbGVtZW50c1tqXS5zZXRBdHRyaWJ1dGUocHJvcGVydHksICd1cmwoIycgKyBuZXdJZCArICcpJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICBlbGVtZW50RGVmc1tpXS5pZCA9IG5ld0lkO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgLy8gUmVtb3ZlIGFueSB1bndhbnRlZC9pbnZhbGlkIG5hbWVzcGFjZXMgdGhhdCBtaWdodCBoYXZlIGJlZW4gYWRkZWQgYnkgU1ZHIGVkaXRpbmcgdG9vbHNcbiAgICAgIHN2Zy5yZW1vdmVBdHRyaWJ1dGUoJ3htbG5zOmEnKTtcblxuICAgICAgLy8gUG9zdCBwYWdlIGxvYWQgaW5qZWN0ZWQgU1ZHcyBkb24ndCBhdXRvbWF0aWNhbGx5IGhhdmUgdGhlaXIgc2NyaXB0XG4gICAgICAvLyBlbGVtZW50cyBydW4sIHNvIHdlJ2xsIG5lZWQgdG8gbWFrZSB0aGF0IGhhcHBlbiwgaWYgcmVxdWVzdGVkXG5cbiAgICAgIC8vIEZpbmQgdGhlbiBwcnVuZSB0aGUgc2NyaXB0c1xuICAgICAgdmFyIHNjcmlwdHMgPSBzdmcucXVlcnlTZWxlY3RvckFsbCgnc2NyaXB0Jyk7XG4gICAgICB2YXIgc2NyaXB0c1RvRXZhbCA9IFtdO1xuICAgICAgdmFyIHNjcmlwdCwgc2NyaXB0VHlwZTtcblxuICAgICAgZm9yICh2YXIgayA9IDAsIHNjcmlwdHNMZW4gPSBzY3JpcHRzLmxlbmd0aDsgayA8IHNjcmlwdHNMZW47IGsrKykge1xuICAgICAgICBzY3JpcHRUeXBlID0gc2NyaXB0c1trXS5nZXRBdHRyaWJ1dGUoJ3R5cGUnKTtcblxuICAgICAgICAvLyBPbmx5IHByb2Nlc3MgamF2YXNjcmlwdCB0eXBlcy5cbiAgICAgICAgLy8gU1ZHIGRlZmF1bHRzIHRvICdhcHBsaWNhdGlvbi9lY21hc2NyaXB0JyBmb3IgdW5zZXQgdHlwZXNcbiAgICAgICAgaWYgKCFzY3JpcHRUeXBlIHx8IHNjcmlwdFR5cGUgPT09ICdhcHBsaWNhdGlvbi9lY21hc2NyaXB0JyB8fCBzY3JpcHRUeXBlID09PSAnYXBwbGljYXRpb24vamF2YXNjcmlwdCcpIHtcblxuICAgICAgICAgIC8vIGlubmVyVGV4dCBmb3IgSUUsIHRleHRDb250ZW50IGZvciBvdGhlciBicm93c2Vyc1xuICAgICAgICAgIHNjcmlwdCA9IHNjcmlwdHNba10uaW5uZXJUZXh0IHx8IHNjcmlwdHNba10udGV4dENvbnRlbnQ7XG5cbiAgICAgICAgICAvLyBTdGFzaFxuICAgICAgICAgIHNjcmlwdHNUb0V2YWwucHVzaChzY3JpcHQpO1xuXG4gICAgICAgICAgLy8gVGlkeSB1cCBhbmQgcmVtb3ZlIHRoZSBzY3JpcHQgZWxlbWVudCBzaW5jZSB3ZSBkb24ndCBuZWVkIGl0IGFueW1vcmVcbiAgICAgICAgICBzdmcucmVtb3ZlQ2hpbGQoc2NyaXB0c1trXSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gUnVuL0V2YWwgdGhlIHNjcmlwdHMgaWYgbmVlZGVkXG4gICAgICBpZiAoc2NyaXB0c1RvRXZhbC5sZW5ndGggPiAwICYmIChldmFsU2NyaXB0cyA9PT0gJ2Fsd2F5cycgfHwgKGV2YWxTY3JpcHRzID09PSAnb25jZScgJiYgIXJhblNjcmlwdHNbaW1nVXJsXSkpKSB7XG4gICAgICAgIGZvciAodmFyIGwgPSAwLCBzY3JpcHRzVG9FdmFsTGVuID0gc2NyaXB0c1RvRXZhbC5sZW5ndGg7IGwgPCBzY3JpcHRzVG9FdmFsTGVuOyBsKyspIHtcblxuICAgICAgICAgIC8vIDpOT1RFOiBZdXAsIHRoaXMgaXMgYSBmb3JtIG9mIGV2YWwsIGJ1dCBpdCBpcyBiZWluZyB1c2VkIHRvIGV2YWwgY29kZVxuICAgICAgICAgIC8vIHRoZSBjYWxsZXIgaGFzIGV4cGxpY3RlbHkgYXNrZWQgdG8gYmUgbG9hZGVkLCBhbmQgdGhlIGNvZGUgaXMgaW4gYSBjYWxsZXJcbiAgICAgICAgICAvLyBkZWZpbmVkIFNWRyBmaWxlLi4uIG5vdCByYXcgdXNlciBpbnB1dC5cbiAgICAgICAgICAvL1xuICAgICAgICAgIC8vIEFsc28sIHRoZSBjb2RlIGlzIGV2YWx1YXRlZCBpbiBhIGNsb3N1cmUgYW5kIG5vdCBpbiB0aGUgZ2xvYmFsIHNjb3BlLlxuICAgICAgICAgIC8vIElmIHlvdSBuZWVkIHRvIHB1dCBzb21ldGhpbmcgaW4gZ2xvYmFsIHNjb3BlLCB1c2UgJ3dpbmRvdydcbiAgICAgICAgICBuZXcgRnVuY3Rpb24oc2NyaXB0c1RvRXZhbFtsXSkod2luZG93KTsgLy8ganNoaW50IGlnbm9yZTpsaW5lXG4gICAgICAgIH1cblxuICAgICAgICAvLyBSZW1lbWJlciB3ZSBhbHJlYWR5IHJhbiBzY3JpcHRzIGZvciB0aGlzIHN2Z1xuICAgICAgICByYW5TY3JpcHRzW2ltZ1VybF0gPSB0cnVlO1xuICAgICAgfVxuXG4gICAgICAvLyA6V09SS0FST1VORDpcbiAgICAgIC8vIElFIGRvZXNuJ3QgZXZhbHVhdGUgPHN0eWxlPiB0YWdzIGluIFNWR3MgdGhhdCBhcmUgZHluYW1pY2FsbHkgYWRkZWQgdG8gdGhlIHBhZ2UuXG4gICAgICAvLyBUaGlzIHRyaWNrIHdpbGwgdHJpZ2dlciBJRSB0byByZWFkIGFuZCB1c2UgYW55IGV4aXN0aW5nIFNWRyA8c3R5bGU+IHRhZ3MuXG4gICAgICAvL1xuICAgICAgLy8gUmVmZXJlbmNlOiBodHRwczovL2dpdGh1Yi5jb20vaWNvbmljL1NWR0luamVjdG9yL2lzc3Vlcy8yM1xuICAgICAgdmFyIHN0eWxlVGFncyA9IHN2Zy5xdWVyeVNlbGVjdG9yQWxsKCdzdHlsZScpO1xuICAgICAgZm9yRWFjaC5jYWxsKHN0eWxlVGFncywgZnVuY3Rpb24gKHN0eWxlVGFnKSB7XG4gICAgICAgIHN0eWxlVGFnLnRleHRDb250ZW50ICs9ICcnO1xuICAgICAgfSk7XG5cbiAgICAgIC8vIFJlcGxhY2UgdGhlIGltYWdlIHdpdGggdGhlIHN2Z1xuICAgICAgZWwucGFyZW50Tm9kZS5yZXBsYWNlQ2hpbGQoc3ZnLCBlbCk7XG5cbiAgICAgIC8vIE5vdyB0aGF0IHdlIG5vIGxvbmdlciBuZWVkIGl0LCBkcm9wIHJlZmVyZW5jZXNcbiAgICAgIC8vIHRvIHRoZSBvcmlnaW5hbCBlbGVtZW50IHNvIGl0IGNhbiBiZSBHQydkXG4gICAgICBkZWxldGUgaW5qZWN0ZWRFbGVtZW50c1tpbmplY3RlZEVsZW1lbnRzLmluZGV4T2YoZWwpXTtcbiAgICAgIGVsID0gbnVsbDtcblxuICAgICAgLy8gSW5jcmVtZW50IHRoZSBpbmplY3RlZCBjb3VudFxuICAgICAgaW5qZWN0Q291bnQrKztcblxuICAgICAgY2FsbGJhY2soc3ZnKTtcbiAgICB9KTtcbiAgfTtcblxuICAvKipcbiAgICogU1ZHSW5qZWN0b3JcbiAgICpcbiAgICogUmVwbGFjZSB0aGUgZ2l2ZW4gZWxlbWVudHMgd2l0aCB0aGVpciBmdWxsIGlubGluZSBTVkcgRE9NIGVsZW1lbnRzLlxuICAgKlxuICAgKiA6Tk9URTogV2UgYXJlIHVzaW5nIGdldC9zZXRBdHRyaWJ1dGUgd2l0aCBTVkcgYmVjYXVzZSB0aGUgU1ZHIERPTSBzcGVjIGRpZmZlcnMgZnJvbSBIVE1MIERPTSBhbmRcbiAgICogY2FuIHJldHVybiBvdGhlciB1bmV4cGVjdGVkIG9iamVjdCB0eXBlcyB3aGVuIHRyeWluZyB0byBkaXJlY3RseSBhY2Nlc3Mgc3ZnIHByb3BlcnRpZXMuXG4gICAqIGV4OiBcImNsYXNzTmFtZVwiIHJldHVybnMgYSBTVkdBbmltYXRlZFN0cmluZyB3aXRoIHRoZSBjbGFzcyB2YWx1ZSBmb3VuZCBpbiB0aGUgXCJiYXNlVmFsXCIgcHJvcGVydHksXG4gICAqIGluc3RlYWQgb2Ygc2ltcGxlIHN0cmluZyBsaWtlIHdpdGggSFRNTCBFbGVtZW50cy5cbiAgICpcbiAgICogQHBhcmFtIHttaXhlc30gQXJyYXkgb2Ygb3Igc2luZ2xlIERPTSBlbGVtZW50XG4gICAqIEBwYXJhbSB7b2JqZWN0fSBvcHRpb25zXG4gICAqIEBwYXJhbSB7ZnVuY3Rpb259IGNhbGxiYWNrXG4gICAqIEByZXR1cm4ge29iamVjdH0gSW5zdGFuY2Ugb2YgU1ZHSW5qZWN0b3JcbiAgICovXG4gIHZhciBTVkdJbmplY3RvciA9IGZ1bmN0aW9uIChlbGVtZW50cywgb3B0aW9ucywgZG9uZSkge1xuXG4gICAgLy8gT3B0aW9ucyAmIGRlZmF1bHRzXG4gICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG5cbiAgICAvLyBTaG91bGQgd2UgcnVuIHRoZSBzY3JpcHRzIGJsb2NrcyBmb3VuZCBpbiB0aGUgU1ZHXG4gICAgLy8gJ2Fsd2F5cycgLSBSdW4gdGhlbSBldmVyeSB0aW1lXG4gICAgLy8gJ29uY2UnIC0gT25seSBydW4gc2NyaXB0cyBvbmNlIGZvciBlYWNoIFNWR1xuICAgIC8vIFtmYWxzZXwnbmV2ZXInXSAtIElnbm9yZSBzY3JpcHRzXG4gICAgdmFyIGV2YWxTY3JpcHRzID0gb3B0aW9ucy5ldmFsU2NyaXB0cyB8fCAnYWx3YXlzJztcblxuICAgIC8vIExvY2F0aW9uIG9mIGZhbGxiYWNrIHBuZ3MsIGlmIGRlc2lyZWRcbiAgICB2YXIgcG5nRmFsbGJhY2sgPSBvcHRpb25zLnBuZ0ZhbGxiYWNrIHx8IGZhbHNlO1xuXG4gICAgLy8gQ2FsbGJhY2sgdG8gcnVuIGR1cmluZyBlYWNoIFNWRyBpbmplY3Rpb24sIHJldHVybmluZyB0aGUgU1ZHIGluamVjdGVkXG4gICAgdmFyIGVhY2hDYWxsYmFjayA9IG9wdGlvbnMuZWFjaDtcblxuICAgIC8vIERvIHRoZSBpbmplY3Rpb24uLi5cbiAgICBpZiAoZWxlbWVudHMubGVuZ3RoICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHZhciBlbGVtZW50c0xvYWRlZCA9IDA7XG4gICAgICBmb3JFYWNoLmNhbGwoZWxlbWVudHMsIGZ1bmN0aW9uIChlbGVtZW50KSB7XG4gICAgICAgIGluamVjdEVsZW1lbnQoZWxlbWVudCwgZXZhbFNjcmlwdHMsIHBuZ0ZhbGxiYWNrLCBmdW5jdGlvbiAoc3ZnKSB7XG4gICAgICAgICAgaWYgKGVhY2hDYWxsYmFjayAmJiB0eXBlb2YgZWFjaENhbGxiYWNrID09PSAnZnVuY3Rpb24nKSBlYWNoQ2FsbGJhY2soc3ZnKTtcbiAgICAgICAgICBpZiAoZG9uZSAmJiBlbGVtZW50cy5sZW5ndGggPT09ICsrZWxlbWVudHNMb2FkZWQpIGRvbmUoZWxlbWVudHNMb2FkZWQpO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIGlmIChlbGVtZW50cykge1xuICAgICAgICBpbmplY3RFbGVtZW50KGVsZW1lbnRzLCBldmFsU2NyaXB0cywgcG5nRmFsbGJhY2ssIGZ1bmN0aW9uIChzdmcpIHtcbiAgICAgICAgICBpZiAoZWFjaENhbGxiYWNrICYmIHR5cGVvZiBlYWNoQ2FsbGJhY2sgPT09ICdmdW5jdGlvbicpIGVhY2hDYWxsYmFjayhzdmcpO1xuICAgICAgICAgIGlmIChkb25lKSBkb25lKDEpO1xuICAgICAgICAgIGVsZW1lbnRzID0gbnVsbDtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgaWYgKGRvbmUpIGRvbmUoMCk7XG4gICAgICB9XG4gICAgfVxuICB9O1xuXG4gIC8qIGdsb2JhbCBtb2R1bGUsIGV4cG9ydHM6IHRydWUsIGRlZmluZSAqL1xuICAvLyBOb2RlLmpzIG9yIENvbW1vbkpTXG4gIGlmICh0eXBlb2YgbW9kdWxlID09PSAnb2JqZWN0JyAmJiB0eXBlb2YgbW9kdWxlLmV4cG9ydHMgPT09ICdvYmplY3QnKSB7XG4gICAgbW9kdWxlLmV4cG9ydHMgPSBleHBvcnRzID0gU1ZHSW5qZWN0b3I7XG4gIH1cbiAgLy8gQU1EIHN1cHBvcnRcbiAgZWxzZSBpZiAodHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kKSB7XG4gICAgZGVmaW5lKGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiBTVkdJbmplY3RvcjtcbiAgICB9KTtcbiAgfVxuICAvLyBPdGhlcndpc2UsIGF0dGFjaCB0byB3aW5kb3cgYXMgZ2xvYmFsXG4gIGVsc2UgaWYgKHR5cGVvZiB3aW5kb3cgPT09ICdvYmplY3QnKSB7XG4gICAgd2luZG93LlNWR0luamVjdG9yID0gU1ZHSW5qZWN0b3I7XG4gIH1cbiAgLyogZ2xvYmFsIC1tb2R1bGUsIC1leHBvcnRzLCAtZGVmaW5lICovXG5cbn0od2luZG93LCBkb2N1bWVudCkpO1xuIiwidmFyIGF1dG9TY3JvbGwgPSAoZnVuY3Rpb24gKCkge1xuJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiBnZXREZWYoZiwgZCkge1xuICAgIGlmICh0eXBlb2YgZiA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgcmV0dXJuIHR5cGVvZiBkID09PSAndW5kZWZpbmVkJyA/IGYgOiBkO1xuICAgIH1cblxuICAgIHJldHVybiBmO1xufVxuZnVuY3Rpb24gYm9vbGVhbihmdW5jLCBkZWYpIHtcblxuICAgIGZ1bmMgPSBnZXREZWYoZnVuYywgZGVmKTtcblxuICAgIGlmICh0eXBlb2YgZnVuYyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gZigpIHtcbiAgICAgICAgICAgIHZhciBhcmd1bWVudHMkMSA9IGFyZ3VtZW50cztcblxuICAgICAgICAgICAgZm9yICh2YXIgX2xlbiA9IGFyZ3VtZW50cy5sZW5ndGgsIGFyZ3MgPSBBcnJheShfbGVuKSwgX2tleSA9IDA7IF9rZXkgPCBfbGVuOyBfa2V5KyspIHtcbiAgICAgICAgICAgICAgICBhcmdzW19rZXldID0gYXJndW1lbnRzJDFbX2tleV07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiAhIWZ1bmMuYXBwbHkodGhpcywgYXJncyk7XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgcmV0dXJuICEhZnVuYyA/IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSA6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH07XG59XG5cbnZhciBwcmVmaXggPSBbJ3dlYmtpdCcsICdtb3onLCAnbXMnLCAnbyddO1xuXG52YXIgcmVxdWVzdEFuaW1hdGlvbkZyYW1lID0gZnVuY3Rpb24gKCkge1xuXG4gIGZvciAodmFyIGkgPSAwLCBsaW1pdCA9IHByZWZpeC5sZW5ndGg7IGkgPCBsaW1pdCAmJiAhd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZTsgKytpKSB7XG4gICAgd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSA9IHdpbmRvd1twcmVmaXhbaV0gKyAnUmVxdWVzdEFuaW1hdGlvbkZyYW1lJ107XG4gIH1cblxuICBpZiAoIXdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUpIHtcbiAgICAoZnVuY3Rpb24gKCkge1xuICAgICAgdmFyIGxhc3RUaW1lID0gMDtcblxuICAgICAgd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSA9IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgICAgICB2YXIgbm93ID0gbmV3IERhdGUoKS5nZXRUaW1lKCk7XG4gICAgICAgIHZhciB0dGMgPSBNYXRoLm1heCgwLCAxNiAtIG5vdyAtIGxhc3RUaW1lKTtcbiAgICAgICAgdmFyIHRpbWVyID0gd2luZG93LnNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgICAgIHJldHVybiBjYWxsYmFjayhub3cgKyB0dGMpO1xuICAgICAgICB9LCB0dGMpO1xuXG4gICAgICAgIGxhc3RUaW1lID0gbm93ICsgdHRjO1xuXG4gICAgICAgIHJldHVybiB0aW1lcjtcbiAgICAgIH07XG4gICAgfSkoKTtcbiAgfVxuXG4gIHJldHVybiB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lLmJpbmQod2luZG93KTtcbn0oKTtcblxudmFyIGNhbmNlbEFuaW1hdGlvbkZyYW1lID0gZnVuY3Rpb24gKCkge1xuXG4gIGZvciAodmFyIGkgPSAwLCBsaW1pdCA9IHByZWZpeC5sZW5ndGg7IGkgPCBsaW1pdCAmJiAhd2luZG93LmNhbmNlbEFuaW1hdGlvbkZyYW1lOyArK2kpIHtcbiAgICB3aW5kb3cuY2FuY2VsQW5pbWF0aW9uRnJhbWUgPSB3aW5kb3dbcHJlZml4W2ldICsgJ0NhbmNlbEFuaW1hdGlvbkZyYW1lJ10gfHwgd2luZG93W3ByZWZpeFtpXSArICdDYW5jZWxSZXF1ZXN0QW5pbWF0aW9uRnJhbWUnXTtcbiAgfVxuXG4gIGlmICghd2luZG93LmNhbmNlbEFuaW1hdGlvbkZyYW1lKSB7XG4gICAgd2luZG93LmNhbmNlbEFuaW1hdGlvbkZyYW1lID0gZnVuY3Rpb24gKHRpbWVyKSB7XG4gICAgICB3aW5kb3cuY2xlYXJUaW1lb3V0KHRpbWVyKTtcbiAgICB9O1xuICB9XG5cbiAgcmV0dXJuIHdpbmRvdy5jYW5jZWxBbmltYXRpb25GcmFtZS5iaW5kKHdpbmRvdyk7XG59KCk7XG5cbnZhciBfdHlwZW9mID0gdHlwZW9mIFN5bWJvbCA9PT0gXCJmdW5jdGlvblwiICYmIHR5cGVvZiBTeW1ib2wuaXRlcmF0b3IgPT09IFwic3ltYm9sXCIgPyBmdW5jdGlvbiAob2JqKSB7IHJldHVybiB0eXBlb2Ygb2JqOyB9IDogZnVuY3Rpb24gKG9iaikgeyByZXR1cm4gb2JqICYmIHR5cGVvZiBTeW1ib2wgPT09IFwiZnVuY3Rpb25cIiAmJiBvYmouY29uc3RydWN0b3IgPT09IFN5bWJvbCA/IFwic3ltYm9sXCIgOiB0eXBlb2Ygb2JqOyB9O1xuXG4vKipcbiAqIFJldHVybnMgYHRydWVgIGlmIHByb3ZpZGVkIGlucHV0IGlzIEVsZW1lbnQuXG4gKiBAbmFtZSBpc0VsZW1lbnRcbiAqIEBwYXJhbSB7Kn0gW2lucHV0XVxuICogQHJldHVybnMge2Jvb2xlYW59XG4gKi9cbnZhciBpc0VsZW1lbnQgPSBmdW5jdGlvbiAoaW5wdXQpIHtcbiAgcmV0dXJuIGlucHV0ICE9IG51bGwgJiYgKHR5cGVvZiBpbnB1dCA9PT0gJ3VuZGVmaW5lZCcgPyAndW5kZWZpbmVkJyA6IF90eXBlb2YoaW5wdXQpKSA9PT0gJ29iamVjdCcgJiYgaW5wdXQubm9kZVR5cGUgPT09IDEgJiYgX3R5cGVvZihpbnB1dC5zdHlsZSkgPT09ICdvYmplY3QnICYmIF90eXBlb2YoaW5wdXQub3duZXJEb2N1bWVudCkgPT09ICdvYmplY3QnO1xufTtcblxuLy8gUHJvZHVjdGlvbiBzdGVwcyBvZiBFQ01BLTI2MiwgRWRpdGlvbiA2LCAyMi4xLjIuMVxuLy8gUmVmZXJlbmNlOiBodHRwOi8vd3d3LmVjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvNi4wLyNzZWMtYXJyYXkuZnJvbVxuXG4vKipcbiAqIGlzQXJyYXlcbiAqL1xuXG5mdW5jdGlvbiBpbmRleE9mRWxlbWVudChlbGVtZW50cywgZWxlbWVudCkge1xuICAgIGVsZW1lbnQgPSByZXNvbHZlRWxlbWVudChlbGVtZW50LCB0cnVlKTtcbiAgICBpZiAoIWlzRWxlbWVudChlbGVtZW50KSkgeyByZXR1cm4gLTE7IH1cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGVsZW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmIChlbGVtZW50c1tpXSA9PT0gZWxlbWVudCkge1xuICAgICAgICAgICAgcmV0dXJuIGk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIC0xO1xufVxuXG5mdW5jdGlvbiBoYXNFbGVtZW50KGVsZW1lbnRzLCBlbGVtZW50KSB7XG4gICAgcmV0dXJuIC0xICE9PSBpbmRleE9mRWxlbWVudChlbGVtZW50cywgZWxlbWVudCk7XG59XG5cbmZ1bmN0aW9uIHB1c2hFbGVtZW50cyhlbGVtZW50cywgdG9BZGQpIHtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdG9BZGQubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYgKCFoYXNFbGVtZW50KGVsZW1lbnRzLCB0b0FkZFtpXSkpIHsgZWxlbWVudHMucHVzaCh0b0FkZFtpXSk7IH1cbiAgICB9XG5cbiAgICByZXR1cm4gdG9BZGQ7XG59XG5cbmZ1bmN0aW9uIGFkZEVsZW1lbnRzKGVsZW1lbnRzKSB7XG4gICAgdmFyIGFyZ3VtZW50cyQxID0gYXJndW1lbnRzO1xuXG4gICAgZm9yICh2YXIgX2xlbjIgPSBhcmd1bWVudHMubGVuZ3RoLCB0b0FkZCA9IEFycmF5KF9sZW4yID4gMSA/IF9sZW4yIC0gMSA6IDApLCBfa2V5MiA9IDE7IF9rZXkyIDwgX2xlbjI7IF9rZXkyKyspIHtcbiAgICAgICAgdG9BZGRbX2tleTIgLSAxXSA9IGFyZ3VtZW50cyQxW19rZXkyXTtcbiAgICB9XG5cbiAgICB0b0FkZCA9IHRvQWRkLm1hcChyZXNvbHZlRWxlbWVudCk7XG4gICAgcmV0dXJuIHB1c2hFbGVtZW50cyhlbGVtZW50cywgdG9BZGQpO1xufVxuXG5mdW5jdGlvbiByZW1vdmVFbGVtZW50cyhlbGVtZW50cykge1xuICAgIHZhciBhcmd1bWVudHMkMSA9IGFyZ3VtZW50cztcblxuICAgIGZvciAodmFyIF9sZW4zID0gYXJndW1lbnRzLmxlbmd0aCwgdG9SZW1vdmUgPSBBcnJheShfbGVuMyA+IDEgPyBfbGVuMyAtIDEgOiAwKSwgX2tleTMgPSAxOyBfa2V5MyA8IF9sZW4zOyBfa2V5MysrKSB7XG4gICAgICAgIHRvUmVtb3ZlW19rZXkzIC0gMV0gPSBhcmd1bWVudHMkMVtfa2V5M107XG4gICAgfVxuXG4gICAgcmV0dXJuIHRvUmVtb3ZlLm1hcChyZXNvbHZlRWxlbWVudCkucmVkdWNlKGZ1bmN0aW9uIChsYXN0LCBlKSB7XG5cbiAgICAgICAgdmFyIGluZGV4JCQxID0gaW5kZXhPZkVsZW1lbnQoZWxlbWVudHMsIGUpO1xuXG4gICAgICAgIGlmIChpbmRleCQkMSAhPT0gLTEpIHsgcmV0dXJuIGxhc3QuY29uY2F0KGVsZW1lbnRzLnNwbGljZShpbmRleCQkMSwgMSkpOyB9XG4gICAgICAgIHJldHVybiBsYXN0O1xuICAgIH0sIFtdKTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZUVsZW1lbnQoZWxlbWVudCwgbm9UaHJvdykge1xuICAgIGlmICh0eXBlb2YgZWxlbWVudCA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHJldHVybiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKGVsZW1lbnQpO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICB0aHJvdyBlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKCFpc0VsZW1lbnQoZWxlbWVudCkgJiYgIW5vVGhyb3cpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihlbGVtZW50ICsgJyBpcyBub3QgYSBET00gZWxlbWVudC4nKTtcbiAgICB9XG4gICAgcmV0dXJuIGVsZW1lbnQ7XG59XG5cbnZhciBpbmRleCQyID0gZnVuY3Rpb24gY3JlYXRlUG9pbnRDQihvYmplY3QsIG9wdGlvbnMpe1xuXG4gICAgLy8gQSBwZXJzaXN0ZW50IG9iamVjdCAoYXMgb3Bwb3NlZCB0byByZXR1cm5lZCBvYmplY3QpIGlzIHVzZWQgdG8gc2F2ZSBtZW1vcnlcbiAgICAvLyBUaGlzIGlzIGdvb2QgdG8gcHJldmVudCBsYXlvdXQgdGhyYXNoaW5nLCBvciBmb3IgZ2FtZXMsIGFuZCBzdWNoXG5cbiAgICAvLyBOT1RFXG4gICAgLy8gVGhpcyB1c2VzIElFIGZpeGVzIHdoaWNoIHNob3VsZCBiZSBPSyB0byByZW1vdmUgc29tZSBkYXkuIDopXG4gICAgLy8gU29tZSBzcGVlZCB3aWxsIGJlIGdhaW5lZCBieSByZW1vdmFsIG9mIHRoZXNlLlxuXG4gICAgLy8gcG9pbnRDQiBzaG91bGQgYmUgc2F2ZWQgaW4gYSB2YXJpYWJsZSBvbiByZXR1cm5cbiAgICAvLyBUaGlzIGFsbG93cyB0aGUgdXNhZ2Ugb2YgZWxlbWVudC5yZW1vdmVFdmVudExpc3RlbmVyXG5cbiAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcblxuICAgIHZhciBhbGxvd1VwZGF0ZTtcblxuICAgIGlmKHR5cGVvZiBvcHRpb25zLmFsbG93VXBkYXRlID09PSAnZnVuY3Rpb24nKXtcbiAgICAgICAgYWxsb3dVcGRhdGUgPSBvcHRpb25zLmFsbG93VXBkYXRlO1xuICAgIH1lbHNle1xuICAgICAgICBhbGxvd1VwZGF0ZSA9IGZ1bmN0aW9uKCl7cmV0dXJuIHRydWU7fTtcbiAgICB9XG5cbiAgICByZXR1cm4gZnVuY3Rpb24gcG9pbnRDQihldmVudCl7XG5cbiAgICAgICAgZXZlbnQgPSBldmVudCB8fCB3aW5kb3cuZXZlbnQ7IC8vIElFLWlzbVxuICAgICAgICBvYmplY3QudGFyZ2V0ID0gZXZlbnQudGFyZ2V0IHx8IGV2ZW50LnNyY0VsZW1lbnQgfHwgZXZlbnQub3JpZ2luYWxUYXJnZXQ7XG4gICAgICAgIG9iamVjdC5lbGVtZW50ID0gdGhpcztcbiAgICAgICAgb2JqZWN0LnR5cGUgPSBldmVudC50eXBlO1xuXG4gICAgICAgIGlmKCFhbGxvd1VwZGF0ZShldmVudCkpe1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gU3VwcG9ydCB0b3VjaFxuICAgICAgICAvLyBodHRwOi8vd3d3LmNyZWF0aXZlYmxvcS5jb20vamF2YXNjcmlwdC9tYWtlLXlvdXItc2l0ZS13b3JrLXRvdWNoLWRldmljZXMtNTE0MTE2NDRcblxuICAgICAgICBpZihldmVudC50YXJnZXRUb3VjaGVzKXtcbiAgICAgICAgICAgIG9iamVjdC54ID0gZXZlbnQudGFyZ2V0VG91Y2hlc1swXS5jbGllbnRYO1xuICAgICAgICAgICAgb2JqZWN0LnkgPSBldmVudC50YXJnZXRUb3VjaGVzWzBdLmNsaWVudFk7XG4gICAgICAgICAgICBvYmplY3QucGFnZVggPSBldmVudC5wYWdlWDtcbiAgICAgICAgICAgIG9iamVjdC5wYWdlWSA9IGV2ZW50LnBhZ2VZO1xuICAgICAgICB9ZWxzZXtcblxuICAgICAgICAgICAgLy8gSWYgcGFnZVgvWSBhcmVuJ3QgYXZhaWxhYmxlIGFuZCBjbGllbnRYL1kgYXJlLFxuICAgICAgICAgICAgLy8gY2FsY3VsYXRlIHBhZ2VYL1kgLSBsb2dpYyB0YWtlbiBmcm9tIGpRdWVyeS5cbiAgICAgICAgICAgIC8vIChUaGlzIGlzIHRvIHN1cHBvcnQgb2xkIElFKVxuICAgICAgICAgICAgLy8gTk9URSBIb3BlZnVsbHkgdGhpcyBjYW4gYmUgcmVtb3ZlZCBzb29uLlxuXG4gICAgICAgICAgICBpZiAoZXZlbnQucGFnZVggPT09IG51bGwgJiYgZXZlbnQuY2xpZW50WCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHZhciBldmVudERvYyA9IChldmVudC50YXJnZXQgJiYgZXZlbnQudGFyZ2V0Lm93bmVyRG9jdW1lbnQpIHx8IGRvY3VtZW50O1xuICAgICAgICAgICAgICAgIHZhciBkb2MgPSBldmVudERvYy5kb2N1bWVudEVsZW1lbnQ7XG4gICAgICAgICAgICAgICAgdmFyIGJvZHkgPSBldmVudERvYy5ib2R5O1xuXG4gICAgICAgICAgICAgICAgb2JqZWN0LnBhZ2VYID0gZXZlbnQuY2xpZW50WCArXG4gICAgICAgICAgICAgICAgICAoZG9jICYmIGRvYy5zY3JvbGxMZWZ0IHx8IGJvZHkgJiYgYm9keS5zY3JvbGxMZWZ0IHx8IDApIC1cbiAgICAgICAgICAgICAgICAgIChkb2MgJiYgZG9jLmNsaWVudExlZnQgfHwgYm9keSAmJiBib2R5LmNsaWVudExlZnQgfHwgMCk7XG4gICAgICAgICAgICAgICAgb2JqZWN0LnBhZ2VZID0gZXZlbnQuY2xpZW50WSArXG4gICAgICAgICAgICAgICAgICAoZG9jICYmIGRvYy5zY3JvbGxUb3AgIHx8IGJvZHkgJiYgYm9keS5zY3JvbGxUb3AgIHx8IDApIC1cbiAgICAgICAgICAgICAgICAgIChkb2MgJiYgZG9jLmNsaWVudFRvcCAgfHwgYm9keSAmJiBib2R5LmNsaWVudFRvcCAgfHwgMCApO1xuICAgICAgICAgICAgfWVsc2V7XG4gICAgICAgICAgICAgICAgb2JqZWN0LnBhZ2VYID0gZXZlbnQucGFnZVg7XG4gICAgICAgICAgICAgICAgb2JqZWN0LnBhZ2VZID0gZXZlbnQucGFnZVk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHBhZ2VYLCBhbmQgcGFnZVkgY2hhbmdlIHdpdGggcGFnZSBzY3JvbGxcbiAgICAgICAgICAgIC8vIHNvIHdlJ3JlIG5vdCBnb2luZyB0byB1c2UgdGhvc2UgZm9yIHgsIGFuZCB5LlxuICAgICAgICAgICAgLy8gTk9URSBNb3N0IGJyb3dzZXJzIGFsc28gYWxpYXMgY2xpZW50WC9ZIHdpdGggeC95XG4gICAgICAgICAgICAvLyBzbyB0aGF0J3Mgc29tZXRoaW5nIHRvIGNvbnNpZGVyIGRvd24gdGhlIHJvYWQuXG5cbiAgICAgICAgICAgIG9iamVjdC54ID0gZXZlbnQuY2xpZW50WDtcbiAgICAgICAgICAgIG9iamVjdC55ID0gZXZlbnQuY2xpZW50WTtcbiAgICAgICAgfVxuXG4gICAgfTtcblxuICAgIC8vTk9URSBSZW1lbWJlciBhY2Nlc3NpYmlsaXR5LCBBcmlhIHJvbGVzLCBhbmQgbGFiZWxzLlxufTtcblxuZnVuY3Rpb24gY3JlYXRlV2luZG93UmVjdCgpIHtcbiAgICB2YXIgcHJvcHMgPSB7XG4gICAgICAgIHRvcDogeyB2YWx1ZTogMCwgZW51bWVyYWJsZTogdHJ1ZSB9LFxuICAgICAgICBsZWZ0OiB7IHZhbHVlOiAwLCBlbnVtZXJhYmxlOiB0cnVlIH0sXG4gICAgICAgIHJpZ2h0OiB7IHZhbHVlOiB3aW5kb3cuaW5uZXJXaWR0aCwgZW51bWVyYWJsZTogdHJ1ZSB9LFxuICAgICAgICBib3R0b206IHsgdmFsdWU6IHdpbmRvdy5pbm5lckhlaWdodCwgZW51bWVyYWJsZTogdHJ1ZSB9LFxuICAgICAgICB3aWR0aDogeyB2YWx1ZTogd2luZG93LmlubmVyV2lkdGgsIGVudW1lcmFibGU6IHRydWUgfSxcbiAgICAgICAgaGVpZ2h0OiB7IHZhbHVlOiB3aW5kb3cuaW5uZXJIZWlnaHQsIGVudW1lcmFibGU6IHRydWUgfSxcbiAgICAgICAgeDogeyB2YWx1ZTogMCwgZW51bWVyYWJsZTogdHJ1ZSB9LFxuICAgICAgICB5OiB7IHZhbHVlOiAwLCBlbnVtZXJhYmxlOiB0cnVlIH1cbiAgICB9O1xuXG4gICAgaWYgKE9iamVjdC5jcmVhdGUpIHtcbiAgICAgICAgcmV0dXJuIE9iamVjdC5jcmVhdGUoe30sIHByb3BzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgcmVjdCA9IHt9O1xuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyhyZWN0LCBwcm9wcyk7XG4gICAgICAgIHJldHVybiByZWN0O1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZ2V0Q2xpZW50UmVjdChlbCkge1xuICAgIGlmIChlbCA9PT0gd2luZG93KSB7XG4gICAgICAgIHJldHVybiBjcmVhdGVXaW5kb3dSZWN0KCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHZhciByZWN0ID0gZWwuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgICAgICAgICBpZiAocmVjdC54ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICByZWN0LnggPSByZWN0LmxlZnQ7XG4gICAgICAgICAgICAgICAgcmVjdC55ID0gcmVjdC50b3A7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gcmVjdDtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbid0IGNhbGwgZ2V0Qm91bmRpbmdDbGllbnRSZWN0IG9uIFwiICsgZWwpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5mdW5jdGlvbiBwb2ludEluc2lkZShwb2ludCwgZWwpIHtcbiAgICB2YXIgcmVjdCA9IGdldENsaWVudFJlY3QoZWwpO1xuICAgIHJldHVybiBwb2ludC55ID4gcmVjdC50b3AgJiYgcG9pbnQueSA8IHJlY3QuYm90dG9tICYmIHBvaW50LnggPiByZWN0LmxlZnQgJiYgcG9pbnQueCA8IHJlY3QucmlnaHQ7XG59XG5cbnZhciBvYmplY3RDcmVhdGUgPSB2b2lkIDA7XG5pZiAodHlwZW9mIE9iamVjdC5jcmVhdGUgIT0gJ2Z1bmN0aW9uJykge1xuICBvYmplY3RDcmVhdGUgPSBmdW5jdGlvbiAodW5kZWZpbmVkKSB7XG4gICAgdmFyIFRlbXAgPSBmdW5jdGlvbiBUZW1wKCkge307XG4gICAgcmV0dXJuIGZ1bmN0aW9uIChwcm90b3R5cGUsIHByb3BlcnRpZXNPYmplY3QpIHtcbiAgICAgIGlmIChwcm90b3R5cGUgIT09IE9iamVjdChwcm90b3R5cGUpICYmIHByb3RvdHlwZSAhPT0gbnVsbCkge1xuICAgICAgICB0aHJvdyBUeXBlRXJyb3IoJ0FyZ3VtZW50IG11c3QgYmUgYW4gb2JqZWN0LCBvciBudWxsJyk7XG4gICAgICB9XG4gICAgICBUZW1wLnByb3RvdHlwZSA9IHByb3RvdHlwZSB8fCB7fTtcbiAgICAgIHZhciByZXN1bHQgPSBuZXcgVGVtcCgpO1xuICAgICAgVGVtcC5wcm90b3R5cGUgPSBudWxsO1xuICAgICAgaWYgKHByb3BlcnRpZXNPYmplY3QgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyhyZXN1bHQsIHByb3BlcnRpZXNPYmplY3QpO1xuICAgICAgfVxuXG4gICAgICAvLyB0byBpbWl0YXRlIHRoZSBjYXNlIG9mIE9iamVjdC5jcmVhdGUobnVsbClcbiAgICAgIGlmIChwcm90b3R5cGUgPT09IG51bGwpIHtcbiAgICAgICAgcmVzdWx0Ll9fcHJvdG9fXyA9IG51bGw7XG4gICAgICB9XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH07XG4gIH0oKTtcbn0gZWxzZSB7XG4gIG9iamVjdENyZWF0ZSA9IE9iamVjdC5jcmVhdGU7XG59XG5cbnZhciBvYmplY3RDcmVhdGUkMSA9IG9iamVjdENyZWF0ZTtcblxudmFyIG1vdXNlRXZlbnRQcm9wcyA9IFsnYWx0S2V5JywgJ2J1dHRvbicsICdidXR0b25zJywgJ2NsaWVudFgnLCAnY2xpZW50WScsICdjdHJsS2V5JywgJ21ldGFLZXknLCAnbW92ZW1lbnRYJywgJ21vdmVtZW50WScsICdvZmZzZXRYJywgJ29mZnNldFknLCAncGFnZVgnLCAncGFnZVknLCAncmVnaW9uJywgJ3JlbGF0ZWRUYXJnZXQnLCAnc2NyZWVuWCcsICdzY3JlZW5ZJywgJ3NoaWZ0S2V5JywgJ3doaWNoJywgJ3gnLCAneSddO1xuXG5mdW5jdGlvbiBjcmVhdGVEaXNwYXRjaGVyKGVsZW1lbnQpIHtcblxuICAgIHZhciBkZWZhdWx0U2V0dGluZ3MgPSB7XG4gICAgICAgIHNjcmVlblg6IDAsXG4gICAgICAgIHNjcmVlblk6IDAsXG4gICAgICAgIGNsaWVudFg6IDAsXG4gICAgICAgIGNsaWVudFk6IDAsXG4gICAgICAgIGN0cmxLZXk6IGZhbHNlLFxuICAgICAgICBzaGlmdEtleTogZmFsc2UsXG4gICAgICAgIGFsdEtleTogZmFsc2UsXG4gICAgICAgIG1ldGFLZXk6IGZhbHNlLFxuICAgICAgICBidXR0b246IDAsXG4gICAgICAgIGJ1dHRvbnM6IDEsXG4gICAgICAgIHJlbGF0ZWRUYXJnZXQ6IG51bGwsXG4gICAgICAgIHJlZ2lvbjogbnVsbFxuICAgIH07XG5cbiAgICBpZiAoZWxlbWVudCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgb25Nb3ZlKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBvbk1vdmUoZSkge1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG1vdXNlRXZlbnRQcm9wcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgZGVmYXVsdFNldHRpbmdzW21vdXNlRXZlbnRQcm9wc1tpXV0gPSBlW21vdXNlRXZlbnRQcm9wc1tpXV07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgZGlzcGF0Y2ggPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmIChNb3VzZUV2ZW50KSB7XG4gICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24gbTEoZWxlbWVudCwgaW5pdE1vdmUsIGRhdGEpIHtcbiAgICAgICAgICAgICAgICB2YXIgZXZ0ID0gbmV3IE1vdXNlRXZlbnQoJ21vdXNlbW92ZScsIGNyZWF0ZU1vdmVJbml0KGRlZmF1bHRTZXR0aW5ncywgaW5pdE1vdmUpKTtcblxuICAgICAgICAgICAgICAgIC8vZXZ0LmRpc3BhdGNoZWQgPSAnbW91c2Vtb3ZlJztcbiAgICAgICAgICAgICAgICBzZXRTcGVjaWFsKGV2dCwgZGF0YSk7XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gZWxlbWVudC5kaXNwYXRjaEV2ZW50KGV2dCk7XG4gICAgICAgICAgICB9O1xuICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBkb2N1bWVudC5jcmVhdGVFdmVudCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIG0yKGVsZW1lbnQsIGluaXRNb3ZlLCBkYXRhKSB7XG4gICAgICAgICAgICAgICAgdmFyIHNldHRpbmdzID0gY3JlYXRlTW92ZUluaXQoZGVmYXVsdFNldHRpbmdzLCBpbml0TW92ZSk7XG4gICAgICAgICAgICAgICAgdmFyIGV2dCA9IGRvY3VtZW50LmNyZWF0ZUV2ZW50KCdNb3VzZUV2ZW50cycpO1xuXG4gICAgICAgICAgICAgICAgZXZ0LmluaXRNb3VzZUV2ZW50KFwibW91c2Vtb3ZlXCIsIHRydWUsIC8vY2FuIGJ1YmJsZVxuICAgICAgICAgICAgICAgIHRydWUsIC8vY2FuY2VsYWJsZVxuICAgICAgICAgICAgICAgIHdpbmRvdywgLy92aWV3XG4gICAgICAgICAgICAgICAgMCwgLy9kZXRhaWxcbiAgICAgICAgICAgICAgICBzZXR0aW5ncy5zY3JlZW5YLCAvLzAsIC8vc2NyZWVuWFxuICAgICAgICAgICAgICAgIHNldHRpbmdzLnNjcmVlblksIC8vMCwgLy9zY3JlZW5ZXG4gICAgICAgICAgICAgICAgc2V0dGluZ3MuY2xpZW50WCwgLy84MCwgLy9jbGllbnRYXG4gICAgICAgICAgICAgICAgc2V0dGluZ3MuY2xpZW50WSwgLy8yMCwgLy9jbGllbnRZXG4gICAgICAgICAgICAgICAgc2V0dGluZ3MuY3RybEtleSwgLy9mYWxzZSwgLy9jdHJsS2V5XG4gICAgICAgICAgICAgICAgc2V0dGluZ3MuYWx0S2V5LCAvL2ZhbHNlLCAvL2FsdEtleVxuICAgICAgICAgICAgICAgIHNldHRpbmdzLnNoaWZ0S2V5LCAvL2ZhbHNlLCAvL3NoaWZ0S2V5XG4gICAgICAgICAgICAgICAgc2V0dGluZ3MubWV0YUtleSwgLy9mYWxzZSwgLy9tZXRhS2V5XG4gICAgICAgICAgICAgICAgc2V0dGluZ3MuYnV0dG9uLCAvLzAsIC8vYnV0dG9uXG4gICAgICAgICAgICAgICAgc2V0dGluZ3MucmVsYXRlZFRhcmdldCAvL251bGwgLy9yZWxhdGVkVGFyZ2V0XG4gICAgICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgICAgIC8vZXZ0LmRpc3BhdGNoZWQgPSAnbW91c2Vtb3ZlJztcbiAgICAgICAgICAgICAgICBzZXRTcGVjaWFsKGV2dCwgZGF0YSk7XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gZWxlbWVudC5kaXNwYXRjaEV2ZW50KGV2dCk7XG4gICAgICAgICAgICB9O1xuICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBkb2N1bWVudC5jcmVhdGVFdmVudE9iamVjdCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIG0zKGVsZW1lbnQsIGluaXRNb3ZlLCBkYXRhKSB7XG4gICAgICAgICAgICAgICAgdmFyIGV2dCA9IGRvY3VtZW50LmNyZWF0ZUV2ZW50T2JqZWN0KCk7XG4gICAgICAgICAgICAgICAgdmFyIHNldHRpbmdzID0gY3JlYXRlTW92ZUluaXQoZGVmYXVsdFNldHRpbmdzLCBpbml0TW92ZSk7XG4gICAgICAgICAgICAgICAgZm9yICh2YXIgbmFtZSBpbiBzZXR0aW5ncykge1xuICAgICAgICAgICAgICAgICAgICBldnRbbmFtZV0gPSBzZXR0aW5nc1tuYW1lXTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvL2V2dC5kaXNwYXRjaGVkID0gJ21vdXNlbW92ZSc7XG4gICAgICAgICAgICAgICAgc2V0U3BlY2lhbChldnQsIGRhdGEpO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIGVsZW1lbnQuZGlzcGF0Y2hFdmVudChldnQpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgIH0oKTtcblxuICAgIGZ1bmN0aW9uIGRlc3Ryb3koKSB7XG4gICAgICAgIGlmIChlbGVtZW50KSB7IGVsZW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgb25Nb3ZlLCBmYWxzZSk7IH1cbiAgICAgICAgZGVmYXVsdFNldHRpbmdzID0gbnVsbDtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBkZXN0cm95OiBkZXN0cm95LFxuICAgICAgICBkaXNwYXRjaDogZGlzcGF0Y2hcbiAgICB9O1xufVxuXG5mdW5jdGlvbiBjcmVhdGVNb3ZlSW5pdChkZWZhdWx0U2V0dGluZ3MsIGluaXRNb3ZlKSB7XG4gICAgaW5pdE1vdmUgPSBpbml0TW92ZSB8fCB7fTtcbiAgICB2YXIgc2V0dGluZ3MgPSBvYmplY3RDcmVhdGUkMShkZWZhdWx0U2V0dGluZ3MpO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbW91c2VFdmVudFByb3BzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmIChpbml0TW92ZVttb3VzZUV2ZW50UHJvcHNbaV1dICE9PSB1bmRlZmluZWQpIHsgc2V0dGluZ3NbbW91c2VFdmVudFByb3BzW2ldXSA9IGluaXRNb3ZlW21vdXNlRXZlbnRQcm9wc1tpXV07IH1cbiAgICB9XG5cbiAgICByZXR1cm4gc2V0dGluZ3M7XG59XG5cbmZ1bmN0aW9uIHNldFNwZWNpYWwoZSwgZGF0YSkge1xuICAgIGNvbnNvbGUubG9nKCdkYXRhICcsIGRhdGEpO1xuICAgIGUuZGF0YSA9IGRhdGEgfHwge307XG4gICAgZS5kaXNwYXRjaGVkID0gJ21vdXNlbW92ZSc7XG59XG5cbmZ1bmN0aW9uIEF1dG9TY3JvbGxlcihlbGVtZW50cywgb3B0aW9ucyl7XG4gICAgaWYgKCBvcHRpb25zID09PSB2b2lkIDAgKSBvcHRpb25zID0ge307XG5cbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIG1heFNwZWVkID0gNCwgc2Nyb2xsaW5nID0gZmFsc2U7XG5cbiAgICB0aGlzLm1hcmdpbiA9IG9wdGlvbnMubWFyZ2luIHx8IC0xO1xuICAgIC8vdGhpcy5zY3JvbGxpbmcgPSBmYWxzZTtcbiAgICB0aGlzLnNjcm9sbFdoZW5PdXRzaWRlID0gb3B0aW9ucy5zY3JvbGxXaGVuT3V0c2lkZSB8fCBmYWxzZTtcblxuICAgIHZhciBwb2ludCA9IHt9LFxuICAgICAgICBwb2ludENCID0gaW5kZXgkMihwb2ludCksXG4gICAgICAgIGRpc3BhdGNoZXIgPSBjcmVhdGVEaXNwYXRjaGVyKCksXG4gICAgICAgIGRvd24gPSBmYWxzZTtcblxuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCBwb2ludENCLCBmYWxzZSk7XG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNobW92ZScsIHBvaW50Q0IsIGZhbHNlKTtcblxuICAgIGlmKCFpc05hTihvcHRpb25zLm1heFNwZWVkKSl7XG4gICAgICAgIG1heFNwZWVkID0gb3B0aW9ucy5tYXhTcGVlZDtcbiAgICB9XG5cbiAgICB0aGlzLmF1dG9TY3JvbGwgPSBib29sZWFuKG9wdGlvbnMuYXV0b1Njcm9sbCk7XG4gICAgdGhpcy5zeW5jTW92ZSA9IGJvb2xlYW4ob3B0aW9ucy5zeW5jTW92ZSwgZmFsc2UpO1xuXG4gICAgdGhpcy5kZXN0cm95ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCBwb2ludENCLCBmYWxzZSk7XG4gICAgICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCd0b3VjaG1vdmUnLCBwb2ludENCLCBmYWxzZSk7XG4gICAgICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZWRvd24nLCBvbkRvd24sIGZhbHNlKTtcbiAgICAgICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3RvdWNoc3RhcnQnLCBvbkRvd24sIGZhbHNlKTtcbiAgICAgICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCBvblVwLCBmYWxzZSk7XG4gICAgICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCd0b3VjaGVuZCcsIG9uVXAsIGZhbHNlKTtcblxuICAgICAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgb25Nb3ZlLCBmYWxzZSk7XG4gICAgICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCd0b3VjaG1vdmUnLCBvbk1vdmUsIGZhbHNlKTtcblxuICAgICAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcignc2Nyb2xsJywgc2V0U2Nyb2xsLCB0cnVlKTtcbiAgICAgICAgZWxlbWVudHMgPSBbXTtcbiAgICB9O1xuXG4gICAgdGhpcy5hZGQgPSBmdW5jdGlvbigpe1xuICAgICAgICB2YXIgZWxlbWVudCA9IFtdLCBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgICAgICB3aGlsZSAoIGxlbi0tICkgZWxlbWVudFsgbGVuIF0gPSBhcmd1bWVudHNbIGxlbiBdO1xuXG4gICAgICAgIGFkZEVsZW1lbnRzLmFwcGx5KHZvaWQgMCwgWyBlbGVtZW50cyBdLmNvbmNhdCggZWxlbWVudCApKTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfTtcblxuICAgIHRoaXMucmVtb3ZlID0gZnVuY3Rpb24oKXtcbiAgICAgICAgdmFyIGVsZW1lbnQgPSBbXSwgbGVuID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICAgICAgd2hpbGUgKCBsZW4tLSApIGVsZW1lbnRbIGxlbiBdID0gYXJndW1lbnRzWyBsZW4gXTtcblxuICAgICAgICByZXR1cm4gcmVtb3ZlRWxlbWVudHMuYXBwbHkodm9pZCAwLCBbIGVsZW1lbnRzIF0uY29uY2F0KCBlbGVtZW50ICkpO1xuICAgIH07XG5cbiAgICB2YXIgaGFzV2luZG93ID0gbnVsbCwgd2luZG93QW5pbWF0aW9uRnJhbWU7XG5cbiAgICBpZihPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoZWxlbWVudHMpICE9PSAnW29iamVjdCBBcnJheV0nKXtcbiAgICAgICAgZWxlbWVudHMgPSBbZWxlbWVudHNdO1xuICAgIH1cblxuICAgIChmdW5jdGlvbih0ZW1wKXtcbiAgICAgICAgZWxlbWVudHMgPSBbXTtcbiAgICAgICAgdGVtcC5mb3JFYWNoKGZ1bmN0aW9uKGVsZW1lbnQpe1xuICAgICAgICAgICAgaWYoZWxlbWVudCA9PT0gd2luZG93KXtcbiAgICAgICAgICAgICAgICBoYXNXaW5kb3cgPSB3aW5kb3c7XG4gICAgICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAgICAgICBzZWxmLmFkZChlbGVtZW50KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfShlbGVtZW50cykpO1xuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnRpZXModGhpcywge1xuICAgICAgICBkb3duOiB7XG4gICAgICAgICAgICBnZXQ6IGZ1bmN0aW9uKCl7IHJldHVybiBkb3duOyB9XG4gICAgICAgIH0sXG4gICAgICAgIG1heFNwZWVkOiB7XG4gICAgICAgICAgICBnZXQ6IGZ1bmN0aW9uKCl7IHJldHVybiBtYXhTcGVlZDsgfVxuICAgICAgICB9LFxuICAgICAgICBwb2ludDoge1xuICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbigpeyByZXR1cm4gcG9pbnQ7IH1cbiAgICAgICAgfSxcbiAgICAgICAgc2Nyb2xsaW5nOiB7XG4gICAgICAgICAgICBnZXQ6IGZ1bmN0aW9uKCl7IHJldHVybiBzY3JvbGxpbmc7IH1cbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgdmFyIG4gPSAwLCBjdXJyZW50ID0gbnVsbCwgYW5pbWF0aW9uRnJhbWU7XG5cbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vkb3duJywgb25Eb3duLCBmYWxzZSk7XG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNoc3RhcnQnLCBvbkRvd24sIGZhbHNlKTtcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIG9uVXAsIGZhbHNlKTtcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2hlbmQnLCBvblVwLCBmYWxzZSk7XG5cbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgb25Nb3ZlLCBmYWxzZSk7XG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNobW92ZScsIG9uTW92ZSwgZmFsc2UpO1xuXG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlbGVhdmUnLCBvbk1vdXNlT3V0LCBmYWxzZSk7XG5cbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignc2Nyb2xsJywgc2V0U2Nyb2xsLCB0cnVlKTtcblxuICAgIGZ1bmN0aW9uIHNldFNjcm9sbChlKXtcblxuICAgICAgICBmb3IodmFyIGk9MDsgaTxlbGVtZW50cy5sZW5ndGg7IGkrKyl7XG4gICAgICAgICAgICBpZihlbGVtZW50c1tpXSA9PT0gZS50YXJnZXQpe1xuICAgICAgICAgICAgICAgIHNjcm9sbGluZyA9IHRydWU7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZihzY3JvbGxpbmcpe1xuICAgICAgICAgICAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKGZ1bmN0aW9uICgpeyByZXR1cm4gc2Nyb2xsaW5nID0gZmFsc2U7IH0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gb25Eb3duKCl7XG4gICAgICAgIGRvd24gPSB0cnVlO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIG9uVXAoKXtcbiAgICAgICAgZG93biA9IGZhbHNlO1xuICAgICAgICBjYW5jZWxBbmltYXRpb25GcmFtZShhbmltYXRpb25GcmFtZSk7XG4gICAgICAgIGNhbmNlbEFuaW1hdGlvbkZyYW1lKHdpbmRvd0FuaW1hdGlvbkZyYW1lKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBvbk1vdXNlT3V0KCl7XG4gICAgICAgIGRvd24gPSBmYWxzZTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZXRUYXJnZXQodGFyZ2V0KXtcbiAgICAgICAgaWYoIXRhcmdldCl7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKGN1cnJlbnQgPT09IHRhcmdldCl7XG4gICAgICAgICAgICByZXR1cm4gdGFyZ2V0O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYoaGFzRWxlbWVudChlbGVtZW50cywgdGFyZ2V0KSl7XG4gICAgICAgICAgICByZXR1cm4gdGFyZ2V0O1xuICAgICAgICB9XG5cbiAgICAgICAgd2hpbGUodGFyZ2V0ID0gdGFyZ2V0LnBhcmVudE5vZGUpe1xuICAgICAgICAgICAgaWYoaGFzRWxlbWVudChlbGVtZW50cywgdGFyZ2V0KSl7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRhcmdldDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGdldEVsZW1lbnRVbmRlclBvaW50KCl7XG4gICAgICAgIHZhciB1bmRlclBvaW50ID0gbnVsbDtcblxuICAgICAgICBmb3IodmFyIGk9MDsgaTxlbGVtZW50cy5sZW5ndGg7IGkrKyl7XG4gICAgICAgICAgICBpZihpbnNpZGUocG9pbnQsIGVsZW1lbnRzW2ldKSl7XG4gICAgICAgICAgICAgICAgdW5kZXJQb2ludCA9IGVsZW1lbnRzW2ldO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHVuZGVyUG9pbnQ7XG4gICAgfVxuXG5cbiAgICBmdW5jdGlvbiBvbk1vdmUoZXZlbnQpe1xuXG4gICAgICAgIGlmKCFzZWxmLmF1dG9TY3JvbGwoKSkgeyByZXR1cm47IH1cblxuICAgICAgICBpZihldmVudFsnZGlzcGF0Y2hlZCddKXsgcmV0dXJuOyB9XG5cbiAgICAgICAgdmFyIHRhcmdldCA9IGV2ZW50LnRhcmdldCwgYm9keSA9IGRvY3VtZW50LmJvZHk7XG5cbiAgICAgICAgaWYoY3VycmVudCAmJiAhaW5zaWRlKHBvaW50LCBjdXJyZW50KSl7XG4gICAgICAgICAgICBpZighc2VsZi5zY3JvbGxXaGVuT3V0c2lkZSl7XG4gICAgICAgICAgICAgICAgY3VycmVudCA9IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZih0YXJnZXQgJiYgdGFyZ2V0LnBhcmVudE5vZGUgPT09IGJvZHkpe1xuICAgICAgICAgICAgLy9UaGUgc3BlY2lhbCBjb25kaXRpb24gdG8gaW1wcm92ZSBzcGVlZC5cbiAgICAgICAgICAgIHRhcmdldCA9IGdldEVsZW1lbnRVbmRlclBvaW50KCk7XG4gICAgICAgIH1lbHNle1xuICAgICAgICAgICAgdGFyZ2V0ID0gZ2V0VGFyZ2V0KHRhcmdldCk7XG5cbiAgICAgICAgICAgIGlmKCF0YXJnZXQpe1xuICAgICAgICAgICAgICAgIHRhcmdldCA9IGdldEVsZW1lbnRVbmRlclBvaW50KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuXG4gICAgICAgIGlmKHRhcmdldCAmJiB0YXJnZXQgIT09IGN1cnJlbnQpe1xuICAgICAgICAgICAgY3VycmVudCA9IHRhcmdldDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKGhhc1dpbmRvdyl7XG4gICAgICAgICAgICBjYW5jZWxBbmltYXRpb25GcmFtZSh3aW5kb3dBbmltYXRpb25GcmFtZSk7XG4gICAgICAgICAgICB3aW5kb3dBbmltYXRpb25GcmFtZSA9IHJlcXVlc3RBbmltYXRpb25GcmFtZShzY3JvbGxXaW5kb3cpO1xuICAgICAgICB9XG5cblxuICAgICAgICBpZighY3VycmVudCl7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjYW5jZWxBbmltYXRpb25GcmFtZShhbmltYXRpb25GcmFtZSk7XG4gICAgICAgIGFuaW1hdGlvbkZyYW1lID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKHNjcm9sbFRpY2spO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHNjcm9sbFdpbmRvdygpe1xuICAgICAgICBhdXRvU2Nyb2xsKGhhc1dpbmRvdyk7XG5cbiAgICAgICAgY2FuY2VsQW5pbWF0aW9uRnJhbWUod2luZG93QW5pbWF0aW9uRnJhbWUpO1xuICAgICAgICB3aW5kb3dBbmltYXRpb25GcmFtZSA9IHJlcXVlc3RBbmltYXRpb25GcmFtZShzY3JvbGxXaW5kb3cpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHNjcm9sbFRpY2soKXtcblxuICAgICAgICBpZighY3VycmVudCl7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBhdXRvU2Nyb2xsKGN1cnJlbnQpO1xuXG4gICAgICAgIGNhbmNlbEFuaW1hdGlvbkZyYW1lKGFuaW1hdGlvbkZyYW1lKTtcbiAgICAgICAgYW5pbWF0aW9uRnJhbWUgPSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoc2Nyb2xsVGljayk7XG5cbiAgICB9XG5cblxuICAgIGZ1bmN0aW9uIGF1dG9TY3JvbGwoZWwpe1xuICAgICAgICB2YXIgcmVjdCA9IGdldENsaWVudFJlY3QoZWwpLCBzY3JvbGx4LCBzY3JvbGx5O1xuXG4gICAgICAgIGlmKHBvaW50LnggPCByZWN0LmxlZnQgKyBzZWxmLm1hcmdpbil7XG4gICAgICAgICAgICBzY3JvbGx4ID0gTWF0aC5mbG9vcihcbiAgICAgICAgICAgICAgICBNYXRoLm1heCgtMSwgKHBvaW50LnggLSByZWN0LmxlZnQpIC8gc2VsZi5tYXJnaW4gLSAxKSAqIHNlbGYubWF4U3BlZWRcbiAgICAgICAgICAgICk7XG4gICAgICAgIH1lbHNlIGlmKHBvaW50LnggPiByZWN0LnJpZ2h0IC0gc2VsZi5tYXJnaW4pe1xuICAgICAgICAgICAgc2Nyb2xseCA9IE1hdGguY2VpbChcbiAgICAgICAgICAgICAgICBNYXRoLm1pbigxLCAocG9pbnQueCAtIHJlY3QucmlnaHQpIC8gc2VsZi5tYXJnaW4gKyAxKSAqIHNlbGYubWF4U3BlZWRcbiAgICAgICAgICAgICk7XG4gICAgICAgIH1lbHNle1xuICAgICAgICAgICAgc2Nyb2xseCA9IDA7XG4gICAgICAgIH1cblxuICAgICAgICBpZihwb2ludC55IDwgcmVjdC50b3AgKyBzZWxmLm1hcmdpbil7XG4gICAgICAgICAgICBzY3JvbGx5ID0gTWF0aC5mbG9vcihcbiAgICAgICAgICAgICAgICBNYXRoLm1heCgtMSwgKHBvaW50LnkgLSByZWN0LnRvcCkgLyBzZWxmLm1hcmdpbiAtIDEpICogc2VsZi5tYXhTcGVlZFxuICAgICAgICAgICAgKTtcbiAgICAgICAgfWVsc2UgaWYocG9pbnQueSA+IHJlY3QuYm90dG9tIC0gc2VsZi5tYXJnaW4pe1xuICAgICAgICAgICAgc2Nyb2xseSA9IE1hdGguY2VpbChcbiAgICAgICAgICAgICAgICBNYXRoLm1pbigxLCAocG9pbnQueSAtIHJlY3QuYm90dG9tKSAvIHNlbGYubWFyZ2luICsgMSkgKiBzZWxmLm1heFNwZWVkXG4gICAgICAgICAgICApO1xuICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAgIHNjcm9sbHkgPSAwO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYoc2VsZi5zeW5jTW92ZSgpKXtcbiAgICAgICAgICAgIC8qXG4gICAgICAgICAgICBOb3RlcyBhYm91dCBtb3VzZW1vdmUgZXZlbnQgZGlzcGF0Y2guXG4gICAgICAgICAgICBzY3JlZW4oWC9ZKSBzaG91bGQgbmVlZCB0byBiZSB1cGRhdGVkLlxuICAgICAgICAgICAgU29tZSBvdGhlciBwcm9wZXJ0aWVzIG1pZ2h0IG5lZWQgdG8gYmUgc2V0LlxuICAgICAgICAgICAgS2VlcCB0aGUgc3luY01vdmUgb3B0aW9uIGRlZmF1bHQgZmFsc2UgdW50aWwgYWxsIGluY29uc2lzdGVuY2llcyBhcmUgdGFrZW4gY2FyZSBvZi5cbiAgICAgICAgICAgICovXG4gICAgICAgICAgICBkaXNwYXRjaGVyLmRpc3BhdGNoKGVsLCB7XG4gICAgICAgICAgICAgICAgcGFnZVg6IHBvaW50LnBhZ2VYICsgc2Nyb2xseCxcbiAgICAgICAgICAgICAgICBwYWdlWTogcG9pbnQucGFnZVkgKyBzY3JvbGx5LFxuICAgICAgICAgICAgICAgIGNsaWVudFg6IHBvaW50LnggKyBzY3JvbGx4LFxuICAgICAgICAgICAgICAgIGNsaWVudFk6IHBvaW50LnkgKyBzY3JvbGx5XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24gKCl7XG5cbiAgICAgICAgICAgIGlmKHNjcm9sbHkpe1xuICAgICAgICAgICAgICAgIHNjcm9sbFkoZWwsIHNjcm9sbHkpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZihzY3JvbGx4KXtcbiAgICAgICAgICAgICAgICBzY3JvbGxYKGVsLCBzY3JvbGx4KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBzY3JvbGxZKGVsLCBhbW91bnQpe1xuICAgICAgICBpZihlbCA9PT0gd2luZG93KXtcbiAgICAgICAgICAgIHdpbmRvdy5zY3JvbGxUbyhlbC5wYWdlWE9mZnNldCwgZWwucGFnZVlPZmZzZXQgKyBhbW91bnQpO1xuICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAgIGVsLnNjcm9sbFRvcCArPSBhbW91bnQ7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBzY3JvbGxYKGVsLCBhbW91bnQpe1xuICAgICAgICBpZihlbCA9PT0gd2luZG93KXtcbiAgICAgICAgICAgIHdpbmRvdy5zY3JvbGxUbyhlbC5wYWdlWE9mZnNldCArIGFtb3VudCwgZWwucGFnZVlPZmZzZXQpO1xuICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAgIGVsLnNjcm9sbExlZnQgKz0gYW1vdW50O1xuICAgICAgICB9XG4gICAgfVxuXG59XG5cbmZ1bmN0aW9uIEF1dG9TY3JvbGxlckZhY3RvcnkoZWxlbWVudCwgb3B0aW9ucyl7XG4gICAgcmV0dXJuIG5ldyBBdXRvU2Nyb2xsZXIoZWxlbWVudCwgb3B0aW9ucyk7XG59XG5cbmZ1bmN0aW9uIGluc2lkZShwb2ludCwgZWwsIHJlY3Qpe1xuICAgIGlmKCFyZWN0KXtcbiAgICAgICAgcmV0dXJuIHBvaW50SW5zaWRlKHBvaW50LCBlbCk7XG4gICAgfWVsc2V7XG4gICAgICAgIHJldHVybiAocG9pbnQueSA+IHJlY3QudG9wICYmIHBvaW50LnkgPCByZWN0LmJvdHRvbSAmJlxuICAgICAgICAgICAgICAgIHBvaW50LnggPiByZWN0LmxlZnQgJiYgcG9pbnQueCA8IHJlY3QucmlnaHQpO1xuICAgIH1cbn1cblxuLypcbmdpdCByZW1vdGUgYWRkIG9yaWdpbiBodHRwczovL2dpdGh1Yi5jb20vaG9sbG93ZG9vci9kb21fYXV0b3Njcm9sbGVyLmdpdFxuZ2l0IHB1c2ggLXUgb3JpZ2luIG1hc3RlclxuKi9cblxucmV0dXJuIEF1dG9TY3JvbGxlckZhY3Rvcnk7XG5cbn0oKSk7XG4vLyMgc291cmNlTWFwcGluZ1VSTD1kb20tYXV0b3Njcm9sbGVyLmpzLm1hcFxuIiwiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIndXNlIHN0cmljdCc7XG5cbnZhciBjYWNoZSA9IHt9O1xudmFyIHN0YXJ0ID0gJyg/Ol58XFxcXHMpJztcbnZhciBlbmQgPSAnKD86XFxcXHN8JCknO1xuXG5mdW5jdGlvbiBsb29rdXBDbGFzcyAoY2xhc3NOYW1lKSB7XG4gIHZhciBjYWNoZWQgPSBjYWNoZVtjbGFzc05hbWVdO1xuICBpZiAoY2FjaGVkKSB7XG4gICAgY2FjaGVkLmxhc3RJbmRleCA9IDA7XG4gIH0gZWxzZSB7XG4gICAgY2FjaGVbY2xhc3NOYW1lXSA9IGNhY2hlZCA9IG5ldyBSZWdFeHAoc3RhcnQgKyBjbGFzc05hbWUgKyBlbmQsICdnJyk7XG4gIH1cbiAgcmV0dXJuIGNhY2hlZDtcbn1cblxuZnVuY3Rpb24gYWRkQ2xhc3MgKGVsLCBjbGFzc05hbWUpIHtcbiAgdmFyIGN1cnJlbnQgPSBlbC5jbGFzc05hbWU7XG4gIGlmICghY3VycmVudC5sZW5ndGgpIHtcbiAgICBlbC5jbGFzc05hbWUgPSBjbGFzc05hbWU7XG4gIH0gZWxzZSBpZiAoIWxvb2t1cENsYXNzKGNsYXNzTmFtZSkudGVzdChjdXJyZW50KSkge1xuICAgIGVsLmNsYXNzTmFtZSArPSAnICcgKyBjbGFzc05hbWU7XG4gIH1cbn1cblxuZnVuY3Rpb24gcm1DbGFzcyAoZWwsIGNsYXNzTmFtZSkge1xuICBlbC5jbGFzc05hbWUgPSBlbC5jbGFzc05hbWUucmVwbGFjZShsb29rdXBDbGFzcyhjbGFzc05hbWUpLCAnICcpLnRyaW0oKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIGFkZDogYWRkQ2xhc3MsXG4gIHJtOiBybUNsYXNzXG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgZW1pdHRlciA9IHJlcXVpcmUoJ2NvbnRyYS9lbWl0dGVyJyk7XG52YXIgY3Jvc3N2ZW50ID0gcmVxdWlyZSgnY3Jvc3N2ZW50Jyk7XG52YXIgY2xhc3NlcyA9IHJlcXVpcmUoJy4vY2xhc3NlcycpO1xudmFyIGRvYyA9IGRvY3VtZW50O1xudmFyIGRvY3VtZW50RWxlbWVudCA9IGRvYy5kb2N1bWVudEVsZW1lbnQ7XG5cbmZ1bmN0aW9uIGRyYWd1bGEgKGluaXRpYWxDb250YWluZXJzLCBvcHRpb25zKSB7XG4gIHZhciBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICBpZiAobGVuID09PSAxICYmIEFycmF5LmlzQXJyYXkoaW5pdGlhbENvbnRhaW5lcnMpID09PSBmYWxzZSkge1xuICAgIG9wdGlvbnMgPSBpbml0aWFsQ29udGFpbmVycztcbiAgICBpbml0aWFsQ29udGFpbmVycyA9IFtdO1xuICB9XG4gIHZhciBfbWlycm9yOyAvLyBtaXJyb3IgaW1hZ2VcbiAgdmFyIF9zb3VyY2U7IC8vIHNvdXJjZSBjb250YWluZXJcbiAgdmFyIF9pdGVtOyAvLyBpdGVtIGJlaW5nIGRyYWdnZWRcbiAgdmFyIF9vZmZzZXRYOyAvLyByZWZlcmVuY2UgeFxuICB2YXIgX29mZnNldFk7IC8vIHJlZmVyZW5jZSB5XG4gIHZhciBfbW92ZVg7IC8vIHJlZmVyZW5jZSBtb3ZlIHhcbiAgdmFyIF9tb3ZlWTsgLy8gcmVmZXJlbmNlIG1vdmUgeVxuICB2YXIgX2luaXRpYWxTaWJsaW5nOyAvLyByZWZlcmVuY2Ugc2libGluZyB3aGVuIGdyYWJiZWRcbiAgdmFyIF9jdXJyZW50U2libGluZzsgLy8gcmVmZXJlbmNlIHNpYmxpbmcgbm93XG4gIHZhciBfY29weTsgLy8gaXRlbSB1c2VkIGZvciBjb3B5aW5nXG4gIHZhciBfcmVuZGVyVGltZXI7IC8vIHRpbWVyIGZvciBzZXRUaW1lb3V0IHJlbmRlck1pcnJvckltYWdlXG4gIHZhciBfbGFzdERyb3BUYXJnZXQgPSBudWxsOyAvLyBsYXN0IGNvbnRhaW5lciBpdGVtIHdhcyBvdmVyXG4gIHZhciBfZ3JhYmJlZDsgLy8gaG9sZHMgbW91c2Vkb3duIGNvbnRleHQgdW50aWwgZmlyc3QgbW91c2Vtb3ZlXG5cbiAgdmFyIG8gPSBvcHRpb25zIHx8IHt9O1xuICBpZiAoby5tb3ZlcyA9PT0gdm9pZCAwKSB7IG8ubW92ZXMgPSBhbHdheXM7IH1cbiAgaWYgKG8uYWNjZXB0cyA9PT0gdm9pZCAwKSB7IG8uYWNjZXB0cyA9IGFsd2F5czsgfVxuICBpZiAoby5pbnZhbGlkID09PSB2b2lkIDApIHsgby5pbnZhbGlkID0gaW52YWxpZFRhcmdldDsgfVxuICBpZiAoby5jb250YWluZXJzID09PSB2b2lkIDApIHsgby5jb250YWluZXJzID0gaW5pdGlhbENvbnRhaW5lcnMgfHwgW107IH1cbiAgaWYgKG8uaXNDb250YWluZXIgPT09IHZvaWQgMCkgeyBvLmlzQ29udGFpbmVyID0gbmV2ZXI7IH1cbiAgaWYgKG8uY29weSA9PT0gdm9pZCAwKSB7IG8uY29weSA9IGZhbHNlOyB9XG4gIGlmIChvLmNvcHlTb3J0U291cmNlID09PSB2b2lkIDApIHsgby5jb3B5U29ydFNvdXJjZSA9IGZhbHNlOyB9XG4gIGlmIChvLnJldmVydE9uU3BpbGwgPT09IHZvaWQgMCkgeyBvLnJldmVydE9uU3BpbGwgPSBmYWxzZTsgfVxuICBpZiAoby5yZW1vdmVPblNwaWxsID09PSB2b2lkIDApIHsgby5yZW1vdmVPblNwaWxsID0gZmFsc2U7IH1cbiAgaWYgKG8uZGlyZWN0aW9uID09PSB2b2lkIDApIHsgby5kaXJlY3Rpb24gPSAndmVydGljYWwnOyB9XG4gIGlmIChvLmlnbm9yZUlucHV0VGV4dFNlbGVjdGlvbiA9PT0gdm9pZCAwKSB7IG8uaWdub3JlSW5wdXRUZXh0U2VsZWN0aW9uID0gdHJ1ZTsgfVxuICBpZiAoby5taXJyb3JDb250YWluZXIgPT09IHZvaWQgMCkgeyBvLm1pcnJvckNvbnRhaW5lciA9IGRvYy5ib2R5OyB9XG5cbiAgdmFyIGRyYWtlID0gZW1pdHRlcih7XG4gICAgY29udGFpbmVyczogby5jb250YWluZXJzLFxuICAgIHN0YXJ0OiBtYW51YWxTdGFydCxcbiAgICBlbmQ6IGVuZCxcbiAgICBjYW5jZWw6IGNhbmNlbCxcbiAgICByZW1vdmU6IHJlbW92ZSxcbiAgICBkZXN0cm95OiBkZXN0cm95LFxuICAgIGNhbk1vdmU6IGNhbk1vdmUsXG4gICAgZHJhZ2dpbmc6IGZhbHNlXG4gIH0pO1xuXG4gIGlmIChvLnJlbW92ZU9uU3BpbGwgPT09IHRydWUpIHtcbiAgICBkcmFrZS5vbignb3ZlcicsIHNwaWxsT3Zlcikub24oJ291dCcsIHNwaWxsT3V0KTtcbiAgfVxuXG4gIGV2ZW50cygpO1xuXG4gIHJldHVybiBkcmFrZTtcblxuICBmdW5jdGlvbiBpc0NvbnRhaW5lciAoZWwpIHtcbiAgICByZXR1cm4gZHJha2UuY29udGFpbmVycy5pbmRleE9mKGVsKSAhPT0gLTEgfHwgby5pc0NvbnRhaW5lcihlbCk7XG4gIH1cblxuICBmdW5jdGlvbiBldmVudHMgKHJlbW92ZSkge1xuICAgIHZhciBvcCA9IHJlbW92ZSA/ICdyZW1vdmUnIDogJ2FkZCc7XG4gICAgdG91Y2h5KGRvY3VtZW50RWxlbWVudCwgb3AsICdtb3VzZWRvd24nLCBncmFiKTtcbiAgICB0b3VjaHkoZG9jdW1lbnRFbGVtZW50LCBvcCwgJ21vdXNldXAnLCByZWxlYXNlKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGV2ZW50dWFsTW92ZW1lbnRzIChyZW1vdmUpIHtcbiAgICB2YXIgb3AgPSByZW1vdmUgPyAncmVtb3ZlJyA6ICdhZGQnO1xuICAgIHRvdWNoeShkb2N1bWVudEVsZW1lbnQsIG9wLCAnbW91c2Vtb3ZlJywgc3RhcnRCZWNhdXNlTW91c2VNb3ZlZCk7XG4gIH1cblxuICBmdW5jdGlvbiBtb3ZlbWVudHMgKHJlbW92ZSkge1xuICAgIHZhciBvcCA9IHJlbW92ZSA/ICdyZW1vdmUnIDogJ2FkZCc7XG4gICAgY3Jvc3N2ZW50W29wXShkb2N1bWVudEVsZW1lbnQsICdzZWxlY3RzdGFydCcsIHByZXZlbnRHcmFiYmVkKTsgLy8gSUU4XG4gICAgY3Jvc3N2ZW50W29wXShkb2N1bWVudEVsZW1lbnQsICdjbGljaycsIHByZXZlbnRHcmFiYmVkKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGRlc3Ryb3kgKCkge1xuICAgIGV2ZW50cyh0cnVlKTtcbiAgICByZWxlYXNlKHt9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHByZXZlbnRHcmFiYmVkIChlKSB7XG4gICAgaWYgKF9ncmFiYmVkKSB7XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gZ3JhYiAoZSkge1xuICAgIF9tb3ZlWCA9IGUuY2xpZW50WDtcbiAgICBfbW92ZVkgPSBlLmNsaWVudFk7XG5cbiAgICB2YXIgaWdub3JlID0gd2hpY2hNb3VzZUJ1dHRvbihlKSAhPT0gMSB8fCBlLm1ldGFLZXkgfHwgZS5jdHJsS2V5O1xuICAgIGlmIChpZ25vcmUpIHtcbiAgICAgIHJldHVybjsgLy8gd2Ugb25seSBjYXJlIGFib3V0IGhvbmVzdC10by1nb2QgbGVmdCBjbGlja3MgYW5kIHRvdWNoIGV2ZW50c1xuICAgIH1cbiAgICB2YXIgaXRlbSA9IGUudGFyZ2V0O1xuICAgIHZhciBjb250ZXh0ID0gY2FuU3RhcnQoaXRlbSk7XG4gICAgaWYgKCFjb250ZXh0KSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIF9ncmFiYmVkID0gY29udGV4dDtcbiAgICBldmVudHVhbE1vdmVtZW50cygpO1xuICAgIGlmIChlLnR5cGUgPT09ICdtb3VzZWRvd24nKSB7XG4gICAgICBpZiAoaXNJbnB1dChpdGVtKSkgeyAvLyBzZWUgYWxzbzogaHR0cHM6Ly9naXRodWIuY29tL2JldmFjcXVhL2RyYWd1bGEvaXNzdWVzLzIwOFxuICAgICAgICBpdGVtLmZvY3VzKCk7IC8vIGZpeGVzIGh0dHBzOi8vZ2l0aHViLmNvbS9iZXZhY3F1YS9kcmFndWxhL2lzc3Vlcy8xNzZcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTsgLy8gZml4ZXMgaHR0cHM6Ly9naXRodWIuY29tL2JldmFjcXVhL2RyYWd1bGEvaXNzdWVzLzE1NVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHN0YXJ0QmVjYXVzZU1vdXNlTW92ZWQgKGUpIHtcbiAgICBpZiAoIV9ncmFiYmVkKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmICh3aGljaE1vdXNlQnV0dG9uKGUpID09PSAwKSB7XG4gICAgICByZWxlYXNlKHt9KTtcbiAgICAgIHJldHVybjsgLy8gd2hlbiB0ZXh0IGlzIHNlbGVjdGVkIG9uIGFuIGlucHV0IGFuZCB0aGVuIGRyYWdnZWQsIG1vdXNldXAgZG9lc24ndCBmaXJlLiB0aGlzIGlzIG91ciBvbmx5IGhvcGVcbiAgICB9XG4gICAgLy8gdHJ1dGh5IGNoZWNrIGZpeGVzICMyMzksIGVxdWFsaXR5IGZpeGVzICMyMDdcbiAgICBpZiAoZS5jbGllbnRYICE9PSB2b2lkIDAgJiYgZS5jbGllbnRYID09PSBfbW92ZVggJiYgZS5jbGllbnRZICE9PSB2b2lkIDAgJiYgZS5jbGllbnRZID09PSBfbW92ZVkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYgKG8uaWdub3JlSW5wdXRUZXh0U2VsZWN0aW9uKSB7XG4gICAgICB2YXIgY2xpZW50WCA9IGdldENvb3JkKCdjbGllbnRYJywgZSk7XG4gICAgICB2YXIgY2xpZW50WSA9IGdldENvb3JkKCdjbGllbnRZJywgZSk7XG4gICAgICB2YXIgZWxlbWVudEJlaGluZEN1cnNvciA9IGRvYy5lbGVtZW50RnJvbVBvaW50KGNsaWVudFgsIGNsaWVudFkpO1xuICAgICAgaWYgKGlzSW5wdXQoZWxlbWVudEJlaGluZEN1cnNvcikpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgIH1cblxuICAgIHZhciBncmFiYmVkID0gX2dyYWJiZWQ7IC8vIGNhbGwgdG8gZW5kKCkgdW5zZXRzIF9ncmFiYmVkXG4gICAgZXZlbnR1YWxNb3ZlbWVudHModHJ1ZSk7XG4gICAgbW92ZW1lbnRzKCk7XG4gICAgZW5kKCk7XG4gICAgc3RhcnQoZ3JhYmJlZCk7XG5cbiAgICB2YXIgb2Zmc2V0ID0gZ2V0T2Zmc2V0KF9pdGVtKTtcbiAgICBfb2Zmc2V0WCA9IGdldENvb3JkKCdwYWdlWCcsIGUpIC0gb2Zmc2V0LmxlZnQ7XG4gICAgX29mZnNldFkgPSBnZXRDb29yZCgncGFnZVknLCBlKSAtIG9mZnNldC50b3A7XG5cbiAgICBjbGFzc2VzLmFkZChfY29weSB8fCBfaXRlbSwgJ2d1LXRyYW5zaXQnKTtcbiAgICByZW5kZXJNaXJyb3JJbWFnZSgpO1xuICAgIGRyYWcoZSk7XG4gIH1cblxuICBmdW5jdGlvbiBjYW5TdGFydCAoaXRlbSkge1xuICAgIGlmIChkcmFrZS5kcmFnZ2luZyAmJiBfbWlycm9yKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmIChpc0NvbnRhaW5lcihpdGVtKSkge1xuICAgICAgcmV0dXJuOyAvLyBkb24ndCBkcmFnIGNvbnRhaW5lciBpdHNlbGZcbiAgICB9XG4gICAgdmFyIGhhbmRsZSA9IGl0ZW07XG4gICAgd2hpbGUgKGdldFBhcmVudChpdGVtKSAmJiBpc0NvbnRhaW5lcihnZXRQYXJlbnQoaXRlbSkpID09PSBmYWxzZSkge1xuICAgICAgaWYgKG8uaW52YWxpZChpdGVtLCBoYW5kbGUpKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGl0ZW0gPSBnZXRQYXJlbnQoaXRlbSk7IC8vIGRyYWcgdGFyZ2V0IHNob3VsZCBiZSBhIHRvcCBlbGVtZW50XG4gICAgICBpZiAoIWl0ZW0pIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgIH1cbiAgICB2YXIgc291cmNlID0gZ2V0UGFyZW50KGl0ZW0pO1xuICAgIGlmICghc291cmNlKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmIChvLmludmFsaWQoaXRlbSwgaGFuZGxlKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciBtb3ZhYmxlID0gby5tb3ZlcyhpdGVtLCBzb3VyY2UsIGhhbmRsZSwgbmV4dEVsKGl0ZW0pKTtcbiAgICBpZiAoIW1vdmFibGUpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgaXRlbTogaXRlbSxcbiAgICAgIHNvdXJjZTogc291cmNlXG4gICAgfTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGNhbk1vdmUgKGl0ZW0pIHtcbiAgICByZXR1cm4gISFjYW5TdGFydChpdGVtKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIG1hbnVhbFN0YXJ0IChpdGVtKSB7XG4gICAgdmFyIGNvbnRleHQgPSBjYW5TdGFydChpdGVtKTtcbiAgICBpZiAoY29udGV4dCkge1xuICAgICAgc3RhcnQoY29udGV4dCk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gc3RhcnQgKGNvbnRleHQpIHtcbiAgICBpZiAoaXNDb3B5KGNvbnRleHQuaXRlbSwgY29udGV4dC5zb3VyY2UpKSB7XG4gICAgICBfY29weSA9IGNvbnRleHQuaXRlbS5jbG9uZU5vZGUodHJ1ZSk7XG4gICAgICBkcmFrZS5lbWl0KCdjbG9uZWQnLCBfY29weSwgY29udGV4dC5pdGVtLCAnY29weScpO1xuICAgIH1cblxuICAgIF9zb3VyY2UgPSBjb250ZXh0LnNvdXJjZTtcbiAgICBfaXRlbSA9IGNvbnRleHQuaXRlbTtcbiAgICBfaW5pdGlhbFNpYmxpbmcgPSBfY3VycmVudFNpYmxpbmcgPSBuZXh0RWwoY29udGV4dC5pdGVtKTtcblxuICAgIGRyYWtlLmRyYWdnaW5nID0gdHJ1ZTtcbiAgICBkcmFrZS5lbWl0KCdkcmFnJywgX2l0ZW0sIF9zb3VyY2UpO1xuICB9XG5cbiAgZnVuY3Rpb24gaW52YWxpZFRhcmdldCAoKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgZnVuY3Rpb24gZW5kICgpIHtcbiAgICBpZiAoIWRyYWtlLmRyYWdnaW5nKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHZhciBpdGVtID0gX2NvcHkgfHwgX2l0ZW07XG4gICAgZHJvcChpdGVtLCBnZXRQYXJlbnQoaXRlbSkpO1xuICB9XG5cbiAgZnVuY3Rpb24gdW5ncmFiICgpIHtcbiAgICBfZ3JhYmJlZCA9IGZhbHNlO1xuICAgIGV2ZW50dWFsTW92ZW1lbnRzKHRydWUpO1xuICAgIG1vdmVtZW50cyh0cnVlKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlbGVhc2UgKGUpIHtcbiAgICB1bmdyYWIoKTtcblxuICAgIGlmICghZHJha2UuZHJhZ2dpbmcpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdmFyIGl0ZW0gPSBfY29weSB8fCBfaXRlbTtcbiAgICB2YXIgY2xpZW50WCA9IGdldENvb3JkKCdjbGllbnRYJywgZSk7XG4gICAgdmFyIGNsaWVudFkgPSBnZXRDb29yZCgnY2xpZW50WScsIGUpO1xuICAgIHZhciBlbGVtZW50QmVoaW5kQ3Vyc29yID0gZ2V0RWxlbWVudEJlaGluZFBvaW50KF9taXJyb3IsIGNsaWVudFgsIGNsaWVudFkpO1xuICAgIHZhciBkcm9wVGFyZ2V0ID0gZmluZERyb3BUYXJnZXQoZWxlbWVudEJlaGluZEN1cnNvciwgY2xpZW50WCwgY2xpZW50WSk7XG4gICAgaWYgKGRyb3BUYXJnZXQgJiYgKChfY29weSAmJiBvLmNvcHlTb3J0U291cmNlKSB8fCAoIV9jb3B5IHx8IGRyb3BUYXJnZXQgIT09IF9zb3VyY2UpKSkge1xuICAgICAgZHJvcChpdGVtLCBkcm9wVGFyZ2V0KTtcbiAgICB9IGVsc2UgaWYgKG8ucmVtb3ZlT25TcGlsbCkge1xuICAgICAgcmVtb3ZlKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNhbmNlbCgpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGRyb3AgKGl0ZW0sIHRhcmdldCkge1xuICAgIHZhciBwYXJlbnQgPSBnZXRQYXJlbnQoaXRlbSk7XG4gICAgaWYgKF9jb3B5ICYmIG8uY29weVNvcnRTb3VyY2UgJiYgdGFyZ2V0ID09PSBfc291cmNlKSB7XG4gICAgICBwYXJlbnQucmVtb3ZlQ2hpbGQoX2l0ZW0pO1xuICAgIH1cbiAgICBpZiAoaXNJbml0aWFsUGxhY2VtZW50KHRhcmdldCkpIHtcbiAgICAgIGRyYWtlLmVtaXQoJ2NhbmNlbCcsIGl0ZW0sIF9zb3VyY2UsIF9zb3VyY2UpO1xuICAgIH0gZWxzZSB7XG4gICAgICBkcmFrZS5lbWl0KCdkcm9wJywgaXRlbSwgdGFyZ2V0LCBfc291cmNlLCBfY3VycmVudFNpYmxpbmcpO1xuICAgIH1cbiAgICBjbGVhbnVwKCk7XG4gIH1cblxuICBmdW5jdGlvbiByZW1vdmUgKCkge1xuICAgIGlmICghZHJha2UuZHJhZ2dpbmcpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdmFyIGl0ZW0gPSBfY29weSB8fCBfaXRlbTtcbiAgICB2YXIgcGFyZW50ID0gZ2V0UGFyZW50KGl0ZW0pO1xuICAgIGlmIChwYXJlbnQpIHtcbiAgICAgIHBhcmVudC5yZW1vdmVDaGlsZChpdGVtKTtcbiAgICB9XG4gICAgZHJha2UuZW1pdChfY29weSA/ICdjYW5jZWwnIDogJ3JlbW92ZScsIGl0ZW0sIHBhcmVudCwgX3NvdXJjZSk7XG4gICAgY2xlYW51cCgpO1xuICB9XG5cbiAgZnVuY3Rpb24gY2FuY2VsIChyZXZlcnQpIHtcbiAgICBpZiAoIWRyYWtlLmRyYWdnaW5nKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHZhciByZXZlcnRzID0gYXJndW1lbnRzLmxlbmd0aCA+IDAgPyByZXZlcnQgOiBvLnJldmVydE9uU3BpbGw7XG4gICAgdmFyIGl0ZW0gPSBfY29weSB8fCBfaXRlbTtcbiAgICB2YXIgcGFyZW50ID0gZ2V0UGFyZW50KGl0ZW0pO1xuICAgIHZhciBpbml0aWFsID0gaXNJbml0aWFsUGxhY2VtZW50KHBhcmVudCk7XG4gICAgaWYgKGluaXRpYWwgPT09IGZhbHNlICYmIHJldmVydHMpIHtcbiAgICAgIGlmIChfY29weSkge1xuICAgICAgICBpZiAocGFyZW50KSB7XG4gICAgICAgICAgcGFyZW50LnJlbW92ZUNoaWxkKF9jb3B5KTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgX3NvdXJjZS5pbnNlcnRCZWZvcmUoaXRlbSwgX2luaXRpYWxTaWJsaW5nKTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKGluaXRpYWwgfHwgcmV2ZXJ0cykge1xuICAgICAgZHJha2UuZW1pdCgnY2FuY2VsJywgaXRlbSwgX3NvdXJjZSwgX3NvdXJjZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGRyYWtlLmVtaXQoJ2Ryb3AnLCBpdGVtLCBwYXJlbnQsIF9zb3VyY2UsIF9jdXJyZW50U2libGluZyk7XG4gICAgfVxuICAgIGNsZWFudXAoKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGNsZWFudXAgKCkge1xuICAgIHZhciBpdGVtID0gX2NvcHkgfHwgX2l0ZW07XG4gICAgdW5ncmFiKCk7XG4gICAgcmVtb3ZlTWlycm9ySW1hZ2UoKTtcbiAgICBpZiAoaXRlbSkge1xuICAgICAgY2xhc3Nlcy5ybShpdGVtLCAnZ3UtdHJhbnNpdCcpO1xuICAgIH1cbiAgICBpZiAoX3JlbmRlclRpbWVyKSB7XG4gICAgICBjbGVhclRpbWVvdXQoX3JlbmRlclRpbWVyKTtcbiAgICB9XG4gICAgZHJha2UuZHJhZ2dpbmcgPSBmYWxzZTtcbiAgICBpZiAoX2xhc3REcm9wVGFyZ2V0KSB7XG4gICAgICBkcmFrZS5lbWl0KCdvdXQnLCBpdGVtLCBfbGFzdERyb3BUYXJnZXQsIF9zb3VyY2UpO1xuICAgIH1cbiAgICBkcmFrZS5lbWl0KCdkcmFnZW5kJywgaXRlbSk7XG4gICAgX3NvdXJjZSA9IF9pdGVtID0gX2NvcHkgPSBfaW5pdGlhbFNpYmxpbmcgPSBfY3VycmVudFNpYmxpbmcgPSBfcmVuZGVyVGltZXIgPSBfbGFzdERyb3BUYXJnZXQgPSBudWxsO1xuICB9XG5cbiAgZnVuY3Rpb24gaXNJbml0aWFsUGxhY2VtZW50ICh0YXJnZXQsIHMpIHtcbiAgICB2YXIgc2libGluZztcbiAgICBpZiAocyAhPT0gdm9pZCAwKSB7XG4gICAgICBzaWJsaW5nID0gcztcbiAgICB9IGVsc2UgaWYgKF9taXJyb3IpIHtcbiAgICAgIHNpYmxpbmcgPSBfY3VycmVudFNpYmxpbmc7XG4gICAgfSBlbHNlIHtcbiAgICAgIHNpYmxpbmcgPSBuZXh0RWwoX2NvcHkgfHwgX2l0ZW0pO1xuICAgIH1cbiAgICByZXR1cm4gdGFyZ2V0ID09PSBfc291cmNlICYmIHNpYmxpbmcgPT09IF9pbml0aWFsU2libGluZztcbiAgfVxuXG4gIGZ1bmN0aW9uIGZpbmREcm9wVGFyZ2V0IChlbGVtZW50QmVoaW5kQ3Vyc29yLCBjbGllbnRYLCBjbGllbnRZKSB7XG4gICAgdmFyIHRhcmdldCA9IGVsZW1lbnRCZWhpbmRDdXJzb3I7XG4gICAgd2hpbGUgKHRhcmdldCAmJiAhYWNjZXB0ZWQoKSkge1xuICAgICAgdGFyZ2V0ID0gZ2V0UGFyZW50KHRhcmdldCk7XG4gICAgfVxuICAgIHJldHVybiB0YXJnZXQ7XG5cbiAgICBmdW5jdGlvbiBhY2NlcHRlZCAoKSB7XG4gICAgICB2YXIgZHJvcHBhYmxlID0gaXNDb250YWluZXIodGFyZ2V0KTtcbiAgICAgIGlmIChkcm9wcGFibGUgPT09IGZhbHNlKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cblxuICAgICAgdmFyIGltbWVkaWF0ZSA9IGdldEltbWVkaWF0ZUNoaWxkKHRhcmdldCwgZWxlbWVudEJlaGluZEN1cnNvcik7XG4gICAgICB2YXIgcmVmZXJlbmNlID0gZ2V0UmVmZXJlbmNlKHRhcmdldCwgaW1tZWRpYXRlLCBjbGllbnRYLCBjbGllbnRZKTtcbiAgICAgIHZhciBpbml0aWFsID0gaXNJbml0aWFsUGxhY2VtZW50KHRhcmdldCwgcmVmZXJlbmNlKTtcbiAgICAgIGlmIChpbml0aWFsKSB7XG4gICAgICAgIHJldHVybiB0cnVlOyAvLyBzaG91bGQgYWx3YXlzIGJlIGFibGUgdG8gZHJvcCBpdCByaWdodCBiYWNrIHdoZXJlIGl0IHdhc1xuICAgICAgfVxuICAgICAgcmV0dXJuIG8uYWNjZXB0cyhfaXRlbSwgdGFyZ2V0LCBfc291cmNlLCByZWZlcmVuY2UpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGRyYWcgKGUpIHtcbiAgICBpZiAoIV9taXJyb3IpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuXG4gICAgdmFyIGNsaWVudFggPSBnZXRDb29yZCgnY2xpZW50WCcsIGUpO1xuICAgIHZhciBjbGllbnRZID0gZ2V0Q29vcmQoJ2NsaWVudFknLCBlKTtcbiAgICB2YXIgeCA9IGNsaWVudFggLSBfb2Zmc2V0WDtcbiAgICB2YXIgeSA9IGNsaWVudFkgLSBfb2Zmc2V0WTtcblxuICAgIF9taXJyb3Iuc3R5bGUubGVmdCA9IHggKyAncHgnO1xuICAgIF9taXJyb3Iuc3R5bGUudG9wID0geSArICdweCc7XG5cbiAgICB2YXIgaXRlbSA9IF9jb3B5IHx8IF9pdGVtO1xuICAgIHZhciBlbGVtZW50QmVoaW5kQ3Vyc29yID0gZ2V0RWxlbWVudEJlaGluZFBvaW50KF9taXJyb3IsIGNsaWVudFgsIGNsaWVudFkpO1xuICAgIHZhciBkcm9wVGFyZ2V0ID0gZmluZERyb3BUYXJnZXQoZWxlbWVudEJlaGluZEN1cnNvciwgY2xpZW50WCwgY2xpZW50WSk7XG4gICAgdmFyIGNoYW5nZWQgPSBkcm9wVGFyZ2V0ICE9PSBudWxsICYmIGRyb3BUYXJnZXQgIT09IF9sYXN0RHJvcFRhcmdldDtcbiAgICBpZiAoY2hhbmdlZCB8fCBkcm9wVGFyZ2V0ID09PSBudWxsKSB7XG4gICAgICBvdXQoKTtcbiAgICAgIF9sYXN0RHJvcFRhcmdldCA9IGRyb3BUYXJnZXQ7XG4gICAgICBvdmVyKCk7XG4gICAgfVxuICAgIHZhciBwYXJlbnQgPSBnZXRQYXJlbnQoaXRlbSk7XG4gICAgaWYgKGRyb3BUYXJnZXQgPT09IF9zb3VyY2UgJiYgX2NvcHkgJiYgIW8uY29weVNvcnRTb3VyY2UpIHtcbiAgICAgIGlmIChwYXJlbnQpIHtcbiAgICAgICAgcGFyZW50LnJlbW92ZUNoaWxkKGl0ZW0pO1xuICAgICAgfVxuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgcmVmZXJlbmNlO1xuICAgIHZhciBpbW1lZGlhdGUgPSBnZXRJbW1lZGlhdGVDaGlsZChkcm9wVGFyZ2V0LCBlbGVtZW50QmVoaW5kQ3Vyc29yKTtcbiAgICBpZiAoaW1tZWRpYXRlICE9PSBudWxsKSB7XG4gICAgICByZWZlcmVuY2UgPSBnZXRSZWZlcmVuY2UoZHJvcFRhcmdldCwgaW1tZWRpYXRlLCBjbGllbnRYLCBjbGllbnRZKTtcbiAgICB9IGVsc2UgaWYgKG8ucmV2ZXJ0T25TcGlsbCA9PT0gdHJ1ZSAmJiAhX2NvcHkpIHtcbiAgICAgIHJlZmVyZW5jZSA9IF9pbml0aWFsU2libGluZztcbiAgICAgIGRyb3BUYXJnZXQgPSBfc291cmNlO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoX2NvcHkgJiYgcGFyZW50KSB7XG4gICAgICAgIHBhcmVudC5yZW1vdmVDaGlsZChpdGVtKTtcbiAgICAgIH1cbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYgKFxuICAgICAgKHJlZmVyZW5jZSA9PT0gbnVsbCAmJiBjaGFuZ2VkKSB8fFxuICAgICAgcmVmZXJlbmNlICE9PSBpdGVtICYmXG4gICAgICByZWZlcmVuY2UgIT09IG5leHRFbChpdGVtKVxuICAgICkge1xuICAgICAgX2N1cnJlbnRTaWJsaW5nID0gcmVmZXJlbmNlO1xuICAgICAgZHJvcFRhcmdldC5pbnNlcnRCZWZvcmUoaXRlbSwgcmVmZXJlbmNlKTtcbiAgICAgIGRyYWtlLmVtaXQoJ3NoYWRvdycsIGl0ZW0sIGRyb3BUYXJnZXQsIF9zb3VyY2UpO1xuICAgIH1cbiAgICBmdW5jdGlvbiBtb3ZlZCAodHlwZSkgeyBkcmFrZS5lbWl0KHR5cGUsIGl0ZW0sIF9sYXN0RHJvcFRhcmdldCwgX3NvdXJjZSk7IH1cbiAgICBmdW5jdGlvbiBvdmVyICgpIHsgaWYgKGNoYW5nZWQpIHsgbW92ZWQoJ292ZXInKTsgfSB9XG4gICAgZnVuY3Rpb24gb3V0ICgpIHsgaWYgKF9sYXN0RHJvcFRhcmdldCkgeyBtb3ZlZCgnb3V0Jyk7IH0gfVxuICB9XG5cbiAgZnVuY3Rpb24gc3BpbGxPdmVyIChlbCkge1xuICAgIGNsYXNzZXMucm0oZWwsICdndS1oaWRlJyk7XG4gIH1cblxuICBmdW5jdGlvbiBzcGlsbE91dCAoZWwpIHtcbiAgICBpZiAoZHJha2UuZHJhZ2dpbmcpIHsgY2xhc3Nlcy5hZGQoZWwsICdndS1oaWRlJyk7IH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHJlbmRlck1pcnJvckltYWdlICgpIHtcbiAgICBpZiAoX21pcnJvcikge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgcmVjdCA9IF9pdGVtLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgIF9taXJyb3IgPSBfaXRlbS5jbG9uZU5vZGUodHJ1ZSk7XG4gICAgX21pcnJvci5zdHlsZS53aWR0aCA9IGdldFJlY3RXaWR0aChyZWN0KSArICdweCc7XG4gICAgX21pcnJvci5zdHlsZS5oZWlnaHQgPSBnZXRSZWN0SGVpZ2h0KHJlY3QpICsgJ3B4JztcbiAgICBjbGFzc2VzLnJtKF9taXJyb3IsICdndS10cmFuc2l0Jyk7XG4gICAgY2xhc3Nlcy5hZGQoX21pcnJvciwgJ2d1LW1pcnJvcicpO1xuICAgIG8ubWlycm9yQ29udGFpbmVyLmFwcGVuZENoaWxkKF9taXJyb3IpO1xuICAgIHRvdWNoeShkb2N1bWVudEVsZW1lbnQsICdhZGQnLCAnbW91c2Vtb3ZlJywgZHJhZyk7XG4gICAgY2xhc3Nlcy5hZGQoby5taXJyb3JDb250YWluZXIsICdndS11bnNlbGVjdGFibGUnKTtcbiAgICBkcmFrZS5lbWl0KCdjbG9uZWQnLCBfbWlycm9yLCBfaXRlbSwgJ21pcnJvcicpO1xuICB9XG5cbiAgZnVuY3Rpb24gcmVtb3ZlTWlycm9ySW1hZ2UgKCkge1xuICAgIGlmIChfbWlycm9yKSB7XG4gICAgICBjbGFzc2VzLnJtKG8ubWlycm9yQ29udGFpbmVyLCAnZ3UtdW5zZWxlY3RhYmxlJyk7XG4gICAgICB0b3VjaHkoZG9jdW1lbnRFbGVtZW50LCAncmVtb3ZlJywgJ21vdXNlbW92ZScsIGRyYWcpO1xuICAgICAgZ2V0UGFyZW50KF9taXJyb3IpLnJlbW92ZUNoaWxkKF9taXJyb3IpO1xuICAgICAgX21pcnJvciA9IG51bGw7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gZ2V0SW1tZWRpYXRlQ2hpbGQgKGRyb3BUYXJnZXQsIHRhcmdldCkge1xuICAgIHZhciBpbW1lZGlhdGUgPSB0YXJnZXQ7XG4gICAgd2hpbGUgKGltbWVkaWF0ZSAhPT0gZHJvcFRhcmdldCAmJiBnZXRQYXJlbnQoaW1tZWRpYXRlKSAhPT0gZHJvcFRhcmdldCkge1xuICAgICAgaW1tZWRpYXRlID0gZ2V0UGFyZW50KGltbWVkaWF0ZSk7XG4gICAgfVxuICAgIGlmIChpbW1lZGlhdGUgPT09IGRvY3VtZW50RWxlbWVudCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIHJldHVybiBpbW1lZGlhdGU7XG4gIH1cblxuICBmdW5jdGlvbiBnZXRSZWZlcmVuY2UgKGRyb3BUYXJnZXQsIHRhcmdldCwgeCwgeSkge1xuICAgIHZhciBob3Jpem9udGFsID0gby5kaXJlY3Rpb24gPT09ICdob3Jpem9udGFsJztcbiAgICB2YXIgcmVmZXJlbmNlID0gdGFyZ2V0ICE9PSBkcm9wVGFyZ2V0ID8gaW5zaWRlKCkgOiBvdXRzaWRlKCk7XG4gICAgcmV0dXJuIHJlZmVyZW5jZTtcblxuICAgIGZ1bmN0aW9uIG91dHNpZGUgKCkgeyAvLyBzbG93ZXIsIGJ1dCBhYmxlIHRvIGZpZ3VyZSBvdXQgYW55IHBvc2l0aW9uXG4gICAgICB2YXIgbGVuID0gZHJvcFRhcmdldC5jaGlsZHJlbi5sZW5ndGg7XG4gICAgICB2YXIgaTtcbiAgICAgIHZhciBlbDtcbiAgICAgIHZhciByZWN0O1xuICAgICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgIGVsID0gZHJvcFRhcmdldC5jaGlsZHJlbltpXTtcbiAgICAgICAgcmVjdCA9IGVsLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgICAgICBpZiAoaG9yaXpvbnRhbCAmJiAocmVjdC5sZWZ0ICsgcmVjdC53aWR0aCAvIDIpID4geCkgeyByZXR1cm4gZWw7IH1cbiAgICAgICAgaWYgKCFob3Jpem9udGFsICYmIChyZWN0LnRvcCArIHJlY3QuaGVpZ2h0IC8gMikgPiB5KSB7IHJldHVybiBlbDsgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaW5zaWRlICgpIHsgLy8gZmFzdGVyLCBidXQgb25seSBhdmFpbGFibGUgaWYgZHJvcHBlZCBpbnNpZGUgYSBjaGlsZCBlbGVtZW50XG4gICAgICB2YXIgcmVjdCA9IHRhcmdldC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgICAgIGlmIChob3Jpem9udGFsKSB7XG4gICAgICAgIHJldHVybiByZXNvbHZlKHggPiByZWN0LmxlZnQgKyBnZXRSZWN0V2lkdGgocmVjdCkgLyAyKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiByZXNvbHZlKHkgPiByZWN0LnRvcCArIGdldFJlY3RIZWlnaHQocmVjdCkgLyAyKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiByZXNvbHZlIChhZnRlcikge1xuICAgICAgcmV0dXJuIGFmdGVyID8gbmV4dEVsKHRhcmdldCkgOiB0YXJnZXQ7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gaXNDb3B5IChpdGVtLCBjb250YWluZXIpIHtcbiAgICByZXR1cm4gdHlwZW9mIG8uY29weSA9PT0gJ2Jvb2xlYW4nID8gby5jb3B5IDogby5jb3B5KGl0ZW0sIGNvbnRhaW5lcik7XG4gIH1cbn1cblxuZnVuY3Rpb24gdG91Y2h5IChlbCwgb3AsIHR5cGUsIGZuKSB7XG4gIHZhciB0b3VjaCA9IHtcbiAgICBtb3VzZXVwOiAndG91Y2hlbmQnLFxuICAgIG1vdXNlZG93bjogJ3RvdWNoc3RhcnQnLFxuICAgIG1vdXNlbW92ZTogJ3RvdWNobW92ZSdcbiAgfTtcbiAgdmFyIHBvaW50ZXJzID0ge1xuICAgIG1vdXNldXA6ICdwb2ludGVydXAnLFxuICAgIG1vdXNlZG93bjogJ3BvaW50ZXJkb3duJyxcbiAgICBtb3VzZW1vdmU6ICdwb2ludGVybW92ZSdcbiAgfTtcbiAgdmFyIG1pY3Jvc29mdCA9IHtcbiAgICBtb3VzZXVwOiAnTVNQb2ludGVyVXAnLFxuICAgIG1vdXNlZG93bjogJ01TUG9pbnRlckRvd24nLFxuICAgIG1vdXNlbW92ZTogJ01TUG9pbnRlck1vdmUnXG4gIH07XG4gIGlmIChnbG9iYWwubmF2aWdhdG9yLnBvaW50ZXJFbmFibGVkKSB7XG4gICAgY3Jvc3N2ZW50W29wXShlbCwgcG9pbnRlcnNbdHlwZV0sIGZuKTtcbiAgfSBlbHNlIGlmIChnbG9iYWwubmF2aWdhdG9yLm1zUG9pbnRlckVuYWJsZWQpIHtcbiAgICBjcm9zc3ZlbnRbb3BdKGVsLCBtaWNyb3NvZnRbdHlwZV0sIGZuKTtcbiAgfSBlbHNlIHtcbiAgICBjcm9zc3ZlbnRbb3BdKGVsLCB0b3VjaFt0eXBlXSwgZm4pO1xuICAgIGNyb3NzdmVudFtvcF0oZWwsIHR5cGUsIGZuKTtcbiAgfVxufVxuXG5mdW5jdGlvbiB3aGljaE1vdXNlQnV0dG9uIChlKSB7XG4gIGlmIChlLnRvdWNoZXMgIT09IHZvaWQgMCkgeyByZXR1cm4gZS50b3VjaGVzLmxlbmd0aDsgfVxuICBpZiAoZS53aGljaCAhPT0gdm9pZCAwICYmIGUud2hpY2ggIT09IDApIHsgcmV0dXJuIGUud2hpY2g7IH0gLy8gc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9iZXZhY3F1YS9kcmFndWxhL2lzc3Vlcy8yNjFcbiAgaWYgKGUuYnV0dG9ucyAhPT0gdm9pZCAwKSB7IHJldHVybiBlLmJ1dHRvbnM7IH1cbiAgdmFyIGJ1dHRvbiA9IGUuYnV0dG9uO1xuICBpZiAoYnV0dG9uICE9PSB2b2lkIDApIHsgLy8gc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9qcXVlcnkvanF1ZXJ5L2Jsb2IvOTllOGZmMWJhYTdhZTM0MWU5NGJiODljM2U4NDU3MGM3YzNhZDllYS9zcmMvZXZlbnQuanMjTDU3My1MNTc1XG4gICAgcmV0dXJuIGJ1dHRvbiAmIDEgPyAxIDogYnV0dG9uICYgMiA/IDMgOiAoYnV0dG9uICYgNCA/IDIgOiAwKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBnZXRPZmZzZXQgKGVsKSB7XG4gIHZhciByZWN0ID0gZWwuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gIHJldHVybiB7XG4gICAgbGVmdDogcmVjdC5sZWZ0ICsgZ2V0U2Nyb2xsKCdzY3JvbGxMZWZ0JywgJ3BhZ2VYT2Zmc2V0JyksXG4gICAgdG9wOiByZWN0LnRvcCArIGdldFNjcm9sbCgnc2Nyb2xsVG9wJywgJ3BhZ2VZT2Zmc2V0JylcbiAgfTtcbn1cblxuZnVuY3Rpb24gZ2V0U2Nyb2xsIChzY3JvbGxQcm9wLCBvZmZzZXRQcm9wKSB7XG4gIGlmICh0eXBlb2YgZ2xvYmFsW29mZnNldFByb3BdICE9PSAndW5kZWZpbmVkJykge1xuICAgIHJldHVybiBnbG9iYWxbb2Zmc2V0UHJvcF07XG4gIH1cbiAgaWYgKGRvY3VtZW50RWxlbWVudC5jbGllbnRIZWlnaHQpIHtcbiAgICByZXR1cm4gZG9jdW1lbnRFbGVtZW50W3Njcm9sbFByb3BdO1xuICB9XG4gIHJldHVybiBkb2MuYm9keVtzY3JvbGxQcm9wXTtcbn1cblxuZnVuY3Rpb24gZ2V0RWxlbWVudEJlaGluZFBvaW50IChwb2ludCwgeCwgeSkge1xuICB2YXIgcCA9IHBvaW50IHx8IHt9O1xuICB2YXIgc3RhdGUgPSBwLmNsYXNzTmFtZTtcbiAgdmFyIGVsO1xuICBwLmNsYXNzTmFtZSArPSAnIGd1LWhpZGUnO1xuICBlbCA9IGRvYy5lbGVtZW50RnJvbVBvaW50KHgsIHkpO1xuICBwLmNsYXNzTmFtZSA9IHN0YXRlO1xuICByZXR1cm4gZWw7XG59XG5cbmZ1bmN0aW9uIG5ldmVyICgpIHsgcmV0dXJuIGZhbHNlOyB9XG5mdW5jdGlvbiBhbHdheXMgKCkgeyByZXR1cm4gdHJ1ZTsgfVxuZnVuY3Rpb24gZ2V0UmVjdFdpZHRoIChyZWN0KSB7IHJldHVybiByZWN0LndpZHRoIHx8IChyZWN0LnJpZ2h0IC0gcmVjdC5sZWZ0KTsgfVxuZnVuY3Rpb24gZ2V0UmVjdEhlaWdodCAocmVjdCkgeyByZXR1cm4gcmVjdC5oZWlnaHQgfHwgKHJlY3QuYm90dG9tIC0gcmVjdC50b3ApOyB9XG5mdW5jdGlvbiBnZXRQYXJlbnQgKGVsKSB7IHJldHVybiBlbC5wYXJlbnROb2RlID09PSBkb2MgPyBudWxsIDogZWwucGFyZW50Tm9kZTsgfVxuZnVuY3Rpb24gaXNJbnB1dCAoZWwpIHsgcmV0dXJuIGVsLnRhZ05hbWUgPT09ICdJTlBVVCcgfHwgZWwudGFnTmFtZSA9PT0gJ1RFWFRBUkVBJyB8fCBlbC50YWdOYW1lID09PSAnU0VMRUNUJyB8fCBpc0VkaXRhYmxlKGVsKTsgfVxuZnVuY3Rpb24gaXNFZGl0YWJsZSAoZWwpIHtcbiAgaWYgKCFlbCkgeyByZXR1cm4gZmFsc2U7IH0gLy8gbm8gcGFyZW50cyB3ZXJlIGVkaXRhYmxlXG4gIGlmIChlbC5jb250ZW50RWRpdGFibGUgPT09ICdmYWxzZScpIHsgcmV0dXJuIGZhbHNlOyB9IC8vIHN0b3AgdGhlIGxvb2t1cFxuICBpZiAoZWwuY29udGVudEVkaXRhYmxlID09PSAndHJ1ZScpIHsgcmV0dXJuIHRydWU7IH0gLy8gZm91bmQgYSBjb250ZW50RWRpdGFibGUgZWxlbWVudCBpbiB0aGUgY2hhaW5cbiAgcmV0dXJuIGlzRWRpdGFibGUoZ2V0UGFyZW50KGVsKSk7IC8vIGNvbnRlbnRFZGl0YWJsZSBpcyBzZXQgdG8gJ2luaGVyaXQnXG59XG5cbmZ1bmN0aW9uIG5leHRFbCAoZWwpIHtcbiAgcmV0dXJuIGVsLm5leHRFbGVtZW50U2libGluZyB8fCBtYW51YWxseSgpO1xuICBmdW5jdGlvbiBtYW51YWxseSAoKSB7XG4gICAgdmFyIHNpYmxpbmcgPSBlbDtcbiAgICBkbyB7XG4gICAgICBzaWJsaW5nID0gc2libGluZy5uZXh0U2libGluZztcbiAgICB9IHdoaWxlIChzaWJsaW5nICYmIHNpYmxpbmcubm9kZVR5cGUgIT09IDEpO1xuICAgIHJldHVybiBzaWJsaW5nO1xuICB9XG59XG5cbmZ1bmN0aW9uIGdldEV2ZW50SG9zdCAoZSkge1xuICAvLyBvbiB0b3VjaGVuZCBldmVudCwgd2UgaGF2ZSB0byB1c2UgYGUuY2hhbmdlZFRvdWNoZXNgXG4gIC8vIHNlZSBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzcxOTI1NjMvdG91Y2hlbmQtZXZlbnQtcHJvcGVydGllc1xuICAvLyBzZWUgaHR0cHM6Ly9naXRodWIuY29tL2JldmFjcXVhL2RyYWd1bGEvaXNzdWVzLzM0XG4gIGlmIChlLnRhcmdldFRvdWNoZXMgJiYgZS50YXJnZXRUb3VjaGVzLmxlbmd0aCkge1xuICAgIHJldHVybiBlLnRhcmdldFRvdWNoZXNbMF07XG4gIH1cbiAgaWYgKGUuY2hhbmdlZFRvdWNoZXMgJiYgZS5jaGFuZ2VkVG91Y2hlcy5sZW5ndGgpIHtcbiAgICByZXR1cm4gZS5jaGFuZ2VkVG91Y2hlc1swXTtcbiAgfVxuICByZXR1cm4gZTtcbn1cblxuZnVuY3Rpb24gZ2V0Q29vcmQgKGNvb3JkLCBlKSB7XG4gIHZhciBob3N0ID0gZ2V0RXZlbnRIb3N0KGUpO1xuICB2YXIgbWlzc01hcCA9IHtcbiAgICBwYWdlWDogJ2NsaWVudFgnLCAvLyBJRThcbiAgICBwYWdlWTogJ2NsaWVudFknIC8vIElFOFxuICB9O1xuICBpZiAoY29vcmQgaW4gbWlzc01hcCAmJiAhKGNvb3JkIGluIGhvc3QpICYmIG1pc3NNYXBbY29vcmRdIGluIGhvc3QpIHtcbiAgICBjb29yZCA9IG1pc3NNYXBbY29vcmRdO1xuICB9XG4gIHJldHVybiBob3N0W2Nvb3JkXTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBkcmFndWxhO1xuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBhdG9hIChhLCBuKSB7IHJldHVybiBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhLCBuKTsgfVxuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgdGlja3kgPSByZXF1aXJlKCd0aWNreScpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGRlYm91bmNlIChmbiwgYXJncywgY3R4KSB7XG4gIGlmICghZm4pIHsgcmV0dXJuOyB9XG4gIHRpY2t5KGZ1bmN0aW9uIHJ1biAoKSB7XG4gICAgZm4uYXBwbHkoY3R4IHx8IG51bGwsIGFyZ3MgfHwgW10pO1xuICB9KTtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBhdG9hID0gcmVxdWlyZSgnYXRvYScpO1xudmFyIGRlYm91bmNlID0gcmVxdWlyZSgnLi9kZWJvdW5jZScpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGVtaXR0ZXIgKHRoaW5nLCBvcHRpb25zKSB7XG4gIHZhciBvcHRzID0gb3B0aW9ucyB8fCB7fTtcbiAgdmFyIGV2dCA9IHt9O1xuICBpZiAodGhpbmcgPT09IHVuZGVmaW5lZCkgeyB0aGluZyA9IHt9OyB9XG4gIHRoaW5nLm9uID0gZnVuY3Rpb24gKHR5cGUsIGZuKSB7XG4gICAgaWYgKCFldnRbdHlwZV0pIHtcbiAgICAgIGV2dFt0eXBlXSA9IFtmbl07XG4gICAgfSBlbHNlIHtcbiAgICAgIGV2dFt0eXBlXS5wdXNoKGZuKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaW5nO1xuICB9O1xuICB0aGluZy5vbmNlID0gZnVuY3Rpb24gKHR5cGUsIGZuKSB7XG4gICAgZm4uX29uY2UgPSB0cnVlOyAvLyB0aGluZy5vZmYoZm4pIHN0aWxsIHdvcmtzIVxuICAgIHRoaW5nLm9uKHR5cGUsIGZuKTtcbiAgICByZXR1cm4gdGhpbmc7XG4gIH07XG4gIHRoaW5nLm9mZiA9IGZ1bmN0aW9uICh0eXBlLCBmbikge1xuICAgIHZhciBjID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICBpZiAoYyA9PT0gMSkge1xuICAgICAgZGVsZXRlIGV2dFt0eXBlXTtcbiAgICB9IGVsc2UgaWYgKGMgPT09IDApIHtcbiAgICAgIGV2dCA9IHt9O1xuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgZXQgPSBldnRbdHlwZV07XG4gICAgICBpZiAoIWV0KSB7IHJldHVybiB0aGluZzsgfVxuICAgICAgZXQuc3BsaWNlKGV0LmluZGV4T2YoZm4pLCAxKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaW5nO1xuICB9O1xuICB0aGluZy5lbWl0ID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBhcmdzID0gYXRvYShhcmd1bWVudHMpO1xuICAgIHJldHVybiB0aGluZy5lbWl0dGVyU25hcHNob3QoYXJncy5zaGlmdCgpKS5hcHBseSh0aGlzLCBhcmdzKTtcbiAgfTtcbiAgdGhpbmcuZW1pdHRlclNuYXBzaG90ID0gZnVuY3Rpb24gKHR5cGUpIHtcbiAgICB2YXIgZXQgPSAoZXZ0W3R5cGVdIHx8IFtdKS5zbGljZSgwKTtcbiAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgdmFyIGFyZ3MgPSBhdG9hKGFyZ3VtZW50cyk7XG4gICAgICB2YXIgY3R4ID0gdGhpcyB8fCB0aGluZztcbiAgICAgIGlmICh0eXBlID09PSAnZXJyb3InICYmIG9wdHMudGhyb3dzICE9PSBmYWxzZSAmJiAhZXQubGVuZ3RoKSB7IHRocm93IGFyZ3MubGVuZ3RoID09PSAxID8gYXJnc1swXSA6IGFyZ3M7IH1cbiAgICAgIGV0LmZvckVhY2goZnVuY3Rpb24gZW1pdHRlciAobGlzdGVuKSB7XG4gICAgICAgIGlmIChvcHRzLmFzeW5jKSB7IGRlYm91bmNlKGxpc3RlbiwgYXJncywgY3R4KTsgfSBlbHNlIHsgbGlzdGVuLmFwcGx5KGN0eCwgYXJncyk7IH1cbiAgICAgICAgaWYgKGxpc3Rlbi5fb25jZSkgeyB0aGluZy5vZmYodHlwZSwgbGlzdGVuKTsgfVxuICAgICAgfSk7XG4gICAgICByZXR1cm4gdGhpbmc7XG4gICAgfTtcbiAgfTtcbiAgcmV0dXJuIHRoaW5nO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIGN1c3RvbUV2ZW50ID0gcmVxdWlyZSgnY3VzdG9tLWV2ZW50Jyk7XG52YXIgZXZlbnRtYXAgPSByZXF1aXJlKCcuL2V2ZW50bWFwJyk7XG52YXIgZG9jID0gZ2xvYmFsLmRvY3VtZW50O1xudmFyIGFkZEV2ZW50ID0gYWRkRXZlbnRFYXN5O1xudmFyIHJlbW92ZUV2ZW50ID0gcmVtb3ZlRXZlbnRFYXN5O1xudmFyIGhhcmRDYWNoZSA9IFtdO1xuXG5pZiAoIWdsb2JhbC5hZGRFdmVudExpc3RlbmVyKSB7XG4gIGFkZEV2ZW50ID0gYWRkRXZlbnRIYXJkO1xuICByZW1vdmVFdmVudCA9IHJlbW92ZUV2ZW50SGFyZDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIGFkZDogYWRkRXZlbnQsXG4gIHJlbW92ZTogcmVtb3ZlRXZlbnQsXG4gIGZhYnJpY2F0ZTogZmFicmljYXRlRXZlbnRcbn07XG5cbmZ1bmN0aW9uIGFkZEV2ZW50RWFzeSAoZWwsIHR5cGUsIGZuLCBjYXB0dXJpbmcpIHtcbiAgcmV0dXJuIGVsLmFkZEV2ZW50TGlzdGVuZXIodHlwZSwgZm4sIGNhcHR1cmluZyk7XG59XG5cbmZ1bmN0aW9uIGFkZEV2ZW50SGFyZCAoZWwsIHR5cGUsIGZuKSB7XG4gIHJldHVybiBlbC5hdHRhY2hFdmVudCgnb24nICsgdHlwZSwgd3JhcChlbCwgdHlwZSwgZm4pKTtcbn1cblxuZnVuY3Rpb24gcmVtb3ZlRXZlbnRFYXN5IChlbCwgdHlwZSwgZm4sIGNhcHR1cmluZykge1xuICByZXR1cm4gZWwucmVtb3ZlRXZlbnRMaXN0ZW5lcih0eXBlLCBmbiwgY2FwdHVyaW5nKTtcbn1cblxuZnVuY3Rpb24gcmVtb3ZlRXZlbnRIYXJkIChlbCwgdHlwZSwgZm4pIHtcbiAgdmFyIGxpc3RlbmVyID0gdW53cmFwKGVsLCB0eXBlLCBmbik7XG4gIGlmIChsaXN0ZW5lcikge1xuICAgIHJldHVybiBlbC5kZXRhY2hFdmVudCgnb24nICsgdHlwZSwgbGlzdGVuZXIpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGZhYnJpY2F0ZUV2ZW50IChlbCwgdHlwZSwgbW9kZWwpIHtcbiAgdmFyIGUgPSBldmVudG1hcC5pbmRleE9mKHR5cGUpID09PSAtMSA/IG1ha2VDdXN0b21FdmVudCgpIDogbWFrZUNsYXNzaWNFdmVudCgpO1xuICBpZiAoZWwuZGlzcGF0Y2hFdmVudCkge1xuICAgIGVsLmRpc3BhdGNoRXZlbnQoZSk7XG4gIH0gZWxzZSB7XG4gICAgZWwuZmlyZUV2ZW50KCdvbicgKyB0eXBlLCBlKTtcbiAgfVxuICBmdW5jdGlvbiBtYWtlQ2xhc3NpY0V2ZW50ICgpIHtcbiAgICB2YXIgZTtcbiAgICBpZiAoZG9jLmNyZWF0ZUV2ZW50KSB7XG4gICAgICBlID0gZG9jLmNyZWF0ZUV2ZW50KCdFdmVudCcpO1xuICAgICAgZS5pbml0RXZlbnQodHlwZSwgdHJ1ZSwgdHJ1ZSk7XG4gICAgfSBlbHNlIGlmIChkb2MuY3JlYXRlRXZlbnRPYmplY3QpIHtcbiAgICAgIGUgPSBkb2MuY3JlYXRlRXZlbnRPYmplY3QoKTtcbiAgICB9XG4gICAgcmV0dXJuIGU7XG4gIH1cbiAgZnVuY3Rpb24gbWFrZUN1c3RvbUV2ZW50ICgpIHtcbiAgICByZXR1cm4gbmV3IGN1c3RvbUV2ZW50KHR5cGUsIHsgZGV0YWlsOiBtb2RlbCB9KTtcbiAgfVxufVxuXG5mdW5jdGlvbiB3cmFwcGVyRmFjdG9yeSAoZWwsIHR5cGUsIGZuKSB7XG4gIHJldHVybiBmdW5jdGlvbiB3cmFwcGVyIChvcmlnaW5hbEV2ZW50KSB7XG4gICAgdmFyIGUgPSBvcmlnaW5hbEV2ZW50IHx8IGdsb2JhbC5ldmVudDtcbiAgICBlLnRhcmdldCA9IGUudGFyZ2V0IHx8IGUuc3JjRWxlbWVudDtcbiAgICBlLnByZXZlbnREZWZhdWx0ID0gZS5wcmV2ZW50RGVmYXVsdCB8fCBmdW5jdGlvbiBwcmV2ZW50RGVmYXVsdCAoKSB7IGUucmV0dXJuVmFsdWUgPSBmYWxzZTsgfTtcbiAgICBlLnN0b3BQcm9wYWdhdGlvbiA9IGUuc3RvcFByb3BhZ2F0aW9uIHx8IGZ1bmN0aW9uIHN0b3BQcm9wYWdhdGlvbiAoKSB7IGUuY2FuY2VsQnViYmxlID0gdHJ1ZTsgfTtcbiAgICBlLndoaWNoID0gZS53aGljaCB8fCBlLmtleUNvZGU7XG4gICAgZm4uY2FsbChlbCwgZSk7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHdyYXAgKGVsLCB0eXBlLCBmbikge1xuICB2YXIgd3JhcHBlciA9IHVud3JhcChlbCwgdHlwZSwgZm4pIHx8IHdyYXBwZXJGYWN0b3J5KGVsLCB0eXBlLCBmbik7XG4gIGhhcmRDYWNoZS5wdXNoKHtcbiAgICB3cmFwcGVyOiB3cmFwcGVyLFxuICAgIGVsZW1lbnQ6IGVsLFxuICAgIHR5cGU6IHR5cGUsXG4gICAgZm46IGZuXG4gIH0pO1xuICByZXR1cm4gd3JhcHBlcjtcbn1cblxuZnVuY3Rpb24gdW53cmFwIChlbCwgdHlwZSwgZm4pIHtcbiAgdmFyIGkgPSBmaW5kKGVsLCB0eXBlLCBmbik7XG4gIGlmIChpKSB7XG4gICAgdmFyIHdyYXBwZXIgPSBoYXJkQ2FjaGVbaV0ud3JhcHBlcjtcbiAgICBoYXJkQ2FjaGUuc3BsaWNlKGksIDEpOyAvLyBmcmVlIHVwIGEgdGFkIG9mIG1lbW9yeVxuICAgIHJldHVybiB3cmFwcGVyO1xuICB9XG59XG5cbmZ1bmN0aW9uIGZpbmQgKGVsLCB0eXBlLCBmbikge1xuICB2YXIgaSwgaXRlbTtcbiAgZm9yIChpID0gMDsgaSA8IGhhcmRDYWNoZS5sZW5ndGg7IGkrKykge1xuICAgIGl0ZW0gPSBoYXJkQ2FjaGVbaV07XG4gICAgaWYgKGl0ZW0uZWxlbWVudCA9PT0gZWwgJiYgaXRlbS50eXBlID09PSB0eXBlICYmIGl0ZW0uZm4gPT09IGZuKSB7XG4gICAgICByZXR1cm4gaTtcbiAgICB9XG4gIH1cbn1cbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIGV2ZW50bWFwID0gW107XG52YXIgZXZlbnRuYW1lID0gJyc7XG52YXIgcm9uID0gL15vbi87XG5cbmZvciAoZXZlbnRuYW1lIGluIGdsb2JhbCkge1xuICBpZiAocm9uLnRlc3QoZXZlbnRuYW1lKSkge1xuICAgIGV2ZW50bWFwLnB1c2goZXZlbnRuYW1lLnNsaWNlKDIpKTtcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGV2ZW50bWFwO1xuIiwiXG52YXIgTmF0aXZlQ3VzdG9tRXZlbnQgPSBnbG9iYWwuQ3VzdG9tRXZlbnQ7XG5cbmZ1bmN0aW9uIHVzZU5hdGl2ZSAoKSB7XG4gIHRyeSB7XG4gICAgdmFyIHAgPSBuZXcgTmF0aXZlQ3VzdG9tRXZlbnQoJ2NhdCcsIHsgZGV0YWlsOiB7IGZvbzogJ2JhcicgfSB9KTtcbiAgICByZXR1cm4gICdjYXQnID09PSBwLnR5cGUgJiYgJ2JhcicgPT09IHAuZGV0YWlsLmZvbztcbiAgfSBjYXRjaCAoZSkge1xuICB9XG4gIHJldHVybiBmYWxzZTtcbn1cblxuLyoqXG4gKiBDcm9zcy1icm93c2VyIGBDdXN0b21FdmVudGAgY29uc3RydWN0b3IuXG4gKlxuICogaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQVBJL0N1c3RvbUV2ZW50LkN1c3RvbUV2ZW50XG4gKlxuICogQHB1YmxpY1xuICovXG5cbm1vZHVsZS5leHBvcnRzID0gdXNlTmF0aXZlKCkgPyBOYXRpdmVDdXN0b21FdmVudCA6XG5cbi8vIElFID49IDlcbidmdW5jdGlvbicgPT09IHR5cGVvZiBkb2N1bWVudC5jcmVhdGVFdmVudCA/IGZ1bmN0aW9uIEN1c3RvbUV2ZW50ICh0eXBlLCBwYXJhbXMpIHtcbiAgdmFyIGUgPSBkb2N1bWVudC5jcmVhdGVFdmVudCgnQ3VzdG9tRXZlbnQnKTtcbiAgaWYgKHBhcmFtcykge1xuICAgIGUuaW5pdEN1c3RvbUV2ZW50KHR5cGUsIHBhcmFtcy5idWJibGVzLCBwYXJhbXMuY2FuY2VsYWJsZSwgcGFyYW1zLmRldGFpbCk7XG4gIH0gZWxzZSB7XG4gICAgZS5pbml0Q3VzdG9tRXZlbnQodHlwZSwgZmFsc2UsIGZhbHNlLCB2b2lkIDApO1xuICB9XG4gIHJldHVybiBlO1xufSA6XG5cbi8vIElFIDw9IDhcbmZ1bmN0aW9uIEN1c3RvbUV2ZW50ICh0eXBlLCBwYXJhbXMpIHtcbiAgdmFyIGUgPSBkb2N1bWVudC5jcmVhdGVFdmVudE9iamVjdCgpO1xuICBlLnR5cGUgPSB0eXBlO1xuICBpZiAocGFyYW1zKSB7XG4gICAgZS5idWJibGVzID0gQm9vbGVhbihwYXJhbXMuYnViYmxlcyk7XG4gICAgZS5jYW5jZWxhYmxlID0gQm9vbGVhbihwYXJhbXMuY2FuY2VsYWJsZSk7XG4gICAgZS5kZXRhaWwgPSBwYXJhbXMuZGV0YWlsO1xuICB9IGVsc2Uge1xuICAgIGUuYnViYmxlcyA9IGZhbHNlO1xuICAgIGUuY2FuY2VsYWJsZSA9IGZhbHNlO1xuICAgIGUuZGV0YWlsID0gdm9pZCAwO1xuICB9XG4gIHJldHVybiBlO1xufVxuIiwidmFyIHNpID0gdHlwZW9mIHNldEltbWVkaWF0ZSA9PT0gJ2Z1bmN0aW9uJywgdGljaztcbmlmIChzaSkge1xuICB0aWNrID0gZnVuY3Rpb24gKGZuKSB7IHNldEltbWVkaWF0ZShmbik7IH07XG59IGVsc2Uge1xuICB0aWNrID0gZnVuY3Rpb24gKGZuKSB7IHNldFRpbWVvdXQoZm4sIDApOyB9O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHRpY2s7IiwiKGZ1bmN0aW9uICgkLCBEcnVwYWwsIGRydXBhbFNldHRpbmdzLCBDS0VESVRPUikge1xuXG4gIERydXBhbC5iZWhhdmlvcnMuZHJhZ2dhYmxlSXRlbXMgPSB7XG4gICAgYXR0YWNoOiBmdW5jdGlvbiAoY29udGV4dCwgc2V0dGluZ3MpIHtcblxuICAgICAgJCgnLmRyYWdnYWJsZS1pdGVtcy1jb250YWluZXInKS5lYWNoKGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgaWYgKCEkKHRoaXMpLmhhc0NsYXNzKCdkcmFndWxhLXByb2Nlc3NlZCcpKSB7XG4gICAgICAgICAgaW5pdERyYWdnYWJsZUl0ZW1zKCQodGhpcykpO1xuICAgICAgICAgICQodGhpcykuYWRkQ2xhc3MoJ2RyYWd1bGEtcHJvY2Vzc2VkJyk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgfVxuICB9O1xuXG4gIC8vIE1ha2Ugc3VyZSB0aGlzIFdBUyBhIHd5c2l3eWcgaW5pdGlhbGx5LCBub3QgYW55IHRleHRhcmVhLCBtYXliZSBzZWxlY3RvcnMgb3Igc29tZXRoaW5nXG4gIGZ1bmN0aW9uIGluaXRDa2VkaXRvckZyb21TYXZlZFN0YXR1cyhlbCwgZHJhZ2dlZEl0ZW1zKSB7XG4gICAgJC5lYWNoKGRyYWdnZWRJdGVtcywgZnVuY3Rpb24oaSwgdmFsdWUpIHtcbiAgICAgIGlmICgkKGVsKS5maW5kKCcjJyt2YWx1ZS5pZCkubGVuZ3RoICYmIHZhbHVlLmNvbmZpZykge1xuICAgICAgICB2YXIgbmV3RWRpdG9yID0gQ0tFRElUT1IucmVwbGFjZSh2YWx1ZS5pZCwgdmFsdWUuY29uZmlnKTtcbiAgICAgICAgbmV3RWRpdG9yLm9uKCdpbnN0YW5jZVJlYWR5JywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgbmV3RWRpdG9yLnNldERhdGEodmFsdWUuY29udGVudCk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgZnVuY3Rpb24gaW5pdERyYWdnYWJsZUl0ZW1zKCRkcmFnZ2FibGVJdGVtQ29udGFpbmVycykge1xuICAgIC8vIERlY2xhcmUgdmFyaWFibGVzIGZvciB0aGUgY3VycmVudGx5IGRyYWdnZWQgaXRlbSBzbyB0aGV5IGNhbiBiZSBhY2Nlc3NlZCBpbiBhbnkgZXZlbiBoYW5kbGVyXG4gICAgdmFyIGRyYWdnZWRJdGVtcyA9IFtdO1xuXG4gICAgLy8gSW5pdGlhbGl6ZSBkcmFndWxhIG9uIGRyYWdnYWJsZSBjb250YWluZXJzXG4gICAgdmFyIGRyYWtlID0gZHJhZ3VsYShbJGRyYWdnYWJsZUl0ZW1Db250YWluZXJzWzBdXSwge1xuICAgICAgLy8gT25seSBoYW5kbGUgZHJhZ3MgaXRlbXNcbiAgICAgIG1vdmVzOiBmdW5jdGlvbiAoZWwsIGNvbnRhaW5lciwgaGFuZGxlKSB7XG4gICAgICAgIHJldHVybiAkKGVsKS5jaGlsZHJlbignLmRyYWd1bGEtaGFuZGxlJylbMF0gPT09ICQoaGFuZGxlKVswXTtcbiAgICAgIH0sXG4gICAgICAvLyBEcm9wIGNhbiBvbmx5IGhhcHBlbiBpbiBzb3VyY2UgZWxlbWVudFxuICAgICAgYWNjZXB0czogZnVuY3Rpb24gKGVsLCB0YXJnZXQsIHNvdXJjZSwgc2libGluZykge1xuICAgICAgICByZXR1cm4gdGFyZ2V0ID09PSBzb3VyY2U7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBPbiBkcm9wIHdlIG5lZWQgdG8gcmVjcmVhdGUgdGhlIGVkaXRvciBmcm9tIHNhdmVkIGNvbmZpZ1xuICAgIGRyYWtlLm9uKCdkcm9wJywgZnVuY3Rpb24oZWwsIHRhcmdldCwgc291cmNlLCBzaWJsaW5nKSB7XG4gICAgICBhZGp1c3RPcmRlcihkcmFrZSk7XG4gICAgICBpbml0Q2tlZGl0b3JGcm9tU2F2ZWRTdGF0dXMoZWwsIGRyYWdnZWRJdGVtcyk7XG4gICAgfSk7XG5cbiAgICAvLyBPbiBjYW5jZWwgd2UgbmVlZCB0byByZWNyZWF0ZSB0aGUgZWRpdG9yIGZyb20gc2F2ZWQgY29uZmlnXG4gICAgZHJha2Uub24oJ2NhbmNlbCcsIGZ1bmN0aW9uKGVsLCBjb250YWluZXIsIHNvdXJjZSkge1xuICAgICAgaW5pdENrZWRpdG9yRnJvbVNhdmVkU3RhdHVzKGVsLCBkcmFnZ2VkSXRlbXMpO1xuICAgIH0pO1xuXG4gICAgLy8gT24gZHJhZyBzdGFydCB3ZSBuZWVkIHRvIHNhdmUgdGhlIGNvbmZpZyBmcm9tIHRoZSBja2VkaXRvciBpbnN0YW5jZSBhbmQgZGVzdHJveSBpdFxuICAgIGRyYWtlLm9uKCdkcmFnJywgZnVuY3Rpb24oZWwsIHNvdXJjZSkge1xuICAgICAgLy8gT24gZHJhZyBzdGFydCwgcmVzZXQgdGhlIGFycmF5IHRvIGVtcHR5IHNvIHlvdSBkb24ndCB0cnkgdG8gaW5pdGlhbGl6ZSB0aGUgc2FtZSBlbGVtZW50IG11bHRpcGxlIHRpbWVzXG4gICAgICBkcmFnZ2VkSXRlbXMgPSBbXTtcbiAgICAgIC8vIEdldCBpZCBmcm9tIHRleHRhcmVhXG4gICAgICB2YXIgJHd5c2l3eWdzID0gJChlbCkuZmluZCgnLmNrZScpLnNpYmxpbmdzKCd0ZXh0YXJlYScpO1xuICAgICAgJHd5c2l3eWdzLmVhY2goZnVuY3Rpb24oaSwgZWwpIHtcbiAgICAgICAgdmFyIGRyYWdnZWRJdGVtSWQgPSAkKHRoaXMpLmF0dHIoJ2lkJyk7XG4gICAgICAgIGlmIChDS0VESVRPUi5pbnN0YW5jZXNbZHJhZ2dlZEl0ZW1JZF0pIHtcbiAgICAgICAgICB2YXIgZHJhZ2dlZEl0ZW1JbnN0YW5jZSA9IENLRURJVE9SLmluc3RhbmNlc1tkcmFnZ2VkSXRlbUlkXTtcbiAgICAgICAgICB2YXIgZHJhZ2dlZEl0ZW1Db25maWcgPSBkcmFnZ2VkSXRlbUluc3RhbmNlLmNvbmZpZztcbiAgICAgICAgICB2YXIgZHJhZ2dlZEl0ZW1Db250ZW50ID0gZHJhZ2dlZEl0ZW1JbnN0YW5jZS5nZXREYXRhKCk7XG4gICAgICAgICAgZHJhZ2dlZEl0ZW1zLnB1c2goe1xuICAgICAgICAgICAgaWQ6IGRyYWdnZWRJdGVtSWQsXG4gICAgICAgICAgICBpbnN0YW5jZTogZHJhZ2dlZEl0ZW1JbnN0YW5jZSxcbiAgICAgICAgICAgIGNvbmZpZzogZHJhZ2dlZEl0ZW1Db25maWcsXG4gICAgICAgICAgICBjb250ZW50OiBkcmFnZ2VkSXRlbUNvbnRlbnRcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBpZiAoZHJhZ2dlZEl0ZW1JbnN0YW5jZSkgeyBkcmFnZ2VkSXRlbUluc3RhbmNlLmRlc3Ryb3kodHJ1ZSk7IH1cbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICAvLyBJbml0IGRvbS1hdXRvc2Nyb2xsZXIgZm9yIGVhY2ggZHJha2UgaW5zdGFuY2VcbiAgICB2YXIgc2Nyb2xsID0gYXV0b1Njcm9sbChbXG4gICAgICB3aW5kb3dcbiAgICBdLHtcbiAgICAgIG1hcmdpbjogNzAsXG4gICAgICBtYXhTcGVlZDogMTQsXG4gICAgICBhdXRvU2Nyb2xsOiBmdW5jdGlvbigpe1xuICAgICAgICByZXR1cm4gdGhpcy5kb3duICYmIGRyYWtlLmRyYWdnaW5nO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgZnVuY3Rpb24gYWRqdXN0T3JkZXIoZHJhZ3VsYU9iamVjdCkge1xuICAgIHZhciAkZHJhZ2dhYmxlSXRlbXMgPSAkKGRyYWd1bGFPYmplY3QuY29udGFpbmVyc1swXSkuY2hpbGRyZW4oKTtcbiAgICAkZHJhZ2dhYmxlSXRlbXMuZWFjaChmdW5jdGlvbihpLCBlbCkge1xuICAgICAgLy8gQmVjYXVzZSBkcnVwYWwgaGFzIG5vIHVzZWZ1bCBzZWxlY3RvcnMgb24gdGhlIGFkbWluIHNpZGUgYW5kIGFkZHMgd3JhcHBlcnMgZm9yIG5ld2x5IGNyZWF0ZWQgcGFyYWdyYXBocyxcbiAgICAgIC8vIHdlIG5lZWQgdG8gZG8gdGhpcyBoYW5reSBwYW5reSB0byBtYWtlIHN1cmUgd2UgYXJlIG9ubHkgYWRqdXN0aW5nIHRoZSB3ZWlnaHRzIG9mIHRoZSBjdXJyZW50bHkgYWRqdXN0ZWQgaXRlbXNcbiAgICAgIHZhciAkd2VpZ2h0U2VsZWN0ID0gJCh0aGlzKS5jaGlsZHJlbignZGl2JykuY2hpbGRyZW4oJ2RpdicpLmNoaWxkcmVuKCcuZm9ybS10eXBlLXNlbGVjdCcpLmNoaWxkcmVuKCdzZWxlY3QnKSxcbiAgICAgICAgICAkd2VpZ2h0U2VsZWN0QWpheCA9ICQodGhpcykuY2hpbGRyZW4oJy5hamF4LW5ldy1jb250ZW50JykuY2hpbGRyZW4oJ2RpdicpLmNoaWxkcmVuKCdkaXYnKS5jaGlsZHJlbignLmZvcm0tdHlwZS1zZWxlY3QnKS5jaGlsZHJlbignc2VsZWN0Jyk7XG4gICAgICBpZiAoJHdlaWdodFNlbGVjdC5sZW5ndGggPiAwKSB7XG4gICAgICAgICR3ZWlnaHRTZWxlY3QudmFsKGkpO1xuICAgICAgfSBlbHNlIGlmICgkd2VpZ2h0U2VsZWN0QWpheC5sZW5ndGggPiAwKSB7XG4gICAgICAgICR3ZWlnaHRTZWxlY3RBamF4LnZhbChpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdFcnJvcjogQ2Fubm90IGZpbmQgdmFsaWQgcGFyYWdyYXBoIHdlaWdodCB0byBhZGp1c3QhJyk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxufSkoalF1ZXJ5LCBEcnVwYWwsIGRydXBhbFNldHRpbmdzLCBDS0VESVRPUik7IiwiLyoqXG4gKiBAZmlsZSBlbnRpdHktYnJvd3Nlci1pbXByb3ZlbWVudHMuanNcbiAqXG4gKiBBZGRzIGV4dHJhIFVJIGltcHJvdmVtZW50cyB0byBhbGwgZW50aXR5IGJyb3dzZXJzIGluIHRoZSBhZG1pbiB0aGVtZS5cbiAqL1xuXG4hZnVuY3Rpb24oJCl7XG4gIFwidXNlIHN0cmljdFwiO1xuXG4gIERydXBhbC5iZWhhdmlvcnMuZW50aXR5QnJvd3NlckltcHJvdmVyID0ge1xuICAgIGF0dGFjaDogZnVuY3Rpb24oY29udGV4dCwgc2V0dGluZ3MpIHtcbiAgICAgIC8vIEFkZCAudmlldy1lbnRpdHktYnJvd3Nlci1CUk9XU0VSLU5BTUUgdG8gdGhpcyBsaXN0IGZvciBicm93c2VycyB5b3Ugd2FudCB0byBhZGQgdGhlIGNsaWNrIGl0ZW0gZnVuY3Rpb25hbGl0eVxuICAgICAgbGV0ICRicm93c2VyU2VsZWN0b3JzID0gW1xuICAgICAgICAnLnZpZXctZW50aXR5LWJyb3dzZXItaW1hZ2UnLFxuICAgICAgICAnLnZpZXctZW50aXR5LWJyb3dzZXItdmlkZW8nLFxuICAgICAgICAnLnZpZXctZW50aXR5LWJyb3dzZXItc3ZnJ1xuICAgICAgXTtcblxuICAgICAgbGV0ICRicm93c2VyQ29sID0gJCgkYnJvd3NlclNlbGVjdG9ycy5qb2luKCcsICcpLCBjb250ZXh0KS5maW5kKCcudmlld3Mtcm93Jyk7XG5cbiAgICAgICRicm93c2VyQ29sLmNsaWNrKGZ1bmN0aW9uKCkge1xuICAgICAgICBjb25zdCAkY29sID0gJCh0aGlzKTtcblxuICAgICAgICBpZiAoJGNvbC5oYXNDbGFzcygnY29sdW1uLXNlbGVjdGVkJykpIHtcbiAgICAgICAgICB1bmNoZWNrQ29sdW1uKCRjb2wpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgICRicm93c2VyQ29sLmVhY2goZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdW5jaGVja0NvbHVtbigkKHRoaXMpKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY2hlY2tDb2x1bW4oJGNvbCk7XG4gICAgICB9KTtcbiAgICB9XG4gIH07XG5cbiAgZnVuY3Rpb24gdW5jaGVja0NvbHVtbigkdGFyZ2V0KSB7XG4gICAgJHRhcmdldC5maW5kKCdpbnB1dFt0eXBlPVwiY2hlY2tib3hcIl0nKS5wcm9wKFwiY2hlY2tlZFwiLCBmYWxzZSk7XG4gICAgJHRhcmdldC5yZW1vdmVDbGFzcygnY29sdW1uLXNlbGVjdGVkJyk7XG4gIH1cblxuICBmdW5jdGlvbiBjaGVja0NvbHVtbigkdGFyZ2V0KSB7XG4gICAgJHRhcmdldC5maW5kKCdpbnB1dFt0eXBlPVwiY2hlY2tib3hcIl0nKS5wcm9wKFwiY2hlY2tlZFwiLCB0cnVlKTtcbiAgICAkdGFyZ2V0LmFkZENsYXNzKCdjb2x1bW4tc2VsZWN0ZWQnKTtcbiAgfVxufShqUXVlcnkpOyIsIi8qKlxuICogcGFyYWdyYXBocy1pbXByb3ZlbWVudHMuanNcbiAqIEltcHJvdmUgdGhlIHBhcmFncmFwaHMgYWRtaW4gdWlcbiAqL1xuXG4hZnVuY3Rpb24oJCl7XG4gIFwidXNlIHN0cmljdFwiO1xuXG4gIERydXBhbC5iZWhhdmlvcnMucGFyYWdyYXBoc1ByZXZpZXdlckltcHJvdmVyID0ge1xuICAgIGF0dGFjaDogZnVuY3Rpb24oY29udGV4dCwgc2V0dGluZ3MpIHtcbiAgICAgIHZhciAkcHJldmlld2VyQnV0dG9ucyA9ICQoJy5saW5rLnBhcmFncmFwaHMtcHJldmlld2VyJywgY29udGV4dCk7XG5cbiAgICAgICRwcmV2aWV3ZXJCdXR0b25zLmVhY2goKGksIGVsKSA9PiB7XG4gICAgICAgIHZhciAkcHJldmlld2VyQnV0dG9uID0gJChlbCk7XG4gICAgICAgIHJlcGxhY2VQYXJhZ3JhcGhOYW1lKCRwcmV2aWV3ZXJCdXR0b24pO1xuICAgICAgfSk7XG5cbiAgICAgIC8vIEdldCBwYXJhZ3JhcGhzIHByZXZpZXdzIGJ5IG9ubHkgdGFyZ2V0aW5nIG9uZXMgd2l0aCB0aGUgLnBhcmFncmFwaC10eXBlLXRvcCBhcyBhIHNpYmxpbmdcbiAgICAgIC8vIHNvIG5lc3RlZCBwYXJhZ3JhcGhzIHByZXZpZXdzIGRvbid0IGJyZWFrXG4gICAgICB2YXIgJHBhcmFncmFwaHNUb3BFbGVtZW50cyA9ICQoJy5wYXJhZ3JhcGgtdHlwZS10b3AnLCBjb250ZXh0KTtcbiAgICAgIHZhciAkcGFyYWdyYXBoc1ByZXZpZXdzID0gJHBhcmFncmFwaHNUb3BFbGVtZW50cy5zaWJsaW5ncygnLnBhcmFncmFwaC0tdmlldy1tb2RlLS1wcmV2aWV3Jyk7XG5cbiAgICAgIGZvcm1hdFBhcmFncmFwaHNQcmV2aWV3cygkcGFyYWdyYXBoc1ByZXZpZXdzKTtcblxuICAgICAgLy8gTmVjZXNzYXJ5IGZvciBwYXJhZ3JhcGhzIHByZXZpZXdzIGJlaGluZCB0YWJzXG4gICAgICAkKCcudmVydGljYWwtdGFic19fbWVudSBhJykub24oXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICAgIGZvcm1hdFBhcmFncmFwaHNQcmV2aWV3cygkcGFyYWdyYXBoc1ByZXZpZXdzKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfTtcblxuICAvLyBCZWNhdXNlIGRydXBhbCBiZWhhdmlvcnMgYXJlIHNvIGFubm95aW5nLCBhZGQgZGVsZWdhdGVkIGNsaWNrIGhhbmRsZXIgaGVyZSwgY291bGRuJ3QgZ2V0IGl0IHRvIHdvcmsgcHJvcGVybHlcbiAgLy8gaW5zaWRlIHRoZSBiZWhhdmlvclxuICAkKGRvY3VtZW50KS5yZWFkeShmdW5jdGlvbigpIHtcbiAgICAkKCdib2R5Jykub24oJ2NsaWNrJywgJy5wYXJhZ3JhcGgtLXZpZXctbW9kZS0tcHJldmlldycsIGZ1bmN0aW9uKCkge1xuICAgICAgJCh0aGlzKS50b2dnbGVDbGFzcygnZXhwYW5kZWQnKTtcbiAgICB9KTtcbiAgfSk7XG5cbiAgLyoqXG4gICAqIEFkZCB0aGUgdHlwZSB0byB0aGUgcHJldmlld2VyIGJ1dHRvbiBpZiB5b3Ugd2FudFxuICAgKiBAcGFyYW0gcHJldmlld2VyQnV0dG9uXG4gICAqL1xuICBmdW5jdGlvbiByZXBsYWNlUGFyYWdyYXBoTmFtZShwcmV2aWV3ZXJCdXR0b24pIHtcbiAgICB2YXIgcGFyYWdyYXBoTmFtZSA9IHByZXZpZXdlckJ1dHRvbi5zaWJsaW5ncygnLnBhcmFncmFwaC10eXBlLXRpdGxlJykudGV4dCgpO1xuICAgIHByZXZpZXdlckJ1dHRvbi52YWwoYFByZXZpZXc6ICR7cGFyYWdyYXBoTmFtZX1gKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBGb3JtYXQgdGhlIHByZXZpZXdzIHRvIGJlIGV4cGFuZGFibGVcbiAgICogQHBhcmFtIHBhcmFncmFwaHNQcmV2aWV3c1xuICAgKi9cbiAgZnVuY3Rpb24gZm9ybWF0UGFyYWdyYXBoc1ByZXZpZXdzKHBhcmFncmFwaHNQcmV2aWV3cykge1xuICAgIHBhcmFncmFwaHNQcmV2aWV3cy5lYWNoKChpLCBlbCkgPT4ge1xuICAgICAgdmFyICR0aGlzID0gJChlbCk7XG4gICAgICBpZiAoJHRoaXMub3V0ZXJIZWlnaHQoKSA+PSAxMDApIHtcbiAgICAgICAgJHRoaXMuYWRkQ2xhc3MoJ2V4cGFuZGFibGUnKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG59KGpRdWVyeSk7IiwiLyoqXG4gKiBAZmlsZSBpbmplY3Qtc3ZnLmpzXG4gKlxuICogVXNlIHN2Zy1pbmplY3Rvci5qcyB0byByZXBsYWNlIGFuIHN2ZyA8aW1nPiB0YWcgd2l0aCB0aGUgaW5saW5lIHN2Zy5cbiAqL1xuXG4hZnVuY3Rpb24oJCl7XG4gIFwidXNlIHN0cmljdFwiO1xuXG4gICQoZnVuY3Rpb24oKSB7XG4gICAgLy8gRWxlbWVudHMgdG8gaW5qZWN0XG4gICAgbGV0IG15U1ZHc1RvSW5qZWN0ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnaW1nLmluamVjdC1tZScpO1xuXG4gICAgLy8gRG8gdGhlIGluamVjdGlvblxuICAgIFNWR0luamVjdG9yKG15U1ZHc1RvSW5qZWN0KTtcbiAgfSk7XG5cbn0oalF1ZXJ5KTsiXX0=
