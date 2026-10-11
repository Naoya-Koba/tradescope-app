(function(root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const storage = node ? require('./data-model-storage.js') : root.TradeScopeDataStorage;
  const resolver = node ? require('./monthly-account-resolver.js') : root.TradeScopeMonthlyResolver;
  const csv = node ? require('../import/csv-core.js') : root.TradeScopeCSV;
  const fields = storage.adoptionFields, policy = resolver.policies.gmo;
  function createService(adapter, options = {}) {
    const clock = options.clock || (() => new Date().toISOString());
    const repo = storage.createRepository(adapter, {clock});
    function inspect(targetMonth) {
      const models = repo.read();
      let legacy; try { legacy = JSON.parse(adapter.getItem('tradingData') || '{}'); }
      catch (_) { throw new Error('既存の月次データを読み取れません'); }
      const resolved = resolver.resolve(models, legacy, targetMonth, 'gmo');
      if (resolved.source !== 'canonical' || !resolved.completeness.complete) throw new Error('この月のGMO月次報告書を取り込んでください');
      const state = resolved.state, adopted = storage.adoptedValues(state, resolved.snapshot);
      const source = state.schemaVersion === 3 ? {...state.sourceValues} : {...adopted};
      return {models, state, snapshot: resolved.snapshot, source, adopted};
    }
    function save(draft, guard = {}) {
      const prepared = inspect(draft?.targetMonth), {models, state, snapshot, source, adopted} = prepared;
      if (guard.expectedModels && JSON.stringify(guard.expectedModels) !== JSON.stringify(models)) throw new Error('保存データが変更されています。再確認してください');
      const values = {};
      for (const field of fields) {
        try { values[field] = csv.decimal(draft[field]); } catch (_) { throw new Error('月次項目へ数値を入力してください'); }
        if (values[field] === null) throw new Error('空欄の項目を入力してください。金額がない場合は0を入力してください');
      }
      if (['deposit','withdrawal'].some(field => values[field].startsWith('-'))) throw new Error('入金・出金は0以上を入力してください');
      if (fields.every(field => storage.equalDecimal(values[field], adopted[field]))) return {status:'unchanged', state, models};
      const now = clock();
      const next = {...state, schemaVersion:3, confirmedAt:now, sourceValues:source,
        realizedPnl:values.realizedPnl, swapPnl:values.swapPnl, deposit:values.deposit, withdrawal:values.withdrawal,
        adoptedUnrealizedPnl:values.unrealizedPnl,
        overrideFields:fields.filter(field => !storage.equalDecimal(source[field], values[field])), overrideUpdatedAt:now};
      storage.adoptedValues(next, snapshot);
      const records = models.monthlyAccountStates.records.map(row => row.id === state.id ? next : row);
      const verified = repo.commit({monthlyAccountStates:{schemaVersion:1, records, updatedAt:now}},
        {expectedModels:models, invalidateTopSummary:true});
      return {status:'saved', state:next, models:verified};
    }
    return Object.freeze({inspect, save, sourceValues: targetMonth => inspect(targetMonth).source});
  }
  const api = Object.freeze({createService, fields, accountId:policy.accountId});
  if (node) module.exports = api; else root.TradeScopeGmoMonthlySave = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
