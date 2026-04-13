const historyCore = window.TradeScopeHistory;

const ACCOUNTS = ['GMO', 'Light FX', 'みんなのFX', 'SBI', 'SBI VC', '三井住友銀行'];
const ASSET_TYPES = ['FX', '暗号資産', 'NISA', 'その他'];
const CATEGORIES = ['new', 'add', 'partial_close', 'full_close'];
const CATEGORY_LABELS = {
  new: '新規',
  add: '追加',
  partial_close: '一部決済',
  full_close: '全決済'
};
const STRATEGIES = ['', 'キャリー', 'キャピタルゲイン'];
const STRATEGY_LABELS = {
  '': '-',
  'キャリー': 'キャリー',
  'キャピタルゲイン': 'キャピタルゲイン'
};
const OPEN_POSITIONS_VIEW_KEY = 'tradeScopeOpenPositionsView';

let openPositionsView = 'merged';

const drawer = document.getElementById('drawer');
const scrim = document.getElementById('scrim');
const menuButton = document.getElementById('menuButton');
const drawerClose = document.getElementById('drawerClose');

drawer?.querySelectorAll('.menu-item').forEach((item, idx) => {
  const order = item.dataset.order || idx;
  item.style.setProperty('--menu-order', String(order));
});

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && drawer?.classList.contains('open')) closeDrawer();
});

document.querySelectorAll('.drawer .menu-item').forEach((item) => {
  item.addEventListener('click', closeDrawer);
});

function fmtJPY(value) {
  if (!Number.isFinite(value)) return '-';
  const abs = Math.round(Math.abs(value)).toLocaleString();
  return value < 0 ? `-¥${abs}` : `¥${abs}`;
}

function fmtRate(value) {
  if (!Number.isFinite(value)) return '-';
  return Number(value).toLocaleString('ja-JP', { minimumFractionDigits: 3, maximumFractionDigits: 5 });
}

