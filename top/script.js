// ===== Utility =====
const fmtJPY = (n) => {
  if (!isFinite(n)) return '-';
  const value = Math.round(Math.abs(n)).toLocaleString();
  const sign = n < 0 ? '−' : '';
  return '¥' + sign + value;
};
const fmtMan = (n) => {
  if (!isFinite(n)) return '-';
  const sign = n < 0 ? '−' : '';
  return sign + Math.round(Math.abs(n) / 10000).toLocaleString();
};
const fmtQuantity = (n) => {
  if (!isFinite(n)) return '-';
  return Number(n).toLocaleString('ja-JP', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
};
const fmtRate = (value, assetType) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '—';
  const fractionDigits = assetType === 'FX' ? 3 : 0;
  return numeric.toLocaleString('ja-JP', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  });
};
const setSignClass = (el, val) => {
  if (!el) return;
  el.classList.remove('positive', 'negative', 'neutral');
  el.classList.add(val > 0 ? 'positive' : val < 0 ? 'negative' : 'neutral');
};

const LASER_REVEAL_PLUGIN_ID = 'laserReveal';

if (typeof Chart !== 'undefined' && !window.__tradeScopeLaserRevealRegistered) {
  Chart.register({
    id: LASER_REVEAL_PLUGIN_ID,
    beforeDatasetsDraw(chart, _args, options) {
      if (!options?.enabled) return;
      const area = chart.chartArea;
      if (!area) return;

      const progress = Math.max(0, Math.min(1, Number(chart.$laserRevealProgress ?? 1)));
      const revealX = area.left + (area.right - area.left) * progress;

      chart.ctx.save();
      chart.ctx.beginPath();
      chart.ctx.rect(area.left, area.top, Math.max(0, revealX - area.left), area.bottom - area.top);
      chart.ctx.clip();
      chart.$laserClipActive = true;
    },
    afterDatasetsDraw(chart, _args, options) {
      if (!options?.enabled || !chart.$laserClipActive) return;
      chart.ctx.restore();
      chart.$laserClipActive = false;
    }
  });
  window.__tradeScopeLaserRevealRegistered = true;
}

function playLaserReveal(chart, duration = 900) {
  if (!chart) return;
  if (chart.$laserRevealRaf) cancelAnimationFrame(chart.$laserRevealRaf);

  const start = performance.now();
  chart.$laserRevealProgress = 0;

  const step = (now) => {
    // チャートが既に destroy() されている場合はループを止める
    if (!chart.canvas || !chart.ctx) {
      chart.$laserRevealRaf = null;
      return;
    }
    const progress = Math.max(0, Math.min(1, (now - start) / duration));
    chart.$laserRevealProgress = progress;
    chart.draw();

    if (progress < 1) {
      chart.$laserRevealRaf = requestAnimationFrame(step);
    } else {
      chart.$laserRevealRaf = null;
    }
  };

  chart.$laserRevealRaf = requestAnimationFrame(step);
}

const TOP_BASE_YEAR = 2025;
const profitMetrics = window.TradeScopeProfitMetrics || {};

// ===== Memo Box =====
const memoList = document.getElementById('memoList');
const addMemoBtn = document.getElementById('addMemoBtn');
const memoModal = document.getElementById('memoModal');
const memoModalBackdrop = document.getElementById('memoModalBackdrop');
const memoInput = document.getElementById('memoInput');
const saveMemoBtn = document.getElementById('saveMemoBtn');
const cancelMemoBtn = document.getElementById('cancelMemoBtn');
const closeMemoModal = document.getElementById('closeMemoModal');
const memoModalTitle = document.getElementById('memoModalTitle');
const deleteMemoBtn = document.getElementById('deleteMemoBtn');
let memoEditingIndex = null;

function parseMemos() {
  try {
    const parsed = JSON.parse(localStorage.getItem('tradeScopeMemos') || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function loadMemos() {
  const memos = parseMemos();
  memoList.innerHTML = memos.length === 0 
    ? '<li style="color: var(--muted); padding: 12px 0; text-align: center; font-size: 12px;">メモはまだありません</li>'
    : memos.map((memo, idx) => `
      <li class="memo-item">
        <div class="memo-content">
          <div class="memo-item-text">${escapeHtml(memo.text)}</div>
          <div class="memo-item-time">${new Date(memo.date).toLocaleDateString('ja-JP')}</div>
        </div>
        <button class="memo-edit-btn" data-idx="${idx}" aria-label="編集">✎</button>
      </li>
    `).join('');
  
  document.querySelectorAll('.memo-edit-btn').forEach(btn => {
    btn.addEventListener('click', openEditModal);
  });
}

function openModal(mode = 'create', editIndex = null) {
  const memos = parseMemos();
  const isEdit = mode === 'edit' && Number.isInteger(editIndex) && memos[editIndex];
  memoEditingIndex = isEdit ? editIndex : null;

  memoInput.value = isEdit ? memos[editIndex].text : '';
  if (memoModalTitle) memoModalTitle.textContent = isEdit ? 'メモを編集' : 'メモを追加';
  if (deleteMemoBtn) {
    deleteMemoBtn.hidden = !isEdit;
    deleteMemoBtn.disabled = !isEdit;
  }

  memoModal.setAttribute('aria-hidden', 'false');
  memoModalBackdrop.setAttribute('aria-hidden', 'false');
  setTimeout(() => memoInput.focus(), 100);
}

function openEditModal(e) {
  const idx = Number.parseInt(e.currentTarget?.dataset?.idx, 10);
  if (!Number.isInteger(idx)) return;
  openModal('edit', idx);
}

function closeModal() {
  memoEditingIndex = null;
  memoModal.setAttribute('aria-hidden', 'true');
  memoModalBackdrop.setAttribute('aria-hidden', 'true');
}

function saveMemo() {
  const text = memoInput.value.trim();
  if (!text) return;
  
  const memos = parseMemos();
  const nowIso = new Date().toISOString();

  if (Number.isInteger(memoEditingIndex) && memos[memoEditingIndex]) {
    memos[memoEditingIndex] = {
      ...memos[memoEditingIndex],
      text,
      updatedAt: nowIso
    };
  } else {
    memos.unshift({ text, date: nowIso });
  }

  memos.splice(50);
  localStorage.setItem('tradeScopeMemos', JSON.stringify(memos));
  loadMemos();
  closeModal();
}

function deleteMemo() {
  if (!Number.isInteger(memoEditingIndex)) return;
  if (!confirm('このメモを削除しますか？')) return;

  const memos = parseMemos();
  memos.splice(memoEditingIndex, 1);
  localStorage.setItem('tradeScopeMemos', JSON.stringify(memos));
  loadMemos();
  closeModal();
}

addMemoBtn.addEventListener('click', () => openModal('create'));
saveMemoBtn.addEventListener('click', saveMemo);
cancelMemoBtn.addEventListener('click', closeModal);
closeMemoModal.addEventListener('click', closeModal);
memoModalBackdrop.addEventListener('click', closeModal);
deleteMemoBtn?.addEventListener('click', deleteMemo);
memoInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.ctrlKey) saveMemo();
});

loadMemos();

// ===== Drawer Menu =====
const drawer = document.getElementById('drawer');
const scrim = document.getElementById('scrim');
const menuButton = document.getElementById('menuButton');
const drawerClose = document.getElementById('drawerClose');

drawer?.querySelectorAll('.menu-item').forEach((item, idx) => {
  const order = item.dataset.order || idx;
  item.style.setProperty('--menu-order', String(order));
});

function openDrawer() {
  if (!drawer || !scrim) return;
  drawer.classList.add('open');
  drawer.setAttribute('aria-hidden', 'false');
  menuButton?.setAttribute('aria-expanded', 'true');
  document.body.classList.add('drawer-open');
  scrim.hidden = false;
  requestAnimationFrame(() => scrim.classList.add('show'));
}
function closeDrawer() {
  if (!drawer || !scrim) return;
  drawer.classList.remove('open');
  drawer.setAttribute('aria-hidden', 'true');
  menuButton?.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('drawer-open');
  scrim.classList.remove('show');
  setTimeout(() => {
    if (!drawer.classList.contains('open')) scrim.hidden = true;
  }, 220);
}
menuButton?.addEventListener('click', openDrawer);
drawerClose?.addEventListener('click', closeDrawer);
scrim?.addEventListener('click', closeDrawer);
drawer?.querySelectorAll('.menu-item').forEach(link => {
  link.addEventListener('click', closeDrawer);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && drawer?.classList.contains('open')) closeDrawer();
});

let drawerSwipeStartX = 0;
let drawerSwipeStartY = 0;
let drawerEdgeTracking = false;

document.addEventListener('touchstart', (e) => {
  if (!drawer || e.touches.length !== 1) return;
  const isMobile = window.matchMedia('(max-width: 860px)').matches;
  if (!isMobile || drawer.classList.contains('open')) return;
  drawerSwipeStartX = e.touches[0].clientX;
  drawerSwipeStartY = e.touches[0].clientY;
  drawerEdgeTracking = drawerSwipeStartX <= 20;
}, { passive: true });

document.addEventListener('touchmove', (e) => {
  if (!drawerEdgeTracking || !drawer || e.touches.length !== 1) return;
  const dx = e.touches[0].clientX - drawerSwipeStartX;
  const dy = e.touches[0].clientY - drawerSwipeStartY;
  if (dx > 56 && Math.abs(dx) > Math.abs(dy) * 1.2) {
    openDrawer();
    drawerEdgeTracking = false;
  }
}, { passive: true });

drawer?.addEventListener('touchstart', (e) => {
  if (e.touches.length !== 1) return;
  drawerSwipeStartX = e.touches[0].clientX;
  drawerSwipeStartY = e.touches[0].clientY;
}, { passive: true });

drawer?.addEventListener('touchmove', (e) => {
  if (!drawer.classList.contains('open') || e.touches.length !== 1) return;
  const dx = e.touches[0].clientX - drawerSwipeStartX;
  const dy = e.touches[0].clientY - drawerSwipeStartY;
  if (dx < -64 && Math.abs(dx) > Math.abs(dy) * 1.2) {
    closeDrawer();
  }
}, { passive: true });

// ===== News =====
const NEWS_GLOBAL_CACHE_KEY = 'tradeScopeNewsHeadlinesV12';
const NEWS_COUNTRY_CACHE_PREFIX = 'tradeScopeNewsCountryV4:';
const NEWS_CACHE_TTL_MS = 30 * 60 * 1000;
const NEWS_TRANSLATION_CACHE_KEY = 'tradeScopeNewsTranslationCacheV1';
const NEWS_TRANSLATION_CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const NEWS_GOOGLE_TOP_FEED = 'https://news.google.com/rss?hl=ja&gl=JP&ceid=JP:ja';
const NEWS_GOOGLE_PROXY_PREFIX = 'https://api.allorigins.win/raw?url=';
const NEWS_LIMIT = 12;
const NEWS_EXCLUDE_SOURCE_PATTERNS = [
  /日本経済新聞/i,
  /日経/i,
  /nikkei/i,
  /bloomberg/i,
  /wall street journal/i,
  /\bwsj\b/i,
  /financial times/i,
  /\bft\.com\b/i
];
const NEWS_EXCLUDE_LINK_PATTERNS = [
  /nikkei\.com/i,
  /bloomberg\.co\.jp/i,
  /bloomberg\.com/i,
  /wsj\.com/i,
  /ft\.com/i
];
const NEWS_EXCLUDE_HEADLINE_PATTERNS = [
  /議事録/i,
  /議事要旨/i,
  /minutes of/i,
  /meeting minutes/i,
  /transcript/i,
  /remarks by/i,
  /speech by/i,
  /workshop/i,
  /newsletter/i,
  /operation schedule/i,
  /timetable/i,
  /schedule updates/i,
  /取扱開始/i,
  /取り扱い開始/i,
  /キャンペーン/i,
  /口座開設/i,
  /キャッシュバック/i,
  /ポイント/i,
  /セミナー/i,
  /ウェビナー/i,
  /ツアー/i,
  /旅行/i,
  /観光/i,
  /プレゼント/i,
  /抽選/i,
  /タイアップ/i,
  /スポンサー/i
];
const FALLBACK_HEADLINES = [
  { title: '現在ニュースを取得できません。', link: '', source: '' },
  { title: '接続状況により更新が遅れる場合があります。', link: '', source: '' }
];
const LOADING_HEADLINES = [
  { title: 'ニュースを読み込み中...', link: '', source: '' }
];
const NEWS_GLOBAL_SOURCES = [
  {
    key: 'global_top',
    sourceLabel: 'Google News',
    feedUrl: NEWS_GOOGLE_TOP_FEED
  }
];
const NEWS_COUNTRY_FEEDS = {
  USD: 'https://news.google.com/rss/search?q=USD+OR+%E3%83%89%E3%83%AB+OR+FOMC&hl=ja&gl=JP&ceid=JP:ja',
  JPY: 'https://news.google.com/rss/search?q=JPY+OR+%E5%86%86+OR+%E6%97%A5%E9%8A%80&hl=ja&gl=JP&ceid=JP:ja',
  EUR: 'https://news.google.com/rss/search?q=EUR+OR+%E3%83%A6%E3%83%BC%E3%83%AD+OR+ECB&hl=ja&gl=JP&ceid=JP:ja',
  GBP: 'https://news.google.com/rss/search?q=GBP+OR+%E3%83%9D%E3%83%B3%E3%83%89+OR+BOE&hl=ja&gl=JP&ceid=JP:ja',
  AUD: 'https://news.google.com/rss/search?q=AUD+OR+%E8%B1%AA%E3%83%89%E3%83%AB+OR+RBA&hl=ja&gl=JP&ceid=JP:ja',
  NZD: 'https://news.google.com/rss/search?q=NZD+OR+NZ%E3%83%89%E3%83%AB+OR+RBNZ&hl=ja&gl=JP&ceid=JP:ja',
  CHF: 'https://news.google.com/rss/search?q=CHF+OR+%E3%82%B9%E3%82%A4%E3%82%B9%E3%83%95%E3%83%A9%E3%83%B3+OR+SNB&hl=ja&gl=JP&ceid=JP:ja',
  CAD: 'https://news.google.com/rss/search?q=CAD+OR+%E5%8A%A0%E3%83%89%E3%83%AB+OR+BOC&hl=ja&gl=JP&ceid=JP:ja',
  HUF: 'https://news.google.com/rss/search?q=HUF+OR+%E3%83%8F%E3%83%B3%E3%82%AC%E3%83%AA%E3%83%BC%E3%83%95%E3%82%A9%E3%83%AA%E3%83%B3%E3%83%88+OR+MNB&hl=ja&gl=JP&ceid=JP:ja',
  TRY: 'https://news.google.com/rss/search?q=TRY+OR+%E3%83%88%E3%83%AB%E3%82%B3%E3%83%AA%E3%83%A9+OR+%E3%83%88%E3%83%AB%E3%82%B3%E4%B8%AD%E9%8A%80&hl=ja&gl=JP&ceid=JP:ja',
  MXN: 'https://news.google.com/rss/search?q=MXN+OR+%E3%83%A1%E3%82%AD%E3%82%B7%E3%82%B3%E3%83%9A%E3%82%BD+OR+Banxico&hl=ja&gl=JP&ceid=JP:ja'
};

