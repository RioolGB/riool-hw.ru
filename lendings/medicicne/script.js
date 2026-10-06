(function () {
  // ====== Конфигурация Google Apps Script ======
  // Вставьте сюда URL вашего веб-приложения (Google Apps Script Web App URL).
  var SHEET_URL = 'https://script.google.com/macros/s/AKfycbw39GpbAUHa5dvrE4yE-cHla6125s5pwL39G3QtTjaH9WzO1vm6C0GmsrBRpXdDPYnM3g/exec';
  // ==============================================

  var modalOverlay = document.getElementById('modalOverlay');
  var openModalBtn = document.getElementById('openModalBtn');
  var modalClose = document.getElementById('modalClose');
  var form = document.getElementById('form');
  var submitBtn = document.getElementById('submitBtn');
  var formMessage = document.getElementById('formMessage');

  var nameInput = document.getElementById('name');
  var phoneInput = document.getElementById('phone');
  var emailInput = document.getElementById('email');

  var nameError = form.querySelector('[data-error="name"]');
  var phoneError = form.querySelector('[data-error="phone"]');
  var emailError = form.querySelector('[data-error="email"]');

  // ---------- Открытие / закрытие модального окна ----------
  function openModal() {
    modalOverlay.hidden = false;
    document.body.style.overflow = 'hidden';
    setTimeout(function () { nameInput.focus(); }, 50);
  }

  function closeModal() {
    modalOverlay.hidden = true;
    document.body.style.overflow = '';
  }

  openModalBtn.addEventListener('click', openModal);
  modalClose.addEventListener('click', closeModal);

  modalOverlay.addEventListener('click', function (e) {
    if (e.target === modalOverlay) closeModal();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !modalOverlay.hidden) closeModal();
  });

  // Кнопки записи в модальном окне на всех экранах открывают то же окно
  document.querySelectorAll('[data-open-modal]').forEach(function (btn) {
    btn.addEventListener('click', openModal);
  });

  // ---------- Показ сообщений ----------
  function showMessage(text, type) {
    formMessage.textContent = text;
    formMessage.className = 'form-message ' + (type || '');
    formMessage.hidden = false;
  }

  function clearMessage() {
    formMessage.hidden = true;
    formMessage.textContent = '';
  }

  // ---------- Валидация ----------
  function validateName() {
    var v = nameInput.value.trim();
    var ok = v.length >= 2;
    nameInput.classList.toggle('invalid', !ok);
    nameError.textContent = ok ? '' : 'Пожалуйста, укажите ваше имя';
    return ok;
  }

  function validatePhone() {
    var raw = phoneInput.value.replace(/\D/g, '');
    var ok = /^(7|8)\d{10}$/.test(raw) || /^\d{10}$/.test(raw);
    phoneInput.classList.toggle('invalid', !ok);
    phoneError.textContent = ok ? '' : 'Пожалуйста, укажите корректный номер телефона';
    return ok;
  }

  function validateEmail() {
    var v = emailInput.value.trim();
    var ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
    emailInput.classList.toggle('invalid', !ok);
    emailError.textContent = ok ? '' : 'Пожалуйста, укажите корректный e-mail';
    return ok;
  }

  phoneInput.addEventListener('input', function () {
    var digits = phoneInput.value.replace(/\D/g, '').replace(/^8/, '7');
    if (digits.length > 11) digits = digits.slice(0, 11);

    var result = '+7';
    if (digits.length > 1) result += ' (' + digits.slice(1, 4);
    if (digits.length >= 4) result += ') ' + digits.slice(4, 7);
    if (digits.length >= 7) result += '-' + digits.slice(7, 9);
    if (digits.length >= 9) result += '-' + digits.slice(9, 11);

    phoneInput.value = result;
    validatePhone();
  });

  // ---------- Отправка данных в Google Таблицу ----------
  function sendToSheet(data) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', SHEET_URL, true);
      // Важно: "text/plain" (не "application/json") — это "simple request" без preflight.
      // Apps Script не отдаёт Access-Control-Allow-* заголовки, а с application/json
      // браузер делает предварительный OPTIONS-запрос, который блокируется CORS.
      // Тело всё равно содержит JSON-строку; скрипт парсит её через JSON.parse(e.postData.contents).
      xhr.setRequestHeader('Content-Type', 'text/plain;charset=utf-8');
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
          var ok = false;
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              var res = JSON.parse(xhr.responseText);
              ok = res && res.result === 'ok';
            } catch (err) {
              ok = false;
            }
          }
          if (ok) {
            resolve(xhr.responseText);
          } else {
            reject(new Error('Server responded with status ' + xhr.status));
          }
        }
      };
      xhr.onerror = function () { reject(new Error('Network error')); };
      // Отправляем JSON-объект — Apps Script парсит его через JSON.parse(e.postData.contents).
      xhr.send(JSON.stringify({
        name: data.name,
        phone: data.phone,
        email: data.email
      }));
    });
  }

  // ---------- Обработка отправки формы ----------
  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var okName = validateName();
    var okPhone = validatePhone();
    var okEmail = validateEmail();

    if (!okName || !okPhone || !okEmail) {
      showMessage('Проверьте правильность заполнения полей', 'error');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Отправляем...';
    clearMessage();

    var data = {
      name: nameInput.value.trim(),
      phone: phoneInput.value.trim(),
      email: emailInput.value.trim()
    };

    function onSuccess() {
      showMessage('Спасибо! Мы свяжемся с вами для подтверждения записи.', 'success');
      setTimeout(function () {
        closeModal();
        form.reset();
        submitBtn.disabled = false;
        submitBtn.textContent = 'Занять свободный слот';
        clearMessage();
      }, 1200);
    }

    function onError() {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Занять свободный слот';
      showMessage('Не удалось отправить данные. Попробуйте ещё раз чуть позже.', 'error');
    }

    // Если URL не настроен — имитируем успех (для демонстрации без бэкенда).
    if (!SHEET_URL) {
      setTimeout(onSuccess, 700);
      return;
    }

    var timeout = setTimeout(function () { onError(); }, 15000);

    sendToSheet(data).then(function () {
      clearTimeout(timeout);
      onSuccess();
    }).catch(function () {
      clearTimeout(timeout);
      onError();
    });
  });
})();
