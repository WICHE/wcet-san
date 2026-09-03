/**
 * @file wiche · behaviours — mobile nav toggle + accessible mega-menu.
 * Build-less vanilla JS on Drupal.behaviors + core/once.
 */
((Drupal, once) => {
  'use strict';

  // --- Mobile nav open/close --------------------------------------------
  Drupal.behaviors.wicheNavToggle = {
    attach(context) {
      once('wiche-nav-toggle', '[data-nav-toggle]', context).forEach((btn) => {
        const nav = document.getElementById(btn.getAttribute('aria-controls'));
        if (!nav) return;
        btn.addEventListener('click', () => {
          const open = nav.classList.toggle('is-open');
          btn.setAttribute('aria-expanded', String(open));
        });
      });
    },
  };

  // --- Mega-menu: hover on desktop (CSS), click/keyboard everywhere ------
  Drupal.behaviors.wicheMegaMenu = {
    attach(context) {
      const items = once(
        'wiche-mega',
        '.main-nav > ul > li:has(.menu-dropdown)',
        context,
      );

      const closeAll = (except) => {
        items.forEach((li) => {
          if (li !== except) {
            li.classList.remove('is-open');
            const t = li.querySelector(':scope > a');
            if (t) t.setAttribute('aria-expanded', 'false');
          }
        });
      };

      items.forEach((li) => {
        const trigger = li.querySelector(':scope > a');
        if (!trigger) return;
        trigger.setAttribute('aria-haspopup', 'true');
        trigger.setAttribute('aria-expanded', 'false');

        // On touch / when the target is the parent link, toggle instead of navigate.
        trigger.addEventListener('click', (e) => {
          // Let real navigation happen on desktop hover users via keyboard Enter;
          // here we toggle the panel for touch + click users.
          if (window.matchMedia('(hover: none), (max-width: 1080px)').matches) {
            e.preventDefault();
            const open = !li.classList.contains('is-open');
            closeAll(li);
            li.classList.toggle('is-open', open);
            trigger.setAttribute('aria-expanded', String(open));
          }
        });

        // Escape closes and returns focus to the trigger.
        li.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
            li.classList.remove('is-open');
            trigger.setAttribute('aria-expanded', 'false');
            trigger.focus();
          }
        });
      });

      // Click outside closes any open panel.
      once('wiche-mega-doc', 'body', context).forEach((body) => {
        body.addEventListener('click', (e) => {
          if (!e.target.closest('.main-nav')) closeAll(null);
        });
      });
    },
  };
})(Drupal, once);
