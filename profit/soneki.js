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

function buildPnlBarAnimation() {
  return {
    duration: 1350,
    easing: 'easeInOutQuad',
    delay: (ctx) => {
      let delay = 0;
      if (ctx.type === 'data') {
        delay = ctx.dataIndex * 12 + ctx.datasetIndex * 24;
      } else if (ctx.type !== 'none') {
        delay = ctx.datasetIndex * 40;
      }
      return delay;
    }
  };
}

function isElementInViewport(el) {
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  return rect.bottom > 0 && rect.top < window.innerHeight;
}

function playPnlBarReveal(chart) {
  if (!chart) return;
  chart.options.animation = buildPnlBarAnimation();
  chart.reset();
  chart.update();
}

function bindPnlBarRevealToSection(section) {
  if (!section || section.dataset.pnlRevealBound === '1') return;
  section.dataset.pnlRevealBound = '1';
  section.addEventListener('animationstart', (e) => {
    if (e.animationName !== 'section-reveal') return;
    playPnlBarReveal(pnlBarChart);
  });
}

function bindAssetsTrendRevealToSection(section) {
  if (!section || section.dataset.assetsRevealBound === '1') return;
  section.dataset.assetsRevealBound = '1';
  section.addEventListener('animationstart', (e) => {
    if (e.animationName !== 'section-reveal') return;
    playLaserReveal(assetsTrendChart, 2300);
  });
}

const displayAccountName = window.TradeScopeAccountUI.displayAccountName;
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
const profitMetrics = window.TradeScopeProfitMetrics || {};

