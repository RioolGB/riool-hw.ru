document.addEventListener('DOMContentLoaded', function () {

  // ============================================================
  //  НАСТРОЙКА: сюда вставить URL вашего Google Apps Script
  //  (подробности в файле google-apps-script.md)
  // ============================================================
  var GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwFcDPHFtWJBB4-DQt_aY38hfuxFZgQtk5cHAfPur9tcPK2Tb3uiP-TSjKEjPobSIt9QA/exec';

  // ---------- Табы модулей ----------
  var tabBtns = document.querySelectorAll('.tab-btn');
  var panels = document.querySelectorAll('.tabs__panel');

  tabBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      tabBtns.forEach(function (b) { b.classList.remove('is-active'); });
      btn.classList.add('is-active');
      var target = btn.dataset.tab;
      panels.forEach(function (p) {
        p.classList.toggle('is-active', p.id === target);
      });
    });
  });

  // ---------- Таймер обратного отсчёта (3 дня от открытия) ----------
  var targetTime = Date.now() + 3 * 24 * 60 * 60 * 1000;

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function updateTimer() {
    var diff = Math.max(0, targetTime - Date.now());
    var days = Math.floor(diff / (1000 * 60 * 60 * 24));
    var hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    var minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    var seconds = Math.floor((diff % (1000 * 60)) / 1000);

    function set(id, val) {
      var el = document.getElementById(id);
      if (el) el.textContent = pad(val);
    }
    set('days', days);
    set('hours', hours);
    set('minutes', minutes);
    set('seconds', seconds);
  }
  updateTimer();
  setInterval(updateTimer, 1000);

  // ============================================================
  //  МОДАЛЬНОЕ ОКНО
  // ============================================================
  var modal = document.getElementById('modal');
  var openTriggers = document.querySelectorAll('.js-open-modal');
  var closeTriggers = document.querySelectorAll('.js-close-modal');

  function openModal(e) {
    if (e) e.preventDefault();
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    setTimeout(function () { document.getElementById('name').focus(); }, 50);
  }

  function closeModal() {
    modal.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  openTriggers.forEach(function (t) { t.addEventListener('click', openModal); });
  closeTriggers.forEach(function (t) { t.addEventListener('click', closeModal); });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeModal();
  });

  // ============================================================
  //  ФОРМА: валидация и отправка
  // ============================================================
  var form = document.getElementById('signup-form');
  var nameInput = document.getElementById('name');
  var surnameInput = document.getElementById('surname');
  var emailInput = document.getElementById('email');
  var submitBtn = form.querySelector('.form__submit');
  var submitText = form.querySelector('.form__submit-text');
  var statusEl = document.getElementById('form-status');

  function showFieldError(input, msg) {
    var wrap = input.closest('.form__field');
    wrap.classList.add('has-error');
    var err = wrap.querySelector('[data-error-for]');
    if (err) err.textContent = msg;
  }

  function clearFieldError(input) {
    var wrap = input.closest('.form__field');
    wrap.classList.remove('has-error');
    var err = wrap.querySelector('[data-error-for]');
    if (err) err.textContent = '';
  }

  function setStatus(text, type) {
    statusEl.textContent = text;
    statusEl.className = 'form__status ' + (type ? 'is-' + type : '');
  }

  function validateName() {
    var v = nameInput.value.trim();
    if (v.length < 2) {
      showFieldError(nameInput, 'Введите имя (минимум 2 символа)');
      return false;
    }
    clearFieldError(nameInput);
    return true;
  }

  function validateSurname() {
    var v = surnameInput.value.trim();
    if (v.length < 2) {
      showFieldError(surnameInput, 'Введите фамилию (минимум 2 символа)');
      return false;
    }
    clearFieldError(surnameInput);
    return true;
  }

  function validateEmail() {
    var v = emailInput.value.trim();
    var re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!re.test(v)) {
      showFieldError(emailInput, 'Введите корректный e-mail');
      return false;
    }
    clearFieldError(emailInput);
    return true;
  }

  nameInput.addEventListener('blur', validateName);
  surnameInput.addEventListener('blur', validateSurname);
  emailInput.addEventListener('blur', validateEmail);

  nameInput.addEventListener('input', function () { clearFieldError(nameInput); });
  surnameInput.addEventListener('input', function () { clearFieldError(surnameInput); });
  emailInput.addEventListener('input', function () { clearFieldError(emailInput); });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    setStatus('');

    var validName = validateName();
    var validSurname = validateSurname();
    var validEmail = validateEmail();

    if (!validName || !validSurname || !validEmail) {
      setStatus('Проверь заполнение полей', 'error');
      return;
    }

    // Отправка
    submitBtn.disabled = true;
    submitText.textContent = 'Отправляем...';
    setStatus('');

    var payload = {
      name: nameInput.value.trim(),
      surname: surnameInput.value.trim(),
      email: emailInput.value.trim(),
      date: new Date().toLocaleString('ru-RU')
    };

    function onSuccess() {
      setStatus('Заявка отправлена! Открываем доступ...', 'success');
      setTimeout(function () {
        closeModal();
        submitBtn.disabled = false;
        submitText.textContent = 'Отправить заявку';
        form.reset();
        setStatus('');
      }, 1200);
    }

    function onError() {
      submitBtn.disabled = false;
      submitText.textContent = 'Отправить заявку';
      setStatus('Что-то пошло не так. Попробуй ещё раз', 'error');
    }

    // Если URL не настроен — имитируем успех для демо, чтобы показать логику
    if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL.indexOf('PASTE_YOUR') !== -1) {
      console.log('DEMO-режим: данные не отправлены, замените GOOGLE_SCRIPT_URL.', payload);
      setTimeout(onSuccess, 900);
      return;
    }

    fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    }).then(onSuccess).catch(onError);
  });
});