function fmtQuantity(value) {
  if (!Number.isFinite(value)) return '-';
  return Number(value).toLocaleString('ja-JP', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
}

function toOptionHtml(value, label, selected = false) {
  return `<option value="${escapeHtml(value)}"${selected ? ' selected' : ''}>${escapeHtml(label)}</option>`;
}

function uniqueSortedValues(entries, field) {
  return [...new Set((entries || []).map((entry) => entry[field]).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'ja'));
}

function normalizeOpenPositionsView(value) {
  return value === 'account' ? 'account' : 'merged';
}

function loadOpenPositionsView() {
  try {
    const raw = localStorage.getItem(OPEN_POSITIONS_VIEW_KEY);
    return normalizeOpenPositionsView(raw);
  } catch {
    return 'merged';
  }
}

function saveOpenPositionsView(value) {
  try {
    localStorage.setItem(OPEN_POSITIONS_VIEW_KEY, normalizeOpenPositionsView(value));
  } catch {
    // ignore storage errors
  }
}

function applyOpenViewSwitchState() {
  const mergedBtn = document.getElementById('openViewMerged');
  const accountBtn = document.getElementById('openViewAccount');
  if (!mergedBtn || !accountBtn) return;

  const isMerged = openPositionsView === 'merged';
  mergedBtn.classList.toggle('active', isMerged);
  accountBtn.classList.toggle('active', !isMerged);
  mergedBtn.setAttribute('aria-selected', isMerged ? 'true' : 'false');
  accountBtn.setAttribute('aria-selected', isMerged ? 'false' : 'true');
}

function buildBaseSelectOptions() {
  const accountSelect = document.getElementById('entryAccount');
  const assetTypeSelect = document.getElementById('entryAssetType');
  const categorySelect = document.getElementById('entryCategory');
  const strategySelect = document.getElementById('entryStrategy');

  accountSelect.innerHTML = ACCOUNTS.map((v, idx) => toOptionHtml(v, v, idx === 0)).join('');
  assetTypeSelect.innerHTML = ASSET_TYPES.map((v, idx) => toOptionHtml(v, v, idx === 0)).join('');
  categorySelect.innerHTML = CATEGORIES.map((v, idx) => toOptionHtml(v, CATEGORY_LABELS[v], idx === 0)).join('');
  strategySelect.innerHTML = STRATEGIES.map((v) => toOptionHtml(v, STRATEGY_LABELS[v] || v, v === '')).join('');
}

function buildFilters(entries) {
  const filterAccount = document.getElementById('filterAccount');
  const filterSymbol = document.getElementById('filterSymbol');
  const filterStrategy = document.getElementById('filterStrategy');
  const filterCategory = document.getElementById('filterCategory');
  const symbolHints = document.getElementById('symbolHints');

  const current = {
    account: filterAccount.value,
    symbol: filterSymbol.value,
    strategy: filterStrategy.value,
    category: filterCategory.value
  };

  const accounts = uniqueSortedValues(entries, 'account');
  const symbols = uniqueSortedValues(entries, 'symbol');
  const strategies = uniqueSortedValues(entries, 'strategy');

  filterAccount.innerHTML = [toOptionHtml('', 'すべて', current.account === ''), ...accounts.map((v) => toOptionHtml(v, v, current.account === v))].join('');
  filterSymbol.innerHTML = [toOptionHtml('', 'すべて', current.symbol === ''), ...symbols.map((v) => toOptionHtml(v, v, current.symbol === v))].join('');
  filterStrategy.innerHTML = [toOptionHtml('', 'すべて', current.strategy === ''), ...strategies.map((v) => toOptionHtml(v, v, current.strategy === v))].join('');
  filterCategory.innerHTML = [toOptionHtml('', 'すべて', current.category === ''), ...CATEGORIES.map((v) => toOptionHtml(v, CATEGORY_LABELS[v], current.category === v))].join('');

  // symbolHints は入力フォームで選択中の資産区分に絞って候補を出す
  const entryAssetType = document.getElementById('entryAssetType').value;
  const hintSymbols = uniqueSortedValues(entries.filter(e => e.assetType === entryAssetType), 'symbol');
  symbolHints.innerHTML = hintSymbols.map((symbol) => `<option value="${escapeHtml(symbol)}"></option>`).join('');
}

function readFilters() {
  return {
    account: document.getElementById('filterAccount').value,
    symbol: document.getElementById('filterSymbol').value,
    strategy: document.getElementById('filterStrategy').value,
    category: document.getElementById('filterCategory').value
  };
}

function aggregateOpenPositions(positions) {
  const map = new Map();

  (positions || []).forEach((position) => {
    const symbolKey = historyCore.normalizeSymbolKey
      ? historyCore.normalizeSymbolKey(position.symbol)
      : String(position.symbol || '').toUpperCase().replace(/\s+/g, '');
    const key = `${symbolKey}::${position.assetType || ''}`;
    const signedQty = position.side === 'sell' ? -Math.abs(Number(position.absQuantity) || 0) : Math.abs(Number(position.absQuantity) || 0);
    if (!Number.isFinite(signedQty) || Math.abs(signedQty) < 1e-12) return;

    const current = map.get(key) || {
      symbol: position.symbol,
      assetType: position.assetType,
      quantity: 0,
      avgRate: 0,
      accounts: new Set(),
      strategies: new Set(),
      parts: []
    };

    const nextQty = current.quantity + signedQty;

    if (current.quantity === 0 || Math.sign(current.quantity) === Math.sign(signedQty)) {
      const currentAbs = Math.abs(current.quantity);
      const addAbs = Math.abs(signedQty);
      const weighted = ((current.avgRate * currentAbs) + ((Number(position.avgRate) || 0) * addAbs)) / (currentAbs + addAbs);
      current.quantity = nextQty;
      current.avgRate = Number.isFinite(weighted) ? weighted : Number(position.avgRate) || 0;
    } else if (Math.abs(nextQty) < 1e-12) {
      current.quantity = 0;
      current.avgRate = 0;
    } else if (Math.sign(nextQty) === Math.sign(current.quantity)) {
      current.quantity = nextQty;
    } else {
      current.quantity = nextQty;
      current.avgRate = Number(position.avgRate) || 0;
    }

    if (position.account) current.accounts.add(position.account);
    if (position.strategy) current.strategies.add(position.strategy);
    current.parts.push({
      account: position.account,
      side: position.side,
      quantity: Number(position.absQuantity) || 0,
      avgRate: Number(position.avgRate) || 0,
      strategy: position.strategy || ''
    });

    map.set(key, current);
  });

  return Array.from(map.values())
    .filter((position) => Math.abs(position.quantity) > 1e-12)
    .map((position) => {
      const accountList = [...position.accounts].sort((a, b) => String(a).localeCompare(String(b), 'ja'));
      const strategies = [...position.strategies].sort((a, b) => String(a).localeCompare(String(b), 'ja'));
      return {
        viewMode: 'merged',
        symbol: position.symbol,
        assetType: position.assetType,
        side: position.quantity >= 0 ? 'buy' : 'sell',
        absQuantity: Math.abs(position.quantity),
        avgRate: position.avgRate,
        accountLabel: `${accountList.length}口座`,
        accountList,
        strategyLabel: strategies.length === 0 ? '-' : (strategies.length === 1 ? strategies[0] : '複数'),
        details: position.parts.sort((a, b) => String(a.account).localeCompare(String(b.account), 'ja'))
      };
    })
    .sort((a, b) => {
      const symbolCompare = String(a.symbol).localeCompare(String(b.symbol), 'ja');
      if (symbolCompare !== 0) return symbolCompare;
      return String(a.assetType).localeCompare(String(b.assetType), 'ja');
    });
}

function normalizeAccountOpenPositions(positions) {
  return (positions || [])
    .map((position) => ({
      viewMode: 'account',
      accountLabel: position.account,
      symbol: position.symbol,
      assetType: position.assetType,
      side: position.side,
      absQuantity: position.absQuantity,
      avgRate: position.avgRate,
      strategyLabel: position.strategy || '-',
      details: [{
        account: position.account,
        side: position.side,
        quantity: Number(position.absQuantity) || 0,
        avgRate: Number(position.avgRate) || 0,
        strategy: position.strategy || ''
      }]
    }))
    .sort((a, b) => {
      const accountCompare = String(a.accountLabel).localeCompare(String(b.accountLabel), 'ja');
      if (accountCompare !== 0) return accountCompare;
      return String(a.symbol).localeCompare(String(b.symbol), 'ja');
    });
}

function renderOpenPositionDetail(position) {
  const detail = document.getElementById('openPositionDetail');
  if (!detail || !position) return;

  const sideLabel = position.side === 'buy' ? '買い' : '売り';
  const accountsLabel = position.viewMode === 'merged'
    ? (position.accountList?.join(' / ') || '-')
    : (position.accountLabel || '-');
  const breakdown = (position.details || []).map((row) => {
    const rowSide = row.side === 'buy' ? '買い' : '売り';
    return `<li>${escapeHtml(row.account)}: ${rowSide} ${fmtQuantity(row.quantity)} @ ${fmtRate(row.avgRate)}</li>`;
  }).join('');

  detail.innerHTML = `
    <p class="open-position-detail-title">${escapeHtml(position.symbol)} / ${escapeHtml(position.assetType || '-')}</p>
    <div class="open-position-detail-meta">
      <span><strong>表示:</strong> ${position.viewMode === 'merged' ? '統合表示' : '口座別表示'}</span>
      <span><strong>方向:</strong> ${sideLabel}</span>
      <span><strong>数量:</strong> ${fmtQuantity(position.absQuantity)}</span>
      <span><strong>平均レート:</strong> ${fmtRate(position.avgRate)}</span>
      <span><strong>口座:</strong> ${escapeHtml(accountsLabel)}</span>
      <span><strong>戦略:</strong> ${escapeHtml(position.strategyLabel || '-')}</span>
      <span><strong>内訳:</strong></span>
      <ul>${breakdown}</ul>
    </div>
  `;
  detail.hidden = false;
}

function renderOpenPositions(entries) {
  const openPositions = historyCore.calculateOpenPositions(entries);
  const tbody = document.getElementById('openPositionsBody');
  const summary = document.getElementById('openPositionsSummary');
  const primaryHeader = document.getElementById('openPositionsPrimaryHeader');
  const detail = document.getElementById('openPositionDetail');

  const rows = openPositionsView === 'merged'
    ? aggregateOpenPositions(openPositions)
    : normalizeAccountOpenPositions(openPositions);

  if (primaryHeader) {
    primaryHeader.textContent = openPositionsView === 'merged' ? '集計' : '口座';
  }

  if (!rows.length) {
    summary.textContent = '現在保有中の建玉はありません。';
    tbody.innerHTML = '<tr><td colspan="5" style="color:#aab5d0;">建玉がありません</td></tr>';
    if (detail) detail.hidden = true;
    return;
  }

  if (openPositionsView === 'merged') {
    summary.textContent = `統合表示: ${rows.length} 銘柄`; 
  } else {
    summary.textContent = `口座別表示: ${rows.length} 件`;
  }

  tbody.innerHTML = rows.map((position, idx) => {
    const sideLabel = position.side === 'buy' ? '買い' : '売り';
    const sideClass = position.side === 'buy' ? 'tag-buy' : 'tag-sell';
    return `
      <tr class="open-position-row" data-open-position-index="${idx}">
        <td>${escapeHtml(position.accountLabel)}</td>
        <td>${escapeHtml(position.symbol)}</td>
        <td><span class="${sideClass}">${sideLabel}</span></td>
        <td>${fmtQuantity(position.absQuantity)}</td>
        <td>${fmtRate(position.avgRate)}</td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('[data-open-position-index]').forEach((rowEl) => {
    rowEl.addEventListener('click', () => {
      const idx = Number(rowEl.dataset.openPositionIndex);
      if (!Number.isFinite(idx)) return;
      renderOpenPositionDetail(rows[idx]);
    });
  });
}

function renderHistoryTable(entries) {
  const filters = readFilters();
  const sortOrder = document.getElementById('sortOrder').value;
  const filtered = historyCore.filterEntries(entries, filters);
  const sorted = historyCore.getSortedEntries(filtered, sortOrder);
  const tbody = document.getElementById('historyBody');

  if (!sorted.length) {
    tbody.innerHTML = '<tr><td colspan="11" style="color:#aab5d0;">履歴がありません</td></tr>';
    return;
  }

  tbody.innerHTML = sorted.map((entry) => `
    <tr>
      <td>${escapeHtml(entry.date)}</td>
      <td>${escapeHtml(entry.account)}</td>
      <td>${escapeHtml(entry.assetType)}</td>
      <td>${escapeHtml(entry.symbol)}</td>
      <td><span class="${entry.side === 'buy' ? 'tag-buy' : 'tag-sell'}">${entry.side === 'buy' ? '買い' : '売り'}</span></td>
      <td>${escapeHtml(CATEGORY_LABELS[entry.category] || entry.category)}</td>
      <td>${fmtQuantity(entry.quantity)}</td>
      <td>${fmtRate(entry.rate)}</td>
      <td>${escapeHtml(entry.strategy || '-')}</td>
      <td>${escapeHtml(entry.memo || '-')}</td>
      <td><button type="button" class="delete-btn" data-delete-id="${escapeHtml(entry.id)}">削除</button></td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-delete-id]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!confirm('この履歴を削除しますか？')) return;
      historyCore.removeEntry(button.dataset.deleteId);
      renderAll();
    });
  });
}

