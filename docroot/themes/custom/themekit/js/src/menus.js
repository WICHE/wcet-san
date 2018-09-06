/**
 * EXAMPLE FOUNDATION COMPONENT USAGE
 *
 * Include all of your dependencies. For any foundation components this will include
 * jQuery and the foundation setup js file.
 *
 * The include the module from the `foundation-sites/js/` dir as shown below.
 */

import $ from 'jquery';
import './foundation-setup';
import { ResponsiveMenu } from 'foundation-sites/js/foundation.responsiveMenu';

new ResponsiveMenu($('.block-menu.menu--main > ul'));




$(window).on('changed.zf.mediaquery', function(event, newSize, oldSize) {
  const bpSmall = ['small', 'sm-md'],
    bpDesktop = ['medium', 'large', 'xlarge', 'xxlarge'];

  if ($.inArray( oldSize, bpSmall ) >= 0 && $.inArray( newSize, bpDesktop ) >= 0) {
    removeClonedNav();
  } else if ($.inArray( oldSize, bpDesktop ) >= 0 && $.inArray( newSize, bpSmall ) >= 0) {
    cloneNav();
  }
});

const blocksToClone = ['block-utilnavigation'];

function cloneNav() {
  const $nav = $('.region-header .menu--main');

  for (let i in blocksToClone) {
    let e = blocksToClone[i];
    $('#' + e).clone().attr('id', e + '-cloned').prependTo($nav);
  }
}

function removeClonedNav() {
  for (let i in blocksToClone) {
    let block = '#' + blocksToClone[i] + '-cloned';
    if ($(block).length) {
      $(block).detach();
    }
  }

}

if (Foundation.MediaQuery.atLeast('large')) {
  removeClonedNav();
} else {
  cloneNav();
}

/// Mobile Button
let $mobileMenuButton = $('.menu-button');
let $mainNav = $('.menu--main');
let $container = $('.layout-container');

$mobileMenuButton.click(function (e) {
  e.preventDefault();
  $(this).toggleClass('active');
  $mainNav.toggleClass('open');
  $container.toggleClass('mobile-menu-open');
});
