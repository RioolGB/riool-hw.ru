/* Защита контента: блокировка контекстного меню, перетаскивания картинок
   и горячих клавиш сохранения страницы / исходников.
   Это барьер для случайного копирования, НЕ абсолютная защита: исходный
   HTML/CSS/JS остаётся доступен через сеть — так работает браузер. */
(function () {
  'use strict';

  function isEditable(el) {
    if (!el) return false;
    var tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
  }

  document.addEventListener('contextmenu', function (e) {
    if (isEditable(e.target)) return;
    e.preventDefault();
  }, false);

  document.addEventListener('dragstart', function (e) {
    if (e.target && e.target.tagName === 'IMG') {
      e.preventDefault();
    }
  }, false);

  document.addEventListener('selectstart', function (e) {
    if (e.target && e.target.tagName === 'IMG') {
      e.preventDefault();
    }
  }, false);

  document.addEventListener('keydown', function (e) {
    var k = e.keyCode || e.which;
    var ctrl = e.ctrlKey || e.metaKey;
    var blocked = e.key === 'F12' || k === 123;
    if (ctrl) {
      var c = String.fromCharCode(k).toLowerCase();
      if (c === 's' || c === 'u' || c === 'p' || c === 'a') blocked = true;
      if (e.shiftKey && (c === 'i' || c === 'j' || c === 'c')) blocked = true;
    }
    if (blocked && !isEditable(e.target)) {
      e.preventDefault();
    }
  }, false);
})();