function escapeTickerText(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeHeadline(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

const CURRENCY_RELEVANCE_TERMS = {
  USD: ['usd', 'ドル', '米ドル', 'fomc', 'frb', '米金利', '米国債'],
  JPY: ['jpy', '円', '日銀', 'boj', 'ycc'],
  EUR: ['eur', 'ユーロ', 'ecb', 'ユーロ圏', '独金利'],
  GBP: ['gbp', 'ポンド', 'boe', '英国', 'イングランド銀行'],
  AUD: ['aud', '豪ドル', 'rba', '豪州'],
  NZD: ['nzd', 'nzドル', 'ニュージーランド', 'rbnz'],
  CHF: ['chf', 'スイスフラン', 'snb', 'スイス国立銀行'],
  CAD: ['cad', '加ドル', 'カナダドル', 'boc'],
  HUF: ['huf', 'フォリント', 'ハンガリー', 'mnb', 'magyar nemzeti bank'],
  TRY: ['try', 'トルコリラ', 'リラ', 'トルコ', 'cbrt', 'tcmb'],
  MXN: ['mxn', 'メキシコペソ', 'ペソ', 'banxico', 'メキシコ']
};
const GLOBAL_RELEVANCE_TERMS = [
  'fx', '為替', 'ドル円', 'ドル安', 'ドル高', 'usdjpy', 'eurusd', 'gbpusd', 'usdchf', 'audusd',
  'ユーロ安', 'ユーロ高', 'ユーロ圏', '円安', '円高', '円相場', 'スイスフラン',
  '政策金利', '利上げ', '利下げ', '金融政策', 'fomc', 'frb', 'ecb', '日銀', 'boj', 'snb', 'boe',
  'cbrt', 'tcmb', 'mnb', 'トルコリラ', 'フォリント', 'try', 'huf', 'キャリートレード',
  '為替介入', '外国為替', '通貨', '外貨'
];

function isLikelyDocumentLink(url) {
  return /\.pdf(?:$|[?#])/i.test(String(url || '').trim());
}

function isGoogleSearchFeedUrl(url) {
  return /news\.google\.com\/rss\/search\?/i.test(String(url || ''));
}

function isGoogleFeedUrl(url) {
  return /news\.google\.com\/rss/i.test(String(url || ''));
}

function parseRssXmlItems(xmlText) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(String(xmlText || ''), 'application/xml');
  const parseError = xml.querySelector('parsererror');
  if (parseError) return [];

  return Array.from(xml.querySelectorAll('item')).map((node) => {
    const title = normalizeHeadline(node.querySelector('title')?.textContent || '');
    const link = String(node.querySelector('link')?.textContent || '').trim();
    const source = normalizeHeadline(
      node.querySelector('source')?.textContent
      || node.querySelector('dc\\:creator')?.textContent
      || node.querySelector('author')?.textContent
      || ''
    );
    return { title, link, source };
  }).filter((item) => item.title);
}

async function fetchFeedItemsViaAllOriginsRaw(feedUrl) {
  const endpoint = `${NEWS_GOOGLE_PROXY_PREFIX}${encodeURIComponent(feedUrl)}`;
  const res = await fetch(endpoint, { cache: 'no-store' });
  if (!res.ok) throw new Error(`proxy feed fetch failed: ${res.status}`);
  const xmlText = await res.text();
  return parseRssXmlItems(xmlText);
}

async function fetchFeedItemsViaRss2Json(feedUrl) {
  const endpoint = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}`;
  const res = await fetch(endpoint, { cache: 'no-store' });
  if (!res.ok) throw new Error(`feed fetch failed: ${res.status}`);
  const json = await res.json();
  if (!Array.isArray(json?.items)) return [];
  return json.items;
}

function isPracticalHeadline(item) {
  const title = normalizeHeadline(item?.title || '');
  if (!title) return false;
  if (NEWS_EXCLUDE_HEADLINE_PATTERNS.some((pattern) => pattern.test(title))) return false;
  if (isLikelyDocumentLink(item?.link)) return false;
  const source = normalizeHeadline(item?.source || '');
  if (NEWS_EXCLUDE_SOURCE_PATTERNS.some((pattern) => pattern.test(source))) return false;
  const link = String(item?.link || '');
  if (NEWS_EXCLUDE_LINK_PATTERNS.some((pattern) => pattern.test(link))) return false;
  return true;
}

function isCurrencyRelevantHeadline(currency, item) {
  const title = normalizeHeadline(item?.title || '').toLowerCase();
  if (!title) return false;
  if (!isPracticalHeadline(item)) return false;
  const terms = CURRENCY_RELEVANCE_TERMS[currency] || [];
  if (!terms.length) return true;
  return terms.some((term) => title.includes(String(term).toLowerCase()));
}

function isGlobalRelevantHeadline(item) {
  const title = normalizeHeadline(item?.title || '').toLowerCase();
  if (!title) return false;
  if (!isPracticalHeadline(item)) return false;
  return GLOBAL_RELEVANCE_TERMS.some((term) => title.includes(String(term).toLowerCase()));
}

function shouldTranslateToJapanese(text) {
  const value = normalizeHeadline(text);
  if (!value) return false;
  // 既に日本語文字が含まれる場合は翻訳しない
  if (/[\u3040-\u30ff\u3400-\u9fff]/.test(value)) return false;
  // ラテン文字が含まれる場合のみ翻訳対象にする
  return /[A-Za-z]/.test(value);
}

function readTranslationCache() {
  try {
    const parsed = JSON.parse(localStorage.getItem(NEWS_TRANSLATION_CACHE_KEY) || '{}');
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch {
    return {};
  }
}

function writeTranslationCache(cache) {
  try {
    localStorage.setItem(NEWS_TRANSLATION_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // localStorageが使えない環境ではキャッシュを諦める
  }
}

async function translateToJapanese(text) {
  const value = normalizeHeadline(text);
  if (!shouldTranslateToJapanese(value)) return value;

  const cache = readTranslationCache();
  const cached = cache[value];
  const now = Date.now();
  if (cached && typeof cached === 'object') {
    const translated = normalizeHeadline(cached.text);
    const ts = Number(cached.fetchedAt || 0);
    if (translated && now - ts < NEWS_TRANSLATION_CACHE_TTL_MS) {
      return translated;
    }
  }

  try {
    const endpoint = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(value)}&langpair=en|ja`;
    const res = await fetch(endpoint, { cache: 'no-store' });
    if (!res.ok) throw new Error(`translate failed: ${res.status}`);
    const json = await res.json();
    const translated = normalizeHeadline(json?.responseData?.translatedText || '');
    if (!translated) return value;

    cache[value] = {
      text: translated,
      fetchedAt: now
    };
    writeTranslationCache(cache);
    return translated;
  } catch {
    return value;
  }
}

async function localizeHeadlineItems(items) {
  const list = Array.isArray(items) ? items : [];
  return Promise.all(list.map(async (item) => {
    const translatedTitle = await translateToJapanese(item?.title || '');
    return {
      ...item,
      title: translatedTitle || item?.title || ''
    };
  }));
}

function readNewsCache(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || 'null');
    if (!parsed || !Array.isArray(parsed.items)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeNewsCache(key, items) {
  try {
    localStorage.setItem(key, JSON.stringify({
      fetchedAt: Date.now(),
      items
    }));
  } catch {
    // localStorageが使えない環境ではキャッシュを諦める
  }
}

function setNewsUpdatedAt(timestamp, isFallback) {
  const updatedEl = document.getElementById('newsUpdatedAt');
  if (!updatedEl) return;
  if (!timestamp || isFallback) {
    updatedEl.textContent = '更新: --';
    return;
  }
  const d = new Date(timestamp);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  updatedEl.textContent = `更新: ${hh}:${mm}`;
}

async function fetchFeedHeadlines(feedUrl, sourceHint) {
  let rawItems = [];
  if (isGoogleFeedUrl(feedUrl)) {
    if (isGoogleSearchFeedUrl(feedUrl)) {
      // 通貨別検索RSS: allorigins → rss2json の順で試行（iPhoneでalloriginsが失敗する場合の保険）
      try {
        rawItems = await fetchFeedItemsViaAllOriginsRaw(feedUrl);
      } catch {
        rawItems = await fetchFeedItemsViaRss2Json(feedUrl);
      }
    } else {
      // トップRSS: allorigins → rss2json の順で試行（iPhoneでalloriginsが失敗する場合の保険）
      try {
        rawItems = await fetchFeedItemsViaAllOriginsRaw(feedUrl);
      } catch {
        rawItems = await fetchFeedItemsViaRss2Json(feedUrl);
      }
    }
  } else {
    rawItems = await fetchFeedItemsViaRss2Json(feedUrl);
  }

  return rawItems.map((item) => {
    let title = normalizeHeadline(item?.title);
    let source = normalizeHeadline(item?.author || item?.source?.title || '');
    const link = String(item?.link || '').trim();

    if (!source) {
      const idx = title.lastIndexOf(' - ');
      if (idx > 0) {
        source = title.slice(idx + 3).trim();
        title = title.slice(0, idx).trim();
      }
    }

    return {
      title,
      link,
      source: source || sourceHint || 'News'
    };
  }).filter((item) => item.title);
}

async function fetchLatestHeadlines() {
  const settled = await Promise.allSettled(
    NEWS_GLOBAL_SOURCES.map((source) => fetchFeedHeadlines(source.feedUrl, source.sourceLabel))
  );
  const merged = [];
  settled.forEach((result) => {
    if (result.status !== 'fulfilled') return;
    merged.push(...result.value);
  });

  const seen = new Set();
  const unique = [];
  merged.forEach((item) => {
    const key = item.title.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    unique.push(item);
  });
  const practical = unique.filter((item) => isPracticalHeadline(item));
  const relevant = practical.filter((item) => isGlobalRelevantHeadline(item));
  const picked = relevant.slice(0, NEWS_LIMIT);
  return localizeHeadlineItems(picked);
}

async function fetchCountryHeadlines(currency) {
  const feedUrl = NEWS_COUNTRY_FEEDS[currency] || NEWS_COUNTRY_FEEDS.USD;
  const items = await fetchFeedHeadlines(feedUrl, 'Google News');
  const seen = new Set();
  const unique = [];
  items.forEach((item) => {
    const key = item.title.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    unique.push(item);
  });
  const relevant = unique.filter((item) => isCurrencyRelevantHeadline(currency, item));
  const picked = relevant.slice(0, NEWS_LIMIT);
  return localizeHeadlineItems(picked);
}

function renderTickerItem(item) {
  const title = escapeTickerText(item?.title || 'ニュースはありません');
  const source = escapeTickerText(item?.source || 'News');
  const sourceMarkup = item?.source ? `<span class="ticker-source">[${source}]</span>` : '';
  const link = String(item?.link || '').trim();
  if (!link) {
    return `<span class="ticker-link"><span class="ticker-title">${title}</span>${sourceMarkup}</span>`;
  }
  return `<a class="ticker-link" href="${escapeTickerText(link)}" target="_blank" rel="noopener noreferrer"><span class="ticker-title">${title}</span>${sourceMarkup}</a>`;
}

function mountTicker(trackEl, items) {
  if (!trackEl) return;
  const source = items && items.length ? items : FALLBACK_HEADLINES;
  const tickerItems = source.concat(source);
  trackEl.innerHTML = tickerItems.map((item) => `<span class="ticker-item">${renderTickerItem(item)}</span>`).join('');
  trackEl.style.animation = 'none';
  void trackEl.offsetHeight;
  // コンテンツ幅に比例した速度で流す（80px/s 基準）
  const loopWidth = trackEl.scrollWidth / 2;
  const duration = Math.max(8, Math.round(loopWidth / 80));
  trackEl.style.animation = `ticker ${duration}s linear infinite`;
}

async function initNewsTicker(forceRefresh = false) {
  await Promise.all([
    initGlobalNewsTicker(forceRefresh),
    initCountryNewsTicker(forceRefresh)
  ]);
}

async function initGlobalNewsTicker(forceRefresh = false) {
  const track = document.getElementById('globalTickerTrack');
  if (!track) return;

  const cached = readNewsCache(NEWS_GLOBAL_CACHE_KEY);
  const cachedItems = cached?.items || [];
  if (cachedItems.length) {
    mountTicker(track, cachedItems);
    setNewsUpdatedAt(cached.fetchedAt, false);
  } else {
    mountTicker(track, LOADING_HEADLINES);
    setNewsUpdatedAt(null, true);
  }

  const isCacheFresh = cached && (Date.now() - Number(cached.fetchedAt || 0) < NEWS_CACHE_TTL_MS);
  if (isCacheFresh && !forceRefresh) return;

  try {
    const latest = await fetchLatestHeadlines();
    if (!latest.length) throw new Error('no headlines');
    mountTicker(track, latest);
    writeNewsCache(NEWS_GLOBAL_CACHE_KEY, latest);
    setNewsUpdatedAt(Date.now(), false);
  } catch {
    if (!cachedItems.length) {
      mountTicker(track, FALLBACK_HEADLINES);
      setNewsUpdatedAt(null, true);
    }
  }
}

async function initCountryNewsTicker(forceRefresh = false) {
  const track = document.getElementById('countryTickerTrack');
  const select = document.getElementById('countrySelect');
  if (!track || !select) return;

  const currency = select.value || 'USD';
  const cacheKey = `${NEWS_COUNTRY_CACHE_PREFIX}${currency}`;
  const cached = readNewsCache(cacheKey);
  const cachedItems = cached?.items || [];

  if (cachedItems.length) {
    mountTicker(track, cachedItems);
  } else {
    mountTicker(track, LOADING_HEADLINES);
  }

  const isCacheFresh = cached && (Date.now() - Number(cached.fetchedAt || 0) < NEWS_CACHE_TTL_MS);
  if (isCacheFresh && !forceRefresh) return;

  try {
    const latest = await fetchCountryHeadlines(currency);
    if (!latest.length) throw new Error('no country headlines');
    mountTicker(track, latest);
    writeNewsCache(cacheKey, latest);
  } catch {
    if (!cachedItems.length) mountTicker(track, FALLBACK_HEADLINES);
  }
}

function refreshAllTickers() {
  initNewsTicker(false);
}

document.getElementById('countrySelect')?.addEventListener('change', () => {
  initCountryNewsTicker(false);
});

initNewsTicker(false);
window.addEventListener('pageshow', refreshAllTickers);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) refreshAllTickers();
});

// ===== Profit data shared with the top dashboard =====
const PROFIT_STORAGE_KEY_TRADING = 'tradingData';
const PROFIT_STORAGE_KEY_INITIAL = 'yearInitialFunds';
const PROFIT_STORAGE_KEY_INITIAL_UNREALIZED = 'yearInitialUnrealized';
const PROFIT_STORAGE_KEY_TOP_SUMMARY_SNAPSHOT = 'tradeScopeTopSummarySnapshotV1';
const SHARED_SELECTED_YEAR_KEY = 'tradeScopeSelectedYear';
const historyCore = window.TradeScopeHistory;
const LINKED_ACCOUNTS = [
  { name: 'GMO', key: 'gmo', color: '#3B6DFF' },
  { name: 'Light FX', key: 'lightfx', color: '#74D2F5' },
  { name: 'みんなのFX', key: 'minano', color: '#E9C85E' },
  { name: 'SBI', key: 'sbi', color: '#D95757' },
  { name: 'SBI VC', key: 'sbivc', color: '#EAF1FF' },
  { name: '三井住友銀行', key: 'smbc', color: '#2F7A46', bankOnly: true }
];
const GROWTH_TARGET_ACCOUNTS = LINKED_ACCOUNTS.filter((account) => !account.bankOnly);
let perfChart = null;
let portfolioChart = null;
let accountChart = null;
let currentPortfolioChart = null;
let topAssetTrendView = 'asset';
let activePortfolioAssetTab = 'FX';

function parseStoredJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || '{}');
  } catch {
    return {};
  }
}

function readStoredNumber(row, field) {
  return profitMetrics?.hasStoredNumber?.(row, field) ? Number(row[field]) : null;
}

function getNumericYears(dataObj) {
  if (profitMetrics?.getNumericYears) {
    return profitMetrics.getNumericYears(dataObj);
  }
  return Object.keys(dataObj || {})
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v))
    .sort((a, b) => a - b);
}

function calculateLinkedMonthlyTotals(tradingData, year, month) {
  const yearData = tradingData?.[year] || tradingData?.[String(year)] || {};
  const accountKeys = LINKED_ACCOUNTS.map((account) => account.key);
  return {
    realized: profitMetrics?.calculateMonthlyFieldTotal
      ? profitMetrics.calculateMonthlyFieldTotal(yearData, month, accountKeys, 'realizedPnL')
      : null,
    swap: profitMetrics?.calculateMonthlyFieldTotal
      ? profitMetrics.calculateMonthlyFieldTotal(yearData, month, accountKeys, 'swapPnL')
      : null
  };
}

function calculateLinkedAccountConfirmedAssets(tradingData, initialFunds, year, targetMonth, accountKey) {
  if (profitMetrics?.calculateAccountConfirmedAssets) {
    return profitMetrics.calculateAccountConfirmedAssets(tradingData, initialFunds, year, targetMonth, accountKey);
  }

  const yearData = tradingData?.[year] || tradingData?.[String(year)] || {};
  const yearInitial = initialFunds?.[year] || initialFunds?.[String(year)] || {};
  const initial = Number(yearInitial?.[accountKey]) || 0;

  let realized = 0;
  let swap = 0;
  let deposit = 0;
  let withdrawal = 0;

  for (let month = 1; month <= targetMonth; month += 1) {
    const row = yearData?.[month]?.[accountKey] || yearData?.[String(month)]?.[accountKey] || {};
    const realizedValue = readStoredNumber(row, 'realizedPnL');
    const swapValue = readStoredNumber(row, 'swapPnL');
    const depositValue = readStoredNumber(row, 'deposit');
    const withdrawalValue = readStoredNumber(row, 'withdrawal');
    if (Number.isFinite(realizedValue)) realized += realizedValue;
    if (Number.isFinite(swapValue)) swap += swapValue;
    if (Number.isFinite(depositValue)) deposit += depositValue;
    if (Number.isFinite(withdrawalValue)) withdrawal += withdrawalValue;
  }

  return initial + realized + swap + deposit - withdrawal;
}

function calculateLinkedAccountNetAssets(tradingData, initialFunds, year, targetMonth, accountKey) {
  if (LINKED_ACCOUNTS.find((account) => account.key === accountKey)?.bankOnly) {
    return calculateLinkedAccountConfirmedAssets(tradingData, initialFunds, year, targetMonth, accountKey);
  }
  if (profitMetrics?.calculateAccountNetAssets) {
    return profitMetrics.calculateAccountNetAssets(tradingData, initialFunds, year, targetMonth, accountKey);
  }

  const yearData = tradingData?.[year] || tradingData?.[String(year)] || {};
  const yearInitial = initialFunds?.[year] || initialFunds?.[String(year)] || {};
  const initial = Number(yearInitial?.[accountKey]) || 0;

  let realized = 0;
  let swap = 0;
  let deposit = 0;
  let withdrawal = 0;

  for (let month = 1; month <= targetMonth; month += 1) {
    const row = yearData?.[month]?.[accountKey] || yearData?.[String(month)]?.[accountKey] || {};
    const realizedValue = readStoredNumber(row, 'realizedPnL');
    const swapValue = readStoredNumber(row, 'swapPnL');
    const depositValue = readStoredNumber(row, 'deposit');
    const withdrawalValue = readStoredNumber(row, 'withdrawal');
    if (Number.isFinite(realizedValue)) realized += realizedValue;
    if (Number.isFinite(swapValue)) swap += swapValue;
    if (Number.isFinite(depositValue)) deposit += depositValue;
    if (Number.isFinite(withdrawalValue)) withdrawal += withdrawalValue;
  }

  const currentRow = yearData?.[targetMonth]?.[accountKey] || yearData?.[String(targetMonth)]?.[accountKey] || {};
  if (!Object.prototype.hasOwnProperty.call(currentRow, 'unrealizedPnL')) return null;
  const unrealized = Number(currentRow.unrealizedPnL);
  if (!Number.isFinite(unrealized)) return null;

  return initial + realized + swap + deposit - withdrawal + unrealized;
}

