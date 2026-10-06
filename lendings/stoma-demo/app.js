// State
let priceData = [];
let categories = [];
let selectedServices = [];
let activeCategory = 'all';
let searchTerm = '';
let sourceMeta = null;

const YANDEX_DISK_URL = 'https://disk.yandex.ru/i/YlzHCYtfPXa1iw';

// DOM Elements
const loadDataBtn = document.getElementById('load-data-btn');
const fileInput = document.getElementById('file-input');
const updatePricesBtn = document.getElementById('update-prices-btn');
const searchInput = document.getElementById('search-input');
const filtersContainer = document.getElementById('filters-container');
const servicesList = document.getElementById('services-list');
const selectedServicesContainer = document.getElementById('selected-services');
const totalValue = document.getElementById('total-value');
const finalValue = document.getElementById('final-value');
const savingsRow = document.getElementById('savings-row');
const savingsValue = document.getElementById('savings-value');
const clearPlanBtn = document.getElementById('clear-plan-btn');
const exportBtn = document.getElementById('export-btn');
const printBtn = document.getElementById('print-btn');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toast-message');
const dataStatus = document.getElementById('data-status');

// ---------- Lazy XLSX ----------

function loadXlsx() {
  if (typeof XLSX !== 'undefined') return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'xlsx.full.min.js';
    s.onload = resolve;
    s.onerror = () => reject(new Error('Не удалось загрузить библиотеку XLSX'));
    document.head.appendChild(s);
  });
}

// ---------- Data Loading ----------

function formatUpdateDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${day}.${month}.${year} в ${hours}:${mins}`;
}

function setDataStatus(meta, count) {
  if (!meta || meta.sourceUrl === 'bundled') {
    dataStatus.textContent = `Загружено: ${count} услуг (встроенный прайс)`;
  } else {
    const date = formatUpdateDate(meta.lastUpdated);
    const src = meta.sourceUrl === 'local' ? meta.fileName : 'Яндекс Диск';
    dataStatus.innerHTML = `Загружено: <strong>${count} услуг</strong> из ${src}` +
      (date ? `<span class="last-update"> • обновлено ${date}</span>` : '');
  }
}

function setLoading(btn, loading) {
  if (loading) {
    btn.disabled = true;
    btn.dataset.origText = btn.innerHTML;
    btn.innerHTML = `<svg class="btn-icon spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.2-8.6"/></svg> Загрузка...`;
  } else {
    btn.disabled = false;
    if (btn.dataset.origText) btn.innerHTML = btn.dataset.origText;
  }
}

function rowsToArray(wb) {
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { header: 1 });
}

async function loadYandexDisk() {
  const apiUrl = `https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=${encodeURIComponent(YANDEX_DISK_URL)}`;
  const apiRes = await fetch(apiUrl);
  if (!apiRes.ok) throw new Error(`HTTP ${apiRes.status}`);
  const apiData = await apiRes.json();
  if (!apiData.href) throw new Error('Не удалось получить ссылку на скачивание с Яндекс Диска');
  const fileRes = await fetch(apiData.href);
  if (!fileRes.ok) throw new Error(`HTTP ${fileRes.status}`);
  const buf = await fileRes.arrayBuffer();
  return rowsToArray(XLSX.read(buf, { type: 'array' }));
}

// Update prices from Yandex Disk
updatePricesBtn.addEventListener('click', async () => {
  setLoading(updatePricesBtn, true);
  try {
    await loadXlsx();
    const data = await loadYandexDisk();
    sourceMeta = { sourceUrl: YANDEX_DISK_URL, lastUpdated: new Date().toISOString(), fileName: 'table-price.xlsx' };
    processData(data);
    setDataStatus(sourceMeta, priceData.length);
    showToast('Цены обновлены с Яндекс Диска', 'success');
  } catch (e) {
    showToast('Ошибка: ' + e.message, 'error');
  } finally {
    setLoading(updatePricesBtn, false);
  }
});

// Load from file dialog
loadDataBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', async () => {
  const f = fileInput.files[0];
  if (!f) return;
  setLoading(loadDataBtn, true);
  try {
    await loadXlsx();
    const ab = await f.arrayBuffer();
    const data = rowsToArray(XLSX.read(ab, { type: 'array' }));
    sourceMeta = { sourceUrl: 'local', fileName: f.name, lastUpdated: new Date().toISOString() };
    processData(data);
    setDataStatus(sourceMeta, priceData.length);
    showToast('Файл загружен', 'success');
  } catch (e) {
    showToast('Ошибка загрузки: ' + e.message, 'error');
  } finally {
    setLoading(loadDataBtn, false);
    fileInput.value = '';
  }
});

// ---------- Data Processing ----------

function processData(data) {
  priceData = [];
  categories = new Set();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row && row.length >= 3) {
      const category = row[0].replace(/\*\*/g, '').trim();
      const name = row[1].trim();
      const priceStr = String(row[2]).trim();

      if (!name) continue;

      if (priceStr === 'Бесплатно' || priceStr === '0' || priceStr === '') {
        priceData.push({ category, name, price: 0, priceStr: 'Бесплатно' });
      } else {
        const price = parseInt(priceStr.replace(/\s/g, ''), 10);
        if (!isNaN(price)) {
          priceData.push({ category, name, price, priceStr: price.toLocaleString('ru-RU') + ' ₽' });
        }
      }
      categories.add(category);
    }
  }

  categories = Array.from(categories).sort();
  renderFilters();
  renderServices();
  renderSelectedServices();
  updateTotal();
}

// ---------- Filters ----------

function renderFilters() {
  filtersContainer.innerHTML = '<button class="filter-btn active" data-category="all">Все</button>';
  categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'filter-btn';
    btn.dataset.category = cat;
    btn.textContent = cat;
    filtersContainer.appendChild(btn);
  });

  filtersContainer.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      filtersContainer.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeCategory = btn.dataset.category;
      renderServices();
    });
  });
}

// ---------- Services List ----------

function renderServices() {
  const filtered = priceData.filter(item => {
    const matchCategory = activeCategory === 'all' || item.category === activeCategory;
    const matchSearch = !searchTerm || item.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchCategory && matchSearch;
  });

  if (filtered.length === 0) {
    servicesList.innerHTML = `
      <div class="empty-state">
        <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <p>${priceData.length === 0 ? 'Нет данных' : 'Ничего не найдено'}</p>
      </div>
    `;
    return;
  }

  const grouped = {};
  filtered.forEach(item => {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
  });

  servicesList.innerHTML = '';
  Object.keys(grouped).forEach(category => {
    const categoryEl = document.createElement('div');
    categoryEl.className = 'service-category';

    const header = document.createElement('div');
    header.className = 'category-header';
    header.textContent = category;
    categoryEl.appendChild(header);

    grouped[category].forEach(item => {
      const itemEl = document.createElement('div');
      itemEl.className = 'service-item';
      const isSelected = selectedServices.some(s => s.name === item.name && s.category === item.category);
      if (isSelected) itemEl.classList.add('selected');

      const idx = priceData.indexOf(item);
      itemEl.innerHTML = `
        <div class="service-checkbox"></div>
        <div class="service-info">
          <div class="service-name" title="${item.name}">${item.name}</div>
        </div>
        <div class="service-qty">
          <button class="qty-btn qty-minus" data-idx="${idx}">&minus;</button>
          <span class="qty-value">${getQty(item)}</span>
          <button class="qty-btn qty-plus" data-idx="${idx}">+</button>
        </div>
        <div class="service-price">${item.price === 0 ? 'Бесплатно' : item.priceStr}</div>
      `;

      itemEl.addEventListener('click', (e) => {
        if (e.target.classList.contains('qty-btn')) return;
        toggleService(item);
      });

      categoryEl.appendChild(itemEl);
    });

    servicesList.appendChild(categoryEl);
  });

  servicesList.querySelectorAll('.qty-minus').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      changeQty(priceData[parseInt(btn.dataset.idx)], -1);
    });
  });

  servicesList.querySelectorAll('.qty-plus').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      changeQty(priceData[parseInt(btn.dataset.idx)], 1);
    });
  });
}

function getQty(item) {
  const found = selectedServices.find(s => s.name === item.name && s.category === item.category);
  return found ? found.qty : 1;
}

function changeQty(item, delta) {
  const found = selectedServices.find(s => s.name === item.name && s.category === item.category);
  if (!found) {
    selectedServices.push({ ...item, qty: 1 });
    changeQty(item, delta);
    return;
  }
  found.qty = Math.max(1, found.qty + delta);
  renderServices();
  renderSelectedServices();
  updateTotal();
}

// ---------- Selection ----------

function toggleService(item) {
  const idx = selectedServices.findIndex(s => s.name === item.name && s.category === item.category);
  if (idx >= 0) {
    selectedServices.splice(idx, 1);
  } else {
    selectedServices.push({ ...item, qty: 1 });
  }
  renderServices();
  renderSelectedServices();
  updateTotal();
}

function renderSelectedServices() {
  if (selectedServices.length === 0) {
    selectedServicesContainer.innerHTML = `
      <div class="empty-plan">
        <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
        </svg>
        <p>Выберите услуги из списка</p>
      </div>
    `;
    return;
  }

  selectedServicesContainer.innerHTML = '';
  selectedServices.forEach((item, idx) => {
    const el = document.createElement('div');
    el.className = 'selected-item';
    const price = item.price * item.qty;
    el.innerHTML = `
      <div class="selected-item-info">
        <div class="selected-item-name" title="${item.name}">${item.name}</div>
        <div class="selected-item-category">${item.category} &times; ${item.qty}</div>
      </div>
      <div class="selected-item-price">${item.price === 0 ? 'Бесплатно' : price.toLocaleString('ru-RU') + ' ₽'}</div>
      <button class="selected-item-remove" data-idx="${idx}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    `;
    selectedServicesContainer.appendChild(el);
  });

  selectedServicesContainer.querySelectorAll('.selected-item-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedServices.splice(parseInt(btn.dataset.idx), 1);
      renderServices();
      renderSelectedServices();
      updateTotal();
    });
  });
}

