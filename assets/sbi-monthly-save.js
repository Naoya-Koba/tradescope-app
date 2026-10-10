(function (root) {
  'use strict';
  const storage = typeof module !== 'undefined' && module.exports ? require('./data-model-storage.js') : root.TradeScopeDataStorage;
  const resolver = typeof module !== 'undefined' && module.exports ? require('./monthly-account-resolver.js') : root.TradeScopeMonthlyResolver;
  const csv = typeof module !== 'undefined' && module.exports ? require('../import/csv-core.js') : root.TradeScopeCSV;
  const fields = Object.freeze({ foreignAssetValue: '外国証券の評価額を入力してください', foreignUnrealizedPnl: '外国証券の評価損益を入力してください',
    cashBalance: '現金・預り金を入力してください', realizedPnL: '実現損益がない場合は0を入力してください',
    deposit: '入金がない場合は0を入力してください', withdrawal: '出金がない場合は0を入力してください' });
  function createService(adapter, options = {}) {
    const clock = options.clock || (() => new Date().toISOString());
    const repo = storage.createRepository(adapter, { clock });
    const legacyData = () => {
      try { return JSON.parse(adapter.getItem('tradingData') || '{}'); }
      catch (_) { throw new Error('既存の月次データを読み取れません'); }
    };
    function prepare(draft, expectedModels) {
      if (!draft || !/^\d{4}-(0[1-9]|1[0-2])$/.test(draft.targetMonth) || draft.targetMonth < resolver.cutover) throw new Error('対象月が不正です');
      const models = repo.read();
      if (resolver.hasLegacyConflict(legacyData(), draft.targetMonth)) throw new Error('この月には従来方式のSBI入力が保存されています');
      const candidates = resolver.domesticCandidates(models, draft.targetMonth);
      if (candidates.length > 1) throw new Error('国内証券の取込候補が複数あります');
      if (!candidates.length) throw new Error('国内証券データを取り込んでください');
      const domestic = candidates[0];
      if (domestic.batch.id !== draft.domesticImportBatchId) throw new Error('保存前に国内証券データが変更されました');
      if (expectedModels && JSON.stringify(models) !== JSON.stringify(expectedModels)) throw new Error('保存前に国内証券データが変更されました');
      const account = models.accounts.records.find(row => row.id === resolver.accountId);
      if (!account?.enabled || account.providerCode !== 'sbi' || account.accountType !== 'securities') throw new Error('SBI証券の口座設定を確認してください');
      if (domestic.marketValue === null || domestic.unrealizedPnl === null || !domestic.batch.snapshotAsOf) throw new Error('国内証券の評価額・評価損益・取得日が不足しています');
      const values = {};
      for (const [field, message] of Object.entries(fields)) {
        try { values[field] = csv.decimal(draft[field]); } catch (_) { throw new Error(message); }
        if (values[field] === null || !/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(values[field])) throw new Error(message);
      }
      for (const [field, message] of [['foreignDate', '外国証券の取得日を入力してください'], ['cashDate', '現金の取得日を入力してください']]) {
        try { values[field] = csv.date(draft[field]); } catch (_) { throw new Error(message); }
        if (!values[field]) throw new Error(message);
      }
      return { models, domestic, values };
    }
    function save(draft, guard = {}) {
      const prepared = prepare(draft, guard.expectedModels), { models, domestic, values } = prepared;
      const now = clock(), current = (models.monthlyAccountStates?.records || []).find(row => row.accountId === resolver.accountId && row.targetMonth === draft.targetMonth);
      const snapshots = [...(models.accountSnapshots?.records || [])];
      function manual(scope, oldId, facts, date) {
        const existing = snapshots.find(row => row.id === oldId);
        if (existing && existing.sourceScope === scope && existing.snapshotAsOf === date
          && existing.observationType === 'approximateForMonth' && Object.keys(facts).every(field => existing[field] === facts[field])) return existing.id;
        const item = { id: storage.newId('as', options.crypto), accountId: resolver.accountId, targetMonth: draft.targetMonth,
          sourceMode: 'manual', sourceScope: scope, valuationCurrency: 'JPY', importedAt: now, snapshotAsOf: date,
          observationType: 'approximateForMonth', ...facts };
        snapshots.push(item); return item.id;
      }
      const state = { id: current?.id || storage.newId('mas', options.crypto), accountId: resolver.accountId,
        targetMonth: draft.targetMonth, confirmedAt: now, domesticImportBatchId: domestic.batch.id,
        foreignAccountSnapshotId: manual('sbi-foreign-securities', current?.foreignAccountSnapshotId,
          { assetValue: values.foreignAssetValue, unrealizedPnl: values.foreignUnrealizedPnl }, values.foreignDate),
        cashAccountSnapshotId: manual('sbi-cash', current?.cashAccountSnapshotId, { cashBalance: values.cashBalance }, values.cashDate),
        realizedPnl: values.realizedPnL, swapPnl: '0', deposit: values.deposit, withdrawal: values.withdrawal };
      const states = [...(models.monthlyAccountStates?.records || [])].filter(row => row.id !== state.id); states.push(state);
      const envelope = records => ({ schemaVersion: 1, records, updatedAt: now });
      // One journal protects both collections; validation and reread verification are Repository responsibilities.
      const verified = repo.commit({ accountSnapshots: envelope(snapshots), monthlyAccountStates: envelope(states) }, { expectedModels: models });
      let cacheInvalidated = true;
      try { adapter.removeItem('tradeScopeTopSummarySnapshotV1'); } catch (_) { cacheInvalidated = false; }
      // Canonical dependencies also invalidate fingerprints if cache removal was unavailable.
      return { status: 'saved', state, models: verified, cacheInvalidated };
    }
    return Object.freeze({ inspect: draft => prepare(draft), save });
  }
  const api = Object.freeze({ createService });
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TradeScopeSbiMonthlySave = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
