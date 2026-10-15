/**
 * Лендинг юриста по семейному праву Елены Соколовой
 * JavaScript с подробными комментариями
 * 
 * Функционал:
 * 1. Аккордеон FAQ - раскрытие/закрытие ответов на вопросы
 * 2. Плавная прокрутка к якорю формы при клике на CTA-кнопку
 * 3. Мобильное меню (бургер) в шапке сайта
 * 4. Улучшение доступности (ARIA-атрибуты)
 */

// === 1. ОБРАБОТЧИК DOMCONTENTLOADED ===
// Ждём полной загрузки DOM, чтобы элементы были доступны для взаимодействия
document.addEventListener('DOMContentLoaded', function () {
  // === 2. РАБОТА АККОРДЕОНА FAQ ===
  // Находим все кнопки вопросов в блоке FAQ
  const faqButtons = document.querySelectorAll('.faq__question');

  // Обходим каждую кнопку и вешаем обработчик клика
  faqButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      // Получаем ID связанного ответа из атрибута aria-controls
      const controlId = button.getAttribute('aria-controls');
      const answer = document.getElementById(controlId);

      if (answer) {
        // Определяем текущее состояние (раскрыт/закрыт)
        const isExpanded = button.getAttribute('aria-expanded') === 'true';

        // Меняем состояние кнопки
        button.setAttribute('aria-expanded', !isExpanded);
        button.classList.toggle('active');

        // Показываем или скрываем ответ
        if (isExpanded) {
          // Закрываем ответ
          answer.classList.remove('active');
        } else {
          // Открываем ответ
          answer.classList.add('active');
        }
      }
    });
  });

  // === 3. ПЛАВНАЯ ПРОКРУТКА К ФОРМЕ ЗАЯВКИ ===
  // Находим все ссылки, ведущие к якорю #form (CTA-кнопка в Hero)
  const ctaLinks = document.querySelectorAll('a[href="#form"]');

  ctaLinks.forEach(function (link) {
    link.addEventListener('click', function (event) {
      // Отменяем стандартное поведение ссылки ради плавной прокрутки
      event.preventDefault();

      // Находим целевой элемент (секция формы заявки)
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
  // Находим кнопку-бургер и выпадающее меню навигации
  const burger = document.querySelector('.site-header__burger');
  const nav = document.getElementById('site-nav');

  if (burger && nav) {
    // Функция переключения состояния меню
    function toggleMenu(forceClose) {
      const willOpen = forceClose === true ? false : !nav.classList.contains('open');
      nav.classList.toggle('open', willOpen);
      burger.classList.toggle('active', willOpen);
      burger.setAttribute('aria-expanded', willOpen);
      burger.setAttribute('aria-label', willOpen ? 'Закрыть меню' : 'Открыть меню');
    }

    // Клик по бургеру открывает/закрывает меню
    burger.addEventListener('click', function () {
      toggleMenu();
    });

    // Клик по любой ссылке меню закрывает его (перед плавной прокруткой)
    nav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        toggleMenu(true);
      });
    });

    // При возврате на десктопную ширину принудительно закрываем мобильное меню
    window.addEventListener('resize', function () {
      if (window.innerWidth >= 768) {
        toggleMenu(true);
      }
    });
  }
});