// ===== Utility =====
const fmtJPY = n => isFinite(n) ? '¥' + Math.round(n).toLocaleString() : '-';
const fmtMan = n => isFinite(n) ? Math.round(n / 10000).toLocaleString() : '-';
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

// ===== Drawer =====
const drawer = document.getElementById('drawer');
const scrim = document.getElementById('scrim');
const menuButton = document.getElementById('menuButton');
const drawerClose = document.getElementById('drawerClose');

function openDrawer() { drawer.classList.add('open'); scrim.hidden = false; }
function closeDrawer() { drawer.classList.remove('open'); scrim.hidden = true; }

menuButton?.addEventListener('click', openDrawer);
drawerClose?.addEventListener('click', closeDrawer);
scrim?.addEventListener('click', closeDrawer);

let startX = 0;
drawer.addEventListener('touchstart', e => startX = e.touches[0].clientX);
drawer.addEventListener('touchmove', e => { if (e.touches[0].clientX - startX < -60) closeDrawer(); });

// ===== Global State =====
let currentYear = 2025;
let currentMonth = new Date().getMonth() + 1; // 1-12
let tradingData = {}; // { year: { month: { account: { realizedPnL, swapPnL, unrealizedPnL, maintenanceRate, deposit, withdrawal } } } }
let yearInitialFunds = {}; // { year: { account: amount } }

// ===== Storage =====
const STORAGE_KEY_TRADING = 'tradingData';
const STORAGE_KEY_INITIAL = 'yearInitialFunds';
const STORAGE_KEY_SKIP_DEMO = 'profitSkipDemoSeed';

const monthlyDetailPane = document.getElementById('monthlyDetailPane');
const monthlyDetailBody = document.getElementById('monthlyDetailBody');
const monthlyDetailTitle = document.getElementById('monthlyDetailTitle');
const monthlyDetailClose = document.getElementById('monthlyDetailClose');
const monthlyDetailScrim = document.getElementById('monthlyDetailScrim');
let pnlTrendChart = null;

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
  if (!pnlTrendChart || !pnlTrendChart.canvas) return;

  const target = event.target;
  if (!(target instanceof Element)) return;

  if (pnlTrendChart.canvas.contains(target)) return;

  const hasActive = pnlTrendChart.getActiveElements().length > 0;
  if (!hasActive) return;

  pnlTrendChart.setActiveElements([]);
  if (pnlTrendChart.tooltip) {
    pnlTrendChart.tooltip.setActiveElements([], { x: 0, y: 0 });
  }
  pnlTrendChart.update();
}

document.addEventListener('pointerdown', dismissChartTooltipOnOutsideTap, true);

function saveToStorage() {
  localStorage.setItem(STORAGE_KEY_TRADING, JSON.stringify(tradingData));
  localStorage.setItem(STORAGE_KEY_INITIAL, JSON.stringify(yearInitialFunds));
}

function loadFromStorage() {
  tradingData = JSON.parse(localStorage.getItem(STORAGE_KEY_TRADING) || '{}');
  yearInitialFunds = JSON.parse(localStorage.getItem(STORAGE_KEY_INITIAL) || '{}');
}

