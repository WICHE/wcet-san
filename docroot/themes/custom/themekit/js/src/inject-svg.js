/**
 * @file inject-svg.js
 *
 * Use svg-injector.js to replace an svg <img> tag with the inline svg.
 */
import SVGInjector from 'svg-injector';

// Elements to inject
let mySVGsToInject = document.querySelectorAll('img.inject-me');

// Do the injection
SVGInjector(mySVGsToInject, {
  each: function(svg) {
    svg.setAttribute('width', '');
    svg.setAttribute('height', '');
  }
});