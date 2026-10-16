(function (root) {
  'use strict';
  const storage = typeof module !== 'undefined' && module.exports ? require('./data-model-storage.js') : root.TradeScopeDataStorage;
  const csv = typeof module !== 'undefined' && module.exports ? require('../import/csv-core.js') : root.TradeScopeCSV;
  const sources = typeof module !== 'undefined' && module.exports ? require('./monthly-source-contract.js') : root.TradeScopeMonthlySourceContract;
  const sbiBalances = typeof module !== 'undefined' && module.exports ? require('./sbi-balance-adoption.js') : root.TradeScopeSbiBalanceAdoption;
  const sbiPeriod = typeof module !== 'undefined' && module.exports ? require('./sbi-period-input.js') : root.TradeScopeSbiPeriodInput;
  const lightScalars = typeof module !== 'undefined' && module.exports ? require('./lightfx-scalar-adoption.js') : root.TradeScopeLightScalarAdoption;
  const cashflow = typeof module !== 'undefined' && module.exports ? require('./cashflow-view.js') : root.TradeScopeCashflowView;
  const accountId = 'acc_sbi_sec', cutover = '2026-09', calculationVersion = 'monthly-ledger-v4';
  const policyVersion = 'monthly-policies-v3';
  const sourceAdapterVersion='monthly-source-adapter-v8';
  const policies = Object.freeze({
    sbi: Object.freeze({ accountId, cutover, adapter: 'sbi' }),
    gmo: Object.freeze({ accountId: 'acc_gmo_fx', cutover: '2026-09', adapter: 'official-account',
      sourceScope: 'gmo-fx-monthly-report', sourceMode: 'imported', observationType: 'officialMonthEnd', valuationCurrency: 'JPY' }),
    lightfx:Object.freeze({accountId:'acc_lightfx_fx',cutover:'2026-09',adapter:'official-account',sourceScope:'lightfx-monthly-report',sourceMode:'imported',observationType:'officialMonthEnd',valuationCurrency:'JPY'}),
    minano:Object.freeze({accountId:'acc_minna_fx',cutover:'2026-09',adapter:'official-account',sourceScope:'minna-monthly-report',sourceMode:'imported',observationType:'officialMonthEnd',valuationCurrency:'JPY',provider:'minna'})
  });
  const defaultEnabledKeys = Object.freeze(['sbi', 'gmo', 'lightfx', 'minano']);
  const records = (models, entity) => models?.[entity]?.records || [];
  const monthKey = (year, month) => `${year}-${String(month).padStart(2, '0')}`;
  const decimal = value => typeof value === 'string' && /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value);
  const sum = values => values.length && values.every(decimal) ? csv.sum(values) : null;
  const number = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
  const total = values => values.every(Number.isFinite) ? values.reduce((a, b) => a + b, 0) : null;

  // Only direct monthly inputs are evidence; generated holdings/netAssets/unrealized are not.
  // A global __saved flag can belong to another account, so it cannot make SBI's zero placeholder meaningful.
  function hasLegacyConflict(tradingData, targetMonth, key = 'sbi') {
    const [year, month] = targetMonth.split('-').map(Number);
    const row = tradingData?.[year]?.[month]?.[key] || {};
    return ['realizedPnL', 'swapPnL', 'deposit', 'withdrawal', ...(key !== 'sbi' ? ['unrealizedPnL'] : [])].some(field => {
      const value = row[field];
      return (typeof value === 'number' || typeof value === 'string' && value.trim() !== '')
        && Number.isFinite(Number(value)) && Number(value) !== 0;
    }) || ['lightfx','minano'].includes(key) && Array.isArray(row.unrealizedLegs) && row.unrealizedLegs.some(value=>
      value!==null&&value!==''&&Number.isFinite(Number(value))&&Number(value)!==0);
  }

  function domesticCandidates(models, targetMonth) {
    const holdings = records(models, 'holdingSnapshots').filter(row => row.accountId === accountId
      && row.targetMonth === targetMonth && row.sourceMode === 'imported' && row.sourceScope === 'sbi-domestic-holdings');
    const batches = records(models, 'importBatches').filter(batch => batch.accountId === accountId
      && batch.targetMonth === targetMonth && batch.sourceType === 'csv' && batch.sourceProvider === 'sbi'
      && holdings.some(row => row.importBatchId === batch.id));
    return batches.map(batch => {
      const rows = holdings.filter(row => row.importBatchId === batch.id);
      const jpy = rows.every(row => row.currency == null || row.currency === 'JPY');
      return { batch, holdings: rows, marketValue: jpy ? sum(rows.map(row => row.marketValue)) : null,
        unrealizedPnl: jpy ? sum(rows.map(row => row.unrealizedPnl)) : null };
    });
  }

  function domesticAdoption(models, targetMonth, domestic) {
    const input = records(models, 'monthlyAccountInputs').find(row => row.accountId === accountId && row.targetMonth === targetMonth);
    if (!input || input.domesticImportBatchId !== domestic?.batch.id || !decimal(domestic?.marketValue) || !decimal(domestic?.unrealizedPnl)
      || !storage.equalDecimal(input.sourceValues.marketValue, domestic.marketValue)
      || !storage.equalDecimal(input.sourceValues.unrealizedPnl, domestic.unrealizedPnl)) return domestic;
    return {...domestic, sourceMarketValue: domestic.marketValue, sourceUnrealizedPnl: domestic.unrealizedPnl,
      marketValue: input.adoptedValues.marketValue, unrealizedPnl: input.adoptedValues.unrealizedPnl};
  }
  function resolveSbi(models, tradingData, targetMonth, key = 'sbi') {
    if (key !== 'sbi' || targetMonth < cutover) return { source: 'legacy' };
    const base = { source: 'missing', confirmed: false, completeness: { monthly: false, observation: false, complete: false },
      realizedPnl: null, swapPnl: null, deposit: null, withdrawal: null, unrealizedPnl: null,
      observedAsset: null, observedUnrealized: null, adoptedIds: {}, state: null };
    if (hasLegacyConflict(tradingData, targetMonth)) return { ...base, source: 'conflict' };
    const state = records(models, 'monthlyAccountStates').find(row => row.accountId === accountId && row.targetMonth === targetMonth);
    if (!state) return base;
    const domestic = domesticAdoption(models, targetMonth, domesticCandidates(models, targetMonth).find(item => item.batch.id === state.domesticImportBatchId));
    const snapshots = records(models, 'accountSnapshots');
    const foreign = snapshots.find(row => row.id === state.foreignAccountSnapshotId);
    const cash = snapshots.find(row => row.id === state.cashAccountSnapshotId);
    const manualValid = (row, scope) => row?.accountId === accountId && row.targetMonth === targetMonth
      && row.sourceMode === 'manual' && row.sourceScope === scope && row.valuationCurrency === 'JPY' && Boolean(row.snapshotAsOf);
    const foreignValid = manualValid(foreign, 'sbi-foreign-securities'), cashValid = manualValid(cash, 'sbi-cash');
    const balance=sbiBalances.resolve(models,targetMonth,{validate:false});
    const observedUnrealized = foreignValid ? balance.unrealizedPnl : null;
    const observedAsset = foreignValid && cashValid ? balance.observedAsset : null;
    const monthly = ['realizedPnl', 'deposit', 'withdrawal'].every(field => decimal(state[field])) && state.swapPnl === '0';
    const observation = observedAsset !== null && observedUnrealized !== null && Boolean(domestic?.batch.snapshotAsOf);
    return { ...base, source: 'canonical', confirmed: true, state, domestic, foreign, cash,
      realizedPnl: state.realizedPnl, swapPnl: state.swapPnl === '0' ? '0' : null, deposit: state.deposit, withdrawal: state.withdrawal,
      unrealizedPnl: observedUnrealized, observedAsset, observedUnrealized,
      completeness: { monthly, observation, complete: monthly && observation },
      adoptedIds: { stateId: state.id, domesticImportBatchId: state.domesticImportBatchId,
        foreignAccountSnapshotId: state.foreignAccountSnapshotId, cashAccountSnapshotId: state.cashAccountSnapshotId } };
  }

  function resolveExisting(models, tradingData, targetMonth, key = 'sbi', enabledKeys = defaultEnabledKeys) {
    const policy = policies[key];
    if (!policy || !enabledKeys.includes(key) || targetMonth < policy.cutover) return { source: 'legacy' };
    if (policy.adapter === 'sbi') return resolveSbi(models, tradingData, targetMonth);
    const base = { source: 'missing', confirmed: false, state: null, adoptedIds: {},
      completeness: { monthly: false, observation: false, complete: false },
      realizedPnl: null, swapPnl: null, deposit: null, withdrawal: null, unrealizedPnl: null, observedAsset: null, observedUnrealized: null };
    if (hasLegacyConflict(tradingData, targetMonth, key)) return { ...base, source: 'conflict' };
    const states = records(models, 'monthlyAccountStates').filter(row => row.accountId === policy.accountId && row.targetMonth === targetMonth);
    if (!states.length) return base;
    if (states.length !== 1) return { ...base, source: 'conflict' };
    const state = states[0], snapshot = records(models, 'accountSnapshots').find(row => row.id === state.adoptedAccountSnapshotId);
    const batch = records(models, 'importBatches').find(row => row.id === snapshot?.importBatchId);
    const monthEnd = new Date(Date.UTC(Number(targetMonth.slice(0, 4)), Number(targetMonth.slice(5)), 0)).toISOString().slice(0, 10);
    if (![2, 3, 4].includes(state.schemaVersion) || !snapshot || snapshot.accountId !== policy.accountId || snapshot.targetMonth !== targetMonth
      || ['sourceScope', 'sourceMode', 'observationType', 'valuationCurrency'].some(field => snapshot[field] !== policy[field])
      || snapshot.snapshotAsOf !== monthEnd || !batch || batch.accountId !== policy.accountId || batch.targetMonth !== targetMonth
      || batch.snapshotAsOf !== snapshot.snapshotAsOf || batch.importedAt !== snapshot.importedAt || batch.sourceType !== 'pdf'
      || batch.sourceProvider !== (policy.provider||key) || !decimal(snapshot.reportedMonthlyRealizedPnl) || !decimal(state.realizedPnl)) return { ...base, source: 'conflict' };
    // Validation is independent of floating-point conversion, including signed values.
    let adopted;
    try { adopted = storage.adoptedValues(state, snapshot); } catch (_) { return {...base, source: 'conflict'}; }
    const monthly = ['realizedPnl', 'swapPnl', 'deposit', 'withdrawal'].every(field => decimal(state[field]));
    const observation = decimal(snapshot.unrealizedPnl) && decimal(snapshot.netAssetValue);
    return { ...base, source: 'canonical', confirmed: true, state, snapshot, batch,
      ...Object.fromEntries(['realizedPnl', 'swapPnl', 'deposit', 'withdrawal'].map(field => [field, state[field]])),
      unrealizedPnl: adopted.unrealizedPnl, observedAsset: snapshot.netAssetValue, observedUnrealized: snapshot.unrealizedPnl,
      completeness: { monthly, observation, complete: monthly && observation },
      adoptedIds: { stateId: state.id, adoptedAccountSnapshotId: snapshot.id, importBatchId: batch.id } };
  }

  const sourceAccountIds={...Object.fromEntries(Object.entries(policies).map(([key,p])=>[key,p.accountId])),sbivc:'acc_sbivc_crypto',smbc:'acc_smbc_bank'};
  function sourceValues(models,targetMonth,key){return sources.month(models,sourceAccountIds[key],targetMonth);}
  function resolveCore(models,tradingData,targetMonth,key='sbi',enabledKeys=defaultEnabledKeys){
    let base=resolveExisting(models,tradingData,targetMonth,key,enabledKeys);
    const existing=records(models,'monthlyAccountStates').find(r=>r.accountId===sourceAccountIds[key]&&r.targetMonth===targetMonth)
      ??records(models,'monthlyAccountInputs').find(r=>r.accountId===sourceAccountIds[key]&&r.targetMonth===targetMonth);
    // Defer is not a command to revoke the explicit adoption in a released contract.
    const values=sourceValues(models,targetMonth,key).filter(v=>!(key==='sbi'&&targetMonth>=cutover&&sbiBalances.targets.some(t=>t.component===v.component&&t.metric===v.metric&&v.currency==='JPY')))
      .filter(v=>!(v.status==='unresolved'&&v.deferred&&existing));
    if(!values.length)return base;
    // Partial Input already contains explicitly adopted values even without a complete State.
    // Overlay only the new metric; do not discard those compatible known values.
    if(base.source==='missing'&&existing?.schemaVersion===2&&existing.adoptedValues){
      const snapshot=records(models,'accountSnapshots').find(r=>r.id===existing.adoptedAccountSnapshotId);
      base={...base,...existing.adoptedValues,source:'canonical',snapshot,
        observedAsset:snapshot?.netAssetValue??null,observedUnrealized:snapshot?.unrealizedPnl??null};
    }else if(base.source==='missing'&&key==='sbi'&&existing?.schemaVersion===1){
      const domestic=domesticAdoption(models,targetMonth,domesticCandidates(models,targetMonth).find(c=>c.batch.id===existing.domesticImportBatchId));
      const snapshots=records(models,'accountSnapshots'),foreign=snapshots.find(s=>s.id===existing.foreignAccountSnapshotId),cash=snapshots.find(s=>s.id===existing.cashAccountSnapshotId);
      base={...base,source:'canonical',domestic,foreign,cash,realizedPnl:existing.realizedPnl,deposit:existing.deposit,withdrawal:existing.withdrawal,
        unrealizedPnl:sum([domestic?.unrealizedPnl??null,foreign?.unrealizedPnl??null])};
    }
    const bad=values.some(v=>['stale','conflict','unresolved'].includes(v.status));
    const assetRows=sources.assetComponents(values.filter(v=>v.currency==='JPY'));
    if(!values.some(v=>sources.flowMetrics.includes(v.metric)||v.metric==='unrealizedPnl'))return {...base,
      ...(bad&&key!=='sbivc'?{source:'conflict',confirmed:false,completeness:{monthly:false,observation:false,complete:false}}:{}),sourceAdoptions:values,
      ...(key==='sbivc'?{balanceOnlyAdoption:true}:{}),
      observedAsset:assetRows.length?sum(assetRows.map(v=>v.value)):base.observedAsset??null};
    const old=base.source==='legacy'?tradingData?.[Number(targetMonth.slice(0,4))]?.[Number(targetMonth.slice(5))]?.[key]??{}:base;
    const names={realizedPnl:'realizedPnL',swapPnl:'swapPnL',deposit:'deposit',withdrawal:'withdrawal',unrealizedPnl:'unrealizedPnL'};
    const adopted={};
    for(const [metric,legacyField]of Object.entries(names)){
      const matches=values.filter(v=>v.metric===metric&&v.currency==='JPY');
      if(matches.length){
        const items=matches.map(v=>v.status==='adopted'&&decimal(v.value)?v.value:null);
        if(metric==='unrealizedPnl'&&key==='sbi'&&base.source==='canonical'&&!matches.some(v=>v.component==='account')){
          for(const [component,value]of [['domestic',base.domestic?.unrealizedPnl],['foreign',base.foreign?.unrealizedPnl]])if(!matches.some(v=>v.component===component))items.push(value??null);
        }
        adopted[metric]=sum(items);
      }
      else adopted[metric]=base.source==='legacy'?(number(old[legacyField])===null||number(old[legacyField])===0&&old.__saved!==true?null:String(old[legacyField])):old[metric]??null;
    }
    const balances=sources.assetComponents(values.filter(v=>v.currency==='JPY')),asset=sum(balances.map(v=>v.value));
    const monthly=!bad&&(key==='smbc'?decimal(asset):['realizedPnl','swapPnl','deposit','withdrawal'].every(f=>decimal(adopted[f])));
    const observation=!bad&&(key==='smbc'?decimal(asset):decimal(adopted.unrealizedPnl));
    return {...base,...adopted,source:bad?'conflict':'canonical',sourceAdoptions:values,observedAsset:balances.length?asset:base.observedAsset??null,
      confirmed:monthly,completeness:{monthly,observation,complete:monthly&&observation}};
  }

  function resolve(models,tradingData,targetMonth,key='sbi',enabledKeys=defaultEnabledKeys){
    let base=resolveCore(models,tradingData,targetMonth,key,enabledKeys);
    if(['lightfx','minano'].includes(key)&&targetMonth>=policies[key].cutover&&models!==null&&enabledKeys.includes(key)){
      const balance=lightScalars.forBroker(key).resolve(models,targetMonth,{validate:false});
      if(!balance.hasCommon)return base;
      const input=records(models,'monthlyAccountInputs').find(r=>r.accountId===policies[key].accountId&&r.targetMonth===targetMonth);
      const swap=base.sourceAdoptions?.find(v=>v.metric==='swapPnl'&&v.currency==='JPY');
      const calendar=swap?swap.status==='adopted'&&swap.source?.sourceType==='manual'
        :(input??base.state)?.fieldSources?.swapPnl==='manual-income-calendar-swap-accrual';
      const blocked=balance.blocked||base.source==='conflict';
      const monthly=!blocked&&calendar&&['realizedPnl','swapPnl','deposit','withdrawal'].every(f=>decimal(base[f]));
      const observedAsset=balance.metrics[0].hasCommon?balance.observedAsset:base.observedAsset;
      const observation=!blocked&&decimal(balance.unrealizedPnl)&&decimal(observedAsset);
      return {...base,tradersScalars:balance,...(key==='lightfx'?{lightScalars:balance}:{}),source:blocked?'conflict':'canonical',confirmed:monthly,
        observedAsset,unrealizedPnl:balance.unrealizedPnl,observedUnrealized:balance.unrealizedPnl,
        ...(calendar?{}:{swapPnl:null}),completeness:{monthly,observation,complete:monthly&&observation}};
    }
    if(key!=='sbi'||targetMonth<cutover||models===null||!enabledKeys.includes(key))return base;
    // createCalculator validates the shared models once; this pure read facade also
    // preserves the old direct resolver's missing-fact diagnostics.
    const balance=sbiBalances.resolve(models,targetMonth,{validate:false});
    if(!balance.hasCommon)return {...base,sbiBalances:balance};
    const values=sourceValues(models,targetMonth,key);
    const periodInput=sbiPeriod.build({models,targetMonth,balance,base,sourceAdoptions:values});
    return {...base,sbiBalances:balance,sourceAdoptions:values,balanceOnlyAdoption:!values.some(v=>sources.flowMetrics.includes(v.metric)||v.component==='account'&&v.metric==='unrealizedPnl'),
      source:periodInput.conflict?'conflict':'canonical',confirmed:periodInput.monthly,periodInput,
      ...Object.fromEntries(['realizedPnl','swapPnl','deposit','withdrawal','unrealizedPnl','observedAsset','observedUnrealized'].map(k=>[k,periodInput[k]])),
      completeness:{monthly:periodInput.monthly,observation:periodInput.observation,complete:periodInput.complete}};
  }

  function dependencies(models, year, enabledKeys = defaultEnabledKeys) {
    const enabledAccounts = enabledKeys.map(key => policies[key]?.accountId);
    const states = records(models, 'monthlyAccountStates').filter(row => enabledAccounts.includes(row.accountId) && row.targetMonth.startsWith(`${year}-`));
    const inputs=records(models,'monthlyAccountInputs').filter(row=>enabledAccounts.includes(row.accountId)&&row.targetMonth.startsWith(`${year}-`));
    const batchIds = new Set([...states,...inputs].map(row => row.domesticImportBatchId));
    const snapshotIds = new Set([...states,...inputs].flatMap(row => [row.foreignAccountSnapshotId, row.cashAccountSnapshotId, row.adoptedAccountSnapshotId]));
    for (const snapshot of records(models, 'accountSnapshots')) if (snapshotIds.has(snapshot.id)) batchIds.add(snapshot.importBatchId);
    return { calculationVersion, policyVersion, sourceVersion:sources.version,sourceAdapterVersion,periodInputVersion:sbiPeriod.version,
      sourceRecords:records(models,'monthlySources').filter(r=>r.targetMonth?.startsWith(`${year}-`)||r.kind==='override'||r.kind==='comparison'),
      policies: enabledKeys.map(key => policies[key]), states,
      inputs: records(models, 'monthlyAccountInputs').filter(row => enabledAccounts.includes(row.accountId) && row.targetMonth.startsWith(`${year}-`)),
      batches: records(models, 'importBatches').filter(row => batchIds.has(row.id)),
      holdings: records(models, 'holdingSnapshots').filter(row => batchIds.has(row.importBatchId)),
      snapshots: records(models, 'accountSnapshots').filter(row => snapshotIds.has(row.id)) };
  }

  // DOM/storage-free facade. Old months and all other accounts retain the existing formulas.
  function createCalculator(legacy, tradingData, initialFunds, initialUnrealized, models, options = {}) {
    if (models !== null) storage.validateModels(models);
    const yearData = year => tradingData?.[year] || {};
    const oldRow = (year, month, key) => yearData(year)?.[month]?.[key] || {};
    const enabledKeys = options.enabledKeys || defaultEnabledKeys;
    const explicitMonths=(year,key)=>sources.heads(records(models,'monthlySources')).filter(r=>r.accountId===sourceAccountIds[key]&&r.targetMonth.startsWith(`${year}-`)
      &&(sources.flowMetrics.includes(r.metric)||r.metric==='unrealizedPnl')).map(r=>Number(r.targetMonth.slice(5)));
    const usesCanonical = (year, month, key) => (enabledKeys.includes(key) && policies[key] && monthKey(year, month) >= policies[key].cutover)
      ||explicitMonths(year,key).some(m=>m<=month);
    const read = (year, month, key) => models === null && usesCanonical(year, month, key)
      ? { source: 'conflict', confirmed: false, completeness: { monthly: false, observation: false, complete: false } }
      : resolve(models, tradingData, monthKey(year, month), key, enabledKeys);
    function row(year, month, key) {
      const resolved = read(year, month, key);
      if (resolved.source === 'legacy') return oldRow(year, month, key);
      if (resolved.source !== 'canonical') return {};
      return { realizedPnL: resolved.realizedPnl, swapPnL: resolved.swapPnl, deposit: resolved.deposit,
        withdrawal: resolved.withdrawal, unrealizedPnL: resolved.unrealizedPnl };
    }
    function entered(year, month, key) {
      const resolved = read(year, month, key);
      return resolved.source === 'legacy' ? legacy.isAccountMonthEntered(yearData(year), month, key)
        : resolved.source === 'canonical' && resolved.completeness.monthly;
    }
    function monthEntered(year, month, keys) {
      if (!keys.some(key => usesCanonical(year, month, key))) return legacy.isMonthEntered(yearData(year), month, keys);
      return keys.some(key => entered(year, month, key));
    }
    function latestMonth(year, keys) {
      for (let month = 12; month > 0; month--) if (monthEntered(year, month, keys)) return month;
      return null;
    }
    function monthlyFieldTotal(year, month, keys, field) {
      if (['deposit','withdrawal'].includes(field)) keys=cashflow.accountKeys(keys);
      if (!monthEntered(year, month, keys)) return null;
      for (const key of keys.filter(key => usesCanonical(year, month, key))) {
        const resolved = read(year, month, key);
        if (resolved.source !== 'legacy' && (resolved.source !== 'canonical' || !resolved.completeness.monthly || number(row(year, month, key)[field]) === null)) return null;
      }
      const values = keys.map(key => number(row(year, month, key)[field])).filter(value => value !== null);
      return values.length ? total(values) : null;
    }
    function confirmed(year, month, key) {
      if(key==='smbc'){
        const observation=cashflow.bankObservation(tradingData,models,monthKey(year,month));
        // Explicit balances, including zero, are authoritative. No cumulative stale deltas.
        if(observation.explicit)return number(observation.value);
        // Read-only compatibility for old periods with no explicit observation.
        return legacy.calculateAccountConfirmedAssets(tradingData,initialFunds,year,month,key);
      }
      if (!usesCanonical(year, month, key)) return legacy.calculateAccountConfirmedAssets(tradingData, initialFunds, year, month, key);
      const [cutoverYear,cutoverMonth]=(policies[key]?.cutover??`${year}-12`).split('-').map(Number);
      const start=Math.min(Number(year)===cutoverYear?cutoverMonth:1,...explicitMonths(year,key));
      let value = start>1 ? legacy.calculateAccountConfirmedAssets(tradingData, initialFunds, year, start - 1, key)
        : Number(initialFunds?.[year]?.[key]) || 0;
      const derivedInput=key==='sbi'&&read(year,month,key).periodInput?.flowSource?.entity==='monthlyAccountInputs';
      if((explicitMonths(year,key).length||derivedInput)&&(!Number.isFinite(value)||number(initialFunds?.[year]?.[key])===null))return null;
      for (let m = start; m <= month; m++) {
        const resolved = read(year, m, key);
        if(resolved.source==='legacy'){
          const data=oldRow(year,m,key);value+=(number(data.realizedPnL)??0)+(number(data.swapPnL)??0)+(number(data.deposit)??0)-(number(data.withdrawal)??0);continue;
        }
        if (!resolved.completeness.monthly || resolved.source !== 'canonical') return null;
        value += Number(resolved.realizedPnl) + Number(resolved.swapPnl) + Number(resolved.deposit) - Number(resolved.withdrawal);
      }
      return Number.isFinite(value) ? value : null;
    }
    function net(year, month, key) {
      if (key === 'smbc') return confirmed(year, month, key);
      if (!usesCanonical(year, month, key)) return legacy.calculateAccountNetAssets(tradingData, initialFunds, year, month, key);
      const value = confirmed(year, month, key), resolved = read(year, month, key);
      const unrealized=resolved.source==='legacy'?number(oldRow(year,month,key).unrealizedPnL):number(resolved.unrealizedPnl);
      return Number.isFinite(value)&&unrealized!==null ? value+unrealized:null;
    }
    function flows(year, month, keys) {
      let deposit = 0, withdrawal = 0;
      for (let m = 1; m <= month; m++) for (const key of cashflow.accountKeys(keys)) {
        const resolved=read(year,m,key);
        if (usesCanonical(year, m, key) && resolved.source!=='legacy' && !resolved.completeness.monthly) return { deposit: null, withdrawal: null };
        const data = row(year, m, key);
        deposit += number(data.deposit) ?? 0; withdrawal += number(data.withdrawal) ?? 0;
      }
      return { deposit, withdrawal };
    }
    function initial(year, keys, unrealized = false) {
      return keys.reduce((value, key) => value + (Number(initialFunds?.[year]?.[key]) || 0)
        + (unrealized ? Number(initialUnrealized?.[year]?.[key]) || 0 : 0), 0);
    }
    function performance(year, month, keys) {
      const flow = flows(year, month, keys), c = total(keys.map(key => confirmed(year, month, key))), n = total(keys.map(key => net(year, month, key)));
      return { confirmed: Number.isFinite(c) && Number.isFinite(flow.deposit) ? c - initial(year, keys) - flow.deposit + flow.withdrawal : null,
        net: Number.isFinite(n) && Number.isFinite(flow.deposit) ? n - initial(year, keys, true) - flow.deposit + flow.withdrawal : null };
    }
    function yearlyTotals(year, keys) {
      const last = latestMonth(year, keys), result = {};
      for (const [name, field] of [['realizedSum', 'realizedPnL'], ['swapSum', 'swapPnL'], ['depositSum', 'deposit'], ['withdrawSum', 'withdrawal']]) {
        let value = 0, found = false, missing = false;
        for (let month = 1; month <= (last || 0); month++) {
          if (keys.some(key => usesCanonical(year, month, key) && !read(year, month, key).completeness.monthly)) missing = true;
          const item = monthlyFieldTotal(year, month, keys, field);
          if (Number.isFinite(item)) { value += item; found = true; }
        }
        result[name] = found && !missing ? value : null;
      }
      return result;
    }
    function fingerprint(year) {
      const source = JSON.stringify([legacy.createYearSourceFingerprint(tradingData, initialFunds, initialUnrealized, year), dependencies(models, year, enabledKeys), models === null,
        cashflow.version,cashflow.bank(tradingData,models,monthKey(year,1))]);
      let hash = 2166136261;
      for (let index = 0; index < source.length; index++) { hash ^= source.charCodeAt(index); hash = Math.imul(hash, 16777619); }
      return `${calculationVersion}-${(hash >>> 0).toString(16)}`;
    }
    function snapshot(year, accounts) {
      const keys = accounts.map(account => account.key), growth = accounts.filter(account => !account.bankOnly).map(account => account.key);
      const last = latestMonth(year, keys); if (!last) return null;
      const realized = [], equity = [], pConfirmed = [0], pTotal = [0];
      for (let month = 1; month <= 12; month++) {
        const isEntered = monthEntered(year, month, keys), p = performance(year, month, growth);
        realized.push(isEntered ? total(keys.map(key => confirmed(year, month, key))) : null);
        equity.push(isEntered ? total(keys.map(key => net(year, month, key))) : null);
        pConfirmed.push(isEntered ? p.confirmed : null); pTotal.push(isEntered ? p.net : null);
      }
      const flow = flows(year, last, growth);
      return { year: Number(year), month: last, realized, total: equity,
        accountData: accounts.map(account => ({ label: account.name, color: account.color,
          amount: net(year, last, account.key) })).filter(item => Number.isFinite(item.amount) && item.amount > 0),
        chartStartTotal: initial(year, keys), chartStartTotalWithUnrealized: initial(year, keys, true),
        yearStartConfirmed: initial(year, growth), yearStartTotal: initial(year, growth, true),
        growthCurrentConfirmed: total(growth.map(key => confirmed(year, last, key))), growthCurrentTotal: total(growth.map(key => net(year, last, key))),
        cumulativeDeposits: flow.deposit, cumulativeWithdrawals: flow.withdrawal,
        performanceConfirmedSeries: pConfirmed, performanceTotalSeries: pTotal,
        sourceFingerprint: fingerprint(year) };
    }
    return Object.freeze({ resolve: read, row, entered, monthEntered, latestMonth, monthlyFieldTotal, confirmed, net, flows,
      totalConfirmed: (year, month, keys) => total(keys.map(key => confirmed(year, month, key))),
      totalNet: (year, month, keys) => total(keys.map(key => net(year, month, key))),
      initial, performance, yearlyTotals, fingerprint, snapshot,
      warning: year => models === null ? '取込データを確認できません'
        : enabledKeys.some(key => Array.from({ length: 12 }, (_, index) => index + 1).some(month => read(year, month, key).source === 'conflict'))
        ? '従来入力または採用データが一致しない月は集計できません' : '',
      snapshotCurrent: (value, year, keys) => Boolean(value && value.sourceFingerprint === fingerprint(year)
        && value.month === latestMonth(year, keys) && monthEntered(year, value.month, keys)) });
  }
  const api = Object.freeze({ accountId, cutover, calculationVersion, policyVersion, policies, hasLegacyConflict, domesticCandidates, domesticAdoption, resolve, dependencies, createCalculator });
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TradeScopeMonthlyResolver = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
