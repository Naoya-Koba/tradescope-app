// ===== Utility =====
const fmtJPY = n => isFinite(n) ? '¥' + Math.round(n).toLocaleString() : '-';
const fmtMan = (n) => {
  if (!isFinite(n)) return '-';
  const rounded = Math.round(Number(n) / 10000);
  return (Object.is(rounded, -0) ? 0 : rounded).toLocaleString();
};
const fmtManDecimal = n => {
  if (!isFinite(n)) return '-';
  const rawMan = Number(n) / 10000;
  const rounded = Math.round(rawMan * 10) / 10;
  const normalized = Math.abs(rounded) < 0.05 ? 0 : rounded;
  const displayValue = normalized === 0 && Number(n) !== 0
    ? (Number(n) > 0 ? 0.1 : -0.1)
    : normalized;
  return displayValue.toLocaleString('ja-JP', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  });
};
const colorBySign = n => (Number(n) < 0 ? '#FF6B6B' : '#EEF1FF');
const setSignClass = (el, val) => {
  if (!el) return;
  el.classList.remove('positive', 'negative', 'neutral');
  el.classList.add(val > 0 ? 'positive' : val < 0 ? 'negative' : 'neutral');
};
const normalizeCashflowValue = (field, value) => {
  if (field === 'deposit' || field === 'withdrawal') return Math.abs(value);
  return value;
};

const ACCOUNTS = [
  { name: 'GMO', key: 'gmo', color: '#3B6DFF' },
  { name: 'Light FX', key: 'lightfx', color: '#74D2F5' },
  { name: 'みんなのFX', key: 'minano', color: '#E9C85E' },
  { name: 'SBI', key: 'sbi', color: '#D95757' },
  { name: 'SBI VC', key: 'sbivc', color: '#EAF1FF' },
  { name: '三井住友銀行', key: 'smbc', color: '#2F7A46', bankOnly: true }
];
const UNREALIZED_HELPER_ACCOUNTS = new Set(['lightfx', 'minano']);
const GROWTH_TARGET_ACCOUNTS = ACCOUNTS.filter((account) => !account.bankOnly);
const profitMetrics = window.TradeScopeProfitMetrics;

function getUnrealizedLegs(year, month, accountKey) {
  ensureYearMonth(year, month);
  const row = tradingData[year]?.[month]?.[accountKey] || {};
  if (!Array.isArray(row.unrealizedLegs)) row.unrealizedLegs = [];
  return row.unrealizedLegs;
}

function createUnrealizedLegRowHtml(accountKey, value, index) {
  return `
    <div class="unrealized-leg-row" data-account="${accountKey}" data-index="${index}">
      <input type="number" class="unrealized-leg-input" data-account="${accountKey}" data-index="${index}" value="${value}" placeholder="建玉${index + 1}" />
      <div class="unrealized-leg-actions">
        <button type="button" class="unrealized-leg-add" data-account="${accountKey}" aria-label="建玉行を追加">＋</button>
        <button type="button" class="unrealized-leg-remove" data-account="${accountKey}" aria-label="建玉行を削除">−</button>
      </div>
    </div>
  `;
}

function reindexUnrealizedLegRows(accountKey) {
  const rows = document.querySelectorAll(`.unrealized-leg-row[data-account="${accountKey}"]`);
  rows.forEach((row, idx) => {
    row.dataset.index = String(idx);
    const input = row.querySelector('.unrealized-leg-input');
    if (input) {
      input.dataset.index = String(idx);
      input.placeholder = `建玉${idx + 1}`;
    }

    const addBtn = row.querySelector('.unrealized-leg-add');
    if (addBtn) {
      addBtn.style.display = idx === rows.length - 1 ? 'inline-flex' : 'none';
    }
  });

  const helperAddBtn = document.querySelector(`.unrealized-helper-add[data-account="${accountKey}"]`);
  if (helperAddBtn) {
    helperAddBtn.style.display = rows.length === 0 ? 'inline-flex' : 'none';
  }
}

function resizeAccountBodyForUnrealized(accountKey) {
  const body = document.querySelector(`.account-body[data-account-body="${accountKey}"]`);
  if (!body || !body.classList.contains('open')) return;
  body.style.maxHeight = `${body.scrollHeight}px`;
}

function shouldSelectZeroForOverwrite(input) {
  if (!input) return false;
  return input.value === '0' || input.value === '0.0' || input.value === '-0';
}

function appendUnrealizedLegRow(accountKey, initialValue = 0, focusNew = false) {
  const rowsWrap = document.querySelector(`.unrealized-helper-rows[data-account="${accountKey}"]`);
  if (!rowsWrap) return;

  const newIndex = rowsWrap.querySelectorAll('.unrealized-leg-row').length;
  rowsWrap.insertAdjacentHTML('beforeend', createUnrealizedLegRowHtml(accountKey, initialValue, newIndex));
  reindexUnrealizedLegRows(accountKey);
  syncUnrealizedFromLegInputs(accountKey);
  resizeAccountBodyForUnrealized(accountKey);

  if (focusNew) {
    const latestInput = rowsWrap.querySelector(`.unrealized-leg-input[data-index="${rowsWrap.querySelectorAll('.unrealized-leg-row').length - 1}"]`);
    latestInput?.focus();
    if (latestInput && shouldSelectZeroForOverwrite(latestInput)) latestInput.select();
  }
}

function removeUnrealizedLegRow(rowEl, accountKey) {
  rowEl?.remove();
  reindexUnrealizedLegRows(accountKey);
  syncUnrealizedFromLegInputs(accountKey);
  resizeAccountBodyForUnrealized(accountKey);
}

function commitUnrealizedLegInput(inputEl, { focusNew = false } = {}) {
  if (!inputEl) return;
  const accountKey = inputEl.dataset.account;
  const rowsWrap = document.querySelector(`.unrealized-helper-rows[data-account="${accountKey}"]`);
  if (!rowsWrap) return;

  const rows = Array.from(rowsWrap.querySelectorAll('.unrealized-leg-row'));
  const rowEl = inputEl.closest('.unrealized-leg-row');
  const rowIndex = rows.findIndex((row) => row === rowEl);
  if (rowIndex < 0) return;

  const value = Number(inputEl.value) || 0;
  const isLastRow = rowIndex === rows.length - 1;

  if (isLastRow && value !== 0) {
    appendUnrealizedLegRow(accountKey, 0, focusNew);
    return;
  }

  if (rows.length > 1 && rowIndex > 0 && value === 0) {
    removeUnrealizedLegRow(rowEl, accountKey);
    return;
  }

  syncUnrealizedFromLegInputs(accountKey);
  resizeAccountBodyForUnrealized(accountKey);
}

function syncUnrealizedFromLegInputs(accountKey) {
  ensureYearMonth(currentYear, currentMonth);
  const inputs = document.querySelectorAll(`.unrealized-leg-input[data-account="${accountKey}"]`);
  const legs = Array.from(inputs).map((input) => Number(input.value) || 0);

  const row = tradingData[currentYear][currentMonth][accountKey];

  if (!legs.length) {
    const fallback = Number(row.unrealizedBackup ?? row.unrealizedPnL) || 0;
    row.unrealizedLegs = [];
    row.unrealizedPnL = fallback;

    const unrealizedInput = document.querySelector(`.input-account[data-account="${accountKey}"][data-field="unrealizedPnL"]`);
    if (unrealizedInput) unrealizedInput.value = String(fallback);

    updateInputs();
    return;
  }

  const total = legs.reduce((sum, v) => sum + v, 0);
  row.unrealizedLegs = legs;
  row.unrealizedPnL = total;

  const unrealizedInput = document.querySelector(`.input-account[data-account="${accountKey}"][data-field="unrealizedPnL"]`);
  if (unrealizedInput) unrealizedInput.value = String(total);

  updateInputs();
}

function bindUnrealizedHelperEvents(container) {
  if (!container || container.dataset.unrealizedHelperBound === '1') return;

  container.addEventListener('click', (event) => {
    const addBtn = event.target.closest('.unrealized-helper-add, .unrealized-leg-add');
    if (addBtn) {
      const accountKey = addBtn.dataset.account;
      const rowsWrap = container.querySelector(`.unrealized-helper-rows[data-account="${accountKey}"]`);
      if (!rowsWrap) return;

      const legs = getUnrealizedLegs(currentYear, currentMonth, accountKey);
      const row = tradingData[currentYear]?.[currentMonth]?.[accountKey] || {};
      const currentUnrealized = Number(tradingData[currentYear]?.[currentMonth]?.[accountKey]?.unrealizedPnL) || 0;
      if (!legs.length) {
        // 初回は「既存の評価損益」行に加えて、新規追加行も同時に作る
        row.unrealizedBackup = currentUnrealized;
        legs.push(currentUnrealized);
        legs.push(0);
      }

      const newIndex = rowsWrap.querySelectorAll('.unrealized-leg-row').length;
      if (newIndex === 0 && legs.length >= 2) {
        rowsWrap.insertAdjacentHTML('beforeend', createUnrealizedLegRowHtml(accountKey, legs[0], 0));
        rowsWrap.insertAdjacentHTML('beforeend', createUnrealizedLegRowHtml(accountKey, legs[1], 1));
        reindexUnrealizedLegRows(accountKey);
        syncUnrealizedFromLegInputs(accountKey);
        resizeAccountBodyForUnrealized(accountKey);

        const latestInput = rowsWrap.querySelector(`.unrealized-leg-input[data-index="${rowsWrap.querySelectorAll('.unrealized-leg-row').length - 1}"]`);
        latestInput?.focus();
        if (latestInput && shouldSelectZeroForOverwrite(latestInput)) latestInput.select();
      } else {
        appendUnrealizedLegRow(accountKey, 0, true);
      }
      return;
    }

    const removeBtn = event.target.closest('.unrealized-leg-remove');
    if (removeBtn) {
      const accountKey = removeBtn.dataset.account;
      const row = removeBtn.closest('.unrealized-leg-row');
      removeUnrealizedLegRow(row, accountKey);
    }
  });

  container.addEventListener('input', (event) => {
    const input = event.target.closest('.unrealized-leg-input');
    if (!input) return;
    syncUnrealizedFromLegInputs(input.dataset.account);
  });

  container.addEventListener('focusin', (event) => {
    const input = event.target.closest('.unrealized-leg-input');
    if (!input) return;
    if (shouldSelectZeroForOverwrite(input)) input.select();
  });

  container.addEventListener('click', (event) => {
    const input = event.target.closest('.unrealized-leg-input');
    if (!input) return;
    if (shouldSelectZeroForOverwrite(input)) input.select();
  });

  container.addEventListener('keydown', (event) => {
    const input = event.target.closest('.unrealized-leg-input');
    if (!input) return;
    if (event.key !== 'Enter') return;
    event.preventDefault();
    commitUnrealizedLegInput(input, { focusNew: true });
  });

  container.addEventListener('blur', (event) => {
    const input = event.target.closest('.unrealized-leg-input');
    if (!input) return;
    commitUnrealizedLegInput(input, { focusNew: false });
  }, true);

  container.dataset.unrealizedHelperBound = '1';
}

