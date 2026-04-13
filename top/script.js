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
const globalTicker = [
  'ドルは主要通貨に対して小幅高。',
  '円は安全資産として買い戻し優勢。',
  'ユーロは景気懸念で上値重い。',
  'トルコリラは中銀会合を控え小動き。',
  'メキシコペソは高金利を背景に堅調。'
];
const countryNews = {
  USD: ['米CPI発表を控えドル小動き。', 'FOMCメンバーの発言に注目。'],
  JPY: ['日銀は賃金動向を注視。', '輸出の持ち直しで円買い。'],
  EUR: ['ECB理事会議事要旨を公表。', '域内PMIはまちまちの結果。'],
  GBP: ['BOEの物価見通し発表へ。', '英小売売上は横ばい。'],
  TRY: ['トルコ中銀は金利据え置き見通し。', 'インフレ鈍化の兆し。']
};
function mountTicker(trackEl, items) {
  if (!trackEl) return;
  const tickerItems = (items && items.length ? items : ['ニュースはありません']).concat(items && items.length ? items : ['ニュースはありません']);
  trackEl.innerHTML = tickerItems.map(t => `<span class="ticker-item">${t}</span>`).join('');
  trackEl.style.animation = 'none';
  void trackEl.offsetHeight;
  trackEl.style.animation = '';
}
mountTicker(document.getElementById('globalTickerTrack'), globalTicker);
const sel = document.getElementById('countrySelect');
function refreshCountryTicker() {
  const v = sel?.value || 'USD';
  mountTicker(document.getElementById('countryTickerTrack'), countryNews[v] || []);
}
sel?.addEventListener('change', refreshCountryTicker);
refreshCountryTicker();

function refreshAllTickers() {
  mountTicker(document.getElementById('globalTickerTrack'), globalTicker);
  refreshCountryTicker();
}

window.addEventListener('pageshow', refreshAllTickers);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) refreshAllTickers();
});

// ===== Demo Data =====
const demoMonthly = {
  realized: [500,520,540,560,580,600,610,620,640,660,680,700],
  total: [510,535,555,575,590,615,625,640,665,690,705,730]
};
const PROFIT_STORAGE_KEY_TRADING = 'tradingData';
const PROFIT_STORAGE_KEY_INITIAL = 'yearInitialFunds';
const PROFIT_STORAGE_KEY_INITIAL_UNREALIZED = 'yearInitialUnrealized';
const SHARED_SELECTED_YEAR_KEY = 'tradeScopeSelectedYear';
const profitMetrics = window.TradeScopeProfitMetrics;
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
  const monthData = yearData?.[month] || yearData?.[String(month)] || {};
  return LINKED_ACCOUNTS.reduce((acc, account) => {
    const row = monthData?.[account.key] || {};
    acc.realized += Number(row.realizedPnL) || 0;
    acc.swap += Number(row.swapPnL) || 0;
    return acc;
  }, { realized: 0, swap: 0 });
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
    realized += Number(row.realizedPnL) || 0;
    swap += Number(row.swapPnL) || 0;
    deposit += Number(row.deposit) || 0;
    withdrawal += Number(row.withdrawal) || 0;
  }

  return initial + realized + swap + deposit - withdrawal;
}

function calculateLinkedAccountNetAssets(tradingData, initialFunds, year, targetMonth, accountKey) {
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
    realized += Number(row.realizedPnL) || 0;
    swap += Number(row.swapPnL) || 0;
    deposit += Number(row.deposit) || 0;
    withdrawal += Number(row.withdrawal) || 0;
  }

  const currentRow = yearData?.[targetMonth]?.[accountKey] || yearData?.[String(targetMonth)]?.[accountKey] || {};
  const unrealized = Number(currentRow.unrealizedPnL) || 0;

  return initial + realized + swap + deposit - withdrawal + unrealized;
}

