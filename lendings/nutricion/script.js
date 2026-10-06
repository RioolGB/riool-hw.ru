(function () {
  "use strict";

  /* ============================================================
     Настройка сохранения заявок в Google Таблицу
     Вставьте сюда URL вашего развёрнутого Google Apps Script
     Web App (https://script.google.com/macros/s/.../exec).
     Инструкция — в файле GoogleSheets.gs.
     Пока URL не вставлен — заявки не будут отправляться в таблицу.
     ============================================================ */
  var SHEETS_URL = "https://script.google.com/macros/s/AKfycbwZM46BWZm9LEF2GjspXjCko6q4HEsD38gh2oDdW-jUdUpwPEgVZ1xRCkGA9hxqZ2rs/exec";

  /* ---------- Year in footer ---------- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- Reveal on scroll (IntersectionObserver) ---------- */
  var revealEls = document.querySelectorAll("[data-reveal]");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
    );
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("in-view"); });
  }

  /* ---------- Parallax on scroll for background layers ---------- */
  var layers = document.querySelectorAll(".bg-layer");
  var ticking = false;
  function parallax() {
    var y = window.pageYOffset || window.scrollY;
    layers.forEach(function (layer) {
      var depth = parseFloat(layer.getAttribute("data-depth")) || 0.2;
      layer.style.transform = "translate3d(0, " + y * depth + "px, 0)";
    });
    ticking = false;
  }
  if (layers.length) {
    window.addEventListener("scroll", function () {
      if (!ticking) {
        window.requestAnimationFrame(parallax);
        ticking = true;
      }
    });
    parallax();
  }

  /* ---------- Header background on scroll ---------- */
  var header = document.getElementById("header");
  function onScrollHeader() {
    if (header) {
      header.classList.toggle("scrolled", (window.pageYOffset || window.scrollY) > 40);
    }
  }
  window.addEventListener("scroll", onScrollHeader, { passive: true });
  onScrollHeader();

  /* ---------- Smooth scroll for anchors (with fixed header offset) ---------- */
  var headerOffset = 90;
  document.querySelectorAll(".js-anchor, .brand").forEach(function (link) {
    link.addEventListener("click", function (e) {
      var target = document.querySelector(this.getAttribute("href"));
      if (target) {
        e.preventDefault();
        var top = target.getBoundingClientRect().top + window.pageYOffset - headerOffset;
        window.scrollTo({ top: top, behavior: "smooth" });
      }
    });
  });

  /* ---------- Modal open/close ---------- */
  var modal = document.getElementById("lead-modal");
  var openBtns = document.querySelectorAll(".js-open-form");

  function openModal() {
    if (!modal) return;
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    var first = modal.querySelector("input");
    if (first) setTimeout(function () { first.focus(); }, 250);
  }
  function closeModal() {
    if (!modal) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  openBtns.forEach(function (btn) {
    btn.addEventListener("click", openModal);
  });
  document.querySelectorAll(".js-close-form").forEach(function (el) {
    el.addEventListener("click", closeModal);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && modal && modal.classList.contains("open")) closeModal();
  });

  /* ---------- Lead form: save to Google Sheets ---------- */
  var form = document.getElementById("lead-form");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();

      var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      var invalid = false;

      form.querySelectorAll("input[required]").forEach(function (input) {
        var val = input.value.trim();
        var bad = !val;
        if (!bad && input.type === "email") {
          bad = !emailRe.test(val);
        }
        if (bad) {
          invalid = true;
          input.style.borderColor = "rgba(255,120,120,0.6)";
        } else {
          input.style.borderColor = "";
        }
      });

      if (invalid) {
        form.querySelector(".form-note").textContent =
          "Пожалуйста, заполните все обязательные поля (имя, почта, телефон).";
        return;
      }

      var submitBtn = form.querySelector("button[type=submit]");
      var originalText = submitBtn.textContent;
      submitBtn.textContent = "Отправляем…";
      submitBtn.disabled = true;

      var payload = {
        name: form.querySelector("#f-name").value.trim(),
        email: form.querySelector("#f-email").value.trim(),
        phone: form.querySelector("#f-phone").value.trim(),
        telegram: form.querySelector("#f-telegram").value.trim()
      };

      function finish(successMsg) {
        var success = document.getElementById("form-success");
        if (success) {
          success.textContent = successMsg;
          success.hidden = false;
        }
        form.querySelector(".form-note").textContent = "";
        submitBtn.textContent = "Заявка отправлена ✓";
        form.reset();
        setTimeout(function () {
          success.hidden = true;
          closeModal();
        }, 1200);
      }

      if (!SHEETS_URL) {
        finish("Заявка открыта. Подключите Google Таблицу: вставьте URL в SHEETS_URL в script.js.");
        return;
      }

      fetch(SHEETS_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
      })
        .then(function () {
          finish("Спасибо! Заявка отправлена. Я свяжусь с вами в течение 24 часов.");
        })
        .catch(function () {
          submitBtn.textContent = originalText;
          submitBtn.disabled = false;
          form.querySelector(".form-note").textContent =
            "Не удалось отправить заявку. Попробуйте ещё раз.";
        });
    });
  }
})();