function readFormEntry() {
  const date = document.getElementById('entryDate').value;
  const account = document.getElementById('entryAccount').value;
  const assetType = document.getElementById('entryAssetType').value;
  const symbol = document.getElementById('entrySymbol').value.trim();
  const side = document.getElementById('entrySide').value;
  const category = document.getElementById('entryCategory').value;
  const quantity = Number(document.getElementById('entryQuantity').value);
  const rate = Number(document.getElementById('entryRate').value);
  const strategy = document.getElementById('entryStrategy').value;
  const memo = document.getElementById('entryMemo').value.trim();

  if (!date || !account || !assetType || !symbol || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(rate) || rate < 0) {
    return null;
  }

  // HUF/JPY は1ロット10万通貨
  const symbolKey = historyCore.normalizeSymbolKey ? historyCore.normalizeSymbolKey(symbol) : symbol.toUpperCase().trim();
  const isHuf = symbolKey === 'HUF/JPY';
  const payload = {
    date,
    account,
    assetType,
    symbol,
    side,
    category,
    quantity,
    rate,
    strategy,
    memo,
    contractSize: assetType === 'FX'
      ? (isHuf ? (historyCore.HUF_CONTRACT_SIZE || 100000) : historyCore.FX_CONTRACT_SIZE_DEFAULT)
      : 1
  };

  return payload;
}

