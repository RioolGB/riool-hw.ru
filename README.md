# riool-hw.ru — лендинг Вениамина Семерикова (Riool)

Одностраничный сайт веб-разработчика: тёмно-зелёная тема, анимации появления,
портфолио из 5 карточек, модальная форма обратной связи с отправкой писем на
`riool@riool.ru`.

Стек: чистый HTML/CSS/JS (без сборщика и фреймворков) + Node.js/Express/Nodemailer
для приёма формы. Всё разворачивается через Docker Compose.

---

## Содержание

1. [Структура проекта](#структура-проекта)
2. [Быстрый старт локально](#быстрый-старт-локально)
3. [Что нужно заменить перед запуском](#что-нужно-заменить-перед-запуском)
4. [Настройка отправки писем](#настройка-отправки-писем)
5. [Развёртывание на сервере с Docker](#развёртывание-на-сервере-с-docker)
6. [SSL-сертификат](#ssl-сертификат)
7. [Обновление сайта](#обновление-сайта)
8. [Настройка домена у провайдера](#настройка-домена-у-провайдера)
9. [Защита от спама](#защита-от-спама)
10. [Проверка и отладка](#проверка-и-отладка)
11. [Структура кода](#структура-кода)
12. [Что реализовано по ТЗ](#что-реализовано-по-тз)

---

## Структура проекта

```
riool-hw.ru/
├── index.html                 # главная страница
├── portfolio.html             # страница «Все работы»
├── site.webmanifest           # PWA-манифест (иконки, цвета)
├── css/
│   └── styles.css             # все стили, тема в CSS-переменных
├── js/
│   └── main.js                # вся логика (меню, анимации, форма)
├── images/
│   ├── photo_main.jpg         # фото для первого экрана
│   ├── about.jpg              # фото для раздела «Обо мне»
│   ├── og-image.png           # картинка для шеринга в соцсетях (1200x630)
│   ├── favicon.svg            # иконка «R» (векторная)
│   ├── favicon-32/180/512.png # иконки для браузеров и PWA
│   └── portfolio/             # превью работ (СЕЙЧАС — заглушки)
├── backend/
│   ├── server.js              # приём заявок + отправка писем
│   ├── package.json
│   ├── Dockerfile
│   ├── .env.example           # образец настроек (скопируйте в .env)
│   └── .env                   # ← создаётся вами, НЕ коммитится
├── deploy/
│   ├── nginx.conf             # конфигурация nginx (сайт + прокси формы)
│   ├── security-headers.inc   # фрагмент: заголовки безопасности
│   ├── deny-internal.inc      # фрагмент: запрет доступа к .env, backend/, deploy/
│   └── certbot/               # сертификаты (создаётся автоматически)
├── docker-compose.yml         # фронтенд + бэкенд + автопродление сертификата
├── site.webmanifest           # PWA-манифест (иконки, цвета)
├── .gitignore
└── README.md
```

> Расширение `.inc` у фрагментов обязательно: `nginx.conf` подключает все файлы
> `/etc/nginx/conf.d/*.conf` на уровне `http`, где директива `location` запрещена.
> Файлы `.inc` монтируются в `/etc/nginx/snippets/`.

> В контейнер nginx смонтирован весь корень проекта, поэтому `backend/.env`
> защищён правилом в `deploy/deny-internal.inc` и недоступен из интернета.

---

## Быстрый старт локально

Фронтенд — статические файлы, достаточно открыть `index.html` в браузере.
Но чтобы заработала форма, нужен бэкенд.

### 1. Только посмотреть страницу

Откройте `index.html` двойным кликом. Всё, кроме отправки формы, будет работать.

### 2. Форма + фронтенд вместе

```bash
# бэкенд
cd backend
npm install
cp .env.example .env      # Windows: copy .env.example .env
# впишите SMTP_USER и SMTP_PASS в .env
npm start
```

Бэкенд поднимется на `http://localhost:3000`, проверить: `http://localhost:3000/health`.

Фронтенд с проксированием формы удобнее поднять целиком в Docker:

```bash
cp backend/.env.example backend/.env   # заполнить SMTP_PASS
docker compose up -d --build
```

Сайт будет на `http://localhost` (для локальной проверки SSL-блок в `deploy/nginx.conf`
временно отключите или закомментируйте `listen 443`).

---

## Что нужно заменить перед запуском

Это главное. Часть контента — заглушки, потому что реальные работы
и скриншоты ещё не предоставлены.

| Что | Где | Что сделать |
|---|---|---|
| Скриншоты работ | `images/portfolio/project-1..5.svg` | Положить реальные скриншоты рядом и прописать новые пути в `index.html` и `portfolio.html` (поддерживаются `.jpg`, `.png`, `.webp`) |
| Названия и описания проектов | `index.html`, секция `.portfolio__grid` | Заменить заглушки на реальные кейсы |
| Адреса проектов | `href` у кнопок «Открыть» | Сейчас стоят `*.example.com` — подставить рабочие поддомены |
| Теги | `.card__tags` | Обновить под реальные технологии |
| Фото | `images/photo_main.jpg`, `images/about.jpg` | Уже ваши, при необходимости заменить |
| Заголовки в шапке навигации | — | Уже актуальные |

> Ссылки `*.example.com` — это зарезервированные домены для примеров (RFC 2606),
> они никогда не ведут на чужой сайт. Замените на свои поддомены.

---

## Настройка отправки писем

Форма отправляет письма через SMTP на `riool@riool.ru`. Письмо приходит от
`riool@riool.ru`, а в поле «Ответить» подставляется email клиента — можно
ответить прямо из почтового клиента.

### Шаг 1. Включите двухфакторную аутентификацию

Яндекс Почта, Gmail и Mail.ru не принимают основной пароль от аккаунта —
только **пароль приложения**.

### Шаг 2. Создайте пароль приложения

| Провайдер | Где создать |
|---|---|
| Яндекс | <https://account.yandex.ru/app-passwords> → «Создать пароль приложения» |
| Gmail | <https://myaccount.google.com/apppasswords> → «Создать пароль» |
| Mail.ru | <https://account.mail.ru/app-passwords> |

### Шаг 3. Заполните `backend/.env`

```bash
cp backend/.env.example backend/.env
```

```ini
MAIL_TO=riool@riool.ru
MAIL_FROM=riool@riool.ru

SMTP_HOST=smtp.yandex.ru
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=riool@riool.ru
SMTP_PASS=abcd efgh ijkl mnop qrst
```

Для Gmail замените `SMTP_HOST=smtp.gmail.com`.

**Важно:** адрес в `SMTP_USER` и `MAIL_FROM` должен совпадать с подтверждённым
отправителем, иначе провайдер заблокирует письма («550 Sender not authorized»).

### Проверка

```bash
docker compose logs -f backend
```

При старте должно быть:

```
SMTP доступен: smtp.yandex.ru:465
```

Отправьте тестовую заявку с сайта — в логах появится `заявка отправлена: <email>`.
Если вместо этого `ОШИБКА SMTP` — проверьте `SMTP_USER`/`SMTP_PASS` и
подтверждение отправителя.

---

## Развёртывание на сервере с Docker

### Требования

- Docker Engine 24+ и Docker Compose v2
- Домены `riool-hw.ru` и `www.riool-hw.ru` уже указывают на IP сервера
- Открытые порты 80 и 443

### 1. Скопируйте проект на сервер

```bash
scp -r ./riool-hw.ru user@server:/opt/
ssh user@server
cd /opt/riool-hw.ru
```

### 2. Создайте настройки

```bash
cp backend/.env.example backend/.env
nano backend/.env     # заполните SMTP_PASS и ALLOWED_ORIGINS
```

### 3. Первый запуск без SSL

На первом запуске сертификата ещё нет, поэтому временно отключим HTTPS-блок
в `deploy/nginx.conf`: закомментируйте весь блок `server { listen 443 ssl; ... }`
и в HTTP-блоке замените редирект на простую раздачу файлов:

```nginx
location / {
    root /usr/share/nginx/html;
    index index.html;
    try_files $uri $uri/ $uri.html =404;
}
```

### 4. Получите сертификат (см. следующий раздел)

### 5. Запустите

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f backend
```

### 6. Верните HTTPS-блок в `deploy/nginx.conf`

```bash
docker compose exec web nginx -t      # проверить конфигурацию
docker compose restart web
```

### Полезные команды

```bash
docker compose up -d --build     # пересобрать и перезапустить
docker compose ps                # статусы
docker compose logs -f backend   # логи бэкенда
docker compose logs -f web       # логи nginx
docker compose restart backend   # перезапустить только форму
docker compose down              # остановить
docker compose up -d --scale web=2   # два инстанса nginx за балансировщиком
```

---

## SSL-сертификат

### Получение (Let's Encrypt, бесплатно, автопродление)

DNS уже должен указывать на сервер, порт 80 открыт.

```bash
docker compose up -d web backend

docker run --rm \
  -v "$(pwd)/deploy/certbot/conf:/etc/letsencrypt" \
  -v "$(pwd)/deploy/certbot/www:/var/www/certbot" \
  certbot/certbot certonly \
  --webroot -w /var/www/certbot \
  --email riool@riool.ru \
  --agree-tos \
  --no-eff-email \
  -d riool-hw.ru -d www.riool-hw.ru
```

Сертификат попадёт в `deploy/certbot/conf/live/riool-hw.ru/`.

Продление автоматическое: контейнер `certbot` в `docker-compose.yml` каждые
12 часов выполняет `certbot renew`. Проверить вручную:

```bash
docker compose exec certbot certbot renew --dry-run
```

### Если нужен Cloudflare

Если DNS ведётся через Cloudflare, поставьте сертификат Origin
(https://dash.cloudflare.com → SSL/TLS → Origin Server → Create Certificate)
в `deploy/certbot/conf/live/riool-hw.ru/`, а режим — «Full (strict)».

---

## Обновление сайта

```bash
cd /opt/riool-hw.ru
git pull                      # или скопировать файлы по scp
docker compose restart web    # статика отдаётся сразу, nginx подхватит файлы
```

Файлы смонтированы в контейнер, поэтому пересборка образа не нужна — достаточно
рестарта (или вообще ничего, если браузер не кэшировал).

Сбросить кэш у пользователей после крупных правок:

```bash
docker compose exec web nginx -s reload
```

---

## Настройка домена у провайдера

Если домен ещё не привязан:

| Тип | Значение |
|---|---|
| A-запись | `@` → IP-адрес сервера |
| A-запись | `www` → IP-адрес сервера |
| AAAA-запись | если есть IPv6 |

Затем `tools.riool-hw.ru` (на который ссылается пункт меню «Полезное»)
настраивается отдельно — это другой поддомен, он может жить на отдельном проекте.

---

## Защита от спама

Работает «из коробки», без внешних сервисов:

| Метод | Где реализован |
|---|---|
| Honeypot — скрытое поле `company` | `backend/server.js`, `.form__hp` в HTML |
| Ограничение частоты: 5 заявок с одного IP за 10 минут | `rateLimit()` в `backend/server.js` |
| Проверка Origin/Referer по белому списку | `ALLOWED_ORIGINS` в `backend/.env` |
| Ограничение длины полей и фильтр ссылок на сокращатели | `validate()` в `backend/server.js` |
| Не показываем ошибки отправки ботам — отвечаем «успех» | honeypot-ветка в `server.js` |
| Токен формы (опционально) | `FORM_TOKEN` в `.env` |

Если захотите reCAPTCHA v3 — подключите её в `index.html` перед `js/main.js`
и проверяйте токен в `server.js` (замените ветку с honeypot).

---

## Проверка и отладка

```bash
# Синтаксис JS
node --check js/main.js
node --check backend/server.js

# Конфигурация nginx
docker compose exec web nginx -t

# JSON
node -e "JSON.parse(require('fs').readFileSync('backend/package.json'));console.log('ok')"
node -e "JSON.parse(require('fs').readFileSync('site.webmanifest'));console.log('ok')"

# Бэкенд жив?
curl http://localhost:3000/health

# Форма отвечает? (вместо реальной отправки проверим ответ на мусор)
curl -X POST http://localhost:3000/api/contact \
  -H "Content-Type: application/json" \
  -d '{"name":"Тест","email":"test@example.com","message":"Проверка отправки письма"}'
```

Чек-лист перед запуском:

- [ ] Страница открывается по HTTPS без ошибок в консоли
- [ ] Меню на мобильном открывается/закрывается
- [ ] Заголовок первого экрана появляется по словам
- [ ] При наведении на карточку появляется описание решения
- [ ] Все 3 способа связи кликабельны (телефон, почта, Telegram)
- [ ] Форма отправляется, письмо приходит на `riool@riool.ru`, в ответе — email клиента
- [ ] «Отправить» показывает экран «Спасибо! Заявка отправлена»
- [ ] `portfolio.html` открывается, кнопка «Все работы» ведёт туда
- [ ] Ссылки `*.example.com` заменены на реальные
- [ ] Скриншоты работ заменены на реальные

---

## Структура кода

### `css/styles.css`

Всё оформление в одной файле, разбит на 13 разделов:

1. Токены темы (CSS-переменные) — меняете цвета здесь, а не по всему файлу
2. Сброс и базовая типографика
3. Контейнер и утилиты (`.reveal` — появление при скролле)
4. Кнопки (`.btn--primary / --ghost / --outline`)
5. Шапка
6. Hero
7. Обо мне
8. Портфолио
9. Контакты
10. Футер
11. Модальное окно и форма
12. Адаптив (1024 / 860 / 640 / 400 px)
13. `prefers-reduced-motion` и печать

Смена цветовой схемы — только блок `:root` в начале файла.

### `js/main.js

Один IIFE с функциями-модулями:

| Функция | Зачем |
|---|---|
| `initHeader` | состояние «прилипшей» шапки |
| `initWordAnimation` | разбивает заголовок на `<span class="word">` с задержками |
| `initReveal` | `IntersectionObserver` — элементы появляются при скролле |
| `initParallax` | фоновые слои двигаются медленнее страницы |
| `initMobileMenu` | бургер, закрытие по Escape и по клику на ссылку |
| `initActiveSection` | подсветка активного пункта меню |
| `modal` | открытие/закрытие, удержание фокуса, блокировка прокрутки |
| `initForm` | валидация, отправка на `/api/contact`, состояния кнопки |

### `backend/server.js`

| Эндпоинт | Назначение |
|---|---|
| `GET /health` | проверка живости, есть ли настроенная почта |
| `POST /api/contact` | приём заявки: honeypot → токен → origin → валидация → письмо |

### Добавление нового проекта в портфолио

Скопируйте любой `<article class="card">` из `index.html`, вставьте рядом и
поменяйте: `src` превью, `alt`, заголовок, описание, теги, `href` и
`data-delay` (задержка анимации, 100 = 100 мс).

---

## Что реализовано по ТЗ

| Пункт ТЗ | Статус |
|---|---|
| Фиксированная шапка с 4 пунктами, плавный скролл | готово |
| «Полезное» → `https://tools.riool-hw.ru` в новой вкладке | готово |
| Hero: фото, заголовок по словам, оффер, CTA | готово |
| Секция «Обо мне» с фото и текстом из ТЗ | готово |
| Портфолио: 5 карточек, теги, кнопка «Открыть» в новой вкладке | готово, контент — заглушки |
| Hover на карточках: масштаб + доп. информация | готово |
| Кнопка «ВСЕ РАБОТЫ» → отдельная страница | готово (`portfolio.html`) |
| Контакты: телефон, email, Telegram — кликабельные | готово |
| Модалка с формой: имя, email, сообщение, отправка на `riool@riool.ru` | готово |
| Закрытие модалки: крестик, клик вне, Escape | готово |
| Экран «Спасибо! Заявка отправлена...» | готово |
| Футер с копирайтом и контактами | готово |
| Тёмно-зелёный градиент, бирюзовые акценты | готово |
| Анимации: word-by-word, параллакс, hover, fade-in при скролле | готово |
| Шрифт Inter, минимализм, без эмодзи | готово |
| Адаптивность (мобильные, планшеты, десктопы) | готово |
| Поддержка Chrome, Firefox, Safari, Edge | готово |
| Lazy loading изображений, width/height, async decode | готово |
| Отправка формы с Docker, защита от спама | готово |
| Title, description, Open Graph, favicon «R» | готово |
| Семантическая разметка, alt-теги, доступность с клавиатуры | готово |
| Комментарии в коде | готово |
| README с инструкцией по развёртыванию | готово |
| `prefers-reduced-motion` | готово (бонус) |
| JSON-LD разметка Person | готово (бонус) |
| Формат контента (PWA-манифест) | готово (бонус) |

Не сделано сознательно: reCAPTCHA (использован honeypot + rate limit без
внешних сервисов), сервис аналитики (не указан в ТЗ — при необходимости
добавьте Яндекс.Метрику или GA4 в `index.html` перед `</body>`).

---

## Контакты

- Сайт: <https://riool-hw.ru>
- Почта: riool@riool.ru
- Telegram: [@Za_ordy](https://t.me/Za_ordy)
- Телефон: +7 (926) 254-19-96

<!-- Coolify: app g14bopdsv7iukkfdzmlweqda, автодеплой через GitHub App webhook -->
