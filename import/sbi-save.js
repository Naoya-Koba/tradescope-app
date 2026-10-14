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
  const reconciliation=typeof module!=='undefined'&&module.exports?require('../assets/transaction-reconciliation.js'):root.TradeScopeTransactionReconciliation;
  const view=typeof module!=='undefined'&&module.exports?require('../assets/transaction-view.js'):root.TradeScopeTransactionView;
  const monthlySources=typeof module!=='undefined'&&module.exports?require('../assets/monthly-source-service.js'):root.TradeScopeMonthlySourceService;
  const balances=typeof module!=='undefined'&&module.exports?require('../assets/sbi-balance-adoption.js'):root.TradeScopeSbiBalanceAdoption;
  const copy = value => JSON.parse(JSON.stringify(value));
  const records = (models, entity) => models[entity]?.records || [];
  const result = (status, reason) => ({ status, reason });

  // Explicit injected storage only. Reading/inspection never seeds application data.
  // Accept one Parser source, not a possibly stale/mutated save plan or a pair of files.
  function createService(adapter, options = {}) {
    const repository = model.createRepository(adapter);
    const clock = options.clock || (() => new Date().toISOString());
    const cryptoApi = options.cryptoApi || root.crypto;
    const sourceState=()=>monthlySources.createService(adapter).inspect();
    async function prepare(input) {
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
      let correctionCandidate=false;
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
      if (file.duplicateBatches.length) {
        const saved = records(before, 'importBatches').find(item => item.id === file.duplicateBatches[0]);
        return { ...result('already-imported', 'exact-file'), targetMonth: saved?.targetMonth ?? null,
          snapshotAsOf: saved?.snapshotAsOf ?? null, before, existingBatchId:saved?.id };
      }
      if (source.preview.kind === 'holdings') {
        const batchById = new Map(records(before, 'importBatches').map(item => [item.id, item]));
        const observationExists = records(before, 'holdingSnapshots').some(item =>
          item.accountId === preview.accountId && item.targetMonth === file.batch.targetMonth
          && item.snapshotAsOf === file.batch.snapshotAsOf && batchById.get(item.importBatchId)?.sourceType === 'csv');
        // Revised observations remain separate candidates. Released imports without a
        // registered candidate retain their conservative correction gate.
        const registered=records(before,'monthlySources').some(r=>r.kind==='adoption'&&r.decision==='adopt'&&r.accountId===preview.accountId
          &&r.component==='domestic'&&r.targetMonth===file.batch.targetMonth);
        if (observationExists&&!registered) return result('conflict', 'holding-observation');
        correctionCandidate=observationExists&&registered;
      }
      if (file.rows.some(row => row.duplicateCandidates.length)) return result('review-required', 'duplicate-transaction');
      if (file.issues.some(i=>!correctionCandidate||i.code!=='duplicate-observation') || file.rows.length !== source.preview.rows.length
        || file.rows.some(row => !row.saveEligible || row.issues.length)
        || planned.instruments.some(item => item.requiresConfirmation)) return result('review-required', 'validation');
      const entity = file.kind === 'holdings' ? 'holdingSnapshots' : 'rawTransactions';
      const drafts = file.kind === 'holdings' ? file.holdings : file.transactions;
      if (drafts.length !== source.preview.rows.length) return result('invalid', 'incomplete-file');

      return { status: 'ready', before, planned, account, file, entity, drafts };
    }
    async function inspect(input) {
      const prepared = await prepare(input);
      if(prepared.status==='already-imported')return reconciliation.inspect(adapter,prepared.before,view.activeSources(prepared.before).filter(s=>s.record.importBatchId===prepared.existingBatchId),{status:prepared.status,reason:prepared.reason,targetMonth:prepared.targetMonth,snapshotAsOf:prepared.snapshotAsOf});
      if(prepared.status!=='ready')return prepared;
      const models={...prepared.before,instruments:{records:[...records(prepared.before,'instruments'),...prepared.planned.instruments.filter(i=>i.status==='new').map(i=>i.record)]}};
      return reconciliation.inspect(adapter,models,prepared.entity==='rawTransactions'?prepared.drafts.map(record=>({entity:prepared.entity,record})):[],
        {...result('ready',null),...(prepared.entity==='holdingSnapshots'?{sourceFingerprint:sourceState().fingerprint}:{})});
    }
    async function save(input,confirmation={}) {
      const prepared = await prepare(input);
      if(prepared.status==='already-imported'){
        const changes={},checked=reconciliation.finish(adapter,prepared.before,changes,confirmation,clock(),()=>model.newId('tr',cryptoApi),view.activeSources(prepared.before).filter(s=>s.record.importBatchId===prepared.existingBatchId));
        if(checked.status!=='ready')return checked;
        if(Object.keys(changes).length){repository.commit(changes,{expectedModels:prepared.before,expectedManual:checked.expectedManual});return{status:'saved',reconciled:true};}
        return{status:prepared.status,reason:prepared.reason,targetMonth:prepared.targetMonth,snapshotAsOf:prepared.snapshotAsOf};
      }
      if (prepared.status !== 'ready') return prepared;
      const { before, planned, account, file, entity, drafts } = prepared;
      const sourceGuard=entity==='holdingSnapshots'?sourceState():null;
      if(sourceGuard&&JSON.stringify(sourceGuard.models)!==JSON.stringify(before))throw Error('保存データが変更されています。再確認してください');
      if(sourceGuard&&confirmation.sourceFingerprint&&confirmation.sourceFingerprint!==sourceGuard.fingerprint)
        return {status:'stale',reason:'source-adoption-changed',message:'データが更新されています。Previewを保持しています。採用情報を再確認してください。'};

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
      try {
        model.validateModels({ ...before, ...changes });
        if(entity==='holdingSnapshots'){
          const prospective={...before,...changes};
          const operation=balances.candidateOperation(prospective,file.batch.targetMonth,{importBatchId:file.batch.id});
          Object.assign(changes,monthlySources.buildChanges(prospective,operation,{at:importedAt,newId:()=>model.newId('ms',cryptoApi)}).changes);
        }
        model.validateModels({ ...before, ...changes });
      }
      catch (_) { return result('invalid', 'records'); }
      // Guard against concurrent writes during asynchronous matching. This is not multi-tab locking.
      // Repository verifies all persisted records/references before the shared journal is removed.
      const checked=reconciliation.finish(adapter,before,changes,confirmation,importedAt,()=>model.newId('tr',cryptoApi));
      if(checked.status!=='ready')return checked;
      repository.commit(changes, { expectedModels: before,expectedManual:checked.expectedManual,...(sourceGuard?{expectedLegacy:sourceGuard.legacy}:{}) });
      return { status: 'saved', importBatchId: file.batch.id, recordCount: drafts.length };
    }
    return Object.freeze({ read: () => repository.read(), inspect, save });
  }
  const api = Object.freeze({ createService });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TradeScopeSBISave = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
