/**
 * @file
 * wiche · minimal theme behaviours. Vanilla JS via Drupal behaviors + once().
 */
((Drupal, once) => {
  'use strict';

  // Mobile primary-nav toggle.
  Drupal.behaviors.wicheNavToggle = {
    attach(context) {
      once('wiche-nav-toggle', '[data-nav-toggle]', context).forEach((btn) => {
        const nav = document.getElementById(btn.getAttribute('aria-controls'));
        btn.addEventListener('click', () => {
          const open = btn.getAttribute('aria-expanded') === 'true';
          btn.setAttribute('aria-expanded', String(!open));
          if (nav) nav.classList.toggle('is-open', !open);
        });
      });
    },
  };
})(Drupal, once);
