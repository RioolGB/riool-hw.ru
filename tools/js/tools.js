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

  /* --- Логин-гейт кинотеатра ------------------------------------------- */
  function initGate() {
    var gate = document.getElementById('login-gate');
    if (!gate) return; // не лендинг

    var form = document.getElementById('gate-form');
    var user = document.getElementById('gate-user');
    var pass = document.getElementById('gate-pass');
    var error = document.getElementById('gate-error');
    var submit = document.getElementById('gate-submit');
    var submitText = document.getElementById('gate-submit-text');
    var closeBtn = document.getElementById('gate-close');
    var backdrop = gate.querySelector('[data-gate-close]');
    var toggle = document.getElementById('gate-pw-toggle');

    function showError(msg) { error.textContent = msg; error.hidden = false; }
    function clearError() { error.hidden = true; error.textContent = ''; }

    function open() {
      gate.hidden = false;
      document.body.style.overflow = 'hidden';
      clearError();
      setTimeout(function () { try { user.focus(); } catch (e) {} }, 40);
    }

    function closeGate() {
      gate.hidden = true;
      document.body.style.overflow = '';
    }

    function goCinema() { window.location.href = 'media.html'; }

    // Проверяем сессию: если уже вошли — сразу в каталог, иначе показываем форму.
    function enterCinema(e) {
      if (e) e.preventDefault();
      fetch('/api/session', { headers: { 'Accept': 'application/json' } })
        .then(function (r) { return r.ok; })
        .catch(function () { return false; })
        .then(function (ok) { if (ok) goCinema(); else open(); });
    }

    Array.prototype.forEach.call(document.querySelectorAll('a[href$="media.html"]'), function (a) {
      a.addEventListener('click', enterCinema);
    });

    closeBtn.addEventListener('click', closeGate);
    if (backdrop) backdrop.addEventListener('click', closeGate);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !gate.hidden) closeGate();
    });

    if (toggle) {
      toggle.addEventListener('click', function () {
        var showing = pass.type === 'text';
        pass.type = showing ? 'password' : 'text';
        toggle.setAttribute('aria-label', showing ? 'Показать пароль' : 'Скрыть пароль');
      });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      clearError();

      var u = user.value.trim();
      var p = pass.value;
      if (!u || !p) { showError('Введите логин и пароль.'); return; }

      var prevText = submitText.textContent;
      submit.disabled = true;
      submit.classList.add('is-busy');
      submitText.textContent = 'Проверка…';

      function reset() {
        submit.disabled = false;
        submit.classList.remove('is-busy');
        submitText.textContent = prevText;
        pass.value = '';
        try { pass.focus(); } catch (err) {}
      }

      fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ username: u, password: p })
      })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, data: d }; }); })
        .then(function (res) {
          if (res.ok && res.data && res.data.ok) { goCinema(); return; }
          showError((res.data && res.data.error) || 'Неверный логин или пароль. Доступ ограничен.');
          reset();
        })
        .catch(function () {
          showError('Не удалось связаться с сервером. Попробуйте позже.');
          reset();
        });
    });

    // Автооткрытие формы, если вернулись после истечения сессии.
    try {
      if (new URLSearchParams(window.location.search).get('login') === '1') {
        open();
        if (window.history && window.history.replaceState) {
          window.history.replaceState({}, '', window.location.pathname);
        }
      }
    } catch (e) {}
  }

  function init() {
    initHeader();
    initMobileMenu();
    initReveal();
    initCardVideo();
    initYear();
    initGate();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
