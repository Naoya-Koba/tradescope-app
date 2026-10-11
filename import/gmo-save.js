(function (root) {
  'use strict';
  const model = typeof module !== 'undefined' && module.exports ? require('../assets/data-model-storage.js') : root.TradeScopeDataStorage;
  const transaction = typeof module !== 'undefined' && module.exports ? require('../assets/storage-transaction.js') : root.TradeScopeStorageTransaction;
  const resolver = typeof module !== 'undefined' && module.exports ? require('../assets/monthly-account-resolver.js') : root.TradeScopeMonthlyResolver;
  const parser = typeof module !== 'undefined' && module.exports ? require('./gmo-parser.js') : root.TradeScopeGMOParser;
  const csv = typeof module !== 'undefined' && module.exports ? require('./csv-core.js') : root.TradeScopeCSV;
  const policy = resolver.policies.gmo, accountId = policy.accountId;
  const valueNames = ['realizedPnl', 'swapPnl', 'deposit', 'withdrawal', 'unrealizedPnl', 'cashBalance', 'netAssetValue', 'requiredMargin'];
  const rows = (models, entity) => models[entity]?.records || [];
  const copy = value => JSON.parse(JSON.stringify(value));
  const only = (object, keys) => object && typeof object === 'object' && !Array.isArray(object) && Object.keys(object).every(key => keys.includes(key));
  function validateSource(source) {
    model.assertJson(source);
    const preview = source?.preview;
    if (!only(source, ['preview', 'fileHash', 'fileSize']) || !/^[a-f0-9]{64}$/.test(source.fileHash)
      || !Number.isSafeInteger(source.fileSize) || source.fileSize < 8 || source.fileSize > 20 * 1024 * 1024
      || !only(preview, ['broker', 'importerVersion', 'targetMonth', 'snapshotAsOf', 'observationType', 'valuationCurrency', 'values', 'errors', 'warnings', 'valid'])
      || preview.broker !== 'gmo' || preview.importerVersion !== parser.version || preview.valid !== true
      || !Array.isArray(preview.errors) || preview.errors.length || !Array.isArray(preview.warnings) || preview.warnings.length
      || preview.observationType !== policy.observationType || preview.valuationCurrency !== policy.valuationCurrency
      || !/^\d{4}-(0[1-9]|1[0-2])$/.test(preview.targetMonth) || preview.targetMonth < policy.cutover
      || !only(preview.values, valueNames) || valueNames.some(name => typeof preview.values[name] !== 'string'
        || parser.decimal(preview.values[name]) !== preview.values[name])) throw new Error('PDFの内容を再確認してください');
    const monthEnd = new Date(Date.UTC(Number(preview.targetMonth.slice(0, 4)), Number(preview.targetMonth.slice(5)), 0)).toISOString().slice(0, 10);
    if (preview.snapshotAsOf !== monthEnd || ['deposit', 'withdrawal', 'requiredMargin'].some(name => /^-/.test(preview.values[name]))) throw new Error('月末情報を再確認してください');
    if (!parser.equal(preview.values.netAssetValue, csv.sum([preview.values.cashBalance, preview.values.unrealizedPnl]))) throw new Error('純資産の照合が一致しません');
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
      const exact = rows(before, 'importBatches').find(row => row.accountId === accountId && row.sourceType === 'pdf'
        && row.sourceProvider === 'gmo' && row.sourceFileMetadata?.hash === source.fileHash);
      if (exact) return { status: 'already-imported' };
      const state = rows(before, 'monthlyAccountStates').find(row => row.accountId === accountId && row.targetMonth === preview.targetMonth);
      const previous = rows(before, 'accountSnapshots').filter(row => row.accountId === accountId && row.targetMonth === preview.targetMonth && row.sourceScope === policy.sourceScope);
      if (previous.length && !state) return { status: 'conflict', reason: 'unadopted' };
      return { status: state ? 'review-required' : 'ready', reason: state ? 'different-report' : null,
        source, preview, before, account, state };
    }
    function publicResult(prepared) {
      return { status: prepared.status, reason: prepared.reason || null,
        ...(prepared.state ? { stateId: prepared.state.id, adoptedSnapshotId: prepared.state.adoptedAccountSnapshotId } : {}) };
    }
    async function inspect(input) { return publicResult(prepare(input)); }
    async function save(input, confirmation = {}) {
      if (busy) return { status: 'busy' }; busy = true;
      try {
        const prepared = prepare(input);
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
        const changes = {};
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
