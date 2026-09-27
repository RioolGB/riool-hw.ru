/* ==========================================================================
   Riool — backend формы обратной связи
   Принимает POST /api/contact, проверяет поля, отсекает спам и отправляет
   письмо на riool@riool.ru через SMTP (Яндекс.Почта / Gmail / любой другой).

   Запуск:  node server.js      (или через Docker — см. Dockerfile)
   Переменные окружения — см. .env.example
   ========================================================================== */

'use strict';

const express = require('express');
const nodemailer = require('nodemailer');
const path = require('path');
const crypto = require('crypto');

/* --------------------------------------------------------------------------
   Конфигурация
   -------------------------------------------------------------------------- */
const config = {
  port: Number(process.env.PORT || 3000),

  // Куда отправляем заявки
  to: process.env.MAIL_TO || 'riool@riool.ru',
  // Адрес отправителя. Должен быть подтверждён у провайдера SMTP
  from: process.env.MAIL_FROM || process.env.SMTP_USER || 'riool@riool.ru',

  // Ответ клиенту уходит на reply-to, письмо с текстом «заявка» — на MAIL_TO
  subjectPrefix: process.env.MAIL_SUBJECT_PREFIX || 'Заявка с riool-hw.ru',

  smtp: {
    host: process.env.SMTP_HOST || 'smtp.yandex.ru',
    port: Number(process.env.SMTP_PORT || 465),
    secure: process.env.SMTP_SECURE !== 'false', // 465 = SSL, 587 = STARTTLS
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || ''
    }
  },

  // Лимиты
  maxNameLength: 80,
  maxEmailLength: 120,
  maxMessageLength: 4000,

  // Разрешённые источники (пусто = любые). Пример: 'https://riool-hw.ru'
  allowedOrigins: (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  // Секрет для подписи форм (опционально): если задан, требуется заголовок X-Form-Token
  formToken: process.env.FORM_TOKEN || '',

  // Минимальное время заполнения формы в мс (защита от мгновенной автоотправки)
  minFillMs: Number(process.env.MIN_FILL_MS || 1500),

  // Проверка origin/referer (включается автоматически, если задан ALLOWED_ORIGINS)
  trustProxy: process.env.TRUST_PROXY === 'true'
};

const isConfigured = Boolean(config.smtp.auth.user && config.smtp.auth.pass);

/* --------------------------------------------------------------------------
   Логирование
   -------------------------------------------------------------------------- */
function log(...args) {
  const stamp = new Date().toISOString();
  console.log(`[${stamp}]`, ...args);
}

/* --------------------------------------------------------------------------
   Транспорт для писем
   -------------------------------------------------------------------------- */
let transporter = null;

if (isConfigured) {
  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: config.smtp.auth,
    // Не залипаем на недоступном SMTP
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    pool: true,
    maxConnections: 3
  });

  // Проверяем доступность SMTP один раз при старте
  transporter
    .verify()
    .then(() => log('SMTP доступен:', config.smtp.host + ':' + config.smtp.port))
    .catch((err) => log('ОШИБКА SMTP:', err.message));
} else {
  log('ВНИМАНИЕ: SMTP_USER/SMTP_PASS не заданы — письма отправляться не будут.');
  log('Скопируйте .env.example в .env, заполните пароль и перезапустите контейнер.');
}

/* --------------------------------------------------------------------------
   Приложение
   -------------------------------------------------------------------------- */
const app = express();

if (config.trustProxy) app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(express.json({ limit: '64kb' }));
app.use(express.urlencoded({ extended: false, limit: '64kb' }));

// Простые заголовки безопасности (CORS настраивается отдельно)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

/* --------------------------------------------------------------------------
   CORS: разрешаем только свой домен, если он задан в ALLOWED_ORIGINS
   -------------------------------------------------------------------------- */
app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (config.allowedOrigins.length) {
    if (origin && config.allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Form-Token');
      res.setHeader('Access-Control-Max-Age', '86400');
      return res.status(204).end();
    }
  }

  next();
});

/* --------------------------------------------------------------------------
   Защита от спама: ограничение частоты запросов по IP
   -------------------------------------------------------------------------- */
const WINDOW_MS = 10 * 60 * 1000; // 10 минут
const MAX_PER_WINDOW = 5;         // не больше 5 заявок с одного IP за окно
const hits = new Map();

