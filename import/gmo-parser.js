(function (root) {
  'use strict';
  const csv = typeof module !== 'undefined' && module.exports ? require('./csv-core.js') : root.TradeScopeCSV;
  const version = 'gmo-fx-monthly-v2';
  const clean = text => String(text || '').replace(/\s/g, '');
  const decimal = text => {
    const value = String(text ?? '').trim().replace(/,/g, '').replace(/^\+/, '');
    return value.length <= 128 && /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value) ? value : null;
  };
  const zero = value => value !== null && /^-?0(?:\.0+)?$/.test(value);
  const negative = value => value.startsWith('-') ? value.slice(1) : '-' + value;
  const equal = (a, b) => a !== null && b !== null && zero(csv.sum([a, negative(b)]));
  function lines(page) {
    const result = [];
    for (const item of [...page.items].sort((a, b) => b.y - a.y || a.x - b.x)) {
      if (!item.text?.trim()) continue;
      let line = result.find(row => Math.abs(row.y - item.y) < 2);
      if (!line) { line = { y: item.y, items: [] }; result.push(line); }
      line.items.push(item);
    }
    return result.map(row => ({ ...row, text: row.items.map(i => i.text).join(' ') }));
  }
  function detect(document) {
    if (!document?.pages?.length) return false;
    const all = document.pages.flatMap(page => page.items).map(item => clean(item.text));
    return all.includes('GMOクリック証券株式会社') && all.includes('取引残高報告書')
      && all.includes('<<残高明細>>') && all.includes('建玉必要証拠金額') && all.includes('<<入出金明細>>');
  }
  // Column boundaries derive from the printed headers, never page numbers or personal identifiers.
  function table(page, names, firstName, section) {
    const rows = lines(page), header = rows.find(row => row.items.some(i => clean(i.text) === firstName)
      && names.every(name => row.items.some(i => clean(i.text) === name)));
    if (!header) return [];
    const anchors = names.map(name => header.items.find(i => clean(i.text) === name));
    const columns = anchors.map((item, index) => ({ name: names[index], left: index ? item.x - 12 : -Infinity,
      right: index + 1 < anchors.length ? anchors[index + 1].x - 12 : Infinity }));
    const end = rows.find(row => row.y < header.y && /<<|＜＜/.test(row.text));
    return rows.filter(row => row.y < header.y - 3 && (!end || row.y > end.y) && row.y > 25)
      .filter(row => !/取引残高報告書|GMOクリック証券|ページ|^\d+\s*\/\s*\d+$/.test(row.text))
      .map(row => ({ section, values: Object.fromEntries(columns.map(col => [col.name,
        row.items.filter(i => i.x >= col.left && i.x < col.right).map(i => i.text).join('').trim()])) }));
  }
  const balanceNames = ['通貨', '前月末現金残高', '振替入出金合計', '取引損益合計', 'スワップ合計', '手数料合計', '当月現金残高'];
  const assetNames = ['通貨', '時価評価総額', '締後振替額', '建玉評価損益', '建玉必要証拠金額'];
  const ledgerNames = ['入出金日付', '通貨', '内訳', '金額', '両替レート', '摘要'];
  const isJpy = value => ['日本円', 'JPY'].includes(clean(value));
  function parse(document) {
    const errors = [], warnings = [];
    const error = message => { if (!errors.includes(message)) errors.push(message); };
    const base = { broker: 'gmo', importerVersion: version, targetMonth: null, snapshotAsOf: null,
      observationType: 'officialMonthEnd', valuationCurrency: 'JPY', values: {}, errors, warnings, valid: false };
    if (!detect(document)) { error('GMO FXneoの月次取引残高報告書を確認できませんでした'); return base; }
    const monthCandidates = new Set(document.pages.flatMap(p => p.items).map(i => clean(i.text))
      .filter(text => /^\d{4}\/\d{2}$/.test(text)).map(text => text.replace('/', '-')));
    if (monthCandidates.size !== 1) error('対象月を確認できませんでした');
    else {
      base.targetMonth = [...monthCandidates][0];
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(base.targetMonth)) error('対象月を確認できませんでした');
      else base.snapshotAsOf = new Date(Date.UTC(Number(base.targetMonth.slice(0, 4)), Number(base.targetMonth.slice(5)), 0)).toISOString().slice(0, 10);
    }
    const balances = document.pages.flatMap(p => table(p, balanceNames, '前月末現金残高', 'balance'));
    const assets = document.pages.flatMap(p => table(p, assetNames, '時価評価総額', 'asset'));
    const balance = balances.filter(row => isJpy(row.values['通貨'])), asset = assets.filter(row => isJpy(row.values['通貨']));
    if (balance.length !== 1 || asset.length !== 1) error('円建ての残高・証拠金情報を確認できませんでした');
    for (const row of [...balances, ...assets]) {
      if (!isJpy(row.values['通貨']) && ['USD', '米ドル', '米国ドル'].includes(clean(row.values['通貨']))) {
        if (Object.entries(row.values).some(([name, value]) => name !== '通貨'
          && !(row.section === 'asset' && value === '-') && !zero(decimal(value)))) error('外貨残高の円換算を確認できません');
      } else if (!isJpy(row.values['通貨'])) {
        error('残高の通貨を確認できません');
      }
    }
    const mappings = { realizedPnl: '取引損益合計', swapPnl: 'スワップ合計', cashBalance: '当月現金残高',
      netAssetValue: '時価評価総額', unrealizedPnl: '建玉評価損益', requiredMargin: '建玉必要証拠金額' };
    for (const [name, column] of Object.entries(mappings)) {
      const row = ['realizedPnl', 'swapPnl', 'cashBalance'].includes(name) ? balance[0] : asset[0];
      base.values[name] = decimal(row?.values[column]);
      if (base.values[name] === null) error('月次の必須金額を確認できませんでした');
    }
    const fee = decimal(balance[0]?.values['手数料合計']), afterClose = decimal(asset[0]?.values['締後振替額']);
    if (!zero(fee)) error('手数料の扱いを確認する必要があります');
    if (!zero(afterClose)) error('締後の資金移動を確認する必要があります');
    const ledger = document.pages.flatMap(p => table(p, ledgerNames, '入出金日付', 'ledger'));
    const totals = { realizedPnl: [], swapPnl: [], deposit: [], withdrawal: [] };
    const byKind = new Map(), subtotals = new Map(); let entries = 0, subtotalStarted = false;
    for (const row of ledger) {
      const v = row.values, kind = clean(v['内訳']), currency = clean(v['通貨']);
      if (!kind && !currency) continue;
      const amount = decimal(v['金額']);
      if (amount === null || !isJpy(currency)) { error('入出金明細の金額・通貨を確認できません'); continue; }
      const day = clean(v['入出金日付']);
      if (!day && !v['両替レート'] && /^(?:取引損益|スワップ損益)\([A-Z]{3}\/[A-Z]{3}\)$/.test(kind)) {
        // Report's terminal per-type totals omit both date and exchange rate. Verify, never add twice.
        subtotalStarted = true;
        if (subtotals.has(kind)) error('入出金の区分別合計が重複しています');
        subtotals.set(kind, amount); continue;
      }
      if (subtotalStarted) error('入出金明細の構造を確認できません');
      const date = /^(\d{2})\/(\d{2})\/(\d{2})$/.exec(day);
      if (!date || !base.targetMonth || date[1] !== base.targetMonth.slice(2, 4) || date[2] !== base.targetMonth.slice(5)
        || Number(date[3]) < 1 || Number(date[3]) > Number(base.snapshotAsOf?.slice(8))) error('入出金明細の日付を確認できません');
      byKind.set(kind, [...(byKind.get(kind) || []), amount]);
      entries++;
      if (/^取引損益\([A-Z]{3}\/[A-Z]{3}\)$/.test(kind)) totals.realizedPnl.push(amount);
      else if (/^スワップ損益\([A-Z]{3}\/[A-Z]{3}\)$/.test(kind)) totals.swapPnl.push(amount);
      else if (kind === '入金' && !amount.startsWith('-')) totals.deposit.push(amount);
      else if (kind === '出金' && amount.startsWith('-')) totals.withdrawal.push(negative(amount));
      else if (kind === '手数料' && zero(amount)) continue;
      else error('対応していない入出金区分があります');
    }
    const ledgerSections = document.pages.filter(p => p.items.some(i => clean(i.text) === '<<入出金明細>>'));
    // Zero movement is established by complete, classified ledger rows, not by netting transfers.
    if (!ledgerSections.length || !entries) error('入出金明細の全件確認が必要です');
    for (const [kind, amount] of subtotals) if (!equal(amount, csv.sum(byKind.get(kind) || []))) error('入出金の区分別合計が一致しません');
    for (const name of ['realizedPnl', 'swapPnl']) {
      if (!equal(base.values[name], totals[name].length ? csv.sum(totals[name]) : '0')) error('月間合計と入出金明細が一致しません');
    }
    base.values.deposit = totals.deposit.length ? csv.sum(totals.deposit) : '0';
    base.values.withdrawal = totals.withdrawal.length ? csv.sum(totals.withdrawal) : '0';
    if (!equal(decimal(balance[0]?.values['振替入出金合計']), csv.sum([base.values.deposit, negative(base.values.withdrawal)]))) error('資金移動の合計が一致しません');
    const cashStart = decimal(balance[0]?.values['前月末現金残高']);
    if (cashStart !== null && Object.values(base.values).every(value => value !== null)) {
      if (!equal(base.values.cashBalance, csv.sum([cashStart, base.values.realizedPnl, base.values.swapPnl, base.values.deposit, negative(base.values.withdrawal)]))) error('現金残高の照合が一致しません');
      if (!equal(base.values.netAssetValue, csv.sum([base.values.cashBalance, base.values.unrealizedPnl]))) error('純資産の照合が一致しません');
    } else error('前月末残高を確認できませんでした');
    const margin = document.pages.flatMap(p => table(p, ['通貨ペア', '売建玉数', '買建玉数', '売必要証拠金額', '買必要証拠金額', '適用必要証拠金額'], '適用必要証拠金額', 'margin'))
      .filter(row => /^[A-Z]{3}\/[A-Z]{3}$/.test(clean(row.values['通貨ペア'])));
    if (margin.length && !equal(base.values.requiredMargin, csv.sum(margin.map(row => decimal(row.values['適用必要証拠金額']))))) error('必要証拠金の明細合計が一致しません');
    base.valid = errors.length === 0;
    const trades=typeof module!=='undefined'&&module.exports?require('./gmo-transactions-parser.js'):root.TradeScopeGmoTransactions;
    if(!trades)throw new Error('GMO_TRANSACTION_ENGINE_UNAVAILABLE');
    base.tradeDetails=trades.parse(document,base.targetMonth,base.values.realizedPnl,{lines,clean,decimal,equal});
    return base; // Only allowlisted monthly facts and execution facts; no PII, source text or filename.
  }
  const api = { version, detect, parse, decimal, equal };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TradeScopeGMOParser = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