function hasMeaningfulMonthData(yearData, month) {
  const monthData = yearData?.[month] || yearData?.[String(month)];
  if (!monthData) return false;
  if (monthData.__saved) return true;

  return LINKED_ACCOUNTS.some((account) => {
    const row = monthData?.[account.key] || {};
    return (Number(row.realizedPnL) || 0) !== 0
      || (Number(row.swapPnL) || 0) !== 0
      || (Number(row.unrealizedPnL) || 0) !== 0
      || (Number(row.deposit) || 0) !== 0
      || (Number(row.withdrawal) || 0) !== 0
      || (Number(row.maintenanceRate) || 0) !== 0
      || (Array.isArray(row.unrealizedLegs) && row.unrealizedLegs.length > 0)
      || Object.prototype.hasOwnProperty.call(row, 'monthEndBalance');
  });
}

function buildTopLinkedData(selectedYear = null) {
  const tradingData = parseStoredJson(PROFIT_STORAGE_KEY_TRADING);
  const initialFunds = parseStoredJson(PROFIT_STORAGE_KEY_INITIAL);
  const initialUnrealized = parseStoredJson(PROFIT_STORAGE_KEY_INITIAL_UNREALIZED);
  const years = getNumericYears(tradingData);
  if (!years.length) return null;

  const targetYear = selectedYear || years[years.length - 1];
  const growthAccounts = GROWTH_TARGET_ACCOUNTS;
  const latestMonth = (() => {
    const yearData = tradingData?.[targetYear] || tradingData?.[String(targetYear)] || {};
    for (let month = 12; month >= 1; month -= 1) {
      if (hasMeaningfulMonthData(yearData, month)) return month;
    }
    return 1;
  })();
  const realized = [];
  const total = [];
  let cumulativeDeposits = 0;
  let cumulativeWithdrawals = 0;

  for (let month = 1; month <= 12; month += 1) {
    const confirmedTotal = LINKED_ACCOUNTS.reduce((sum, account) => {
      return sum + calculateLinkedAccountConfirmedAssets(tradingData, initialFunds, targetYear, month, account.key);
    }, 0);
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

    const monthTotal = LINKED_ACCOUNTS.reduce((sum, account) => {
      return sum + calculateLinkedAccountNetAssets(tradingData, initialFunds, targetYear, month, account.key);
    }, 0);
    total.push(monthTotal);
  }

  const linkedAccountData = LINKED_ACCOUNTS.map((account) => ({
    label: account.name,
    amount: Math.max(0, calculateLinkedAccountNetAssets(tradingData, initialFunds, targetYear, latestMonth, account.key)),
    color: account.color
  })).filter((item) => item.amount > 0);

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

  const growthCurrentTotal = growthAccounts.reduce((sum, account) => {
    return sum + calculateLinkedAccountNetAssets(tradingData, initialFunds, targetYear, latestMonth, account.key);
  }, 0);

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

const demoTotal = demoMonthly.total.map((v) => v * 10000);
const fallbackTopData = {
  realized: demoMonthly.realized.map((v) => v * 10000),
  total: demoTotal,
  accountData: null,
  yearStartTotal: demoTotal[0],
  yearStartConfirmed: demoMonthly.realized[0] * 10000,
  growthCurrentTotal: demoTotal[demoTotal.length - 1],
  growthCurrentConfirmed: demoMonthly.realized[demoMonthly.realized.length - 1] * 10000,
  chartStartTotal: demoTotal[0],
  chartStartTotalWithUnrealized: demoTotal[0],
  cumulativeDeposits: 0,
  cumulativeWithdrawals: 0
};
const linkedTopData = buildTopLinkedData();
let topSeries = linkedTopData || fallbackTopData;
const lotsByPair = { TRY:300, HUF:200, MXN:150, ZAR:80 };
const risk = { zero:-3280000, half:-1640000, mmr:265 };
const swapToday = { total:12300, pairs:[['TRY',7800],['HUF',2900],['MXN',1600]] };
const swapYearForecast = 532000;

// ===== Portfolio Data =====
let accountData = topSeries.accountData?.length ? topSeries.accountData : [];

const fallbackPortfolioData = [
  { label: 'FX', amount: 4560000, color: '#3B6DFF' },
  { label: '暗号資産', amount: 568000, color: '#EAF1FF' },
  { label: '証券', amount: 1260000, color: '#D95757' },
  { label: '現金', amount: 710000, color: '#2F7A46' },
  { label: 'その他', amount: 202000, color: '#7E7A98' }
];

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

  return data.length ? data : fallbackPortfolioData;
}