function hasMeaningfulMonthData(yearData, month) {
  if (profitMetrics?.isMonthEntered) {
    return profitMetrics.isMonthEntered(yearData, month, LINKED_ACCOUNTS.map((account) => account.key));
  }
  return false;
}

function hasStoredAccountValues(yearRecord) {
  if (!yearRecord || typeof yearRecord !== 'object' || Array.isArray(yearRecord)) return false;
  return LINKED_ACCOUNTS.some((account) => {
    if (!Object.prototype.hasOwnProperty.call(yearRecord, account.key)) return false;
    const value = yearRecord[account.key];
    if (typeof value === 'number') return Number.isFinite(value);
    return typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value));
  });
}

function hasTopSourceDataForYear(tradingData, initialFunds, initialUnrealized, year) {
  const yearData = tradingData?.[year] || tradingData?.[String(year)] || {};
  const hasMonthlyData = Array.from({ length: 12 }, (_, index) => index + 1)
    .some((month) => hasMeaningfulMonthData(yearData, month));
  const yearInitial = initialFunds?.[year] || initialFunds?.[String(year)];
  const yearInitialUnrealized = initialUnrealized?.[year] || initialUnrealized?.[String(year)];
  return hasMonthlyData
    || hasStoredAccountValues(yearInitial)
    || hasStoredAccountValues(yearInitialUnrealized);
}

function createEmptyTopSeries(year = TOP_BASE_YEAR) {
  return {
    hasData: false,
    realized: [],
    total: [],
    accountData: [],
    year,
    month: null
  };
}

function buildTopLinkedData(selectedYear = null) {
  const tradingData = parseStoredJson(PROFIT_STORAGE_KEY_TRADING);
  const initialFunds = parseStoredJson(PROFIT_STORAGE_KEY_INITIAL);
  const initialUnrealized = parseStoredJson(PROFIT_STORAGE_KEY_INITIAL_UNREALIZED);
  const sourceYears = [...new Set([
    ...getNumericYears(tradingData),
    ...getNumericYears(initialFunds),
    ...getNumericYears(initialUnrealized)
  ])].sort((a, b) => a - b);
  const targetYear = selectedYear || sourceYears[sourceYears.length - 1] || null;
  if (!targetYear || !hasTopSourceDataForYear(tradingData, initialFunds, initialUnrealized, targetYear)) {
    return null;
  }

  const snapshotStore = parseStoredJson(PROFIT_STORAGE_KEY_TOP_SUMMARY_SNAPSHOT);
  const yearData = tradingData?.[targetYear] || tradingData?.[String(targetYear)] || {};
  const latestMonth = profitMetrics?.getLatestEnteredMonth
    ? profitMetrics.getLatestEnteredMonth(yearData, LINKED_ACCOUNTS.map((account) => account.key))
    : null;
  if (!latestMonth) return null;
  const sourceFingerprint = profitMetrics?.createYearSourceFingerprint
    ? profitMetrics.createYearSourceFingerprint(tradingData, initialFunds, initialUnrealized, targetYear)
    : null;
  if (targetYear) {
    const snapshot = snapshotStore?.[targetYear] || snapshotStore?.[String(targetYear)];
    const snapshotIsCurrent = profitMetrics?.isSummarySnapshotCurrent
      ? profitMetrics.isSummarySnapshotCurrent(
          snapshot,
          sourceFingerprint,
          latestMonth,
          yearData,
          LINKED_ACCOUNTS.map((account) => account.key)
        )
      : false;
    if (snapshotIsCurrent && Array.isArray(snapshot.realized) && Array.isArray(snapshot.total) && snapshot.realized.length === 12 && snapshot.total.length === 12) {
      return {
        ...snapshot,
        hasData: true,
        year: Number(snapshot.year) || targetYear,
        month: Number(snapshot.month) || 1,
        accountData: Array.isArray(snapshot.accountData) ? snapshot.accountData : []
      };
    }
  }
  const growthAccounts = GROWTH_TARGET_ACCOUNTS;
  const realized = [];
  const total = [];
  let cumulativeDeposits = 0;
  let cumulativeWithdrawals = 0;

  for (let month = 1; month <= 12; month += 1) {
    const isEntered = hasMeaningfulMonthData(yearData, month);
    const confirmedTotal = isEntered
      ? LINKED_ACCOUNTS.reduce((sum, account) => sum + calculateLinkedAccountConfirmedAssets(tradingData, initialFunds, targetYear, month, account.key), 0)
      : null;
    realized.push(confirmedTotal);

    // 成長率向けの累計入出金は投資口座のみを対象にする
    if (month <= latestMonth) {
      growthAccounts.forEach((account) => {
        const yearData = tradingData?.[targetYear] || tradingData?.[String(targetYear)] || {};
        const monthData = yearData?.[month] || yearData?.[String(month)] || {};
        const row = monthData?.[account.key] || {};
        cumulativeDeposits += Number(row.deposit) || 0;
        cumulativeWithdrawals += Number(row.withdrawal) || 0;
      });
    }

    const monthNetValues = isEntered
      ? LINKED_ACCOUNTS.map((account) => calculateLinkedAccountNetAssets(tradingData, initialFunds, targetYear, month, account.key))
      : [];
    const monthTotal = isEntered && monthNetValues.every(Number.isFinite)
      ? monthNetValues.reduce((sum, value) => sum + value, 0)
      : null;
    total.push(monthTotal);
  }

  const linkedAccountData = LINKED_ACCOUNTS.map((account) => {
    const amount = calculateLinkedAccountNetAssets(tradingData, initialFunds, targetYear, latestMonth, account.key);
    return {
      label: account.name,
      amount: Number.isFinite(amount) ? Math.max(0, amount) : null,
      color: account.color
    };
  }).filter((item) => Number.isFinite(item.amount) && item.amount > 0);

  // 年初の総純資産: 月次データ開始前の初期残高のみを使用する
  // （calculateLinkedAccountNetAssetsを使うと1月分の入出金が混入してしまうため）
  const yearInitialData = initialFunds?.[targetYear] || initialFunds?.[String(targetYear)] || {};
  const yearInitialUnrealData = initialUnrealized?.[targetYear] || initialUnrealized?.[String(targetYear)] || {};

  // 年間成長率ベース: 年初資金 + 年初評価損益
  const yearStartTotal = growthAccounts.reduce((sum, account) => {
    return sum + (Number(yearInitialData?.[account.key]) || 0)
               + (Number(yearInitialUnrealData?.[account.key]) || 0);
  }, 0);

  const yearStartConfirmed = growthAccounts.reduce((sum, account) => {
    return sum + (Number(yearInitialData?.[account.key]) || 0);
  }, 0);

  const growthCurrentTotalValues = growthAccounts.map((account) => calculateLinkedAccountNetAssets(tradingData, initialFunds, targetYear, latestMonth, account.key));
  const growthCurrentTotal = growthCurrentTotalValues.every(Number.isFinite)
    ? growthCurrentTotalValues.reduce((sum, value) => sum + value, 0)
    : null;

  const growthCurrentConfirmed = growthAccounts.reduce((sum, account) => {
    return sum + calculateLinkedAccountConfirmedAssets(tradingData, initialFunds, targetYear, latestMonth, account.key);
  }, 0);

  // Realized Balance チャート年初点: 確定資産ベース（評価損益除く）
  const chartStartTotal = LINKED_ACCOUNTS.reduce((sum, account) => {
    return sum + (Number(yearInitialData?.[account.key]) || 0);
  }, 0);

  // Total Balance チャート年初点: 年初資金 + 年初評価損益
  const chartStartTotalWithUnrealized = LINKED_ACCOUNTS.reduce((sum, account) => {
    return sum + (Number(yearInitialData?.[account.key]) || 0)
               + (Number(yearInitialUnrealData?.[account.key]) || 0);
  }, 0);

  return {
    hasData: true,
    realized,
    total,
    accountData: linkedAccountData,
    year: targetYear,
    month: latestMonth,
    yearStartTotal,
    yearStartConfirmed,
    growthCurrentTotal,
    growthCurrentConfirmed,
    chartStartTotal,
    chartStartTotalWithUnrealized,
    cumulativeDeposits,
    cumulativeWithdrawals
  };
}

const linkedTopData = buildTopLinkedData();
let topSeries = linkedTopData || createEmptyTopSeries();

// ===== Portfolio Data =====
let accountData = topSeries.accountData?.length ? topSeries.accountData : [];

function buildPortfolioAllocationFromAccounts(accounts) {
  const byKey = accounts.reduce((acc, item) => {
    acc[item.label] = Number(item.amount) || 0;
    return acc;
  }, {});

  const data = [
    { label: 'FX', amount: (byKey['GMO'] || 0) + (byKey['Light FX'] || 0) + (byKey['みんなのFX'] || 0), color: '#3B6DFF' },
    { label: '証券', amount: byKey['SBI'] || 0, color: '#D95757' },
    { label: '暗号資産', amount: byKey['SBI VC'] || 0, color: '#EAF1FF' },
    { label: '現金', amount: byKey['三井住友銀行'] || 0, color: '#2F7A46' }
  ].filter((item) => item.amount > 0);

  return data;
}

let portfolioData = buildPortfolioAllocationFromAccounts(accountData);

function updateRiskSection() {
  const maxEl = document.getElementById('riskMaxLoss');
  const fxOneEl = document.getElementById('riskFxOne');
  const fxZeroEl = document.getElementById('riskFxZero');
  const cryptoZeroEl = document.getElementById('riskCryptoZero');
  const noteEl = document.getElementById('riskNote');
  if (!maxEl || !fxOneEl || !fxZeroEl || !cryptoZeroEl) return;

  const renderEmptyRisk = () => {
    [maxEl, fxOneEl, fxZeroEl, cryptoZeroEl].forEach((el) => {
      el.textContent = '—';
      el.classList.remove('positive', 'negative');
      el.classList.add('neutral');
    });
    if (noteEl) noteEl.textContent = '対象データなし';
  };

  if (!historyCore?.calculateRiskSummary || !historyCore?.parseEntries) {
    renderEmptyRisk();
    return;
  }

  const entries = historyCore.parseEntries();
  const cryptoAccount = accountData.find((item) => item.label === 'SBI VC');
  const hasCryptoRiskData = Number(cryptoAccount?.amount) > 0;
  const cryptoValue = hasCryptoRiskData ? Number(cryptoAccount.amount) : 0;
  const riskSummary = historyCore.calculateRiskSummary(entries, cryptoValue);
  const hasFxRiskData = Array.isArray(riskSummary.activeCarrySymbols)
    && riskSummary.activeCarrySymbols.length > 0;

  if (!hasFxRiskData && !hasCryptoRiskData) {
    renderEmptyRisk();
    return;
  }

  const fxOneDisplayLoss = (riskSummary.fxOneYenLoss || 0) + (riskSummary.fxHufPointOneLoss || 0);
  const maxLoss = Math.abs(riskSummary.maxLoss || 0);
  const fxOneLoss = Math.abs(fxOneDisplayLoss || 0);
  const fxZeroLoss = Math.abs(riskSummary.fxZeroYenLoss || 0);
  const cryptoZeroLoss = Math.abs(riskSummary.cryptoZeroYenLoss || 0);

  maxEl.textContent = fmtJPY(maxLoss);
  fxOneEl.textContent = hasFxRiskData ? fmtJPY(fxOneLoss) : '—';
  fxZeroEl.textContent = hasFxRiskData ? fmtJPY(fxZeroLoss) : '—';
  cryptoZeroEl.textContent = hasCryptoRiskData ? fmtJPY(cryptoZeroLoss) : '—';

  if (noteEl) {
    noteEl.textContent = 'FX＋暗号資産 0円時';
  }
}

// ===== KPI =====
function updateKPIs() {
  const summaryElements = [
    'kpiTotal',
    'kpiRealized',
    'deltaTotal',
    'deltaNet',
    'growthTotal',
    'growthNet',
    'annualNetPnL',
    'annualConfirmedPnL',
    'annualNetPnLGrowth',
    'annualConfirmedPnLGrowth'
  ].map((id) => document.getElementById(id)).filter(Boolean);

  if (!topSeries?.hasData) {
    summaryElements.forEach((el) => {
      el.textContent = '—';
      el.classList.remove('positive', 'negative');
      el.classList.add('neutral');
    });
    return;
  }

  const i = Math.max(0, (topSeries.month || topSeries.realized.length) - 1);
  const rLast = topSeries.realized[i];
  const tLast = topSeries.total[i];
  const fmtDeltaNumber = (value) => {
    const abs = Math.round(Math.abs(value)).toLocaleString();
    if (value > 0) return `+${abs}`;
    if (value < 0) return `-${abs}`;
    return '0';
  };

  const elTotal = document.getElementById('kpiTotal');
  elTotal.textContent = Number.isFinite(tLast) ? fmtJPY(tLast) : '—';

  const elReal = document.getElementById('kpiRealized');
  elReal.textContent = fmtJPY(rLast);

  const elNet = document.getElementById('growthNet');
  const yearStartTotalActual = topSeries.chartStartTotalWithUnrealized || 0;
  const yearStartConfirmedActual = topSeries.chartStartTotal || 0;
  const yearStartTotalPerformance = topSeries.yearStartTotal || 0;
  const yearStartConfirmedPerformance = topSeries.yearStartConfirmed || 0;
  const growthCurrentTotal = Number.isFinite(topSeries.growthCurrentTotal) ? topSeries.growthCurrentTotal : tLast;
  const growthCurrentConfirmed = Number.isFinite(topSeries.growthCurrentConfirmed) ? topSeries.growthCurrentConfirmed : rLast;
  const cumulativeDeposits = topSeries.cumulativeDeposits || 0;
  const cumulativeWithdrawals = topSeries.cumulativeWithdrawals || 0;

  const totalAssetDelta = Number.isFinite(tLast) ? tLast - yearStartTotalActual : null;
  const confirmedAssetDelta = rLast - yearStartConfirmedActual;
  const annualGrowthRate = yearStartTotalActual > 0 && Number.isFinite(totalAssetDelta) ? (totalAssetDelta / yearStartTotalActual) * 100 : null;
  const confirmedAnnualGrowthRate = yearStartConfirmedActual > 0 ? (confirmedAssetDelta / yearStartConfirmedActual) * 100 : null;

  const annualNetPnL = Number.isFinite(growthCurrentTotal)
    ? growthCurrentTotal - yearStartTotalPerformance - cumulativeDeposits + cumulativeWithdrawals
    : null;
  const annualConfirmedPnL = growthCurrentConfirmed - yearStartConfirmedPerformance - cumulativeDeposits + cumulativeWithdrawals;
  const annualNetPnLGrowth = yearStartTotalPerformance > 0 && Number.isFinite(annualNetPnL)
    ? (annualNetPnL / yearStartTotalPerformance) * 100
    : null;
  const annualConfirmedPnLGrowth = yearStartConfirmedPerformance > 0 ? (annualConfirmedPnL / yearStartConfirmedPerformance) * 100 : null;

  const elTotalDelta = document.getElementById('deltaTotal');
  const elNetDelta = document.getElementById('deltaNet');
  if (elTotalDelta) {
    elTotalDelta.textContent = Number.isFinite(totalAssetDelta) ? fmtDeltaNumber(totalAssetDelta) : '—';
    setSignClass(elTotalDelta, totalAssetDelta);
  }
  if (elNetDelta) {
    elNetDelta.textContent = fmtDeltaNumber(confirmedAssetDelta);
    setSignClass(elNetDelta, confirmedAssetDelta);
  }

  elNet.textContent = Number.isFinite(confirmedAnnualGrowthRate)
    ? `${confirmedAnnualGrowthRate >= 0 ? '+' : ''}${confirmedAnnualGrowthRate.toFixed(1)}%`
    : '—';
  setSignClass(elNet, confirmedAnnualGrowthRate);

  const elTotalGrowth = document.getElementById('growthTotal');
  elTotalGrowth.textContent = Number.isFinite(annualGrowthRate)
    ? `${annualGrowthRate >= 0 ? '+' : ''}${annualGrowthRate.toFixed(1)}%`
    : '—';
  setSignClass(elTotalGrowth, annualGrowthRate);

  const elAnnualNetPnL = document.getElementById('annualNetPnL');
  const elAnnualConfirmedPnL = document.getElementById('annualConfirmedPnL');
  const elAnnualNetGrowth = document.getElementById('annualNetPnLGrowth');
  const elAnnualConfirmedGrowth = document.getElementById('annualConfirmedPnLGrowth');

  if (elAnnualNetPnL) {
    elAnnualNetPnL.textContent = Number.isFinite(annualNetPnL) ? fmtJPY(annualNetPnL) : '—';
    setSignClass(elAnnualNetPnL, annualNetPnL);
  }
  if (elAnnualConfirmedPnL) {
    elAnnualConfirmedPnL.textContent = fmtJPY(annualConfirmedPnL);
    setSignClass(elAnnualConfirmedPnL, annualConfirmedPnL);
  }
  if (elAnnualNetGrowth) {
    elAnnualNetGrowth.textContent = Number.isFinite(annualNetPnLGrowth)
      ? `${annualNetPnLGrowth >= 0 ? '+' : ''}${annualNetPnLGrowth.toFixed(1)}%`
      : '—';
    setSignClass(elAnnualNetGrowth, annualNetPnLGrowth);
  }
  if (elAnnualConfirmedGrowth) {
    elAnnualConfirmedGrowth.textContent = Number.isFinite(annualConfirmedPnLGrowth)
      ? `${annualConfirmedPnLGrowth >= 0 ? '+' : ''}${annualConfirmedPnLGrowth.toFixed(1)}%`
      : '—';
    setSignClass(elAnnualConfirmedGrowth, annualConfirmedPnLGrowth);
  }
}
updateKPIs();