function resetForm() {
  document.getElementById('entryQuantity').value = '';
  document.getElementById('entryRate').value = '';
  document.getElementById('entryMemo').value = '';
}

function bindEvents() {
  document.getElementById('saveEntryBtn').addEventListener('click', () => {
    const payload = readFormEntry();
    if (!payload) {
      alert('必須項目を確認してください。');
      return;
    }

    // キャリー戦略でリスク集計対象外ペアの場合は確認
    if (payload.assetType === 'FX' && payload.strategy === 'キャリー' && historyCore.isCarryPair) {
      if (!historyCore.isCarryPair(payload.symbol)) {
        if (!confirm(`「${payload.symbol}」はリスク集計対象外のペアです。登録しますか？`)) return;
      }
    }

    const saved = historyCore.addEntry(payload);
    if (!saved) {
      alert('入力内容が不正です。');
      return;
    }

    resetForm();
    renderAll();
  });

  ['filterAccount', 'filterSymbol', 'filterStrategy', 'filterCategory', 'sortOrder'].forEach((id) => {
    document.getElementById(id).addEventListener('change', () => {
      const entries = historyCore.parseEntries();
      renderHistoryTable(entries);
    });
  });

  // 資産区分変更時に通貨ペア候補を更新
  document.getElementById('entryAssetType').addEventListener('change', () => {
    const entries = historyCore.parseEntries();
    buildFilters(entries);
  });

  document.querySelectorAll('[data-open-view]').forEach((button) => {
    button.addEventListener('click', () => {
      const nextView = normalizeOpenPositionsView(button.dataset.openView);
      if (nextView === openPositionsView) return;
      openPositionsView = nextView;
      saveOpenPositionsView(openPositionsView);
      applyOpenViewSwitchState();
      renderOpenPositions(historyCore.parseEntries());
    });
  });
}

