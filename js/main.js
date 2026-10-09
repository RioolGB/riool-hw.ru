/* ==========================================================================
   Riool — интерактив лендинга
   Модули: мобильное меню, заголовок по словам, параллакс, появление при
   скролле, активный пункт меню, модальная форма обратной связи.
   Vanilla JS, без зависимостей.
   ========================================================================== */

(function () {
  'use strict';

  /* ------------------------------------------------------------------
     Утилиты
     ------------------------------------------------------------------ */
  var $  = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isMobile = function () { return window.matchMedia('(max-width: 860px)').matches; };

  /* ------------------------------------------------------------------
     1. Шапка: состояние «прилипла» при скролле
     ------------------------------------------------------------------ */
  function initHeader() {
    var header = $('.site-header');
    if (!header) return;

    var ticking = false;
    var update = function () {
      header.classList.toggle('is-stuck', window.scrollY > 24);
      ticking = false;
    };

    update();
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }, { passive: true });
  }

  /* ------------------------------------------------------------------
     2. Заголовок hero: появление по словам
     Разбивает текст на <span class="word"> и задаёт задержку для каждого.
     ------------------------------------------------------------------ */
  function initWordAnimation() {
    var title = $('[data-split-words]');
    if (!title) return;

    var words = (title.textContent || '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return;

    title.textContent = '';
    var step = prefersReducedMotion ? 0 : 90; // мс между словами

    words.forEach(function (word, i) {
      var span = document.createElement('span');
      span.className = 'word';
      span.style.setProperty('--word-delay', (i * step) + 'ms');
      span.textContent = word;
      title.appendChild(span);
    });

    // Запуск анимации после первой отрисовки
    if (prefersReducedMotion) {
      title.classList.add('is-animated');
      return;
    }

    var start = function () { title.classList.add('is-animated'); };
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(start).catch(start);
    } else {
      window.requestAnimationFrame(start);
    }
  }

  /* ------------------------------------------------------------------
     3. Появление элементов при скролле (.reveal)
     ------------------------------------------------------------------ */
  function initReveal() {
    var items = $$('.reveal');
    if (!items.length) return;

    // Индивидуальная задержка из data-delay
    items.forEach(function (el) {
      var delay = el.getAttribute('data-delay');
      if (delay) el.style.setProperty('--reveal-delay', delay + 'ms');
    });

    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

    items.forEach(function (el) { observer.observe(el); });
  }

  /* ------------------------------------------------------------------
     4. Параллакс фоновых элементов
     data-parallax="0.22" — во сколько раз медленнее двигается фон.
     ------------------------------------------------------------------ */
  function initParallax() {
    var layers = $$('[data-parallax]');
    if (!layers.length || prefersReducedMotion) return;

    var ticking = false;

    var apply = function () {
      var y = window.scrollY;
      layers.forEach(function (layer) {
        var speed = parseFloat(layer.getAttribute('data-parallax')) || 0.15;
        layer.style.transform = 'translate3d(0,' + (-y * speed).toFixed(2) + 'px,0)';
      });
      ticking = false;
    };

    apply();
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(apply);
    }, { passive: true });

    window.addEventListener('resize', apply, { passive: true });
  }

  /* ------------------------------------------------------------------
     5. Мобильное меню
     ------------------------------------------------------------------ */
  function initMobileMenu() {
    var burger = $('#burger');
    var nav = $('#primary-nav');
    if (!burger || !nav) return;

    var setOpen = function (open) {
      nav.classList.toggle('is-open', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    };

    burger.addEventListener('click', function () {
      setOpen(!nav.classList.contains('is-open'));
    });

    // Закрываем меню при переходе по любой ссылке
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) setOpen(false);
    });

    // Закрываем по Escape
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        setOpen(false);
        burger.focus();
      }
    });

    // Возврат к десктопному виду
    window.addEventListener('resize', function () {
      if (!isMobile()) setOpen(false);
    }, { passive: true });
  }

  /* ------------------------------------------------------------------
     6. Активный пункт меню по текущей секции
     ------------------------------------------------------------------ */
  function initActiveSection() {
    var links = $$('.nav__link[href^="#"]');
    if (!links.length || !('IntersectionObserver' in window)) return;

    var map = {};
    var targets = [];

    links.forEach(function (link) {
      var id = link.getAttribute('href').slice(1);
      var section = document.getElementById(id);
      if (!section) return;
      map[id] = link;
      targets.push(section);
    });

    var setActive = function (id) {
      links.forEach(function (l) { l.classList.remove('is-active'); });
      if (map[id]) map[id].classList.add('is-active');
    };

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) setActive(entry.target.id);
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });

    targets.forEach(function (section) { observer.observe(section); });
  }

  /* ------------------------------------------------------------------
     7. Модальное окно «Связаться со мной»
     ------------------------------------------------------------------ */
  var modal = {
    root: null,
    dialog: null,
    form: null,
    lastFocused: null,

    init: function () {
      this.root = $('#contact-modal');
      if (!this.root) return;
      this.dialog = $('.modal__dialog', this.root);

      var self = this;

      // Открытие по всем кнопкам [data-open-modal]
      $$('[data-open-modal]').forEach(function (trigger) {
        trigger.addEventListener('click', function () { self.open(); });
      });

      // Закрытие: крестик, клик по фону, Escape
      $$('[data-close-modal]', this.root).forEach(function (trigger) {
        trigger.addEventListener('click', function () { self.close(); });
      });

      document.addEventListener('keydown', function (e) {
        if (!self.isOpen()) return;
        if (e.key === 'Escape') { self.close(); return; }
        if (e.key === 'Tab') self.trapFocus(e);
      });
    },

    isOpen: function () {
      return !!this.root && !this.root.hasAttribute('hidden');
    },

    open: function () {
      if (!this.root || this.isOpen()) return;
      var self = this;
      this.lastFocused = document.activeElement;

      this.root.removeAttribute('hidden');
      document.body.classList.add('is-locked');
      // класс для CSS-перехода добавляем на следующем кадре
      window.requestAnimationFrame(function () {
        self.root.classList.add('is-open');
      });

      // Фокус на первое поле формы
      window.setTimeout(function () {
        var first = $('input, textarea, button:not(.modal__close)', self.dialog);
        if (first) first.focus();
      }, 120);
    },

    close: function () {
      if (!this.root || !this.isOpen()) return;
      var self = this;

      this.root.classList.remove('is-open');
      document.body.classList.remove('is-locked');

      window.setTimeout(function () {
        self.root.setAttribute('hidden', '');
        if (self.lastFocused && typeof self.lastFocused.focus === 'function') {
          self.lastFocused.focus();
        }
      }, 280);
    },

    // Удерживаем фокус внутри окна (доступность)
    trapFocus: function (e) {
      var focusables = $$(
        'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        this.dialog
      ).filter(function (el) { return el.offsetParent !== null; });

      if (!focusables.length) return;

      var first = focusables[0];
      var last = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  /* ------------------------------------------------------------------
     8. Форма обратной связи
     Отправляет POST /api/contact на бэкенд (nginx проксирует на :3000).
     ------------------------------------------------------------------ */
  function initForm() {
    var form = $('#contact-form');
    if (!form) return;

    var status = $('#cf-status');
    var submit = $('#cf-submit');
    var successScreen = $('[data-modal-success]', modal.root || document);
    var formScreen = $('[data-modal-body]', modal.root || document);

    var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    var MESSAGES = {
      name: 'Пожалуйста, укажите имя',
      email: 'Пожалуйста, укажите корректный email',
      message: 'Расскажите пару слов о задаче'
    };

    var setError = function (field, text) {
      var wrapper = field.closest('.form__field');
      var box = $('[data-error-for="' + field.name + '"]', wrapper || form);
      wrapper.classList.toggle('has-error', !!text);
      field.setAttribute('aria-invalid', text ? 'true' : 'false');
      if (box) box.textContent = text || '';
    };

    var validate = function () {
      var errors = [];

      $$('input, textarea', form).forEach(function (field) {
        if (field.name === 'company') return; // honeypot не проверяем
        if (!field.required) return;

        var value = (field.value || '').trim();
        var message = '';

        if (!value) {
          message = MESSAGES[field.name] || 'Заполните поле';
        } else if (field.type === 'email' && !EMAIL_RE.test(value)) {
          message = MESSAGES.email;
        } else if (field.name === 'name' && value.length < 2) {
          message = 'Слишком короткое имя';
        } else if (field.name === 'message' && value.length < 10) {
          message = 'Добавьте немного подробностей (от 10 символов)';
        }

        setError(field, message);
        if (message) errors.push(field);
      });

      return errors;
    };

    // Снимаем подсветку ошибки, как только пользователь правит поле
    $$('input, textarea', form).forEach(function (field) {
      field.addEventListener('input', function () {
        var wrapper = field.closest('.form__field');
        if (wrapper && wrapper.classList.contains('has-error')) setError(field, '');
      });
    });

    var setStatus = function (text, kind) {
      if (!status) return;
      status.textContent = text || '';
      status.classList.remove('is-error', 'is-ok');
      if (kind) status.classList.add('is-' + kind);
    };

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      // Honeypot: если поле заполнено — это бот. Показываем «успех», но ничего не шлём.
      var hp = $('#cf-company', form);
      if (hp && hp.value) {
        showSuccess();
        return;
      }

      var invalid = validate();
      if (invalid.length) {
        setStatus('Проверьте выделенные поля', 'error');
        invalid[0].focus();
        return;
      }

      setStatus('Отправляю…', '');
      submit.classList.add('is-loading');
      submit.disabled = true;
      submit.textContent = 'Отправка…';

      var payload = {
        name: $('#cf-name', form).value.trim(),
        email: $('#cf-email', form).value.trim(),
        message: $('#cf-message', form).value.trim(),
        // Контекст со страницы — пригодится для аналитики заявок
        page: window.location.href,
        // Простая метка для отсечения ботов в дополнение к honeypot
        startedAt: form.dataset.startedAt || ''
      };

      fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(function (res) {
          return res.json().catch(function () { return {}; })
            .then(function (data) { return { ok: res.ok, data: data }; });
        })
        .then(function (result) {
          if (result.ok) {
            showSuccess();
          } else {
            var msg = (result.data && result.data.error) || 'Не удалось отправить заявку. Напишите, пожалуйста, на riool@riool.ru';
            setStatus(msg, 'error');
          }
        })
        .catch(function () {
          setStatus('Нет связи с сервером. Напишите, пожалуйста, на riool@riool.ru', 'error');
        })
        .then(function () {
          submit.classList.remove('is-loading');
          submit.disabled = false;
          submit.textContent = 'Отправить';
        });
    });

    var showSuccess = function () {
      form.reset();
      setStatus('', '');
      $$('.form__field', form).forEach(function (f) { f.classList.remove('has-error'); });
      if (formScreen) formScreen.hidden = true;
      if (successScreen) {
        successScreen.hidden = false;
        var btn = $('button', successScreen);
        if (btn) window.setTimeout(function () { btn.focus(); }, 60);
      }
    };
  }

  /* ------------------------------------------------------------------
     9. Полоса прогресса чтения страницы
     Создаёт элемент и растягивает его по мере прокрутки.
     ------------------------------------------------------------------ */
  function initScrollProgress() {
    var bar = document.createElement('div');
    bar.className = 'scroll-progress';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);

    var ticking = false;
    var update = function () {
      var doc = document.documentElement;
      var max = doc.scrollHeight - window.innerHeight;
      var progress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      bar.style.transform = 'scaleX(' + progress.toFixed(4) + ')';
      ticking = false;
    };

    update();
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }, { passive: true });
    window.addEventListener('resize', update, { passive: true });
  }

  /* ------------------------------------------------------------------
     10. Курсор-подсветка (только desktop, с плавным «догоном»)
     ------------------------------------------------------------------ */
  function initCursorGlow() {
    if (prefersReducedMotion) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    var glow = document.createElement('div');
    glow.className = 'cursor-glow';
    glow.setAttribute('aria-hidden', 'true');
    document.body.appendChild(glow);

    var targetX = window.innerWidth / 2;
    var targetY = window.innerHeight / 2;
    var curX = targetX;
    var curY = targetY;
    var raf = null;

    var render = function () {
      curX += (targetX - curX) * 0.12;
      curY += (targetY - curY) * 0.12;
      glow.style.transform = 'translate3d(' + curX.toFixed(1) + 'px,' + curY.toFixed(1) + 'px,0)';

      if (Math.abs(targetX - curX) > 0.5 || Math.abs(targetY - curY) > 0.5) {
        raf = window.requestAnimationFrame(render);
      } else {
        raf = null;
      }
    };

    window.addEventListener('pointermove', function (e) {
      targetX = e.clientX;
      targetY = e.clientY;
      glow.classList.add('is-on');
      if (!raf) raf = window.requestAnimationFrame(render);
    }, { passive: true });

    document.addEventListener('pointerleave', function () {
      glow.classList.remove('is-on');
    });
  }

  /* ------------------------------------------------------------------
     11. Подсветка-«glare» на карточках — следует за курсором
     ------------------------------------------------------------------ */
  function initCardGlare() {
    if (prefersReducedMotion) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    $$('.card').forEach(function (card) {
      card.addEventListener('pointermove', function (e) {
        var rect = card.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        card.style.setProperty('--mx', (((e.clientX - rect.left) / rect.width) * 100).toFixed(1) + '%');
        card.style.setProperty('--my', (((e.clientY - rect.top) / rect.height) * 100).toFixed(1) + '%');
      }, { passive: true });
    });
  }

  /* ------------------------------------------------------------------
     12. Инициализация
     ------------------------------------------------------------------ */
  function init() {
    document.documentElement.classList.remove('no-js');

    // Метка времени открытия формы — грубая защита от мгновенной автоотправки ботов
    var form = $('#contact-form');
    if (form) form.dataset.startedAt = String(Date.now());

    initHeader();
    initWordAnimation();
    initReveal();
    initParallax();
    initMobileMenu();
    initActiveSection();
    modal.init();
    initForm();
    initScrollProgress();
    initCursorGlow();
    initCardGlare();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
