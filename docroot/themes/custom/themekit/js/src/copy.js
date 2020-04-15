/**
 * @file
 *
 * Implement Select upgrades
 *
 */

import $ from 'jquery';
// import './foundation-setup';
import Clipboard from 'clipboard';
import { Tooltip } from 'foundation-sites/js/foundation.tooltip';

let $copyText = $('.has-tip');

if ($copyText.length) {
  let clipboard = new Clipboard('.has-tip');
  new Tooltip($copyText);

  clipboard.on('success', function(e) {
    if (e.action === 'copy') {
      $copyText.foundation('show');
      setTimeout(hideToolTip, 2000);
    }
  });
}


function hideToolTip() {
  $copyText.foundation('hide');
}
