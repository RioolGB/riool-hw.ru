/**
 * Лендинг юриста по семейному праву Елены Соколовой
 * JavaScript с подробными комментариями
 *
 * Структура скрипта (весь код выполняется после загрузки DOM):
 * 1. Аккордеон FAQ — раскрытие/закрытие ответов на вопросы.
 * 2. Плавная прокрутка к секции формы при клике по CTA-кнопке.
 * 3. Мобильное меню (бургер) в шапке сайта.
 * 4. Доступность: синхронизация ARIA-атрибутов (aria-expanded, aria-label).
 *
 * Принцип работы: все обработчики навешиваются один раз внутри
 * DOMContentLoaded, поэтому к этому моменту элементы уже существуют в разметке.
 */

// === 1. ТОЧКА ВХОДА: ОБРАБОТЧИК DOMCONTENTLOADED ===
// Ждём построения DOM-дерева, чтобы все элементы страницы были доступны
// для поиска и навешивания обработчиков. Весь дальнейший код — внутри.
document.addEventListener('DOMContentLoaded', function () {
  // === 2. АККОРДЕОН FAQ ===
  // Логика: каждый вопрос работает независимо от остальных —
  // открытие одного не закрывает другие (режим multi-open).
  // Связь кнопки-вопроса и блока-ответа задаётся через aria-controls -> id.

  // Находим все кнопки-вопросы блока FAQ
  const faqButtons = document.querySelectorAll('.faq__question');

  // Вешаем обработчик клика на каждую кнопку
  faqButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      // ID связанного ответа берём из aria-controls (доступность + связь элементов)
      const controlId = button.getAttribute('aria-controls');
      const answer = document.getElementById(controlId);

      if (answer) {
        // Текущее состояние кнопки: раскрыт вопрос или закрыт
        const isExpanded = button.getAttribute('aria-expanded') === 'true';

        // Переключаем ARIA-состояние и визуальный класс кнопки (иконка + / −)
        button.setAttribute('aria-expanded', !isExpanded);
        button.classList.toggle('active');

        // Переключаем видимость ответа через класс .active:
        // в CSS класс плавно меняет max-height, создавая эффект выпадения
        if (isExpanded) {
          answer.classList.remove('active'); // закрываем ответ
        } else {
          answer.classList.add('active');    // открываем ответ
        }
      }
    });
  });

  // === 3. ПЛАВНАЯ ПРОКРУТКА К ФОРМЕ ЗАЯВКИ ===
  // Логика: по клику на ссылку #form (в т.ч. CTA-кнопку в Hero)
  // отключаем стандартный «прыжок» и плавно прокручиваем страницу к форме.
  // Находим все такие ссылки, чтобы не дублировать код.

  // Находим все ссылки, ведущие к якорю #form (CTA-кнопка в Hero)
  const ctaLinks = document.querySelectorAll('a[href="#form"]');

  ctaLinks.forEach(function (link) {
    link.addEventListener('click', function (event) {
      // Отменяем стандартное поведение ссылки (мгновенный переход)
      event.preventDefault();

      // Находим целевой элемент — секцию формы заявки
      const targetForm = document.getElementById('form');

      if (targetForm) {
        // Используем нативный плавный скролл браузера.
        // Важно: не вызываем window.scrollTo покадрово, иначе возникает
        // конфликт с CSS-правилом html { scroll-behavior: smooth },
        // из-за которого прокрутка останавливается, не доезжая до цели.
        targetForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // === 4. МОБИЛЬНОЕ МЕНЮ (БУРГЕР) ===
  // Логика: на мобильных кнопка-бургер открывает/закрывает выпадающее меню.
  // Состояние хранится в классах: .open (меню) и .active (кнопка-крестик).

  // Находим кнопку-бургер и выпадающее меню навигации
  const burger = document.querySelector('.site-header__burger');
  const nav = document.getElementById('site-nav');

  // Выполняем блок только если оба элемента присутствуют в разметке
  if (burger && nav) {
    // Универсальная функция переключения меню.
    // forceClose === true — принудительно закрыть (например, при клике по ссылке).
    function toggleMenu(forceClose) {
      const willOpen = forceClose === true ? false : !nav.classList.contains('open');
      nav.classList.toggle('open', willOpen);          // показ/скрытие меню
      burger.classList.toggle('active', willOpen);     // анимация бургера в «крестик»
      burger.setAttribute('aria-expanded', willOpen);  // ARIA: состояние раскрытия
      burger.setAttribute('aria-label', willOpen ? 'Закрыть меню' : 'Открыть меню');
    }

    // Клик по бургеру переключает меню (открыть/закрыть)
    burger.addEventListener('click', function () {
      toggleMenu();
    });

    // Клик по любой ссылке меню закрывает его, после чего происходит
    // переход по якорю (прокрутка управляется CSS + разделом 3)
    nav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        toggleMenu(true);
      });
    });

    // При изменении размера окна и возврате к десктопной ширине (>=768px)
    // принудительно закрываем мобильное меню, чтобы оно не осталось открытым
    window.addEventListener('resize', function () {
      if (window.innerWidth >= 768) {
        toggleMenu(true);
      }
    });
  }
});