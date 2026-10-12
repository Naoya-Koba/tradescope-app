(function (root) {
  'use strict';
  // Presentation only. Never changes source quantity, dedupe units or financial ledgers.
  // Official rules checked 2026-10-12:
  // https://www.click-sec.com/corp/guide/fxneo/rule/
  // https://lightfx.jp/service/outline/
  // https://min-fx.jp/lineup/fx/service/outline/
  const rules = Object.freeze({
    gmo: { pairs: 'USD/JPY EUR/JPY GBP/JPY AUD/JPY NZD/JPY CAD/JPY CHF/JPY TRY/JPY CZK/JPY PLN/JPY HUF/JPY ZAR/JPY MXN/JPY EUR/USD GBP/USD AUD/USD NZD/USD EUR/GBP EUR/AUD GBP/AUD AUD/NZD EUR/CHF GBP/CHF USD/CHF'.split(' '), large: ['HUF/JPY', 'ZAR/JPY', 'MXN/JPY'] },
    lightfx: { large: ['RUB/JPY', 'HUF/JPY', 'HUF/JPY LIGHT'] },
    minna: { large: ['RUB/JPY', 'HUF/JPY', 'HUF/JPY LIGHT'] }
  });
  const tradersPairs = 'USD/JPY EUR/JPY GBP/JPY AUD/JPY NZD/JPY CHF/JPY CAD/JPY ZAR/JPY TRY/JPY MXN/JPY RUB/JPY CNH/JPY HKD/JPY SGD/JPY PLN/JPY CZK/JPY HUF/JPY NOK/JPY SEK/JPY EUR/USD GBP/USD AUD/USD NZD/USD EUR/GBP EUR/AUD GBP/AUD AUD/NZD USD/CHF EUR/CHF GBP/CHF USD/CAD AUD/CAD CHF/ZAR CHF/TRY CHF/MXN USD/CNH EUR/PLN NOK/SEK'.split(' ');
  const lightPairs = 'USD/JPY EUR/JPY GBP/JPY AUD/JPY NZD/JPY ZAR/JPY TRY/JPY MXN/JPY CZK/JPY HUF/JPY EUR/USD GBP/USD'.split(' ').map(p => p + ' LIGHT');
  const providers = { acc_gmo_fx: 'gmo', acc_lightfx_fx: 'lightfx', acc_minna_fx: 'minna' };
  function pair(value) {
    const m = /^([A-Za-z]{3})[-/]?([A-Za-z]{3})( LIGHT)?$/.exec(String(value || '').trim());
    return m ? `${m[1].toUpperCase()}/${m[2].toUpperCase()}${m[3] || ''}` : null;
  }
  function getFxLotSize({ provider, accountId, instrument }) {
    const expected = providers[accountId];
    if (expected && provider && provider !== expected) return null;
    const rule = rules[provider || expected], symbol = pair(typeof instrument === 'string' ? instrument : instrument?.symbol);
    if (!rule || !symbol) return null;
    const supported = rule.pairs || [...tradersPairs, ...lightPairs];
    return supported.includes(symbol) ? rule.large.includes(symbol) ? 100000 : 10000 : null;
  }
  function decimal(value) {
    if (value == null || value === '' || !/^-?\d+(?:\.\d+)?$/.test(String(value))) return null;
    return String(value).replace(/^(-?)0+(?=\d)/, '$1').replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '').replace(/^-0$/, '0');
  }
  const number = value => {
    const d = decimal(value); if (d === null) return '—';
    const [integer, fraction] = d.split('.');
    return integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fraction ? '.' + fraction : '');
  };
  function scaled(integer, scale) {
    const sign = integer < 0n ? '-' : '', digits = String(integer < 0n ? -integer : integer).padStart(scale + 1, '0');
    return decimal(sign + (scale ? digits.slice(0, -scale) + '.' + digits.slice(-scale) : digits));
  }
  function parts(value) { const d = decimal(value); if (d === null) return null; const [a, b = ''] = d.split('.'); return { n: BigInt(a + b), scale: b.length }; }
  function multiply(a, b) { const x = parts(a), y = parts(b); return x && y ? scaled(x.n * y.n, x.scale + y.scale) : null; }
  function divideUnits(value, size) { const p = parts(value); return p ? scaled(p.n, p.scale + (size === 100000 ? 5 : 4)) : null; }
  function amount(value, currency, preservePrecision = false) {
    if (decimal(value) === null) return null;
    const [integer, fraction] = String(value).split('.');
    const text = preservePrecision ? integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fraction === undefined ? '' : '.' + fraction) : number(value);
    return text + (currency === 'JPY' ? '円' : currency ? ' ' + currency : '');
  }
  function createContext(manual, models) {
    const records = key => models?.[key]?.records || [];
    return { manual: new Map((manual || []).map(r => [r.id, r])), raw: new Map(records('rawTransactions').map(r => [r.id, r])),
      imported: new Map(records('importedTransactions').map(r => [r.id, r])), instruments: new Map(records('instruments').map(r => [r.id, r])), batches: new Map(records('importBatches').map(r => [r.id, r])) };
  }
  function facts(record, context) {
    const source = record.sources.find(s => s.kind !== 'manual') || record.sources[0];
    const original = context?.[source?.kind === 'sbi' ? 'raw' : ['gmo','sbivc'].includes(source?.kind) ? 'imported' : 'manual']?.get(source?.id) || {};
    const raw = original.rawFields || {}, master = context?.instruments.get(record.instrumentId), batch = context?.batches.get(original.importBatchId);
    const domestic = original.sourceProvider === 'sbi' && original.sourceType === 'csv'
      && (batch?.importerId === 'sbi-domestic-csv' || ['国内株式', '国内ETF'].includes(raw.product) || /^(東証|名証|福証|札証)(?:PR|ST|GR|P|S|G)?$/.test(raw.market || ''));
    return { original, raw, master, domestic, currency: original.currency || record.currency || (domestic ? 'JPY' : null) };
  }
  function fx(record, fact) {
    const unit = fact.original.quantityUnit || record.quantityUnit, size = getFxLotSize({ provider: record.sourceProvider, accountId: record.accountId, instrument: record.symbol });
    const q = decimal(record.quantity); let lots = null, units = null;
    if (['Lot', 'lot', 'lots'].includes(unit)) {
      lots = q;
      const sourceSize = decimal(fact.original.contractSize);
      if (size && (sourceSize === null || sourceSize === String(size))) units = multiply(q, String(size));
    }
    else if (['通貨', 'currencyUnits', 'baseCurrencyUnits'].includes(unit)
      || unit === 'gmo-reported-count' && record.accountId === 'acc_gmo_fx' && record.sourceProvider === 'gmo'
        && fact.original.accountId === 'acc_gmo_fx' && fact.original.sourceProvider === 'gmo' && fact.original.sourceType === 'pdf' && fact.original.sourceScope === 'gmo-fx-trades') {
      // GMO PDF 約定数 is currency quantity: user confirmed on 2026-10-12 using
      // 約定数 × 約定単価 = 約定金額. Presentation only; source/dedupe units stay intact.
      units = q; if (size) lots = divideUnits(q, size);
    }
    const quantity = q === null ? null : lots !== null ? number(lots) + 'Lot' : number(q) + (units !== null ? '通貨' : unit === 'gmo-reported-count' ? ' 約定数' : unit ? ' ' + unit : '');
    const quote = fact.master?.quoteCurrency || pair(record.symbol)?.split('/')[1].split(' ')[0];
    return { quantity, lots, units, price: amount(fact.original.price ?? record.price, quote, true), amount: null };
  }
  function present(record, context) {
    const fact = facts(record, context), { raw, original, currency } = fact;
    const quantity = decimal(record.quantity), price = decimal(record.price);
    const shareQuantity = ['shares', '株'].includes(record.quantityUnit) || record.quantityUnit == null && fact.domestic && ['Stock', 'ETF'].includes(record.assetType);
    const unit = shareQuantity ? '株' : record.quantityUnit==='baseAssetUnits'? ' '+record.symbol.split('/')[0] : ({ fundUnits: '口' })[record.quantityUnit] || record.quantityUnit || '';
    let info = { quantity: quantity === null ? null : number(quantity) + unit, price: amount(price, currency), amount: null, amountLabel: '約定金額', lots: null, units: null };
    if (record.assetType === 'FX') info = { ...info, ...fx(record, fact) };
    else {
      // An explicit mixed settlement/P&L column is never labelled execution amount or realized P/L.
      const explicit = decimal(original.executionAmount ?? raw.executionAmount);
      const settlement = decimal(raw.settlementAmount);
      const mixed = decimal(raw.settlementOrPnl);
      if (explicit !== null) info.amount = amount(explicit, currency);
      else if (settlement !== null) { info.amount = amount(settlement, currency); info.amountLabel = '受渡金額'; }
      else if (mixed !== null && ['現物買', '現物売', '投信金額買付'].includes(original.transactionType)) { info.amount = amount(mixed, currency); info.amountLabel = '受渡金額 / 決済損益'; }
      else if (['Stock', 'ETF', '証券'].includes(record.assetType) && fact.domestic && currency === 'JPY' && shareQuantity && quantity !== null && price !== null) info.amount = '約' + amount(multiply(quantity, price), 'JPY');
    }
    const pnl = record.type === 'close' ? amount(record.realizedPnl, record.currency) : null;
    const signedPnl = pnl !== null && !pnl.startsWith('-') && decimal(record.realizedPnl) !== '0' ? '+' + pnl : pnl;
    const hasTime = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(record.executedAt || '');
    const fullDate = (hasTime ? record.executedAt : record.date).replace('T', ' '), shortDate = record.date.slice(5).replace('-', '/') + (hasTime ? ' ' + record.executedAt.slice(11, 16) : '');
    const priceLabel = record.assetType === 'FX'||record.marketType==='spot' ? '約定レート' : record.assetType === 'MutualFund' ? '基準価額' : '約定価格';
    if(record.marketType==='spot')info.price=amount(original.price??record.price,currency,true);
    const receiptFee=original.feeSemantics==='receipt-positive-payment-negative';
    const feeText=amount(original.fee,original.feeCurrency,receiptFee),fee=receiptFee&&feeText!==null&&!feeText.startsWith('-')&&decimal(original.fee)!=='0'?'+'+feeText:feeText;
    return { ...info, fee, feeLabel:receiptFee?'手数料（受取＋／支払−）':'手数料',shortDate, fullDate, dateLabel: hasTime ? '日時' : '日付', priceLabel, settlementObservation: amount(raw.settlementOrPnl, currency), pnl: signedPnl, pnlSign: decimal(record.realizedPnl)?.startsWith('-') ? 'negative' : decimal(record.realizedPnl) === '0' ? 'neutral' : 'positive',
      summary: [info.amount || info.quantity, info.amount || !info.price ? null : record.assetType === 'FX' ? priceLabel + ' ' + info.price : info.price].filter(Boolean).join('　'), facts: fact };
  }
  const api = Object.freeze({ getFxLotSize, number, multiply, createContext, present });
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TradeScopeTransactionDisplay = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
