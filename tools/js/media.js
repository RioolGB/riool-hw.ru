/* ==========================================================================
   Riool Cinema — публичный каталог и плеер (media.html)

   - Каталог берётся с /api/media/tree (дерево папок из реальных путей).
   - Просмотр идёт через nginx-прокси /jf/ (токен Jellyfin в браузер не попадает).
   - Совместимые файлы играются напрямую, остальные — транскодятся в HLS (hls.js).
   ========================================================================== */
(function () {
  'use strict';

  var TREE_URL = '/api/media/tree';
  var JF = '/jf';
  var POS_PREFIX = 'riool-cinema-pos:';

  var state = {
    userId: null,
    roots: [],
    flat: [],
    stack: [],   // [{ name, node }]
    query: ''
  };

  var els = {};
  var player = { hls: null, itemId: null, saveTimer: null };

  /* --- Профиль устройства: сообщаем Jellyfin, что умеет браузер. --------- */
  function deviceProfile() {
    return {
      DeviceProfile: {
        MaxStreamingBitrate: 120000000,
        MaxStaticBitrate: 100000000,
        MusicStreamingTranscodingBitrate: 384000,
        DirectPlayProfiles: [
          { Container: 'mp4,m4v', Type: 'Video', VideoCodec: 'h264', AudioCodec: 'aac,mp3' },
          { Container: 'webm', Type: 'Video', VideoCodec: 'vp8,vp9,av1', AudioCodec: 'opus,vorbis' }
        ],
        TranscodingProfiles: [
          {
            Container: 'ts', Type: 'Video', AudioCodec: 'aac', VideoCodec: 'h264',
            Context: 'Streaming', Protocol: 'hls', MaxAudioChannels: '2',
            MinSegments: '1', BreakOnNonKeyFrames: true
          }
        ],
        ContainerProfiles: [],
        CodecProfiles: [],
        SubtitleProfiles: [{ Format: 'vtt', Method: 'External' }]
      },
      MaxStreamingBitrate: 120000000
    };
  }

  /* --- Утилиты DOM ------------------------------------------------------ */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function svg(html) {
    var span = document.createElement('span');
    span.className = 'svg-wrap';
    span.innerHTML = html; // только доверенные иконки
    return span.firstChild;
  }

  var ICON_FOLDER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/></svg>';
  var ICON_PLAY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 7 8 5-8 5V7Z" fill="currentColor" stroke="none"/></svg>';

  /* --- Отрисовка -------------------------------------------------------- */
  function current() {
    return state.stack.length ? state.stack[state.stack.length - 1].node : null;
  }

  function renderBreadcrumb() {
    var bar = els.breadcrumb;
    bar.textContent = '';

    var root = el('button', 'breadcrumb__item' + (state.stack.length ? '' : ' is-current'), 'Каталог');
    root.type = 'button';
    if (state.stack.length) {
      root.addEventListener('click', function () { state.stack = []; render(); });
    } else {
      root.disabled = true;
    }
    bar.appendChild(root);

    state.stack.forEach(function (entry, i) {
      bar.appendChild(svg('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="breadcrumb__sep"><path d="m9 6 6 6-6 6"/></svg>'));

      var isLast = i === state.stack.length - 1;
      var b = el('button', 'breadcrumb__item' + (isLast ? ' is-current' : ''), entry.name);
      b.type = 'button';
      if (isLast) {
        b.disabled = true;
      } else {
        b.addEventListener('click', function () {
          state.stack = state.stack.slice(0, i + 1);
          render();
        });
      }
      bar.appendChild(b);
    });
  }

  function folderEl(node) {
    var btn = el('button', 'lib-folder');
    btn.type = 'button';

    var icon = el('span', 'lib-folder__icon');
    icon.appendChild(svg(ICON_FOLDER));
    btn.appendChild(icon);

    var meta = el('span', 'lib-folder__meta');
    meta.appendChild(el('span', 'lib-folder__name', node.name));
    meta.appendChild(el('span', 'lib-folder__count', node.count + ' ' + plural(node.count, 'файл', 'файла', 'файлов')));
    btn.appendChild(meta);

    btn.addEventListener('click', function () {
      state.stack.push({ name: node.name, node: node });
      state.query = '';
      els.search.value = '';
      els.clear.hidden = true;
      render();
      window.scrollTo({ top: els.grid.offsetTop - 100, behavior: 'smooth' });
    });

    return btn;
  }

  function fileNameOf(file, trail) {
    var wrap = el('span', 'lib-file__name', file.name);
    if (trail) {
      wrap.appendChild(el('span', 'lib-file__path', trail));
    }
    return wrap;
  }

  function fileEl(file, trail) {
    var btn = el('button', 'lib-file');
    btn.type = 'button';

    var play = el('span', 'lib-file__play');
    play.appendChild(svg(ICON_PLAY));
    btn.appendChild(play);

    btn.appendChild(fileNameOf(file, trail));

    if (file.ext) btn.appendChild(el('span', 'lib-file__ext', file.ext));

    btn.addEventListener('click', function () {
      openPlayer(file, trail ? trail + ' / ' + file.name : file.name);
    });

    return btn;
  }

  function render() {
    if (state.query) return renderSearch();

    renderBreadcrumb();
    var grid = els.grid;
    grid.textContent = '';

    var node = current();

    if (!node) {
      // Корни каталога
      if (!state.roots.length) return showEmpty('Каталог пуст.');
      var wrapRoots = el('div', 'lib-folders');
      state.roots.forEach(function (r) { wrapRoots.appendChild(folderEl(r)); });
      grid.appendChild(wrapRoots);
    } else {
      if (node.folders.length) {
        grid.appendChild(sectionTitle('Папки'));
        var f = el('div', 'lib-folders');
        node.folders.forEach(function (c) { f.appendChild(folderEl(c)); });
        grid.appendChild(f);
      }
      if (node.files.length) {
        grid.appendChild(sectionTitle('Файлы'));
        var fl = el('div', 'lib-files');
        node.files.forEach(function (file) { fl.appendChild(fileEl(file)); });
        grid.appendChild(fl);
      }
      if (!node.folders.length && !node.files.length) {
        return showEmpty('Здесь пусто.');
      }
    }

    showGrid();
  }

  function sectionTitle(text) {
    return el('div', 'lib__section-title', text);
  }

  function renderSearch() {
    renderBreadcrumb();
    var q = state.query.toLowerCase();
    var results = state.flat.filter(function (f) {
      return f.name.toLowerCase().indexOf(q) !== -1 ||
             (f.trail && f.trail.toLowerCase().indexOf(q) !== -1);
    });

    var grid = els.grid;
    grid.textContent = '';

    if (!results.length) return showEmpty('Ничего не найдено по запросу «' + state.query + '».');

    grid.appendChild(sectionTitle('Найдено: ' + results.length));
    var list = el('div', 'lib-files');
    results.slice(0, 500).forEach(function (f) {
      list.appendChild(fileEl(f, f.trail));
    });
    grid.appendChild(list);
    showGrid();
  }

  function showGrid() { els.status.hidden = true; els.grid.hidden = false; }
  function showEmpty(msg) {
    els.grid.hidden = true;
    els.status.hidden = false;
    els.status.textContent = msg;
  }

  /* --- Плеер ------------------------------------------------------------ */
  function openPlayer(file, label) {
    els['playerTitle'].textContent = file.name;
    els['playerPath'].textContent = label || '';
    els['player'].hidden = false;
    document.body.style.overflow = 'hidden';

    setOverlay(true, 'Готовим видео…');
    player.itemId = file.id;

    fetch(JF + '/Items/' + file.id + '/PlaybackInfo?UserId=' + encodeURIComponent(state.userId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(deviceProfile())
    })
      .then(function (r) {
        if (!r.ok) throw new Error('PlaybackInfo HTTP ' + r.status);
        return r.json();
      })
      .then(function (info) {
        var ms = info.MediaSources && info.MediaSources[0];
        if (!ms) throw new Error('Нет источника воспроизведения');
        play(file, ms);
      })
      .catch(function (err) {
        setOverlay(true, 'Не удалось открыть видео: ' + err.message);
        els['player'].classList.add('is-error');
      });
  }

  function play(file, ms) {
    var video = els['playerVideo'];

    if (ms.SupportsDirectPlay) {
      // Совместимый файл — играем напрямую
      video.src = JF + '/Videos/' + file.id + '/stream?static=true&MediaSourceId=' + encodeURIComponent(ms.Id);
      attachResume(video, file.id);
      video.play().catch(function () {});
      return;
    }

    var hlsUrl = ms.TranscodingUrl ? JF + stripApiKey(ms.TranscodingUrl) : null;
    if (!hlsUrl) throw new Error('Транскодинг недоступен');

    setOverlay(true, 'Транскодирование…');

    if (window.Hls && window.Hls.isSupported()) {
      player.hls = new window.Hls({ maxBufferLength: 30 });
      player.hls.loadSource(hlsUrl);
      player.hls.attachMedia(video);
      player.hls.on(window.Hls.Events.MANIFEST_PARSED, function () {
        attachResume(video, file.id);
        video.play().catch(function () {});
      });
      player.hls.on(window.Hls.Events.ERROR, function (evt, data) {
        if (data && data.fatal) {
          setOverlay(true, 'Ошибка воспроизведения');
          els['player'].classList.add('is-error');
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = hlsUrl;
      attachResume(video, file.id);
      video.play().catch(function () {});
    } else {
      setOverlay(true, 'Браузер не поддерживает воспроизведение');
      els['player'].classList.add('is-error');
    }
  }

  function setOverlay(show, text) {
    els['overlay'].hidden = !show;
    if (text) els['overlayText'].textContent = text;
    if (show) els['player'].classList.remove('is-error');
  }

  function attachResume(video, id) {
    var key = POS_PREFIX + id;

    video.addEventListener('loadedmetadata', function () {
      var saved = parseFloat(localStorage.getItem(key) || '0');
      if (saved > 5 && isFinite(saved) && (!video.duration || saved < video.duration - 10)) {
        try { video.currentTime = saved; } catch (e) {}
      }
    }, { once: true });

    video.addEventListener('playing', function () { setOverlay(false); });

    var save = function () {
      if (video.currentTime > 5) {
        try { localStorage.setItem(key, String(video.currentTime)); } catch (e) {}
      }
    };
    video.addEventListener('timeupdate', function () {
      if (!player.saveTimer) {
        player.saveTimer = setTimeout(function () { player.saveTimer = null; save(); }, 5000);
      }
    });
    window.addEventListener('beforeunload', save);
    video.addEventListener('pause', save);
  }

  function closePlayer() {
    var video = els['playerVideo'];
    try { video.pause(); } catch (e) {}

    if (player.hls) { try { player.hls.destroy(); } catch (e) {} player.hls = null; }
    video.removeAttribute('src');
    try { video.load(); } catch (e) {}

    els['player'].hidden = true;
    els['player'].classList.remove('is-error');
    document.body.style.overflow = '';
    player.itemId = null;
  }

  /* --- Поиск ------------------------------------------------------------ */
  /* Живой поиск: после 2+ символов показываем выпадающий список подсказок.
     Enter — показать все результаты в основной сетке, Escape — закрыть. */
  var SEARCH_MIN = 2;
  var SEARCH_MAX = 8;
  var searchTimer = null;

  function matchFlat(q) {
    var lq = q.toLowerCase();
    return state.flat.filter(function (f) {
      return f.name.toLowerCase().indexOf(lq) !== -1 ||
             (f.trail && f.trail.toLowerCase().indexOf(lq) !== -1);
    });
  }

  function hideSuggest() {
    if (!els.suggest) return;
    els.suggest.hidden = true;
    els.suggest.textContent = '';
  }

  function showSuggest(q) {
    var box = els.suggest;
    box.textContent = '';
    var results = matchFlat(q);

    if (!results.length) {
      box.appendChild(el('div', 'lib__suggest-empty', 'Ничего не найдено'));
      box.hidden = false;
      return;
    }

    results.slice(0, SEARCH_MAX).forEach(function (f) {
      var item = el('button', 'lib__suggest-item');
      item.type = 'button';

      var play = el('span', 'lib__suggest-play');
      play.appendChild(svg(ICON_PLAY));
      item.appendChild(play);

      var nm = el('span', 'lib__suggest-name', f.name);
      if (f.trail) nm.title = f.trail + ' / ' + f.name;
      item.appendChild(nm);

      if (f.ext) item.appendChild(el('span', 'lib-file__ext', f.ext));

      // mousedown, а не click — чтобы сработало раньше, чем уйдёт фокус (blur).
      item.addEventListener('mousedown', function (e) {
        e.preventDefault();
        hideSuggest();
        openPlayer(f, f.trail ? f.trail + ' / ' + f.name : f.name);
      });

      box.appendChild(item);
    });

    if (results.length > SEARCH_MAX) {
      var all = el('button', 'lib__suggest-all', 'Показать все результаты (' + results.length + ')');
      all.type = 'button';
      all.addEventListener('mousedown', function (e) {
        e.preventDefault();
        applySearch(q);
      });
      box.appendChild(all);
    }

    box.hidden = false;
  }

  function applySearch(q) {
    hideSuggest();
    state.query = q;
    render();
  }

  function onSearch() {
    var q = els.search.value.trim();
    els.clear.hidden = !q;
    clearTimeout(searchTimer);

    if (q.length < SEARCH_MIN) {
      hideSuggest();
      if (state.query) { state.query = ''; render(); }
      return;
    }
    searchTimer = setTimeout(function () { showSuggest(q); }, 120);
  }

  function onSearchKey(e) {
    if (e.key === 'Enter') {
      var q = els.search.value.trim();
      if (q) { e.preventDefault(); applySearch(q); els.search.blur(); }
    } else if (e.key === 'Escape') {
      hideSuggest();
    }
  }

  /* --- Вспомогательное -------------------------------------------------- */
  /* Jellyfin добавляет к ссылкам транскодинга параметр ApiKey=<токен>.
     Токен на клиенте не нужен (nginx подставляет заголовок сам), поэтому
     вырезаем его, чтобы не светить в адресной строке и сети. */
  function stripApiKey(url) {
    var hash = '';
    var i = url.indexOf('#');
    if (i !== -1) { hash = url.slice(i); url = url.slice(0, i); }

    var parts = url.split('?');
    if (parts.length < 2) return url + hash;

    var q = parts.slice(1).join('?').split('&').filter(function (kv) {
      return !/^ApiKey=/i.test(kv);
    });
    return parts[0] + (q.length ? '?' + q.join('&') : '') + hash;
  }

  function plural(n, one, few, many) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
    return many;
  }

  function flatten(node, trail, out) {
    node.folders.forEach(function (f) { flatten(f, trail.concat(f.name), out); });
    node.files.forEach(function (file) {
      out.push({ id: file.id, name: file.name, ext: file.ext, trail: trail.join(' / ') });
    });
  }

  /* --- Инициализация ---------------------------------------------------- */
  function init() {
    els = {
      status: document.getElementById('lib-status'),
      grid: document.getElementById('lib-grid'),
      breadcrumb: document.getElementById('lib-breadcrumb'),
      search: document.getElementById('lib-search'),
      clear: document.getElementById('lib-search-clear'),
      suggest: document.getElementById('lib-suggest'),
      stats: document.getElementById('lib-stats'),
      'player': document.getElementById('player'),
      'playerTitle': document.getElementById('player-title'),
      'playerPath': document.getElementById('player-path'),
      'playerVideo': document.getElementById('player-video'),
      'overlay': document.getElementById('player-overlay'),
      'overlayText': document.getElementById('player-overlay-text')
    };

    if (!els.grid) return; // не страница каталога

    els.search.addEventListener('input', onSearch);
    els.search.addEventListener('keydown', onSearchKey);
    els.search.addEventListener('blur', function () { setTimeout(hideSuggest, 120); });
    els.clear.addEventListener('click', function () {
      els.search.value = '';
      hideSuggest();
      onSearch();
      els.search.focus();
    });

    // Дисклеймер для новых посетителей (запоминаем, что его скрыли).
    var note = document.getElementById('lib-note');
    if (note) {
      try { if (localStorage.getItem('riool-cinema-note') === '0') note.hidden = true; } catch (e) {}
      var noteClose = document.getElementById('lib-note-close');
      if (noteClose) noteClose.addEventListener('click', function () {
        note.hidden = true;
        try { localStorage.setItem('riool-cinema-note', '0'); } catch (e) {}
      });
    }

    document.getElementById('player-close').addEventListener('click', closePlayer);
    document.querySelector('[data-player-close]').addEventListener('click', closePlayer);
    els['playerVideo'].addEventListener('error', function () {
      if (!els['player'].hidden) {
        setOverlay(true, 'Не удалось воспроизвести файл');
        els['player'].classList.add('is-error');
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !els['player'].hidden) closePlayer();
    });

    var logout = document.getElementById('nav-logout');
    if (logout) {
      logout.addEventListener('click', function () {
        fetch('/api/logout', { method: 'POST' })
          .catch(function () {})
          .then(function () { window.location.href = 'index.html'; });
      });
    }

    // Без активной сессии каталог показывать нельзя — отправляем на форму входа.
    fetch('/api/session', { headers: { 'Accept': 'application/json' } })
      .then(function (r) {
        if (!r.ok) { window.location.replace('index.html?login=1'); return; }
        loadTree();
      })
      .catch(function () { window.location.replace('index.html?login=1'); });
  }

  function loadTree() {
    fetch(TREE_URL)
      .then(function (r) {
        if (r.status === 401) { window.location.replace('index.html?login=1'); throw new Error('unauth'); }
        return r.json();
      })
      .then(function (data) {
        if (!data || !data.ok) throw new Error((data && data.error) || 'Каталог недоступен');
        state.userId = data.userId;
        state.roots = data.roots || [];
        var out = [];
        state.roots.forEach(function (r) { flatten(r, [r.name], out); });
        state.flat = out;

        els.stats.textContent = data.total + ' ' + plural(data.total, 'видео', 'видео', 'видео') +
          ' в коллекции' + (state.roots.length ? ' • разделов: ' + state.roots.length : '');
        render();
      })
      .catch(function (err) {
        if (err && err.message === 'unauth') return;
        els.status.hidden = false;
        els.status.textContent = 'Каталог временно недоступен (' + err.message + ').';
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
