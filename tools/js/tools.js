/* ==========================================================================
   Riool Tools — интерактив: липкая шапка, мобильное меню, появление при скролле
   ========================================================================== */
(function () {
  'use strict';

  var doc = document.documentElement;
  doc.classList.remove('no-js');

  function initHeader() {
    var header = document.querySelector('.site-header');
    if (!header) return;
    var onScroll = function () {
      header.classList.toggle('is-stuck', window.scrollY > 8);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  function initMobileMenu() {
    var burger = document.getElementById('burger');
    var nav = document.getElementById('primary-nav');
    if (!burger || !nav) return;

    var close = function () {
      nav.classList.remove('is-open');
      burger.setAttribute('aria-expanded', 'false');
      burger.setAttribute('aria-label', 'Открыть меню');
    };

    burger.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    });

    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) close();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
    });
  }

  function initReveal() {
    var items = document.querySelectorAll('.reveal');
    if (!items.length) return;

    if (!('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

    items.forEach(function (el) { observer.observe(el); });
  }

  function initCardVideo() {
    var videos = document.querySelectorAll('.card__video, .cinema-poster__video');
    if (!videos.length) return;

    Array.prototype.forEach.call(videos, function (video) {
      video.muted = true;
      video.loop = true;

      var play = function () {
        if (video.paused) {
          var p = video.play();
          if (p && typeof p.catch === 'function') p.catch(function () {});
        }
      };

      if (video.readyState >= 2) play();
      ['loadeddata', 'canplay', 'canplaythrough'].forEach(function (evt) {
        video.addEventListener(evt, play);
      });
      // Подстраховка: если браузер отложил автозапуск до первого взаимодействия
      document.addEventListener('pointerdown', play, { once: true });
      document.addEventListener('touchstart', play, { once: true, passive: true });
      document.addEventListener('visibilitychange', function () {
        if (!document.hidden) play();
      });
    });
  }

  function initYear() {
    var year = document.querySelectorAll('[data-year]');
    var current = String(new Date().getFullYear());
    year.forEach(function (el) { el.textContent = current; });
  }

  function init() {
    initHeader();
    initMobileMenu();
    initReveal();
    initCardVideo();
    initYear();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
