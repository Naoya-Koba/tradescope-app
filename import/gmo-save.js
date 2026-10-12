(function (root) {
  'use strict';
  const model = typeof module !== 'undefined' && module.exports ? require('../assets/data-model-storage.js') : root.TradeScopeDataStorage;
  const transaction = typeof module !== 'undefined' && module.exports ? require('../assets/storage-transaction.js') : root.TradeScopeStorageTransaction;
  const resolver = typeof module !== 'undefined' && module.exports ? require('../assets/monthly-account-resolver.js') : root.TradeScopeMonthlyResolver;
  const parser = typeof module !== 'undefined' && module.exports ? require('./gmo-parser.js') : root.TradeScopeGMOParser;
  const csv = typeof module !== 'undefined' && module.exports ? require('./csv-core.js') : root.TradeScopeCSV;
  const view = typeof module !== 'undefined' && module.exports ? require('../assets/transaction-view.js') : root.TradeScopeTransactionView;
  const policy = resolver.policies.gmo, accountId = policy.accountId;
  const valueNames = ['realizedPnl', 'swapPnl', 'deposit', 'withdrawal', 'unrealizedPnl', 'cashBalance', 'netAssetValue', 'requiredMargin'];
  const rows = (models, entity) => models[entity]?.records || [];
  const copy = value => JSON.parse(JSON.stringify(value));
  const only = (object, keys) => object && typeof object === 'object' && !Array.isArray(object) && Object.keys(object).every(key => keys.includes(key));
  // Dependency completion for imported executions, shared by new imports and enrichment.
  // No month/provider-specific identity rule, fuzzy match or metadata replacement.
  function instrumentDependencies(before, trades) {
    const ids = new Map(), newSymbols = [];
    for (const row of trades) {
      const symbol = view.fxPair(row.symbol);
      if (!symbol) return null;
      if (ids.has(symbol) || newSymbols.includes(symbol)) continue;
      const matches = rows(before, 'instruments').filter(item => item.assetType === 'FX' && view.fxPair(item.symbol) === symbol);
      if (matches.length > 1) return null;
      if (matches.length) ids.set(symbol, matches[0].id); else newSymbols.push(symbol);
    }
    return { ids, newSymbols };
  }
  function sameTrade(record, fact, before) {
    const instrument = rows(before, 'instruments').find(item => item.id === record.instrumentId);
    if (view.fxPair(instrument?.symbol) !== view.fxPair(fact.symbol)) return false;
    const decimals = ['quantity', 'price', 'realizedPnl', 'fee'];
    return Object.keys(fact).filter(key => key !== 'symbol').every(key => decimals.includes(key)
      ? record[key] === null && fact[key] === null || parser.equal(record[key], fact[key]) : record[key] === fact[key]);
  }
  function originalSnapshotMatches(snapshot, preview) {
    const same = (a, b) => typeof a === 'string' && typeof b === 'string' && parser.equal(a, b);
    return snapshot?.sourceScope === policy.sourceScope && snapshot.sourceMode === policy.sourceMode
      && snapshot.observationType === policy.observationType && snapshot.valuationCurrency === policy.valuationCurrency
      && same(snapshot.reportedMonthlyRealizedPnl, preview.values.realizedPnl)
      && ['cashBalance', 'netAssetValue', 'unrealizedPnl'].every(key => same(snapshot[key], preview.values[key]))
      && same(snapshot.accountSpecific?.requiredMargin, preview.values.requiredMargin);
  }
  function validateSource(source) {
    model.assertJson(source);
    const preview = source?.preview;
    if (!only(source, ['preview', 'fileHash', 'fileSize']) || !/^[a-f0-9]{64}$/.test(source.fileHash)
      || !Number.isSafeInteger(source.fileSize) || source.fileSize < 8 || source.fileSize > 20 * 1024 * 1024
      || !only(preview, ['broker', 'importerVersion', 'targetMonth', 'snapshotAsOf', 'observationType', 'valuationCurrency', 'values', 'errors', 'warnings', 'valid', 'tradeDetails'])
      || preview.broker !== 'gmo' || preview.importerVersion !== parser.version || preview.valid !== true
      || !Array.isArray(preview.errors) || preview.errors.length || !Array.isArray(preview.warnings) || preview.warnings.length
      || preview.observationType !== policy.observationType || preview.valuationCurrency !== policy.valuationCurrency
      || !/^\d{4}-(0[1-9]|1[0-2])$/.test(preview.targetMonth) || preview.targetMonth < policy.cutover
      || !only(preview.values, valueNames) || valueNames.some(name => typeof preview.values[name] !== 'string'
        || parser.decimal(preview.values[name]) !== preview.values[name])) throw new Error('PDFの内容を再確認してください');
    const monthEnd = new Date(Date.UTC(Number(preview.targetMonth.slice(0, 4)), Number(preview.targetMonth.slice(5)), 0)).toISOString().slice(0, 10);
    if (preview.snapshotAsOf !== monthEnd || ['deposit', 'withdrawal', 'requiredMargin'].some(name => /^-/.test(preview.values[name]))) throw new Error('月末情報を再確認してください');
    if (!parser.equal(preview.values.netAssetValue, csv.sum([preview.values.cashBalance, preview.values.unrealizedPnl]))) throw new Error('純資産の照合が一致しません');
    if(preview.tradeDetails){const d=preview.tradeDetails;
      if(!only(d,['rows','coverage','pnlCoverage','audit','errors','warnings'])||!Array.isArray(d.rows)||!Array.isArray(d.errors)||d.errors.length
        ||!Array.isArray(d.warnings)||d.warnings.some(w=>w!=='GMO_TRADE_PNL_MISMATCH')||!['complete','unavailable'].includes(d.coverage)
        ||!['complete','incomplete'].includes(d.pnlCoverage)||!['matched','mismatch','not-comparable'].includes(d.audit)
        ||d.coverage==='unavailable'&&d.rows.length)throw new Error('取引明細を確認できません');
      for(const row of d.rows)if(!only(row,['sourcePage','sourceRow','tradeDate','executedAt','symbol','side','normalizedTransactionType','rawTransactionType','quantity','quantityUnit','price','realizedPnl','fee','feeCurrency','currency','providerExecutionId','providerOrderId'])||!view.fxPair(row.symbol))throw new Error('取引明細を確認できません');
    }
    return preview;
  }
  function createService(adapter, options = {}) {
    const repository = model.createRepository(adapter), clock = options.clock || (() => new Date().toISOString());
    const cryptoApi = options.cryptoApi || root.crypto; let busy = false;
    function prepare(input) {
      if (adapter.getItem(transaction.journalKey) !== null) throw new Error('未完了のジャーナルが残っています。保存を停止しました');
      model.assertJson(input);
      const source = copy(input), preview = validateSource(source), before = repository.read();
      let legacy;
      try { legacy = JSON.parse(adapter.getItem('tradingData') || '{}'); } catch (_) { throw new Error('従来入力を確認できません'); }
      if (resolver.hasLegacyConflict(legacy, preview.targetMonth, 'gmo')) return { status: 'conflict', reason: 'legacy' };
      const account = rows(before, 'accounts').find(row => row.id === accountId);
      if (account && (!account.enabled || account.providerCode !== 'gmo' || account.accountType !== 'fx')) return { status: 'conflict', reason: 'account' };
      const hashMatches = rows(before, 'importBatches').filter(row => row.sourceFileMetadata?.hash === source.fileHash);
      let enrichmentBatch = null;
      if (hashMatches.length) {
        const matches = hashMatches.filter(row => row.accountId === accountId && row.sourceType === 'pdf' && row.sourceProvider === 'gmo'
          && row.importerId === 'gmo-fx-monthly' && ['gmo-fx-monthly-v1', parser.version].includes(row.importerVersion)
          && row.targetMonth === preview.targetMonth && row.snapshotAsOf === preview.snapshotAsOf
          && (row.sourceFileMetadata.size === undefined || row.sourceFileMetadata.size === source.fileSize));
        if (matches.length !== 1 || hashMatches.length !== 1) return { status: 'conflict', reason: 'batch-identity' };
        const exact = matches[0], existing = rows(before, 'importedTransactions').filter(row => row.importBatchId === exact.id);
        const detail = preview.tradeDetails;
        if (!detail?.rows.length) return existing.length ? { status: 'conflict', reason: 'trade-set' } : { status: 'already-imported' };
        if (existing.length) {
          if (existing.length !== detail.rows.length || detail.rows.some(fact => existing.filter(row => sameTrade(row, fact, before)).length !== 1))
            return { status: 'conflict', reason: 'trade-set' };
          return { status: 'already-imported' };
        }
        if (detail.coverage !== 'complete' || detail.audit === 'mismatch' || detail.warnings.length
          || detail.pnlCoverage === 'complete' && (!detail.rows.filter(row => row.normalizedTransactionType === 'close').every(row => row.realizedPnl !== null)
            || !parser.equal(csv.sum(['0', ...detail.rows.filter(row => row.normalizedTransactionType === 'close').map(row => row.realizedPnl)]), preview.values.realizedPnl)))
          return { status: 'conflict', reason: 'trade-audit' };
        const observations = rows(before, 'accountSnapshots').filter(row => row.importBatchId === exact.id);
        if (observations.length !== 1 || !originalSnapshotMatches(observations[0], preview)) return { status: 'conflict', reason: 'source-values' };
        enrichmentBatch = exact;
      }
      const dependencies = instrumentDependencies(before, preview.tradeDetails?.rows || []);
      if (!dependencies) return { status: 'conflict', reason: 'instrument' };
      const { ids, newSymbols } = dependencies;
      if (enrichmentBatch) return { status: 'backfill-ready', source, preview, before, account, ids, newSymbols, enrichmentBatch };
      const state = rows(before, 'monthlyAccountStates').find(row => row.accountId === accountId && row.targetMonth === preview.targetMonth);
      const previous = rows(before, 'accountSnapshots').filter(row => row.accountId === accountId && row.targetMonth === preview.targetMonth && row.sourceScope === policy.sourceScope);
      if (previous.length && !state) return { status: 'conflict', reason: 'unadopted' };
      return { status: state ? 'review-required' : 'ready', reason: state ? 'different-report' : null,
        source, preview, before, account, state, ids, newSymbols };
    }
    function publicResult(prepared) {
      return { status: prepared.status, reason: prepared.reason || null,
        ...(prepared.state ? { stateId: prepared.state.id, adoptedSnapshotId: prepared.state.adoptedAccountSnapshotId } : {}) };
    }
    async function inspect(input) { return publicResult(prepare(input)); }
    function transactionChanges(prepared, batch, updatedAt) {
      const { before, preview, ids, newSymbols } = prepared, changes = {};
      const envelope = records => ({ schemaVersion: 1, records, updatedAt });
      const instruments = newSymbols.map(symbol => { const id = model.newId('ins', cryptoApi); ids.set(symbol, id);
        return { id, assetType: 'FX', symbol, displayName: symbol, baseCurrency: symbol.slice(0,3), quoteCurrency: symbol.slice(4), enabled: true }; });
      if (instruments.length) changes.instruments = envelope([...copy(rows(before, 'instruments')), ...instruments]);
      const imported = (preview.tradeDetails?.rows || []).map(row => { const { symbol, ...facts } = row;
        return { schemaVersion: 1, id: model.newId('it', cryptoApi), accountId: batch.accountId, instrumentId: ids.get(view.fxPair(symbol)),
          importBatchId: batch.id, sourceProvider: batch.sourceProvider, sourceType: batch.sourceType, sourceScope: 'gmo-fx-trades',
          targetMonth: preview.targetMonth, importedAt: batch.importedAt, ...facts }; });
      if (imported.length) changes.importedTransactions = envelope([...copy(rows(before, 'importedTransactions')), ...imported]);
      return changes;
    }
    async function save(input, confirmation = {}) {
      if (busy) return { status: 'busy' }; busy = true;
      try {
        const prepared = prepare(input);
        if (prepared.status === 'backfill-ready') {
          // The original source timestamp is part of the v9 record contract. Only envelope.updatedAt advances.
          const changes = transactionChanges(prepared, prepared.enrichmentBatch, clock());
          repository.commit(changes, { expectedModels: prepared.before });
          return { status: 'saved', enriched: true, importBatchId: prepared.enrichmentBatch.id, transactionCount: prepared.preview.tradeDetails.rows.length };
        }
        const correction = prepared.status === 'review-required' && prepared.reason === 'different-report'
          && confirmation.stateId === prepared.state.id && confirmation.adoptedSnapshotId === prepared.state.adoptedAccountSnapshotId;
        if (prepared.status !== 'ready' && !correction) return publicResult(prepared);
        const { source, preview, before, account, state } = prepared, importedAt = clock();
        const batchId = model.newId('batch', cryptoApi), snapshotId = model.newId('as', cryptoApi);
        const batch = { id: batchId, accountId, sourceType: 'pdf', sourceProvider: 'gmo', importedAt,
          targetMonth: preview.targetMonth, snapshotAsOf: preview.snapshotAsOf, importerId: 'gmo-fx-monthly', importerVersion: parser.version,
          sourceFileMetadata: { hash: source.fileHash, size: source.fileSize } };
        const snapshot = { id: snapshotId, accountId, sourceMode: policy.sourceMode, sourceScope: policy.sourceScope,
          targetMonth: preview.targetMonth, snapshotAsOf: preview.snapshotAsOf, observationType: policy.observationType,
          valuationCurrency: policy.valuationCurrency, importBatchId: batchId, importedAt,
          cashBalance: preview.values.cashBalance, netAssetValue: preview.values.netAssetValue, unrealizedPnl: preview.values.unrealizedPnl,
          reportedMonthlyRealizedPnl: preview.values.realizedPnl, accountSpecific: { requiredMargin: preview.values.requiredMargin } };
        const monthly = { schemaVersion: 2, id: state?.id || model.newId('mas', cryptoApi), accountId, targetMonth: preview.targetMonth, confirmedAt: importedAt,
          adoptedAccountSnapshotId: snapshotId, domesticImportBatchId: null, foreignAccountSnapshotId: null, cashAccountSnapshotId: null,
          ...Object.fromEntries(['realizedPnl', 'swapPnl', 'deposit', 'withdrawal'].map(name => [name, preview.values[name]])) };
        const changes = transactionChanges(prepared, batch, importedAt);
        const envelope = records => ({ schemaVersion: 1, records, updatedAt: importedAt });
        if (!account) changes.accounts = envelope([...copy(rows(before, 'accounts')), model.initialAccounts().find(row => row.id === accountId)]);
        changes.importBatches = envelope([...copy(rows(before, 'importBatches')), batch]);
        changes.accountSnapshots = envelope([...copy(rows(before, 'accountSnapshots')), snapshot]);
        changes.monthlyAccountStates = envelope([...copy(rows(before, 'monthlyAccountStates')).filter(row => row.id !== monthly.id), monthly]);
        // One journal protects all facts, adoption and derived cache invalidation. Readback completes before success.
        repository.commit(changes, { expectedModels: before, invalidateTopSummary: true });
        return { status: 'saved', corrected: correction, importBatchId: batchId };
      } finally { busy = false; }
    }
    return Object.freeze({ read: () => repository.read(), inspect, save });
  }
  const api = Object.freeze({ createService, validateSource });
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TradeScopeGMOSave = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