let portfolioData = buildPortfolioAllocationFromAccounts(accountData);

function updateRiskSection() {
  const maxEl = document.getElementById('riskMaxLoss');
  const fxOneEl = document.getElementById('riskFxOne');
  const fxZeroEl = document.getElementById('riskFxZero');
  const cryptoZeroEl = document.getElementById('riskCryptoZero');
  const noteEl = document.getElementById('riskNote');
  if (!maxEl || !fxOneEl || !fxZeroEl || !cryptoZeroEl) return;

  if (!historyCore?.calculateRiskSummary || !historyCore?.parseEntries) {
    [maxEl, fxOneEl, fxZeroEl, cryptoZeroEl].forEach((el) => { el.textContent = '-'; });
    return;
  }

  const entries = historyCore.parseEntries();
  const cryptoValue = accountData.find((item) => item.label === 'SBI VC')?.amount || 0;
  const riskSummary = historyCore.calculateRiskSummary(entries, cryptoValue);

  const fxOneDisplayLoss = (riskSummary.fxOneYenLoss || 0) + (riskSummary.fxHufPointOneLoss || 0);
  const maxLoss = Math.abs(riskSummary.maxLoss || 0);
  const fxOneLoss = Math.abs(fxOneDisplayLoss || 0);
  const fxZeroLoss = Math.abs(riskSummary.fxZeroYenLoss || 0);
  const cryptoZeroLoss = Math.abs(riskSummary.cryptoZeroYenLoss || 0);

  maxEl.textContent = fmtJPY(maxLoss);
  fxOneEl.textContent = fmtJPY(fxOneLoss);
  fxZeroEl.textContent = fmtJPY(fxZeroLoss);
  cryptoZeroEl.textContent = fmtJPY(cryptoZeroLoss);

  if (noteEl) {
    noteEl.textContent = 'FX＋暗号資産 0円時';
  }
}

