/**
 * @file wiche · behaviours — mobile nav toggle + accessible mega-menu.
 * Build-less vanilla JS on Drupal.behaviors + core/once.
 */
((Drupal, once) => {
  'use strict';

  const MOBILE = '(hover: none), (max-width: 1080px)';

  const closeOverlay = (nav) => {
    nav.classList.remove('is-open');
    const toggle = document.querySelector('[data-nav-toggle]');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('is-nav-open');
    // reset any drilled-in submenu so it reopens at the top level
    nav.querySelectorAll('li.is-open').forEach((li) => {
      li.classList.remove('is-open');
      const t = li.querySelector(':scope > a');
      if (t) t.setAttribute('aria-expanded', 'false');
    });
  };

  // --- Mobile nav open/close --------------------------------------------
  Drupal.behaviors.wicheNavToggle = {
    attach(context) {
      once('wiche-nav-toggle', '[data-nav-toggle]', context).forEach((btn) => {
        const nav = document.getElementById(btn.getAttribute('aria-controls'));
        if (!nav) return;
        btn.addEventListener('click', () => {
          const open = nav.classList.toggle('is-open');
          btn.setAttribute('aria-expanded', String(open));
          document.body.classList.toggle('is-nav-open', open);
          if (!open) closeOverlay(nav);
        });
      });
    },
  };

  // --- Mobile drill-down chrome (Figma 28:1954) -------------------------
  // Injects the overlay top strip (search + close), a sticky footer CTA, a
  // "Back" bar per submenu, and clones the utility links into the list foot.
  Drupal.behaviors.wicheMobileNav = {
    attach(context) {
      once('wiche-mobile-nav', '.main-nav', context).forEach((nav) => {
        const searchIcon =
          '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" ' +
          'stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">' +
          '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';

        // Top strip: search + close.
        const top = document.createElement('div');
        top.className = 'mobile-nav__top';
        top.innerHTML =
          '<a class="mobile-nav__search" href="/search" aria-label="' +
          Drupal.t('Search') + '">' + searchIcon + '</a>' +
          '<span class="divider" aria-hidden="true"></span>' +
          '<button type="button" class="mobile-nav__close" aria-label="' +
          Drupal.t('Close menu') + '">✕</button>';
        nav.insertBefore(top, nav.firstChild);
        top.querySelector('.mobile-nav__close')
          .addEventListener('click', () => closeOverlay(nav));

        // A "Back" bar at the top of every submenu panel.
        nav.querySelectorAll('ul.menu--main > li.has-dropdown').forEach((li) => {
          const dd = li.querySelector(':scope > .menu-dropdown');
          const trigger = li.querySelector(':scope > a');
          if (!dd || !trigger) return;
          const back = document.createElement('button');
          back.type = 'button';
          back.className = 'menu-dropdown__back';
          back.textContent = trigger.textContent.trim();
          back.addEventListener('click', () => {
            li.classList.remove('is-open');
            trigger.setAttribute('aria-expanded', 'false');
          });
          dd.insertBefore(back, dd.firstChild);
        });

        // Bottom block (light-blue): the tertiary links + the "Join SAN / Login"
        // CTA. The utility bar is hidden on mobile, so its links (except Search,
        // which is in the top strip) live here as a smaller, tinted list.
        const bottom = document.createElement('div');
        bottom.className = 'mobile-nav__bottom';
        const util = document.querySelector(
          '.site-header__utility .utility-nav ul, .site-header__utility ul',
        );
        if (util) {
          const list = document.createElement('ul');
          list.className = 'mobile-nav__tertiary';
          util.querySelectorAll(':scope > li').forEach((li) => {
            const link = li.querySelector('a');
            if (!link || /\/search(\b|$)/.test(link.getAttribute('href') || '')) return;
            const item = document.createElement('li');
            item.appendChild(link.cloneNode(true));
            list.appendChild(item);
          });
          if (list.children.length) bottom.appendChild(list);
        }
        const cta = document.createElement('div');
        cta.className = 'mobile-nav__cta';
        cta.innerHTML =
          '<a href="/membership">' + Drupal.t('Join SAN / Login') + '</a>';
        bottom.appendChild(cta);
        nav.appendChild(bottom);

        // Escape closes the overlay.
        nav.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') closeOverlay(nav);
        });
      });
    },
  };

  // --- Mega-menu: hover on desktop (CSS), click/keyboard everywhere ------
  Drupal.behaviors.wicheMegaMenu = {
    attach(context) {
      const items = once(
        'wiche-mega',
        '.main-nav ul.menu--main > li.has-dropdown',
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

        // On touch / mobile, the parent link drills into its submenu instead
        // of navigating; on desktop it stays a normal link (CSS hover opens).
        trigger.addEventListener('click', (e) => {
          if (window.matchMedia(MOBILE).matches) {
            e.preventDefault();
            const open = !li.classList.contains('is-open');
            closeAll(li);
            li.classList.toggle('is-open', open);
            trigger.setAttribute('aria-expanded', String(open));
          }
        });

        // Desktop: hovering an item closes any other panel left open (e.g. a
        // stray is-open from a touch tap) so two dropdowns never overlap.
        li.addEventListener('mouseenter', () => {
          if (window.matchMedia('(hover: hover) and (min-width: 1081px)').matches) closeAll(li);
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

      // Click outside closes any open panel (desktop).
      once('wiche-mega-doc', 'body', context).forEach((body) => {
        body.addEventListener('click', (e) => {
          if (!e.target.closest('.main-nav')) closeAll(null);
        });
      });
    },
  };
})(Drupal, once);