function updateTotal() {
  const total = selectedServices.reduce((sum, item) => sum + (item.price * item.qty), 0);
  totalValue.textContent = total.toLocaleString('ru-RU') + ' ₽';
  finalValue.textContent = total.toLocaleString('ru-RU') + ' ₽';
  finalValue.classList.remove('pulse');
  void finalValue.offsetWidth;
  finalValue.classList.add('pulse');
}

// ---------- Search ----------

searchInput.addEventListener('input', (e) => {
  searchTerm = e.target.value;
  renderServices();
});

// ---------- Plan Actions ----------

clearPlanBtn.addEventListener('click', () => {
  selectedServices = [];
  renderServices();
  renderSelectedServices();
  updateTotal();
  showToast('План очищен', 'success');
});

exportBtn.addEventListener('click', () => {
  if (selectedServices.length === 0) {
    showToast('Добавьте услуги для сохранения', 'error');
    return;
  }

  const patientName = document.getElementById('patient-name').value || 'Пациент';
  const notes = document.getElementById('patient-notes').value || '';
  const total = selectedServices.reduce((sum, item) => sum + (item.price * item.qty), 0);

  let text = `ПЛАН ЛЕЧЕНИЯ\n`;
  text += `Пациент: ${patientName}\n`;
  text += `Дата: ${new Date().toLocaleDateString('ru-RU')}\n`;
  text += `${'─'.repeat(50)}\n\n`;

  selectedServices.forEach(item => {
    text += `${item.name}\n`;
    text += `  ${item.category}\n`;
    text += `  ${item.price === 0 ? 'Бесплатно' : item.price.toLocaleString('ru-RU') + ' ₽'} × ${item.qty} = ${item.price === 0 ? 'Бесплатно' : (item.price * item.qty).toLocaleString('ru-RU') + ' ₽'}\n\n`;
  });

  text += `${'─'.repeat(50)}\n`;
  text += `ИТОГО: ${total.toLocaleString('ru-RU')} ₽\n`;

  if (notes) text += `\nПожелания пациента:\n${notes}\n`;

  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `План_лечения_${patientName}_${new Date().toLocaleDateString('ru-RU')}.txt`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('План сохранён', 'success');
});