// ===== KPI =====
function updateKPIs() {
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
  elTotal.textContent = fmtJPY(tLast);

  const elReal = document.getElementById('kpiRealized');
  elReal.textContent = fmtJPY(rLast);

  const elNet = document.getElementById('growthNet');
  const yearStartTotalActual = topSeries.chartStartTotalWithUnrealized || 0;
  const yearStartConfirmedActual = topSeries.chartStartTotal || 0;
  const yearStartTotalPerformance = topSeries.yearStartTotal || 0;
  const yearStartConfirmedPerformance = topSeries.yearStartConfirmed || 0;
  const growthCurrentTotal = topSeries.growthCurrentTotal || tLast;
  const growthCurrentConfirmed = topSeries.growthCurrentConfirmed || rLast;
  const cumulativeDeposits = topSeries.cumulativeDeposits || 0;
  const cumulativeWithdrawals = topSeries.cumulativeWithdrawals || 0;

  const totalAssetDelta = tLast - yearStartTotalActual;
  const confirmedAssetDelta = rLast - yearStartConfirmedActual;
  const annualGrowthRate = yearStartTotalActual > 0 ? (totalAssetDelta / yearStartTotalActual) * 100 : 0;
  const confirmedAnnualGrowthRate = yearStartConfirmedActual > 0 ? (confirmedAssetDelta / yearStartConfirmedActual) * 100 : 0;

  const annualNetPnL = growthCurrentTotal - yearStartTotalPerformance - cumulativeDeposits + cumulativeWithdrawals;
  const annualConfirmedPnL = growthCurrentConfirmed - yearStartConfirmedPerformance - cumulativeDeposits + cumulativeWithdrawals;
  const annualNetPnLGrowth = yearStartTotalPerformance > 0 ? (annualNetPnL / yearStartTotalPerformance) * 100 : 0;
  const annualConfirmedPnLGrowth = yearStartConfirmedPerformance > 0 ? (annualConfirmedPnL / yearStartConfirmedPerformance) * 100 : 0;

  const elTotalDelta = document.getElementById('deltaTotal');
  const elNetDelta = document.getElementById('deltaNet');
  if (elTotalDelta) {
    elTotalDelta.textContent = fmtDeltaNumber(totalAssetDelta);
    setSignClass(elTotalDelta, totalAssetDelta);
  }
  if (elNetDelta) {
    elNetDelta.textContent = fmtDeltaNumber(confirmedAssetDelta);
    setSignClass(elNetDelta, confirmedAssetDelta);
  }

  elNet.textContent = (confirmedAnnualGrowthRate >= 0 ? '+' : '') + confirmedAnnualGrowthRate.toFixed(1) + '%';
  setSignClass(elNet, confirmedAnnualGrowthRate);

  const elTotalGrowth = document.getElementById('growthTotal');
  elTotalGrowth.textContent = (annualGrowthRate >= 0 ? '+' : '') + annualGrowthRate.toFixed(1) + '%';
  setSignClass(elTotalGrowth, annualGrowthRate);

  const elAnnualNetPnL = document.getElementById('annualNetPnL');
  const elAnnualConfirmedPnL = document.getElementById('annualConfirmedPnL');
  const elAnnualNetGrowth = document.getElementById('annualNetPnLGrowth');
  const elAnnualConfirmedGrowth = document.getElementById('annualConfirmedPnLGrowth');

  if (elAnnualNetPnL) {
    elAnnualNetPnL.textContent = fmtJPY(annualNetPnL);
    setSignClass(elAnnualNetPnL, annualNetPnL);
  }
  if (elAnnualConfirmedPnL) {
    elAnnualConfirmedPnL.textContent = fmtJPY(annualConfirmedPnL);
    setSignClass(elAnnualConfirmedPnL, annualConfirmedPnL);
  }
  if (elAnnualNetGrowth) {
    elAnnualNetGrowth.textContent = (annualNetPnLGrowth >= 0 ? '+' : '') + annualNetPnLGrowth.toFixed(1) + '%';
    setSignClass(elAnnualNetGrowth, annualNetPnLGrowth);
  }
  if (elAnnualConfirmedGrowth) {
    elAnnualConfirmedGrowth.textContent = (annualConfirmedPnLGrowth >= 0 ? '+' : '') + annualConfirmedPnLGrowth.toFixed(1) + '%';
    setSignClass(elAnnualConfirmedGrowth, annualConfirmedPnLGrowth);
  }
}
updateKPIs();

