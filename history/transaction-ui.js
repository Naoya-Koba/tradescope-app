(function (root) {
  'use strict';
  const nodeModule = typeof module !== 'undefined' && module.exports;
  const view = nodeModule ? require('../assets/transaction-view.js') : root.TradeScopeTransactionView;
  const display = nodeModule ? require('../assets/transaction-display.js') : root.TradeScopeTransactionDisplay;
  const asset = value => ({ Stock: '証券', ETF: 'ETF', MutualFund: '投資信託', Crypto: '暗号資産' })[value] || value;
  const category = r => ({ new: '新規', add: '追加', partial_close: '一部決済', full_close: '全決済' })[r.category] || (r.type === 'open' ? '新規' : r.type === 'close' ? '決済' : r.category || 'その他');
  const side = r => r.side === 'buy' ? '買' : r.side === 'sell' ? '売' : null;
  function create(document) {
    const $ = id => document.getElementById(id);
    let records = [], context = null, limit = 50, failed = false, opened = null, expandedId = null;
    const node = (tag, text, className) => { const n = document.createElement(tag); n.textContent = text; if (className) n.className = className; return n; };
    function options(id, values) { const select = $(id), old = select.value; select.replaceChildren(...values.map(([value, label]) => { const o = node('option', label); o.value = value; return o; })); select.value = values.some(([v]) => v === old) ? old : ''; }
    function selection() { return { month: $('filterMonth').value, account: $('filterAccount').value, symbol: $('filterSymbol').value, type: $('filterCategory').value, source: $('filterSource').value, strategy: $('filterStrategy').value, order: $('sortOrder').value === 'oldest' ? 'asc' : 'desc' }; }
    function detail(r, p) {
      const dl = node('dl', '', 'transaction-detail-grid');
      const add = (label, value) => { if (value !== null && value !== undefined && value !== '' && value !== '—') dl.append(node('dt', label), node('dd', String(value))); };
      add('日時', p.fullDate); add('口座', r.account); add('資産', asset(r.assetType)); add('銘柄', r.symbol); add('売買', side(r)); add('区分', category(r));
      add('数量', p.quantity); add('実通貨数量', p.units === null ? null : display.number(p.units) + '通貨'); add(r.assetType === 'MutualFund' ? '基準価額' : '約定価格', p.price); add(p.amountLabel, p.amount); add('個別損益', p.pnl);
      if (p.amountLabel !== '受渡金額 / 決済損益' || p.amount === null) add('受渡金額 / 決済損益', p.settlementObservation);
      add('取得元', r.sourceLabel);
      const sourceLabels = { manual: '手入力', sbi: 'SBI CSV', gmo: 'GMO PDF' };
      if (r.sources.length > 1 || r.sources.some(s => s.page)) add('取得元の内訳', r.sources.map(s => (sourceLabels[s.kind] || s.kind) + (s.page ? ` · ${s.page}ページ` : '') + (s.row ? ` · ${s.row}行` : '')).join(' / '));
      add('注文番号', r.orderId); add('約定ID', r.executionId);
      const raw = p.facts.raw;
      for (const [key, label] of [['custody', '預り区分'], ['market', '市場'], ['settlementDate', '受渡日'], ['transactionType', '原取引区分']]) add(label, raw[key]);
      add('手数料', p.facts.original.fee == null ? null : display.number(p.facts.original.fee) + (p.facts.original.feeCurrency === 'JPY' ? '円' : p.facts.original.feeCurrency ? ' ' + p.facts.original.feeCurrency : ''));
      add('戦略', r.strategy); add('メモ', r.memo);
      const fragment = node('div', '', 'transaction-detail-content'); fragment.append(dl);
      if (r.manualId) { const b = node('button', '手入力を編集', 'edit-btn memo-edit-btn'); b.type = 'button'; b.dataset.entryId = r.manualId; fragment.append(b); }
      return fragment;
    }
    function closeOpened() { if (!opened) return; opened.button.setAttribute('aria-expanded', 'false'); opened.panel.hidden = true; opened.panel.replaceChildren(); opened = null; expandedId = null; }
    function row(r, index) {
      const p = display.present(r, context), article = node('article', '', 'transaction-row'), button = node('button', '', 'transaction-summary'), panel = node('div', '', 'transaction-detail');
      article.setAttribute('role', 'listitem'); article.dataset.transactionId = r.id; button.type = 'button';
      panel.id = `transaction-detail-${index}`; panel.hidden = true; button.setAttribute('aria-controls', panel.id); button.setAttribute('aria-expanded', 'false');
      const top = node('span', '', 'transaction-meta'); top.append(node('span', p.shortDate, 'transaction-date'), node('span', r.account, 'transaction-account'));
      const main = node('span', '', 'transaction-main'); main.append(node('span', r.symbol, 'transaction-symbol'), node('span', [side(r), category(r)].filter(Boolean).join('・'), 'transaction-type'));
      const bottom = node('span', '', 'transaction-values'); bottom.append(node('span', p.summary, 'transaction-amount'));
      if (p.pnl !== null) bottom.append(node('span', p.pnl, 'transaction-pnl ' + p.pnlSign));
      const chevron = node('span', '›', 'transaction-chevron'); chevron.setAttribute('aria-hidden', 'true'); button.append(top, main, bottom, chevron);
      const open = () => { closeOpened(); panel.replaceChildren(detail(r, p)); panel.hidden = false; button.setAttribute('aria-expanded', 'true'); opened = { button, panel }; expandedId = r.id; };
      button.addEventListener('click', () => opened?.panel === panel ? closeOpened() : open()); article.append(button, panel);
      if (expandedId === r.id) open(); return article;
    }
    function render(reset = true) {
      if (reset) { limit = 50; expandedId = null; } opened = null;
      const selected = selection(), filtered = view.filter(records, selected), visible = filtered.slice(0, limit), body = $('historyBody');
      body.replaceChildren(...visible.map(row));
      if (!visible.length) body.append(node('p', failed ? '取引データを確認できません。再読み込みしてください' : '履歴がありません', 'history-empty'));
      $('historyCount').textContent = failed ? '' : filtered.length > visible.length ? `${filtered.length}件中${visible.length}件表示` : `${filtered.length}件`;
      $('historyMore').hidden = visible.length >= filtered.length;
      const count = ['symbol', 'strategy', 'type', 'source'].filter(key => selected[key]).length + (selected.order === 'asc' ? 1 : 0);
      if ($('historyFilterLabel')) $('historyFilterLabel').textContent = '絞り込み' + (count ? ` ${count}` : '');
      return { total: filtered.length, visible: visible.length };
    }
    function refresh(manual, models) {
      failed = false; records = view.resolve(manual, models); context = display.createContext(manual, models);
      const pairs = key => [...new Map(records.map(r => [r[key], r[key]])).entries()].filter(([v]) => v).sort((a, b) => a[1].localeCompare(b[1], 'ja'));
      if (!$('filterMonth').value) $('filterMonth').value = records[0]?.date.slice(0, 7) || new Date().toISOString().slice(0, 7);
      options('filterAccount', [['', 'すべて'], ...[...new Map(records.filter(r => r.accountId).map(r => [r.accountId, r.account])).entries()]]);
      options('filterSymbol', [['', 'すべて'], ...[...new Map(records.map(r => [r.instrumentKey || r.symbol, r.symbol])).entries()]]);
      options('filterStrategy', [['', 'すべて'], ...pairs('strategy')]); options('filterCategory', [['', 'すべて'], ['open', '新規'], ['close', '決済'], ['other', 'その他']]);
      options('filterSource', [['', 'すべて'], ['manual', '手入力'], ['sbi', 'SBI CSV'], ['gmo', 'GMO PDF']]); return render();
    }
    function fail() { failed = true; records = []; render(); }
    $('historyMore').addEventListener('click', () => { limit += 50; render(false); }); return Object.freeze({ refresh, render, fail });
  }
  const api = Object.freeze({ create }); if (nodeModule) module.exports = api; else root.TradeScopeTransactionUI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