// ===== Swap =====
function buildMonthlySwapBreakdown(tradingData, year, month) {
  const yearData = tradingData?.[year] || tradingData?.[String(year)] || {};
  const monthData = yearData?.[month] || yearData?.[String(month)] || {};

  return LINKED_ACCOUNTS.map((account) => {
    const row = monthData?.[account.key] || {};
    return {
      name: account.name,
      value: readStoredNumber(row, 'swapPnL')
    };
  }).filter((item) => Number.isFinite(item.value));
}

function buildSwapSummary(selectedYear = null) {
  const tradingData = parseStoredJson(PROFIT_STORAGE_KEY_TRADING);
  const years = getNumericYears(tradingData);
  const targetYear = selectedYear || topSeries?.year || years[years.length - 1] || TOP_BASE_YEAR;
  const yearData = tradingData?.[targetYear] || tradingData?.[String(targetYear)] || {};

  const enteredMonths = [];
  for (let month = 1; month <= 12; month += 1) {
    if (!hasMeaningfulMonthData(yearData, month)) continue;
    if (Number.isFinite(calculateLinkedMonthlyTotals(tradingData, targetYear, month).swap)) enteredMonths.push(month);
  }

  if (!enteredMonths.length) {
    return {
      prevMonth: null,
      prevMonthSwap: 0,
      prevMonthBreakdown: [],
      cumulativeSwap: 0,
      enteredMonthCount: 0,
      estimatedYearSwap: 0
    };
  }

  const cumulativeSwap = enteredMonths.reduce((sum, month) => {
    return sum + calculateLinkedMonthlyTotals(tradingData, targetYear, month).swap;
  }, 0);

  const enteredMonthCount = enteredMonths.length;
  const averageMonthlySwap = cumulativeSwap / enteredMonthCount;
  const remainingMonths = Math.max(0, 12 - enteredMonthCount);
  const estimatedYearSwap = cumulativeSwap + (averageMonthlySwap * remainingMonths);

  const prevMonth = enteredMonths[enteredMonths.length - 1];
  const prevMonthBreakdown = buildMonthlySwapBreakdown(tradingData, targetYear, prevMonth);
  const prevMonthSwap = prevMonthBreakdown.reduce((sum, item) => sum + item.value, 0);

  return {
    prevMonth,
    prevMonthSwap,
    prevMonthBreakdown,
    cumulativeSwap,
    enteredMonthCount,
    estimatedYearSwap
  };
}

function updateSwap() {
  const swapSummary = buildSwapSummary(topSeries?.year);

  const prevMonthEl = document.getElementById('swapPrevMonth');
  const cumulativeEl = document.getElementById('swapCumulative');
  const yearEstimateEl = document.getElementById('swapYearEstimate');
  const accountBreakdownEl = document.getElementById('swapPrevMonthAccounts');

  if (!swapSummary.enteredMonthCount) {
    [prevMonthEl, cumulativeEl, yearEstimateEl].filter(Boolean).forEach((el) => {
      el.textContent = '—';
      el.classList.remove('positive', 'negative');
      el.classList.add('neutral');
    });
    if (accountBreakdownEl) {
      accountBreakdownEl.innerHTML = '<span class="swap-mini-title">口座別内訳</span><span class="swap-breakdown-item">データなし</span>';
    }
    return;
  }

  if (prevMonthEl) {
    prevMonthEl.textContent = fmtJPY(swapSummary.prevMonthSwap);
    setSignClass(prevMonthEl, swapSummary.prevMonthSwap);
  }

  if (cumulativeEl) {
    cumulativeEl.textContent = fmtJPY(swapSummary.cumulativeSwap);
    setSignClass(cumulativeEl, swapSummary.cumulativeSwap);
  }

  if (yearEstimateEl) {
    yearEstimateEl.textContent = fmtJPY(swapSummary.estimatedYearSwap);
    setSignClass(yearEstimateEl, swapSummary.estimatedYearSwap);
  }

  if (accountBreakdownEl) {
    if (swapSummary.prevMonth == null) {
      accountBreakdownEl.innerHTML = '<span class="swap-mini-title">口座別内訳</span><span class="swap-breakdown-item">データなし</span>';
    } else {
      const nonZeroBreakdown = swapSummary.prevMonthBreakdown.filter((item) => item.value !== 0);
      const breakdownItems = (nonZeroBreakdown.length ? nonZeroBreakdown : swapSummary.prevMonthBreakdown)
        .map((item) => `<span class="swap-breakdown-item">${item.name}: ${fmtJPY(item.value)}</span>`)
        .join('');
      accountBreakdownEl.innerHTML = `<span class="swap-mini-title">口座別内訳</span>${breakdownItems}`;
    }
  }
}
updateSwap();

// ===== Position & Risk: Detail Panel (unified behavior) =====
const detailPanel = document.getElementById('pairDetailPanel');
const detailTitle = document.getElementById('detailTitle');
const detailProfit = document.getElementById('detailProfit');
const detailRate = document.getElementById('detailRate');
const detailLots = document.getElementById('detailLots');
const detailAvg = document.getElementById('detailAvg');
const detailNow = document.getElementById('detailNow');
const detailMMR = document.getElementById('detailMMR');
const detailZero = document.getElementById('detailZero');
const detailHalf = document.getElementById('detailHalf');
const detailNote = document.getElementById('detailNote');
const detailClose = document.getElementById('detailClose');
let detailScrim = document.getElementById('pairDetailScrim');
let detailLockScrollY = 0;

if (!detailScrim) {
  detailScrim = document.createElement('div');
  detailScrim.id = 'pairDetailScrim';
  detailScrim.className = 'pair-detail-scrim';
  detailScrim.hidden = true;
  document.body.appendChild(detailScrim);
}

function lockBackgroundScroll() {
  detailLockScrollY = window.scrollY || window.pageYOffset || 0;
  if (window.matchMedia('(max-width: 768px)').matches) {
    document.body.style.position = 'fixed';
    document.body.style.top = -detailLockScrollY + 'px';
    document.body.style.width = '100%';
  }
}

function unlockBackgroundScroll() {
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.width = '';
  window.scrollTo(0, detailLockScrollY);
}

function applyRateClass(el, rawText) {
  if (!el) return;
  const normalized = String(rawText).replace(/−/g, '-');
  const numeric = parseFloat(normalized.replace(/[^\d.-]/g, ''));
  el.classList.remove('positive', 'negative', 'neutral');
  if (numeric > 0) el.classList.add('positive');
  else if (numeric < 0) el.classList.add('negative');
  else el.classList.add('neutral');
}

function formatLossJPY(value) {
  if (value == null || value === '' || !Number.isFinite(Number(value))) return '—';
  const abs = Math.round(Math.abs(Number(value) || 0)).toLocaleString();
  return `-¥${abs}`;
}

function buildDetailDataFromPosition(position) {
  const absQuantity = Number(position?.absQuantity) || 0;
  const avgRateValue = Number(position?.avgRate) || 0;
  const contractSize = Number(position?.contractSize) || historyCore?.FX_CONTRACT_SIZE_DEFAULT || 10000;
  const signedUnits = (position?.side === 'sell' ? -1 : 1) * absQuantity * contractSize;
  const marketValue = estimateMarketValue(position);
  const requiredMargin = estimateRequiredMargin(position);

  let zeroLoss = null;
  let halfLoss = null;
  if (position?.assetType === 'FX') {
    zeroLoss = Math.max(0, -((0 - avgRateValue) * signedUnits));
    halfLoss = Math.max(0, -(((avgRateValue * 0.5) - avgRateValue) * signedUnits));
  } else {
    zeroLoss = Number.isFinite(marketValue) ? marketValue : null;
    halfLoss = Number.isFinite(marketValue) ? marketValue * 0.5 : null;
  }

  const accountsText = Array.isArray(position?.accounts) && position.accounts.length
    ? position.accounts.join(' / ')
    : '情報なし';
  const noteText = `${position?.memo || 'メモなし'}\n口座: ${accountsText}`;
  const headlineValue = position?.assetType === 'FX' ? requiredMargin : marketValue;

  return {
    title: `${position?.symbol || '-'} (${position?.assetType || '-'})`,
    profit: Number.isFinite(headlineValue) ? fmtJPY(headlineValue) : '未取得',
    rate: '—',
    lots: absQuantity > 0 ? fmtQuantity(absQuantity) : '—',
    avg: avgRateValue > 0 ? fmtRate(avgRateValue, position?.assetType, position?.symbol) : '—',
    now: '未取得',
    mmr: '—',
    zero: formatLossJPY(zeroLoss),
    half: formatLossJPY(halfLoss),
    note: noteText
  };
}

function openDetail(target) {
  if (!detailPanel || !target) return;

  const data = target instanceof Element
    ? buildDetailDataFromPosition({
      symbol: target.querySelector('.pair-title')?.textContent || '-',
      assetType: activePortfolioAssetTab,
      absQuantity: 0,
      avgRate: 0,
      side: 'buy',
      memo: 'データ準備中。',
      accounts: []
    })
    : buildDetailDataFromPosition(target);

  if (detailTitle) detailTitle.textContent = data.title;
  if (detailProfit) {
    detailProfit.textContent = data.profit;
    detailProfit.classList.remove('positive', 'negative', 'neutral');
    detailProfit.classList.add('neutral');
  }
  if (detailRate) {
    detailRate.textContent = data.rate;
    applyRateClass(detailRate, data.rate);
  }
  if (detailLots) detailLots.textContent = data.lots;
  if (detailAvg) detailAvg.textContent = data.avg;
  if (detailNow) detailNow.textContent = data.now;
  if (detailMMR) detailMMR.textContent = data.mmr;
  if (detailZero) detailZero.textContent = data.zero;
  if (detailHalf) detailHalf.textContent = data.half;
  if (detailNote) detailNote.textContent = data.note;

  detailPanel.classList.add('open');
  detailPanel.setAttribute('aria-hidden', 'false');
  detailPanel.style.transform = '';
  lockBackgroundScroll();
  detailScrim.hidden = false;
  requestAnimationFrame(() => detailScrim.classList.add('show'));
}

function closeDetail() {
  if (!detailPanel) return;
  detailPanel.classList.remove('open');
  detailPanel.setAttribute('aria-hidden', 'true');
  detailPanel.style.transform = '';
  unlockBackgroundScroll();
  detailScrim.classList.remove('show');
  setTimeout(() => {
    detailScrim.hidden = true;
  }, 250);
}

detailClose?.addEventListener('click', closeDetail);
detailScrim?.addEventListener('click', closeDetail);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && detailPanel?.classList.contains('open')) {
    closeDetail();
  }
});

// モバイルは下方向スワイプで閉じる、横レイアウト時は右スワイプで閉じる。
(() => {
  if (!detailPanel) return;
  let startX = 0;
  let startY = 0;
  let canDismissBySwipe = false;
  let isTracking = false;

  detailPanel.addEventListener('touchstart', (e) => {
    if (!detailPanel.classList.contains('open')) return;
    if (e.touches.length !== 1) return;
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const rect = detailPanel.getBoundingClientRect();
    const touchYFromPanelTop = e.touches[0].clientY - rect.top;
    const startedNearHeader = touchYFromPanelTop <= 96;
    const atTop = detailPanel.scrollTop <= 2;

    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    canDismissBySwipe = isMobile ? (atTop || startedNearHeader) : true;
    isTracking = canDismissBySwipe;
    if (isTracking) {
      detailPanel.style.transition = 'none';
    }
  }, { passive: true });

  detailPanel.addEventListener('touchmove', (e) => {
    if (!isTracking) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    if (isMobile && dy > 0 && Math.abs(dy) > Math.abs(dx)) {
      detailPanel.style.transform = `translateY(${Math.min(dy, 220)}px)`;
    } else if (!isMobile && dx > 0 && Math.abs(dx) > Math.abs(dy)) {
      detailPanel.style.transform = `translateX(${Math.min(dx, 220)}px)`;
    }
  }, { passive: true });

  detailPanel.addEventListener('touchend', (e) => {
    if (!isTracking) return;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const dx = endX - startX;
    const dy = endY - startY;
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const shouldClose = isMobile
      ? (canDismissBySwipe && dy > 110 && Math.abs(dy) > Math.abs(dx) * 1.05)
      : (dx > 120 && Math.abs(dx) > Math.abs(dy) * 1.1);
    detailPanel.style.transition = '';
    if (shouldClose) closeDetail();
    else detailPanel.style.transform = '';
    isTracking = false;
    canDismissBySwipe = false;
  });
})();

// iPad等で右ペイン端のスクロールが背景へ伝播するのを防ぐ。
(() => {
  if (!detailPanel) return;
  let lastY = 0;

  detailPanel.addEventListener('touchstart', (e) => {
    if (!detailPanel.classList.contains('open')) return;
    if (e.touches.length !== 1) return;
    lastY = e.touches[0].clientY;
  }, { passive: true });

  detailPanel.addEventListener('touchmove', (e) => {
    if (!detailPanel.classList.contains('open')) return;
    // モバイル(bottom sheet)は既存の閉じジェスチャー制御に任せる。
    if (window.matchMedia('(max-width: 768px)').matches) return;
    if (e.touches.length !== 1) return;

    const currentY = e.touches[0].clientY;
    const dy = currentY - lastY;
    lastY = currentY;

    const canScroll = detailPanel.scrollHeight > detailPanel.clientHeight + 1;
    const atTop = detailPanel.scrollTop <= 1;
    const atBottom = detailPanel.scrollTop + detailPanel.clientHeight >= detailPanel.scrollHeight - 1;

    if (!canScroll || (atTop && dy > 0) || (atBottom && dy < 0)) {
      e.preventDefault();
    }
  }, { passive: false });
})();

// 詳細表示中は、パネル外タッチで背景のスクロールを発生させない。
document.addEventListener('touchmove', (e) => {
  if (!detailPanel?.classList.contains('open')) return;
  if (!detailPanel.contains(e.target)) {
    e.preventDefault();
  }
}, { passive: false });

document.addEventListener('wheel', (e) => {
  if (!detailPanel?.classList.contains('open')) return;
  if (!detailPanel.contains(e.target)) {
    e.preventDefault();
  }
}, { passive: false });

function adjustDetailHeight() {
  if (!detailPanel) return;
  if (window.matchMedia('(max-width: 768px)').matches) {
    const viewportHeight = Math.floor(window.visualViewport?.height || window.innerHeight);
    const vh = Math.floor(viewportHeight * 0.9);
    detailPanel.style.setProperty('--detail-sheet-height', `${vh}px`);
  } else {
    detailPanel.style.removeProperty('--detail-sheet-height');
  }
}

window.addEventListener('load', adjustDetailHeight);
window.addEventListener('resize', adjustDetailHeight);
window.addEventListener('orientationchange', adjustDetailHeight);
window.visualViewport?.addEventListener('resize', adjustDetailHeight);
setTimeout(adjustDetailHeight, 200);

// ===== Chart =====
function buildTopPerformanceSeries(year, latestMonth) {
  if (Array.isArray(topSeries?.performanceConfirmedSeries) && Array.isArray(topSeries?.performanceTotalSeries)) {
    return {
      confirmedSeries: topSeries.performanceConfirmedSeries,
      totalSeries: topSeries.performanceTotalSeries
    };
  }

  const tradingData = parseStoredJson(PROFIT_STORAGE_KEY_TRADING);
  const initialFunds = parseStoredJson(PROFIT_STORAGE_KEY_INITIAL);
  const initialUnrealized = parseStoredJson(PROFIT_STORAGE_KEY_INITIAL_UNREALIZED);
  const yearData = tradingData?.[year] || tradingData?.[String(year)] || {};
  const yearInitialData = initialFunds?.[year] || initialFunds?.[String(year)] || {};
  const yearInitialUnrealData = initialUnrealized?.[year] || initialUnrealized?.[String(year)] || {};

  const yearStartConfirmed = GROWTH_TARGET_ACCOUNTS.reduce((sum, account) => {
    return sum + (Number(yearInitialData?.[account.key]) || 0);
  }, 0);
  const yearStartTotal = GROWTH_TARGET_ACCOUNTS.reduce((sum, account) => {
    return sum + (Number(yearInitialData?.[account.key]) || 0)
      + (Number(yearInitialUnrealData?.[account.key]) || 0);
  }, 0);

  let cumulativeDeposits = 0;
  let cumulativeWithdrawals = 0;

  // Performanceモードは年初基準の差分表示とするため、基準点を必ず0に固定
  const confirmedSeries = [0];
  const totalSeries = [0];

  for (let month = 1; month <= 12; month += 1) {
    if (!hasMeaningfulMonthData(yearData, month)) {
      confirmedSeries.push(null);
      totalSeries.push(null);
      continue;
    }

    const monthData = yearData?.[month] || yearData?.[String(month)] || {};
    GROWTH_TARGET_ACCOUNTS.forEach((account) => {
      const row = monthData?.[account.key] || {};
      cumulativeDeposits += Number(row.deposit) || 0;
      cumulativeWithdrawals += Number(row.withdrawal) || 0;
    });

    const growthConfirmed = GROWTH_TARGET_ACCOUNTS.reduce((sum, account) => {
      return sum + calculateLinkedAccountConfirmedAssets(tradingData, initialFunds, year, month, account.key);
    }, 0);
    const growthTotalValues = GROWTH_TARGET_ACCOUNTS.map((account) => (
      calculateLinkedAccountNetAssets(tradingData, initialFunds, year, month, account.key)
    ));
    const growthTotal = growthTotalValues.every(Number.isFinite)
      ? growthTotalValues.reduce((sum, value) => sum + value, 0)
      : null;

    confirmedSeries.push(growthConfirmed - yearStartConfirmed - cumulativeDeposits + cumulativeWithdrawals);
    totalSeries.push(Number.isFinite(growthTotal)
      ? growthTotal - yearStartTotal - cumulativeDeposits + cumulativeWithdrawals
      : null);
  }

  return { confirmedSeries, totalSeries };
}

