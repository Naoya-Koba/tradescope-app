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

// ===== Memo Box =====
const memoList = document.getElementById('memoList');
const addMemoBtn = document.getElementById('addMemoBtn');
const memoModal = document.getElementById('memoModal');
const memoModalBackdrop = document.getElementById('memoModalBackdrop');
const memoInput = document.getElementById('memoInput');
const saveMemoBtn = document.getElementById('saveMemoBtn');
const cancelMemoBtn = document.getElementById('cancelMemoBtn');
const closeMemoModal = document.getElementById('closeMemoModal');

function loadMemos() {
  const memos = JSON.parse(localStorage.getItem('tradeScopeMemos')) || [];
  memoList.innerHTML = memos.length === 0 
    ? '<li style="color: var(--muted); padding: 12px 0; text-align: center; font-size: 12px;">メモはまだありません</li>'
    : memos.map((memo, idx) => `
      <li class="memo-item">
        <div class="memo-content">
          <div class="memo-item-text">${memo.text}</div>
          <div class="memo-item-time">${new Date(memo.date).toLocaleDateString('ja-JP')}</div>
        </div>
        <button class="memo-delete-btn" data-idx="${idx}" aria-label="削除">−</button>
      </li>
    `).join('');
  
  document.querySelectorAll('.memo-delete-btn').forEach(btn => {
    btn.addEventListener('click', deleteMemo);
  });
}

function openModal() {
  memoInput.value = '';
  memoModal.setAttribute('aria-hidden', 'false');
  memoModalBackdrop.setAttribute('aria-hidden', 'false');
  setTimeout(() => memoInput.focus(), 100);
}

function closeModal() {
  memoModal.setAttribute('aria-hidden', 'true');
  memoModalBackdrop.setAttribute('aria-hidden', 'true');
}

function saveMemo() {
  const text = memoInput.value.trim();
  if (!text) return;
  
  const memos = JSON.parse(localStorage.getItem('tradeScopeMemos')) || [];
  memos.unshift({ text, date: new Date().toISOString() });
  memos.splice(50);
  localStorage.setItem('tradeScopeMemos', JSON.stringify(memos));
  loadMemos();
  closeModal();
}

function deleteMemo(e) {
  const idx = parseInt(e.target.dataset.idx);
  const memos = JSON.parse(localStorage.getItem('tradeScopeMemos')) || [];
  memos.splice(idx, 1);
  localStorage.setItem('tradeScopeMemos', JSON.stringify(memos));
  loadMemos();
}

addMemoBtn.addEventListener('click', openModal);
saveMemoBtn.addEventListener('click', saveMemo);
cancelMemoBtn.addEventListener('click', closeModal);
closeMemoModal.addEventListener('click', closeModal);
memoModalBackdrop.addEventListener('click', closeModal);
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
  trackEl.innerHTML = items.concat(items).map(t => `<span class="ticker-item">${t}</span>`).join('');
}
mountTicker(document.getElementById('globalTickerTrack'), globalTicker);
const sel = document.getElementById('countrySelect');
function refreshCountryTicker() {
  const v = sel.value || 'USD';
  mountTicker(document.getElementById('countryTickerTrack'), countryNews[v] || []);
}
sel?.addEventListener('change', refreshCountryTicker);
refreshCountryTicker();

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
let topAssetTrendView = 'asset';

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
  { label: 'NISA', amount: 1260000, color: '#D95757' },
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
    { label: 'NISA', amount: byKey['SBI'] || 0, color: '#D95757' },
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
    noteEl.textContent = cryptoValue > 0 ? '0円時想定 FX + 暗号資産' : '0円時想定 FX';
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

  // 年間成長率: 入出金の影響を除いた実質ベースの計算
  // 実質損益 = 現在純資産 - 年初純資産 - 累計入金額 + 累計出金額
  // 年間成長率 = 実質損益 ÷ 年初純資産 × 100
  const yearStartTotal = topSeries.yearStartTotal || 0;
  const yearStartConfirmed = topSeries.yearStartConfirmed || 0;
  const growthCurrentTotal = topSeries.growthCurrentTotal || tLast;
  const growthCurrentConfirmed = topSeries.growthCurrentConfirmed || rLast;
  const cumulativeDeposits = topSeries.cumulativeDeposits || 0;
  const cumulativeWithdrawals = topSeries.cumulativeWithdrawals || 0;
  
  let annualGrowthRate = 0;
  let realPnL = 0;
  if (yearStartTotal > 0) {
    realPnL = growthCurrentTotal - yearStartTotal - cumulativeDeposits + cumulativeWithdrawals;
    annualGrowthRate = (realPnL / yearStartTotal) * 100;
  } else {
    realPnL = growthCurrentTotal - yearStartTotal - cumulativeDeposits + cumulativeWithdrawals;
  }

  let confirmedAnnualGrowthRate = 0;
  let confirmedRealPnL = 0;
  if (yearStartConfirmed > 0) {
    confirmedRealPnL = growthCurrentConfirmed - yearStartConfirmed - cumulativeDeposits + cumulativeWithdrawals;
    confirmedAnnualGrowthRate = (confirmedRealPnL / yearStartConfirmed) * 100;
  } else {
    confirmedRealPnL = growthCurrentConfirmed - yearStartConfirmed - cumulativeDeposits + cumulativeWithdrawals;
  }

  const elTotalDelta = document.getElementById('deltaTotal');
  const elNetDelta = document.getElementById('deltaNet');
  if (elTotalDelta) {
    elTotalDelta.textContent = fmtDeltaNumber(realPnL);
    setSignClass(elTotalDelta, realPnL);
  }
  if (elNetDelta) {
    elNetDelta.textContent = fmtDeltaNumber(confirmedRealPnL);
    setSignClass(elNetDelta, confirmedRealPnL);
  }

  elNet.textContent = (confirmedAnnualGrowthRate >= 0 ? '+' : '') + confirmedAnnualGrowthRate.toFixed(1) + '%';
  setSignClass(elNet, confirmedAnnualGrowthRate);
  
  const elTotalGrowth = document.getElementById('growthTotal');
  elTotalGrowth.textContent = (annualGrowthRate >= 0 ? '+' : '') + annualGrowthRate.toFixed(1) + '%';
  setSignClass(elTotalGrowth, annualGrowthRate);
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
const pairCards = document.querySelectorAll('.pair-card');
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

