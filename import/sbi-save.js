(function (root) {
  'use strict';
  const model = typeof module !== 'undefined' && module.exports
    ? require('../assets/data-model-storage.js') : root.TradeScopeDataStorage;
  const transaction = typeof module !== 'undefined' && module.exports
    ? require('../assets/storage-transaction.js') : root.TradeScopeStorageTransaction;
  const preview = typeof module !== 'undefined' && module.exports
    ? require('./model-preview.js') : root.TradeScopeSBIModelPreview;
  const parser = typeof module !== 'undefined' && module.exports
    ? require('./sbi-parser.js') : root.TradeScopeSBI;
  const copy = value => JSON.parse(JSON.stringify(value));
  const records = (models, entity) => models[entity]?.records || [];
  const result = (status, reason) => ({ status, reason });

  // Explicit injected storage only. This module is not loaded by any application page.
  // Accept one Parser source, not a possibly stale/mutated save plan or a pair of files.
  function createService(adapter, options = {}) {
    const repository = model.createRepository(adapter);
    const clock = options.clock || (() => new Date().toISOString());
    const cryptoApi = options.cryptoApi || root.crypto;
    async function save(input) {
      if (adapter.getItem(transaction.journalKey) !== null) {
        throw new Error('未完了の復元ジャーナルが残っています。保存を停止しました');
      }
      let source;
      try {
        model.assertJson(input);
        source = copy(input); // Isolate the facts from changes while async matching runs.
        if (!['holdings', 'transactions'].includes(source.preview?.kind)
          || source.preview.parserVersion !== parser.version || !Array.isArray(source.preview.rows)
          || !source.preview.rows.length || !Array.isArray(source.preview.issues)
          || source.preview.rows.some(row => row.status !== 'valid')) return result('invalid', 'parser');
        if (source.preview.issues.some(item => item.severity === 'error')) return result('invalid', 'parser');
        if (source.preview.issues.length) return result('review-required', 'parser-warning');
      } catch (_) { return result('invalid', 'source'); }

      // Never treat corrupt Storage as an empty master. Storage read failures are surfaced.
      const before = repository.read();
      const account = records(before, 'accounts').find(item => item.id === preview.accountId);
      if (account && (!account.enabled || account.providerCode !== 'sbi' || account.accountType !== 'securities')) {
        return result('conflict', 'account');
      }
      let planned;
      try { planned = await preview.convert([source], before, preview.createSession(cryptoApi)); }
      catch (_) { return result('invalid', 'conversion'); }
      const file = planned.files[0];
      if (!file?.batch || file.batch.importerVersion !== parser.version) return result('invalid', 'batch');
      // A same-file no-op does not change dates, Parser metadata, IDs or any existing record.
      if (file.duplicateBatches.length) return result('already-imported', 'exact-file');
      if (source.preview.kind === 'holdings') {
        const batchById = new Map(records(before, 'importBatches').map(item => [item.id, item]));
        const observationExists = records(before, 'holdingSnapshots').some(item =>
          item.accountId === preview.accountId && item.targetMonth === file.batch.targetMonth
          && item.snapshotAsOf === file.batch.snapshotAsOf && batchById.get(item.importBatchId)?.sourceType === 'csv');
        if (observationExists) return result('conflict', 'holding-observation');
      }
      if (file.rows.some(row => row.duplicateCandidates.length)) return result('review-required', 'duplicate-transaction');
      if (file.issues.length || file.rows.length !== source.preview.rows.length
        || file.rows.some(row => !row.saveEligible || row.issues.length)
        || planned.instruments.some(item => item.requiresConfirmation)) return result('review-required', 'validation');
      const entity = file.kind === 'holdings' ? 'holdingSnapshots' : 'rawTransactions';
      const drafts = file.kind === 'holdings' ? file.holdings : file.transactions;
      if (drafts.length !== source.preview.rows.length) return result('invalid', 'incomplete-file');

      // Generate the actual save timestamp only now, not at Preview time.
      const importedAt = clock();
      const changes = {};
      const append = (name, added) => {
        if (added.length) changes[name] = { schemaVersion: 1,
          records: [...copy(records(before, name)), ...copy(added)], updatedAt: importedAt };
      };
      if (!account) append('accounts', [planned.account.record]);
      append('instruments', planned.instruments.filter(item => item.status === 'new').map(item => item.record));
      append('importBatches', [{ ...file.batch, importedAt }]);
      append(entity, drafts.map(item => ({ ...item, importedAt })));
      try { model.validateModels({ ...before, ...changes }); }
      catch (_) { return result('invalid', 'records'); }
      // Guard against concurrent writes during asynchronous matching. This is not multi-tab locking.
      // Repository verifies all persisted records/references before the shared journal is removed.
      repository.commit(changes, { expectedModels: before });
      return { status: 'saved', importBatchId: file.batch.id, recordCount: drafts.length };
    }
    return Object.freeze({ read: () => repository.read(), save });
  }
  const api = Object.freeze({ createService });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TradeScopeSBISave = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