// ===== Drawer =====
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

// ===== Global State =====
let currentYear = 2025;
let currentMonth = new Date().getMonth() + 1; // 1-12
let tradingData = {}; // { year: { month: { account: { realizedPnL, swapPnL, unrealizedPnL, maintenanceRate, deposit, withdrawal } } } }
let yearInitialFunds = {}; // { year: { account: amount } }
let yearInitialUnrealized = {}; // { year: { account: amount } }

// ===== Storage =====
const STORAGE_KEY_TRADING = 'tradingData';
const STORAGE_KEY_INITIAL = 'yearInitialFunds';
const STORAGE_KEY_INITIAL_UNREALIZED = 'yearInitialUnrealized';
const STORAGE_KEY_SKIP_DEMO = 'profitSkipDemoSeed';
const SHARED_SELECTED_YEAR_KEY = 'tradeScopeSelectedYear';

function getSharedSelectedYear() {
  const raw = Number(localStorage.getItem(SHARED_SELECTED_YEAR_KEY));
  return Number.isFinite(raw) ? raw : null;
}

function setSharedSelectedYear(year) {
  if (!Number.isFinite(Number(year))) return;
  localStorage.setItem(SHARED_SELECTED_YEAR_KEY, String(year));
}

const monthlyDetailPane = document.getElementById('monthlyDetailPane');
const monthlyDetailBody = document.getElementById('monthlyDetailBody');
const monthlyDetailTitle = document.getElementById('monthlyDetailTitle');
const monthlyDetailClose = document.getElementById('monthlyDetailClose');
const monthlyDetailScrim = document.getElementById('monthlyDetailScrim');
let pnlBarChart = null;
let assetsTrendChart = null;
let assetTrendView = 'asset';
let monthlyPnlView = 'total';
let monthlyDetailLockScrollY = 0;

function dismissInputFocusOnOutsideTap(event) {
  const activeEl = document.activeElement;
  if (!(activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement || activeEl instanceof HTMLSelectElement)) {
    return;
  }

  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  if (target.closest('input, textarea, select, label')) {
    return;
  }

  activeEl.blur();
}

document.addEventListener('pointerdown', dismissInputFocusOnOutsideTap, true);

function dismissChartTooltipOnOutsideTap(event) {
  const target = event.target;
  if (!(target instanceof Element)) return;

  [assetsTrendChart, pnlBarChart].forEach((chart) => {
    if (!chart || !chart.canvas) return;
    if (chart.canvas.contains(target)) return;

    const hasActive = chart.getActiveElements().length > 0;
    if (!hasActive) return;

    chart.setActiveElements([]);
    if (chart.tooltip) {
      chart.tooltip.setActiveElements([], { x: 0, y: 0 });
    }
    chart.update();
  });
}

document.addEventListener('pointerdown', dismissChartTooltipOnOutsideTap, true);

