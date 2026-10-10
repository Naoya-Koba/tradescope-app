(function (root) {
  'use strict';
  const storage = typeof module !== 'undefined' && module.exports ? require('./data-model-storage.js') : root.TradeScopeDataStorage;
  const csv = typeof module !== 'undefined' && module.exports ? require('../import/csv-core.js') : root.TradeScopeCSV;
  const accountId = 'acc_sbi_sec', cutover = '2026-09', calculationVersion = 'sbi-monthly-v1';
  const records = (models, entity) => models?.[entity]?.records || [];
  const monthKey = (year, month) => `${year}-${String(month).padStart(2, '0')}`;
  const decimal = value => typeof value === 'string' && /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value);
  const sum = values => values.length && values.every(decimal) ? csv.sum(values) : null;
  const number = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
  const total = values => values.every(Number.isFinite) ? values.reduce((a, b) => a + b, 0) : null;

  // Only direct monthly inputs are evidence; generated holdings/netAssets/unrealized are not.
  // A global __saved flag can belong to another account, so it cannot make SBI's zero placeholder meaningful.
  function hasLegacyConflict(tradingData, targetMonth) {
    const [year, month] = targetMonth.split('-').map(Number);
    const row = tradingData?.[year]?.[month]?.sbi || {};
    return ['realizedPnL', 'swapPnL', 'deposit', 'withdrawal'].some(field => {
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

  function resolve(models, tradingData, targetMonth, key = 'sbi') {
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

  function dependencies(models, year) {
    const states = records(models, 'monthlyAccountStates').filter(row => row.accountId === accountId && row.targetMonth.startsWith(`${year}-`));
    const batchIds = new Set(states.map(row => row.domesticImportBatchId));
    const snapshotIds = new Set(states.flatMap(row => [row.foreignAccountSnapshotId, row.cashAccountSnapshotId]));
    return { calculationVersion, states,
      batches: records(models, 'importBatches').filter(row => batchIds.has(row.id)),
      holdings: records(models, 'holdingSnapshots').filter(row => batchIds.has(row.importBatchId)),
      snapshots: records(models, 'accountSnapshots').filter(row => snapshotIds.has(row.id)) };
  }

  // DOM/storage-free facade. Old months and all other accounts retain the existing formulas.
  function createCalculator(legacy, tradingData, initialFunds, initialUnrealized, models) {
    if (models !== null) storage.validateModels(models);
    const yearData = year => tradingData?.[year] || {};
    const oldRow = (year, month, key) => yearData(year)?.[month]?.[key] || {};
    const read = (year, month, key) => models === null && key === 'sbi' && monthKey(year, month) >= cutover
      ? { source: 'conflict', confirmed: false, completeness: { monthly: false, observation: false, complete: false } }
      : resolve(models, tradingData, monthKey(year, month), key);
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
      if (monthKey(year, month) < cutover || !keys.includes('sbi')) return legacy.isMonthEntered(yearData(year), month, keys);
      return keys.some(key => entered(year, month, key));
    }
    function latestMonth(year, keys) {
      for (let month = 12; month > 0; month--) if (monthEntered(year, month, keys)) return month;
      return null;
    }
    function monthlyFieldTotal(year, month, keys, field) {
      if (!monthEntered(year, month, keys)) return null;
      if (keys.includes('sbi') && monthKey(year, month) >= cutover) {
        const sbi = read(year, month, 'sbi');
        if (sbi.source !== 'canonical' || !sbi.completeness.monthly || number(row(year, month, 'sbi')[field]) === null) return null;
      }
      const values = keys.map(key => number(row(year, month, key)[field])).filter(value => value !== null);
      return values.length ? total(values) : null;
    }
    function confirmed(year, month, key) {
      if (key !== 'sbi' || monthKey(year, month) < cutover) return legacy.calculateAccountConfirmedAssets(tradingData, initialFunds, year, month, key);
      const start = Number(year) === 2026 ? 9 : 1;
      let value = Number(year) === 2026 ? legacy.calculateAccountConfirmedAssets(tradingData, initialFunds, year, 8, key)
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
      if (key !== 'sbi' || monthKey(year, month) < cutover) return legacy.calculateAccountNetAssets(tradingData, initialFunds, year, month, key);
      const value = confirmed(year, month, key), resolved = read(year, month, key);
      return Number.isFinite(value) && resolved.source === 'canonical' && resolved.unrealizedPnl !== null
        ? value + Number(resolved.unrealizedPnl) : null;
    }
    function flows(year, month, keys) {
      let deposit = 0, withdrawal = 0;
      for (let m = 1; m <= month; m++) for (const key of keys) {
        if (key === 'sbi' && monthKey(year, m) >= cutover && !read(year, m, key).completeness.monthly) return { deposit: null, withdrawal: null };
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
          if (keys.includes('sbi') && monthKey(year, month) >= cutover && !read(year, month, 'sbi').completeness.monthly) missing = true;
          const item = monthlyFieldTotal(year, month, keys, field);
          if (Number.isFinite(item)) { value += item; found = true; }
        }
        result[name] = found && !missing ? value : null;
      }
      return result;
    }
    function fingerprint(year) {
      const source = JSON.stringify([legacy.createYearSourceFingerprint(tradingData, initialFunds, initialUnrealized, year), dependencies(models, year), models === null]);
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
        : Array.from({ length: 12 }, (_, index) => index + 1).some(month => read(year, month, 'sbi').source === 'conflict')
        ? '従来方式のSBI入力がある月は集計できません' : '',
      snapshotCurrent: (value, year, keys) => Boolean(value && value.sourceFingerprint === fingerprint(year)
        && value.month === latestMonth(year, keys) && monthEntered(year, value.month, keys)) });
  }
  const api = Object.freeze({ accountId, cutover, calculationVersion, hasLegacyConflict, domesticCandidates, resolve, dependencies, createCalculator });
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TradeScopeMonthlyResolver = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