function rateLimit(req, res, next) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);

  if (list.length >= MAX_PER_WINDOW) {
    const waitSeconds = Math.ceil((WINDOW_MS - (now - list[0])) / 1000);
    log('rate limit:', ip);
    return res.status(429).json({
      ok: false,
      error: `Слишком много заявок. Попробуйте ещё раз через ${Math.ceil(waitSeconds / 60)} мин.`
    });
  }

  list.push(now);
  hits.set(ip, list);
  next();
}

// Периодически чистим протухшие записи, чтобы карта не росла бесконечно
setInterval(() => {
  const now = Date.now();
  for (const [ip, list] of hits) {
    const fresh = list.filter((t) => now - t < WINDOW_MS);
    if (fresh.length) hits.set(ip, fresh);
    else hits.delete(ip);
  }
}, WINDOW_MS).unref();

/* --------------------------------------------------------------------------
   Валидация
   -------------------------------------------------------------------------- */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Простые ссылки на спам-сервисы в теле письма
const SPAM_LINKS_RE = /https?:\/\/[^\s]*(bit\.ly|tinyurl|t\.me|is\.gd|cutt\.ly)/i;

function validate(payload) {
  const errors = {};
  const name = String(payload.name || '').trim();
  const email = String(payload.email || '').trim();
  const message = String(payload.message || '').trim();

  if (!name) errors.name = 'Укажите имя';
  else if (name.length < 2) errors.name = 'Слишком короткое имя';
  else if (name.length > config.maxNameLength) errors.name = 'Слишком длинное имя';

  if (!email) errors.email = 'Укажите email';
  else if (!EMAIL_RE.test(email)) errors.email = 'Некорректный email';
  else if (email.length > config.maxEmailLength) errors.email = 'Слишком длинный email';

  if (!message) errors.message = 'Напишите текст сообщения';
  else if (message.length < 10) errors.message = 'Добавьте подробностей (от 10 символов)';
  else if (message.length > config.maxMessageLength) errors.message = 'Слишком длинное сообщение';
  else if (SPAM_LINKS_RE.test(message)) errors.message = 'Сообщение отклонено: слишком много ссылок';

  return { errors, name, email, message };
}

/* Экранируем спецсимволы HTML, чтобы вставить текст в письмо безопасно */
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

/* --------------------------------------------------------------------------
   Шаблоны писем
   -------------------------------------------------------------------------- */