// ===== Backup: Export / Import =====
function exportData() {
  const payload = {
    tradingData,
    yearInitialFunds,
    yearInitialUnrealized,
    exportedAt: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `tradescope-backup-${dateStr}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importData(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      if (!parsed.tradingData || !parsed.yearInitialFunds) {
        alert('ファイル形式が正しくありません。TradeScope のバックアップファイルを選択してください。');
        return;
      }
      if (!confirm('現在のデータをインポートデータで上書きします。よろしいですか？')) return;
      tradingData = parsed.tradingData;
      yearInitialFunds = parsed.yearInitialFunds;
      yearInitialUnrealized = parsed.yearInitialUnrealized || {};
      saveToStorage();
      rerenderAfterDataChange();
      alert('インポートが完了しました。');
    } catch {
      alert('ファイルの読み込みに失敗しました。');
    }
  };
  reader.readAsText(file);
}

function saveToStorage() {
  localStorage.setItem(STORAGE_KEY_TRADING, JSON.stringify(tradingData));
  localStorage.setItem(STORAGE_KEY_INITIAL, JSON.stringify(yearInitialFunds));
  localStorage.setItem(STORAGE_KEY_INITIAL_UNREALIZED, JSON.stringify(yearInitialUnrealized));
}

function loadFromStorage() {
  tradingData = JSON.parse(localStorage.getItem(STORAGE_KEY_TRADING) || '{}');
  yearInitialFunds = JSON.parse(localStorage.getItem(STORAGE_KEY_INITIAL) || '{}');
  yearInitialUnrealized = JSON.parse(localStorage.getItem(STORAGE_KEY_INITIAL_UNREALIZED) || '{}');
}

function seedDemoDataIfEmpty() {
  if (localStorage.getItem(STORAGE_KEY_SKIP_DEMO) === '1') return;
  const hasTrading = Object.keys(tradingData || {}).length > 0;
  const hasInitial = Object.keys(yearInitialFunds || {}).length > 0;
  const hasUnrealized = Object.keys(yearInitialUnrealized || {}).length > 0;
  if (hasTrading || hasInitial || hasUnrealized) return;

  const year = 2025;
  yearInitialFunds[year] = {
    gmo: 900000,
    lightfx: 650000,
    minano: 700000,
    sbi: 820000,
    sbivc: 430000
  };
  yearInitialUnrealized[year] = {
    gmo: 12000,
    lightfx: 6200,
    minano: 5400,
    sbi: -2500,
    sbivc: 4500,
    smbc: 0
  };

  const monthlyBase = [22000, 18000, 25000, 21000, 27000, 24000, 30000, 26000, 28000, 32000, 29000, 34000];
  tradingData[year] = {};
  for (let m = 1; m <= 12; m++) {
    const b = monthlyBase[m - 1];
    const isNegativeRealizedMonth = m === 4;
    const isNegativeSwapMonth = m === 8;
    const isNegativeTotalMonth = m === 11;

    const gmoRealized = isNegativeRealizedMonth ? -18000 : isNegativeTotalMonth ? -22000 : b;
    const lightRealized = isNegativeRealizedMonth ? -9000 : isNegativeTotalMonth ? -13000 : b * 0.6;
    const minanoRealized = isNegativeRealizedMonth ? -7000 : isNegativeTotalMonth ? -9000 : b * 0.7;
    const sbiRealized = isNegativeRealizedMonth ? -4000 : isNegativeTotalMonth ? -6000 : b * 0.4;
    const sbivcRealized = isNegativeRealizedMonth ? -2000 : isNegativeTotalMonth ? -4000 : b * 0.2;

    const gmoSwap = isNegativeSwapMonth ? -2200 : isNegativeTotalMonth ? -1800 : 5200;
    const lightSwap = isNegativeSwapMonth ? -1400 : isNegativeTotalMonth ? -900 : 3600;
    const minanoSwap = isNegativeSwapMonth ? -1100 : isNegativeTotalMonth ? -700 : 4100;
    const sbiSwap = isNegativeSwapMonth ? -300 : isNegativeTotalMonth ? -250 : 900;
    const sbivcSwap = isNegativeSwapMonth ? -100 : isNegativeTotalMonth ? -150 : 0;

    tradingData[year][m] = {
      gmo: { realizedPnL: gmoRealized, swapPnL: gmoSwap, unrealizedPnL: 12000, maintenanceRate: 248, deposit: m % 3 === 0 ? 50000 : 0, withdrawal: 0 },
      lightfx: { realizedPnL: lightRealized, swapPnL: lightSwap, unrealizedPnL: 6200, maintenanceRate: 276, deposit: 0, withdrawal: m % 4 === 0 ? 18000 : 0 },
      minano: { realizedPnL: minanoRealized, swapPnL: minanoSwap, unrealizedPnL: 5400, maintenanceRate: 292, deposit: m % 5 === 0 ? 12000 : 0, withdrawal: 0 },
      sbi: { realizedPnL: sbiRealized, swapPnL: sbiSwap, unrealizedPnL: -2500, maintenanceRate: 312, deposit: 0, withdrawal: 0 },
      sbivc: { realizedPnL: sbivcRealized, swapPnL: sbivcSwap, unrealizedPnL: 4500, maintenanceRate: 999, deposit: 0, withdrawal: 0 }
    };
  }
  saveToStorage();
}

function clearStoredDataState() {
  tradingData = {};
  yearInitialFunds = {};
  yearInitialUnrealized = {};
}

function rerenderAfterDataChange() {
  closeMonthlyDetailPane();
  currentMonth = new Date().getMonth() + 1;
  renderAll();
}

// ===== Data Calculation =====
function ensureYearMonth(year, month) {
  if (!tradingData[year]) tradingData[year] = {};
  if (!tradingData[year][month]) tradingData[year][month] = {};
  ACCOUNTS.forEach(a => {
    if (!tradingData[year][month][a.key]) {
      tradingData[year][month][a.key] = {
        realizedPnL: 0,
        swapPnL: 0,
        unrealizedPnL: 0,
        unrealizedLegs: [],
        maintenanceRate: 0,
        deposit: 0,
        withdrawal: 0
      };
    }
  });
}

function calculateMonthlyTotals(year, month) {
  ensureYearMonth(year, month);
  let result = { realizedSum: 0, swapSum: 0, unrealizedSum: 0, depositSum: 0, withdrawSum: 0 };
  ACCOUNTS.forEach(a => {
    const data = tradingData[year][month][a.key] || {};
    result.realizedSum += data.realizedPnL || 0;
    result.swapSum += data.swapPnL || 0;
    result.unrealizedSum += data.unrealizedPnL || 0;
    result.depositSum += data.deposit || 0;
    result.withdrawSum += data.withdrawal || 0;
  });
  return result;
}

function calculateYearlyTotals(year) {
  let result = { realizedSum: 0, swapSum: 0, depositSum: 0, withdrawSum: 0 };
  for (let m = 1; m <= 12; m++) {
    const monthly = calculateMonthlyTotals(year, m);
    result.realizedSum += monthly.realizedSum;
    result.swapSum += monthly.swapSum;
    result.depositSum += monthly.depositSum;
    result.withdrawSum += monthly.withdrawSum;
  }
  return result;
}

function calculateAccountNetAssets(year, month, accountKey) {
  ensureYearMonth(year, month);
  if (profitMetrics?.calculateAccountNetAssets) {
    return profitMetrics.calculateAccountNetAssets(tradingData, yearInitialFunds, year, month, accountKey);
  }

  if (!yearInitialFunds[year]) yearInitialFunds[year] = {};
  const initialFund = yearInitialFunds[year][accountKey] || 0;

  let cumulative = { realized: 0, swap: 0, deposit: 0, withdrawal: 0 };
  for (let m = 1; m <= month; m++) {
    const accData = tradingData[year]?.[m]?.[accountKey] || {};
    cumulative.realized += accData.realizedPnL || 0;
    cumulative.swap += accData.swapPnL || 0;
    cumulative.deposit += accData.deposit || 0;
    cumulative.withdrawal += accData.withdrawal || 0;
  }

  const currentMonthUnrealized = tradingData[year]?.[month]?.[accountKey]?.unrealizedPnL || 0;
  return initialFund + cumulative.realized + cumulative.swap + cumulative.deposit - cumulative.withdrawal + currentMonthUnrealized;
}

function calculateAccountConfirmedAssets(year, month, accountKey) {
  ensureYearMonth(year, month);
  if (profitMetrics?.calculateAccountConfirmedAssets) {
    return profitMetrics.calculateAccountConfirmedAssets(tradingData, yearInitialFunds, year, month, accountKey);
  }

  if (!yearInitialFunds[year]) yearInitialFunds[year] = {};
  const initialFund = yearInitialFunds[year][accountKey] || 0;

  let cumulative = { realized: 0, swap: 0, deposit: 0, withdrawal: 0 };
  for (let m = 1; m <= month; m++) {
    const accData = tradingData[year]?.[m]?.[accountKey] || {};
    cumulative.realized += accData.realizedPnL || 0;
    cumulative.swap += accData.swapPnL || 0;
    cumulative.deposit += accData.deposit || 0;
    cumulative.withdrawal += accData.withdrawal || 0;
  }

  return initialFund + cumulative.realized + cumulative.swap + cumulative.deposit - cumulative.withdrawal;
}

function getBankMonthEndBalance(year, month, accountKey) {
  ensureYearMonth(year, month);
  const stored = Number(tradingData?.[year]?.[month]?.[accountKey]?.monthEndBalance);
  if (Number.isFinite(stored)) return stored;
  return calculateAccountNetAssets(year, month, accountKey);
}

function applyBankBalanceInputsForMonth(year, month) {
  ensureYearMonth(year, month);

  ACCOUNTS.filter((account) => account.bankOnly).forEach((account) => {
    const row = tradingData[year][month][account.key];
    const monthEndInput = Number(row.monthEndBalance);
    const monthEndBalance = Number.isFinite(monthEndInput)
      ? monthEndInput
      : calculateAccountNetAssets(year, month, account.key);

    const prevBalance = month === 1
      ? (Number(yearInitialFunds?.[year]?.[account.key]) || 0)
      : getBankMonthEndBalance(year, month - 1, account.key);

    const diff = monthEndBalance - prevBalance;

    row.monthEndBalance = monthEndBalance;
    row.realizedPnL = 0;
    row.swapPnL = 0;
    row.unrealizedPnL = 0;
    row.unrealizedLegs = [];
    row.deposit = diff > 0 ? diff : 0;
    row.withdrawal = diff < 0 ? Math.abs(diff) : 0;
  });
}

function calculateTotalNetAssets(year, month) {
  let total = 0;
  ACCOUNTS.forEach(a => {
    total += calculateAccountNetAssets(year, month, a.key);
  });
  return total;
}

function calculateTotalConfirmedAssets(year, month) {
  let total = 0;
  ACCOUNTS.forEach(a => {
    total += calculateAccountConfirmedAssets(year, month, a.key);
  });
  return total;
}

function calculateInitialCapital(year) {
  let total = 0;
  if (yearInitialFunds[year]) {
    ACCOUNTS.forEach(a => {
      total += yearInitialFunds[year][a.key] || 0;
    });
  }
  return total;
}

function hasMeaningfulMonthData(year, month) {
  const monthData = tradingData?.[year]?.[month];
  if (!monthData) return false;
  if (monthData.__saved) return true;

  return ACCOUNTS.some((account) => {
    const row = monthData?.[account.key] || {};
    return (Number(row.realizedPnL) || 0) !== 0
      || (Number(row.swapPnL) || 0) !== 0
      || (Number(row.unrealizedPnL) || 0) !== 0
      || (Number(row.deposit) || 0) !== 0
      || (Number(row.withdrawal) || 0) !== 0
      || (Number(row.maintenanceRate) || 0) !== 0
      || Array.isArray(row.unrealizedLegs) && row.unrealizedLegs.length > 0
      || Object.prototype.hasOwnProperty.call(row, 'monthEndBalance');
  });
}

function getLatestSavedMonth(year) {
  for (let month = 12; month >= 1; month -= 1) {
    if (hasMeaningfulMonthData(year, month)) return month;
  }
  return 1;
}

function renderPerformanceChart(options = {}) {
  const { renderAssets = true, renderPnl = true } = options;
  const assetsCanvas = document.getElementById('assetsTrendChart');
  const pnlCanvas = document.getElementById('pnlBarChart');
  if (!assetsCanvas || !pnlCanvas || typeof Chart === 'undefined') return;

  const labels = Array.from({ length: 12 }, (_, i) => `${i + 1}月`);
  const assetsLabels = ['年初', ...labels];
  const latestMonth = getLatestSavedMonth(currentYear);
  const realizedData = [];
  const swapData = [];
  const totalPnlData = [];
  const yearStartUnrealizedTotal = ACCOUNTS.reduce((sum, a) => {
    return sum + (Number(yearInitialUnrealized?.[currentYear]?.[a.key]) || 0);
  }, 0);
  const confirmedTrendData = [calculateInitialCapital(currentYear)];
  const assetsTrendData = [calculateInitialCapital(currentYear) + yearStartUnrealizedTotal];

  const growthInitialConfirmed = GROWTH_TARGET_ACCOUNTS.reduce((sum, account) => {
    return sum + (Number(yearInitialFunds?.[currentYear]?.[account.key]) || 0);
  }, 0);
  const growthInitialTotal = GROWTH_TARGET_ACCOUNTS.reduce((sum, account) => {
    return sum + (Number(yearInitialFunds?.[currentYear]?.[account.key]) || 0)
      + (Number(yearInitialUnrealized?.[currentYear]?.[account.key]) || 0);
  }, 0);
  const performanceConfirmedTrendData = [growthInitialConfirmed];
  const performanceAssetsTrendData = [growthInitialTotal];
  let cumulativeGrowthDeposits = 0;
  let cumulativeGrowthWithdrawals = 0;

  for (let m = 1; m <= 12; m++) {
    const monthly = calculateMonthlyTotals(currentYear, m);
    realizedData.push(monthly.realizedSum);
    swapData.push(monthly.swapSum);
    totalPnlData.push(monthly.realizedSum + monthly.swapSum);
    const monthEndAssets = calculateTotalNetAssets(currentYear, m);
    const monthEndConfirmed = calculateTotalConfirmedAssets(currentYear, m);
    const isEnteredMonth = m <= latestMonth;
    confirmedTrendData.push(isEnteredMonth ? monthEndConfirmed : null);
    assetsTrendData.push(isEnteredMonth ? monthEndAssets : null);

    if (isEnteredMonth) {
      GROWTH_TARGET_ACCOUNTS.forEach((account) => {
        const row = tradingData?.[currentYear]?.[m]?.[account.key] || {};
        cumulativeGrowthDeposits += Number(row.deposit) || 0;
        cumulativeGrowthWithdrawals += Number(row.withdrawal) || 0;
      });

      const growthAssets = GROWTH_TARGET_ACCOUNTS.reduce((sum, account) => {
        return sum + calculateAccountNetAssets(currentYear, m, account.key);
      }, 0);
      const growthConfirmed = GROWTH_TARGET_ACCOUNTS.reduce((sum, account) => {
        return sum + calculateAccountConfirmedAssets(currentYear, m, account.key);
      }, 0);

      performanceAssetsTrendData.push(growthAssets - cumulativeGrowthDeposits + cumulativeGrowthWithdrawals);
      performanceConfirmedTrendData.push(growthConfirmed - cumulativeGrowthDeposits + cumulativeGrowthWithdrawals);
    } else {
      performanceAssetsTrendData.push(null);
      performanceConfirmedTrendData.push(null);
    }
  }

  const activeConfirmedTrend = assetTrendView === 'performance'
    ? performanceConfirmedTrendData
    : confirmedTrendData;
  const activeAssetsTrend = assetTrendView === 'performance'
    ? performanceAssetsTrendData
    : assetsTrendData;

  const buildPnlDatasets = () => {
    if (monthlyPnlView === 'total') {
      return [
        {
          type: 'bar',
          label: 'Total P/L',
          data: totalPnlData,
          backgroundColor: totalPnlData.map(v => v >= 0 ? 'rgba(62,224,143,0.78)' : 'rgba(255,107,107,0.78)'),
          borderColor: totalPnlData.map(v => v >= 0 ? 'rgba(62,224,143,1)' : 'rgba(255,107,107,1)'),
          borderWidth: 1
        }
      ];
    }

    return [
      {
        type: 'bar',
        label: 'Realized P/L',
        data: realizedData,
        stack: 'pnl',
        backgroundColor: realizedData.map(v => v >= 0 ? 'rgba(62,224,143,0.75)' : 'rgba(255,107,107,0.75)'),
        borderColor: realizedData.map(v => v >= 0 ? 'rgba(62,224,143,1)' : 'rgba(255,107,107,1)'),
        borderWidth: 1
      },
      {
        type: 'bar',
        label: 'Swap P/L',
        data: swapData,
        stack: 'pnl',
        backgroundColor: swapData.map(v => v >= 0 ? 'rgba(61,162,255,0.75)' : 'rgba(255,107,107,0.55)'),
        borderColor: swapData.map(v => v >= 0 ? 'rgba(61,162,255,1)' : 'rgba(255,107,107,0.9)'),
        borderWidth: 1
      }
    ];
  };

  const assetsCtx = assetsCanvas.getContext('2d');
  const pnlCtx = pnlCanvas.getContext('2d');
  if (!assetsCtx || !pnlCtx) return;

  const setChartActiveByMonth = (chart, monthIndex) => {
    if (!chart) return;
    if (monthIndex == null || monthIndex < 0) {
      chart.setActiveElements([]);
      if (chart.tooltip) chart.tooltip.setActiveElements([], { x: 0, y: 0 });
      chart.update('none');
      return;
    }

    if (chart === assetsTrendChart) {
      if (monthIndex > latestMonth) {
        chart.setActiveElements([]);
        if (chart.tooltip) chart.tooltip.setActiveElements([], { x: 0, y: 0 });
        chart.update('none');
        return;
      }
      const active = [
        { datasetIndex: 0, index: monthIndex },
        { datasetIndex: 1, index: monthIndex }
      ];
      chart.setActiveElements(active);
      if (chart.tooltip) chart.tooltip.setActiveElements(active, { x: 0, y: 0 });
      chart.update('none');
      return;
    }

    const active = (chart.data?.datasets || []).map((_dataset, datasetIndex) => ({ datasetIndex, index: monthIndex }));
    chart.setActiveElements(active);
    if (chart.tooltip) chart.tooltip.setActiveElements(active, { x: 0, y: 0 });
    chart.update('none');
  };

  const syncHoverFromAssets = (activeElements) => {
    if (!pnlBarChart) return;
    if (!activeElements.length) {
      setChartActiveByMonth(pnlBarChart, null);
      return;
    }
    const assetIndex = activeElements[0].index;
    if (assetIndex <= 0) {
      setChartActiveByMonth(pnlBarChart, null);
      return;
    }
    setChartActiveByMonth(pnlBarChart, assetIndex - 1);
  };

  const syncHoverFromPnl = (activeElements) => {
    if (!assetsTrendChart) return;
    if (!activeElements.length) {
      setChartActiveByMonth(assetsTrendChart, null);
      return;
    }
    const pnlIndex = activeElements[0].index;
    setChartActiveByMonth(assetsTrendChart, pnlIndex + 1);
  };

  // Chart.js gradient for fill (match top page)
  const gradBlue = assetsCtx.createLinearGradient(0, 0, 0, 250);
  gradBlue.addColorStop(0, 'rgba(61,162,255,0.25)');
  gradBlue.addColorStop(1, 'rgba(61,162,255,0)');
  const gradGreen = assetsCtx.createLinearGradient(0, 0, 0, 250);
  gradGreen.addColorStop(0, 'rgba(62,224,143,0.25)');
  gradGreen.addColorStop(1, 'rgba(62,224,143,0)');

  const createAssetsChart = () => {
    if (assetsTrendChart) assetsTrendChart.destroy();
    assetsTrendChart = new Chart(assetsCtx, {
      type: 'line',
      data: {
        labels: assetsLabels,
        datasets: [
          {
            label: 'Net Balance',
            data: activeConfirmedTrend,
            borderColor: '#3DA2FF',
            backgroundColor: gradBlue,
            fill: true,
            tension: 0.35,
            pointRadius: 2,
            pointHitRadius: 20,
            pointHoverRadius: 5
          },
          {
            label: 'Total Equity',
            data: activeAssetsTrend,
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
        animation: {
          x: {
            type: 'number',
            easing: 'linear',
            duration: 480,
            from: (ctx) => {
              if (ctx.type !== 'data') return undefined;
              return ctx.chart.scales.x.getPixelForValue(0);
            },
            delay: (ctx) => {
              if (ctx.type !== 'data') return 0;
              return ctx.dataIndex * 55 + ctx.datasetIndex * 35;
            }
          },
          y: {
            type: 'number',
            easing: 'linear',
            duration: 0,
            from: (ctx) => {
              if (ctx.type !== 'data') return undefined;
              const meta = ctx.chart.getDatasetMeta(ctx.datasetIndex);
              const previous = meta?.data?.[ctx.index - 1];
              if (previous) return previous.y;
              return meta?.data?.[ctx.index]?.y;
            }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            itemSort: (a, b) => (Number(b.parsed?.y) || 0) - (Number(a.parsed?.y) || 0),
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${fmtManDecimal(ctx.parsed.y)}`
            }
          }
        },
        onHover: (_event, activeElements) => {
          syncHoverFromAssets(activeElements || []);
        },
        scales: {
          x: {
            ticks: { color: 'rgba(255,255,255,0.8)', font: { size: 12 } },
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
  };

  const createPnlChart = () => {
    if (pnlBarChart) pnlBarChart.destroy();
    pnlBarChart = new Chart(pnlCtx, {
      data: {
        labels,
        datasets: buildPnlDatasets()
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        events: ['mousemove', 'mouseout', 'click', 'touchstart', 'touchmove'],
        onHover: (_event, activeElements) => {
          syncHoverFromPnl(activeElements || []);
        },
        interaction: {
          mode: 'index',
          intersect: false,
          axis: 'x'
        },
        animation: {
          duration: 1500,
          easing: 'easeInOutQuad',
          delay: (ctx) => {
            let delay = 0;
            if (ctx.type === 'data') {
              delay = ctx.dataIndex * 40 + ctx.datasetIndex * 80;
            } else if (ctx.type !== 'none') {
              delay = ctx.datasetIndex * 150;
            }
            return delay;
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(10,12,26,0.9)',
            borderColor: 'rgba(255,255,255,0.15)',
            borderWidth: 1,
            titleColor: 'rgba(255,255,255,0.95)',
            bodyColor: 'rgba(255,255,255,0.9)',
            itemSort: (a, b) => {
              const aY = Number(a.element?.y);
              const bY = Number(b.element?.y);
              if (Number.isFinite(aY) && Number.isFinite(bY)) return aY - bY;
              return (Number(a.datasetIndex) || 0) - (Number(b.datasetIndex) || 0);
            },
            callbacks: {
              title: (items) => {
                const item = items?.[0];
                if (!item) return '';
                return `${item.dataIndex + 1}月`;
              },
              label: (ctx) => `${ctx.dataset.label}: ${fmtManDecimal(ctx.parsed.y)}`,
              afterBody: (items) => {
                if (monthlyPnlView === 'total') return '';
                const item = items?.[0];
                if (!item) return '';
                const idx = item.dataIndex;
                if (idx == null) return '';
                const totalPnL = (realizedData[idx] || 0) + (swapData[idx] || 0);
                return `当月合計損益: ${fmtManDecimal(totalPnL)}`;
              }
            }
          }
        },
        scales: {
          x: {
            stacked: monthlyPnlView === 'breakdown',
            ticks: {
              color: 'rgba(255,255,255,0.75)'
            },
            grid: {
              color: 'rgba(255,255,255,0.08)',
              drawBorder: false
            }
          },
          y: {
            stacked: monthlyPnlView === 'breakdown',
            ticks: {
              color: 'rgba(255,255,255,0.75)',
              callback: (v) => fmtMan(v)
            },
            grid: {
              color: 'rgba(255,255,255,0.1)',
              drawBorder: false
            }
          }
        }
      }
    });
  };

  if (renderAssets) createAssetsChart();
  if (renderPnl) createPnlChart();

  syncChartViewTabs();
}

