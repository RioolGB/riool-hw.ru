(function () {
    "use strict";

    /* ---------------------------------------------------------------
       НАСТРОЙКА
       Укажите URL Google Apps Script (развёрнутого как веб-приложение
       с доступом "Любой желающий") — см. Code.gs и README в папке.
       --------------------------------------------------------------- */
    var SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx5JJDGymZH7_GVZhbwKA19UcWce7PqKH-OAnwgezW9rsFX32iuQkPEOG_8SJ-WkvauHg/exec";

    var modal = document.getElementById("enrollModal");
    var modalOpenButtons = document.querySelectorAll("[data-modal-open]");
    var modalCloseButtons = document.querySelectorAll("[data-modal-close]");
    var form = document.getElementById("enrollForm");
    var submitBtn = document.getElementById("submitBtn");
    var statusEl = document.getElementById("formStatus");

    /* ---------- Открытие / закрытие модалки ---------- */
    function openModal() {
        modal.classList.add("is-open");
        modal.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
        var first = document.getElementById("name");
        if (first) first.focus();
    }

    function closeModal() {
        modal.classList.remove("is-open");
        modal.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
        resetForm();
    }

    function resetForm() {
        form.reset();
        setStatus("");
        clearAllFieldErrors();
        submitBtn.disabled = false;
        submitBtn.textContent = "Записаться на курс";
    }

    modalOpenButtons.forEach(function (btn) {
        btn.addEventListener("click", function (e) {
            e.preventDefault();
            openModal();
        });
    });

    modalCloseButtons.forEach(function (btn) {
        btn.addEventListener("click", function (e) {
            var isOverlay = btn.classList.contains("modal__overlay");
            if (isOverlay && e.target !== btn) return;
            e.preventDefault();
            closeModal();
        });
    });

    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && modal.classList.contains("is-open")) {
            closeModal();
        }
    });

    /* ---------- Валидация ---------- */
    function showFieldError(input, errorEl, message) {
        var field = input.closest(".field");
        field.classList.add("error");
        errorEl.textContent = message;
    }

    function clearFieldError(input, errorEl) {
        input.closest(".field").classList.remove("error");
        errorEl.textContent = "";
    }

    function clearAllFieldErrors() {
        [
            [document.getElementById("name"), document.getElementById("nameError")],
            [document.getElementById("surname"), document.getElementById("surnameError")],
            [document.getElementById("email"), document.getElementById("emailError")]
        ].forEach(function (pair) {
            if (pair[0] && pair[1]) clearFieldError(pair[0], pair[1]);
        });
    }

    function setStatus(message, type) {
        statusEl.textContent = message;
        statusEl.className = "form-status";
        if (message) {
            statusEl.classList.add("is-visible");
            if (type) statusEl.classList.add(type === "success" ? "is-success" : "is-error");
        }
    }

    function validate() {
        var ok = true;
        var name = document.getElementById("name");
        var surname = document.getElementById("surname");
        var email = document.getElementById("email");
        var nameError = document.getElementById("nameError");
        var surnameError = document.getElementById("surnameError");
        var emailError = document.getElementById("emailError");

        clearAllFieldErrors();

        if (!name.value.trim()) {
            showFieldError(name, nameError, "Пожалуйста, укажите ваше имя");
            ok = false;
        }

        if (!surname.value.trim()) {
            showFieldError(surname, surnameError, "Пожалуйста, укажите вашу фамилию");
            ok = false;
        }

        var emailValue = email.value.trim();
        var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailValue || !emailRe.test(emailValue)) {
            showFieldError(email, emailError, "Укажите корректный email");
            ok = false;
        }

        return ok;
    }

    /* ---------- Отправка в Google Таблицу ---------- */
    function sendToSheet(payload) {
        return new Promise(function (resolve, reject) {
            var xhr = new XMLHttpRequest();
            xhr.open("POST", SCRIPT_URL, true);
            xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8");
            xhr.onreadystatechange = function () {
                if (xhr.readyState !== 4) return;
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve(xhr.responseText);
                } else {
                    reject(new Error("HTTP " + xhr.status));
                }
            };
            xhr.onerror = function () {
                reject(new Error("Network error"));
            };
            xhr.send("name=" + encodeURIComponent(payload.name) +
                "&surname=" + encodeURIComponent(payload.surname) +
                "&email=" + encodeURIComponent(payload.email));
        });
    }

    /* ---------- Обработка формы ---------- */
    form.addEventListener("submit", function (e) {
        e.preventDefault();

        if (submitBtn.disabled) return;

        if (!validate()) {
            setStatus("Проверьте выделенные поля", "error");
            return;
        }

        if (SCRIPT_URL === "PASTE_YOUR_GOOGLE_APPS_SCRIPT_URL_HERE") {
            setStatus("Не настроена отправка в Google Таблицу (укажите URL в script.js)", "error");
            submitBtn.disabled = false;
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = "Отправляем...";
        setStatus("");

        var payload = {
            name: document.getElementById("name").value.trim(),
            surname: document.getElementById("surname").value.trim(),
            email: document.getElementById("email").value.trim()
        };

        sendToSheet(payload).then(function () {
            setStatus("Спасибо! Заявка отправлена. Гайд уже летит на вашу почту.", "success");
            /* Успешно: закрываем модалку через 1.2 секунды */
            setTimeout(function () {
                closeModal();
            }, 1200);
        }).catch(function () {
            /* Ошибка: форма не закрывается, кнопка снова активна */
            submitBtn.disabled = false;
            submitBtn.textContent = "Записаться на курс";
            setStatus("Не удалось отправить. Попробуйте ещё раз.", "error");
        });
    });
})();
