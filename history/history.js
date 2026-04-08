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

function renderOpenPositions(entries) {
  const openPositions = historyCore.calculateOpenPositions(entries);
  const tbody = document.getElementById('openPositionsBody');
  const summary = document.getElementById('openPositionsSummary');

  if (!openPositions.length) {
    summary.textContent = '現在保有中の建玉はありません。';
    tbody.innerHTML = '<tr><td colspan="5" style="color:#aab5d0;">建玉がありません</td></tr>';
    return;
  }

  summary.textContent = `保有建玉: ${openPositions.length} 件`;
  tbody.innerHTML = openPositions.map((position) => {
    const sideLabel = position.side === 'buy' ? '買い' : '売り';
    const sideClass = position.side === 'buy' ? 'tag-buy' : 'tag-sell';
    return `
      <tr>
        <td>${escapeHtml(position.account)}</td>
        <td>${escapeHtml(position.symbol)}</td>
        <td><span class="${sideClass}">${sideLabel}</span></td>
        <td>${fmtQuantity(position.absQuantity)}</td>
        <td>${fmtRate(position.avgRate)}</td>
      </tr>
    `;
  }).join('');
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
