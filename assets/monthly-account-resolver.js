(function (root) {
  'use strict';
  const storage = typeof module !== 'undefined' && module.exports ? require('./data-model-storage.js') : root.TradeScopeDataStorage;
  const csv = typeof module !== 'undefined' && module.exports ? require('../import/csv-core.js') : root.TradeScopeCSV;
  const accountId = 'acc_sbi_sec', cutover = '2026-09', calculationVersion = 'sbi-monthly-v1';
  const policyVersion = 'monthly-policies-v1';
  const policies = Object.freeze({
    sbi: Object.freeze({ accountId, cutover, adapter: 'sbi' }),
    gmo: Object.freeze({ accountId: 'acc_gmo_fx', cutover: '2026-09', adapter: 'official-account',
      sourceScope: 'gmo-fx-monthly-report', sourceMode: 'imported', observationType: 'officialMonthEnd', valuationCurrency: 'JPY' })
  });
  // GMO is testable through explicit options, but is not active in production until its save/UI phase.
  const defaultEnabledKeys = Object.freeze(['sbi']);
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
    return ['realizedPnL', 'swapPnL', 'deposit', 'withdrawal', ...(key === 'gmo' ? ['unrealizedPnL'] : [])].some(field => {
      const value = row[field];
      return (typeof value === 'number' || typeof value === 'string' && value.trim() !== '')
        && Number.isFinite(Number(value)) && Number(value) !== 0;
    });
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

  function resolveSbi(models, tradingData, targetMonth, key = 'sbi') {
    if (key !== 'sbi' || targetMonth < cutover) return { source: 'legacy' };
    const base = { source: 'missing', confirmed: false, completeness: { monthly: false, observation: false, complete: false },
      realizedPnl: null, swapPnl: null, deposit: null, withdrawal: null, unrealizedPnl: null,
      observedAsset: null, observedUnrealized: null, adoptedIds: {}, state: null };
    if (hasLegacyConflict(tradingData, targetMonth)) return { ...base, source: 'conflict' };
    const state = records(models, 'monthlyAccountStates').find(row => row.accountId === accountId && row.targetMonth === targetMonth);
    if (!state) return base;
    const domestic = domesticCandidates(models, targetMonth).find(item => item.batch.id === state.domesticImportBatchId);
    const snapshots = records(models, 'accountSnapshots');
    const foreign = snapshots.find(row => row.id === state.foreignAccountSnapshotId);
    const cash = snapshots.find(row => row.id === state.cashAccountSnapshotId);
    const manualValid = (row, scope) => row?.accountId === accountId && row.targetMonth === targetMonth
      && row.sourceMode === 'manual' && row.sourceScope === scope && row.valuationCurrency === 'JPY' && Boolean(row.snapshotAsOf);
    const foreignValid = manualValid(foreign, 'sbi-foreign-securities'), cashValid = manualValid(cash, 'sbi-cash');
    const observedUnrealized = sum([domestic?.unrealizedPnl, foreignValid ? foreign.unrealizedPnl : null]);
    const observedAsset = sum([domestic?.marketValue, foreignValid ? foreign.assetValue : null, cashValid ? cash.cashBalance : null]);
    const monthly = ['realizedPnl', 'deposit', 'withdrawal'].every(field => decimal(state[field])) && state.swapPnl === '0';
    const observation = observedAsset !== null && observedUnrealized !== null && Boolean(domestic?.batch.snapshotAsOf);
    return { ...base, source: 'canonical', confirmed: true, state, domestic, foreign, cash,
      realizedPnl: state.realizedPnl, swapPnl: state.swapPnl === '0' ? '0' : null, deposit: state.deposit, withdrawal: state.withdrawal,
      unrealizedPnl: observedUnrealized, observedAsset, observedUnrealized,
      completeness: { monthly, observation, complete: monthly && observation },
      adoptedIds: { stateId: state.id, domesticImportBatchId: state.domesticImportBatchId,
        foreignAccountSnapshotId: state.foreignAccountSnapshotId, cashAccountSnapshotId: state.cashAccountSnapshotId } };
  }

  function resolve(models, tradingData, targetMonth, key = 'sbi', enabledKeys = defaultEnabledKeys) {
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
    if (state.schemaVersion !== 2 || !snapshot || snapshot.accountId !== policy.accountId || snapshot.targetMonth !== targetMonth
      || ['sourceScope', 'sourceMode', 'observationType', 'valuationCurrency'].some(field => snapshot[field] !== policy[field])
      || snapshot.snapshotAsOf !== monthEnd || !batch || batch.accountId !== policy.accountId || batch.targetMonth !== targetMonth
      || batch.snapshotAsOf !== snapshot.snapshotAsOf || batch.importedAt !== snapshot.importedAt || batch.sourceType !== 'pdf'
      || batch.sourceProvider !== key || !decimal(snapshot.reportedMonthlyRealizedPnl) || !decimal(state.realizedPnl)) return { ...base, source: 'conflict' };
    // Validation is independent of floating-point conversion, including signed values.
    if (!/^-?0(?:\.0+)?$/.test(csv.sum([snapshot.reportedMonthlyRealizedPnl, state.realizedPnl.startsWith('-') ? state.realizedPnl.slice(1) : '-' + state.realizedPnl]))) return { ...base, source: 'conflict' };
    const monthly = ['realizedPnl', 'swapPnl', 'deposit', 'withdrawal'].every(field => decimal(state[field]));
    const observation = decimal(snapshot.unrealizedPnl) && decimal(snapshot.netAssetValue);
    return { ...base, source: 'canonical', confirmed: true, state, snapshot, batch,
      ...Object.fromEntries(['realizedPnl', 'swapPnl', 'deposit', 'withdrawal'].map(field => [field, state[field]])),
      unrealizedPnl: snapshot.unrealizedPnl, observedAsset: snapshot.netAssetValue, observedUnrealized: snapshot.unrealizedPnl,
      completeness: { monthly, observation, complete: monthly && observation },
      adoptedIds: { stateId: state.id, adoptedAccountSnapshotId: snapshot.id, importBatchId: batch.id } };
  }

  function dependencies(models, year, enabledKeys = defaultEnabledKeys) {
    const enabledAccounts = enabledKeys.map(key => policies[key]?.accountId);
    const states = records(models, 'monthlyAccountStates').filter(row => enabledAccounts.includes(row.accountId) && row.targetMonth.startsWith(`${year}-`));
    const batchIds = new Set(states.map(row => row.domesticImportBatchId));
    const snapshotIds = new Set(states.flatMap(row => [row.foreignAccountSnapshotId, row.cashAccountSnapshotId, row.adoptedAccountSnapshotId]));
    for (const snapshot of records(models, 'accountSnapshots')) if (snapshotIds.has(snapshot.id)) batchIds.add(snapshot.importBatchId);
    return { calculationVersion, policyVersion, policies: enabledKeys.map(key => policies[key]), states,
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
    const usesCanonical = (year, month, key) => enabledKeys.includes(key) && policies[key] && monthKey(year, month) >= policies[key].cutover;
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
      if (!monthEntered(year, month, keys)) return null;
      for (const key of keys.filter(key => usesCanonical(year, month, key))) {
        const resolved = read(year, month, key);
        if (resolved.source !== 'canonical' || !resolved.completeness.monthly || number(row(year, month, key)[field]) === null) return null;
      }
      const values = keys.map(key => number(row(year, month, key)[field])).filter(value => value !== null);
      return values.length ? total(values) : null;
    }
    function confirmed(year, month, key) {
      if (!usesCanonical(year, month, key)) return legacy.calculateAccountConfirmedAssets(tradingData, initialFunds, year, month, key);
      const [cutoverYear, cutoverMonth] = policies[key].cutover.split('-').map(Number);
      const start = Number(year) === cutoverYear ? cutoverMonth : 1;
      let value = Number(year) === cutoverYear ? legacy.calculateAccountConfirmedAssets(tradingData, initialFunds, year, start - 1, key)
        : Number(initialFunds?.[year]?.[key]) || 0;
      for (let m = start; m <= month; m++) {
        const resolved = read(year, m, key);
        if (!resolved.completeness.monthly || resolved.source !== 'canonical') return null;
        value += Number(resolved.realizedPnl) + Number(resolved.swapPnl) + Number(resolved.deposit) - Number(resolved.withdrawal);
      }
      return Number.isFinite(value) ? value : null;
    }
    function net(year, month, key) {
      if (key === 'smbc') return confirmed(year, month, key);
      if (!usesCanonical(year, month, key)) return legacy.calculateAccountNetAssets(tradingData, initialFunds, year, month, key);
      const value = confirmed(year, month, key), resolved = read(year, month, key);
      return Number.isFinite(value) && resolved.source === 'canonical' && resolved.unrealizedPnl !== null
        ? value + Number(resolved.unrealizedPnl) : null;
    }
    function flows(year, month, keys) {
      let deposit = 0, withdrawal = 0;
      for (let m = 1; m <= month; m++) for (const key of keys) {
        if (usesCanonical(year, m, key) && !read(year, m, key).completeness.monthly) return { deposit: null, withdrawal: null };
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
      const source = JSON.stringify([legacy.createYearSourceFingerprint(tradingData, initialFunds, initialUnrealized, year), dependencies(models, year, enabledKeys), models === null]);
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
  const api = Object.freeze({ accountId, cutover, calculationVersion, policyVersion, policies, hasLegacyConflict, domesticCandidates, resolve, dependencies, createCalculator });
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TradeScopeMonthlyResolver = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