function syncChartViewTabs() {
  const assetSelect = document.getElementById('assetTrendViewSelect');
  const monthlySelect = document.getElementById('monthlyPnlViewSelect');
  if (assetSelect) assetSelect.value = assetTrendView;
  if (monthlySelect) monthlySelect.value = monthlyPnlView;
  updateMonthlyPnlLegendVisibility();
}

function updateMonthlyPnlLegendVisibility() {
  const monthlySelect = document.getElementById('monthlyPnlViewSelect');
  if (!monthlySelect) return;
  const legendEl = monthlySelect
    .closest('.chart-panel-head-right')
    ?.querySelector('.chart-legend');
  if (!legendEl) return;

  const shouldShow = monthlyPnlView === 'breakdown';
  legendEl.hidden = !shouldShow;
  legendEl.style.display = shouldShow ? '' : 'none';
}

function bindChartViewControls() {
  const assetSelect = document.getElementById('assetTrendViewSelect');
  const monthlySelect = document.getElementById('monthlyPnlViewSelect');

  if (assetSelect && assetSelect.dataset.bound !== '1') {
    assetSelect.addEventListener('change', (event) => {
      const nextView = event.target.value === 'performance' ? 'performance' : 'asset';
      if (assetTrendView === nextView) return;
      assetTrendView = nextView;
      renderPerformanceChart({ renderAssets: true, renderPnl: false });
      syncChartViewTabs();
    });
    assetSelect.dataset.bound = '1';
  }

  if (monthlySelect && monthlySelect.dataset.bound !== '1') {
    monthlySelect.addEventListener('change', (event) => {
      const nextView = event.target.value === 'total' ? 'total' : 'breakdown';
      if (monthlyPnlView === nextView) return;
      monthlyPnlView = nextView;
      updateMonthlyPnlLegendVisibility();
      renderPerformanceChart({ renderAssets: false, renderPnl: true });
      syncChartViewTabs();
    });
    monthlySelect.dataset.bound = '1';
  }

  syncChartViewTabs();
}