function renderAll() {
  const entries = historyCore.parseEntries();
  buildFilters(entries);
  renderOpenPositions(entries);
  renderHistoryTable(entries);
}

// ===== Backup: Export / Import History Data =====
function exportHistoryData() {
  const entries = historyCore.parseEntries();
  const payload = {
    tradescope: 'history-backup',
    exportedAt: new Date().toISOString(),
    entries: entries
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `tradescope-history-backup-${dateStr}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importHistoryData(file) {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);

      if (parsed.tradescope !== 'history-backup') {
        alert('ファイル形式が正しくありません。TradeScope の履歴バックアップファイルを選択してください。');
        return;
      }

      if (!confirm('現在の取引履歴をインポートデータで上書きします。よろしいですか？')) return;

      historyCore.saveEntries(parsed.entries || []);
      renderAll();

      alert('インポートが完了しました。');
    } catch (error) {
      console.error('Import error:', error);
      alert('ファイルの読み込みに失敗しました。');
    }
  };
  reader.readAsText(file);
}

window.addEventListener('load', () => {
  if (!historyCore?.parseEntries || !historyCore?.addEntry || !historyCore?.calculateOpenPositions) {
    alert('履歴データの初期化に失敗しました。ページを再読み込みしてください。');
    return;
  }

  buildBaseSelectOptions();
  openPositionsView = loadOpenPositionsView();
  applyOpenViewSwitchState();
  document.getElementById('entryDate').value = new Date().toISOString().slice(0, 10);
  bindEvents();
  renderAll();

  // Backup button listeners
  document.getElementById('exportHistoryBtn')?.addEventListener('click', exportHistoryData);
  document.getElementById('importHistoryInput')?.addEventListener('change', (e) => {
    importHistoryData(e.target.files[0]);
    e.target.value = '';
  });
});