function getUnrealizedLegs(year, month, accountKey) {
  const row = tradingData[year]?.[month]?.[accountKey] || {};
  return Array.isArray(row.unrealizedLegs) ? [...row.unrealizedLegs] : [];
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
      addBtn.style.visibility = idx === rows.length - 1 ? 'visible' : 'hidden';
    }
  });

  const helperAddBtn = document.querySelector(`.unrealized-helper-add[data-account="${accountKey}"]`);
  if (helperAddBtn) {
    helperAddBtn.style.visibility = rows.length === 0 ? 'visible' : 'hidden';
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
const sbiInput = window.TradeScopeSbiInput;
const sbiInputDrafts = sbiInput.createDrafts();
let sbiInputView = { mode: 'legacy' };
const inputTargetMonth = () => `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
const usesSbiDraft = () => sbiInputView.mode === 'draft';

// ===== Storage =====
const STORAGE_KEY_TRADING = 'tradingData';
const STORAGE_KEY_INITIAL = 'yearInitialFunds';
const STORAGE_KEY_INITIAL_UNREALIZED = 'yearInitialUnrealized';
const STORAGE_KEY_TOP_SUMMARY_SNAPSHOT = 'tradeScopeTopSummarySnapshotV1';
const STORAGE_KEY_SKIP_DEMO = 'profitSkipDemoSeed';
const SHARED_SELECTED_YEAR_KEY = 'tradeScopeSelectedYear';
const PROFIT_BASE_YEAR = 2025;

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
  saveTopSummarySnapshot(currentYear);
}

function loadFromStorage() {
  sbiInputDrafts.clear();
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
    if (a.key === 'sbi' && year === currentYear && month === currentMonth && usesSbiDraft()) return;
    if (!tradingData[year][month][a.key]) {
      tradingData[year][month][a.key] = {};
    }
  });
}

function calculateMonthlyTotals(year, month) {
  const yearData = tradingData?.[year] || tradingData?.[String(year)] || {};
  const accountKeys = ACCOUNTS.map((account) => account.key);
  const fieldTotal = (field) => profitMetrics?.calculateMonthlyFieldTotal
    ? profitMetrics.calculateMonthlyFieldTotal(yearData, month, accountKeys, field)
    : null;
  return {
    isEntered: hasMeaningfulMonthData(year, month),
    realizedSum: fieldTotal('realizedPnL'),
    swapSum: fieldTotal('swapPnL'),
    unrealizedSum: fieldTotal('unrealizedPnL'),
    depositSum: fieldTotal('deposit'),
    withdrawSum: fieldTotal('withdrawal')
  };
}

function calculateYearlyTotals(year) {
  let result = { realizedSum: 0, swapSum: 0, depositSum: 0, withdrawSum: 0 };
  const hasValue = { realizedSum: false, swapSum: false, depositSum: false, withdrawSum: false };
  for (let m = 1; m <= 12; m++) {
    const monthly = calculateMonthlyTotals(year, m);
    for (const key of Object.keys(hasValue)) {
      if (!Number.isFinite(monthly[key])) continue;
      result[key] += monthly[key];
      hasValue[key] = true;
    }
  }
  for (const key of Object.keys(hasValue)) {
    if (!hasValue[key]) result[key] = null;
  }
  return result;
}

function calculateAccountNetAssets(year, month, accountKey) {
  if (ACCOUNTS.find((account) => account.key === accountKey)?.bankOnly) {
    return calculateAccountConfirmedAssets(year, month, accountKey);
  }
  if (profitMetrics?.calculateAccountNetAssets) {
    return profitMetrics.calculateAccountNetAssets(tradingData, yearInitialFunds, year, month, accountKey);
  }

  const initialFund = yearInitialFunds?.[year]?.[accountKey] || 0;

  let cumulative = { realized: 0, swap: 0, deposit: 0, withdrawal: 0 };
  for (let m = 1; m <= month; m++) {
    const accData = tradingData[year]?.[m]?.[accountKey] || {};
    const realized = getStoredNumber(accData, 'realizedPnL');
    const swap = getStoredNumber(accData, 'swapPnL');
    const deposit = getStoredNumber(accData, 'deposit');
    const withdrawal = getStoredNumber(accData, 'withdrawal');
    if (Number.isFinite(realized)) cumulative.realized += realized;
    if (Number.isFinite(swap)) cumulative.swap += swap;
    if (Number.isFinite(deposit)) cumulative.deposit += deposit;
    if (Number.isFinite(withdrawal)) cumulative.withdrawal += withdrawal;
  }

  const currentRow = tradingData[year]?.[month]?.[accountKey] || {};
  if (!Object.prototype.hasOwnProperty.call(currentRow, 'unrealizedPnL')) return null;
  const currentMonthUnrealized = Number(currentRow.unrealizedPnL);
  if (!Number.isFinite(currentMonthUnrealized)) return null;
  return initialFund + cumulative.realized + cumulative.swap + cumulative.deposit - cumulative.withdrawal + currentMonthUnrealized;
}

function calculateAccountConfirmedAssets(year, month, accountKey) {
  if (profitMetrics?.calculateAccountConfirmedAssets) {
    return profitMetrics.calculateAccountConfirmedAssets(tradingData, yearInitialFunds, year, month, accountKey);
  }

  const initialFund = yearInitialFunds?.[year]?.[accountKey] || 0;

  let cumulative = { realized: 0, swap: 0, deposit: 0, withdrawal: 0 };
  for (let m = 1; m <= month; m++) {
    const accData = tradingData[year]?.[m]?.[accountKey] || {};
    const realized = getStoredNumber(accData, 'realizedPnL');
    const swap = getStoredNumber(accData, 'swapPnL');
    const deposit = getStoredNumber(accData, 'deposit');
    const withdrawal = getStoredNumber(accData, 'withdrawal');
    if (Number.isFinite(realized)) cumulative.realized += realized;
    if (Number.isFinite(swap)) cumulative.swap += swap;
    if (Number.isFinite(deposit)) cumulative.deposit += deposit;
    if (Number.isFinite(withdrawal)) cumulative.withdrawal += withdrawal;
  }

  return initialFund + cumulative.realized + cumulative.swap + cumulative.deposit - cumulative.withdrawal;
}

function getBankMonthEndBalance(year, month, accountKey) {
  const row = tradingData?.[year]?.[month]?.[accountKey] || {};
  const stored = getStoredNumber(row, 'monthEndBalance');
  if (Number.isFinite(stored)) return stored;
  return calculateAccountNetAssets(year, month, accountKey);
}

function applyBankBalanceInputsForMonth(year, month) {
  ensureYearMonth(year, month);

  ACCOUNTS.filter((account) => account.bankOnly).forEach((account) => {
    const row = tradingData[year][month][account.key];
    const monthEndBalance = getStoredNumber(row, 'monthEndBalance');
    if (!Number.isFinite(monthEndBalance)) return;

    const prevBalance = month === 1
      ? (Number(yearInitialFunds?.[year]?.[account.key]) || 0)
      : getBankMonthEndBalance(year, month - 1, account.key);

    const diff = monthEndBalance - (Number.isFinite(prevBalance) ? prevBalance : 0);

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
    const value = calculateAccountNetAssets(year, month, a.key);
    if (!Number.isFinite(value)) total = null;
    else if (total !== null) total += value;
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

function calculateInitialCapital(year, accountsFilter = null) {
  const targetAccounts = accountsFilter || ACCOUNTS;
  let total = 0;
  if (yearInitialFunds[year]) {
    targetAccounts.forEach(a => {
      total += yearInitialFunds[year][a.key] || 0;
    });
  }
  return total;
}

function hasMeaningfulMonthData(year, month) {
  const yearData = tradingData?.[year] || tradingData?.[String(year)] || {};
  if (profitMetrics?.isMonthEntered) {
    return profitMetrics.isMonthEntered(yearData, month, ACCOUNTS.map((account) => account.key));
  }
  return false;
}

function hasStoredAccountValues(yearRecord) {
  if (!yearRecord || typeof yearRecord !== 'object' || Array.isArray(yearRecord)) return false;
  return ACCOUNTS.some((account) => {
    if (!Object.prototype.hasOwnProperty.call(yearRecord, account.key)) return false;
    const value = yearRecord[account.key];
    if (typeof value === 'number') return Number.isFinite(value);
    return typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value));
  });
}

function hasStoredYearData(year) {
  const hasMonthlyData = Array.from({ length: 12 }, (_, index) => index + 1)
    .some((month) => hasMeaningfulMonthData(year, month));
  return hasMonthlyData
    || hasStoredAccountValues(yearInitialFunds?.[year])
    || hasStoredAccountValues(yearInitialUnrealized?.[year]);
}

function getLatestSavedMonth(year) {
  const yearData = tradingData?.[year] || tradingData?.[String(year)] || {};
  if (profitMetrics?.getLatestEnteredMonth) {
    return profitMetrics.getLatestEnteredMonth(yearData, ACCOUNTS.map((account) => account.key));
  }
  return null;
}

function readTopSummarySnapshotStore() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY_TOP_SUMMARY_SNAPSHOT) || '{}');
  } catch {
    return {};
  }
}

function writeTopSummarySnapshotStore(store) {
  localStorage.setItem(STORAGE_KEY_TOP_SUMMARY_SNAPSHOT, JSON.stringify(store || {}));
}

function buildTopSummarySnapshotForYear(year) {
  const latestMonth = getLatestSavedMonth(year);
  if (!latestMonth) return null;
  const realized = [];
  const total = [];

  for (let month = 1; month <= 12; month += 1) {
    const isEntered = hasMeaningfulMonthData(year, month);
    realized.push(isEntered ? calculateTotalConfirmedAssets(year, month) : null);
    total.push(isEntered ? calculateTotalNetAssets(year, month) : null);
  }

  const growthAccounts = GROWTH_TARGET_ACCOUNTS;
  const chartStartTotal = calculateInitialCapital(year);
  const chartStartTotalWithUnrealized = chartStartTotal + ACCOUNTS.reduce((sum, account) => {
    return sum + (Number(yearInitialUnrealized?.[year]?.[account.key]) || 0);
  }, 0);

  const yearStartConfirmed = calculateInitialCapital(year, growthAccounts);
  const yearStartTotal = yearStartConfirmed + growthAccounts.reduce((sum, account) => {
    return sum + (Number(yearInitialUnrealized?.[year]?.[account.key]) || 0);
  }, 0);

  let cumulativeDeposits = 0;
  let cumulativeWithdrawals = 0;
  const performanceConfirmedSeries = [0];
  const performanceTotalSeries = [0];

  for (let month = 1; month <= 12; month += 1) {
    if (!hasMeaningfulMonthData(year, month)) {
      performanceConfirmedSeries.push(null);
      performanceTotalSeries.push(null);
      continue;
    }

    growthAccounts.forEach((account) => {
      const row = tradingData?.[year]?.[month]?.[account.key] || {};
      cumulativeDeposits += Number(row.deposit) || 0;
      cumulativeWithdrawals += Number(row.withdrawal) || 0;
    });

    const growthConfirmedMonth = growthAccounts.reduce((sum, account) => {
      return sum + calculateAccountConfirmedAssets(year, month, account.key);
    }, 0);
    const growthTotalValues = growthAccounts.map((account) => calculateAccountNetAssets(year, month, account.key));
    const growthTotalMonth = growthTotalValues.every(Number.isFinite)
      ? growthTotalValues.reduce((sum, value) => sum + value, 0)
      : null;

    performanceConfirmedSeries.push(growthConfirmedMonth - yearStartConfirmed - cumulativeDeposits + cumulativeWithdrawals);
    performanceTotalSeries.push(Number.isFinite(growthTotalMonth)
      ? growthTotalMonth - yearStartTotal - cumulativeDeposits + cumulativeWithdrawals
      : null);
  }

  const growthCurrentConfirmed = growthAccounts.reduce((sum, account) => {
    return sum + calculateAccountConfirmedAssets(year, latestMonth, account.key);
  }, 0);
  const growthCurrentTotalValues = growthAccounts.map((account) => calculateAccountNetAssets(year, latestMonth, account.key));
  const growthCurrentTotal = growthCurrentTotalValues.every(Number.isFinite)
    ? growthCurrentTotalValues.reduce((sum, value) => sum + value, 0)
    : null;

  const accountData = ACCOUNTS.map((account) => {
    const amount = calculateAccountNetAssets(year, latestMonth, account.key);
    return {
      label: account.name,
      amount: Number.isFinite(amount) ? Math.max(0, amount) : null,
      color: account.color
    };
  }).filter((item) => Number.isFinite(item.amount) && item.amount > 0);

  return {
    year,
    month: latestMonth,
    realized,
    total,
    accountData,
    yearStartTotal,
    yearStartConfirmed,
    growthCurrentTotal,
    growthCurrentConfirmed,
    chartStartTotal,
    chartStartTotalWithUnrealized,
    cumulativeDeposits,
    cumulativeWithdrawals,
    performanceConfirmedSeries,
    performanceTotalSeries,
    sourceFingerprint: profitMetrics?.createYearSourceFingerprint
      ? profitMetrics.createYearSourceFingerprint(tradingData, yearInitialFunds, yearInitialUnrealized, year)
      : null,
    updatedAt: Date.now()
  };
}

function saveTopSummarySnapshot(year) {
  if (!Number.isFinite(Number(year))) return;
  const store = readTopSummarySnapshotStore();
  const snapshot = buildTopSummarySnapshotForYear(Number(year));
  if (snapshot) store[String(year)] = snapshot;
  else delete store[String(year)];
  writeTopSummarySnapshotStore(store);
}

// ===== Holdings (保有明細) Management =====
function getCryptoSymbolsFromHistory() {
  const historyCore = window.TradeScopeHistory;
  if (!historyCore?.parseEntries) return [];
  
  const entries = historyCore.parseEntries();
  const cryptoSymbols = new Set();
  
  entries.forEach((entry) => {
    if (entry.assetType === '暗号資産' && entry.symbol) {
      // ETH/JPY → ETH に変換
      const baseSymbol = entry.symbol.split('/')[0].trim().toUpperCase();
      cryptoSymbols.add(baseSymbol);
    }
  });
  
  return Array.from(cryptoSymbols).sort();
}

function getAccountNameByKey(accountKey) {
  return ACCOUNTS.find((account) => account.key === accountKey)?.name || '';
}

function isMatchedSbiAccount(accountName) {
  const normalized = String(accountName || '').toUpperCase().replace(/\s+/g, '');
  return normalized === 'SBI' || normalized.includes('SBI証券');
}

function getMergedSecuritiesOpenPositionMap() {
  const historyCore = window.TradeScopeHistory;
  const result = new Map();
  if (!historyCore?.parseEntries || !historyCore?.calculateOpenPositions) return result;

  const entries = historyCore.parseEntries();
  const openPositions = historyCore.calculateOpenPositions(entries);
  const quantityBySymbol = new Map();

  const isSecurityLikePosition = (position) => {
    const symbol = String(position?.symbol || '').trim();
    if (!symbol) return false;

    const normalizedAsset = String(position?.assetType || '').trim().toUpperCase();
    if (normalizedAsset === 'FX') return false;
    if (symbol.includes('/')) return false;
    return true;
  };

  openPositions.forEach((position) => {
    if (!isSecurityLikePosition(position)) return;
    const symbol = String(position.symbol || '').trim();
    if (!symbol) return;

    const signedQty = position.side === 'sell'
      ? -Math.abs(Number(position.absQuantity) || 0)
      : Math.abs(Number(position.absQuantity) || 0);
    const nextQty = (quantityBySymbol.get(symbol) || 0) + signedQty;
    quantityBySymbol.set(symbol, nextQty);
  });

  quantityBySymbol.forEach((qty, symbol) => {
    if (qty > 1e-12) result.set(symbol, qty);
  });

  return result;
}

function toSafeNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const normalized = String(value ?? '').replace(/,/g, '').trim();
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getSbiSecuritiesQuantityMapFromRawStorage() {
  const result = new Map();
  let rawEntries = [];

  try {
    const parsed = JSON.parse(localStorage.getItem('tradeScopeTradeHistoryV1') || '[]');
    if (Array.isArray(parsed)) rawEntries = parsed;
  } catch {
    rawEntries = [];
  }

  rawEntries.forEach((entry) => {
    const account = String(entry?.account || '').trim();
    if (!isMatchedSbiAccount(account)) return;

    const symbol = String(entry?.symbol || '').trim();
    if (!symbol || symbol.includes('/')) return;

    const rawAssetType = String(entry?.assetType || '').trim().toUpperCase();
    if (rawAssetType === 'FX') return;

    const qty = toSafeNumber(entry?.quantity);
    if (qty <= 0) return;

    const side = entry?.side === 'sell' ? 'sell' : 'buy';
    const signed = side === 'sell' ? -qty : qty;
    const next = (result.get(symbol) || 0) + signed;
    result.set(symbol, next);
  });

  const positiveOnly = new Map();
  result.forEach((qty, symbol) => {
    if (qty > 1e-12) positiveOnly.set(symbol, qty);
  });
  return positiveOnly;
}

function getSecuritiesOpenPositionMap(accountKey = 'sbi') {
  const historyCore = window.TradeScopeHistory;
  const accountName = getAccountNameByKey(accountKey);
  const result = new Map();
  if (!accountName || !historyCore?.parseEntries || !historyCore?.calculateOpenPositions) return result;

  // SBIはOpen Positionsの証券建玉集約を最優先で採用（口座名ゆれの影響を受けない）
  if (accountKey === 'sbi') {
    const rawSbiMap = getSbiSecuritiesQuantityMapFromRawStorage();
    if (rawSbiMap.size > 0) return rawSbiMap;

    const merged = getMergedSecuritiesOpenPositionMap();
    if (merged.size > 0) return merged;
  }

  const matchAccount = (value) => {
    if (accountKey !== 'sbi') return value === accountName;
    return isMatchedSbiAccount(value);
  };

  const isSecurityLikePosition = (position) => {
    const symbol = String(position?.symbol || '').trim();
    if (!symbol) return false;

    const normalizedAsset = String(position?.assetType || '').trim().toUpperCase();
    if (normalizedAsset === 'FX') return false;
    if (symbol.includes('/')) return false;
    return true;
  };

  const openPositions = historyCore.calculateOpenPositions(historyCore.parseEntries());
  openPositions.forEach((position) => {
    if (!matchAccount(position.account)) return;
    if (!isSecurityLikePosition(position)) return;
    const symbol = String(position.symbol || '').trim();
    const qty = Number(position.absQuantity) || 0;
    if (!symbol || qty <= 0) return;
    result.set(symbol, qty);
  });

  if (result.size > 0) return result;

  // Fallback: 履歴明細から数量を再集計（口座名ゆれ対応）
  const entries = historyCore.parseEntries();
  const sorted = historyCore.getSortedEntries
    ? historyCore.getSortedEntries(entries, 'oldest')
    : [...entries].sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
  const quantityBySymbol = new Map();

  sorted.forEach((entry) => {
    if (!matchAccount(entry.account)) return;
    const assetType = String(entry.assetType || '').trim();
    if (assetType !== '証券' && assetType !== 'NISA') return;
    const symbol = String(entry.symbol || '').trim();
    const qty = Number(entry.quantity) || 0;
    if (!symbol || qty <= 0) return;

    const signed = entry.side === 'sell' ? -qty : qty;
    const next = (quantityBySymbol.get(symbol) || 0) + signed;
    quantityBySymbol.set(symbol, next);
  });

  quantityBySymbol.forEach((qty, symbol) => {
    if (qty > 1e-12) result.set(symbol, qty);
  });

  if (result.size > 0) return result;

  return result;
}

function getSecuritiesSymbolsFromHistory(accountKey = 'sbi') {
  const historyCore = window.TradeScopeHistory;
  const accountName = getAccountNameByKey(accountKey);
  const openQtyMap = getSecuritiesOpenPositionMap(accountKey);
  if (!accountName || !historyCore?.parseEntries) return Array.from(openQtyMap.keys());

  const matchAccount = (value) => {
    if (accountKey !== 'sbi') return value === accountName;
    return isMatchedSbiAccount(value);
  };

  const entries = historyCore.parseEntries();
  const sorted = historyCore.getSortedEntries
    ? historyCore.getSortedEntries(entries, 'oldest')
    : [...entries].sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));

  const ordered = [];
  const seen = new Set();
  sorted.forEach((entry) => {
    if (!matchAccount(entry.account)) return;
    const symbol = String(entry.symbol || '').trim();
    if (!symbol || seen.has(symbol)) return;
    if (!openQtyMap.has(symbol)) return;
    seen.add(symbol);
    ordered.push(symbol);
  });

  openQtyMap.forEach((_qty, symbol) => {
    if (seen.has(symbol)) return;
    seen.add(symbol);
    ordered.push(symbol);
  });

  return ordered;
}

function getLatestHoldingQuantityFromTradingData(accountKey, symbol, year, month) {
  const targetSymbol = String(symbol || '').trim();
  if (!targetSymbol) return 0;

  const years = Object.keys(tradingData || {})
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => b - a);

  for (const y of years) {
    for (let m = 12; m >= 1; m -= 1) {
      if (y > year) continue;
      if (y === year && m >= month) continue;

      const holdings = tradingData?.[y]?.[m]?.[accountKey]?.holdings;
      if (!Array.isArray(holdings)) continue;
      const hit = holdings.find((holding) => String(holding?.symbol || '').trim() === targetSymbol);
      if (!hit) continue;
      const qty = Number(hit.quantity) || 0;
      if (qty > 0) return qty;
    }
  }

  return 0;
}

function ensureHoldings(year, month, accountKey) {
  ensureYearMonth(year, month);
  const row = tradingData[year][month][accountKey];
  if (!Array.isArray(row.holdings)) {
    row.holdings = [];
  }
  return row.holdings;
}

function calculateUnrealizedFromNetAssets(year, month, accountKey) {
  ensureYearMonth(year, month);
  const row = tradingData[year][month][accountKey];
  const netAssets = Number(row.netAssets) || 0;
  const confirmedAssets = calculateAccountConfirmedAssets(year, month, accountKey);
  return netAssets - confirmedAssets;
}

function syncUnrealizedFromNetAssets(accountKey) {
  ensureYearMonth(currentYear, currentMonth);
  const row = tradingData[currentYear][currentMonth][accountKey];
  const netAssets = Number(row.netAssets) || 0;
  
  if (netAssets === 0) return; // 純資産額が未入力の場合はスキップ
  
  const autoUnrealized = calculateUnrealizedFromNetAssets(currentYear, currentMonth, accountKey);
  row.unrealizedPnL = autoUnrealized;
  
  // 入力フィールドも更新
  const unrealizedInput = document.querySelector(`.input-account[data-account="${accountKey}"][data-field="unrealizedPnL"]`);
  if (unrealizedInput) {
    unrealizedInput.value = String(autoUnrealized);
  }
}

function isEtfLikeSecuritySymbol(symbol) {
  const upper = String(symbol || '').toUpperCase();
  if (!upper) return false;
  return upper.includes('ETF')
    || upper.includes('上場投信')
    || (upper.includes('MAXIS') && !upper.includes('EMAXIS'));
}

function isTrustLikeSecuritySymbol(symbol) {
  const upper = String(symbol || '').toUpperCase();
  if (!upper || isEtfLikeSecuritySymbol(symbol)) return false;
  const trustKeywords = ['オール・カントリー', 'オールカントリー', 'EMAXIS', '投資信託', 'インデックス・ファンド', 'インデックスファンド', 'ファンド', 'スリム'];
  return trustKeywords.some((kw) => upper.includes(kw));
}

function resolveHoldingsUnitMultiplier(symbol) {
  return isTrustLikeSecuritySymbol(symbol) ? 10000 : 1;
}

function calculateSecuritiesHoldingPnl(holding) {
  if (!holding || String(holding.symbol || '').trim() === '預り金' || holding.valueFilled !== true) return null;

  const valueJPY = Number(holding.valueJPY) || 0;
  const quantity = Number(holding.quantity) || 0;
  const acquisitionRate = Number(holding.acquisitionRate);
  if (!Number.isFinite(acquisitionRate) || acquisitionRate <= 0 || quantity <= 0) return null;

  const unitMultiplier = resolveHoldingsUnitMultiplier(holding.symbol);
  const cost = acquisitionRate * quantity / unitMultiplier;
  const pnl = valueJPY - cost;
  const pnlRate = cost > 0 ? (pnl / cost) * 100 : null;

  return { cost, pnl, pnlRate };
}

function renderHoldingsSection(accountKey, data) {
  if (accountKey === 'sbi') {
    const holdings = Array.isArray(data?.holdings) ? data.holdings.map((holding) => ({ ...holding })) : [];
    const openQtyMap = getSecuritiesOpenPositionMap(accountKey);
    const symbolsFromHistory = getSecuritiesSymbolsFromHistory(accountKey);
    const existingSymbols = holdings
      .map((holding) => String(holding?.symbol || '').trim())
      .filter(Boolean);

    const CASH_RESERVE_SYMBOL = '預り金';
    const allSymbols = [...symbolsFromHistory];
    existingSymbols.forEach((symbol) => {
      if (!allSymbols.includes(symbol)) allSymbols.push(symbol);
    });

    const holdingsMap = new Map();
    holdings.forEach((holding) => {
      if (!holding?.symbol) return;
      holdingsMap.set(holding.symbol, holding);
    });

    // 預り金を holdings に事前登録
    if (!holdingsMap.has(CASH_RESERVE_SYMBOL)) {
      const cashEntry = { symbol: CASH_RESERVE_SYMBOL, quantity: 0, unit: '円', rate: 0, acquisitionRate: null, valueJPY: 0, valueFilled: false, quantityManual: false };
      holdings.push(cashEntry);
      holdingsMap.set(CASH_RESERVE_SYMBOL, cashEntry);
    }

    // 預り金は先頭固定なので通常ループから除外
    const regularSymbols = allSymbols.filter((s) => s !== CASH_RESERVE_SYMBOL);

    // 預り金行（先頭固定）
    const cashReserve = holdingsMap.get(CASH_RESERVE_SYMBOL);
    const cashValueDisplay = cashReserve.valueFilled === true ? (Number(cashReserve.valueJPY) || 0) : '';
    const cashReserveRow = `
      <div class="holdings-row" data-symbol="${CASH_RESERVE_SYMBOL}">
        <label class="holdings-label">${CASH_RESERVE_SYMBOL}</label>
        <div class="holdings-cell"></div>
        <div class="holdings-cell"></div>
        <div class="holdings-cell">
          <input
            type="number"
            class="input-holdings"
            data-account="${accountKey}"
            data-symbol="${CASH_RESERVE_SYMBOL}"
            data-field="valueJPY"
            value="${cashValueDisplay}"
            placeholder=""
            step="1"
          />
          <span class="holdings-unit">円</span>
        </div>
      </div>
    `;

    const holdingsHtml = regularSymbols.map((symbol) => {
      const openQty = Number(openQtyMap.get(symbol)) || 0;
      const fallbackQty = openQty > 0
        ? openQty
        : getLatestHoldingQuantityFromTradingData(accountKey, symbol, currentYear, currentMonth);

      let existing = holdingsMap.get(symbol);
      if (!existing) {
        const seeded = { symbol, quantity: fallbackQty, unit: '株', rate: 0, valueJPY: 0, valueFilled: false, quantityManual: false };
        holdings.push(seeded);
        holdingsMap.set(symbol, seeded);
        existing = seeded;
      } else if (fallbackQty > 0) {
        const existingQty = Number(existing.quantity) || 0;
        const canAutoBackfill = existing.quantityManual !== true || existingQty <= 0;
        if (canAutoBackfill) {
          existing.quantity = fallbackQty;
          if (existingQty <= 0) existing.quantityManual = false;
        }
      }

      const quantity = Number(existing.quantity) || 0;
      const quantityDisplay = quantity > 0 ? quantity : '';
      const hasValue = existing.valueFilled === true;
      const valueDisplay = hasValue ? (Number(existing.valueJPY) || 0) : '';
      const unitMultiplier = resolveHoldingsUnitMultiplier(symbol);
      const isTrust = unitMultiplier > 1;
      const quantityUnit = isTrust ? '口' : '株';
      const acquisitionDisplay = existing.acquisitionRate != null && existing.acquisitionRate !== '' ? existing.acquisitionRate : '';

      return `
        <div class="holdings-row" data-symbol="${symbol}">
          <label class="holdings-label">${symbol}</label>
          <div class="holdings-cell">
            <input
              type="number"
              class="input-holdings"
              data-account="${accountKey}"
              data-symbol="${symbol}"
              data-field="quantity"
              value="${quantityDisplay}"
              placeholder=""
              step="1"
            />
            <span class="holdings-unit">${quantityUnit}</span>
          </div>
          <div class="holdings-cell">
            <input
              type="number"
              class="input-holdings"
              data-account="${accountKey}"
              data-symbol="${symbol}"
              data-field="acquisitionRate"
              value="${acquisitionDisplay}"
              placeholder=""
              step="1"
            />
            <span class="holdings-unit">円</span>
          </div>
          <div class="holdings-cell">
            <input
              type="number"
              class="input-holdings"
              data-account="${accountKey}"
              data-symbol="${symbol}"
              data-field="valueJPY"
              value="${valueDisplay}"
              placeholder=""
              step="1"
            />
            <span class="holdings-unit">円</span>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="holdings-section" data-account="${accountKey}">
        <div class="holdings-header">
          <label>保有明細</label>
        </div>
        <div class="holdings-header-row">
          <div class="holdings-header-cell"></div>
          <div class="holdings-header-cell">数量</div>
          <div class="holdings-header-cell">取得単価</div>
          <div class="holdings-header-cell">評価額</div>
        </div>
        <div class="holdings-list">
          ${cashReserveRow}
          ${holdingsHtml}
        </div>
      </div>
    `;
  }

  const holdings = Array.isArray(data?.holdings) ? data.holdings.map((holding) => ({ ...holding })) : [];
  const cryptoSymbols = getCryptoSymbolsFromHistory();
  
  // JPYは常に表示
  const allSymbols = ['JPY', ...cryptoSymbols];
  
  // 既存の保有明細からシンボルごとの値を取得
  const holdingsMap = new Map();
  holdings.forEach(h => {
    if (h && h.symbol) {
      holdingsMap.set(h.symbol, h);
    }
  });
  
  // 各シンボルの入力フィールドを生成
  const holdingsHtml = allSymbols.map(symbol => {
    const holding = holdingsMap.get(symbol) || { symbol, unit: symbol === 'JPY' ? '円' : symbol };
    const isJPY = symbol === 'JPY';
    const quantityDisplay = getStoredNumber(holding, 'quantity') ?? '';
    const rateDisplay = getStoredNumber(holding, 'rate') ?? '';
    const valueDisplay = getStoredNumber(holding, 'valueJPY') ?? '';
    
    return `
      <div class="holdings-row" data-symbol="${symbol}" data-is-jpy="${isJPY}">
        <label class="holdings-label">${symbol}</label>
        <div class="holdings-cell">
          <input 
            type="number" 
            class="input-holdings" 
            data-account="${accountKey}" 
            data-symbol="${symbol}" 
            data-field="quantity"
            value="${quantityDisplay}"
            placeholder="0"
            step="${isJPY ? '1' : '0.00000001'}"
          />
          <span class="holdings-unit">${holding.unit}</span>
        </div>
        <div class="holdings-cell${isJPY ? ' holdings-cell-hidden' : ''}">
          ${isJPY ? '' : `
          <input 
            type="number" 
            class="input-holdings" 
            data-account="${accountKey}" 
            data-symbol="${symbol}" 
            data-field="rate"
            value="${rateDisplay}"
            placeholder="0"
            step="0.01"
          />
          <span class="holdings-unit"></span>`}
        </div>
        <div class="holdings-cell${isJPY ? ' holdings-cell-hidden' : ''}">
          ${isJPY ? '' : `
          <input 
            type="number" 
            class="input-holdings" 
            data-account="${accountKey}" 
            data-symbol="${symbol}" 
            data-field="valueJPY"
            value="${valueDisplay}"
            placeholder="0"
            step="1"
          />
          <span class="holdings-unit">円</span>`}
        </div>
      </div>
    `;
  }).join('');
  
  return `
    <div class="holdings-section" data-account="${accountKey}">
      <div class="holdings-header">
        <label>保有明細</label>
      </div>
      <div class="holdings-header-row">
        <div class="holdings-header-cell"></div>
        <div class="holdings-header-cell">数量</div>
        <div class="holdings-header-cell">レート</div>
        <div class="holdings-header-cell">円換算額</div>
      </div>
      <div class="holdings-list">
        ${holdingsHtml}
      </div>
    </div>
  `;
}

function updateAssetTrendLegend(effectiveView) {
  const legendEquity = document.getElementById('assetLegendEquity');
  const legendBalance = document.getElementById('assetLegendBalance');
  if (!legendEquity || !legendBalance) return;

  const viewToUse = effectiveView !== undefined ? effectiveView : assetTrendView;
  const equityLabel = viewToUse === 'performance' ? 'Equity Growth' : 'Total Equity';
  const balanceLabel = viewToUse === 'performance' ? 'Balance Growth' : 'Net Balance';

  legendEquity.innerHTML = `<span class="dot dot-total-assets"></span> ${equityLabel}`;
  legendBalance.innerHTML = `<span class="dot dot-confirmed-assets"></span> ${balanceLabel}`;
}

function updateChartTitles(accountKey) {
  const assetLabel = document.querySelector('.chart-panel-label');
  const pnlLabel = document.querySelectorAll('.chart-panel-label')[1];
  
  if (accountKey && accountKey !== 'total') {
    const account = ACCOUNTS.find(a => a.key === accountKey);
    if (account) {
      const accountSuffix = ` <span style="color: ${account.color}; font-weight: 700;">●</span> <span style="color: rgba(255,255,255,0.85);">(${displayAccountName(account.key)})</span>`;
      if (assetLabel) assetLabel.innerHTML = `Asset Trend${accountSuffix}`;
      if (pnlLabel) pnlLabel.innerHTML = `Monthly P/L${accountSuffix}`;
    }
  } else {
    if (assetLabel) assetLabel.textContent = 'Asset Trend';
    if (pnlLabel) pnlLabel.textContent = 'Monthly P/L';
  }
}

function updateAssetTrendViewSelectVisibility(accountKey) {
  const select = document.getElementById('assetTrendViewSelect');
  if (!select) return;
  
  if (accountKey && accountKey !== 'total') {
    select.style.display = 'none';
  } else {
    select.style.display = '';
  }
}

function renderPerformanceChart(options = {}) {
  const { renderAssets = true, renderPnl = true, accountFilter = null } = options;
  const assetsCanvas = document.getElementById('assetsTrendChart');
  const pnlCanvas = document.getElementById('pnlBarChart');
  const assetsEmpty = document.getElementById('assetsTrendEmpty');
  const pnlEmpty = document.getElementById('pnlBarEmpty');
  if (!assetsCanvas || !pnlCanvas || typeof Chart === 'undefined') return;

  if (!hasStoredYearData(currentYear)) {
    if (renderAssets) {
      if (assetsTrendChart) {
        assetsTrendChart.destroy();
        assetsTrendChart = null;
      }
      assetsCanvas.hidden = true;
      if (assetsEmpty) assetsEmpty.hidden = false;
    }
    if (renderPnl) {
      if (pnlBarChart) {
        pnlBarChart.destroy();
        pnlBarChart = null;
      }
      pnlCanvas.hidden = true;
      if (pnlEmpty) pnlEmpty.hidden = false;
    }
    updateChartTitles(accountFilter);
    updateAssetTrendViewSelectVisibility(accountFilter);
    syncChartViewTabs();
    return;
  }

  if (renderAssets) {
    assetsCanvas.hidden = false;
    if (assetsEmpty) assetsEmpty.hidden = true;
  }
  if (renderPnl) {
    pnlCanvas.hidden = false;
    if (pnlEmpty) pnlEmpty.hidden = true;
  }

  const labels = Array.from({ length: 12 }, (_, i) => `${i + 1}月`);
  const assetsLabels = ['年初', ...labels];
  const latestMonth = getLatestSavedMonth(currentYear);
  const realizedData = [];
  const swapData = [];
  const totalPnlData = [];
  
  // 口座フィルター適用
  const targetAccounts = accountFilter && accountFilter !== 'total'
    ? ACCOUNTS.filter(a => a.key === accountFilter)
    : ACCOUNTS;
  const targetGrowthAccounts = accountFilter && accountFilter !== 'total'
    ? GROWTH_TARGET_ACCOUNTS.filter(a => a.key === accountFilter)
    : GROWTH_TARGET_ACCOUNTS;
  
  const yearStartUnrealizedTotal = targetAccounts.reduce((sum, a) => {
    return sum + (Number(yearInitialUnrealized?.[currentYear]?.[a.key]) || 0);
  }, 0);
  const confirmedTrendData = [calculateInitialCapital(currentYear, targetAccounts)];
  const assetsTrendData = [calculateInitialCapital(currentYear, targetAccounts) + yearStartUnrealizedTotal];

  const growthInitialConfirmed = targetGrowthAccounts.reduce((sum, account) => {
    return sum + (Number(yearInitialFunds?.[currentYear]?.[account.key]) || 0);
  }, 0);
  const growthInitialTotal = targetGrowthAccounts.reduce((sum, account) => {
    return sum + (Number(yearInitialFunds?.[currentYear]?.[account.key]) || 0)
      + (Number(yearInitialUnrealized?.[currentYear]?.[account.key]) || 0);
  }, 0);
  // Performanceは年初比の差分表示に統一するため、年初基準点を0固定
  const performanceConfirmedTrendData = [0];
  const performanceAssetsTrendData = [0];
  let cumulativeGrowthDeposits = 0;
  let cumulativeGrowthWithdrawals = 0;

  for (let m = 1; m <= 12; m++) {
    const isEnteredMonth = accountFilter && accountFilter !== 'total' && profitMetrics?.isAccountMonthEntered
      ? profitMetrics.isAccountMonthEntered(tradingData?.[currentYear] || {}, m, accountFilter)
      : hasMeaningfulMonthData(currentYear, m);
    
    // 口座別データ集計
    if (accountFilter && accountFilter !== 'total') {
      const monthly = profitMetrics?.calculateMonthlyFieldTotal
        ? {
            realized: profitMetrics.calculateMonthlyFieldTotal(tradingData?.[currentYear] || {}, m, [accountFilter], 'realizedPnL'),
            swap: profitMetrics.calculateMonthlyFieldTotal(tradingData?.[currentYear] || {}, m, [accountFilter], 'swapPnL')
          }
        : { realized: null, swap: null };
      const realized = monthly.realized;
      const swap = monthly.swap;
      realizedData.push(isEnteredMonth ? realized : null);
      swapData.push(isEnteredMonth ? swap : null);
      totalPnlData.push(isEnteredMonth && Number.isFinite(realized) && Number.isFinite(swap) ? (realized + swap) : null);
      
      const monthEndAssets = isEnteredMonth ? calculateAccountNetAssets(currentYear, m, accountFilter) : null;
      const monthEndConfirmed = isEnteredMonth ? calculateAccountConfirmedAssets(currentYear, m, accountFilter) : null;
      confirmedTrendData.push(isEnteredMonth ? monthEndConfirmed : null);
      assetsTrendData.push(isEnteredMonth ? monthEndAssets : null);
    } else {
      // 全体データ集計
      const monthly = calculateMonthlyTotals(currentYear, m);
      realizedData.push(isEnteredMonth ? monthly.realizedSum : null);
      swapData.push(isEnteredMonth ? monthly.swapSum : null);
      totalPnlData.push(isEnteredMonth && Number.isFinite(monthly.realizedSum) && Number.isFinite(monthly.swapSum)
        ? monthly.realizedSum + monthly.swapSum
        : null);
      const monthEndAssets = isEnteredMonth ? calculateTotalNetAssets(currentYear, m) : null;
      const monthEndConfirmed = isEnteredMonth ? calculateTotalConfirmedAssets(currentYear, m) : null;
      confirmedTrendData.push(isEnteredMonth ? monthEndConfirmed : null);
      assetsTrendData.push(isEnteredMonth ? monthEndAssets : null);
    }

    if (isEnteredMonth) {
      targetGrowthAccounts.forEach((account) => {
        const row = tradingData?.[currentYear]?.[m]?.[account.key] || {};
        cumulativeGrowthDeposits += Number(row.deposit) || 0;
        cumulativeGrowthWithdrawals += Number(row.withdrawal) || 0;
      });

      const growthAssetValues = targetGrowthAccounts.map((account) => calculateAccountNetAssets(currentYear, m, account.key));
      const growthAssets = growthAssetValues.every(Number.isFinite)
        ? growthAssetValues.reduce((sum, value) => sum + value, 0)
        : null;
      const growthConfirmed = targetGrowthAccounts.reduce((sum, account) => {
        return sum + calculateAccountConfirmedAssets(currentYear, m, account.key);
      }, 0);

      performanceAssetsTrendData.push(Number.isFinite(growthAssets)
        ? growthAssets - growthInitialTotal - cumulativeGrowthDeposits + cumulativeGrowthWithdrawals
        : null);
      performanceConfirmedTrendData.push(growthConfirmed - growthInitialConfirmed - cumulativeGrowthDeposits + cumulativeGrowthWithdrawals);
    } else {
      performanceAssetsTrendData.push(null);
      performanceConfirmedTrendData.push(null);
    }
  }

  // 口座別表示時はPerformanceビューを強制、全体表示時はユーザー選択を尊重
  const effectiveAssetTrendView = (accountFilter && accountFilter !== 'total') ? 'performance' : assetTrendView;
  
  const activeConfirmedTrend = effectiveAssetTrendView === 'performance'
    ? performanceConfirmedTrendData
    : confirmedTrendData;
  const activeAssetsTrend = effectiveAssetTrendView === 'performance'
    ? performanceAssetsTrendData
    : assetsTrendData;
  const balanceLabel = effectiveAssetTrendView === 'performance' ? 'Balance Growth' : 'Net Balance';
  const equityLabel = effectiveAssetTrendView === 'performance' ? 'Equity Growth' : 'Total Equity';

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

    if (chart === pnlBarChart && monthIndex > latestMonth - 1) {
      chart.setActiveElements([]);
      if (chart.tooltip) chart.tooltip.setActiveElements([], { x: 0, y: 0 });
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
            label: balanceLabel,
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
            label: equityLabel,
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
        animation: false,
        plugins: {
          laserReveal: { enabled: true },
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

    // 可視前の進行を防ぐため、初期状態はレーザー進捗 0 で待機。
    assetsTrendChart.$laserRevealProgress = 0;
    assetsTrendChart.draw();

    const assetsSection = assetsCanvas.closest('.chart-panel') || assetsCanvas.closest('.chart-area');
    bindAssetsTrendRevealToSection(assetsSection);
    if (assetsSection?.classList.contains('reveal-anim') && isElementInViewport(assetsSection)) {
      playLaserReveal(assetsTrendChart, 2300);
    }
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
          mode: 'nearest',
          intersect: true,
          axis: 'x'
        },
        animation: false,
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

    const pnlSection = pnlCanvas.closest('.chart-panel') || pnlCanvas.closest('.chart-area');
    bindPnlBarRevealToSection(pnlSection);
    if (pnlSection?.classList.contains('reveal-anim') && isElementInViewport(pnlSection)) {
      playPnlBarReveal(pnlBarChart);
    }
  };

  if (renderAssets) createAssetsChart();
  if (renderPnl) createPnlChart();

  updateAssetTrendLegend(effectiveAssetTrendView);
  updateChartTitles(accountFilter);
  updateAssetTrendViewSelectVisibility(accountFilter);
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
      const currentAccountFilter = selectedMonthlyAccount !== 'total' ? selectedMonthlyAccount : null;
      renderPerformanceChart({ renderAssets: true, renderPnl: false, accountFilter: currentAccountFilter });
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
      const currentAccountFilter = selectedMonthlyAccount !== 'total' ? selectedMonthlyAccount : null;
      renderPerformanceChart({ renderAssets: false, renderPnl: true, accountFilter: currentAccountFilter });
      syncChartViewTabs();
    });
    monthlySelect.dataset.bound = '1';
  }

  syncChartViewTabs();
}

// ===== UI Updates =====
function renderAnnualSummary() {
  const latestMonth = getLatestSavedMonth(currentYear);
  if (!hasStoredYearData(currentYear) || !latestMonth) {
    [
      'yearRealizedSum',
      'yearSwapSum',
      'yearInitialCapital',
      'yearInitialUnrealizedTotal',
      'yearDepositSum',
      'yearWithdrawSum',
      'yearNetCashFlow',
      'totalAssets',
      'confirmedAssets',
      'totalAssetsDelta',
      'confirmedAssetsDelta',
      'yearGrowthRate',
      'confirmedYearGrowthRate',
      'yearNetPnL',
      'yearConfirmedPnL',
      'yearNetPnLGrowthRate',
      'yearConfirmedPnLGrowthRate'
    ].map((id) => document.getElementById(id)).filter(Boolean).forEach((el) => {
      el.textContent = '—';
      el.classList.remove('positive', 'negative');
      el.classList.add('neutral');
    });
    return;
  }

  const yearly = calculateYearlyTotals(currentYear);
  const initialCapital = calculateInitialCapital(currentYear);
  const totalAssets = calculateTotalNetAssets(currentYear, latestMonth);
  const confirmedAssets = calculateTotalConfirmedAssets(currentYear, latestMonth);
  const growthAccounts = GROWTH_TARGET_ACCOUNTS;

  const fmtDeltaNumber = (value) => {
    const abs = Math.round(Math.abs(value)).toLocaleString();
    if (value > 0) return `+${abs}`;
    if (value < 0) return `-${abs}`;
    return '0';
  };

  const initialUnrealizedTotal = ACCOUNTS.reduce((sum, a) => {
    return sum + (Number(yearInitialUnrealized?.[currentYear]?.[a.key]) || 0);
  }, 0);

  const yearStartTotal = initialCapital + initialUnrealizedTotal;
  const yearStartConfirmed = initialCapital;
  const totalAssetsDelta = Number.isFinite(totalAssets) ? totalAssets - yearStartTotal : null;
  const confirmedAssetsDelta = confirmedAssets - yearStartConfirmed;
  const growthRate = yearStartTotal > 0 && Number.isFinite(totalAssetsDelta) ? (totalAssetsDelta / yearStartTotal * 100) : null;
  const confirmedGrowthRate = yearStartConfirmed > 0 ? (confirmedAssetsDelta / yearStartConfirmed * 100) : null;

  // 純損益/確定損益は投資口座のみ（bankOnly除外）でトップページと定義を一致させる
  const growthStartInitial = calculateInitialCapital(currentYear, growthAccounts);
  const growthStartUnrealized = growthAccounts.reduce((sum, a) => {
    return sum + (Number(yearInitialUnrealized?.[currentYear]?.[a.key]) || 0);
  }, 0);
  const growthYearStartTotal = growthStartInitial + growthStartUnrealized;
  const growthYearStartConfirmed = growthStartInitial;

  const growthCurrentTotalValues = growthAccounts.map((account) => calculateAccountNetAssets(currentYear, latestMonth, account.key));
  const growthCurrentTotal = growthCurrentTotalValues.every(Number.isFinite)
    ? growthCurrentTotalValues.reduce((sum, value) => sum + value, 0)
    : null;
  const growthCurrentConfirmed = growthAccounts.reduce((sum, a) => {
    return sum + calculateAccountConfirmedAssets(currentYear, latestMonth, a.key);
  }, 0);

  let growthDepositSum = 0;
  let growthWithdrawSum = 0;
  for (let m = 1; m <= latestMonth; m += 1) {
    growthAccounts.forEach((a) => {
      const row = tradingData?.[currentYear]?.[m]?.[a.key] || {};
      growthDepositSum += Number(row.deposit) || 0;
      growthWithdrawSum += Number(row.withdrawal) || 0;
    });
  }

  const yearNetPnL = Number.isFinite(growthCurrentTotal)
    ? growthCurrentTotal - growthYearStartTotal - growthDepositSum + growthWithdrawSum
    : null;
  const yearConfirmedPnL = growthCurrentConfirmed - growthYearStartConfirmed - growthDepositSum + growthWithdrawSum;
  const yearNetPnLGrowthRate = growthYearStartTotal > 0 && Number.isFinite(yearNetPnL)
    ? (yearNetPnL / growthYearStartTotal * 100)
    : null;
  const yearConfirmedPnLGrowthRate = growthYearStartConfirmed > 0 ? (yearConfirmedPnL / growthYearStartConfirmed * 100) : null;
  const netCashFlowYear = Number.isFinite(yearly.depositSum) && Number.isFinite(yearly.withdrawSum)
    ? yearly.depositSum - yearly.withdrawSum
    : null;

  document.getElementById('yearRealizedSum').textContent = formatOptionalJPY(yearly.realizedSum);
  document.getElementById('yearSwapSum').textContent = formatOptionalJPY(yearly.swapSum);
  document.getElementById('yearInitialCapital').textContent = fmtJPY(initialCapital);
  document.getElementById('yearInitialUnrealizedTotal').textContent = fmtJPY(initialUnrealizedTotal);
  document.getElementById('yearDepositSum').textContent = formatOptionalJPY(yearly.depositSum);
  document.getElementById('yearWithdrawSum').textContent = formatOptionalJPY(yearly.withdrawSum);
  document.getElementById('yearNetCashFlow').textContent = formatOptionalJPY(netCashFlowYear);
  document.getElementById('totalAssets').textContent = Number.isFinite(totalAssets) ? fmtJPY(totalAssets) : '—';
  document.getElementById('confirmedAssets').textContent = fmtJPY(confirmedAssets);
  document.getElementById('totalAssetsDelta').textContent = Number.isFinite(totalAssetsDelta) ? fmtDeltaNumber(totalAssetsDelta) : '—';
  document.getElementById('confirmedAssetsDelta').textContent = fmtDeltaNumber(confirmedAssetsDelta);
  document.getElementById('yearGrowthRate').textContent = Number.isFinite(growthRate) ? `${growthRate >= 0 ? '+' : ''}${growthRate.toFixed(1)}%` : '—';
  document.getElementById('confirmedYearGrowthRate').textContent = Number.isFinite(confirmedGrowthRate) ? `${confirmedGrowthRate >= 0 ? '+' : ''}${confirmedGrowthRate.toFixed(1)}%` : '—';
  document.getElementById('yearNetPnL').textContent = Number.isFinite(yearNetPnL) ? fmtJPY(yearNetPnL) : '—';
  document.getElementById('yearConfirmedPnL').textContent = fmtJPY(yearConfirmedPnL);
  document.getElementById('yearNetPnLGrowthRate').textContent = Number.isFinite(yearNetPnLGrowthRate) ? `${yearNetPnLGrowthRate >= 0 ? '+' : ''}${yearNetPnLGrowthRate.toFixed(1)}%` : '—';
  document.getElementById('yearConfirmedPnLGrowthRate').textContent = Number.isFinite(yearConfirmedPnLGrowthRate) ? `${yearConfirmedPnLGrowthRate >= 0 ? '+' : ''}${yearConfirmedPnLGrowthRate.toFixed(1)}%` : '—';

  const elRealized = document.getElementById('yearRealizedSum');
  const elSwap = document.getElementById('yearSwapSum');
  const elInitialUnrealized = document.getElementById('yearInitialUnrealizedTotal');
  const elNetCash = document.getElementById('yearNetCashFlow');
  const elTotalAssetsDelta = document.getElementById('totalAssetsDelta');
  const elConfirmedAssetsDelta = document.getElementById('confirmedAssetsDelta');
  const elGrowth = document.getElementById('yearGrowthRate');
  const elConfirmedGrowth = document.getElementById('confirmedYearGrowthRate');
  const elYearNetPnL = document.getElementById('yearNetPnL');
  const elYearConfirmedPnL = document.getElementById('yearConfirmedPnL');
  const elYearNetPnLGrowth = document.getElementById('yearNetPnLGrowthRate');
  const elYearConfirmedPnLGrowth = document.getElementById('yearConfirmedPnLGrowthRate');
  const elTotalAssets = document.getElementById('totalAssets');
  const elConfirmedAssets = document.getElementById('confirmedAssets');

  setSignClass(elRealized, yearly.realizedSum);
  setSignClass(elSwap, yearly.swapSum);
  setSignClass(elInitialUnrealized, initialUnrealizedTotal);
  setSignClass(elNetCash, netCashFlowYear);
  setSignClass(elTotalAssetsDelta, totalAssetsDelta);
  setSignClass(elConfirmedAssetsDelta, confirmedAssetsDelta);
  setSignClass(elGrowth, growthRate);
  setSignClass(elConfirmedGrowth, confirmedGrowthRate);
  setSignClass(elYearNetPnL, yearNetPnL);
  setSignClass(elYearConfirmedPnL, yearConfirmedPnL);
  setSignClass(elYearNetPnLGrowth, yearNetPnLGrowthRate);
  setSignClass(elYearConfirmedPnLGrowth, yearConfirmedPnLGrowthRate);
  setSignClass(elTotalAssets, totalAssets);
  setSignClass(elConfirmedAssets, confirmedAssets);
}

function formatOptionalJPY(value) {
  return Number.isFinite(value) ? fmtJPY(value) : '—';
}

function optionalSignStyle(value) {
  return Number.isFinite(value) ? ` style="color: ${colorBySign(value)}"` : '';
}

function getStoredNumber(row, field) {
  return profitMetrics?.hasStoredNumber?.(row, field) ? Number(row[field]) : null;
}

function buildMonthlyCardHtml(month, { realized = null, swap = null, unrealized = null } = {}) {
  const totalPnL = Number.isFinite(realized) && Number.isFinite(swap) ? realized + swap : null;
  return `
    <div class="monthly-label">${month}月</div>
    <div class="monthly-total-label">合計</div>
    <div class="monthly-total-value"${optionalSignStyle(totalPnL)}>${formatOptionalJPY(totalPnL)}</div>
    <div class="monthly-breakdown">
      <div class="monthly-stat-row">
        <span class="monthly-stat">決済</span>
        <span class="monthly-stat-value"${optionalSignStyle(realized)}>${formatOptionalJPY(realized)}</span>
      </div>
      <div class="monthly-stat-row">
        <span class="monthly-stat">スワップ</span>
        <span class="monthly-stat-value"${optionalSignStyle(swap)}>${formatOptionalJPY(swap)}</span>
      </div>
    </div>
    <div class="monthly-unrealized-row">
      <span class="monthly-stat monthly-unrealized-label">※評価損益</span>
      <span class="monthly-stat-value"${optionalSignStyle(unrealized)}>${formatOptionalJPY(unrealized)}</span>
    </div>
  `;
}

function renderMonthlyDisplay() {
  const container = document.getElementById('monthlyDisplay');
  const accountHeader = document.getElementById('monthlyAccountHeader');
  container.innerHTML = '';
  if (accountHeader) {
    accountHeader.hidden = true;
    accountHeader.innerHTML = '';
  }

  if (!hasStoredYearData(currentYear)) {
    container.innerHTML = '<p class="data-empty-state">データなし</p>';
    return;
  }
  
  for (let m = 1; m <= 12; m++) {
    const monthly = calculateMonthlyTotals(currentYear, m);
    const card = document.createElement('div');
    card.className = 'monthly-card' + (m === currentMonth ? ' active' : '');
    card.dataset.month = m;
    card.innerHTML = buildMonthlyCardHtml(m, {
      realized: monthly.realizedSum,
      swap: monthly.swapSum,
      unrealized: monthly.unrealizedSum
    });
    
    card.addEventListener('click', () => {
      selectMonth(m);
      openMonthlyDetailPane(m);
    });
    container.appendChild(card);
  }
}

function renderMonthlyByAccount(accountKey) {
  const account = ACCOUNTS.find((a) => a.key === accountKey && !a.bankOnly);
  if (!account) {
    renderMonthlyDisplay();
    return;
  }

  const container = document.getElementById('monthlyDisplay');
  const accountHeader = document.getElementById('monthlyAccountHeader');
  container.innerHTML = '';
  if (accountHeader) {
    accountHeader.hidden = false;
    accountHeader.innerHTML = `<span class="monthly-account-dot" style="background:${account.color}"></span><span class="monthly-account-name">${displayAccountName(account.key)}</span>`;
  }

  if (!hasStoredYearData(currentYear)) {
    container.innerHTML = '<p class="data-empty-state">データなし</p>';
    return;
  }

  for (let m = 1; m <= 12; m++) {
    const yearData = tradingData?.[currentYear] || {};
    const fieldTotal = (field) => profitMetrics?.calculateMonthlyFieldTotal
      ? profitMetrics.calculateMonthlyFieldTotal(yearData, m, [account.key], field)
      : null;
    const realized = fieldTotal('realizedPnL');
    const swap = fieldTotal('swapPnL');
    const unrealized = fieldTotal('unrealizedPnL');

    const card = document.createElement('div');
    card.className = 'monthly-card' + (m === currentMonth ? ' active' : '');
    card.dataset.month = m;
    card.innerHTML = buildMonthlyCardHtml(m, { realized, swap, unrealized });

    card.addEventListener('click', () => {
      selectMonth(m);
      openMonthlyDetailPane(m);
    });
    container.appendChild(card);
  }
}

function renderMonthlyDetailPane(month = currentMonth) {
  const hasData = hasMeaningfulMonthData(currentYear, month);
  monthlyDetailTitle.textContent = `${month}月 詳細`;
  if (!hasData) {
    monthlyDetailBody.innerHTML = '<p class="data-empty-state">—</p>';
    return;
  }

  const monthly = calculateMonthlyTotals(currentYear, month);
  const totalPnL = Number.isFinite(monthly.realizedSum) && Number.isFinite(monthly.swapSum)
    ? monthly.realizedSum + monthly.swapSum
    : null;
  const netCashFlow = Number.isFinite(monthly.depositSum) && Number.isFinite(monthly.withdrawSum)
    ? monthly.depositSum - monthly.withdrawSum
    : null;

  const accountCards = ACCOUNTS.map(account => {
    const data = tradingData?.[currentYear]?.[month]?.[account.key] || {};
    const realized = getStoredNumber(data, 'realizedPnL');
    const swap = getStoredNumber(data, 'swapPnL');
    const unrealized = getStoredNumber(data, 'unrealizedPnL');
    const deposit = getStoredNumber(data, 'deposit');
    const withdrawal = getStoredNumber(data, 'withdrawal');
    const netAssets = calculateAccountNetAssets(currentYear, month, account.key);
    const hideSwapRow = account.key === 'sbi' || account.key === 'sbivc';
    const accountTotal = hideSwapRow
      ? realized
      : (Number.isFinite(realized) && Number.isFinite(swap) ? realized + swap : null);
    const accountCashflow = Number.isFinite(deposit) && Number.isFinite(withdrawal)
      ? deposit - withdrawal
      : null;

    if (account.bankOnly) {
      return `
        <div class="detail-account-card detail-account-card-bank">
          <div class="detail-account-head">
            <span class="detail-account-name"><span class="detail-account-dot" style="background:${account.color}"></span>${displayAccountName(account.key)}</span>
          </div>
          <div class="detail-account-summary">
            <div class="detail-account-summary-label">月末残高</div>
            <div class="detail-account-total"${optionalSignStyle(netAssets)}>${formatOptionalJPY(netAssets)}</div>
          </div>
          <div class="detail-account-cashflow">
            <div class="detail-account-cashflow-head">
              <span class="k">入出金合計</span>
              <span class="v"${optionalSignStyle(accountCashflow)}>${formatOptionalJPY(accountCashflow)}</span>
            </div>
            <details class="detail-account-cashflow-details">
              <summary class="detail-account-cashflow-toggle">入出金内訳</summary>
              <div class="detail-account-cashflow-list">
                <div class="item"><span class="k">入金</span><span class="v">${formatOptionalJPY(deposit)}</span></div>
                <div class="item"><span class="k">出金</span><span class="v"${optionalSignStyle(Number.isFinite(withdrawal) ? -withdrawal : null)}>${formatOptionalJPY(withdrawal)}</span></div>
              </div>
            </details>
          </div>
        </div>
      `;
    }

    return `
      <div class="detail-account-card">
        <div class="detail-account-head">
          <span class="detail-account-name"><span class="detail-account-dot" style="background:${account.color}"></span>${displayAccountName(account.key)}</span>
        </div>
        <div class="detail-account-summary">
          <div class="detail-account-summary-label">損益合計</div>
          <div class="detail-account-total"${optionalSignStyle(accountTotal)}>${formatOptionalJPY(accountTotal)}</div>
          <div class="detail-account-stats">
            <div class="item"><span class="k">決済</span><span class="v"${optionalSignStyle(realized)}>${formatOptionalJPY(realized)}</span></div>
            ${hideSwapRow ? '' : `<div class="item"><span class="k">スワップ</span><span class="v"${optionalSignStyle(swap)}>${formatOptionalJPY(swap)}</span></div>`}
            <div class="item"><span class="k">評価損益</span><span class="v"${optionalSignStyle(unrealized)}>${formatOptionalJPY(unrealized)}</span></div>
          </div>
        </div>
        <div class="detail-account-cashflow">
          <div class="detail-account-cashflow-head">
            <span class="k">入出金合計</span>
            <span class="v"${optionalSignStyle(accountCashflow)}>${formatOptionalJPY(accountCashflow)}</span>
          </div>
          <details class="detail-account-cashflow-details">
            <summary class="detail-account-cashflow-toggle">入出金内訳</summary>
            <div class="detail-account-cashflow-list">
              <div class="item"><span class="k">入金</span><span class="v">${formatOptionalJPY(deposit)}</span></div>
              <div class="item"><span class="k">出金</span><span class="v"${optionalSignStyle(Number.isFinite(withdrawal) ? -withdrawal : null)}>${formatOptionalJPY(withdrawal)}</span></div>
            </div>
          </details>
        </div>
        <div class="detail-account-cashflow" style="margin-top:8px; padding-top:8px; border-top:1px solid rgba(255,255,255,.08)">
          <div class="detail-account-cashflow-head">
            <span class="k">時価評価額</span>
            <span class="v"${optionalSignStyle(netAssets)}>${formatOptionalJPY(netAssets)}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  const deleteButton = hasData ? `
    <button type="button" class="detail-delete-button" data-delete-month="${month}">
      <span class="detail-delete-icon">🗑</span>
      <span class="detail-delete-text">この月のデータを削除</span>
    </button>
  ` : '';

  monthlyDetailBody.innerHTML = `
    <div class="detail-top-grid">
      <div class="detail-summary-card">
        <div class="detail-summary-label">損益合計</div>
        <div class="detail-summary-value"${optionalSignStyle(totalPnL)}>${formatOptionalJPY(totalPnL)}</div>
        <div class="detail-summary-breakdown">
          <div class="detail-summary-row">
            <span class="detail-summary-stat">決済</span>
            <span class="detail-summary-stat-value"${optionalSignStyle(monthly.realizedSum)}>${formatOptionalJPY(monthly.realizedSum)}</span>
          </div>
          <div class="detail-summary-row">
            <span class="detail-summary-stat">スワップ</span>
            <span class="detail-summary-stat-value"${optionalSignStyle(monthly.swapSum)}>${formatOptionalJPY(monthly.swapSum)}</span>
          </div>
          <div class="detail-summary-row">
            <span class="detail-summary-stat">評価損益</span>
            <span class="detail-summary-stat-value"${optionalSignStyle(monthly.unrealizedSum)}>${formatOptionalJPY(monthly.unrealizedSum)}</span>
          </div>
        </div>
        <div class="detail-account-cashflow" style="margin-top:8px; padding-top:8px; border-top:1px solid rgba(255,255,255,.08)">
          <div class="detail-summary-row">
            <span class="detail-summary-stat">入出金</span>
            <span class="detail-summary-stat-value"${optionalSignStyle(netCashFlow)}>${formatOptionalJPY(netCashFlow)}</span>
          </div>
        </div>
        <details class="detail-summary-cashflow-details">
          <summary class="detail-summary-cashflow-toggle">入出金内訳</summary>
          <div class="detail-summary-cashflow-list">
            <div class="detail-summary-row">
              <span class="detail-summary-stat">入金</span>
              <span class="detail-summary-stat-value">${formatOptionalJPY(monthly.depositSum)}</span>
            </div>
            <div class="detail-summary-row">
              <span class="detail-summary-stat">出金</span>
              <span class="detail-summary-stat-value"${optionalSignStyle(Number.isFinite(monthly.withdrawSum) ? -monthly.withdrawSum : null)}>${formatOptionalJPY(monthly.withdrawSum)}</span>
            </div>
          </div>
        </details>
      </div>
    </div>
    <div class="detail-account-list">${accountCards}</div>
    ${deleteButton}
  `;
  
  // 削除ボタンのイベントリスナーを設定
  const deleteBtn = monthlyDetailBody.querySelector('.detail-delete-button');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', () => {
      const month = Number(deleteBtn.dataset.deleteMonth);
      deleteMonthData(month);
    });
  }
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