// ===== UI Updates =====
function renderAnnualSummary() {
  const latestMonth = getLatestSavedMonth(currentYear);
  const yearly = calculateYearlyTotals(currentYear);
  const initialCapital = calculateInitialCapital(currentYear);
  const totalAssets = calculateTotalNetAssets(currentYear, latestMonth);
  const confirmedAssets = calculateTotalConfirmedAssets(currentYear, latestMonth);

  const fmtDeltaNumber = (value) => {
    const abs = Math.round(Math.abs(value)).toLocaleString();
    if (value > 0) return `+${abs}`;
    if (value < 0) return `-${abs}`;
    return '0';
  };

  const investmentInitialConfirmedCapital = GROWTH_TARGET_ACCOUNTS.reduce((sum, account) => {
    const fund = Number(yearInitialFunds?.[currentYear]?.[account.key]) || 0;
    return sum + fund;
  }, 0);

  const investmentInitialCapital = GROWTH_TARGET_ACCOUNTS.reduce((sum, account) => {
    const fund = Number(yearInitialFunds?.[currentYear]?.[account.key]) || 0;
    const unreal = Number(yearInitialUnrealized?.[currentYear]?.[account.key]) || 0;
    return sum + fund + unreal;
  }, 0);

  const investmentTotalAssets = GROWTH_TARGET_ACCOUNTS.reduce((sum, account) => {
    return sum + calculateAccountNetAssets(currentYear, latestMonth, account.key);
  }, 0);

  const investmentConfirmedAssets = GROWTH_TARGET_ACCOUNTS.reduce((sum, account) => {
    return sum + calculateAccountConfirmedAssets(currentYear, latestMonth, account.key);
  }, 0);

  const investmentCashflow = GROWTH_TARGET_ACCOUNTS.reduce((acc, account) => {
    for (let m = 1; m <= latestMonth; m += 1) {
      const row = tradingData?.[currentYear]?.[m]?.[account.key] || {};
      acc.deposit += Number(row.deposit) || 0;
      acc.withdraw += Number(row.withdrawal) || 0;
    }
    return acc;
  }, { deposit: 0, withdraw: 0 });

  // 実質損益 = 現在純資産 - 年初純資産 - 累計入金 + 累計出金
  // 年間成長率 = 実質損益 ÷ 年初純資産 × 100
  const realPnL = investmentTotalAssets - investmentInitialCapital - investmentCashflow.deposit + investmentCashflow.withdraw;
  const growthRate = investmentInitialCapital > 0 ? (realPnL / investmentInitialCapital * 100) : 0;
  const confirmedRealPnL = investmentConfirmedAssets - investmentInitialConfirmedCapital - investmentCashflow.deposit + investmentCashflow.withdraw;
  const confirmedGrowthRate = investmentInitialConfirmedCapital > 0 ? (confirmedRealPnL / investmentInitialConfirmedCapital * 100) : 0;
  const netCashFlowYear = yearly.depositSum - yearly.withdrawSum;

  const initialUnrealizedTotal = ACCOUNTS.reduce((sum, a) => {
    return sum + (Number(yearInitialUnrealized?.[currentYear]?.[a.key]) || 0);
  }, 0);

  document.getElementById('yearRealizedSum').textContent = fmtJPY(yearly.realizedSum);
  document.getElementById('yearSwapSum').textContent = fmtJPY(yearly.swapSum);
  document.getElementById('yearInitialCapital').textContent = fmtJPY(initialCapital);
  document.getElementById('yearInitialUnrealizedTotal').textContent = fmtJPY(initialUnrealizedTotal);
  document.getElementById('yearDepositSum').textContent = fmtJPY(yearly.depositSum);
  document.getElementById('yearWithdrawSum').textContent = fmtJPY(yearly.withdrawSum);
  document.getElementById('yearNetCashFlow').textContent = fmtJPY(netCashFlowYear);
  document.getElementById('totalAssets').textContent = fmtJPY(totalAssets);
  document.getElementById('confirmedAssets').textContent = fmtJPY(confirmedAssets);
  document.getElementById('totalAssetsDelta').textContent = fmtDeltaNumber(realPnL);
  document.getElementById('confirmedAssetsDelta').textContent = fmtDeltaNumber(confirmedRealPnL);
  document.getElementById('yearGrowthRate').textContent = (growthRate >= 0 ? '+' : '') + growthRate.toFixed(1) + '%';
  document.getElementById('confirmedYearGrowthRate').textContent = (confirmedGrowthRate >= 0 ? '+' : '') + confirmedGrowthRate.toFixed(1) + '%';

  const elRealized = document.getElementById('yearRealizedSum');
  const elSwap = document.getElementById('yearSwapSum');
  const elInitialUnrealized = document.getElementById('yearInitialUnrealizedTotal');
  const elNetCash = document.getElementById('yearNetCashFlow');
  const elTotalAssetsDelta = document.getElementById('totalAssetsDelta');
  const elConfirmedAssetsDelta = document.getElementById('confirmedAssetsDelta');
  const elGrowth = document.getElementById('yearGrowthRate');
  const elConfirmedGrowth = document.getElementById('confirmedYearGrowthRate');
  const elTotalAssets = document.getElementById('totalAssets');
  const elConfirmedAssets = document.getElementById('confirmedAssets');

  setSignClass(elRealized, yearly.realizedSum);
  setSignClass(elSwap, yearly.swapSum);
  setSignClass(elInitialUnrealized, initialUnrealizedTotal);
  setSignClass(elNetCash, netCashFlowYear);
  setSignClass(elTotalAssetsDelta, realPnL);
  setSignClass(elConfirmedAssetsDelta, confirmedRealPnL);
  setSignClass(elGrowth, growthRate);
  setSignClass(elConfirmedGrowth, confirmedGrowthRate);
  setSignClass(elTotalAssets, totalAssets);
  setSignClass(elConfirmedAssets, confirmedAssets);
}

function renderMonthlyDisplay() {
  const container = document.getElementById('monthlyDisplay');
  container.innerHTML = '';
  
  for (let m = 1; m <= 12; m++) {
    const monthly = calculateMonthlyTotals(currentYear, m);
    const card = document.createElement('div');
    card.className = 'monthly-card' + (m === currentMonth ? ' active' : '');
    card.dataset.month = m;
    
    const totalPnL = monthly.realizedSum + monthly.swapSum;
    card.innerHTML = `
      <div class="monthly-label">${m}月</div>
      <div class="monthly-total-label">合計</div>
      <div class="monthly-total-value" style="color: ${colorBySign(totalPnL)}">${fmtJPY(totalPnL)}</div>
      <div class="monthly-breakdown">
        <div class="monthly-stat-row">
          <span class="monthly-stat">決済</span>
          <span class="monthly-stat-value" style="color: ${colorBySign(monthly.realizedSum)}">${fmtJPY(monthly.realizedSum)}</span>
        </div>
        <div class="monthly-stat-row">
          <span class="monthly-stat">スワップ</span>
          <span class="monthly-stat-value" style="color: ${colorBySign(monthly.swapSum)}">${fmtJPY(monthly.swapSum)}</span>
        </div>
      </div>
    `;
    
    card.addEventListener('click', () => {
      selectMonth(m);
      openMonthlyDetailPane(m);
    });
    container.appendChild(card);
  }
}