function updateTopAssetLegend() {
  const legendEquity = document.getElementById('topLegendEquity');
  const legendBalance = document.getElementById('topLegendBalance');
  if (!legendEquity || !legendBalance) return;

  const equityLabel = topAssetTrendView === 'performance' ? 'Equity Growth' : 'Total Equity';
  const balanceLabel = topAssetTrendView === 'performance' ? 'Balance Growth' : 'Net Balance';

  legendEquity.innerHTML = `<span class="dot dot-green"></span> ${equityLabel}`;
  legendBalance.innerHTML = `<span class="dot dot-blue"></span> ${balanceLabel}`;
}

function renderPerformanceChart() {
  const canvas = document.getElementById('perfChart');
  const emptyEl = document.getElementById('perfChartEmpty');
  const ctx = canvas?.getContext('2d');
  if (!ctx) return;

  if (!topSeries?.hasData) {
    if (perfChart) {
      if (perfChart.$laserRevealRaf) cancelAnimationFrame(perfChart.$laserRevealRaf);
      perfChart.destroy();
      perfChart = null;
    }
    canvas.hidden = true;
    if (emptyEl) emptyEl.hidden = false;
    return;
  }

  canvas.hidden = false;
  if (emptyEl) emptyEl.hidden = true;

  const gradBlue = ctx.createLinearGradient(0, 0, 0, 250);
  gradBlue.addColorStop(0, 'rgba(61,162,255,0.25)');
  gradBlue.addColorStop(1, 'rgba(61,162,255,0)');
  const gradGreen = ctx.createLinearGradient(0, 0, 0, 250);
  gradGreen.addColorStop(0, 'rgba(62,224,143,0.25)');
  gradGreen.addColorStop(1, 'rgba(62,224,143,0)');

  const monthLabels = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
  const perfLabels = ['年初', ...monthLabels];
  const latestMonth = topSeries.month || 12;
  const netBalanceSeries = [topSeries.chartStartTotal || topSeries.realized[0] || 0];
  const totalEquitySeries = [(topSeries.chartStartTotalWithUnrealized ?? topSeries.chartStartTotal) || topSeries.total[0] || 0];

  for (let month = 1; month <= 12; month += 1) {
    netBalanceSeries.push(topSeries.realized[month - 1] ?? null);
    totalEquitySeries.push(topSeries.total[month - 1] ?? null);
  }

  const performanceSeries = buildTopPerformanceSeries(topSeries.year, latestMonth);
  const activeNetBalanceSeries = topAssetTrendView === 'performance'
    ? performanceSeries.confirmedSeries
    : netBalanceSeries;
  const activeTotalEquitySeries = topAssetTrendView === 'performance'
    ? performanceSeries.totalSeries
    : totalEquitySeries;
  const netLabel = topAssetTrendView === 'performance' ? 'Balance Growth' : 'Net Balance';
  const equityLabel = topAssetTrendView === 'performance' ? 'Equity Growth' : 'Total Equity';

  const isMobile = window.innerWidth <= 480;
  const tickFontSize = isMobile ? 10 : 12;

  if (perfChart) {
    // destroy前にrAFループを必ずキャンセル（破棄済みcanvasへのアクセスを防ぐ）
    if (perfChart.$laserRevealRaf) {
      cancelAnimationFrame(perfChart.$laserRevealRaf);
      perfChart.$laserRevealRaf = null;
    }
    perfChart.destroy();
  }

  perfChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: perfLabels,
      datasets: [
        {
          label: netLabel,
          data: activeNetBalanceSeries,
          borderColor: '#3DA2FF',
          backgroundColor: gradBlue,
          fill: true,
          tension: 0.35,
          pointRadius: 2,
          pointHitRadius: 20,
          pointHoverRadius: 5
        },
        {
          label: equityLabel,
          data: activeTotalEquitySeries,
          borderColor: '#3EE08F',
          backgroundColor: gradGreen,
          fill: true,
          tension: 0.35,
          pointRadius: 2,
          pointHitRadius: 20,
          pointHoverRadius: 5
        }
      ]
    },
    options: {
      maintainAspectRatio: false,
      responsive: true,
      events: ['mousemove', 'mouseout', 'click', 'touchstart', 'touchmove'],
      interaction: {
        mode: 'index',
        intersect: false,
        axis: 'x'
      },
      animation: false,
      plugins: {
        laserReveal: { enabled: true },
        legend: { display: false },
        tooltip: {
          itemSort: (a, b) => (Number(b.parsed?.y) || 0) - (Number(a.parsed?.y) || 0),
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${fmtMan(ctx.parsed.y)}`
          }
        }
      },
      scales: {
        x: {
          ticks: { color: 'rgba(255,255,255,0.8)', font: { size: tickFontSize } },
          grid: { color: 'rgba(255,255,255,0.1)', borderDash: [3,3], drawBorder: false }
        },
        y: {
          ticks: {
            color: 'rgba(255,255,255,0.8)',
            font: { size: 12 },
            callback: (v) => fmtMan(v)
          },
          grid: { color: 'rgba(255,255,255,0.1)', borderDash: [3,3], drawBorder: false }
        }
      }
    }
  });

  updateTopAssetLegend();
  playLaserReveal(perfChart, 2300);
}

function syncTopAssetTrendTabs() {
  const viewSelect = document.getElementById('topAssetViewSelect');
  if (!viewSelect) return;
  viewSelect.value = topAssetTrendView;
}

function bindTopAssetTrendTabs() {
  const viewSelect = document.getElementById('topAssetViewSelect');
  if (!viewSelect) return;

  if (viewSelect.dataset.bound !== '1') {
    viewSelect.addEventListener('change', (event) => {
      const nextView = event.target.value === 'performance' ? 'performance' : 'asset';
      if (topAssetTrendView === nextView) return;
      topAssetTrendView = nextView;
      renderPerformanceChart();
      syncTopAssetTrendTabs();
    });
    viewSelect.dataset.bound = '1';
  }

  syncTopAssetTrendTabs();
}

renderPerformanceChart();
bindTopAssetTrendTabs();

function clearDoughnutTooltip(chart) {
  if (!chart) return;
  chart.setActiveElements([]);
  if (chart.tooltip) {
    chart.tooltip.setActiveElements([], { x: 0, y: 0 });
  }
  chart.update('none');
}

function setDoughnutTooltip(chart, activeElements, point) {
  if (!chart) return;
  chart.setActiveElements(activeElements);
  if (chart.tooltip) {
    chart.tooltip.setActiveElements(activeElements, point);
  }
  chart.update('none');
}

function activateDoughnutTooltip(chart, event) {
  if (!chart?.canvas) return;

  const active = chart.getElementsAtEventForMode(event, 'nearest', { intersect: false }, true);
  if (!active.length) {
    clearDoughnutTooltip(chart);
    return;
  }

  const rect = chart.canvas.getBoundingClientRect();
  const sourcePoint = event.touches?.[0] || event.changedTouches?.[0] || event;
  const point = {
    x: sourcePoint.clientX - rect.left,
    y: sourcePoint.clientY - rect.top
  };
  setDoughnutTooltip(chart, [active[0]], point);
}

function bindDoughnutTooltipInteractions(chart, siblingChartResolver) {
  if (!chart?.canvas || chart.canvas.dataset.tooltipBound === '1') return;

  chart.canvas.style.touchAction = 'manipulation';
  chart.canvas.addEventListener('pointerdown', (event) => {
    const siblingChart = siblingChartResolver?.();
    if (siblingChart) clearDoughnutTooltip(siblingChart);
    activateDoughnutTooltip(chart, event);
  });

  chart.canvas.dataset.tooltipBound = '1';
}

function dismissDoughnutTooltipsOnOutsideTap(event) {
  const target = event.target;
  if (!(target instanceof Element)) return;

  [portfolioChart, accountChart, currentPortfolioChart].forEach((chart) => {
    if (!chart?.canvas) return;
    if (chart.canvas.contains(target)) return;
    if (!chart.getActiveElements().length) return;
    clearDoughnutTooltip(chart);
  });
}

document.addEventListener('pointerdown', dismissDoughnutTooltipsOnOutsideTap, true);

const DONUT_REVEAL_ANIMATION = {
  animateRotate: true,
  animateScale: false,
  duration: 1500,
  easing: 'easeInOutQuart'
};

function isElementInViewport(el) {
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  return rect.bottom > 0 && rect.top < window.innerHeight;
}

function playDonutReveal(chart) {
  if (!chart) return;
  chart.options.animation = { ...DONUT_REVEAL_ANIMATION };
  chart.reset();
  chart.update();
}

function bindSectionDonutReveal(section, chartResolver) {
  if (!section || section.dataset.donutRevealBound === '1') return;
  section.dataset.donutRevealBound = '1';
  section.addEventListener('animationstart', (e) => {
    if (e.animationName !== 'section-reveal') return;
    chartResolver().forEach(playDonutReveal);
  });
}

// ===== Portfolio Chart & List =====
function renderPortfolio() {
  const renderAllocation = ({ data, listId, canvasId, currentChart, onChartCreated }) => {
    const total = data.reduce((sum, item) => sum + item.amount, 0);
    const sortedData = data.slice().sort((a, b) => b.amount - a.amount);
    const listEl = document.getElementById(listId);
    const canvas = document.getElementById(canvasId);

    if (!sortedData.length || total <= 0) {
      if (listEl) listEl.innerHTML = '<p class="data-empty-state">データなし</p>';
      if (canvas) canvas.hidden = true;
      if (currentChart) currentChart.destroy();
      onChartCreated(null);
      return null;
    }

    if (listEl) {
      listEl.innerHTML = sortedData.map((item) => `
        <div class="portfolio-item" style="--item-color: ${item.color}">
          <span class="portfolio-label">${item.label}</span>
          <span class="portfolio-amount">${fmtJPY(item.amount)}</span>
          <span class="portfolio-percent">${((item.amount / total) * 100).toFixed(1)}%</span>
        </div>
      `).join('');
    }

    if (!canvas || typeof Chart === 'undefined') return null;
    canvas.hidden = false;
    if (currentChart) currentChart.destroy();

    const hexToRgba = (hex, alpha = 0.75) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r},${g},${b},${alpha})`;
    };

    const chart = new Chart(canvas.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: sortedData.map((item) => item.label),
        datasets: [{
          data: sortedData.map((item) => item.amount),
          backgroundColor: sortedData.map((item) => hexToRgba(item.color)),
          borderColor: 'rgba(255,255,255,0.2)',
          borderWidth: 1
        }]
      },
      options: {
        maintainAspectRatio: false,
        responsive: true,
        cutout: '68%',
        animation: false,
        events: ['mousemove', 'mouseout', 'click', 'touchstart', 'touchmove', 'touchend'],
        interaction: { mode: 'nearest', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(10,12,26,0.9)',
            titleColor: 'rgba(255,255,255,0.9)',
            bodyColor: 'rgba(255,255,255,0.85)',
            borderColor: 'rgba(255,255,255,0.15)',
            borderWidth: 1,
            padding: 10,
            displayColors: true,
            boxPadding: 6,
            callbacks: {
              label: (ctx) => `${fmtJPY(ctx.parsed)} (${((ctx.parsed / total) * 100).toFixed(1)}%)`
            }
          }
        }
      }
    });
    onChartCreated(chart);
    return chart;
  };

  portfolioChart = renderAllocation({
    data: portfolioData,
    listId: 'portfolioItems',
    canvasId: 'portfolioChart',
    currentChart: portfolioChart,
    onChartCreated: (chart) => { portfolioChart = chart; }
  });

  accountChart = renderAllocation({
    data: accountData,
    listId: 'accountItems',
    canvasId: 'accountChart',
    currentChart: accountChart,
    onChartCreated: (chart) => { accountChart = chart; }
  });

  if (portfolioChart && accountChart) {
    bindDoughnutTooltipInteractions(portfolioChart, () => accountChart);
    bindDoughnutTooltipInteractions(accountChart, () => portfolioChart);
  }

  const allocSection = portfolioChart?.canvas?.closest('.section') || accountChart?.canvas?.closest('.section');
  bindSectionDonutReveal(allocSection, () => [portfolioChart, accountChart]);
  if (allocSection?.classList.contains('reveal-anim') && isElementInViewport(allocSection)) {
    [portfolioChart, accountChart].forEach(playDonutReveal);
  }
}
renderPortfolio();

function normalizeAssetTypeLabel(assetType) {
  const normalized = String(assetType || '').trim();
  if (!normalized) return 'その他';
  if (normalized.toUpperCase() === 'FX') return 'FX';
  if (normalized === 'NISA') return '証券';
  return normalized;
}

function normalizeTopSymbolKey(symbol) {
  if (historyCore?.normalizeSymbolKey) return historyCore.normalizeSymbolKey(symbol);
  return String(symbol || '').trim().toUpperCase().replace(/\s+/g, '');
}

function resolveTopDefaultContractSize(assetType, symbol) {
  if (assetType !== 'FX') return 1;
  const symbolKey = normalizeTopSymbolKey(symbol);
  const largeLotPairs = ['HUF/JPY', 'ZAR/JPY', 'MXN/JPY'];
  const isLargeLot = largeLotPairs.some(p => normalizeTopSymbolKey(p) === symbolKey);
  if (isLargeLot) return historyCore?.HUF_CONTRACT_SIZE || 100000;
  return historyCore?.FX_CONTRACT_SIZE_DEFAULT || 10000;
}

function getLatestFxRate(entries, symbol) {
  const targetKey = normalizeTopSymbolKey(symbol);
  const sorted = historyCore?.getSortedEntries
    ? historyCore.getSortedEntries(entries || [], 'newest')
    : [...(entries || [])].sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));

  const hit = sorted.find((entry) => {
    const assetType = normalizeAssetTypeLabel(entry?.assetType);
    const rate = Number(entry?.rate);
    return assetType === 'FX'
      && normalizeTopSymbolKey(entry?.symbol) === targetKey
      && Number.isFinite(rate)
      && rate > 0;
  });

  return Number(hit?.rate) || 0;
}

function resolveQuoteToJpyRate(symbol, entries) {
  const normalized = String(symbol || '').trim().toUpperCase();
  const parts = normalized.split('/');
  if (parts.length !== 2) return null;
  const quote = parts[1];
  if (!quote || quote === 'JPY') return 1;

  const direct = getLatestFxRate(entries, `${quote}/JPY`);
  if (direct > 0) return direct;

  const inverse = getLatestFxRate(entries, `JPY/${quote}`);
  if (inverse > 0) return 1 / inverse;

  return null;
}

function resolveSecuritiesUnitDivider(position) {
  if (normalizeAssetTypeLabel(position?.assetType) !== '証券') return 1;
  return isTrustLikeSecuritiesSymbol(position?.symbol) ? 10000 : 1;
}

function estimateRequiredMargin(position) {
  const qty = Number(position.absQuantity) || 0;
  const avgRate = Number(position.avgRate) || 0;
  const contractSize = Number(position.contractSize)
    || resolveTopDefaultContractSize(position?.assetType, position?.symbol);
  const quoteToJpyRate = Number(position.quoteToJpyRate);
  if (!Number.isFinite(quoteToJpyRate) || quoteToJpyRate <= 0) return null;
  const notionalJpy = qty * contractSize * Math.max(0, avgRate) * Math.max(0, quoteToJpyRate);
  return notionalJpy * 0.04;
}

function estimateMarketValue(position) {
  const explicitValue = Number(position?.metricValue);
  return Number.isFinite(explicitValue) && position?.metricValue !== null
    ? explicitValue
    : null;
}

function getLatestMemoMap(entries) {
  const map = new Map();
  const sorted = historyCore?.getSortedEntries
    ? historyCore.getSortedEntries(entries, 'newest')
    : [...entries].sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));

  sorted.forEach((entry) => {
    const key = `${normalizeAssetTypeLabel(entry.assetType)}::${normalizeTopSymbolKey(entry.symbol)}`;
    if (map.has(key)) return;
    const memo = String(entry.memo || '').trim();
    if (memo) map.set(key, memo);
  });

  return map;
}

