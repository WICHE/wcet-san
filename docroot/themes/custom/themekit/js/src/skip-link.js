/**
 * @file
 * Skip link for accessibility
 */
import $ from 'jquery';

let $skipLinkHolder = $('#skip-to-content'),
  $skipLink = $skipLinkHolder.find('.skip-to-content-link');

$skipLink.on('click', function(e) {
  e.preventDefault();
  let $target = $($(this).attr('href'));
  $target.attr('tabindex', '-1');
  $target.focus();
  $target.on('blur focusout', function() {
    $(this).removeAttr('tabindex');
  });
});