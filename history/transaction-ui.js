(function (root) {
  'use strict';
  const nodeModule = typeof module !== 'undefined' && module.exports;
  const view = nodeModule ? require('../assets/transaction-view.js') : root.TradeScopeTransactionView;
  const display = nodeModule ? require('../assets/transaction-display.js') : root.TradeScopeTransactionDisplay;
  const adoption = nodeModule ? require('../assets/transaction-adoption-view.js') : root.TradeScopeTransactionAdoptionView;
  const asset = value => ({ Stock: '証券', ETF: 'ETF', MutualFund: '投資信託', Crypto: '暗号資産' })[value] || value;
  const category = r => r.marketType==='spot'?'現物':({ new: '新規', add: '追加', partial_close: '一部決済', full_close: '全決済' })[r.category] || (r.type === 'open' ? '新規' : r.type === 'close' ? '決済' : r.category || 'その他');
  const side = r => r.side === 'buy' ? '買' : r.side === 'sell' ? '売' : null;
  function create(document, enhancements = {}) {
    const $ = id => document.getElementById(id);
    let records = [], context = null, limit = 50, failed = false, opened = null, expandedId = null;
    let currentModels=null,currentManual=[],readFingerprint=null;
    const node = (tag, text, className) => { const n = document.createElement(tag); n.textContent = text; if (className) n.className = className; return n; };
    function options(id, values) { const select = $(id), old = select.value; select.replaceChildren(...values.map(([value, label]) => { const o = node('option', label); o.value = value; return o; })); select.value = values.some(([v]) => v === old) ? old : ''; }
    function selection() { return { month: $('filterMonth').value, account: $('filterAccount').value, symbol: $('filterSymbol').value, type: $('filterCategory').value, source: $('filterSource').value, strategy: $('filterStrategy').value, order: $('sortOrder').value === 'oldest' ? 'asc' : 'desc' }; }
    function detail(r, p) {
      const fragment = node('div', '', 'transaction-detail-content'), dl = node('dl', '', 'transaction-detail-grid'), audit = node('dl', '', 'transaction-detail-grid');
      const addTo = (target, label, value,showMissing=false) => { if (value !== null && value !== undefined && value !== '' && (value !== '—'||showMissing)) target.append(node('dt', label), node('dd', String(value))); };
      const add = (label, value,showMissing=false) => addTo(dl, label, value,showMissing), addAudit = (label, value) => addTo(audit, label, value);
      add(p.dateLabel, p.fullDate); add('口座', r.account); if (r.assetType !== 'FX') add('資産', asset(r.assetType)); add('銘柄', r.symbol); add('売買', side(r)); add('区分', category(r));
      add('数量', p.quantity === null ? null : p.quantity + (p.lots !== null && p.units !== null ? `（${display.number(p.units)}通貨）` : '')); add(p.priceLabel, p.price); add(p.amountLabel, p.amount); add('個別損益', r.transactionVersion===3?p.pnl??'—':p.pnl,r.transactionVersion===3);
      if (p.amountLabel !== '受渡金額 / 決済損益' || p.amount === null) add('受渡金額 / 決済損益', p.settlementObservation);
      add(p.feeLabel, r.transactionVersion===3?p.fee??'—':p.fee,r.transactionVersion===3);
      if(r.transactionVersion===3){add('取引スワップ',p.transactionSwap??'—',true);add('受渡日',r.settlementDate??'—',true);}
      add('戦略', r.strategy); add('メモ', r.memo);
      addAudit('出典', r.sourceLabel);
      const locations = r.sources.map(s => {
        // GMO sourceRow counts recognized table records, not a printed PDF line.
        if (['gmo','sbivc','lightfx','minna'].includes(s.kind)) return Number.isSafeInteger(s.page) && s.page > 0 ? `PDF ${s.page}ページ` : null;
        const source = s.kind === 'sbi' ? context?.raw.get(s.id) : null;
        return Number.isSafeInteger(source?.sourceRowNumber) && source.sourceRowNumber > 0 ? `CSV ${source.sourceRowNumber}行` : null;
      }).filter(Boolean);
      addAudit('原本位置', [...new Set(locations)].join(' / '));
      addAudit('注文番号', r.orderId); addAudit('約定ID', r.executionId);
      if(r.transactionVersion===3)addAudit('対象新規注文',r.sourceOpenOrderRef);
      const raw = p.facts.raw;
      for (const [key, label] of [['custody', '預り区分'], ['market', '市場'], ['settlementDate', '受渡日']]) add(label, raw[key]);
      addAudit('原取引区分', raw.transactionType || p.facts.original.rawTransactionType);
      fragment.append(node('h3', '取引詳細', 'transaction-detail-title'), dl, node('h3', '原本・監査情報', 'transaction-detail-title transaction-audit-title'), audit);
      if (r.manualId) { const b = node('button', '手入力を編集', 'edit-btn memo-edit-btn'); b.type = 'button'; b.dataset.entryId = r.manualId; fragment.append(b); }
      enhancements.decorateDetail?.(r,fragment,{onDismiss:()=>{const button=opened?.button;closeOpened();button?.focus();}});
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
      button.addEventListener('click', () => {if(adoption.fingerprint(currentModels)!==readFingerprint){render(false);return;}opened?.panel === panel ? closeOpened() : open();}); article.append(button, panel);
      if (expandedId === r.id) open(); return article;
    }
    function render(reset = true) {
      if(!failed&&adoption.fingerprint(currentModels)!==readFingerprint){records=view.resolve(currentManual,currentModels);context=display.createContext(currentManual,currentModels);readFingerprint=adoption.fingerprint(currentModels);expandedId=null;}
      if (reset) { limit = 50; expandedId = null; } opened = null;
      const selected = selection(), filtered = view.filter(records, selected), visible = filtered.slice(0, limit), body = $('historyBody');
      const states=!failed&&!visible.length?view.projectV3(currentModels).states.filter(r=>r.target.targetMonth===selected.month&&(!selected.account||r.target.accountId===selected.account)&&(!selected.source||r.target.sourceProvider===selected.source)):[];
      const unavailable=states.some(r=>['stale','conflict','broken-reference'].includes(r.status)),pending=states.some(r=>['unknown','deferred-without-current'].includes(r.status));
      body.replaceChildren(...visible.map(row));
      if (!visible.length) body.append(node('p', failed||unavailable ? '取引データを確認できません。再読み込みしてください' : pending?'採用済みの履歴がありません':'履歴がありません', 'history-empty'));
      $('historyCount').textContent = failed ? '' : unavailable||pending?'—':filtered.length > visible.length ? `${filtered.length}件中${visible.length}件表示` : `${filtered.length}件`;
      $('historyMore').hidden = visible.length >= filtered.length;
      const count = ['symbol', 'strategy', 'type', 'source'].filter(key => selected[key]).length + (selected.order === 'asc' ? 1 : 0);
      if ($('historyFilterLabel')) $('historyFilterLabel').textContent = '絞り込み' + (count ? ` ${count}` : '');
      return { total: filtered.length, visible: visible.length };
    }
    function refresh(manual, models, {preserveDetail=false} = {}) {
      currentModels=models;currentManual=manual;readFingerprint=adoption.fingerprint(models);
      failed = false; records = view.resolve(manual, models); context = display.createContext(manual, models);
      const pairs = key => [...new Map(records.map(r => [r[key], r[key]])).entries()].filter(([v]) => v).sort((a, b) => a[1].localeCompare(b[1], 'ja'));
      if (!$('filterMonth').value) $('filterMonth').value = records[0]?.date.slice(0, 7) || view.projectV3(models).states.map(r=>r.target.targetMonth).sort().at(-1) || new Date().toISOString().slice(0, 7);
      options('filterAccount', [['', 'すべて'], ...[...new Map(records.filter(r => r.accountId).map(r => [r.accountId, r.account])).entries()]]);
      options('filterSymbol', [['', 'すべて'], ...[...new Map(records.map(r => [r.instrumentKey || r.symbol, r.symbol])).entries()]]);
      options('filterStrategy', [['', 'すべて'], ...pairs('strategy')]); options('filterCategory', [['', 'すべて'], ['open', '新規'], ['close', '決済'], ['spot-buy','現物 買'], ['spot-sell','現物 売'], ['other', 'その他']]);
      options('filterSource', [['', 'すべて'], ['manual', '手入力'], ['sbi', 'SBI CSV'], ['gmo', 'GMO PDF'], ['sbivc','SBI VC PDF'],
        ...[['lightfx','LIGHT FX PDF'],['minna','みんなのFX PDF']].filter(([kind])=>records.some(r=>r.sources.some(s=>s.kind===kind)))]);
      const result=render(!preserveDetail);
      if(preserveDetail)opened?.panel.querySelector?.('.transaction-confirmation-status')?.focus();
      return result;
    }
    function fail() { failed = true; records = []; render(); }
    $('historyMore').addEventListener('click', () => { limit += 50; render(false); }); return Object.freeze({ refresh, render, fail });
  }
  const api = Object.freeze({ create }); if (nodeModule) module.exports = api; else root.TradeScopeTransactionUI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