function aggregateOpenPositionsForTop(entries) {
  if (!historyCore?.calculateOpenPositions) return [];

  // SBI証券以外をTrade Historyから計算
  const nonSbiSecuritiesEntries = (entries || []).filter((e) => {
    const acct = String(e.account || '').trim().toUpperCase().replace(/\s+/g, '');
    const isSbi = acct === 'SBI' || acct.includes('SBI証券');
    const isSec = e.assetType === '証券' || e.assetType === 'NISA';
    return !(isSbi && isSec);
  });
  const baseOpenPositions = historyCore.calculateOpenPositions(nonSbiSecuritiesEntries);

  // SBI証券はスナップショット＋差分で計算
  const securitiesPositions = historyCore.buildSecuritiesOpenPositions
    ? historyCore.buildSecuritiesOpenPositions(entries)
    : [];

  const allOpenPositions = [...baseOpenPositions, ...securitiesPositions];
  const latestMemoMap = getLatestMemoMap(entries || []);
  const map = new Map();

  allOpenPositions.forEach((position) => {
    const assetType = normalizeAssetTypeLabel(position.assetType || 'その他');
    const symbolKey = normalizeTopSymbolKey(position.symbol);
    const key = `${assetType}::${symbolKey}`;
    const signedQty = position.side === 'sell' ? -Math.abs(Number(position.absQuantity) || 0) : Math.abs(Number(position.absQuantity) || 0);
    if (!Number.isFinite(signedQty) || Math.abs(signedQty) < 1e-12) return;

    const current = map.get(key) || {
      key,
      symbol: position.symbol,
      assetType,
      quantity: 0,
      avgRate: 0,
      contractSize: Number(position.contractSize) || resolveTopDefaultContractSize(assetType, position.symbol),
      accounts: new Set(),
      strategies: new Set()
    };

    const nextQty = current.quantity + signedQty;
    const positionRate = Number(position.avgRate) || 0;
    if (current.quantity === 0 || Math.sign(current.quantity) === Math.sign(signedQty)) {
      const currentAbs = Math.abs(current.quantity);
      const addAbs = Math.abs(signedQty);
      const weighted = ((current.avgRate * currentAbs) + (positionRate * addAbs)) / (currentAbs + addAbs);
      current.quantity = nextQty;
      current.avgRate = Number.isFinite(weighted) ? weighted : positionRate;
    } else if (Math.abs(nextQty) < 1e-12) {
      current.quantity = 0;
      current.avgRate = 0;
    } else if (Math.sign(nextQty) === Math.sign(current.quantity)) {
      current.quantity = nextQty;
    } else {
      current.quantity = nextQty;
      current.avgRate = positionRate;
    }

    if (position.account) current.accounts.add(position.account);
    if (position.strategy) current.strategies.add(position.strategy);
    current.contractSize = Number(position.contractSize)
      || current.contractSize
      || resolveTopDefaultContractSize(assetType, position.symbol);

    map.set(key, current);
  });

  return Array.from(map.values())
    .filter((position) => Math.abs(position.quantity) > 1e-12)
    .map((position) => {
      const side = position.quantity >= 0 ? 'buy' : 'sell';
      const absQuantity = Math.abs(position.quantity);
      const base = {
        id: position.key,
        symbol: position.symbol,
        assetType: position.assetType,
        side,
        absQuantity,
        avgRate: position.avgRate,
        contractSize: position.contractSize,
        quoteToJpyRate: position.assetType === 'FX' ? resolveQuoteToJpyRate(position.symbol, entries) : 1,
        accounts: [...position.accounts].sort((a, b) => String(a).localeCompare(String(b), 'ja')),
        strategy: [...position.strategies][0] || '-',
        memo: latestMemoMap.get(position.key) || 'メモなし'
      };

      const metricValue = position.assetType === 'FX'
        ? estimateRequiredMargin(base)
        : estimateMarketValue(base);

      return {
        ...base,
        metricValue
      };
    })
    .sort((a, b) => (Number(b.metricValue) || 0) - (Number(a.metricValue) || 0));
}

function buildCryptoPortfolioFromMonthlyHoldings() {
  const tradingData = parseStoredJson(PROFIT_STORAGE_KEY_TRADING);
  const year = topSeries?.year || TOP_BASE_YEAR;
  const month = topSeries?.month || 12;
  
  const sbivcData = tradingData?.[year]?.[month]?.['sbivc'];
  if (!sbivcData || !Array.isArray(sbivcData.holdings)) return [];
  
  const allHoldings = sbivcData.holdings.filter(h => Number(h.quantity) > 0);
  if (!allHoldings.length) return [];

  // 各通貨ごとに行を生成（円換算額を使用）
  return allHoldings.map(holding => {
    const symbol = holding.symbol;
    const quantity = Number(holding.quantity) || 0;

    // JPY現金は1:1で円換算
    if (symbol === 'JPY') {
      return {
        id: 'monthly::JPY',
        symbol: 'JPY',
        assetType: '暗号資産',
        side: 'buy',
        absQuantity: quantity,
        avgRate: 1,
        contractSize: 1,
        accounts: ['SBI VC'],
        strategy: '-',
        memo: `月次報告書: ${quantity.toLocaleString()} JPY`,
        metricValue: quantity
      };
    }

    const rate = Number(holding.rate) || 0;
    const hasValueJPY = holding.valueFilled === true
      || (holding.valueJPY != null && holding.valueJPY !== '' && Number(holding.valueJPY) > 0);
    const valueJPY = hasValueJPY ? Number(holding.valueJPY) : null;
    // レートが入力されている場合は優先、なければ円換算額から計算
    const avgRate = rate > 0
      ? rate
      : (quantity > 0 && Number.isFinite(valueJPY) ? valueJPY / quantity : 0);

    return {
      id: `monthly::${symbol}`,
      symbol: `${symbol}/JPY`,
      assetType: '暗号資産',
      side: 'buy',
      absQuantity: quantity,
      avgRate: avgRate,
      contractSize: 1,
      accounts: ['SBI VC'],
      strategy: '-',
      memo: `月次報告書: ${quantity.toFixed(8)} ${symbol}`,
      metricValue: Number.isFinite(valueJPY) ? valueJPY : null
    };
  });
}

function applyMonthlyCryptoRows(rows) {
  const monthlyCryptoRows = buildCryptoPortfolioFromMonthlyHoldings();
  if (!monthlyCryptoRows.length) return rows;

  const nonCryptoRows = rows.filter((row) => normalizeAssetTypeLabel(row.assetType) !== normalizeAssetTypeLabel('暗号資産'));
  return [...nonCryptoRows, ...monthlyCryptoRows];
}

function isEtfLikeSecuritiesSymbol(symbol) {
  const upper = String(symbol || '').toUpperCase();
  if (!upper) return false;
  return upper.includes('ETF')
    || upper.includes('上場投信')
    || (upper.includes('MAXIS') && !upper.includes('EMAXIS'));
}

function isTrustLikeSecuritiesSymbol(symbol) {
  const upper = String(symbol || '').toUpperCase();
  if (!upper || isEtfLikeSecuritiesSymbol(symbol)) return false;
  const trustLikeKeywords = ['オール・カントリー', 'オールカントリー', 'EMAXIS', '投資信託', 'インデックス・ファンド', 'インデックスファンド', 'ファンド', 'スリム'];
  return trustLikeKeywords.some((keyword) => upper.includes(keyword));
}

function calculateTopSecuritiesHoldingPnl(holding) {
  if (!holding || String(holding.symbol || '').trim() === '預り金' || holding.valueFilled !== true) return null;

  const valueJPY = Number(holding.valueJPY) || 0;
  const quantity = Number(holding.quantity) || 0;
  const acquisitionRate = Number(holding.acquisitionRate);
  if (!Number.isFinite(acquisitionRate) || acquisitionRate <= 0 || quantity <= 0) return null;

  const unitDivider = isTrustLikeSecuritiesSymbol(holding.symbol) ? 10000 : 1;
  const cost = acquisitionRate * quantity / unitDivider;
  const pnl = valueJPY - cost;
  const pnlRate = cost > 0 ? (pnl / cost) * 100 : null;
  return { cost, pnl, pnlRate };
}

function buildMonthlySecuritiesHoldingsMap() {
  const tradingData = parseStoredJson(PROFIT_STORAGE_KEY_TRADING);
  const year = topSeries?.year || TOP_BASE_YEAR;
  const month = topSeries?.month || 12;

  const sbiData = tradingData?.[year]?.[month]?.['sbi'];
  const map = new Map();
  if (!sbiData || !Array.isArray(sbiData.holdings)) return map;

  sbiData.holdings.forEach((holding) => {
    const symbol = String(holding?.symbol || '').trim();
    if (!symbol || holding.valueFilled !== true) return;

    const pnlSummary = calculateTopSecuritiesHoldingPnl(holding);
    map.set(symbol, {
      valueJPY: Number(holding.valueJPY) || 0,
      holdingPnl: pnlSummary ? Math.round(pnlSummary.pnl) : null,
      holdingPnlRate: pnlSummary?.pnlRate ?? null
    });
  });

  return map;
}

function applyMonthlySecuritiesValues(rows) {
  const holdingsMap = buildMonthlySecuritiesHoldingsMap();
  if (!holdingsMap.size) return rows;

  return rows.map((row) => {
    if (normalizeAssetTypeLabel(row.assetType) !== '証券') return row;
    const holdingInfo = holdingsMap.get(String(row.symbol).trim());
    if (!holdingInfo) return row;
    return {
      ...row,
      metricValue: holdingInfo.valueJPY,
      holdingPnl: holdingInfo.holdingPnl,
      holdingPnlRate: holdingInfo.holdingPnlRate
    };
  });
}

function getActivePortfolioRows() {
  const entries = historyCore?.parseEntries ? historyCore.parseEntries() : [];
  const rows = applyMonthlyCryptoRows(aggregateOpenPositionsForTop(entries));
  return rows.filter((row) => normalizeAssetTypeLabel(row.assetType) === normalizeAssetTypeLabel(activePortfolioAssetTab));
}

function bindPortfolioTabs() {
  document.querySelectorAll('[data-asset-tab]').forEach((tab) => {
    if (tab.dataset.bound === '1') return;
    tab.addEventListener('click', () => {
      const nextTab = tab.dataset.assetTab || 'FX';
      if (nextTab === activePortfolioAssetTab) return;
      activePortfolioAssetTab = nextTab;
      renderCurrentPortfolioSection();
    });
    tab.dataset.bound = '1';
  });
}