function seedDemoDataIfEmpty() {
  if (localStorage.getItem(STORAGE_KEY_SKIP_DEMO) === '1') return;
  const hasTrading = Object.keys(tradingData || {}).length > 0;
  const hasInitial = Object.keys(yearInitialFunds || {}).length > 0;
  if (hasTrading || hasInitial) return;

  const year = 2025;
  yearInitialFunds[year] = {
    gmo: 900000,
    lightfx: 650000,
    minano: 700000,
    sbi: 820000,
    sbivc: 430000
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

function calculateTotalNetAssets(year, month) {
  let total = 0;
  ACCOUNTS.forEach(a => {
    total += calculateAccountNetAssets(year, month, a.key);
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

function renderPerformanceChart() {
  const canvas = document.getElementById('pnlTrendChart');
  if (!canvas || typeof Chart === 'undefined') return;

  const labels = Array.from({ length: 12 }, (_, i) => `${i + 1}月`);
  const realizedData = [];
  const swapData = [];
  const assetsData = [];

  for (let m = 1; m <= 12; m++) {
    const monthly = calculateMonthlyTotals(currentYear, m);
    realizedData.push(monthly.realizedSum);
    swapData.push(monthly.swapSum);
    assetsData.push(calculateTotalNetAssets(currentYear, m));
  }

  if (pnlTrendChart) {
    pnlTrendChart.destroy();
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  pnlTrendChart = new Chart(ctx, {
    data: {
      labels,
      datasets: [
        {
          type: 'bar',
          label: '決済損益',
          data: realizedData,
          stack: 'pnl',
          backgroundColor: realizedData.map(v => v >= 0 ? 'rgba(62,224,143,0.75)' : 'rgba(255,107,107,0.75)'),
          borderColor: realizedData.map(v => v >= 0 ? 'rgba(62,224,143,1)' : 'rgba(255,107,107,1)'),
          borderWidth: 1,
          yAxisID: 'yPnL'
        },
        {
          type: 'bar',
          label: 'スワップ損益',
          data: swapData,
          stack: 'pnl',
          backgroundColor: swapData.map(v => v >= 0 ? 'rgba(61,162,255,0.75)' : 'rgba(255,107,107,0.55)'),
          borderColor: swapData.map(v => v >= 0 ? 'rgba(61,162,255,1)' : 'rgba(255,107,107,0.9)'),
          borderWidth: 1,
          yAxisID: 'yPnL'
        },
        {
          type: 'line',
          label: '純資産推移',
          data: assetsData,
          borderColor: '#EEF1FF',
          backgroundColor: 'rgba(238,241,255,0.15)',
          pointBackgroundColor: '#EEF1FF',
          pointBorderColor: '#EEF1FF',
          pointRadius: 2,
          pointHoverRadius: 3,
          tension: 0.28,
          fill: false,
          yAxisID: 'yAssets'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
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
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${fmtMan(ctx.parsed.y)}`,
            afterBody: (items) => {
              const idx = items?.[0]?.dataIndex;
              if (idx == null) return '';
              const totalPnL = (realizedData[idx] || 0) + (swapData[idx] || 0);
              return `当月合計損益: ${fmtMan(totalPnL)}`;
            }
          }
        }
      },
      scales: {
        x: {
          stacked: true,
          ticks: {
            color: 'rgba(255,255,255,0.8)',
            maxRotation: 0,
            autoSkipPadding: 10
          },
          grid: {
            color: 'rgba(255,255,255,0.08)',
            drawBorder: false
          }
        },
        yPnL: {
          stacked: true,
          position: 'left',
          ticks: {
            color: 'rgba(255,255,255,0.75)',
            callback: (v) => fmtMan(v)
          },
          grid: {
            color: 'rgba(255,255,255,0.1)',
            drawBorder: false
          }
        },
        yAssets: {
          position: 'right',
          ticks: {
            color: 'rgba(255,255,255,0.75)',
            callback: (v) => fmtMan(v)
          },
          grid: {
            drawOnChartArea: false,
            drawBorder: false
          }
        }
      }
    }
  });
}

// ===== UI Updates =====
function renderAnnualSummary() {
  const yearly = calculateYearlyTotals(currentYear);
  const initialCapital = calculateInitialCapital(currentYear);
  const totalAssets = calculateTotalNetAssets(currentYear, 12);
  const growthRate = initialCapital > 0 ? ((totalAssets - initialCapital) / initialCapital * 100) : 0;
  const netCashFlowYear = yearly.depositSum - yearly.withdrawSum;

  document.getElementById('yearRealizedSum').textContent = fmtJPY(yearly.realizedSum);
  document.getElementById('yearSwapSum').textContent = fmtJPY(yearly.swapSum);
  document.getElementById('yearInitialCapital').textContent = fmtJPY(initialCapital);
  document.getElementById('yearDepositSum').textContent = fmtJPY(yearly.depositSum);
  document.getElementById('yearWithdrawSum').textContent = fmtJPY(yearly.withdrawSum);
  document.getElementById('yearNetCashFlow').textContent = fmtJPY(netCashFlowYear);
  document.getElementById('totalAssets').textContent = fmtJPY(totalAssets);
  document.getElementById('yearGrowthRate').textContent = (growthRate >= 0 ? '+' : '') + growthRate.toFixed(1) + '%';

  const elRealized = document.getElementById('yearRealizedSum');
  const elSwap = document.getElementById('yearSwapSum');
  const elNetCash = document.getElementById('yearNetCashFlow');
  const elGrowth = document.getElementById('yearGrowthRate');
  const elTotalAssets = document.getElementById('totalAssets');

  setSignClass(elRealized, yearly.realizedSum);
  setSignClass(elSwap, yearly.swapSum);
  setSignClass(elNetCash, netCashFlowYear);
  setSignClass(elGrowth, growthRate);
  setSignClass(elTotalAssets, totalAssets);
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
  renderMonthlyDetailPane(month);
  monthlyDetailPane.classList.add('open');
  monthlyDetailPane.setAttribute('aria-hidden', 'false');
  monthlyDetailScrim.hidden = false;
}

function closeMonthlyDetailPane() {
  monthlyDetailPane.classList.remove('open');
  monthlyDetailPane.setAttribute('aria-hidden', 'true');
  monthlyDetailScrim.hidden = true;
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
    
    const card = document.createElement('div');
    card.className = 'account-card';
    const tradingFields = account.bankOnly ? '' : `
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
          <input type="number" class="input-account" data-account="${account.key}" data-field="unrealizedPnL" value="${data.unrealizedPnL}" placeholder="0" />
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
        <div class="form-group">
          <label>入金</label>
          <input type="number" class="input-account" data-account="${account.key}" data-field="deposit" value="${data.deposit}" placeholder="0" />
          <span class="suffix">¥</span>
        </div>
        <div class="form-group">
          <label>出金</label>
          <input type="number" class="input-account" data-account="${account.key}" data-field="withdrawal" value="${data.withdrawal}" placeholder="0" />
          <span class="suffix">¥</span>
        </div>
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
}

function handleAccountInputFocus(event) {
  const input = event.target;
  if (input.value === '0') {
    input.value = '';
  }
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

function renderInitialCapitalForm() {
  if (!yearInitialFunds[currentYear]) yearInitialFunds[currentYear] = {};
  
  updateYearSelect();
  
  const accountKeys = {
    'initGMO': 'gmo',
    'initLightFX': 'lightfx',
    'initMinano': 'minano',
    'initSBI': 'sbi',
    'initSBIVC': 'sbivc',
    'initSMBC': 'smbc'
  };
  
  for (const [elemId, accountKey] of Object.entries(accountKeys)) {
    document.getElementById(elemId).value = yearInitialFunds[currentYear][accountKey] || 0;
  }
  
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
  renderAll();
  applyInitialCapitalDefaultOpen();
});

document.getElementById('yearSelect').addEventListener('change', (e) => {
  currentYear = Number(e.target.value);
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
  
  const accountKeys = {
    'initGMO': 'gmo',
    'initLightFX': 'lightfx',
    'initMinano': 'minano',
    'initSBI': 'sbi',
    'initSBIVC': 'sbivc',
    'initSMBC': 'smbc'
  };
  
  for (const [elemId, accountKey] of Object.entries(accountKeys)) {
    yearInitialFunds[year][accountKey] = Number(document.getElementById(elemId).value) || 0;
  }
  
  saveToStorage();
  updateInitialCapitalStatus();
  renderAnnualSummary();
  renderPerformanceChart();
  renderAccountInputs();
  
  const toast = document.createElement('div');
  toast.style.cssText = 'position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); background: rgba(62,224,143,.2); color: #3EE08F; padding: 10px 20px; border-radius: 8px; border: 1px solid rgba(62,224,143,.3); font-size: 12px; font-weight: 600; z-index: 100;';
  toast.textContent = '✔ 年初資金を保存しました';
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
});

document.getElementById('saveMonthData').addEventListener('click', () => {
  const confirmed = window.confirm(currentYear + '年' + currentMonth + '月のデータを保存します。よろしいですか？');
  if (!confirmed) return;

  document.querySelectorAll('.input-account').forEach(el => {
    const account = el.dataset.account;
    const field = el.dataset.field;
    const value = Number(el.value) || 0;
    tradingData[currentYear][currentMonth][account][field] = normalizeCashflowValue(field, value);
  });
  
  saveToStorage();
  renderAnnualSummary();
  renderPerformanceChart();
  renderMonthlyDisplay();
  if (monthlyDetailPane.classList.contains('open')) {
    renderMonthlyDetailPane(currentMonth);
  }
  
  const toast = document.createElement('div');
  toast.style.cssText = 'position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); background: rgba(62,224,143,.2); color: #3EE08F; padding: 10px 20px; border-radius: 8px; border: 1px solid rgba(62,224,143,.3); font-size: 12px; font-weight: 600; z-index: 100;';
  toast.textContent = '✔ ' + currentYear + '年' + currentMonth + '月データを保存しました';
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
});

monthlyDetailClose?.addEventListener('click', closeMonthlyDetailPane);
monthlyDetailScrim?.addEventListener('click', closeMonthlyDetailPane);

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
  renderMonthlyDisplay();
  renderMonthTabs();
  renderAccountInputs();
  renderInitialCapitalForm();
}

window.addEventListener('load', () => {
  loadFromStorage();
  seedDemoDataIfEmpty();
  currentMonth = new Date().getMonth() + 1;
  renderAll();
  applyInitialCapitalDefaultOpen();
});
