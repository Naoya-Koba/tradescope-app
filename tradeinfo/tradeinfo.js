// ===== 共通関数 =====
const drawer = document.getElementById('drawer');
const scrim = document.getElementById('scrim');
const menuButton = document.getElementById('menuButton');
const drawerClose = document.getElementById('drawerClose');

function openDrawer() { drawer.classList.add('open'); scrim.hidden = false; }
function closeDrawer() { drawer.classList.remove('open'); scrim.hidden = true; }

menuButton?.addEventListener('click', openDrawer);
drawerClose?.addEventListener('click', closeDrawer);
scrim?.addEventListener('click', closeDrawer);

// スワイプで閉じる
let startX = 0;
drawer.addEventListener('touchstart', e => startX = e.touches[0].clientX);
drawer.addEventListener('touchmove', e => {
  if (e.touches[0].clientX - startX < -60) closeDrawer();
});

// Toast
const toast = document.getElementById('toast');
const showToast = msg => {
  toast.textContent = msg;
  toast.hidden = false;
  setTimeout(() => toast.hidden = true, 2000);
};

// ===== 金額フォーマット =====
const fmtJPY = n => isFinite(n) ? '¥' + Math.round(n).toLocaleString() : '-';

// ===== Trade Data =====
let trades = JSON.parse(localStorage.getItem('tradeInfo') || '[]');
const tableBody = document.getElementById('tradeTableBody');
const statusFilter = document.getElementById('statusFilter');

// ===== フォーム切替 =====
const tabEntry = document.getElementById('tabEntry');
const tabExit = document.getElementById('tabExit');
const entryForm = document.getElementById('entryForm');
const exitForm = document.getElementById('exitForm');

tabEntry.addEventListener('click', () => {
  tabEntry.classList.add('active');
  tabExit.classList.remove('active');
  entryForm.classList.add('active');
  exitForm.classList.remove('active');
});
tabExit.addEventListener('click', () => {
  tabExit.classList.add('active');
  tabEntry.classList.remove('active');
  exitForm.classList.add('active');
  entryForm.classList.remove('active');
  updateExitSelect();
});

// ===== 新規エントリー保存 =====
entryForm.addEventListener('submit', e => {
  e.preventDefault();
  const trade = {
    id: Date.now().toString(),
    pair: entryPair.value,
    type: entryType.value,
    lot: parseFloat(entryLot.value || 0),
    entryDate: entryDate.value,
    entryPrice: parseFloat(entryPrice.value || 0),
    exitDate: null,
    exitPrice: null,
    profit: null,
    comment: entryComment.value,
    status: "open"
  };
  trades.push(trade);
  localStorage.setItem('tradeInfo', JSON.stringify(trades));
  showToast("新規エントリーを追加しました");
  entryForm.reset();
  renderTrades();
});

// ===== 決済入力保存 =====
exitForm.addEventListener('submit', e => {
  e.preventDefault();
  const id = exitSelect.value;
  const t = trades.find(t => t.id === id);
  if (!t) return;
  t.exitDate = exitDate.value;
  t.exitPrice = parseFloat(exitPrice.value);
  const diff = t.type === "Buy"
    ? (t.exitPrice - t.entryPrice)
    : (t.entryPrice - t.exitPrice);
  t.profit = diff * t.lot * 10000;
  t.comment = exitComment.value;
  t.status = "closed";
  localStorage.setItem('tradeInfo', JSON.stringify(trades));
  showToast("決済を記録しました");
  exitForm.reset();
  renderTrades();
});

// ===== 表示更新 =====
function renderTrades() {
  tableBody.innerHTML = '';
  const filter = statusFilter.value;
  const filtered = trades.filter(t => filter === 'all' || t.status === filter);
  for (const t of filtered) {
    const tr = document.createElement('tr');
    const profitClass = t.profit > 0 ? 'profit-pos' :
                        t.profit < 0 ? 'profit-neg' : '';
    tr.innerHTML = `
      <td>${t.entryDate || '-'}</td>
      <td>${t.pair}</td>
      <td>${t.type}</td>
      <td>${t.lot}</td>
      <td>${t.entryPrice ?? '-'}</td>
      <td>${t.exitPrice ?? '-'}</td>
      <td class="${profitClass}">${fmtJPY(t.profit)}</td>
      <td>${t.comment || ''}</td>
      <td class="status-${t.status}">
        ${t.status === 'open' ? '🟡保有中' : '🟢決済済'}
      </td>
      <td><button class="delete-btn" data-id="${t.id}">🗑</button></td>
    `;
    tableBody.appendChild(tr);
  }
  updateSummary();
}
statusFilter.addEventListener('change', renderTrades);

// ===== 削除 =====
tableBody.addEventListener('click', e => {
  if (e.target.matches('.delete-btn')) {
    const id = e.target.dataset.id;
    trades = trades.filter(t => t.id !== id);
    localStorage.setItem('tradeInfo', JSON.stringify(trades));
    showToast("削除しました");
    renderTrades();
  }
});

// ===== 集計 =====
function updateSummary() {
  const closed = trades.filter(t => t.status === 'closed');
  const wins = closed.filter(t => t.profit > 0);
  const losses = closed.filter(t => t.profit < 0);
  const avg = arr => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0;
  const avgProfit = avg(wins.map(t=>t.profit));
  const avgLoss = avg(losses.map(t=>t.profit));
  const total = closed.reduce((a,b)=>a+b.profit,0);
  const winRate = closed.length ? (wins.length / closed.length * 100).toFixed(1) : 0;
  document.getElementById('totalTrades').textContent = trades.length;
  document.getElementById('winRate').textContent = `${winRate}%`;
  document.getElementById('avgProfit').textContent = fmtJPY(avgProfit);
  document.getElementById('avgLoss').textContent = fmtJPY(avgLoss);
  document.getElementById('totalProfit').textContent = fmtJPY(total);
}

// ===== 決済対象リスト更新 =====
function updateExitSelect() {
  exitSelect.innerHTML = '';
  const openTrades = trades.filter(t => t.status === 'open');
  openTrades.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = `${t.entryDate} ${t.pair} (${t.type})`;
    exitSelect.appendChild(opt);
  });
}

// 初期表示
renderTrades();
