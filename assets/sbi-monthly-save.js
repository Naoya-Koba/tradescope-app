(function (root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const storage = node ? require('./data-model-storage.js') : root.TradeScopeDataStorage;
  const resolver = node ? require('./monthly-account-resolver.js') : root.TradeScopeMonthlyResolver;
  const csv = node ? require('../import/csv-core.js') : root.TradeScopeCSV;
  function createService(adapter, options = {}) {
    const clock = options.clock || (() => new Date().toISOString());
    const repo = storage.createRepository(adapter, {clock});
    function prepare(draft, expectedModels) {
      if (!draft || !/^\d{4}-(0[1-9]|1[0-2])$/.test(draft.targetMonth) || draft.targetMonth < resolver.cutover) throw Error('対象月が不正です');
      const models = repo.read();
      let legacy; try {legacy = JSON.parse(adapter.getItem('tradingData') || '{}');} catch (_) {throw Error('既存の月次データを読み取れません');}
      if (resolver.hasLegacyConflict(legacy, draft.targetMonth)) throw Error('この月には従来方式のSBI入力が保存されています');
      const candidates = resolver.domesticCandidates(models, draft.targetMonth);
      if (candidates.length > 1) throw Error('国内証券の取込候補が複数あります');
      if (!candidates.length) throw Error('国内証券データを取り込んでください');
      const domestic = candidates[0];
      if (domestic.batch.id !== draft.domesticImportBatchId || expectedModels && JSON.stringify(models) !== JSON.stringify(expectedModels)) throw Error('保存前に国内証券データが変更されました');
      const account = models.accounts.records.find(row => row.id === resolver.accountId);
      if (!account?.enabled || account.providerCode !== 'sbi' || account.accountType !== 'securities') throw Error('SBI証券の口座設定を確認してください');
      if (domestic.marketValue === null || domestic.unrealizedPnl === null || !domestic.batch.snapshotAsOf) throw Error('国内証券の評価額・評価損益・取得日が不足しています');
      const values = {};
      for (const field of ['domesticMarketValue','domesticUnrealizedPnl','foreignAssetValue','foreignUnrealizedPnl','cashBalance','realizedPnL','deposit','withdrawal']) {
        const value = draft[field] === undefined && field.startsWith('domestic')
          ? domestic[field === 'domesticMarketValue' ? 'marketValue' : 'unrealizedPnl'] : draft[field];
        try {values[field] = csv.decimal(value ?? null);} catch (_) {throw Error('金額を正しく入力してください');}
      }
      if (values.domesticMarketValue === null || values.domesticUnrealizedPnl === null) throw Error('国内証券の評価額・評価損益を入力してください');
      for (const field of ['foreignDate','cashDate']) {
        try {values[field] = csv.date(draft[field] || null);} catch (_) {throw Error('取得日を正しく入力してください');}
      }
      if ([values.foreignAssetValue,values.foreignUnrealizedPnl,values.foreignDate].some(v=>v!==null)
        && [values.foreignAssetValue,values.foreignUnrealizedPnl,values.foreignDate].some(v=>v===null)) throw Error('外国証券の評価額・評価損益・取得日を入力してください');
      if ((values.cashBalance === null) !== (values.cashDate === null)) throw Error('現金の残高・取得日を入力してください');
      const source = {marketValue: domestic.marketValue, unrealizedPnl: domestic.unrealizedPnl};
      const adopted = {marketValue:values.domesticMarketValue, unrealizedPnl:values.domesticUnrealizedPnl};
      const overrideFields = Object.keys(source).filter(field=>!storage.equalDecimal(source[field],adopted[field]));
      const current = models.monthlyAccountStates?.records.find(row=>row.accountId===resolver.accountId&&row.targetMonth===draft.targetMonth);
      const complete = ['foreignAssetValue','foreignUnrealizedPnl','foreignDate','cashBalance','cashDate','realizedPnL','deposit','withdrawal'].every(field=>values[field]!==null);
      if (current && !complete) throw Error('保存済みの月次項目は空欄にできません');
      if (!complete && !overrideFields.length && !models.monthlyAccountInputs?.records.some(row=>row.targetMonth===draft.targetMonth)
        && ['foreignAssetValue','cashBalance','realizedPnL','deposit','withdrawal'].every(field=>values[field]===null)) throw Error('外国証券の評価額を入力してください');
      return {models,domestic,values,source,adopted,overrideFields,current,complete};
    }
    function save(draft, guard = {}) {
      const p = prepare(draft,guard.expectedModels), {models,domestic,values,current} = p, now = clock();
      const oldInput = models.monthlyAccountInputs?.records.find(row=>row.accountId===resolver.accountId&&row.targetMonth===draft.targetMonth);
      const snapshots = [...(models.accountSnapshots?.records || [])];
      function manual(scope, oldId, facts, date) {
        if (date === null) return null;
        const existing = snapshots.find(row=>row.id===oldId);
        if (existing && existing.sourceScope===scope && existing.snapshotAsOf===date && Object.keys(facts).every(field=>existing[field]===facts[field])) return existing.id;
        const row = {id:storage.newId('as',options.crypto), accountId:resolver.accountId,targetMonth:draft.targetMonth,
          sourceMode:'manual',sourceScope:scope,valuationCurrency:'JPY',importedAt:now,snapshotAsOf:date,observationType:'approximateForMonth',...facts};
        snapshots.push(row);return row.id;
      }
      const input = {schemaVersion:1,id:oldInput?.id||storage.newId('mai',options.crypto),accountId:resolver.accountId,targetMonth:draft.targetMonth,
        domesticImportBatchId:domestic.batch.id,sourceValues:p.source,adoptedValues:p.adopted,overrideFields:p.overrideFields,overrideUpdatedAt:now,
        foreignAccountSnapshotId:manual('sbi-foreign-securities',oldInput?.foreignAccountSnapshotId||current?.foreignAccountSnapshotId,
          {assetValue:values.foreignAssetValue,unrealizedPnl:values.foreignUnrealizedPnl},values.foreignDate),
        cashAccountSnapshotId:manual('sbi-cash',oldInput?.cashAccountSnapshotId||current?.cashAccountSnapshotId,{cashBalance:values.cashBalance},values.cashDate),
        realizedPnl:values.realizedPnL,deposit:values.deposit,withdrawal:values.withdrawal};
      const env = records=>({schemaVersion:1,records,updatedAt:now});
      const changes = {monthlyAccountInputs:env([...(models.monthlyAccountInputs?.records||[]).filter(row=>row.id!==input.id),input])};
      if (JSON.stringify(snapshots)!==JSON.stringify(models.accountSnapshots?.records||[])) changes.accountSnapshots=env(snapshots);
      let state=null;
      if (p.complete) {
        state={id:current?.id||storage.newId('mas',options.crypto),accountId:resolver.accountId,targetMonth:draft.targetMonth,confirmedAt:now,
          domesticImportBatchId:input.domesticImportBatchId,foreignAccountSnapshotId:input.foreignAccountSnapshotId,cashAccountSnapshotId:input.cashAccountSnapshotId,
          realizedPnl:input.realizedPnl,swapPnl:'0',deposit:input.deposit,withdrawal:input.withdrawal};
        changes.monthlyAccountStates=env([...(models.monthlyAccountStates?.records||[]).filter(row=>row.id!==state.id),state]);
      }
      const verified=repo.commit(changes,{expectedModels:models,invalidateTopSummary:true});
      return {status:'saved',state,input,complete:p.complete,models:verified,cacheInvalidated:true};
    }
    return Object.freeze({inspect:draft=>prepare(draft),save});
  }
  const api=Object.freeze({createService});if(node)module.exports=api;else root.TradeScopeSbiMonthlySave=api;
})(typeof globalThis!=='undefined'?globalThis:this);