printBtn.addEventListener('click', () => {
  if (selectedServices.length === 0) {
    showToast('Добавьте услуги для печати', 'error');
    return;
  }

  const patientName = document.getElementById('patient-name').value || 'Пациент';
  const notes = document.getElementById('patient-notes').value || '';
  const total = selectedServices.reduce((sum, item) => sum + (item.price * item.qty), 0);

  let rows = '';
  selectedServices.forEach(item => {
    rows += `<tr>
      <td>${item.name}</td>
      <td>${item.category}</td>
      <td>${item.price === 0 ? 'Бесплатно' : item.price.toLocaleString('ru-RU') + ' ₽'}</td>
      <td>${item.qty}</td>
      <td>${item.price === 0 ? 'Бесплатно' : (item.price * item.qty).toLocaleString('ru-RU') + ' ₽'}</td>
    </tr>`;
  });

  const html = `<!DOCTYPE html>
<html><head><title>План лечения - ${patientName}</title>
<style>body{font-family:Arial,sans-serif;padding:40px;color:#333}
h1{font-size:24px;margin-bottom:10px}.meta{color:#666;margin-bottom:20px}
table{width:100%;border-collapse:collapse;margin-top:20px}
th,td{padding:10px;text-align:left;border-bottom:1px solid #ddd}
th{background:#f5f5f5;font-weight:600}
.total{font-size:20px;font-weight:bold;text-align:right;margin-top:20px}
.notes{margin-top:20px;padding:15px;background:#f9f9f9;border-radius:8px}</style></head>
<body><h1>План лечения</h1>
<div class="meta"><p><strong>Пациент:</strong> ${patientName}</p>
<p><strong>Дата:</strong> ${new Date().toLocaleDateString('ru-RU')}</p></div>
<table><thead><tr><th>Услуга</th><th>Категория</th><th>Цена</th><th>Кол-во</th><th>Сумма</th></tr></thead>
<tbody>${rows}</tbody></table>
<div class="total">ИТОГО: ${total.toLocaleString('ru-RU')} ₽</div>
${notes ? `<div class="notes"><strong>Пожелания пациента:</strong><br>${notes}</div>` : ''}
</body></html>`;

  try {
    const f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:none';
    document.body.appendChild(f);
    const d = f.contentWindow.document;
    d.open();
    d.write(html);
    d.close();
    setTimeout(() => { f.contentWindow.focus(); f.contentWindow.print(); }, 250);
  } catch (e) {
    showToast('Не удалось выполнить печать', 'error');
  }
});

// ---------- Toast ----------

function showToast(message, type = 'success', duration = 3000) {
  toastMessage.textContent = message;
  toast.className = `toast ${type} show`;
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => { toast.className = 'toast'; }, duration);
}

// ---------- Init ----------

async function loadDefaultData() {
  try {
    const res = await fetch('price.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    sourceMeta = { sourceUrl: 'bundled' };
    processData(data);
    setDataStatus(sourceMeta, priceData.length);
  } catch (e) {
    dataStatus.textContent = 'Нажмите «Обновить цены» для загрузки прайс-листа';
  }
}

renderServices();
loadDefaultData();