function syncPortfolioTabs() {
  document.querySelectorAll('[data-asset-tab]').forEach((tab) => {
    const isActive = tab.dataset.assetTab === activePortfolioAssetTab;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
  movePillIndicator();
}

/* ピルインジケーターをアクティブタブへ移動
   初回はアニメーションなし、以降は CSS transition でスライド */
function movePillIndicator() {
  const indicator = document.querySelector('.portfolio-pill-indicator');
  const activeTab  = document.querySelector('.portfolio-tab.active');
  if (!indicator || !activeTab) return;

  const doMove = () => {
    indicator.style.transform = `translateX(${activeTab.offsetLeft}px)`;
    indicator.style.width     = `${activeTab.offsetWidth}px`;
  };

  if (!indicator.dataset.ready) {
    /* 初回: 描画前に transition を切ってから位置をセット */
    indicator.style.transition = 'none';
    requestAnimationFrame(() => {
      doMove();
      requestAnimationFrame(() => {
        indicator.style.transition = '';
        indicator.dataset.ready = '1';
      });
    });
  } else {
    doMove();
  }
}

function resolvePortfolioUnit(row) {
  const assetType = normalizeAssetTypeLabel(row.assetType);
  if (assetType === 'FX') return 'Lot';
  if (assetType === '暗号資産') {
    const base = String(row.symbol || '').split('/')[0].trim();
    return base || '';
  }
  if (assetType === '証券') {
    return resolveSecuritiesUnitDivider(row) === 10000 ? '口' : '株';
  }
  return '';
}

function fmtSignedPercent(value) {
  if (!Number.isFinite(value)) return '--';
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function bindCurrentPortfolioRows(rows) {
  const list = document.getElementById('currentPortfolioList');
  if (!list) return;
  list.querySelectorAll('[data-open-id]').forEach((rowEl) => {
    rowEl.addEventListener('click', () => {
      const targetId = rowEl.dataset.openId;
      const target = rows.find((row) => row.id === targetId);
      if (!target) return;
      openDetail(target);
    });
  });
}

function renderCurrentPortfolioSection() {
  const list = document.getElementById('currentPortfolioList');
  const chartCanvas = document.getElementById('currentPortfolioChart');
  const chartCtx = chartCanvas?.getContext('2d');
  if (!list) return;

  const entries = historyCore?.parseEntries ? historyCore.parseEntries() : [];
  let allRows = aggregateOpenPositionsForTop(entries);
  allRows = applyMonthlyCryptoRows(allRows);
  allRows = applyMonthlySecuritiesValues(allRows);
  const hasTabData = (tabName) => allRows.some((row) => normalizeAssetTypeLabel(row.assetType) === normalizeAssetTypeLabel(tabName));
  if (!hasTabData(activePortfolioAssetTab)) {
    const fallbackTab = ['FX', '証券', '暗号資産'].find((tabName) => hasTabData(tabName));
    if (fallbackTab) activePortfolioAssetTab = fallbackTab;
  }
  syncPortfolioTabs();

  const rows = allRows.filter((row) => normalizeAssetTypeLabel(row.assetType) === normalizeAssetTypeLabel(activePortfolioAssetTab));

  if (!rows.length) {
    list.innerHTML = '<li class="pair-card portfolio-empty-row"><p class="data-empty-state">データなし</p></li>';
    if (chartCanvas) chartCanvas.hidden = true;
    if (currentPortfolioChart) {
      currentPortfolioChart.destroy();
      currentPortfolioChart = null;
    }
    return;
  }

  const chartRows = rows.filter((row) => Number.isFinite(row.metricValue) && row.metricValue > 0);
  const total = chartRows.reduce((sum, row) => sum + row.metricValue, 0);
  const palette = ['#3B6DFF', '#3EE08F', '#3DA2FF', '#D95757', '#E9C85E', '#7E7A98', '#F18E4F', '#8BC7FF'];
  list.innerHTML = rows.map((row, idx) => {
    const hasMetric = Number.isFinite(row.metricValue);
    const share = hasMetric && total > 0 ? ((row.metricValue / total) * 100) : null;
    const metricLabel = activePortfolioAssetTab === 'FX' ? '必要証拠金' : '評価額';
    const color = palette[idx % palette.length];
    const unit = resolvePortfolioUnit(row);
    const hasHoldingPnl = activePortfolioAssetTab === '証券' && Number.isFinite(row.holdingPnl);

    if (hasHoldingPnl) {
      const pnlClass = row.holdingPnl > 0 ? 'positive' : row.holdingPnl < 0 ? 'negative' : 'neutral';
      const pnlPercentText = fmtSignedPercent(row.holdingPnlRate);
      return `
        <li class="pair-card portfolio-row-3col" style="--item-color: ${color}" data-open-id="${escapeHtml(row.id)}">
          <div class="pair-title">${escapeHtml(row.symbol)}</div>
          <div class="portfolio-col">
            <span class="portfolio-col-label">評価額</span>
            <span class="portfolio-col-amount">${fmtJPY(row.metricValue)}</span>
          </div>
          <div class="portfolio-col">
            <span class="portfolio-col-label">評価損益</span>
            <span class="portfolio-col-amount ${pnlClass}">${fmtJPY(row.holdingPnl)}</span>
            <span class="growth-pill ${pnlClass}">${pnlPercentText}</span>
          </div>
        </li>
      `;
    }

    const metricText = hasMetric ? fmtJPY(row.metricValue) : '未取得';
    const secondaryText = share == null
      ? `${fmtQuantity(row.absQuantity)} ${unit}`
      : `${fmtQuantity(row.absQuantity)} ${unit} / ${share.toFixed(1)}%`;
    return `
      <li class="pair-card" style="--item-color: ${color}" data-open-id="${escapeHtml(row.id)}">
        <div class="pair-title">${escapeHtml(row.symbol)}</div>
        <div class="pair-right">
          <div class="pair-profit neutral">${metricLabel} ${metricText}</div>
          <div class="pair-growth neutral">${secondaryText}</div>
        </div>
      </li>
    `;
  }).join('');

  bindCurrentPortfolioRows(rows);

  if (!chartCtx || typeof Chart === 'undefined' || !chartRows.length) {
    if (chartCanvas) chartCanvas.hidden = true;
    if (currentPortfolioChart) {
      currentPortfolioChart.destroy();
      currentPortfolioChart = null;
    }
    return;
  }
  chartCanvas.hidden = false;
  if (currentPortfolioChart) currentPortfolioChart.destroy();
  currentPortfolioChart = new Chart(chartCtx, {
    type: 'doughnut',
    data: {
      labels: chartRows.map((row) => row.symbol),
      datasets: [{
        data: chartRows.map((row) => row.metricValue),
        backgroundColor: chartRows.map((_, idx) => palette[idx % palette.length]),
        borderColor: 'rgba(255,255,255,0.2)',
        borderWidth: 1
      }]
    },
    options: {
      maintainAspectRatio: false,
      responsive: true,
      cutout: '68%',
      animation: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.label}: ${fmtJPY(ctx.parsed)} (${total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : '0.0'}%)`
          }
        }
      }
    }
  });

  const currentSection = currentPortfolioChart.canvas?.closest('.section');
  bindSectionDonutReveal(currentSection, () => [currentPortfolioChart]);
  if (currentSection?.classList.contains('reveal-anim') && isElementInViewport(currentSection)) {
    playDonutReveal(currentPortfolioChart);
  }
}

bindPortfolioTabs();
renderCurrentPortfolioSection();

// ===== Year Selector =====
function getPersistedSelectedYear() {
  const raw = Number(localStorage.getItem(SHARED_SELECTED_YEAR_KEY));
  return Number.isFinite(raw) ? raw : null;
}

function saveSelectedYear(year) {
  localStorage.setItem(SHARED_SELECTED_YEAR_KEY, String(year));
}

function resolveTopSeriesForYear(selectedYear) {
  const linkedData = buildTopLinkedData(selectedYear);
  if (linkedData) return linkedData;
  return createEmptyTopSeries(selectedYear);
}

function initializeYearSelector() {
  const tradingDataMap = parseStoredJson(PROFIT_STORAGE_KEY_TRADING);
  const initialFundsMap = parseStoredJson(PROFIT_STORAGE_KEY_INITIAL);
  const initialUnrealizedMap = parseStoredJson(PROFIT_STORAGE_KEY_INITIAL_UNREALIZED);
  const yearSelect = document.getElementById('topYearSelect');

  if (!yearSelect) return;

  const persistedYear = getPersistedSelectedYear();
  const years = (() => {
    const set = new Set([TOP_BASE_YEAR]);
    getNumericYears(tradingDataMap)
      .filter((year) => year >= TOP_BASE_YEAR)
      .forEach((year) => set.add(year));
    getNumericYears(initialFundsMap)
      .filter((year) => year >= TOP_BASE_YEAR)
      .forEach((year) => set.add(year));
    getNumericYears(initialUnrealizedMap)
      .filter((year) => year >= TOP_BASE_YEAR)
      .forEach((year) => set.add(year));

    if (persistedYear && persistedYear >= TOP_BASE_YEAR) set.add(persistedYear);

    let maxYear = Math.max(...set);
    while (true) {
      const yearData = tradingDataMap?.[maxYear] || tradingDataMap?.[String(maxYear)] || {};
      if (!hasMeaningfulMonthData(yearData, 12)) break;
      maxYear += 1;
      set.add(maxYear);
    }

    return [...set].sort((a, b) => b - a);
  })();

  yearSelect.innerHTML = years.map(year => 
    `<option value="${year}">${year}</option>`
  ).join('');

  const defaultYear = persistedYear && years.includes(persistedYear)
    ? persistedYear
    : years[0];

  yearSelect.value = String(defaultYear);
  updateDataByYear(defaultYear);

  if (yearSelect.dataset.yearBound !== '1') {
    yearSelect.addEventListener('change', (event) => {
      updateDataByYear(Number(event.target.value));
    });
    yearSelect.dataset.yearBound = '1';
  }
}

function updateDataByYear(inputYear = null) {
  const yearSelect = document.getElementById('topYearSelect');
  const selectedYear = Number.isFinite(Number(inputYear))
    ? Number(inputYear)
    : (yearSelect ? Number(yearSelect.value) : null);

  if (!selectedYear) return;

  saveSelectedYear(selectedYear);
  topSeries = resolveTopSeriesForYear(selectedYear);

  updateKPIs();

  accountData = topSeries.accountData?.length ? topSeries.accountData : [];
  portfolioData = buildPortfolioAllocationFromAccounts(accountData);
  renderPortfolio();
  updateRiskSection();
  renderCurrentPortfolioSection();
  updateSwap();

  renderPerformanceChart();
}

// ===== Backup Format Core (pure functions; no storage writes) =====
const COMPLETE_BACKUP_PRODUCT = 'TradeScope';
const COMPLETE_BACKUP_VERSION = 2;
const backupDataStorage = window.TradeScopeDataStorage;
const backupStorageTransaction = window.TradeScopeStorageTransaction;
const COMPLETE_BACKUP_RESTORE_JOURNAL_KEY = 'tradeScopeRestoreJournalV1';
const COMPLETE_BACKUP_SKIP_DEMO_KEY = 'profitSkipDemoSeed';
const COMPLETE_BACKUP_PRIMARY_STORAGE_KEYS = Object.freeze([
  'tradingData',
  'yearInitialFunds',
  'yearInitialUnrealized',
  'tradeScopeTradeHistoryV1',
  'tradeScopeMemos',
  'tradeScopeSymbolListV1',
  'tradeInfo',
  ...Object.values(backupDataStorage.keys)
]);
const COMPLETE_BACKUP_STORAGE_LABELS = Object.freeze({
  tradingData: '月次データ',
  yearInitialFunds: '年初資金',
  yearInitialUnrealized: '年初評価損益',
  tradeScopeTradeHistoryV1: '取引履歴',
  tradeScopeMemos: 'Memo',
  tradeScopeSymbolListV1: '銘柄リスト',
  tradeInfo: 'Legacy tradeInfo',
  tradeScopeAccountsV1: '口座', tradeScopeInstrumentsV1: '商品',
  tradeScopeImportBatchesV1: '取込履歴', tradeScopeRawTransactionsV1: '取引事実',
  tradeScopeHoldingSnapshotsV1: '保有情報', tradeScopeAccountSnapshotsV1: '口座状態'
});
const COMPLETE_BACKUP_FORMATS = Object.freeze({
  V1: 'v1-complete',
  V2: 'v2-complete',
  LEGACY_ALL: 'legacy-all',
  LEGACY_PROFIT: 'legacy-profit',
  LEGACY_HISTORY: 'legacy-history',
  UNSUPPORTED_VERSION: 'unsupported-version',
  INVALID: 'invalid'
});

function isPlainRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isIso8601Timestamp(value) {
  if (typeof value !== 'string') return false;
  const isoPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/;
  return isoPattern.test(value) && Number.isFinite(Date.parse(value));
}

function detectBackupFormat(value) {
  if (!isPlainRecord(value)) return COMPLETE_BACKUP_FORMATS.INVALID;

  if (hasOwn(value, 'product') || hasOwn(value, 'backupVersion')) {
    if (value.product !== COMPLETE_BACKUP_PRODUCT) return COMPLETE_BACKUP_FORMATS.INVALID;
    if (![1, 2].includes(value.backupVersion)) return COMPLETE_BACKUP_FORMATS.UNSUPPORTED_VERSION;
    return value.backupVersion === 1 ? COMPLETE_BACKUP_FORMATS.V1 : COMPLETE_BACKUP_FORMATS.V2;
  }

  if (value.tradescope === 'all-backup') return COMPLETE_BACKUP_FORMATS.LEGACY_ALL;
  if (value.tradescope === 'history-backup') return COMPLETE_BACKUP_FORMATS.LEGACY_HISTORY;

  if (hasOwn(value, 'tradingData')
    && hasOwn(value, 'yearInitialFunds')
    && isIso8601Timestamp(value.exportedAt)) {
    return COMPLETE_BACKUP_FORMATS.LEGACY_PROFIT;
  }

  return COMPLETE_BACKUP_FORMATS.INVALID;
}

function validateBackupValue(value, format = detectBackupFormat(value)) {
  const errors = [];
  try { backupDataStorage.assertJson(value); }
  catch (_) { return ['backup contains an unsafe JSON structure']; }
  const requireRecord = (target, path) => {
    if (!isPlainRecord(target)) errors.push(`${path} must be an object`);
  };
  const requireArray = (target, path) => {
    if (!Array.isArray(target)) errors.push(`${path} must be an array`);
  };
  const requireRecordArray = (target, path) => {
    requireArray(target, path);
    if (!Array.isArray(target)) return;
    target.forEach((item, index) => {
      if (!isPlainRecord(item)) errors.push(`${path}[${index}] must be an object`);
    });
  };
  const requireStringArray = (target, path) => {
    requireArray(target, path);
    if (!Array.isArray(target)) return;
    target.forEach((item, index) => {
      if (typeof item !== 'string') errors.push(`${path}[${index}] must be a string`);
    });
  };

  if (format === COMPLETE_BACKUP_FORMATS.INVALID) {
    return ['not a supported TradeScope backup'];
  }

  if (format === COMPLETE_BACKUP_FORMATS.UNSUPPORTED_VERSION) {
    if (value?.product !== COMPLETE_BACKUP_PRODUCT) {
      return ['product must be TradeScope'];
    }
    return ['unsupported backupVersion'];
  }

  if (format === COMPLETE_BACKUP_FORMATS.V1 || format === COMPLETE_BACKUP_FORMATS.V2) {
    if (value.product !== COMPLETE_BACKUP_PRODUCT) errors.push('product must be TradeScope');
    if (value.backupVersion !== (format === COMPLETE_BACKUP_FORMATS.V1 ? 1 : 2)) errors.push('backupVersion does not match format');
    if (!isIso8601Timestamp(value.exportedAt)) errors.push('exportedAt must be an ISO-8601 timestamp');
    requireRecord(value.data, 'data');

    if (isPlainRecord(value.data)) {
      requireRecord(value.data.monthly, 'data.monthly');
      requireRecord(value.data.initialFunds, 'data.initialFunds');
      requireRecord(value.data.initialUnrealized, 'data.initialUnrealized');
      requireRecordArray(value.data.transactions, 'data.transactions');
      requireRecordArray(value.data.memos, 'data.memos');
      requireStringArray(value.data.symbols, 'data.symbols');

      if (hasOwn(value.data, 'legacy')) {
        requireRecord(value.data.legacy, 'data.legacy');
        if (isPlainRecord(value.data.legacy) && hasOwn(value.data.legacy, 'tradeInfo')) {
          requireRecordArray(value.data.legacy.tradeInfo, 'data.legacy.tradeInfo');
        }
      }
    }

    if (hasOwn(value, 'source')) {
      requireRecord(value.source, 'source');
      if (isPlainRecord(value.source) && hasOwn(value.source, 'origin') && typeof value.source.origin !== 'string') {
        errors.push('source.origin must be a string');
      }
    }
    if (format === COMPLETE_BACKUP_FORMATS.V2) {
      const onlyFields = (target, allowed) => isPlainRecord(target) && Object.keys(target).every(key => allowed.includes(key));
      if (!onlyFields(value, ['product', 'backupVersion', 'exportedAt', 'source', 'data'])
        || !onlyFields(value.data, ['monthly', 'initialFunds', 'initialUnrealized', 'transactions', 'memos', 'symbols', 'legacy', 'models'])
        || (hasOwn(value, 'source') && !onlyFields(value.source, ['origin']))
        || (hasOwn(value.data || {}, 'legacy') && !onlyFields(value.data.legacy, ['tradeInfo']))) errors.push('v2 contains unsupported fields');
      try { backupDataStorage.validateModels(value.data?.models); }
      catch (_) { errors.push('data.models has invalid schema, fields, IDs or references'); }
    }
  }

  if (format === COMPLETE_BACKUP_FORMATS.LEGACY_ALL) {
    if (!isIso8601Timestamp(value.exportedAt)) errors.push('exportedAt must be an ISO-8601 timestamp');
    requireRecord(value.profitData, 'profitData');
    requireRecord(value.historyData, 'historyData');
    if (isPlainRecord(value.profitData)) {
      requireRecord(value.profitData.tradingData, 'profitData.tradingData');
      requireRecord(value.profitData.yearInitialFunds, 'profitData.yearInitialFunds');
      if (hasOwn(value.profitData, 'yearInitialUnrealized')) {
        requireRecord(value.profitData.yearInitialUnrealized, 'profitData.yearInitialUnrealized');
      }
    }
    if (isPlainRecord(value.historyData)) requireRecordArray(value.historyData.entries, 'historyData.entries');
  }

  if (format === COMPLETE_BACKUP_FORMATS.LEGACY_PROFIT) {
    if (!isIso8601Timestamp(value.exportedAt)) errors.push('exportedAt must be an ISO-8601 timestamp');
    requireRecord(value.tradingData, 'tradingData');
    requireRecord(value.yearInitialFunds, 'yearInitialFunds');
    if (hasOwn(value, 'yearInitialUnrealized')) {
      requireRecord(value.yearInitialUnrealized, 'yearInitialUnrealized');
    }
  }

  if (format === COMPLETE_BACKUP_FORMATS.LEGACY_HISTORY) {
    if (!isIso8601Timestamp(value.exportedAt)) errors.push('exportedAt must be an ISO-8601 timestamp');
    requireRecordArray(value.entries, 'entries');
  }

  return errors;
}

function normalizeBackupValue(value, format = detectBackupFormat(value)) {
  const emptyCoverage = {
    monthly: false,
    initialFunds: false,
    initialUnrealized: false,
    transactions: false,
    memos: false,
    symbols: false,
    legacyTradeInfo: false
  };
  const normalized = {
    format,
    exportedAt: typeof value?.exportedAt === 'string' ? value.exportedAt : '',
    restoreMode: [COMPLETE_BACKUP_FORMATS.V1, COMPLETE_BACKUP_FORMATS.V2].includes(format) ? 'complete' : 'legacy-partial',
    coverage: { ...emptyCoverage },
    data: {},
    warnings: []
  };

  if (format === COMPLETE_BACKUP_FORMATS.V1 || format === COMPLETE_BACKUP_FORMATS.V2) {
    const data = isPlainRecord(value.data) ? value.data : {};
    const legacy = isPlainRecord(data.legacy) ? data.legacy : {};
    normalized.coverage = {
      monthly: true,
      initialFunds: true,
      initialUnrealized: true,
      transactions: true,
      memos: true,
      symbols: true,
      legacyTradeInfo: hasOwn(legacy, 'tradeInfo')
    };
    normalized.data = {
      monthly: data.monthly,
      initialFunds: data.initialFunds,
      initialUnrealized: data.initialUnrealized,
      transactions: data.transactions,
      memos: data.memos,
      symbols: data.symbols,
      legacy: normalized.coverage.legacyTradeInfo ? { tradeInfo: legacy.tradeInfo } : {}
    };
    if (format === COMPLETE_BACKUP_FORMATS.V2) normalized.data.models = data.models;
    else normalized.warnings.push('v1に含まれない新モデルの現在値を維持する');
    if (!normalized.coverage.legacyTradeInfo) {
      normalized.warnings.push('バックアップにLegacy tradeInfoがないため、現在値を維持する');
    }
    return normalized;
  }

  if (format === COMPLETE_BACKUP_FORMATS.LEGACY_ALL) {
    const profitData = isPlainRecord(value.profitData) ? value.profitData : {};
    const historyData = isPlainRecord(value.historyData) ? value.historyData : {};
    normalized.coverage.monthly = true;
    normalized.coverage.initialFunds = true;
    normalized.coverage.initialUnrealized = hasOwn(profitData, 'yearInitialUnrealized');
    normalized.coverage.transactions = true;
    normalized.data = {
      monthly: profitData.tradingData,
      initialFunds: profitData.yearInitialFunds,
      transactions: historyData.entries
    };
    if (normalized.coverage.initialUnrealized) {
      normalized.data.initialUnrealized = profitData.yearInitialUnrealized;
    }
    normalized.warnings.push('Legacy統合バックアップに含まれないMemo・銘柄リスト等は維持する');
    return normalized;
  }

  if (format === COMPLETE_BACKUP_FORMATS.LEGACY_PROFIT) {
    normalized.coverage.monthly = true;
    normalized.coverage.initialFunds = true;
    normalized.coverage.initialUnrealized = hasOwn(value, 'yearInitialUnrealized');
    normalized.data = {
      monthly: value.tradingData,
      initialFunds: value.yearInitialFunds
    };
    if (normalized.coverage.initialUnrealized) {
      normalized.data.initialUnrealized = value.yearInitialUnrealized;
    }
    normalized.warnings.push('Legacy損益バックアップに含まれない項目は維持する');
    return normalized;
  }

  if (format === COMPLETE_BACKUP_FORMATS.LEGACY_HISTORY) {
    normalized.coverage.transactions = true;
    normalized.data = { transactions: value.entries };
    normalized.warnings.push('Legacy履歴バックアップに含まれない項目は維持する');
  }

  return normalized;
}

function buildBackupRestorePlan(normalized) {
  const mappings = [
    ['monthly', 'tradingData', normalized.data.monthly],
    ['initialFunds', 'yearInitialFunds', normalized.data.initialFunds],
    ['initialUnrealized', 'yearInitialUnrealized', normalized.data.initialUnrealized],
    ['transactions', 'tradeScopeTradeHistoryV1', normalized.data.transactions],
    ['memos', 'tradeScopeMemos', normalized.data.memos],
    ['symbols', 'tradeScopeSymbolListV1', normalized.data.symbols],
    ['legacyTradeInfo', 'tradeInfo', normalized.data.legacy?.tradeInfo]
  ];

  const operations = mappings.filter(([coverageKey]) => normalized.coverage[coverageKey])
    .map(([, storageKey, value]) => ({ type: 'set', storageKey, value }));
  if (normalized.format === COMPLETE_BACKUP_FORMATS.V2) {
    Object.entries(backupDataStorage.keys).forEach(([entity, storageKey]) => {
      const value = normalized.data.models[entity];
      operations.push(value === null ? { type: 'remove', storageKey } : { type: 'set', storageKey, value });
    });
  }
  return {
    format: normalized.format,
    exportedAt: normalized.exportedAt,
    mode: normalized.restoreMode,
    preserveUnspecified: normalized.restoreMode === 'legacy-partial',
    operations,
    warnings: [...normalized.warnings]
  };
}

function inspectBackupValue(value) {
  const format = detectBackupFormat(value);
  if (format === COMPLETE_BACKUP_FORMATS.INVALID || format === COMPLETE_BACKUP_FORMATS.UNSUPPORTED_VERSION) {
    return { ok: false, format, errors: validateBackupValue(value, format) };
  }

  const errors = validateBackupValue(value, format);
  if (errors.length) return { ok: false, format, errors };
  const normalized = normalizeBackupValue(value, format);

  return {
    ok: true,
    format,
    normalized,
    restorePlan: buildBackupRestorePlan(normalized)
  };
}

function inspectBackupJson(jsonText) {
  if (typeof jsonText !== 'string') {
    return { ok: false, format: COMPLETE_BACKUP_FORMATS.INVALID, errors: ['backup JSON must be a string'] };
  }
  try {
    return inspectBackupValue(JSON.parse(jsonText));
  } catch {
    return { ok: false, format: COMPLETE_BACKUP_FORMATS.INVALID, errors: ['invalid JSON'] };
  }
}

window.TradeScopeBackupFormat = Object.freeze({
  product: COMPLETE_BACKUP_PRODUCT,
  currentVersion: COMPLETE_BACKUP_VERSION,
  formats: COMPLETE_BACKUP_FORMATS,
  detect: detectBackupFormat,
  validate: validateBackupValue,
  normalize: normalizeBackupValue,
  buildRestorePlan: buildBackupRestorePlan,
  inspectValue: inspectBackupValue,
  inspectJson: inspectBackupJson
});

// ===== Safe Restore Transaction =====
function getBackupFormatLabel(format) {
  const labels = {
    [COMPLETE_BACKUP_FORMATS.V1]: '完全バックアップv1',
    [COMPLETE_BACKUP_FORMATS.V2]: '完全バックアップv2',
    [COMPLETE_BACKUP_FORMATS.LEGACY_ALL]: '旧統合バックアップ',
    [COMPLETE_BACKUP_FORMATS.LEGACY_PROFIT]: '旧損益バックアップ',
    [COMPLETE_BACKUP_FORMATS.LEGACY_HISTORY]: '旧履歴バックアップ'
  };
  return labels[format] || '不明な形式';
}

function describeBackupRestore(inspection) {
  const restoredKeys = inspection.restorePlan.operations.map((operation) => operation.storageKey);
  const restoredKeySet = new Set(restoredKeys);
  const preservedKeys = COMPLETE_BACKUP_PRIMARY_STORAGE_KEYS.filter((key) => !restoredKeySet.has(key));
  return {
    formatLabel: getBackupFormatLabel(inspection.format),
    exportedAt: inspection.normalized.exportedAt,
    modeLabel: inspection.restorePlan.mode === 'complete' ? '完全復元' : 'Legacy部分復元',
    restoredKeys,
    preservedKeys,
    warnings: [...inspection.restorePlan.warnings]
  };
}

const backupRestoreModal = document.getElementById('backupRestoreModal');
const backupRestoreDialog = document.getElementById('backupRestoreDialog');
const backupRestoreTitle = document.getElementById('backupRestoreTitle');
const backupRestoreDate = document.getElementById('backupRestoreDate');
const backupRestoreDescription = document.getElementById('backupRestoreDescription');
const backupRestoreLegacyNote = document.getElementById('backupRestoreLegacyNote');
const cancelBackupRestoreBtn = document.getElementById('cancelBackupRestoreBtn');
const confirmBackupRestoreBtn = document.getElementById('confirmBackupRestoreBtn');
let backupRestoreDialogResolve = null;
let backupRestoreReturnFocus = null;

function formatBackupExportedAt(exportedAt) {
  const date = new Date(exportedAt);
  if (!Number.isFinite(date.getTime())) return '日時情報のないバックアップ';
  const formatted = new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date);
  return `${formatted} のバックアップ`;
}

function closeBackupRestoreDialog(confirmed = false) {
  if (!backupRestoreModal || backupRestoreModal.getAttribute('aria-hidden') !== 'false') return;

  backupRestoreModal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('backup-restore-open');

  const resolve = backupRestoreDialogResolve;
  const returnFocus = backupRestoreReturnFocus;
  backupRestoreDialogResolve = null;
  backupRestoreReturnFocus = null;

  if (returnFocus instanceof HTMLElement) {
    requestAnimationFrame(() => returnFocus.focus());
  }
  resolve?.(confirmed);
}

function showBackupRestoreDialog({
  title,
  dateText = '',
  description,
  note = '',
  confirmLabel,
  showCancel = true
}) {
  if (!backupRestoreModal || !backupRestoreDialog || !backupRestoreTitle
    || !backupRestoreDate || !backupRestoreDescription || !backupRestoreLegacyNote
    || !cancelBackupRestoreBtn || !confirmBackupRestoreBtn) {
    return Promise.resolve(false);
  }

  backupRestoreTitle.textContent = title;
  backupRestoreDate.textContent = dateText;
  backupRestoreDate.hidden = !dateText;
  backupRestoreDescription.textContent = description;
  backupRestoreLegacyNote.textContent = note;
  backupRestoreLegacyNote.hidden = !note;
  confirmBackupRestoreBtn.textContent = confirmLabel;
  cancelBackupRestoreBtn.hidden = !showCancel;
  backupRestoreReturnFocus = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : document.getElementById('importAllDataBtn');

  backupRestoreModal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('backup-restore-open');

  return new Promise((resolve) => {
    backupRestoreDialogResolve = resolve;
    const initialFocusTarget = showCancel ? cancelBackupRestoreBtn : confirmBackupRestoreBtn;
    requestAnimationFrame(() => {
      setTimeout(() => {
        if (backupRestoreModal.getAttribute('aria-hidden') === 'false' && !initialFocusTarget.hidden) {
          initialFocusTarget.focus();
        }
      }, 100);
    });
  });
}

function requestBackupRestoreConfirmation(inspection) {
  const isLegacy = inspection.restorePlan.mode === 'legacy-partial';
  return showBackupRestoreDialog({
    title: 'バックアップを復元',
    dateText: formatBackupExportedAt(inspection.normalized.exportedAt),
    description: '現在のデータを、このバックアップの内容に置き換えます。',
    note: isLegacy ? 'このバックアップに含まれるデータのみ復元します。' : '',
    confirmLabel: '復元',
    showCancel: true
  });
}

function showBackupRestoreComplete() {
  return showBackupRestoreDialog({
    title: 'バックアップを復元しました',
    description: 'バックアップの内容を反映しました。',
    confirmLabel: '閉じる',
    showCancel: false
  });
}

cancelBackupRestoreBtn?.addEventListener('click', () => closeBackupRestoreDialog(false));
confirmBackupRestoreBtn?.addEventListener('click', () => closeBackupRestoreDialog(true));
backupRestoreModal?.addEventListener('click', (event) => {
  if (event.target === backupRestoreModal) closeBackupRestoreDialog(false);
});
document.addEventListener('keydown', (event) => {
  if (backupRestoreModal?.getAttribute('aria-hidden') !== 'false') return;
  if (event.key === 'Escape') {
    event.preventDefault();
    closeBackupRestoreDialog(false);
    return;
  }
  if (event.key !== 'Tab') return;

  const focusable = [cancelBackupRestoreBtn, confirmBackupRestoreBtn]
    .filter((element) => element && !element.hidden && !element.disabled);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (!focusable.includes(document.activeElement)) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  } else if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});

function buildRestoreConfirmationMessage(inspection) {
  const description = describeBackupRestore(inspection);
  const restoredLabels = description.restoredKeys.map((key) => COMPLETE_BACKUP_STORAGE_LABELS[key] || key);
  const preservedLabels = description.preservedKeys.map((key) => COMPLETE_BACKUP_STORAGE_LABELS[key] || key);
  const lines = [
    'バックアップを復元します。内容を確認してください。',
    '',
    `形式: ${description.formatLabel}`,
    `出力日時: ${description.exportedAt || '不明'}`,
    `方式: ${description.modeLabel}`,
    `復元するデータ: ${restoredLabels.join('、') || 'なし'}`,
    `維持するデータ: ${preservedLabels.join('、') || 'なし'}`
  ];
  if (description.warnings.length) {
    lines.push('', '警告:', ...description.warnings.map((warning) => `・${warning}`));
  }
  lines.push('', '復元を開始しますか？');
  return lines.join('\n');
}

function isEmptyPlainRecord(value) {
  return isPlainRecord(value) && Object.keys(value).length === 0;
}

function prepareBackupRestoreActions(restorePlan, storage) {
  if (!isPlainRecord(restorePlan) || !Array.isArray(restorePlan.operations)
    || !Object.values(COMPLETE_BACKUP_FORMATS).filter(format => !['invalid', 'unsupported-version'].includes(format)).includes(restorePlan.format)) {
    throw new Error('復元対象が不正です');
  }
  const actions = restorePlan.operations.map((operation) => {
    if (!isPlainRecord(operation) || !COMPLETE_BACKUP_PRIMARY_STORAGE_KEYS.includes(operation.storageKey)) throw new Error('復元キーが不正です');
    const entity = Object.keys(backupDataStorage.keys).find(name => backupDataStorage.keys[name] === operation.storageKey);
    if (operation.type === 'remove') {
      if (!entity || restorePlan.format !== COMPLETE_BACKUP_FORMATS.V2) throw new Error('復元対象の削除が不正です');
      return { type: 'remove', storageKey: operation.storageKey };
    }
    if (operation.type !== 'set') throw new Error('復元操作が不正です');
    backupDataStorage.assertJson(operation.value);
    if (entity) {
      if (restorePlan.format !== COMPLETE_BACKUP_FORMATS.V2 || operation.value === null) throw new Error('復元モデルが不正です');
      backupDataStorage.validateEnvelope(entity, operation.value);
    } else {
      const arrays = ['tradeScopeTradeHistoryV1', 'tradeScopeMemos', 'tradeScopeSymbolListV1', 'tradeInfo'];
      if (arrays.includes(operation.storageKey)) {
        if (!Array.isArray(operation.value) || operation.value.some(item => operation.storageKey === 'tradeScopeSymbolListV1'
          ? typeof item !== 'string' : !isPlainRecord(item))) throw new Error('復元データの型が不正です');
      } else if (!isPlainRecord(operation.value)) throw new Error('復元データの型が不正です');
    }
    const rawValue = JSON.stringify(operation.value);
    if (typeof rawValue !== 'string') {
      throw new Error(`${operation.storageKey} could not be serialized`);
    }
    return { type: 'set', storageKey: operation.storageKey, rawValue };
  });

  const actionKeys = new Set(actions.map((action) => action.storageKey));
  if (actionKeys.size !== actions.length) throw new Error('restore plan contains duplicate storage keys');
  const requiredByFormat = {
    [COMPLETE_BACKUP_FORMATS.V1]: COMPLETE_BACKUP_PRIMARY_STORAGE_KEYS.slice(0, 6),
    [COMPLETE_BACKUP_FORMATS.V2]: COMPLETE_BACKUP_PRIMARY_STORAGE_KEYS.filter(key => key !== 'tradeInfo'),
    [COMPLETE_BACKUP_FORMATS.LEGACY_ALL]: ['tradingData', 'yearInitialFunds', 'tradeScopeTradeHistoryV1'],
    [COMPLETE_BACKUP_FORMATS.LEGACY_PROFIT]: ['tradingData', 'yearInitialFunds'],
    [COMPLETE_BACKUP_FORMATS.LEGACY_HISTORY]: ['tradeScopeTradeHistoryV1']
  };
  if (requiredByFormat[restorePlan.format].some(key => !actionKeys.has(key))) throw new Error('復元対象が不足しています');
  if (restorePlan.format === COMPLETE_BACKUP_FORMATS.LEGACY_HISTORY && actionKeys.size !== 1) throw new Error('復元対象が不正です');
  if ([COMPLETE_BACKUP_FORMATS.LEGACY_PROFIT, COMPLETE_BACKUP_FORMATS.LEGACY_ALL].includes(restorePlan.format)
    && actions.some(action => !['tradingData', 'yearInitialFunds', 'yearInitialUnrealized',
      ...(restorePlan.format === COMPLETE_BACKUP_FORMATS.LEGACY_ALL ? ['tradeScopeTradeHistoryV1'] : [])].includes(action.storageKey))) {
    throw new Error('復元対象が不正です');
  }
  if (restorePlan.format === COMPLETE_BACKUP_FORMATS.V2) {
    const models = {};
    for (const [entity, key] of Object.entries(backupDataStorage.keys)) {
      const operation = restorePlan.operations.find(item => item.storageKey === key);
      if (!operation) throw new Error('復元モデルが不足しています');
      models[entity] = operation.type === 'remove' ? null : operation.value;
    }
    backupDataStorage.validateModels(models);
  }

  const profitKeys = [
    PROFIT_STORAGE_KEY_TRADING,
    PROFIT_STORAGE_KEY_INITIAL,
    PROFIT_STORAGE_KEY_INITIAL_UNREALIZED
  ];
  const restoresProfitData = profitKeys.some((key) => actionKeys.has(key));
  if (restoresProfitData) {
    const effectiveProfitValues = profitKeys.map((key) => {
      const planned = actions.find((action) => action.storageKey === key);
      const rawValue = planned ? planned.rawValue : storage.getItem(key);
      if (rawValue === null) return {};
      try {
        return JSON.parse(rawValue);
      } catch {
        return null;
      }
    });
    const restoresEmptyProfitData = effectiveProfitValues.every(isEmptyPlainRecord);
    if (restoresEmptyProfitData && storage.getItem(COMPLETE_BACKUP_SKIP_DEMO_KEY) !== '1') {
      actions.push({ type: 'set', storageKey: COMPLETE_BACKUP_SKIP_DEMO_KEY, rawValue: '1' });
    }
  }

  actions.push({ type: 'remove', storageKey: PROFIT_STORAGE_KEY_TOP_SUMMARY_SNAPSHOT });
  return actions;
}

function recoverPendingBackupRestore(storage) {
  return backupStorageTransaction.recover(storage);
}

function executeBackupRestore(restorePlan, storage) {
  const actions = prepareBackupRestoreActions(restorePlan, storage);
  backupStorageTransaction.apply(actions, storage);
  return {
    restoredKeys: restorePlan.operations.map((operation) => operation.storageKey),
    snapshotInvalidated: true,
    demoSeedSuppressed: actions.some((action) => action.storageKey === COMPLETE_BACKUP_SKIP_DEMO_KEY)
  };
}

window.TradeScopeBackupRestore = Object.freeze({
  journalKey: COMPLETE_BACKUP_RESTORE_JOURNAL_KEY,
  describe: describeBackupRestore,
  buildConfirmationMessage: buildRestoreConfirmationMessage,
  prepareActions: prepareBackupRestoreActions,
  execute: executeBackupRestore,
  recoverPending: recoverPendingBackupRestore
});

// ===== Complete Backup v2 Export =====
function readStoredBackupValue(storageKey, fallbackValue, expectedType, storage = localStorage) {
  const raw = storage.getItem(storageKey);
  if (raw === null) return fallbackValue;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`${storageKey} is not valid JSON`);
  }

  const valid = expectedType === 'array' ? Array.isArray(parsed) : isPlainRecord(parsed);
  if (!valid) throw new Error(`${storageKey} has an invalid data type`);
  return parsed;
}

function buildCompleteBackupPayload(storage = localStorage, origin = window.location.origin, exportedAt = new Date().toISOString()) {
  const legacy = {};
  if (storage.getItem('tradeInfo') !== null) {
    legacy.tradeInfo = readStoredBackupValue('tradeInfo', [], 'array', storage);
  }

  return {
    product: COMPLETE_BACKUP_PRODUCT,
    backupVersion: COMPLETE_BACKUP_VERSION,
    exportedAt,
    source: {
      origin
    },
    data: {
      monthly: readStoredBackupValue(PROFIT_STORAGE_KEY_TRADING, {}, 'object', storage),
      initialFunds: readStoredBackupValue(PROFIT_STORAGE_KEY_INITIAL, {}, 'object', storage),
      initialUnrealized: readStoredBackupValue(PROFIT_STORAGE_KEY_INITIAL_UNREALIZED, {}, 'object', storage),
      transactions: readStoredBackupValue('tradeScopeTradeHistoryV1', [], 'array', storage),
      memos: readStoredBackupValue('tradeScopeMemos', [], 'array', storage),
      symbols: readStoredBackupValue('tradeScopeSymbolListV1', [], 'array', storage),
      legacy,
      models: backupDataStorage.readModels(storage)
    }
  };
}

window.TradeScopeBackupExport = Object.freeze({ buildPayload: buildCompleteBackupPayload });

function exportAllData() {
  let payload;
  try {
    payload = buildCompleteBackupPayload();
    const inspection = inspectBackupValue(payload);
    if (!inspection.ok) throw new Error(inspection.errors.join('; '));
  } catch (error) {
    console.error('Complete backup export error:', error);
    alert('完全バックアップを作成できませんでした。保存データの形式を確認してください。');
    return;
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `tradescope-complete-backup-v${COMPLETE_BACKUP_VERSION}-${timestamp}.json`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function importAllData(file) {
  if (!file) return;

  if (localStorage.getItem(COMPLETE_BACKUP_RESTORE_JOURNAL_KEY) !== null) {
    const shouldRecover = confirm('前回中断された復元のジャーナルがあります。新しい復元を始める前に、復元前の状態へ戻しますか？');
    if (!shouldRecover) return;
    try {
      recoverPendingBackupRestore(localStorage);
      alert('前回の復元前の状態へ戻しました。もう一度バックアップファイルを選択してください。');
    } catch (error) {
      console.error('Restore journal recovery error:', error);
      alert('復元ジャーナルから元の状態へ戻せませんでした。新しい復元は開始していません。');
    }
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const inspection = inspectBackupJson(String(e.target.result));
      if (!inspection.ok) {
        const detail = inspection.errors.join('\n');
        alert(`バックアップを読み込めません。\n${detail}`);
        return;
      }

      if (!await requestBackupRestoreConfirmation(inspection)) return;

      executeBackupRestore(inspection.restorePlan, localStorage);
      await showBackupRestoreComplete();
      window.location.reload();
    } catch (error) {
      console.error('Import error:', error);
      alert(error.message || 'バックアップの復元に失敗しました。');
    }
  };
  reader.onerror = () => {
    alert('バックアップファイルを読み込めませんでした。');
  };
  reader.readAsText(file);
}

window.addEventListener('storage', (event) => {
  if (!historyCore?.STORAGE_KEY) return;
  if (event.key !== historyCore.STORAGE_KEY) return;
  updateRiskSection();
  renderCurrentPortfolioSection();
});

// Backup button listeners
document.getElementById('exportAllDataBtn')?.addEventListener('click', exportAllData);
document.getElementById('importAllDataBtn')?.addEventListener('click', () => {
  document.getElementById('importAllDataInput')?.click();
});
document.getElementById('importAllDataInput')?.addEventListener('change', (e) => {
  importAllData(e.target.files[0]);
  e.target.value = '';
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeYearSelector);
} else {
  initializeYearSelector();
}
