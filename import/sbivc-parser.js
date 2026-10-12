(function (root) {
  'use strict';
  const csv = typeof module !== 'undefined' && module.exports ? require('./csv-core.js') : root.TradeScopeCSV;
  const version = 'sbivc-monthly-preview-v1';
  const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
  const compact = value => clean(value).replace(/\s/g, '');
  const sectionNames = Object.freeze({ '口座残高（現物）': 'spot', '口座残高（レバレッジ）': 'leverage',
    '建玉残高': 'positions', '取引明細': 'trades', '入出金明細': 'cashflows', '貸出中一覧': 'lending' });
  const leverageFields = Object.freeze({ '預託証拠金残高': 'cashBalance', '約定評価損益': 'executionEvaluationPnl',
    '建玉評価損益': 'positionEvaluationPnl', 'ファンディングレート（円）': 'fundingObservation',
    '指値スプレッド評価損': 'spreadLoss', '純資産額（円）': 'netAssetObservation', '注文必要証拠金': 'orderMargin',
    'ポジション必要証拠金': 'positionMargin', '証拠金維持率': 'maintenanceRate', '出金・出庫予定額': 'pendingWithdrawal',
    '出金・出庫手数料拘束額': 'reservedWithdrawalFee', '貸出予定額': 'pendingLending', '取引手数料拘束額': 'reservedTradeFee' });
  // Field names only: actual trade/position/lending rows require a real source validation later.
  const tableFields = Object.freeze({ trades: ['取引番号', '約定日時', '銘柄', '取引区分', '売買', '数量', '約定レート', '取引手数料', '決済損益'],
    positions: ['取引番号', '約定日時', '銘柄', '売買', '数量', '建玉評価損益', '評価レート', '約定レート', 'ポジション', 'ファンディング'],
    lending: ['約定年月日', '貸出資産', '交換資産', '貸出数量', '年率', '受渡年月日'] });
  function rows(page) {
    const result = [];
    for (const item of page.items || []) {
      if (!clean(item.text) || !Number.isFinite(item.x) || !Number.isFinite(item.y)) continue;
      let row = result.find(r => Math.abs(r.y - item.y) < 2);
      if (!row) result.push(row = { y: item.y, items: [], page: page.number });
      row.items.push(item);
    }
    return result.sort((a, b) => b.y - a.y).map(row => {
      row.items.sort((a, b) => a.x - b.x);
      return { ...row, text: clean(row.items.map(i => i.text).join(' ')) };
    });
  }
  function detect(extracted) {
    const text = compact((extracted?.pages || []).flatMap(p => rows(p).map(r => r.text)).join('\n'));
    return text.includes('SBIVCトレード') && text.includes('取引報告書兼取引残高報告書兼証拠金受領通知書（月次）')
      && text.includes('暗号資産の取引') && text.includes('口座残高（現物）');
  }
  function number(value) {
    const text = clean(value).replace(/^[￥¥]/, '').replace(/(?:円|％|%)$/, '').trim();
    if (!text || text === '--' || text === '—') return null;
    try { return csv.decimal(text); } catch (_) { return null; }
  }
  const unavailable = value => ['', '-', '--', '—'].includes(clean(value));
  function day(value) { try { return csv.date(value); } catch (_) { return null; } }
  function instrument(asset) {
    // Exact explicit ticker only. No truncation, aliases, price lookup, or 3-letter currency coercion.
    if (!/^[A-Z][A-Z0-9]{1,19}$/.test(asset) || asset === 'JPY') return null;
    return { assetType: 'Crypto', symbol: `${asset}/JPY`, displayName: asset, quoteCurrency: 'JPY', baseAsset: asset };
  }
  function parse(extracted) {
    const errors = [], warnings = [];
    const issue = (list, code) => { if (!list.includes(code)) list.push(code); };
    const error = code => issue(errors, code), warning = code => issue(warnings, code);
    const report = { provider: 'sbivc', reportType: 'monthly', periodStart: null, periodEnd: null, targetMonth: null, snapshotAsOf: null };
    const accountObservations = { jpyCash: null, assetTotalObservation: null, valuationCurrency: 'JPY' };
    const spotHoldings = [], leverageSummary = {}, cashflows = [], rewards = [];
    const sections = Object.fromEntries(['spot', 'leverage', 'positions', 'trades', 'cashflows', 'lending'].map(k => [k, { status: 'missing', sourcePages: [], headerFields: [] }]));
    const result = () => ({ valid: errors.length === 0, version, report, accountObservations, spotHoldings, leverageSummary,
      leveragePositions: [], transactions: [], cashflows, rewards, lending: [], sections, errors, warnings });
    if (!detect(extracted)) { error('SBIVC_DOCUMENT_NOT_RECOGNIZED'); return result(); }
    const pages = extracted.pages.map(p => ({ number: p.number, rows: rows(p) }));
    let section = null, spotHeader = null, cashHeader = null, lastFlow = null;
    let totalSeen = false, cashSeen = false, spotSubtotal = null;
    const zero = value => /^-?0(?:\.0+)?$/.test(value);
    const setDate = (field, value) => {
      if (!value || report[field] && report[field] !== value) error('SBIVC_PERIOD_INVALID');
      else report[field] = value;
    };
    for (const page of pages) {
      for (const row of page.rows) {
        const text = compact(row.text);
        // A physical page footer is not a balance/event row (sections can continue across pages).
        if (/^\d+\/\d+$/.test(text) || row.y < 40 && /^\d+$/.test(text)) continue;
        if (text.startsWith('作成基準日：')) setDate('snapshotAsOf', day(text.slice('作成基準日：'.length)));
        if (text.startsWith('対象期間：')) {
          const m = /^対象期間：(\d{4}\/\d{1,2}\/\d{1,2})[～〜](\d{4}\/\d{1,2}\/\d{1,2})$/.exec(text);
          if (!m) error('SBIVC_PERIOD_INVALID'); else { setDate('periodStart', day(m[1])); setDate('periodEnd', day(m[2])); }
        }
        const totalLabel = row.items.find(i => compact(i.text) === '総資産円換算額');
        if (totalLabel) {
          const nearby = page.rows.filter(r => Math.abs(r.y - row.y) < 7).flatMap(r => r.items)
            .filter(i => i.x > totalLabel.x + (totalLabel.width || 70) + 10 && number(i.text) !== null);
          if (nearby.length !== 1 || totalSeen) error('SBIVC_ACCOUNT_TOTAL_INVALID');
          else { accountObservations.assetTotalObservation = number(nearby[0].text); accountObservations.sourcePage = page.number; totalSeen = true; }
        }
        if (text.startsWith('■')) {
          section = Object.hasOwn(sectionNames, text.slice(1)) ? sectionNames[text.slice(1)] : null; lastFlow = null;
          if (section && sections[section].status === 'missing') sections[section].status = 'present';
          continue;
        }
        if (!section) continue;
        const state = sections[section];
        if (!state.sourcePages.includes(page.number)) state.sourcePages.push(page.number);
        if (text.startsWith('該当する') && text.endsWith('がございません')) {
          if (state.status === 'unverified') error('SBIVC_TABLE_INVALID');
          state.status = 'empty'; continue;
        }
        if (section === 'spot') {
          if (compact(row.items[0].text) === '合計') {
            const values = row.items.slice(1).map(i => number(i.text)).filter(v => v !== null);
            if (values.length !== 1 || spotSubtotal !== null) error('SBIVC_SPOT_TOTAL_INVALID'); else spotSubtotal = values[0];
            continue;
          }
          if (text.includes('日本円換算額') && text.includes('評価レート') && text.includes('残高')) {
            const rate = row.items.find(i => compact(i.text) === '評価レート'), value = row.items.find(i => compact(i.text).startsWith('日本円換算額'));
            spotHeader = rate && value && rate.x < value.x ? { rate: rate.x - 10, value: value.x - 10 } : null;
            if (!spotHeader) error('SBIVC_SPOT_HEADER_INVALID');
            state.headerFields = ['asset', 'quantity', 'valuationRate', 'officialJPYValue']; continue;
          }
          const assetItem = row.items[0], asset = compact(assetItem.text);
          if (!/^[A-Z][A-Z0-9]{1,19}$/.test(asset)) {
            if (row.items.some(i => number(i.text) !== null)) error('SBIVC_SPOT_ROW_INVALID');
            continue;
          }
          if (!spotHeader) { error('SBIVC_SPOT_HEADER_INVALID'); continue; }
          const cell = (a, b) => clean(row.items.filter(i => i !== assetItem && i.x >= a && i.x < b).map(i => i.text).join(''));
          const quantity = number(cell(assetItem.x + 1, spotHeader.rate));
          const valuationRate = number(cell(spotHeader.rate, spotHeader.value));
          const marketValue = number(cell(spotHeader.value, Infinity));
          if (quantity === null || marketValue === null || quantity.startsWith('-') || marketValue.startsWith('-')) error('SBIVC_SPOT_ROW_INVALID');
          const rawRate = cell(spotHeader.rate, spotHeader.value);
          if (!unavailable(rawRate) && valuationRate === null) error('SBIVC_SPOT_ROW_INVALID');
          if (asset === 'JPY') {
            if (cashSeen) error('SBIVC_CASH_AMBIGUOUS');
            cashSeen = true; accountObservations.jpyCash = quantity; accountObservations.cashSourcePage = page.number;
            if (quantity !== null && marketValue !== null && !zero(csv.sum([quantity, '-' + marketValue]))) error('SBIVC_CASH_MISMATCH');
          } else {
            if (spotHoldings.some(h => h.asset === asset)) error('SBIVC_SPOT_AMBIGUOUS');
            spotHoldings.push({ asset, symbol: `${asset}/JPY`, quantity, valuationRate,
              valuationRateStatus: valuationRate !== null ? 'explicit' : clean(rawRate) ? 'notApplicable' : 'missing', valuationCurrency: 'JPY',
              officialJPYValue: marketValue, sourcePage: page.number, instrumentCandidate: instrument(asset) });
          }
        } else if (section === 'leverage') {
          for (const [label, field] of Object.entries(leverageFields)) {
            const anchor = row.items.find(i => compact(i.text) === label || compact(i.text).startsWith(label + '…'));
            if (!anchor) continue;
            const nearby = page.rows.filter(r => Math.abs(r.y - row.y) < 7).flatMap(r => r.items)
              .filter(i => i.x > anchor.x + (anchor.width || label.length * 6) + 10);
            const values = nearby.filter(i => number(i.text) !== null || ['-', '--', '—'].includes(clean(i.text)));
            if (values.length !== 1 || Object.hasOwn(leverageSummary, field)) error('SBIVC_LEVERAGE_VALUE_INVALID');
            else leverageSummary[field] = number(values[0].text);
          }
        } else if (section === 'cashflows') {
          if (text.includes('入出金の種別') && text.includes('入出金額（円）')) {
            const names = ['日時', '入出金の種別', '暗号資産/通貨', '数量', '評価レート', '入出金額（円）'];
            const anchors = names.map(n => row.items.find(i => compact(i.text) === n)?.x);
            cashHeader = anchors.every(x => x !== undefined) ? anchors : null;
            if (!cashHeader) error('SBIVC_CASHFLOW_HEADER_INVALID');
            state.headerFields = ['recordedAt', 'sourceType', 'asset', 'quantity', 'valuationRate', 'reportedJPYAmount']; continue;
          }
          if (text.startsWith('※')) continue;
          if (text.startsWith('備考：')) {
            // Parse only explicitly named reward type/month; never return arbitrary remarks or PII.
            if (lastFlow && /ステーキング報酬/.test(text)) {
              const m = /（(\d{4})年(\d{1,2})月分）/.exec(text);
              const targetMonth = m && +m[2] >= 1 && +m[2] <= 12 ? `${m[1]}-${m[2].padStart(2, '0')}` : null;
              lastFlow.kind = 'stakingReward';
              rewards.push({ rewardType: 'staking', asset: lastFlow.asset, quantity: lastFlow.quantity,
                recordedAt: lastFlow.recordedAt, targetMonth, sourcePage: lastFlow.sourcePage });
            }
            continue;
          }
          if (!/^\d{4}\//.test(text)) { if (row.items.some(i => number(i.text) !== null)) error('SBIVC_CASHFLOW_ROW_INVALID'); continue; }
          if (!cashHeader) { error('SBIVC_CASHFLOW_HEADER_INVALID'); continue; }
          // Numeric/date cells are right/left aligned inside the report's columns; boundaries derive from its header.
          const bounds = [0, cashHeader[1] - 45, cashHeader[2] - 20, cashHeader[3] - 30, cashHeader[4] - 15, cashHeader[5] - 10, Infinity];
          const cells = bounds.slice(0, -1).map((a, n) => clean(row.items.filter(i => i.x >= a && i.x < bounds[n + 1]).map(i => i.text).join('')));
          let recordedAt = null;
          try { recordedAt = csv.observation(cells[0]); } catch (_) { error('SBIVC_CASHFLOW_ROW_INVALID'); }
          const asset = cells[2];
          if (!/^[A-Z][A-Z0-9]{1,19}$/.test(asset)) { error('SBIVC_CASHFLOW_ROW_INVALID'); lastFlow = null; continue; }
          const knownTypes = ['入金', '出金', '入庫', '出庫', 'ステーキング', '現物買', '現物売', 'その他'];
          const sourceType = knownTypes.includes(compact(cells[1])) ? compact(cells[1]) : null;
          const kind = sourceType === 'ステーキング' ? 'stakingReward' : ['入金', '入庫'].includes(sourceType) ? asset === 'JPY' ? 'jpyDeposit' : 'cryptoInbound'
            : ['出金', '出庫'].includes(sourceType) ? asset === 'JPY' ? 'jpyWithdrawal' : 'cryptoOutbound' : 'other';
          lastFlow = { recordedAt, sourceType, kind, asset, quantity: number(cells[3]), valuationRate: number(cells[4]),
            reportedJPYAmount: number(cells[5]), sourcePage: page.number };
          if (lastFlow.quantity === null || !recordedAt) error('SBIVC_CASHFLOW_ROW_INVALID');
          for (const n of [4, 5]) if (!unavailable(cells[n]) && number(cells[n]) === null) error('SBIVC_CASHFLOW_ROW_INVALID');
          if (!sourceType) warning('SBIVC_CASHFLOW_TYPE_UNVERIFIED');
          cashflows.push(lastFlow);
        } else if (tableFields[section]) {
          for (const field of tableFields[section]) if (text.includes(field) && !state.headerFields.includes(field)) state.headerFields.push(field);
          // Explicit data rows are not silently discarded or presented as verified transactions.
          if (/^\d{4}\//.test(text) || /^\d{5,}/.test(text)) state.status = 'unverified';
        }
      }
    }
    if (report.periodStart && report.periodEnd && report.snapshotAsOf) {
      const month = report.periodStart.slice(0, 7), end = new Date(Date.UTC(+month.slice(0, 4), +month.slice(5), 0)).toISOString().slice(0, 10);
      if (report.periodStart !== month + '-01' || report.periodEnd !== end || report.snapshotAsOf !== end) error('SBIVC_PERIOD_INVALID');
      else report.targetMonth = month;
    } else error('SBIVC_PERIOD_INVALID');
    if (!cashSeen || !totalSeen || !spotHeader) error('SBIVC_REQUIRED_VALUE_MISSING');
    if (spotSubtotal !== null) {
      accountObservations.spotSubtotalObservation = spotSubtotal;
      const values = [accountObservations.jpyCash, ...spotHoldings.map(h => h.officialJPYValue)];
      if (values.some(v => v === null) || !zero(csv.sum([...values, '-' + spotSubtotal]))) error('SBIVC_SPOT_TOTAL_MISMATCH');
    }
    for (const key of ['trades', 'positions', 'lending']) {
      if (sections[key].status === 'present') sections[key].status = 'unverified';
      if (sections[key].status === 'unverified') warning('SBIVC_' + key.toUpperCase() + '_ROWS_UNVERIFIED');
    }
    return result();
  }
  const api = Object.freeze({ version, detect, parse, instrument, tableFields });
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TradeScopeSBIVCParser = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