function clearMonthData(year, month) {
  ensureYearMonth(year, month);
  
  ACCOUNTS.forEach(account => {
    const row = tradingData[year][month][account.key];
    row.realizedPnL = 0;
    row.swapPnL = 0;
    row.unrealizedPnL = 0;
    row.maintenanceRate = 0;
    row.deposit = 0;
    row.withdrawal = 0;
    row.unrealizedLegs = [];
    row.unrealizedBackup = undefined;
    
    // 銀行口座の月末残高も削除
    if (account.bankOnly) {
      delete row.monthEndBalance;
    }
  });
  
  // __savedフラグも削除
  delete tradingData[year][month].__saved;
  
  saveToStorage();
}

function deleteMonthData(month) {
  const confirmMessage = `${currentYear}年${month}月のすべてのデータを削除します。\n\nこの操作は元に戻せません。本当に削除しますか？`;
  
  if (!confirm(confirmMessage)) {
    return;
  }
  
  clearMonthData(currentYear, month);
  closeMonthlyDetailPane();
  
  // 削除した月が現在選択中の月の場合、最新の有効な月に切り替え
  if (month === currentMonth) {
    const latestMonth = getLatestSavedMonth(currentYear) || (new Date().getMonth() + 1);
    currentMonth = latestMonth;
  }
  
  // 全体を再レンダリング
  renderAll();
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
  renderMonthlySection();
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
  sbiInputView = sbiInput.load(localStorage, inputTargetMonth());
  
  ACCOUNTS.forEach(account => {
    if (account.key === 'sbi' && usesSbiDraft()) {
      container.appendChild(renderSbiDraftCard(account));
      return;
    }
    const data = tradingData?.[currentYear]?.[currentMonth]?.[account.key] || {};
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
    
    // 暗号資産口座用の追加フィールド
    const isCryptoAccount = account.key === 'sbivc';
    const isSecuritiesAccount = account.key === 'sbi';
    const autoUnrealizedAccount = isCryptoAccount || isSecuritiesAccount;
    const netAssetsField = isCryptoAccount ? `
        <div class="form-group">
          <label>純資産額</label>
          <input type="number" class="input-account input-net-assets input-auto-calculated" data-account="${account.key}" data-field="netAssets" value="${getStoredNumber(data, 'netAssets') ?? ''}" placeholder="0" readonly />
          <span class="suffix suffix-auto">¥</span>
        </div>` : '';
    
    const holdingsSection = (isCryptoAccount || isSecuritiesAccount) ? renderHoldingsSection(account.key, data) : '';
    
    // 暗号資産口座の評価損益フィールド（保有明細の下に移動）
    const autoUnrealizedField = autoUnrealizedAccount ? `
        <div class="form-group">
          <label>評価損益</label>
          <div class="unrealized-input-inline">
            <input type="number" class="input-account input-auto-unrealized input-auto-calculated" data-account="${account.key}" data-field="unrealizedPnL" value="${getStoredNumber(data, 'unrealizedPnL') ?? ''}" placeholder="0" readonly />
          </div>
          <span class="suffix suffix-auto">￥</span>
        </div>` : '';
    
    const card = document.createElement('div');
    card.className = 'account-card';
    const tradingFields = account.bankOnly ? `
        <div class="form-group">
          <label>月末残高</label>
          <input type="number" class="input-account" data-account="${account.key}" data-field="monthEndBalance" value="${getStoredNumber(data, 'monthEndBalance') ?? ''}" placeholder="0" />
          <span class="suffix">¥</span>
        </div>` : `
        ${netAssetsField}
        <div class="form-group">
          <label>決済損益</label>
          <input type="number" class="input-account" data-account="${account.key}" data-field="realizedPnL" value="${getStoredNumber(data, 'realizedPnL') ?? ''}" placeholder="0" />
          <span class="suffix">¥</span>
        </div>
        ${(isCryptoAccount || isSecuritiesAccount) ? '' : `
        <div class="form-group">
          <label>スワップ損益</label>
          <input type="number" class="input-account" data-account="${account.key}" data-field="swapPnL" value="${getStoredNumber(data, 'swapPnL') ?? ''}" placeholder="0" />
          <span class="suffix">¥</span>
        </div>`}
        ${autoUnrealizedField}
        ${holdingsSection}
        ${autoUnrealizedAccount ? '' : `
        <div class="form-group">
          <label>評価損益</label>
          <div class="unrealized-input-inline">
            <input type="number" class="input-account${UNREALIZED_HELPER_ACCOUNTS.has(account.key) ? ' unrealized-main-input' : ''}" data-account="${account.key}" data-field="unrealizedPnL" value="${getStoredNumber(data, 'unrealizedPnL') ?? ''}" placeholder="0" />
          </div>
          <span class="suffix">¥</span>
        </div>
        `}`;
    const cashflowFields = account.bankOnly ? '' : `
        <div class="form-group">
          <label>入金</label>
          <input type="number" class="input-account" data-account="${account.key}" data-field="deposit" value="${getStoredNumber(data, 'deposit') ?? ''}" placeholder="0" />
          <span class="suffix">¥</span>
        </div>
        <div class="form-group">
          <label>出金</label>
          <input type="number" class="input-account" data-account="${account.key}" data-field="withdrawal" value="${getStoredNumber(data, 'withdrawal') ?? ''}" placeholder="0" />
          <span class="suffix">¥</span>
        </div>`;
    card.innerHTML = `
      <button type="button" class="account-toggle" data-account-toggle="${account.key}" aria-expanded="false">
        <div class="account-title">
          <div class="account-color-dot" style="background-color: ${account.color}"></div>
          ${displayAccountName(account.key)}
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
    el.addEventListener('keydown', handleEnterKeyNavigation);
  });
  
  // 純資産額入力時に評価損益を自動計算
  document.querySelectorAll('.input-net-assets').forEach(el => {
    el.addEventListener('input', (e) => {
      const accountKey = e.target.dataset.account;
      syncUnrealizedFromNetAssets(accountKey);
      updateInputs();
    });
  });
  
  // 保有明細入力のイベントリスナー
  document.querySelectorAll('.input-holdings').forEach(el => {
    el.addEventListener('input', () => {
      handleHoldingsInput();
      if (el.dataset.account === 'sbivc') {
        updateCryptoUnrealizedPnL('sbivc');
      }
      if (el.dataset.account === 'sbi') {
        updateSecuritiesUnrealizedPnL('sbi');
      }
    });
    el.addEventListener('focus', handleAccountInputFocus);
    el.addEventListener('keydown', handleHoldingsEnterKey);
    el.addEventListener('blur', (e) => {
      if (e.target.value.trim() === '') {
        const isSbiQuantityOrValueField = e.target.dataset.account === 'sbi'
          && (e.target.dataset.field === 'valueJPY' || e.target.dataset.field === 'quantity');
        if (!isSbiQuantityOrValueField) e.target.value = '0';
        handleHoldingsInput();
        if (e.target.dataset.account === 'sbivc') {
          updateCryptoUnrealizedPnL('sbivc');
        }
        if (e.target.dataset.account === 'sbi') {
          updateSecuritiesUnrealizedPnL('sbi');
        }
      }
    });
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

function renderSbiDraftCard(account) {
  const card = document.createElement('div');
  card.className = 'account-card';
  // Dynamic values are rendered as text/value, not interpolated HTML.
  card.innerHTML = `
    <button type="button" class="account-toggle" data-account-toggle="sbi" aria-expanded="false">
      <div class="account-title"><div class="account-color-dot" style="background-color: ${account.color}"></div>${displayAccountName(account.key)}</div>
      <span class="account-toggle-icon">▼</span>
    </button>
    <div class="account-body" data-account-body="sbi">
      <div class="sbi-domestic-input"><div class="sbi-domestic-heading">国内証券 <span class="sbi-import-status"></span></div>
        <dl><div><dt>評価額</dt><dd class="sbi-domestic-value"></dd></div>
        <div><dt>評価損益</dt><dd class="sbi-domestic-pnl"></dd></div></dl>
        <p class="sbi-domestic-date"></p><p class="sbi-domestic-message"></p>
      </div>
    </div>`;
  card.querySelector('.sbi-domestic-value').textContent = sbiInput.formatYen(sbiInputView.marketValue);
  card.querySelector('.sbi-domestic-pnl').textContent = sbiInput.formatYen(sbiInputView.unrealizedPnl, true);
  card.querySelector('.sbi-import-status').textContent = sbiInputView.status === 'ready' ? '取込済み' : '';
  const date = card.querySelector('.sbi-domestic-date');
  date.textContent = sbiInputView.snapshotAsOf ? `取得日：${sbiInputView.snapshotAsOf.slice(0, 10).replace(/-/g, '/')}` : '';
  date.hidden = !date.textContent;
  const message = card.querySelector('.sbi-domestic-message');
  message.textContent = sbiInputView.status === 'multiple' ? '複数の取込データがあります。使用するデータの確認が必要です。'
    : sbiInputView.status === 'unavailable' ? '取込データを確認できません。'
    : sbiInputView.marketValue === null || sbiInputView.unrealizedPnl === null ? '一部の値が未取得です。' : '';
  message.hidden = !message.textContent;
  const draft = sbiInputDrafts.read(inputTargetMonth());
  for (const [field, label] of [['realizedPnL', '決済損益'], ['deposit', '入金'], ['withdrawal', '出金']]) {
    const group = document.createElement('div');
    group.className = 'form-group';
    const labelElement = document.createElement('label');
    const input = document.createElement('input');
    input.id = `sbi-draft-${field}`;
    input.type = 'number';
    input.className = 'input-account';
    input.dataset.account = 'sbi';
    input.dataset.field = field;
    input.dataset.draft = 'sbi';
    input.value = draft[field] ?? '';
    input.placeholder = '0';
    labelElement.htmlFor = input.id;
    labelElement.textContent = label;
    const suffix = document.createElement('span');
    suffix.className = 'suffix';
    suffix.textContent = '¥';
    group.append(labelElement, input, suffix);
    card.querySelector('.account-body').appendChild(group);
  }
  return card;
}

function handleAccountInputBlur(event) {
  const input = event.target;
  if ((input.dataset.field === 'deposit' || input.dataset.field === 'withdrawal') && input.value.trim() !== '') {
    const normalized = normalizeCashflowValue(input.dataset.field, Number(input.value));
    if (Number.isFinite(normalized)) input.value = String(normalized);
  }
}

function handleEnterKeyNavigation(event) {
  if (event.key !== 'Enter') return;
  
  event.preventDefault();
  
  // 現在の入力フィールドを含む口座カードを取得
  const currentCard = event.target.closest('.account-card');
  if (!currentCard) return;
  
  // 同じ口座カード内のすべての.input-accountフィールドを取得（保有明細は別処理）
  const allInputs = Array.from(currentCard.querySelectorAll('.input-account'));
  const currentIndex = allInputs.indexOf(event.target);
  
  if (currentIndex === -1) return;
  
  // 次の入力フィールドにフォーカス
  const nextInput = allInputs[currentIndex + 1];
  if (nextInput) {
    nextInput.focus();
    if (shouldSelectZeroForOverwrite(nextInput)) {
      nextInput.select();
    }
  }
}

function handleHoldingsEnterKey(event) {
  if (event.key !== 'Enter') return;
  
  event.preventDefault();
  
  const currentRow = event.target.closest('.holdings-row');
  if (!currentRow) return;
  
  const isJPY = currentRow.dataset.isJpy === 'true';
  
  // 同じ行内の入力フィールドを取得（disabledじゃないものだけ）
  const rowInputs = Array.from(currentRow.querySelectorAll('.input-holdings:not([disabled])'));
  const currentIndex = rowInputs.indexOf(event.target);
  
  if (currentIndex !== -1 && currentIndex < rowInputs.length - 1) {
    // 同じ行の次の入力欄へ
    const nextInput = rowInputs[currentIndex + 1];
    nextInput.focus();
    if (shouldSelectZeroForOverwrite(nextInput)) {
      nextInput.select();
    }
  } else {
    // 行の最後の入力欄の場合、次の行の最初の入力欄へ
    const allRows = Array.from(currentRow.closest('.holdings-list').querySelectorAll('.holdings-row'));
    const rowIndex = allRows.indexOf(currentRow);
    if (rowIndex !== -1 && rowIndex < allRows.length - 1) {
      const nextRow = allRows[rowIndex + 1];
      const firstInput = nextRow.querySelector('.input-holdings:not([disabled])');
      if (firstInput) {
        firstInput.focus();
        if (shouldSelectZeroForOverwrite(firstInput)) {
          firstInput.select();
        }
      }
    } else {
      // 最後の行の場合、次のセクションへ
      const currentCard = event.target.closest('.account-card');
      if (!currentCard) return;
      
      const allInputs = Array.from(currentCard.querySelectorAll('.input-account, .input-holdings'));
      const currentGlobalIndex = allInputs.indexOf(event.target);
      
      if (currentGlobalIndex !== -1) {
        const nextInput = allInputs[currentGlobalIndex + 1];
        if (nextInput) {
          nextInput.focus();
          if (shouldSelectZeroForOverwrite(nextInput)) {
            nextInput.select();
          }
        }
      }
    }
  }
}

function handleHoldingsInput(event) {
  updateHoldingsInputs();
}

function updateCryptoUnrealizedPnL(accountKey) {
  ensureYearMonth(currentYear, currentMonth);
  const holdings = tradingData[currentYear][currentMonth][accountKey]?.holdings || [];
  
  // JPYの数量を取得
  const jpyHolding = holdings.find(h => h.symbol === 'JPY');
  const jpyAmount = Number(jpyHolding?.quantity) || 0;
  
  // 暗号資産の円換算額の合計を計算
  const cryptoTotalValue = holdings
    .filter(h => h.symbol !== 'JPY')
    .reduce((sum, h) => sum + (Number(h.valueJPY) || 0), 0);
  
  // 純資産額 = JPY + 暗号資産の合計
  const netAssets = jpyAmount + cryptoTotalValue;
  tradingData[currentYear][currentMonth][accountKey].netAssets = netAssets;
  
  // 確定資産を計算
  const confirmedAssets = calculateAccountConfirmedAssets(currentYear, currentMonth, accountKey);
  
  // 評価損益 = 純資産額 - 確定資産
  const unrealizedPnL = netAssets - confirmedAssets;
  
  // tradingDataに保存
  tradingData[currentYear][currentMonth][accountKey].unrealizedPnL = unrealizedPnL;
  
  // UIを更新
  const unrealizedInput = document.querySelector(`.input-account[data-account="${accountKey}"][data-field="unrealizedPnL"]`);
  if (unrealizedInput) {
    unrealizedInput.value = String(unrealizedPnL);
  }

  const netAssetsInput = document.querySelector(`.input-account[data-account="${accountKey}"][data-field="netAssets"]`);
  if (netAssetsInput) {
    netAssetsInput.value = String(netAssets);
  }
}

function updateSecuritiesUnrealizedPnL(accountKey) {
  if (accountKey === 'sbi' && usesSbiDraft()) return;
  ensureYearMonth(currentYear, currentMonth);
  const holdings = tradingData[currentYear][currentMonth][accountKey]?.holdings || [];

  let securitiesTotalValue = 0;
  let holdingsPnL = 0;

  holdings
    .filter((holding) => holding.symbol !== 'JPY')
    .forEach((holding) => {
      if (holding.valueFilled !== true) return;
      securitiesTotalValue += Number(holding.valueJPY) || 0;

      const pnlSummary = calculateSecuritiesHoldingPnl(holding);
      if (pnlSummary) holdingsPnL += pnlSummary.pnl;
    });

  tradingData[currentYear][currentMonth][accountKey].netAssets = securitiesTotalValue;

  const unrealizedPnL = securitiesTotalValue > 0 ? Math.round(holdingsPnL) : 0;

  tradingData[currentYear][currentMonth][accountKey].unrealizedPnL = unrealizedPnL;

  const unrealizedInput = document.querySelector(`.input-account[data-account="${accountKey}"][data-field="unrealizedPnL"]`);
  if (unrealizedInput) unrealizedInput.value = String(unrealizedPnL);
}

function updateInputs({ render = true, target } = {}) {
  // SBI editing never enters the legacy mutation/calculation path.
  if (target?.dataset.draft === 'sbi') {
    sbiInputDrafts.set(inputTargetMonth(), target.dataset.field, target.value);
    return;
  }
  ensureYearMonth(currentYear, currentMonth);
  // 入力値をtradingDataに保存
  document.querySelectorAll('.input-account').forEach(el => {
    const account = el.dataset.account;
    const field = el.dataset.field;
    if (account === 'sbi' && usesSbiDraft()) {
      sbiInputDrafts.set(inputTargetMonth(), field, el.value);
      return;
    }
    const rawValue = String(el.value ?? '').trim();
    const row = tradingData[currentYear][currentMonth][account];
    if (rawValue === '') {
      delete row[field];
      return;
    }

    const value = Number(rawValue);
    if (!Number.isFinite(value)) return;
    const normalized = normalizeCashflowValue(field, value);
    row[field] = normalized;

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
    if (profitMetrics?.hasStoredNumber?.(row, 'unrealizedPnL')) {
      row.unrealizedBackup = Number(row.unrealizedPnL);
    } else {
      delete row.unrealizedBackup;
    }
  });

  if (!render) return;

  // サマリー更新
  renderMonthlySection();
  renderAnnualSummary();
  renderPerformanceChart();
  if (monthlyDetailPane.classList.contains('open')) {
    renderMonthlyDetailPane(currentMonth);
  }
}

function updateHoldingsInputs() {
  // 保有明細入力値をtradingDataに保存
  const holdingsData = {};
  
  document.querySelectorAll('.input-holdings').forEach(el => {
    const accountKey = el.dataset.account;
    if (accountKey === 'sbi' && usesSbiDraft()) return;
    const symbol = el.dataset.symbol;
    const field = el.dataset.field; // 'quantity', 'rate', or 'valueJPY'
    const rawValue = String(el.value ?? '').trim();
    const numericValue = rawValue === '' ? null : Number(rawValue);
    const value = Number.isFinite(numericValue) ? numericValue : null;
    
    const key = `${accountKey}::${symbol}`;
    if (!holdingsData[key]) {
      holdingsData[key] = { accountKey, symbol };
    }
    holdingsData[key][field] = value;
    holdingsData[key][`raw_${field}`] = rawValue;
  });
  
  // holdingsDataを各口座のholdingsに反映
  Object.values(holdingsData).forEach(({ accountKey, symbol, quantity, acquisitionRate, rate, valueJPY, raw_valueJPY, raw_quantity }) => {
    ensureHoldings(currentYear, currentMonth, accountKey);
    const holdings = tradingData[currentYear][currentMonth][accountKey].holdings;
    
    const existingIndex = holdings.findIndex(h => h.symbol === symbol);
    const existing = existingIndex >= 0 ? holdings[existingIndex] : null;
    const isSecurities = accountKey === 'sbi';
    const isTrust = isSecurities && resolveHoldingsUnitMultiplier(symbol) > 1;
    const unit = isSecurities ? (symbol === '預り金' ? '円' : (isTrust ? '口' : '株')) : (symbol === 'JPY' ? '円' : symbol);
    const qty = quantity != null ? quantity : 0;
    let quantityManual = existing?.quantityManual === true;
    if (isSecurities && existing) {
      const prevQty = Number(existing.quantity) || 0;
      if (raw_quantity !== '' && Math.abs(prevQty - qty) > 1e-12) {
        quantityManual = true;
      }
    }
    const hasValueInput = isSecurities ? raw_valueJPY !== '' : valueJPY != null;
    const val = hasValueInput ? (valueJPY != null ? valueJPY : 0) : 0;

    if (isSecurities) {
      // 取得単価はユーザー入力値をそのまま保存（SBI表示単位: 円/万口 or 円/株）
      const acqRate = acquisitionRate != null ? acquisitionRate : (existing?.acquisitionRate ?? null);
      // 内部rate: 取得単価をper-unit換算（avgRate用）
      const unitMultiplier = resolveHoldingsUnitMultiplier(symbol);
      const rt = acqRate != null && acqRate > 0
        ? acqRate / unitMultiplier
        : (hasValueInput && qty > 0 ? val / qty : (existing?.rate || 0));
      if (existingIndex >= 0) {
        holdings[existingIndex] = { symbol, quantity: qty, unit, rate: rt, acquisitionRate: acqRate, valueJPY: val, valueFilled: hasValueInput, quantityManual };
      } else {
        holdings.push({ symbol, quantity: qty, unit, rate: rt, acquisitionRate: acqRate, valueJPY: val, valueFilled: hasValueInput, quantityManual: false });
      }
      return;
    }

    const rt = rate != null ? rate : 0;

    if (existingIndex >= 0) {
      holdings[existingIndex] = { symbol, quantity: qty, unit, rate: rt, valueJPY: val, valueFilled: hasValueInput, quantityManual };
    } else {
      holdings.push({ symbol, quantity: qty, unit, rate: rt, valueJPY: val, valueFilled: hasValueInput, quantityManual: false });
    }

    // JPY以外で数量と評価額が両方とも0の場合は削除
    if (symbol !== 'JPY' && qty === 0 && val === 0) {
      tradingData[currentYear][currentMonth][accountKey].holdings = 
        holdings.filter(h => h.symbol !== symbol);
    }
    // JPYで数量が0の場合は削除
    if (symbol === 'JPY' && qty === 0) {
      tradingData[currentYear][currentMonth][accountKey].holdings = 
        holdings.filter(h => h.symbol !== symbol);
    }
  });
  
  // サマリー更新
  renderMonthlySection();
  renderAnnualSummary();
}


function getSelectableYears() {
  const years = new Set([PROFIT_BASE_YEAR, currentYear]);
  Object.keys(tradingData || {}).forEach((y) => years.add(Number(y)));
  Object.keys(yearInitialFunds || {}).forEach((y) => years.add(Number(y)));
  Object.keys(yearInitialUnrealized || {}).forEach((y) => years.add(Number(y)));

  const normalizedYears = [...years]
    .filter((y) => Number.isInteger(y) && y >= PROFIT_BASE_YEAR && y <= 2100);

  if (!normalizedYears.length) normalizedYears.push(PROFIT_BASE_YEAR);

  let maxYear = Math.max(...normalizedYears);
  while (hasMeaningfulMonthData(maxYear, 12)) {
    maxYear += 1;
    normalizedYears.push(maxYear);
  }

  return [...new Set(normalizedYears)].sort((a, b) => b - a);
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
  const currentInitialFunds = yearInitialFunds?.[currentYear] || {};
  const currentInitialUnrealized = yearInitialUnrealized?.[currentYear] || {};

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
    let val = currentInitialFunds[accountKey];
    if (typeof val !== 'number') {
      val = calculateAccountConfirmedAssets(prevYear, 12, accountKey);
    }
    document.getElementById(elemId).value = Number(val) || 0;
  }

  // 年初評価損益（前年度年末の評価損益をデフォルト）
  for (const [elemId, accountKey] of Object.entries(unrealizedKeys)) {
    let val = currentInitialUnrealized[accountKey];
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

// 月別サマリー折りたたみはapp-gestures.jsの自動システムで処理

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
document.getElementById('importDataBtn')?.addEventListener('click', () => {
  document.getElementById('importDataInput')?.click();
});
document.getElementById('importDataInput')?.addEventListener('change', (e) => {
  importData(e.target.files[0]);
  e.target.value = '';
});

document.getElementById('saveMonthData').addEventListener('click', () => {
  const confirmed = window.confirm('現在の入力データを保存します。');
  if (!confirmed) return;

  const hasExplicitInput = Array.from(document.querySelectorAll('.input-account:not([readonly]), .input-holdings'))
    .some((input) => input.dataset.draft !== 'sbi' && String(input.value ?? '').trim() !== '');
  if (!hasExplicitInput) {
    window.alert('入力されたデータがありません。');
    return;
  }

  updateInputs({ render: false });
  
  // 保有明細は入力状態をそのまま同期（SBIの評価額空欄状態も保持）
  updateHoldingsInputs();

  tradingData[currentYear][currentMonth].__saved = true;

  applyBankBalanceInputsForMonth(currentYear, currentMonth);
  
  saveToStorage();
  renderAnnualSummary();
  renderPerformanceChart();
  renderMonthlySection();
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

// ===== Monthly View Toggle =====
let selectedMonthlyAccount = 'total'; // 'total' | account key

function getMonthlyViewOptions() {
  const accountOptions = ACCOUNTS
    .filter((account) => !account.bankOnly)
    .map((account) => ({ key: account.key, label: displayAccountName(account.key) }));
  return [{ key: 'total', label: '全体' }, ...accountOptions];
}

function renderMonthlyViewButtons() {
  const toggleGroup = document.getElementById('monthlyViewToggle');
  if (!toggleGroup) return;
  const options = getMonthlyViewOptions();
  toggleGroup.innerHTML = options.map((option) => {
    const isActive = option.key === selectedMonthlyAccount;
    const activeClass = isActive ? ' active' : '';
    return `<button class="monthly-view-btn${activeClass}" data-account="${option.key}" type="button">${option.label}</button>`;
  }).join('');
}

function renderMonthlySection() {
  if (selectedMonthlyAccount === 'total') {
    renderMonthlyDisplay();
  } else {
    renderMonthlyByAccount(selectedMonthlyAccount);
  }
}

function initMonthlyViewToggle() {
  const toggleGroup = document.getElementById('monthlyViewToggle');
  if (!toggleGroup) return;

  const selectableKeys = new Set(getMonthlyViewOptions().map((option) => option.key));
  if (!selectableKeys.has(selectedMonthlyAccount)) {
    selectedMonthlyAccount = 'total';
  }

  renderMonthlyViewButtons();

  if (toggleGroup.dataset.bound) return;
  toggleGroup.dataset.bound = '1';
  toggleGroup.addEventListener('click', (e) => {
    const btn = e.target.closest('.monthly-view-btn');
    if (!btn) return;
    const accountKey = btn.dataset.account;
    if (!accountKey || accountKey === selectedMonthlyAccount) return;
    selectedMonthlyAccount = accountKey;
    toggleGroup.querySelectorAll('.monthly-view-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.account === accountKey);
    });
    const contentEl = document.getElementById('monthlyDisplay');
    if (window.animateTabSwitch && contentEl) {
      window.animateTabSwitch(contentEl, () => {
        renderMonthlySection();
        renderPerformanceChart({ accountFilter: accountKey });
      });
    } else {
      renderMonthlySection();
      renderPerformanceChart({ accountFilter: accountKey });
    }
  });
}

// ===== Initialization =====
function renderAll() {
  updateYearSelect();
  renderAnnualSummary();
  renderPerformanceChart();
  bindChartViewControls();
  initMonthlyViewToggle();
  renderMonthlySection();
  renderMonthTabs();
  renderAccountInputs();
  renderInitialCapitalForm();
}

window.addEventListener('load', () => {
  loadFromStorage();
  const sharedYear = getSharedSelectedYear();
  if (sharedYear) {
    currentYear = sharedYear;
  }
  setSharedSelectedYear(currentYear);
  currentMonth = new Date().getMonth() + 1;
  renderAll();
  applyInitialCapitalDefaultOpen();
});
