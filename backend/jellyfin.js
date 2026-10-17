/* ==========================================================================
   Riool — клиент Jellyfin для публичного каталога кинотеатра.

   Зачем отдельный модуль:
   - Jellyfin используется ТОЛЬКО как движок (сканирование + транскодинг HLS).
     Его собственные названия/постеры игнорируются.
   - Дерево каталога строится из поля Path (реальные пути на диске), поэтому
     структура папок (сериалы, сезоны, коллекции) сохраняется как есть, а
     имена берутся из имён файлов и папок.

   Токен (JELLYFIN_TOKEN) — это токен отдельного НЕ-админского пользователя
   Jellyfin. Он хранится только на сервере (переменная окружения).

   Переменные окружения:
     JELLYFIN_URL    — адрес Jellyfin (по умолчанию http://riool-jellyfin:8096)
     JELLYFIN_TOKEN  — токен доступа (обязателен для работы каталога)
   ========================================================================== */

'use strict';

const JELLYFIN_URL = (process.env.JELLYFIN_URL || 'http://riool-jellyfin:8096').replace(/\/+$/, '');
const JELLYFIN_TOKEN = process.env.JELLYFIN_TOKEN || '';

// Отображаемые имена корневых каталогов. Зрителю не нужно знать про диски —
// показываем нейтральные «части» коллекции.
// /media   <- F:\Video  (согласно docker-compose.yml)
// /media-d <- D:\Video
const ROOT_NAMES = {
  media: 'Часть 2',
  'media-d': 'Часть 1'
};

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 минут

/* Заголовок авторизации Jellyfin. ВАЖНО: эта версия Jellyfin принимает токен
   ТОЛЬКО через заголовок Authorization: MediaBrowser Token="…" (ни api_key в
   query, ни X-Emby-Token не работают). Без токена заголовок всё равно нужен —
   по нему Jellyfin выдаёт токен при входе по логину/паролю. */
function clientHeader(token) {
  return 'MediaBrowser ' + (token ? 'Token="' + token + '", ' : '') +
    'Client="riool-web", Device="browser", DeviceId="riool-web-1", Version="1.0.0"';
}

function authHeader() {
  return clientHeader(JELLYFIN_TOKEN);
}