const pairDetails = {
  'USDJPY': { profit: '¥25,000', rate: '+2.3%', lots: '300', avg: '3.250', now: '3.630', mmr: '265%', zero: '-¥3,280,000', half: '-¥1,640,000', note: '高スワップ維持中。利確目標は3.8。' },
  'EURJPY': { profit: '¥14,000', rate: '+0.9%', lots: '220', avg: '168.200', now: '169.110', mmr: '278%', zero: '-¥1,840,000', half: '-¥920,000', note: '押し目待ち。利確と積み増しを分離。' },
  'GBPJPY': { profit: '¥−6,000', rate: '-0.8%', lots: '180', avg: '201.800', now: '200.190', mmr: '241%', zero: '-¥2,120,000', half: '-¥1,060,000', note: 'ボラ高め。逆行時はロット調整優先。' },
  'CHFJPY': { profit: '¥4,500', rate: '+0.3%', lots: '140', avg: '174.020', now: '174.550', mmr: '286%', zero: '-¥1,420,000', half: '-¥710,000', note: '中立。スワップ寄与を観察。' },
  'AUDJPY': { profit: '¥18,000', rate: '+1.1%', lots: '200', avg: '96.800', now: '97.860', mmr: '268%', zero: '-¥1,760,000', half: '-¥880,000', note: '押し目で分割追加予定。' },
  'NZDJPY': { profit: '¥12,000', rate: '+0.7%', lots: '170', avg: '89.500', now: '90.120', mmr: '276%', zero: '-¥1,520,000', half: '-¥760,000', note: '短期はレンジ想定。' },
  'TRYJPY': { profit: '¥1,095,000', rate: '+4.1%', lots: '300', avg: '3.250', now: '3.630', mmr: '270%', zero: '-¥3,280,000', half: '-¥1,640,000', note: '安定推移中。' },
  'HUFJPY': { profit: '¥−42,000', rate: '-0.5%', lots: '200', avg: '0.410', now: '0.445', mmr: '310%', zero: '-¥820,000', half: '-¥410,000', note: '金利低下懸念。' },
  'MXNJPY': { profit: '¥265,000', rate: '+1.9%', lots: '150', avg: '8.710', now: '8.980', mmr: '289%', zero: '-¥1,260,000', half: '-¥630,000', note: '保有継続。急騰時は部分利確。' },
  'ZARJPY': { profit: '¥85,000', rate: '+0.6%', lots: '110', avg: '8.020', now: '8.170', mmr: '295%', zero: '-¥960,000', half: '-¥480,000', note: 'ニュースイベント時は注意。' },
  'EURUSD': { profit: '¥0', rate: '0.0%', lots: '0', avg: '1.080', now: '1.080', mmr: '---', zero: '---', half: '---', note: '現在ポジションなし。' }
};

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

