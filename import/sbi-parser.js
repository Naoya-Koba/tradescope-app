(function (root) {
  'use strict';
  const csv = typeof module !== 'undefined' && module.exports ? require('./csv-core.js') : root.TradeScopeCSV;
  // Explicit header vocabulary, not fuzzy matching. Real download variants still require verification.
  const common = {
    product: ['商品区分'], name: ['銘柄名', '銘柄名称', '銘柄', 'ファンド名', '銘柄（コード）'],
    code: ['銘柄コード', 'コード'], custody: ['預り区分', '預り'],
    quantity: ['保有数量', '保有株数', '数量', '保有口数', '約定数量']
  };
  const headers = {
    holdings: { ...common, acquisitionPrice: ['取得単価', '取得単価（円）'],
      marketPrice: ['現在値', '現在値（円）', '基準価額'], acquisitionAmount: ['取得金額'],
      valuation: ['評価額', '時価評価額', '評価額（円）'], unrealizedPnl: ['評価損益', '評価損益（円）'],
      sellOrderQuantity: ['売却注文中'], distributionMethod: ['分配金受取方法'] },
    transactions: { ...common, executedAt: ['約定日'], market: ['市場'], orderType: ['注文種別'],
      transactionType: ['取引区分', '取引'], price: ['約定単価', '単価'], settlementDate: ['受渡日'],
      settlementOrPnl: ['受渡金額 / 決済損益', '受渡金額/決済損益', '受渡金額／決済損益'],
      settlementAmount: ['受渡金額'], reportedRealizedPnl: ['決済損益'], fee: ['手数料', '手数料/諸経費等'],
      tax: ['税額'], maturity: ['期限'], taxation: ['課税'] }
  };
  const required = {
    holdings: ['name', 'quantity', 'valuation'],
    transactions: ['executedAt', 'name', 'transactionType', 'quantity', 'price']
  };
  const numeric = new Set(['quantity', 'acquisitionPrice', 'marketPrice', 'acquisitionAmount', 'valuation',
    'unrealizedPnl', 'price', 'settlementOrPnl', 'settlementAmount', 'reportedRealizedPnl', 'fee', 'tax', 'sellOrderQuantity']);
  const dates = new Set(['executedAt', 'settlementDate']);
  const knownProducts = new Set(['国内株式', '株式', '株式（現物）', '投資信託', 'ETF', '国内ETF']);
  function issue(severity, code, message, rowNumber = null) { return { severity, code, message, rowNumber }; }
  function mapping(cells, kind) {
    const result = {};
    const duplicate = [];
    cells.forEach((cell, index) => {
      const field = Object.keys(headers[kind]).find(key => headers[kind][key].includes(cell));
      if (field) {
        if (Object.hasOwn(result, field)) duplicate.push(field);
        else result[field] = index;
      }
    });
    return { fields: result, duplicate };
  }
  function section(cells) {
    if (cells.filter(cell => cell !== '').length !== 1) return null;
    const match = /^(株式|投資信託)（(.+)）(合計)?$/.exec(cells[0]);
    if (!match) return null;
    const [product, inner] = [match[1], match[2]];
    const slash = inner.indexOf('/');
    const mode = slash >= 0 ? inner.slice(0, slash) : null;
    const custody = slash >= 0 ? inner.slice(slash + 1) : inner;
    const supported = ['特定預り', '一般預り', 'NISA預り', '旧NISA預り', 'つみたてNISA預り',
      'NISA預り（成長投資枠）', 'NISA預り（つみたて投資枠）'].includes(custody)
      && (mode === null || (product === '株式' ? mode === '現物' : ['金額', '口数'].includes(mode)));
    return { product, custody, mode, total: Boolean(match[3]), supported,
      key: JSON.stringify([product, custody, mode]) };
  }
  function detectKind(text) {
    // Use the same exact header vocabulary as parsing, never a file name or fuzzy guess.
    let records;
    try { records = csv.parseCSV(text); } catch (_) { return null; }
    const kinds = new Set();
    for (const { cells } of records) {
      for (const kind of Object.keys(required)) {
        const match = mapping(cells, kind);
        if (!match.duplicate.length && required[kind].every(field => Object.hasOwn(match.fields, field))) {
          kinds.add(kind);
        }
      }
    }
    // Mixed or unrecognised tables must not pass the file-type gate.
    return kinds.size === 1 ? [...kinds][0] : null;
  }
  function sourceDate(value) {
    const match = /^(\d{4})年(\d{1,2})月(\d{1,2})日$/.exec(value.trim());
    return csv.date(match ? `${match[1]}-${match[2]}-${match[3]}` : value);
  }
  function parse(text, kind) {
    if (!Object.hasOwn(headers, kind)) throw new Error('ファイル種別が不正です。');
    const result = { kind, sourceProvider: 'SBI証券', rows: [], totals: [], issues: [], snapshotAsOf: null,
      snapshotAsOfSource: null, sourceMetadata: {}, summary: null };
    let records;
    try { records = csv.parseCSV(text); }
    catch (error) { result.issues.push(issue('error', 'csv', error.message)); return result; }
    let table = null, context = {}, scope = 0, found = false, pendingTotal = null, searchHeader = null, skippedSection = false;
    records.forEach(record => {
      const cells = record.cells;
      // Read only explicitly named search metadata, never arbitrary preamble/PII.
      if (kind === 'transactions' && cells.includes('約定開始年月日') && cells.includes('明細数')) {
        searchHeader = cells; table = null; return;
      }
      if (searchHeader) {
        const labels = searchHeader; searchHeader = null;
        const fields = { '約定開始年月日': 'searchStart', '約定終了年月日': 'searchEnd',
          '明細数': 'detailCount', '明細指定開始': 'rangeStart', '明細指定終了': 'rangeEnd' };
        Object.entries(fields).forEach(([label, field]) => {
          const index = labels.indexOf(label);
          if (index < 0) return;
          const value = cells[index]?.trim();
          try {
            if (!value || value === '--') { result.sourceMetadata[field] = null; return; }
            if (field.startsWith('search')) result.sourceMetadata[field] = sourceDate(value);
            else if (/^\d+$/.test(value) && Number.isSafeInteger(Number(value))) result.sourceMetadata[field] = Number(value);
            else throw new Error('Invalid metadata');
          } catch (_) { result.issues.push(issue('warning', 'search-metadata', '検索条件の期間または件数を確認できません。', record.line)); }
        });
        const productIndex = labels.indexOf('商品指定');
        if (productIndex >= 0 && knownProducts.has(cells[productIndex]?.trim())) {
          result.sourceMetadata.product = cells[productIndex].trim();
        }
        return;
      }
      // Only a named baseline field is interpreted; arbitrary preamble/PII is ignored.
      if (['基準日', '基準日時'].includes(cells[0])) {
        try {
          const value = csv.observation(cells[1]);
          if (value && (!result.snapshotAsOf || result.snapshotAsOf === value)) {
            result.snapshotAsOf = value; result.snapshotAsOfSource = 'file';
          } else result.issues.push(issue('error', 'baseline', '基準日を一意に確認できません。', record.line));
        } catch (_) { result.issues.push(issue('warning', 'baseline', '基準日を確認してください。', record.line)); }
        return;
      }
      const group = section(cells);
      if (group) {
        if (pendingTotal) result.issues.push(issue('warning', 'total-missing', '区分合計の値が見つかりません。', record.line));
        table = null; pendingTotal = null; context = {};
        skippedSection = !group.supported;
        if (skippedSection) { result.issues.push(issue('warning', 'section', '未対応の保有区分を除外しました。', record.line)); return; }
        context = { product: group.product, custody: group.custody, mode: group.mode, sectionKey: group.key };
        if (group.total) pendingTotal = { context: { ...context }, fields: null };
        scope += 1; return;
      }
      if (pendingTotal) {
        if (!pendingTotal.fields) {
          const fields = { valuation: cells.indexOf('評価額合計'), unrealizedPnl: cells.indexOf('評価損益合計') };
          if (fields.valuation >= 0 || fields.unrealizedPnl >= 0) { pendingTotal.fields = fields; return; }
          result.issues.push(issue('warning', 'total-header', '区分合計のヘッダーを確認できません。', record.line));
        } else {
          const total = { rowNumber: record.line, sectionKey: pendingTotal.context.sectionKey, scope: null,
            product: pendingTotal.context.product, custody: pendingTotal.context.custody };
          Object.entries(pendingTotal.fields).forEach(([field, index]) => {
            try { total[field] = index < 0 ? null : csv.decimal(cells[index]); }
            catch (_) { total[field] = null; result.issues.push(issue('error', 'total-number', '区分合計を解釈できません。', record.line)); }
          });
          result.totals.push(total); pendingTotal = null; return;
        }
        pendingTotal = null; context = {};
      }
      if (skippedSection) return;
      const candidate = mapping(cells, kind);
      if (Object.hasOwn(candidate.fields, 'name')) {
        found = true;
        const missing = required[kind].filter(field => !Object.hasOwn(candidate.fields, field));
        if (missing.length || candidate.duplicate.length) {
          result.issues.push(issue('error', 'header', '必須列が不足、または対応する列が重複しています。', record.line));
          table = null; return;
        }
        table = { ...candidate, headerCells: cells, width: cells.length, scope: ++scope, context: { ...context } };
        const unknown = cells.filter((cell, index) => cell && !Object.values(candidate.fields).includes(index)).length;
        if (unknown) result.issues.push(issue('warning', 'extra-columns', `未対応の列が${unknown}列あります（読み飛ばします）。`, record.line));
        (kind === 'holdings' ? ['product', 'custody'] : []).forEach(field => {
          if (!Object.hasOwn(candidate.fields, field) && !context[field]) {
            result.issues.push(issue('warning', 'missing-context', '商品区分または預り区分を取得できない列構成です。', record.line));
          }
        });
        return;
      }
      if (!table) return;
      // Any unrecognized single-cell heading ends a section; never inherit its previous meaning.
      if (cells.length !== table.width) {
        result.issues.push(issue('warning', 'row-width', '列数が異なる行を除外しました。', record.line));
        if (cells.filter(cell => cell !== '').length === 1) { table = null; context = {}; }
        else result.rows.push({ rowNumber: record.line, status: 'invalid', data: {}, rawFields: {}, scope: table.scope, sectionKey: table.context.sectionKey || null,
          issues: [issue('error', 'row-width', '列数が一致しません。', record.line)] });
        return;
      }
      const data = { product: table.context.product || result.sourceMetadata.product || null, custody: table.context.custody || null };
      const rawFields = {}, sourceHeaders = {}, problems = [];
      Object.entries(table.fields).forEach(([field, index]) => {
        const value = cells[index];
        rawFields[field] = value; // allowlist only, never the complete source row
        sourceHeaders[field] = table.headerCells[index];
        try {
          let text = value.trim();
          // SBI's normal not-applicable marker. Required facts remain validated below.
          if (text === '--') text = '';
          if (kind === 'holdings' && ['quantity', 'sellOrderQuantity'].includes(field)
            && ['保有口数', '売却注文中'].includes(table.headerCells[index]) && text.endsWith('口')) {
            text = text.slice(0, -1); data.quantityUnit = '口';
          }
          data[field] = numeric.has(field) ? csv.decimal(text) : dates.has(field) ? csv.date(text) : text || null;
        } catch (_) {
          data[field] = null;
          problems.push(issue('error', numeric.has(field) ? 'number' : 'date', `${headers[kind][field][0]}を解釈できません。`, record.line));
        }
      });
      const total = ['合計', '総合計'].includes(data.name);
      if (total && kind === 'holdings') {
        result.totals.push({ rowNumber: record.line, scope: table.scope, all: data.name === '総合計',
          valuation: data.valuation, unrealizedPnl: data.unrealizedPnl });
        // Totals need not have quantity/prices. Invalid reported sums remain visible as a problem.
        result.issues.push(...problems.filter(item => ['number', 'date'].includes(item.code)));
        return;
      }
      required[kind].forEach(field => {
        if (data[field] === null) problems.push(issue('error', 'required-value', `${headers[kind][field][0]}が不足しています。`, record.line));
      });
      if (data.product && !knownProducts.has(data.product)) {
        problems.push(issue('warning', 'product', '未確認の商品区分です。', record.line));
        problems.push(issue('error', 'out-of-scope', '国内株式・投資信託の対応範囲外です。集計から除外します。', record.line));
      }
      result.rows.push({ rowNumber: record.line, status: problems.some(item => item.severity === 'error') ? 'invalid' : 'valid',
        data, rawFields, sourceHeaders, scope: table.scope, sectionKey: table.context.sectionKey || null, issues: problems });
    });
    if (pendingTotal) result.issues.push(issue('warning', 'total-missing', '区分合計の値が見つかりません。'));
    if (!found) result.issues.push(issue('error', 'header', '対応する必須ヘッダーが見つかりません。ファイル種別を確認してください。'));
    const valid = result.rows.filter(row => row.status === 'valid');
    const invalid = result.rows.filter(row => row.status === 'invalid');
    result.summary = { validCount: valid.length, invalidCount: invalid.length,
      valuation: kind === 'holdings' ? csv.sum(valid.map(row => row.data.valuation)) : null,
      unrealizedPnl: kind === 'holdings' ? csv.sum(valid.map(row => row.data.unrealizedPnl ?? null)) : null,
      groups: [] };
    if (invalid.length) result.issues.push(issue('warning', 'partial', '問題のある行を除いた集計です。明細を確認してください。'));
    if (!result.rows.length && found) result.issues.push(issue('warning', 'empty', '保有・取引の明細がありません。'));
    const groups = new Map();
    valid.forEach(row => {
      const key = JSON.stringify([row.data.product, row.data.custody]);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    });
    groups.forEach(rows => result.summary.groups.push({ product: rows[0].data.product, custody: rows[0].data.custody,
      count: rows.length, valuation: kind === 'holdings' ? csv.sum(rows.map(row => row.data.valuation)) : null }));
    result.totals.forEach(total => {
      const scoped = result.rows.filter(row => total.all || (total.sectionKey ? row.sectionKey === total.sectionKey : row.scope === total.scope));
      ['valuation', 'unrealizedPnl'].forEach(field => {
        if (total[field] === null || total[field] === undefined) return;
        const values = scoped.map(row => row.status === 'valid' ? row.data[field] ?? null : null);
        const calculated = csv.sum(values);
        if (calculated === null) result.issues.push(issue('warning', 'total-unchecked', '欠損・不正行のため合計を検算できません。', total.rowNumber));
        else if (!/^-?0(?:\.0+)?$/.test(csv.sum([calculated,
          total[field].startsWith('-') ? total[field].slice(1) : '-' + total[field]]))) {
          result.issues.push(issue('warning', 'total-mismatch', 'CSV内合計と明細合計が一致しません（補正しません）。', total.rowNumber));
        }
      });
    });
    if (kind === 'transactions') {
      const values = valid.map(row => row.data.executedAt).sort();
      result.summary.period = values.length ? [values[0], values[values.length - 1]] : null;
      const metadata = result.sourceMetadata;
      result.summary.searchPeriod = metadata.searchStart && metadata.searchEnd ? [metadata.searchStart, metadata.searchEnd] : null;
      let expected = metadata.detailCount;
      if (metadata.rangeStart != null && metadata.rangeEnd != null) {
        if (metadata.detailCount === 0 && metadata.rangeStart === 0 && metadata.rangeEnd === 0) expected = 0;
        else if (metadata.rangeStart >= 1 && metadata.rangeEnd >= metadata.rangeStart
          && (metadata.detailCount == null || metadata.rangeEnd <= metadata.detailCount)) {
          expected = metadata.rangeEnd - metadata.rangeStart + 1;
        } else {
          expected = null; result.issues.push(issue('warning', 'detail-range', '検索条件の明細範囲を確認してください。'));
        }
      }
      if (expected != null && result.rows.length !== expected) {
        result.issues.push(issue('warning', 'detail-count', '検索条件の明細数と読み込んだ件数が一致しません。'));
      }
      if (metadata.searchStart && metadata.searchEnd && metadata.searchStart > metadata.searchEnd) {
        result.issues.push(issue('warning', 'search-period', '検索条件の開始日・終了日を確認してください。'));
      } else if (result.summary.searchPeriod && values.some(day => day < metadata.searchStart || day > metadata.searchEnd)) {
        result.issues.push(issue('warning', 'search-period', '検索期間外の約定日があります。'));
      }
    }
    return result;
  }
  const api = { parse, detectKind };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TradeScopeSBI = Object.freeze(api);
})(typeof globalThis !== 'undefined' ? globalThis : this);