/* GET-запрос к Jellyfin с таймаутом. Читает JSON. */
async function jfGet(pathname) {
  if (!JELLYFIN_TOKEN) throw new Error('JELLYFIN_TOKEN не задан');

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(JELLYFIN_URL + pathname, {
      headers: { Authorization: authHeader() },
      signal: ctrl.signal
    });
    if (!res.ok) throw new Error('Jellyfin HTTP ' + res.status);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/* Убираем расширение и «технические» разделители из имени файла для показа. */
function cleanName(name) {
  let n = String(name).replace(/\.[A-Za-z0-9]{1,5}$/, ''); // расширение
  n = n.replace(/[._]+/g, ' ');                             // точки/подчёркивания
  n = n.replace(/\s{2,}/g, ' ').trim();
  return n || String(name);
}

function extOf(name) {
  const m = /\.([A-Za-z0-9]{1,5})$/.exec(name);
  return m ? m[1].toLowerCase() : '';
}

/* Листьями дерева делаем только видеофайлы. Так в каталог не попадают
   служебные элементы Jellyfin (папки/сериалы/сезоны), у которых Path
   указывает на сам каталог без расширения. */
const VIDEO_EXT = new Set([
  'mp4', 'm4v', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'ts', 'm2ts', 'mts',
  'mpg', 'mpeg', 'm2v', 'webm', 'ogv', 'ogm', '3gp', 'vob', 'divx',
  'rmvb', 'asf', 'f4v', 'mxf', 'nut', 'rec', 'dtv'
]);

/* Естественная сортировка: «2 сезон» идёт раньше «10 сезон». */
function cmpName(a, b) {
  return a.name.localeCompare(b.name, 'ru', { numeric: true, sensitivity: 'base' });
}

function makeNode(key, name) {
  return { key, name, folders: new Map(), files: [] };
}

/* Преобразуем плоский список элементов Jellyfin в дерево каталогов по Path. */
function buildTree(items) {
  const roots = new Map();

  for (const it of items) {
    if (!it || !it.Path) continue;
    const segs = String(it.Path).replace(/\\/g, '/').split('/').filter(Boolean);
    if (segs.length < 2) continue; // нужен минимум: корень + файл

    const rootKey = segs[0];
    let node = roots.get(rootKey);
    if (!node) {
      node = makeNode(rootKey, ROOT_NAMES[rootKey] || rootKey);
      roots.set(rootKey, node);
    }

    for (let i = 1; i < segs.length - 1; i++) {
      const key = segs[i];
      let child = node.folders.get(key);
      if (!child) {
        child = makeNode(key, cleanName(key));
        node.folders.set(key, child);
      }
      node = child;
    }

    const fileName = segs[segs.length - 1];
    const ext = extOf(fileName);
    if (it.Id && VIDEO_EXT.has(ext)) {
      node.files.push({ id: it.Id, name: cleanName(fileName), ext });
    }
  }

  return serializeRoots(roots);
}

/* Map -> массивы, с сортировкой и подсчётом файлов в поддеревьях. */
function serializeNode(node) {
  const folders = Array.from(node.folders.values())
    .map(serializeNode)
    .sort(cmpName);

  const files = node.files
    .slice()
    .sort(cmpName);

  const count = folders.reduce((s, f) => s + f.count, 0) + files.length;

  return { key: node.key, name: node.name, count, folders, files };
}

function serializeRoots(roots) {
  return Array.from(roots.values())
    .map(serializeNode)
    .sort(cmpName);
}

/* --- Кэш дерева, чтобы не дёргать Jellyfin на каждый запрос --- */
const cache = { data: null, ts: 0, promise: null };

async function getTree() {
  if (cache.data && Date.now() - cache.ts < CACHE_TTL_MS) return cache.data;
  if (cache.promise) return cache.promise;

  cache.promise = (async () => {
    const me = await jfGet('/Users/Me');
    const items = await jfGet('/Items?Recursive=true&Fields=Path&Limit=100000');
    const list = Array.isArray(items.Items) ? items.Items : [];
    const roots = buildTree(list);

    const total = roots.reduce((s, r) => s + r.count, 0);

    const data = {
      userId: me.Id,
      roots,
      total,
      updatedAt: new Date().toISOString()
    };

    cache.data = data;
    cache.ts = Date.now();
    return data;
  })().finally(() => {
    cache.promise = null;
  });

  return cache.promise;
}

function isConfigured() {
  return Boolean(JELLYFIN_TOKEN);
}

/* --- Вход посетителя по логину/паролю Jellyfin -----------------------------
   Возвращает { token, user } либо бросает ошибку с .status = 401 при неверных
   данных. Пароль нигде не логируется. */
async function authenticate(username, password) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(JELLYFIN_URL + '/Users/AuthenticateByName', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: clientHeader('') },
      body: JSON.stringify({ Username: String(username || ''), Pw: String(password || '') }),
      signal: ctrl.signal
    });

    if (res.status === 401) {
      const err = new Error('Неверный логин или пароль');
      err.status = 401;
      throw err;
    }
    if (!res.ok) {
      const err = new Error('Jellyfin HTTP ' + res.status);
      err.status = res.status;
      throw err;
    }

    const data = await res.json();
    if (!data || !data.AccessToken) {
      const err = new Error('Jellyfin не выдал токен');
      err.status = 502;
      throw err;
    }
    return { token: data.AccessToken, user: data.User };
  } finally {
    clearTimeout(timer);
  }
}

/* --- Проверка токена сессии посетителя ------------------------------------
   Возвращает объект пользователя или null, если токен пустой/недействителен. */
async function validateToken(token) {
  if (!token) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(JELLYFIN_URL + '/Users/Me', {
      headers: { Authorization: clientHeader(token) },
      signal: ctrl.signal
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { getTree, isConfigured, buildTree, authenticate, validateToken };