// ===== Swap =====
function updateSwap() {
  const elToday = document.getElementById('swapToday');
  elToday.textContent = fmtJPY(swapToday.total).replace('¥','');
  setSignClass(elToday, swapToday.total);
  document.getElementById('swapTodayPairs').innerHTML = swapToday.pairs.map(([p,v]) =>
    `<span class="${v>=0?'positive':'negative'}">${p}: ${fmtJPY(v).replace('¥','')}</span>`
  ).join(' · ');
  document.getElementById('swapYear').textContent = fmtJPY(swapYearForecast);
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

  let zeroLoss = 0;
  let halfLoss = 0;
  if (position?.assetType === 'FX') {
    zeroLoss = Math.max(0, -((0 - avgRateValue) * signedUnits));
    halfLoss = Math.max(0, -(((avgRateValue * 0.5) - avgRateValue) * signedUnits));
  } else {
    zeroLoss = marketValue;
    halfLoss = marketValue * 0.5;
  }

  const accountsText = Array.isArray(position?.accounts) && position.accounts.length
    ? position.accounts.join(' / ')
    : '情報なし';
  const noteText = `${position?.memo || 'メモなし'}\n口座: ${accountsText}`;
  const headlineValue = position?.assetType === 'FX' ? requiredMargin : marketValue;

  return {
    title: `${position?.symbol || '-'} (${position?.assetType || '-'})`,
    profit: fmtJPY(headlineValue),
    rate: '0.0%',
    lots: fmtQuantity(absQuantity),
    avg: fmtRate(avgRateValue),
    now: fmtRate(avgRateValue),
    mmr: '---',
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
    if (month > latestMonth) {
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
    const growthTotal = GROWTH_TARGET_ACCOUNTS.reduce((sum, account) => {
      return sum + calculateLinkedAccountNetAssets(tradingData, initialFunds, year, month, account.key);
    }, 0);

    confirmedSeries.push(growthConfirmed - yearStartConfirmed - cumulativeDeposits + cumulativeWithdrawals);
    totalSeries.push(growthTotal - yearStartTotal - cumulativeDeposits + cumulativeWithdrawals);
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
  const ctx = document.getElementById('perfChart')?.getContext('2d');
  if (!ctx) return;

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
    netBalanceSeries.push(month <= latestMonth ? topSeries.realized[month - 1] : null);
    totalEquitySeries.push(month <= latestMonth ? topSeries.total[month - 1] : null);
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
          pointRadius: 2
        },
        {
          label: equityLabel,
          data: activeTotalEquitySeries,
          borderColor: '#3EE08F',
          backgroundColor: gradGreen,
          fill: true,
          tension: 0.35,
          pointRadius: 2
        }
      ]
    },
    options: {
      maintainAspectRatio: false,
      responsive: true,
      animation: false,
      plugins: {
        laserReveal: { enabled: true },
        legend: { display: false },
        tooltip: {
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
  playLaserReveal(perfChart, isMobile ? 1520 : 1800);
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

// ===== Portfolio Chart & List =====
function renderPortfolio() {
  // Calculate total
  const total = portfolioData.reduce((sum, item) => sum + item.amount, 0);
  
  // Sort by amount (descending) - keep original data unchanged
  const sortedData = portfolioData.slice().sort((a, b) => b.amount - a.amount);
  
  // Render list
  const listContainer = document.getElementById('portfolioItems');
  if (listContainer) {
    listContainer.innerHTML = sortedData.map(item => {
      const pct = total > 0 ? ((item.amount / total) * 100).toFixed(1) : '0.0';
      return `
        <div class="portfolio-item" style="--item-color: ${item.color}">
          <span class="portfolio-label">${item.label}</span>
          <span class="portfolio-amount">${fmtJPY(item.amount)}</span>
          <span class="portfolio-percent">${pct}%</span>
        </div>
      `;
    }).join('');
  }

  // Render doughnut chart
  const portfolioCtx = document.getElementById('portfolioChart')?.getContext('2d');
  if (portfolioCtx) {
    const hexToRgba = (hex, alpha = 0.75) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r},${g},${b},${alpha})`;
    };

    const doughnutOpts = (dataTotal) => ({
      maintainAspectRatio: false,
      responsive: true,
      cutout: '68%',
      events: ['mousemove', 'mouseout', 'click', 'touchstart', 'touchmove', 'touchend'],
      interaction: {
        mode: 'nearest',
        intersect: false
      },
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
            label: (ctx) => `${fmtJPY(ctx.parsed)} (${((ctx.parsed / dataTotal) * 100).toFixed(1)}%)`
          }
        }
      }
    });

    if (portfolioChart) {
      portfolioChart.destroy();
    }

    portfolioChart = new Chart(portfolioCtx, {
      type: 'doughnut',
      data: {
        labels: sortedData.map(d => d.label),
        datasets: [{
          data: sortedData.map(d => d.amount),
          backgroundColor: sortedData.map(d => hexToRgba(d.color)),
          borderColor: 'rgba(255,255,255,0.2)',
          borderWidth: 1
        }]
      },
      options: doughnutOpts(total)
    });
    bindDoughnutTooltipInteractions(portfolioChart, () => accountChart);

    // ==== 口座別配分チャート ====
    const accountTotal = accountData.reduce((s, d) => s + d.amount, 0);
    const sortedAccount = accountData.slice().sort((a, b) => b.amount - a.amount);

    const accountListEl = document.getElementById('accountItems');
    if (accountListEl) {
      accountListEl.innerHTML = sortedAccount.map(item => {
        const pct = accountTotal > 0 ? ((item.amount / accountTotal) * 100).toFixed(1) : '0.0';
        return `
          <div class="portfolio-item" style="--item-color: ${item.color}">
            <span class="portfolio-label">${item.label}</span>
            <span class="portfolio-amount">${fmtJPY(item.amount)}</span>
            <span class="portfolio-percent">${pct}%</span>
          </div>`;
      }).join('');
    }

    const accountCtx = document.getElementById('accountChart')?.getContext('2d');
    if (accountCtx) {
      if (accountChart) {
        accountChart.destroy();
      }

      accountChart = new Chart(accountCtx, {
        type: 'doughnut',
        data: {
          labels: sortedAccount.map(d => d.label),
          datasets: [{
            data: sortedAccount.map(d => d.amount),
            backgroundColor: sortedAccount.map(d => hexToRgba(d.color)),
            borderColor: 'rgba(255,255,255,0.2)',
            borderWidth: 1
          }]
        },
        options: doughnutOpts(accountTotal)
      });
      bindDoughnutTooltipInteractions(accountChart, () => portfolioChart);
    }
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

function estimateRequiredMargin(position) {
  const qty = Number(position.absQuantity) || 0;
  const avgRate = Number(position.avgRate) || 0;
  const contractSize = Number(position.contractSize) || historyCore?.FX_CONTRACT_SIZE_DEFAULT || 10000;
  const notional = qty * contractSize * Math.max(0, avgRate);
  return notional * 0.04;
}

function estimateMarketValue(position) {
  const qty = Number(position.absQuantity) || 0;
  const avgRate = Number(position.avgRate) || 0;
  const contractSize = Number(position.contractSize) || 1;
  return qty * contractSize * Math.max(0, avgRate);
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
  const openPositions = historyCore.calculateOpenPositions(entries || []);
  const latestMemoMap = getLatestMemoMap(entries || []);
  const map = new Map();

  openPositions.forEach((position) => {
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
      contractSize: Number(position.contractSize) || historyCore?.FX_CONTRACT_SIZE_DEFAULT || 10000,
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
    current.contractSize = Number(position.contractSize) || current.contractSize;

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

function getActivePortfolioRows() {
  const entries = historyCore?.parseEntries ? historyCore.parseEntries() : [];
  const rows = aggregateOpenPositionsForTop(entries);
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
  const chartCtx = document.getElementById('currentPortfolioChart')?.getContext('2d');
  if (!list) return;

  const entries = historyCore?.parseEntries ? historyCore.parseEntries() : [];
  const allRows = aggregateOpenPositionsForTop(entries);
  const hasTabData = (tabName) => allRows.some((row) => normalizeAssetTypeLabel(row.assetType) === normalizeAssetTypeLabel(tabName));
  if (!hasTabData(activePortfolioAssetTab)) {
    const fallbackTab = ['FX', '証券', '暗号資産'].find((tabName) => hasTabData(tabName));
    if (fallbackTab) activePortfolioAssetTab = fallbackTab;
  }
  syncPortfolioTabs();

  const rows = allRows.filter((row) => normalizeAssetTypeLabel(row.assetType) === normalizeAssetTypeLabel(activePortfolioAssetTab));

  if (!rows.length) {
    list.innerHTML = '<li class="pair-card"><div class="pair-title">保有ポジションがありません</div><div class="pair-right"><div class="pair-profit neutral">-</div><div class="pair-growth neutral">0.0%</div></div></li>';
    if (currentPortfolioChart) {
      currentPortfolioChart.destroy();
      currentPortfolioChart = null;
    }
    return;
  }

  const total = rows.reduce((sum, row) => sum + (Number(row.metricValue) || 0), 0);
  list.innerHTML = rows.map((row) => {
    const share = total > 0 ? ((row.metricValue / total) * 100) : 0;
    const metricLabel = activePortfolioAssetTab === 'FX' ? '必要証拠金' : '評価額';
    return `
      <li class="pair-card" data-open-id="${escapeHtml(row.id)}">
        <div class="pair-title">${escapeHtml(row.symbol)}</div>
        <div class="pair-right">
          <div class="pair-profit neutral">${metricLabel} ${fmtJPY(row.metricValue)}</div>
          <div class="pair-growth neutral">${fmtQuantity(row.absQuantity)} / ${share.toFixed(1)}%</div>
        </div>
      </li>
    `;
  }).join('');

  bindCurrentPortfolioRows(rows);

  if (!chartCtx || typeof Chart === 'undefined') return;
  if (currentPortfolioChart) currentPortfolioChart.destroy();

  const palette = ['#3B6DFF', '#3EE08F', '#3DA2FF', '#D95757', '#E9C85E', '#7E7A98', '#F18E4F', '#8BC7FF'];
  currentPortfolioChart = new Chart(chartCtx, {
    type: 'doughnut',
    data: {
      labels: rows.map((row) => row.symbol),
      datasets: [{
        data: rows.map((row) => row.metricValue),
        backgroundColor: rows.map((_, idx) => palette[idx % palette.length]),
        borderColor: 'rgba(255,255,255,0.2)',
        borderWidth: 1
      }]
    },
    options: {
      maintainAspectRatio: false,
      responsive: true,
      cutout: '68%',
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
  return {
    ...fallbackTopData,
    year: selectedYear,
    month: 12,
    realized: Array(12).fill(0),
    total: Array(12).fill(0),
    accountData: []
  };
}

function initializeYearSelector() {
  const tradingDataMap = parseStoredJson(PROFIT_STORAGE_KEY_TRADING);
  const yearSelect = document.getElementById('topYearSelect');

  if (!yearSelect) return;

  const persistedYear = getPersistedSelectedYear();
  const years = (() => {
    const set = new Set([TOP_BASE_YEAR]);
    getNumericYears(tradingDataMap)
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

  renderPerformanceChart();
}

// ===== Unified Backup: Export / Import All Data =====
function getHistoryEntriesForBackup() {
  if (historyCore?.parseEntries) {
    return historyCore.parseEntries();
  }

  try {
    const raw = JSON.parse(localStorage.getItem('tradeScopeTradeHistoryV1') || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function exportAllData() {
  const tradingData = parseStoredJson(PROFIT_STORAGE_KEY_TRADING);
  const yearInitialFunds = parseStoredJson(PROFIT_STORAGE_KEY_INITIAL);
  const yearInitialUnrealized = parseStoredJson(PROFIT_STORAGE_KEY_INITIAL_UNREALIZED);

  const profitPayload = {
    tradingData,
    yearInitialFunds,
    yearInitialUnrealized
  };

  const historyEntries = getHistoryEntriesForBackup();

  const payload = {
    tradescope: 'all-backup',
    exportedAt: new Date().toISOString(),
    profitData: profitPayload,
    historyData: { entries: historyEntries }
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = `tradescope-all-backup-${dateStr}.json`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function importAllData(file) {
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      
      if (parsed.tradescope !== 'all-backup') {
        alert('ファイル形式が正しくありません。TradeScope の統合バックアップファイルを選択してください。');
        return;
      }

      if (!confirm('現在のデータをインポートデータで上書きします。よろしいですか？')) return;

      const { profitData, historyData } = parsed;

      // Import profit data
      if (profitData?.tradingData && profitData?.yearInitialFunds) {
        const importedTradingData = profitData.tradingData;
        const importedYearInitialFunds = profitData.yearInitialFunds;
        const importedYearInitialUnrealized = profitData.yearInitialUnrealized || {};
        localStorage.setItem(PROFIT_STORAGE_KEY_TRADING, JSON.stringify(importedTradingData));
        localStorage.setItem(PROFIT_STORAGE_KEY_INITIAL, JSON.stringify(importedYearInitialFunds));
        localStorage.setItem(PROFIT_STORAGE_KEY_INITIAL_UNREALIZED, JSON.stringify(importedYearInitialUnrealized));
      }

      // Import history data
      if (historyData?.entries && historyCore?.saveEntries) {
        historyCore.saveEntries(historyData.entries);
      }

      updateDataByYear();
      updateRiskSection();

      alert('インポートが完了しました。');
    } catch (error) {
      console.error('Import error:', error);
      alert('ファイルの読み込みに失敗しました。');
    }
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
