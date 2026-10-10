(function (root) {
  'use strict';
  const model = typeof module !== 'undefined' && module.exports
    ? require('../assets/data-model-storage.js') : root.TradeScopeDataStorage;
  const csv = typeof module !== 'undefined' && module.exports ? require('./csv-core.js') : root.TradeScopeCSV;
  const ACCOUNT_ID = 'acc_sbi_sec';
  // Only a source label explicitly confirmed for SBI. No substring/prefix/name inference.
  const transactionProducts = Object.freeze({ '投信金額買付': '投資信託' });
  const holdingMap = { quantity: 'quantity', acquisitionPrice: 'acquisitionPrice', marketPrice: 'marketPrice',
    marketValue: 'valuation', unrealizedPnl: 'unrealizedPnl' };
  const transactionMap = { quantity: 'quantity', price: 'price', fee: 'fee' };
  // Only financial columns understood by both Parser and Storage. Never copy a complete row.
  const rawNames = new Set([...Object.values(holdingMap), ...Object.values(transactionMap), 'name', 'code',
    'product', 'custody', 'quantityUnit', 'acquisitionAmount', 'sellOrderQuantity', 'distributionMethod',
    'executedAt', 'settlementDate', 'market', 'orderType', 'transactionType', 'settlementOrPnl',
    'settlementAmount', 'reportedRealizedPnl', 'tax', 'maturity', 'taxation']);
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const clone = value => JSON.parse(JSON.stringify(value));
  const records = (models, entity) => models[entity]?.records || [];
  function issue(severity, code, message, rowNumber = null) { return { severity, code, message, rowNumber }; }
  function decimal(value) {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'string') throw new Error('Invalid decimal');
    const parsed = csv.decimal(value);
    return parsed === null ? null : parsed.replace(/^(-?)0+(?=\d)/, '$1');
  }
  function rawFields(row) {
    const result = {};
    for (const key of rawNames) {
      if (own(row.rawFields || {}, key)) result[key] = row.rawFields[key];
    }
    // Section-derived facts have no raw column; retain their explicit observed label.
    for (const key of ['product', 'custody', 'quantityUnit']) {
      if (!own(result, key) && row.data[key] != null) result[key] = row.data[key];
    }
    return result;
  }
  function assetType(product) {
    if (product === '投資信託') return 'MutualFund';
    if (['ETF', '国内ETF'].includes(product)) return 'ETF';
    if (['株式', '国内株式', '株式（現物）'].includes(product)) return 'Stock';
    return null;
  }
  function productCategory(data) {
    const product = typeof data.product === 'string' ? data.product.trim() : null;
    return product || (own(transactionProducts, data.transactionType) ? transactionProducts[data.transactionType] : null);
  }
  function sbiFundIdentityKey(name) {
    // Comparison only for source-qualified SBI funds: JS whitespace, no NFKC/fuzzy/zero-width cleanup.
    // Never use this key as the persisted displayName, symbol or raw source label.
    return JSON.stringify(['sbi', 'MutualFund', name.replace(/\s+/gu, '')]);
  }
  function createSession(cryptoApi = root.crypto) {
    const ids = new Map();
    return Object.freeze({ cryptoApi, id(key, prefix) {
      if (!ids.has(key)) ids.set(key, model.newId(prefix, cryptoApi));
      return ids.get(key);
    } });
  }
  function readExisting(storage) {
    // A deliberately read-only adapter; no writer or Repository commit is exposed here.
    return model.readModels({ getItem: key => storage.getItem(key) });
  }
  function emptyModels() { return Object.fromEntries(Object.keys(model.keys).map(key => [key, null])); }
  async function fileMetadata(buffer, cryptoApi = root.crypto) {
    return { hash: await model.hashBytes(buffer, cryptoApi), size: buffer.byteLength };
  }
  async function convert(sources, existing = emptyModels(), session = createSession()) {
    model.validateModels(existing);
    const account = records(existing, 'accounts').find(item => item.id === ACCOUNT_ID)
      || model.initialAccounts().find(item => item.id === ACCOUNT_ID);
    const result = { account: { accountId: ACCOUNT_ID, exists: records(existing, 'accounts').some(item => item.id === ACCOUNT_ID),
      needsCreation: !records(existing, 'accounts').some(item => item.id === ACCOUNT_ID), record: clone(account) },
      files: [], instruments: [], issues: [] };
    const validationTime = new Date().toISOString(); // Validation only, never placed in a draft/export.
    const existingInstruments = records(existing, 'instruments');
    const byCode = new Map();
    const fundsByName = new Map();
    const addFund = (name, record) => {
      const key = sbiFundIdentityKey(name);
      if (!fundsByName.has(key)) fundsByName.set(key, new Map());
      fundsByName.get(key).set(record.id, record);
    };
    // Instrument has no provider field. Use explicit SBI observation/transaction provenance,
    // not an unqualified displayName or alias, to establish the official name identity.
    const batches = new Map(records(existing, 'importBatches').map(item => [item.id, item]));
    const accounts = new Map(records(existing, 'accounts').map(item => [item.id, item]));
    const instruments = new Map(existingInstruments.map(item => [item.id, item]));
    for (const fact of [...records(existing, 'holdingSnapshots'), ...records(existing, 'rawTransactions')]) {
      const batch = batches.get(fact.importBatchId), instrument = instruments.get(fact.instrumentId);
      if (batch?.sourceProvider === 'sbi' && batch.sourceType === 'csv'
        && accounts.get(fact.accountId)?.providerCode === 'sbi' && instrument?.assetType === 'MutualFund'
        && productCategory(fact.rawFields || {}) === '投資信託' && typeof fact.rawFields.name === 'string' && fact.rawFields.name.trim()) {
        addFund(fact.rawFields.name, instrument);
      }
    }
    const fileKeys = new Set();
    const transactionIndex = new Map();
    for (const item of records(existing, 'rawTransactions').filter(record => record.accountId === ACCOUNT_ID)) {
      // The current CSV exposes no broker ID. Compare fact candidates even when a stored row has one.
      const candidate = await model.dedupeCandidate({ ...item, externalTransactionId: null }, session.cryptoApi);
      if (!transactionIndex.has(candidate.key)) transactionIndex.set(candidate.key, []);
      transactionIndex.get(candidate.key).push(item.id);
    }
    const ordered = [...sources].sort((a, b) => (a.preview.kind === 'holdings' ? 0 : 1) - (b.preview.kind === 'holdings' ? 0 : 1));
    function validDraft(entity, record) {
      model.validateRecord(entity, ['importBatches', 'holdingSnapshots', 'rawTransactions'].includes(entity)
        ? { ...record, importedAt: validationTime } : record);
    }
    function resolve(row, fileKey, issues) {
      const data = row.data, type = assetType(productCategory(data)), code = data.code;
      if (typeof data.name !== 'string' || !data.name.trim()) throw new Error('Missing name');
      if (code != null && typeof code !== 'string') throw new Error('Invalid code');
      if (typeof data.product === 'string' && data.product.trim() && own(transactionProducts, data.transactionType)
        && assetType(data.product.trim()) !== assetType(transactionProducts[data.transactionType])) {
        issues.push(issue('error', 'product-conflict', '商品区分と取引区分を確認してください。', row.rowNumber));
        return null;
      }
      const reuse = record => {
        if (!record.enabled) { issues.push(issue('error', 'instrument-disabled', '無効な銘柄のため確認が必要です。', row.rowNumber)); return null; }
        let candidate = result.instruments.find(item => item.record?.id === record.id);
        if (!candidate) {
          candidate = { record: clone(record), status: 'existing', requiresConfirmation: false,
            subtype: type === 'ETF' ? 'ETF' : null };
          result.instruments.push(candidate);
        }
        return candidate;
      };
      const allowed = type === 'Stock' ? ['Stock', 'ETF'] : type ? [type] : ['Stock', 'ETF', 'MutualFund'];
      const codeMatches = code ? [...existingInstruments, ...[...byCode.values()].map(item => item.record)]
        .filter(item => item.symbol === code && ['Stock', 'ETF', 'MutualFund'].includes(item.assetType)) : [];
      if (codeMatches.some(item => !allowed.includes(item.assetType))) {
        issues.push(issue('error', 'instrument-conflict', '商品区分と一致先の銘柄を確認してください。', row.rowNumber));
        return null;
      }
      const matches = codeMatches.filter(item => allowed.includes(item.assetType));
      const unique = [...new Map(matches.map(item => [item.id, item])).values()];
      if (unique.length > 1) {
        issues.push(issue('error', 'instrument-ambiguous', '銘柄コードの一致先を確認してください。', row.rowNumber));
        return null;
      }
      if (unique.length === 1) {
        if (type === 'MutualFund') addFund(data.name, unique[0]);
        return reuse(unique[0]);
      }
      const fundMatches = !code && (type === 'MutualFund' || !type)
        ? [...(fundsByName.get(sbiFundIdentityKey(data.name))?.values() || [])] : [];
      if (fundMatches.length > 1) {
        issues.push(issue('error', 'instrument-ambiguous', '正式名の一致先を確認してください。', row.rowNumber));
        return null;
      }
      if (fundMatches.length === 1) {
        // A missing transaction category can be resolved only from this exact known SBI identity.
        // Do not infer MutualFund from an empty market, code pattern or similar name.
        if (!type) issues.push(issue('warning', 'product-reference', '商品区分は一致した保有・取引記録を参照しています。', row.rowNumber));
        return reuse(fundMatches[0]);
      }
      if (!type) {
        issues.push(issue('error', 'instrument-type', '商品区分を確認できないため、銘柄の確認が必要です。', row.rowNumber));
        return null;
      }
      const nameMatches = !code ? existingInstruments.filter(item => item.assetType === type
        && (item.displayName === data.name || item.symbol === data.name || item.aliases?.includes(data.name))) : [];
      const idKey = code ? JSON.stringify(['code', code, type]) : type === 'MutualFund'
        ? sbiFundIdentityKey(data.name) : JSON.stringify(['row', fileKey, row.rowNumber]);
      const record = { id: session.id(idKey, 'ins'), assetType: type, symbol: code || data.name,
        displayName: data.name, enabled: true };
      validDraft('instruments', record);
      let candidate = result.instruments.find(item => item.record?.id === record.id);
      if (!candidate) {
        candidate = { record, status: 'new', requiresConfirmation: !code && type !== 'MutualFund', subtype: type === 'ETF' ? 'ETF' : null,
          possibleMatches: nameMatches.map(item => item.id) };
        result.instruments.push(candidate);
      }
      if (code) byCode.set(idKey, candidate);
      if (type === 'MutualFund') {
        addFund(data.name, record);
        if (nameMatches.length) {
          candidate.requiresConfirmation = true;
          issues.push(issue('warning', 'instrument-source-unknown', '同名銘柄の取得元を確認できません。自動統合しません。', row.rowNumber));
        }
      } else if (!code) issues.push(issue('warning', 'instrument-name-only', 'コードのない銘柄は仮候補です。名前だけでは統合しません。', row.rowNumber));
      return candidate;
    }
    for (const source of ordered) {
      const preview = source.preview;
      if (!['holdings', 'transactions'].includes(preview?.kind) || !Array.isArray(preview.rows)) throw new Error('Invalid preview');
      const fileKey = JSON.stringify([preview.kind, source.metadata?.hash, preview.parserVersion]);
      if (fileKeys.has(fileKey)) throw new Error('Duplicate preview input');
      fileKeys.add(fileKey);
      const file = { kind: preview.kind, batch: null, holdings: [], transactions: [], transactionCandidates: [], rows: [], issues: [], duplicateBatches: [], duplicateObservations: [],
        observation: null, instrumentIds: [] };
      result.files.push(file);
      const batch = { id: session.id(fileKey, 'batch'), accountId: ACCOUNT_ID, sourceType: 'csv', sourceProvider: 'sbi',
        sourceFileMetadata: { hash: source.metadata?.hash, size: source.metadata?.size }, importerId: 'sbi-domestic-csv',
        importerVersion: preview.parserVersion };
      if (source.targetMonth) batch.targetMonth = source.targetMonth;
      if (preview.kind === 'holdings') {
        batch.snapshotAsOf = preview.snapshotAsOfSource === 'file' ? preview.snapshotAsOf : source.snapshotAsOf || null;
        if (!batch.targetMonth) file.issues.push(issue('error', 'target-month', '対象月を指定してください。'));
        if (!batch.snapshotAsOf) file.issues.push(issue('error', 'observation-date', '取得日を指定してください。'));
      }
      if (!account.enabled || account.providerCode !== 'sbi' || account.accountType !== 'securities') {
        file.issues.push(issue('error', 'account', 'SBI証券の口座設定を確認してください。'));
      }
      if (preview.issues?.some(item => item.severity === 'error')) {
        file.issues.push(issue('error', 'parser', 'CSVのエラーを確認してください。'));
      }
      try { validDraft('accounts', account); validDraft('importBatches', batch); file.batch = batch; }
      catch (_) { file.issues.push(issue('error', 'batch', '対象月・取得日・ファイル情報を確認してください。')); }
      file.duplicateBatches = records(existing, 'importBatches').filter(item => item.accountId === ACCOUNT_ID
        && item.sourceType === 'csv' && item.sourceProvider === 'sbi' && item.sourceFileMetadata?.hash === batch.sourceFileMetadata.hash)
        .map(item => item.id);
      if (file.duplicateBatches.length) file.issues.push(issue('warning', 'duplicate-file', '同じファイルの取込候補があります。自動統合しません。'));
      if (preview.kind === 'holdings' && batch.targetMonth && batch.snapshotAsOf) {
        const holdingBatchIds = new Set(records(existing, 'holdingSnapshots').map(item => item.importBatchId));
        file.duplicateObservations = records(existing, 'importBatches').filter(item => holdingBatchIds.has(item.id)
          && item.accountId === ACCOUNT_ID && item.sourceProvider === 'sbi' && item.sourceType === 'csv'
          && item.targetMonth === batch.targetMonth && item.snapshotAsOf === batch.snapshotAsOf).map(item => item.id);
        if (file.duplicateObservations.length) file.issues.push(issue('warning', 'duplicate-observation', '同じ対象月・取得日の保有候補があります。自動統合しません。'));
      }
      if (preview.kind === 'holdings' && file.issues.some(item => item.severity === 'error')) continue;
      for (const row of preview.rows) {
        const rowPlan = { rowNumber: row.rowNumber, name: row.data?.name || '', status: 'invalid', record: null,
          facts: null, instrumentId: null, instrumentStatus: 'unresolved', saveEligible: false, duplicateCandidates: [], issues: [] };
        file.rows.push(rowPlan);
        if (preview.kind === 'transactions') file.transactionCandidates.push(rowPlan);
        if (row.status !== 'valid') { rowPlan.issues.push(issue('error', 'parser-row', 'CSVの問題行は保存可能候補から除外しました。', row.rowNumber)); continue; }
        try {
          if (!Number.isSafeInteger(row.rowNumber) || row.rowNumber < 1) throw new Error('Invalid row');
          // Build and validate transaction facts BEFORE Instrument resolution. This draft is not a Storage record.
          const facts = { id: session.id(JSON.stringify([fileKey, row.rowNumber, preview.kind]), preview.kind === 'holdings' ? 'hs' : 'tx'),
            accountId: ACCOUNT_ID, instrumentId: null, importBatchId: batch.id, rawFields: rawFields(row) };
          if (preview.kind === 'transactions') {
            Object.assign(facts, { sourceType: 'csv', sourceProvider: 'sbi', sourceRowNumber: row.rowNumber,
              executedAt: row.data.executedAt, transactionType: row.data.transactionType, realizedPnl: null, swap: null });
            if (row.rawFields?.executedAt != null) facts.executedAtRaw = row.rawFields.executedAt;
            if (row.data.quantityUnit != null) facts.quantityUnit = row.data.quantityUnit;
            if (row.data.code) facts.brokerRawSymbol = row.data.code;
            for (const [field, sourceField] of Object.entries(transactionMap)) facts[field] = decimal(row.data[sourceField]);
            if (!facts.executedAt || facts.quantity === null || facts.price === null) throw new Error('Missing trade fact');
            // The injected ID/timestamp are ONLY for fact type validation, never retained in an unresolved draft.
            validDraft('rawTransactions', { ...facts, instrumentId: 'validation-only-instrument' });
            rowPlan.facts = facts;
          }
          const instrument = resolve(row, fileKey, rowPlan.issues);
          if (!instrument) {
            if (preview.kind === 'transactions') {
              rowPlan.issues.forEach(item => { item.severity = 'warning'; });
              rowPlan.status = 'needs-confirmation';
            }
            continue;
          }
          rowPlan.instrumentId = instrument.record.id;
          facts.instrumentId = instrument.record.id;
          if (preview.kind === 'holdings') {
            Object.assign(facts, { sourceMode: 'imported', sourceScope: 'sbi-domestic-holdings',
              targetMonth: batch.targetMonth, snapshotAsOf: batch.snapshotAsOf });
            if (row.data.quantityUnit != null) facts.rawFields.quantityUnit = row.data.quantityUnit;
            for (const [field, sourceField] of Object.entries(holdingMap)) facts[field] = decimal(row.data[sourceField]);
            if (facts.quantity === null || facts.marketValue === null) throw new Error('Missing holding fact');
            validDraft('holdingSnapshots', facts);
          } else {
            // No source external ID vocabulary has been confirmed for the current SBI CSV.
            validDraft('rawTransactions', facts);
            const key = await model.dedupeCandidate({ ...facts, importedAt: validationTime }, session.cryptoApi);
            rowPlan.duplicateCandidates = [...(transactionIndex.get(key.key) || [])];
            if (rowPlan.duplicateCandidates.length) rowPlan.issues.push(issue('warning', 'duplicate-transaction', '重複する取引候補があります。自動除外しません。', row.rowNumber));
          }
          rowPlan.record = facts; rowPlan.status = instrument.requiresConfirmation || rowPlan.issues.some(item => item.severity === 'warning')
            || rowPlan.duplicateCandidates.length ? 'needs-confirmation' : 'candidate';
          rowPlan.instrumentStatus = 'resolved';
          rowPlan.saveEligible = rowPlan.status === 'candidate';
          (preview.kind === 'holdings' ? file.holdings : file.transactions).push(facts);
          if (!file.instrumentIds.includes(facts.instrumentId)) file.instrumentIds.push(facts.instrumentId);
        } catch (_) { rowPlan.issues.push(issue('error', 'conversion-row', '銘柄・数量・価格等を変換できません。', row.rowNumber)); }
      }
      if (preview.kind === 'holdings' && file.holdings.length) file.observation = { accountId: ACCOUNT_ID, importBatchId: batch.id,
        targetMonth: batch.targetMonth, snapshotAsOf: batch.snapshotAsOf, sourceScope: 'sbi-domestic-holdings',
        sourceType: batch.sourceType,
        records: file.holdings }; // One observation, NOT a new persisted group schema or whole-account state.
      // Check the full graph in memory only. importedAt will be assigned at an eventual real save, not now.
      const checked = Object.fromEntries(Object.keys(model.keys).map(entity => [entity, { schemaVersion: 1,
        records: clone(records(existing, entity)), updatedAt: validationTime }]));
      if (!result.account.exists) checked.accounts.records.push(clone(account));
      for (const candidate of result.instruments.filter(item => item.status === 'new')) checked.instruments.records.push(clone(candidate.record));
      checked.importBatches.records.push({ ...batch, importedAt: validationTime });
      checked.holdingSnapshots.records.push(...file.holdings.map(item => ({ ...item, importedAt: validationTime })));
      checked.rawTransactions.records.push(...file.transactions.map(item => ({ ...item, importedAt: validationTime })));
      try { model.validateModels(checked); }
      catch (_) {
        file.issues.push(issue('error', 'references', '保存予定の参照関係を確認できません。'));
        file.holdings = []; file.transactions = []; file.observation = null; file.instrumentIds = [];
        for (const row of file.rows) { row.status = 'invalid'; row.record = null; row.saveEligible = false; }
      }
      if (preview.kind === 'transactions') {
        if (file.issues.length) for (const row of file.transactionCandidates) {
          row.saveEligible = false;
          if (row.status === 'candidate') row.status = 'needs-confirmation';
        }
        file.transactions = file.transactionCandidates.filter(row => row.saveEligible).map(row => row.record);
        file.counts = { parserCount: preview.rows.length, candidateCount: file.transactionCandidates.length,
          savableCount: file.transactions.length, needsConfirmationCount: file.transactionCandidates.filter(row => !row.saveEligible).length,
          unresolvedCount: file.transactionCandidates.filter(row => row.instrumentStatus === 'unresolved').length };
      }
    }
    const referencedIds = new Set(result.files.flatMap(file => file.instrumentIds));
    result.instruments = result.instruments.filter(item => referencedIds.has(item.record.id));
    return result;
  }
  const api = Object.freeze({ accountId: ACCOUNT_ID, productCategory, createSession, emptyModels, readExisting, fileMetadata, convert });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TradeScopeSBIModelPreview = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