function renderMonthlyDetailPane(month = currentMonth) {
  ensureYearMonth(currentYear, month);
  const monthly = calculateMonthlyTotals(currentYear, month);
  const totalPnL = monthly.realizedSum + monthly.swapSum;
  const netCashFlow = monthly.depositSum - monthly.withdrawSum;

  monthlyDetailTitle.textContent = `${month}月 詳細`;

  const accountCards = ACCOUNTS.map(account => {
    const data = tradingData[currentYear][month][account.key] || {};
    const accountTotal = (data.realizedPnL || 0) + (data.swapPnL || 0);
    const accountCashflow = (data.deposit || 0) - (data.withdrawal || 0);
    const netAssets = calculateAccountNetAssets(currentYear, month, account.key);

    if (account.bankOnly) {
      return `
        <div class="detail-account-card detail-account-card-bank">
          <div class="detail-account-head">
            <span class="detail-account-name"><span class="detail-account-dot" style="background:${account.color}"></span>${account.name}</span>
          </div>
          <div class="detail-account-summary">
            <div class="detail-account-summary-label">月末残高</div>
            <div class="detail-account-total" style="color:${colorBySign(netAssets)}">${fmtJPY(netAssets)}</div>
          </div>
          <div class="detail-account-cashflow">
            <div class="detail-account-cashflow-head">
              <span class="k">入出金合計</span>
              <span class="v" style="color:${colorBySign(accountCashflow)}">${fmtJPY(accountCashflow)}</span>
            </div>
            <details class="detail-account-cashflow-details">
              <summary class="detail-account-cashflow-toggle">入出金内訳</summary>
              <div class="detail-account-cashflow-list">
                <div class="item"><span class="k">入金</span><span class="v">${fmtJPY(data.deposit || 0)}</span></div>
                <div class="item"><span class="k">出金</span><span class="v" style="color:${colorBySign(-(data.withdrawal || 0))}">${fmtJPY(data.withdrawal || 0)}</span></div>
              </div>
            </details>
          </div>
        </div>
      `;
    }

    return `
      <div class="detail-account-card">
        <div class="detail-account-head">
          <span class="detail-account-name"><span class="detail-account-dot" style="background:${account.color}"></span>${account.name}</span>
        </div>
        <div class="detail-account-summary">
          <div class="detail-account-summary-label">損益合計</div>
          <div class="detail-account-total" style="color:${colorBySign(accountTotal)}">${fmtJPY(accountTotal)}</div>
          <div class="detail-account-stats">
            <div class="item"><span class="k">決済</span><span class="v" style="color:${colorBySign(data.realizedPnL || 0)}">${fmtJPY(data.realizedPnL || 0)}</span></div>
            <div class="item"><span class="k">スワップ</span><span class="v" style="color:${colorBySign(data.swapPnL || 0)}">${fmtJPY(data.swapPnL || 0)}</span></div>
            <div class="item"><span class="k">評価損益</span><span class="v" style="color:${colorBySign(data.unrealizedPnL || 0)}">${fmtJPY(data.unrealizedPnL || 0)}</span></div>
          </div>
        </div>
        <div class="detail-account-cashflow">
          <div class="detail-account-cashflow-head">
            <span class="k">入出金合計</span>
            <span class="v" style="color:${colorBySign(accountCashflow)}">${fmtJPY(accountCashflow)}</span>
          </div>
          <details class="detail-account-cashflow-details">
            <summary class="detail-account-cashflow-toggle">入出金内訳</summary>
            <div class="detail-account-cashflow-list">
              <div class="item"><span class="k">入金</span><span class="v">${fmtJPY(data.deposit || 0)}</span></div>
              <div class="item"><span class="k">出金</span><span class="v" style="color:${colorBySign(-(data.withdrawal || 0))}">${fmtJPY(data.withdrawal || 0)}</span></div>
            </div>
          </details>
        </div>
        <div class="detail-account-cashflow" style="margin-top:8px; padding-top:8px; border-top:1px solid rgba(255,255,255,.08)">
          <div class="detail-account-cashflow-head">
            <span class="k">時価評価額</span>
            <span class="v" style="color:${colorBySign(netAssets)}">${fmtJPY(netAssets)}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  monthlyDetailBody.innerHTML = `
    <div class="detail-top-grid">
      <div class="detail-summary-card">
        <div class="detail-summary-label">損益合計</div>
        <div class="detail-summary-value" style="color:${colorBySign(totalPnL)}">${fmtJPY(totalPnL)}</div>
        <div class="detail-summary-breakdown">
          <div class="detail-summary-row">
            <span class="detail-summary-stat">決済</span>
            <span class="detail-summary-stat-value" style="color:${colorBySign(monthly.realizedSum)}">${fmtJPY(monthly.realizedSum)}</span>
          </div>
          <div class="detail-summary-row">
            <span class="detail-summary-stat">スワップ</span>
            <span class="detail-summary-stat-value" style="color:${colorBySign(monthly.swapSum)}">${fmtJPY(monthly.swapSum)}</span>
          </div>
          <div class="detail-summary-row">
            <span class="detail-summary-stat">評価損益</span>
            <span class="detail-summary-stat-value" style="color:${colorBySign(monthly.unrealizedSum)}">${fmtJPY(monthly.unrealizedSum)}</span>
          </div>
        </div>
        <div class="detail-account-cashflow" style="margin-top:8px; padding-top:8px; border-top:1px solid rgba(255,255,255,.08)">
          <div class="detail-summary-row">
            <span class="detail-summary-stat">入出金</span>
            <span class="detail-summary-stat-value" style="color:${colorBySign(netCashFlow)}">${fmtJPY(netCashFlow)}</span>
          </div>
        </div>
        <details class="detail-summary-cashflow-details">
          <summary class="detail-summary-cashflow-toggle">入出金内訳</summary>
          <div class="detail-summary-cashflow-list">
            <div class="detail-summary-row">
              <span class="detail-summary-stat">入金</span>
              <span class="detail-summary-stat-value">${fmtJPY(monthly.depositSum)}</span>
            </div>
            <div class="detail-summary-row">
              <span class="detail-summary-stat">出金</span>
              <span class="detail-summary-stat-value" style="color:${colorBySign(-monthly.withdrawSum)}">${fmtJPY(monthly.withdrawSum)}</span>
            </div>
          </div>
        </details>
      </div>
    </div>
    <div class="detail-account-list">${accountCards}</div>
  `;
}

function openMonthlyDetailPane(month = currentMonth) {
  monthlyDetailLockScrollY = window.scrollY || window.pageYOffset || 0;
  renderMonthlyDetailPane(month);
  monthlyDetailPane.classList.add('open');
  monthlyDetailPane.setAttribute('aria-hidden', 'false');
  monthlyDetailScrim.hidden = false;
  document.body.style.position = 'fixed';
  document.body.style.top = -monthlyDetailLockScrollY + 'px';
  document.body.style.width = '100%';
}

function closeMonthlyDetailPane() {
  monthlyDetailPane.classList.remove('open');
  monthlyDetailPane.setAttribute('aria-hidden', 'true');
  monthlyDetailPane.style.transform = '';
  monthlyDetailScrim.hidden = true;
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.width = '';
  window.scrollTo(0, monthlyDetailLockScrollY);
}

function renderMonthTabs() {
  const container = document.getElementById('monthTabs');
  container.innerHTML = '';
  
  for (let m = 1; m <= 12; m++) {
    const btn = document.createElement('button');
    btn.className = 'month-btn' + (m === currentMonth ? ' active' : '');
    btn.textContent = m + '月';
    btn.dataset.month = m;
    btn.addEventListener('click', () => selectMonth(m));
    container.appendChild(btn);
  }
}

function selectMonth(month) {
  currentMonth = month;
  renderMonthlyDisplay();
  renderMonthTabs();
  renderAccountInputs();
  updateYearSelect();
  if (monthlyDetailPane.classList.contains('open')) {
    renderMonthlyDetailPane(month);
  }
}

function renderAccountInputs() {
  const container = document.getElementById('accountInputGrid');
  container.innerHTML = '';
  ensureYearMonth(currentYear, currentMonth);
  
  ACCOUNTS.forEach(account => {
    const data = tradingData[currentYear][currentMonth][account.key] || {};
    const unrealizedLegs = getUnrealizedLegs(currentYear, currentMonth, account.key);
    const unrealizedHelper = UNREALIZED_HELPER_ACCOUNTS.has(account.key)
      ? `
        <div class="unrealized-helper" data-account="${account.key}">
          <div class="unrealized-helper-rows" data-account="${account.key}">
            ${unrealizedLegs.map((v, idx) => createUnrealizedLegRowHtml(account.key, Number(v) || 0, idx)).join('')}
          </div>
          <button type="button" class="unrealized-helper-add" data-account="${account.key}" aria-label="建玉行を追加">＋</button>
        </div>`
      : '';
    
    const card = document.createElement('div');
    card.className = 'account-card';
    const tradingFields = account.bankOnly ? `
        <div class="form-group">
          <label>月末残高</label>
          <input type="number" class="input-account" data-account="${account.key}" data-field="monthEndBalance" value="${Number.isFinite(Number(data.monthEndBalance)) ? Number(data.monthEndBalance) : getBankMonthEndBalance(currentYear, currentMonth, account.key)}" placeholder="0" />
          <span class="suffix">¥</span>
        </div>` : `
        <div class="form-group">
          <label>決済損益</label>
          <input type="number" class="input-account" data-account="${account.key}" data-field="realizedPnL" value="${data.realizedPnL}" placeholder="0" />
          <span class="suffix">¥</span>
        </div>
        <div class="form-group">
          <label>スワップ損益</label>
          <input type="number" class="input-account" data-account="${account.key}" data-field="swapPnL" value="${data.swapPnL}" placeholder="0" />
          <span class="suffix">¥</span>
        </div>
        <div class="form-group">
          <label>評価損益</label>
          <div class="unrealized-input-inline">
            <input type="number" class="input-account${UNREALIZED_HELPER_ACCOUNTS.has(account.key) ? ' unrealized-main-input' : ''}" data-account="${account.key}" data-field="unrealizedPnL" value="${data.unrealizedPnL}" placeholder="0" />
          </div>
          <span class="suffix">¥</span>
        </div>`;
    const cashflowFields = account.bankOnly ? '' : `
        <div class="form-group">
          <label>入金</label>
          <input type="number" class="input-account" data-account="${account.key}" data-field="deposit" value="${data.deposit}" placeholder="0" />
          <span class="suffix">¥</span>
        </div>
        <div class="form-group">
          <label>出金</label>
          <input type="number" class="input-account" data-account="${account.key}" data-field="withdrawal" value="${data.withdrawal}" placeholder="0" />
          <span class="suffix">¥</span>
        </div>`;
    card.innerHTML = `
      <button type="button" class="account-toggle" data-account-toggle="${account.key}" aria-expanded="false">
        <div class="account-title">
          <div class="account-color-dot" style="background-color: ${account.color}"></div>
          ${account.name}
        </div>
        <span class="account-toggle-icon">▼</span>
      </button>
      <div class="account-body" data-account-body="${account.key}">
        ${tradingFields}
        ${unrealizedHelper}
        ${cashflowFields}
      </div>
    `;
    
    container.appendChild(card);
  });
  
  // Attach event listeners
  document.querySelectorAll('.input-account').forEach(el => {
    el.addEventListener('input', updateInputs);
    el.addEventListener('focus', handleAccountInputFocus);
    el.addEventListener('blur', handleAccountInputBlur);
  });

  document.querySelectorAll('.account-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.accountToggle;
      const body = container.querySelector(`[data-account-body="${key}"]`);
      const isOpen = btn.classList.toggle('open');
      btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      if (!body) return;
      if (isOpen) {
        body.classList.add('open');
        requestAnimationFrame(() => {
          body.style.maxHeight = `${body.scrollHeight}px`;
        });
      } else {
        body.style.maxHeight = `${body.scrollHeight}px`;
        requestAnimationFrame(() => {
          body.classList.remove('open');
          body.style.maxHeight = '0px';
        });
      }
    });
  });

  UNREALIZED_HELPER_ACCOUNTS.forEach((accountKey) => {
    reindexUnrealizedLegRows(accountKey);
    resizeAccountBodyForUnrealized(accountKey);
  });

  bindUnrealizedHelperEvents(container);
}

function handleAccountInputFocus(event) {
  const input = event.target;
  if (shouldSelectZeroForOverwrite(input)) input.select();
}

function handleAccountInputBlur(event) {
  const input = event.target;
  if (input.value.trim() === '') {
    input.value = '0';
    updateInputs();
  }
}

function updateInputs() {
  // 入力値をtradingDataに保存
  document.querySelectorAll('.input-account').forEach(el => {
    const account = el.dataset.account;
    const field = el.dataset.field;
    const value = Number(el.value) || 0;
    const normalized = normalizeCashflowValue(field, value);
    tradingData[currentYear][currentMonth][account][field] = normalized;

    // 入出金入力は常に正値で保持
    if ((field === 'deposit' || field === 'withdrawal') && Number(el.value) !== normalized) {
      el.value = normalized;
    }
  });

  applyBankBalanceInputsForMonth(currentYear, currentMonth);

  UNREALIZED_HELPER_ACCOUNTS.forEach((accountKey) => {
    const row = tradingData[currentYear]?.[currentMonth]?.[accountKey];
    if (!row) return;
    if (Array.isArray(row.unrealizedLegs) && row.unrealizedLegs.length > 0) return;
    row.unrealizedBackup = Number(row.unrealizedPnL) || 0;
  });

  // サマリー更新
  renderMonthlyDisplay();
  renderAnnualSummary();
  renderPerformanceChart();
  if (monthlyDetailPane.classList.contains('open')) {
    renderMonthlyDetailPane(currentMonth);
  }
}



function getSelectableYears() {
  const years = new Set([2024, 2025, 2026, currentYear, new Date().getFullYear()]);
  Object.keys(tradingData || {}).forEach(y => years.add(Number(y)));
  Object.keys(yearInitialFunds || {}).forEach(y => years.add(Number(y)));
  const now = new Date().getFullYear();
  years.add(now - 1);
  years.add(now + 1);

  return [...years]
    .filter(y => Number.isInteger(y) && y >= 2000 && y <= 2100)
    .sort((a, b) => b - a);
}

function fillYearOptions(selectEl, years) {
  if (!selectEl) return;
  const selected = String(currentYear);
  selectEl.innerHTML = years
    .map(y => `<option value="${y}">${y}</option>`)
    .join('');
  selectEl.value = selected;
}

function updateYearSelect() {
  const years = getSelectableYears();
  fillYearOptions(document.getElementById('yearDisplay'), years);
  fillYearOptions(document.getElementById('yearSelect'), years);
}

function bindInitialCapitalInputBehavior() {
  document.querySelectorAll('.initial-capital-outside .account-initial-grid input[type="number"]').forEach((input) => {
    if (input.dataset.zeroInputBound === '1') return;

    const selectZeroValue = () => {
      if (input.value === '0') input.select();
    };

    input.addEventListener('focus', selectZeroValue);
    input.addEventListener('click', selectZeroValue);
    input.dataset.zeroInputBound = '1';
  });
}

function renderInitialCapitalForm() {
  if (!yearInitialFunds[currentYear]) yearInitialFunds[currentYear] = {};
  if (!yearInitialUnrealized[currentYear]) yearInitialUnrealized[currentYear] = {};

  updateYearSelect();

  const accountKeys = {
    'initGMO': 'gmo',
    'initLightFX': 'lightfx',
    'initMinano': 'minano',
    'initSBI': 'sbi',
    'initSBIVC': 'sbivc',
    'initSMBC': 'smbc'
  };
  const unrealizedKeys = {
    'initGMOUnrealized': 'gmo',
    'initLightFXUnrealized': 'lightfx',
    'initMinanoUnrealized': 'minano',
    'initSBIUnrealized': 'sbi',
    'initSBIVCUnrealized': 'sbivc'
  };

  const prevYear = currentYear - 1;

  // 年初確定資金（未設定時は前年度12月の確定資産をデフォルト）
  for (const [elemId, accountKey] of Object.entries(accountKeys)) {
    let val = yearInitialFunds[currentYear][accountKey];
    if (typeof val !== 'number') {
      val = calculateAccountConfirmedAssets(prevYear, 12, accountKey);
    }
    document.getElementById(elemId).value = Number(val) || 0;
  }

  // 年初評価損益（前年度年末の評価損益をデフォルト）
  for (const [elemId, accountKey] of Object.entries(unrealizedKeys)) {
    let val = yearInitialUnrealized[currentYear][accountKey];
    if (typeof val !== 'number') {
      // 前年度年末12月の評価損益
      val = 0;
      if (tradingData?.[prevYear]?.[12]?.[accountKey]?.unrealizedPnL != null) {
        val = Number(tradingData[prevYear][12][accountKey].unrealizedPnL) || 0;
      }
    }
    document.getElementById(elemId).value = val;
  }

  bindInitialCapitalInputBehavior();
  updateInitialCapitalStatus();
}

function updateInitialCapitalStatus() {
  const total = calculateInitialCapital(currentYear);
  const status = document.getElementById('initialCapitalStatus');
  status.textContent = total > 0 ? fmtJPY(total) : '-';
}

function hasAnyInitialCapital(year) {
  const funds = yearInitialFunds[year] || {};
  return ACCOUNTS.some(account => Number(funds[account.key] || 0) !== 0);
}

function setInitialCapitalPanelOpen(open) {
  const header = document.getElementById('initialCapitalToggle');
  const content = document.getElementById('initialCapitalContent');
  if (!header || !content) return;
  header.classList.toggle('open', open);
  content.classList.toggle('open', open);
}

function applyInitialCapitalDefaultOpen() {
  const shouldOpen = !hasAnyInitialCapital(currentYear);
  setInitialCapitalPanelOpen(shouldOpen);
  if (shouldOpen) {
    renderInitialCapitalForm();
  }
}

// ===== Event Handlers =====
document.getElementById('yearDisplay').addEventListener('change', (e) => {
  currentYear = Number(e.target.value);
  setSharedSelectedYear(currentYear);
  renderAll();
  applyInitialCapitalDefaultOpen();
});

document.getElementById('yearSelect').addEventListener('change', (e) => {
  currentYear = Number(e.target.value);
  setSharedSelectedYear(currentYear);
  renderAll();
  applyInitialCapitalDefaultOpen();
});

document.getElementById('initialCapitalToggle').addEventListener('click', (e) => {
  const header = e.currentTarget;
  const content = document.getElementById('initialCapitalContent');
  
  header.classList.toggle('open');
  content.classList.toggle('open');
  
  if (content.classList.contains('open')) {
    renderInitialCapitalForm();
  }
});

document.getElementById('saveInitialCapital').addEventListener('click', () => {
  const year = Number(document.getElementById('yearSelect').value);
  if (!yearInitialFunds[year]) yearInitialFunds[year] = {};
  if (!yearInitialUnrealized[year]) yearInitialUnrealized[year] = {};

  const accountKeys = {
    'initGMO': 'gmo',
    'initLightFX': 'lightfx',
    'initMinano': 'minano',
    'initSBI': 'sbi',
    'initSBIVC': 'sbivc',
    'initSMBC': 'smbc'
  };
  const unrealizedKeys = {
    'initGMOUnrealized': 'gmo',
    'initLightFXUnrealized': 'lightfx',
    'initMinanoUnrealized': 'minano',
    'initSBIUnrealized': 'sbi',
    'initSBIVCUnrealized': 'sbivc'
  };

  for (const [elemId, accountKey] of Object.entries(accountKeys)) {
    yearInitialFunds[year][accountKey] = Number(document.getElementById(elemId).value) || 0;
  }
  for (const [elemId, accountKey] of Object.entries(unrealizedKeys)) {
    yearInitialUnrealized[year][accountKey] = Number(document.getElementById(elemId).value) || 0;
  }

  saveToStorage();
  updateInitialCapitalStatus();
  renderAnnualSummary();
  renderPerformanceChart();
  renderAccountInputs();

  const toast = document.createElement('div');
  toast.style.cssText = 'position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); background: rgba(62,224,143,.2); color: #3EE08F; padding: 10px 20px; border-radius: 8px; border: 1px solid rgba(62,224,143,.3); font-size: 12px; font-weight: 600; z-index: 100;';
  toast.textContent = '✔ 年初資金・評価損益を保存しました';
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
});

document.getElementById('exportDataBtn')?.addEventListener('click', exportData);
document.getElementById('importDataInput')?.addEventListener('change', (e) => {
  importData(e.target.files[0]);
  e.target.value = '';
});

document.getElementById('saveMonthData').addEventListener('click', () => {
  const confirmed = window.confirm('現在の入力データを保存します。');
  if (!confirmed) return;

  document.querySelectorAll('.input-account').forEach(el => {
    const account = el.dataset.account;
    const field = el.dataset.field;
    const value = Number(el.value) || 0;
    tradingData[currentYear][currentMonth][account][field] = normalizeCashflowValue(field, value);
  });

  tradingData[currentYear][currentMonth].__saved = true;

  applyBankBalanceInputsForMonth(currentYear, currentMonth);
  
  saveToStorage();
  renderAnnualSummary();
  renderPerformanceChart();
  renderMonthlyDisplay();
  if (monthlyDetailPane.classList.contains('open')) {
    renderMonthlyDetailPane(currentMonth);
  }
  
  const toast = document.createElement('div');
  toast.style.cssText = 'position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); background: rgba(62,224,143,.2); color: #3EE08F; padding: 10px 20px; border-radius: 8px; border: 1px solid rgba(62,224,143,.3); font-size: 12px; font-weight: 600; z-index: 100;';
  toast.textContent = '✔ 現在の入力データを保存しました';
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
});

monthlyDetailClose?.addEventListener('click', closeMonthlyDetailPane);
monthlyDetailScrim?.addEventListener('click', closeMonthlyDetailPane);

// ===== Month Detail Pane Swipe Gesture =====
(() => {
  if (!monthlyDetailPane) return;
  let startX = 0;
  let startY = 0;
  let canDismissBySwipe = false;
  let isTracking = false;
  let startedFromHeader = false;

  monthlyDetailPane.addEventListener('touchstart', (e) => {
    if (!monthlyDetailPane.classList.contains('open')) return;
    if (e.touches.length !== 1) return;
    monthlyDetailPane.style.transform = '';
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const scrollEl = monthlyDetailBody || monthlyDetailPane;
    const canScroll = scrollEl.scrollHeight > scrollEl.clientHeight + 1;
    const atTop = scrollEl.scrollTop <= 2;
    const target = e.target;
    startedFromHeader = target instanceof Element ? !!target.closest('.monthly-detail-head') : false;

    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    // モバイルは「ヘッダー開始」または「本文が上端」の時のみ格納ジェスチャーを許可
    canDismissBySwipe = isMobile ? (startedFromHeader || !canScroll || atTop) : true;
    isTracking = canDismissBySwipe;
    if (isTracking) {
      monthlyDetailPane.style.transition = 'none';
    }
  }, { passive: true });

  monthlyDetailPane.addEventListener('touchmove', (e) => {
    if (!isTracking) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    
    if (isMobile && canDismissBySwipe) {
      const scrollEl = monthlyDetailBody || monthlyDetailPane;
      const canScroll = scrollEl.scrollHeight > scrollEl.clientHeight + 1;
      const atTop = scrollEl.scrollTop <= 2;
      // 本文開始かつ上端を離れている場合は格納ジェスチャーを中断（スクロールを優先）
      if (!startedFromHeader && canScroll && !atTop) {
        isTracking = false;
        monthlyDetailPane.style.transition = '';
        monthlyDetailPane.style.transform = '';
        return;
      }
      // 許可条件下でのみ下スワイプでペインを追従
      if (dy > 0 && Math.abs(dy) > Math.abs(dx)) {
        monthlyDetailPane.style.transform = `translateY(${Math.min(dy, 220)}px)`;
      }
    } else if (!isMobile && dx > 0 && Math.abs(dx) > Math.abs(dy)) {
      monthlyDetailPane.style.transform = `translateX(${Math.min(dx, 220)}px)`;
    }
  }, { passive: true });

  monthlyDetailPane.addEventListener('touchend', (e) => {
    if (!isTracking) return;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const dx = endX - startX;
    const dy = endY - startY;
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const shouldClose = isMobile
      ? (canDismissBySwipe && dy > 108 && Math.abs(dy) > Math.abs(dx) * 0.98)
      : (dx > 120 && Math.abs(dx) > Math.abs(dy) * 1.1);
    monthlyDetailPane.style.transition = '';
    if (shouldClose) closeMonthlyDetailPane();
    else monthlyDetailPane.style.transform = '';
    isTracking = false;
    canDismissBySwipe = false;
    startedFromHeader = false;
  });
})();

// iPad等でMonth Detail Paneのスクロールが背景へ伝播するのを防ぐ
(() => {
  if (!monthlyDetailPane) return;
  let lastY = 0;

  monthlyDetailPane.addEventListener('touchstart', (e) => {
    if (!monthlyDetailPane.classList.contains('open')) return;
    if (e.touches.length !== 1) return;
    lastY = e.touches[0].clientY;
  }, { passive: true });

  monthlyDetailPane.addEventListener('touchmove', (e) => {
    if (!monthlyDetailPane.classList.contains('open')) return;
    // モバイル(bottom sheet)は既存の閉じジェスチャー制御に任せる。
    if (window.matchMedia('(max-width: 768px)').matches) return;
    if (e.touches.length !== 1) return;

    const currentY = e.touches[0].clientY;
    const dy = currentY - lastY;
    lastY = currentY;

    const scrollEl = monthlyDetailBody || monthlyDetailPane;
    const canScroll = scrollEl.scrollHeight > scrollEl.clientHeight + 1;
    const atTop = scrollEl.scrollTop <= 1;
    const atBottom = scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 1;

    if (!canScroll || (atTop && dy > 0) || (atBottom && dy < 0)) {
      e.preventDefault();
    }
  }, { passive: false });
})();

// Month Detail Pane表示中は、パネル外タッチで背景のスクロールを発生させない
document.addEventListener('touchmove', (e) => {
  if (!monthlyDetailPane?.classList.contains('open')) return;
  if (!monthlyDetailPane.contains(e.target)) {
    e.preventDefault();
  }
}, { passive: false });

document.getElementById('clearStoredData')?.addEventListener('click', () => {
  const confirmed = window.confirm('保存済みの損益データを削除します。よろしいですか？');
  if (!confirmed) return;

  localStorage.removeItem(STORAGE_KEY_TRADING);
  localStorage.removeItem(STORAGE_KEY_INITIAL);
  localStorage.setItem(STORAGE_KEY_SKIP_DEMO, '1');
  clearStoredDataState();
  rerenderAfterDataChange();

  const toast = document.createElement('div');
  toast.style.cssText = 'position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); background: rgba(255,107,107,.16); color: #ffd7d7; padding: 10px 20px; border-radius: 8px; border: 1px solid rgba(255,107,107,.3); font-size: 12px; font-weight: 600; z-index: 100;';
  toast.textContent = '保存データを削除しました';
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
});

document.getElementById('reloadDemoData')?.addEventListener('click', () => {
  const confirmed = window.confirm('現在の保存データを消してダミーデータを再投入します。よろしいですか？');
  if (!confirmed) return;

  localStorage.removeItem(STORAGE_KEY_TRADING);
  localStorage.removeItem(STORAGE_KEY_INITIAL);
  localStorage.removeItem(STORAGE_KEY_SKIP_DEMO);
  clearStoredDataState();
  seedDemoDataIfEmpty();
  rerenderAfterDataChange();

  const toast = document.createElement('div');
  toast.style.cssText = 'position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); background: rgba(62,224,143,.2); color: #3EE08F; padding: 10px 20px; border-radius: 8px; border: 1px solid rgba(62,224,143,.3); font-size: 12px; font-weight: 600; z-index: 100;';
  toast.textContent = 'ダミーデータを再投入しました';
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
});

// ===== Initialization =====
function renderAll() {
  updateYearSelect();
  renderAnnualSummary();
  renderPerformanceChart();
  bindChartViewControls();
  renderMonthlyDisplay();
  renderMonthTabs();
  renderAccountInputs();
  renderInitialCapitalForm();
}

window.addEventListener('load', () => {
  loadFromStorage();
  seedDemoDataIfEmpty();
  const sharedYear = getSharedSelectedYear();
  if (sharedYear) {
    currentYear = sharedYear;
  }
  setSharedSelectedYear(currentYear);
  currentMonth = new Date().getMonth() + 1;
  renderAll();
  applyInitialCapitalDefaultOpen();
});