function openDetail(card) {
  if (!detailPanel || !card) return;
  const pair = card.dataset.pair || '';
  const title = card.querySelector('.pair-title')?.textContent || pair;
  const fallbackProfit = card.querySelector('.pair-profit')?.textContent || '¥0';
  const fallbackRate = card.querySelector('.pair-growth')?.textContent || '0.0%';
  const data = pairDetails[pair] || {
    profit: fallbackProfit,
    rate: fallbackRate,
    lots: detailLots?.textContent || '---',
    avg: detailAvg?.textContent || '---',
    now: detailNow?.textContent || '---',
    mmr: detailMMR?.textContent || '---',
    zero: detailZero?.textContent || '---',
    half: detailHalf?.textContent || '---',
    note: detailNote?.textContent || 'データ準備中。'
  };

  if (detailTitle) detailTitle.textContent = title;
  if (detailProfit) {
    detailProfit.textContent = data.profit;
    detailProfit.classList.remove('positive', 'negative', 'neutral');
    if (data.profit.includes('−') || data.profit.includes('-')) detailProfit.classList.add('negative');
    else if (data.profit.includes('0')) detailProfit.classList.add('neutral');
    else detailProfit.classList.add('positive');
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

pairCards.forEach((card) => {
  card.addEventListener('click', () => openDetail(card));
});

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

  let cumulativeDeposits = 0;
  let cumulativeWithdrawals = 0;

  const confirmedSeries = [GROWTH_TARGET_ACCOUNTS.reduce((sum, account) => {
    return sum + (Number(yearInitialData?.[account.key]) || 0);
  }, 0)];

  const totalSeries = [GROWTH_TARGET_ACCOUNTS.reduce((sum, account) => {
    return sum + (Number(yearInitialData?.[account.key]) || 0)
      + (Number(yearInitialUnrealData?.[account.key]) || 0);
  }, 0)];

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

    confirmedSeries.push(growthConfirmed - cumulativeDeposits + cumulativeWithdrawals);
    totalSeries.push(growthTotal - cumulativeDeposits + cumulativeWithdrawals);
  }

  return { confirmedSeries, totalSeries };
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
          label: 'Net Balance',
          data: activeNetBalanceSeries,
          borderColor: '#3DA2FF',
          backgroundColor: gradBlue,
          fill: true,
          tension: 0.35,
          pointRadius: 2
        },
        {
          label: 'Total Equity',
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
      plugins: {
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

  [portfolioChart, accountChart].forEach((chart) => {
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
  let years = getNumericYears(tradingDataMap);
  const yearSelect = document.getElementById('topYearSelect');

  if (!yearSelect) return;

  const persistedYear = getPersistedSelectedYear();

  if (years.length === 0) {
    years = [2025];
  }

  if (persistedYear && !years.includes(persistedYear)) {
    years = [...years, persistedYear].sort((a, b) => a - b);
  }

  yearSelect.innerHTML = years.map(year => 
    `<option value="${year}">${year}</option>`
  ).join('');

  const defaultYear = persistedYear && years.includes(persistedYear)
    ? persistedYear
    : years[years.length - 1];

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

  renderPerformanceChart();
}

// ===== Unified Backup: Export / Import All Data =====
function exportAllData() {
  if (!historyCore?.parseEntries) {
    alert('データの読み込みに失敗しました。');
    return;
  }

  const profitPayload = {
    tradingData,
    yearInitialFunds,
    yearInitialUnrealized
  };

  const historyEntries = historyCore.parseEntries();

  const payload = {
    tradescope: 'all-backup',
    exportedAt: new Date().toISOString(),
    profitData: profitPayload,
    historyData: { entries: historyEntries }
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `tradescope-all-backup-${dateStr}.json`;
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
        tradingData = profitData.tradingData;
        yearInitialFunds = profitData.yearInitialFunds;
        yearInitialUnrealized = profitData.yearInitialUnrealized || {};
        localStorage.setItem(PROFIT_STORAGE_KEY_TRADING, JSON.stringify(tradingData));
        localStorage.setItem(PROFIT_STORAGE_KEY_INITIAL, JSON.stringify(yearInitialFunds));
        localStorage.setItem(PROFIT_STORAGE_KEY_INITIAL_UNREALIZED, JSON.stringify(yearInitialUnrealized));
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
});

// Backup button listeners
document.getElementById('exportAllDataBtn')?.addEventListener('click', exportAllData);
document.getElementById('importAllDataInput')?.addEventListener('change', (e) => {
  importAllData(e.target.files[0]);
  e.target.value = '';
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeYearSelector);
} else {
  initializeYearSelector();
}