function buildHtml({ name, email, message, page, userAgent, ip }) {
  const row = (label, value) => `
    <tr>
      <td style="padding:10px 16px;border-bottom:1px solid #e6efe9;color:#5a6b65;font:14px Arial,sans-serif;white-space:nowrap;">${label}</td>
      <td style="padding:10px 16px;border-bottom:1px solid #e6efe9;color:#0f241d;font:14px Arial,sans-serif;word-break:break-word;">${value}</td>
    </tr>`;

  return `<!DOCTYPE html>
<html lang="ru">
<body style="margin:0;padding:24px;background:#f2f7f5;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #dbe8e1;">
    <tr>
      <td style="padding:24px 28px;background:#0a3d2e;">
        <span style="color:#7df0c4;font:700 20px Arial,sans-serif;">Riool</span>
        <span style="display:block;color:#a9c4bb;font:14px Arial,sans-serif;margin-top:4px;">Новая заявка с сайта riool-hw.ru</span>
      </td>
    </tr>
    <tr>
      <td style="padding:22px 28px 6px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font:14px Arial,sans-serif;">
          ${row('Имя', escapeHtml(name))}
          ${row('Email', `<a href="mailto:${escapeHtml(email)}" style="color:#0a3d2e;">${escapeHtml(email)}</a>`)}
          ${row('Страница', escapeHtml(page || '—'))}
          ${row('IP', escapeHtml(ip))}
          ${row('Браузер', escapeHtml(userAgent || '—'))}
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:16px 28px 8px;">
        <p style="margin:0 0 8px;color:#5a6b65;font:600 13px Arial,sans-serif;text-transform:uppercase;letter-spacing:.08em;">Сообщение</p>
        <div style="padding:16px 18px;background:#f6faf8;border-left:3px solid #34d399;border-radius:8px;color:#0f241d;font:15px/1.6 Arial,sans-serif;white-space:pre-wrap;">${escapeHtml(message)}</div>
      </td>
    </tr>
    <tr>
      <td style="padding:18px 28px 26px;">
        <a href="mailto:${escapeHtml(email)}?subject=${encodeURIComponent('Re: ' + config.subjectPrefix)}" style="display:inline-block;padding:12px 22px;background:#34d399;color:#04231a;text-decoration:none;border-radius:999px;font:600 15px Arial,sans-serif;">Ответить клиенту</a>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildText({ name, email, message, page, userAgent, ip }) {
  return [
    'Новая заявка с сайта riool-hw.ru',
    '',
    `Имя:     ${name}`,
    `Email:   ${email}`,
    `Страница: ${page || '—'}`,
    `IP:      ${ip}`,
    `Браузер: ${userAgent || '—'}`,
    '',
    'Сообщение:',
    '----------------------------------------',
    message
  ].join('\n');
}

/* --------------------------------------------------------------------------
   Маршруты
   -------------------------------------------------------------------------- */

// Проверка живости контейнера
app.get('/health', (req, res) => {
  res.json({ ok: true, mailConfigured: isConfigured, uptime: Math.round(process.uptime()) });
});

// Приём заявки
app.post('/api/contact', rateLimit, async (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || '—';

  // 1. Honeypot: скрытое поле «company» заполняют только боты.
  //    Отвечаем как будто всё прошло, но письмо не отправляем.
  if (String(req.body?.company || '').trim()) {
    log('honeypot triggered, ip:', ip);
    return res.json({ ok: true });
  }

  // 2. Опциональный токен формы
  if (config.formToken) {
    const token = req.get('X-Form-Token') || '';
    const expected = crypto.createHash('sha256').update(config.formToken).digest('hex').slice(0, 32);
    if (token !== expected) {
      return res.status(400).json({ ok: false, error: 'Заявка не прошла проверку. Обновите страницу и попробуйте снова.' });
    }
  }

  // 3. Проверка origin/referer, если домен задан в ALLOWED_ORIGINS
  if (config.allowedOrigins.length) {
    const origin = req.get('origin') || '';
    const referer = (req.get('referer') || '').replace(/\/$/, '');
    const allowed = config.allowedOrigins.some((o) => referer === o.replace(/\/$/, ''));
    if (origin && !config.allowedOrigins.includes(origin) && !allowed) {
      log('origin rejected:', origin || referer);
      return res.status(403).json({ ok: false, error: 'Заявка отклонена.' });
    }
  }

  // 4. Валидация полей
  const { errors, name, email, message } = validate(req.body || {});
  if (Object.keys(errors).length) {
    return res.status(400).json({ ok: false, error: Object.values(errors)[0], errors });
  }

  // 5. Отправка письма
  if (!isConfigured || !transporter) {
    log('заявка не отправлена — SMTP не настроен');
    return res.status(503).json({ ok: false, error: 'Почта временно недоступна. Напишите на riool@riool.ru' });
  }

  const meta = {
    page: String(req.body?.page || '').slice(0, 300),
    userAgent: String(req.get('user-agent') || '').slice(0, 300)
  };

  const stamp = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
  const subject = `${config.subjectPrefix} — ${name} (${stamp})`;

  try {
    const info = await transporter.sendMail({
      from: config.from,
      to: config.to,
      replyTo: `${name} <${email}>`,
      subject,
      text: buildText({ name, email, message, ...meta, ip }),
      html: buildHtml({ name, email, message, ...meta, ip }),
      headers: { 'X-Mailer': 'riool-hw-backend' }
    });

    log('заявка отправлена:', email, info.messageId);
    return res.json({ ok: true });
  } catch (err) {
    log('ОШИБКА отправки:', err.message);
    return res.status(500).json({ ok: false, error: 'Не удалось отправить заявку. Напишите, пожалуйста, на riool@riool.ru' });
  }
});

// 404
app.use((req, res) => {
  res.status(404).json({ ok: false, error: 'Метод не найден' });
});

/* --------------------------------------------------------------------------
   Запуск и корректное завершение
   -------------------------------------------------------------------------- */
const server = app.listen(config.port, () => {
  log(`Сервер слушает 0.0.0.0:${config.port}`);
  log(`Заявки будут отправляться на ${config.to}`);
});

function shutdown(signal) {
  log('Получен сигнал', signal + ', останавливаюсь…');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (err) => log('unhandledRejection:', err));
