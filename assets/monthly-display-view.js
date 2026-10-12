(function (root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const resolver = node ? require('./monthly-account-resolver.js') : root.TradeScopeMonthlyResolver;
  const csv = node ? require('../import/csv-core.js') : root.TradeScopeCSV;
  const version = 'monthly-display-v4';
  const records = (models, entity) => models?.[entity]?.records || [];
  const dateKey = (year, month) => `${year}-${String(month).padStart(2, '0')}`;
  const numeric = value => value != null && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
  const knownSum = values => {
    const known = values.filter(value => value != null);
    return known.length ? numeric(csv.sum(known.map(String))) : null;
  };
  const strictSum = values => values.length && values.every(Number.isFinite) ? knownSum(values) : null;
  const years = models => [...new Set(['monthlyAccountStates', 'holdingSnapshots', 'accountSnapshots', 'importBatches']
    .flatMap(entity => records(models, entity).filter(row => row.targetMonth).map(row => Number(row.targetMonth.slice(0, 4)))))];

  // Shared display projection for Summary and trends; never feeds the canonical ledger or saves.
  function create(legacy, tradingData, initialFunds, initialUnrealized, models, accounts) {
    const calculator = resolver.createCalculator(legacy, tradingData, initialFunds, initialUnrealized, models);
    function present(key, targetMonth) {
      const policy = resolver.policies[key];
      return policy && targetMonth >= policy.cutover && ['monthlyAccountStates', 'holdingSnapshots', 'accountSnapshots', 'importBatches']
        .some(entity => records(models, entity).some(row => row.accountId === policy.accountId && row.targetMonth === targetMonth));
    }
    function observation(key, targetMonth, resolved) {
      if (resolved.source === 'conflict') return { components: [], conflict: true };
      if (key === 'sbi') {
        const candidates = resolver.domesticCandidates(models, targetMonth);
        const input = records(models, 'monthlyAccountInputs').find(row => row.accountId === resolver.accountId && row.targetMonth === targetMonth);
        const domestic = resolver.domesticAdoption(models, targetMonth, resolved.state ? candidates.find(item => item.batch.id === resolved.state.domesticImportBatchId)
          : candidates.length === 1 ? candidates[0] : null);
        if (!resolved.state && candidates.length > 1) return { components: [], conflict: true };
        const components = domestic ? [{ name: '国内証券', asset: domestic.marketValue, unrealized: domestic.unrealizedPnl,
          snapshotAsOf: domestic.batch.snapshotAsOf, id: domestic.batch.id }] : [];
        for (const [name, scope, adopted, value] of [['外国証券', 'sbi-foreign-securities', resolved.foreign, 'assetValue'],
          ['現金・預り金', 'sbi-cash', resolved.cash, 'cashBalance']]) {
          const candidates = records(models, 'accountSnapshots').filter(row => row.accountId === resolver.policies.sbi.accountId
            && row.targetMonth === targetMonth && row.sourceScope === scope && row.sourceMode === 'manual' && row.valuationCurrency === 'JPY');
          const inputId = input?.[scope === 'sbi-cash' ? 'cashAccountSnapshotId' : 'foreignAccountSnapshotId'];
          const snapshot = resolved.state ? adopted : input ? candidates.find(row => row.id === inputId) : candidates.length === 1 ? candidates[0] : null;
          if (!resolved.state && !input && candidates.length > 1) return { components: [], conflict: true };
          components.push({ name, asset: snapshot?.[value] ?? null, unrealized: snapshot?.unrealizedPnl ?? null,
            snapshotAsOf: snapshot?.snapshotAsOf ?? null, id: snapshot?.id ?? null });
        }
        return { components, conflict: false };
      }
      const policy = resolver.policies[key];
      if (policy?.adapter === 'official-account') {
        const monthEnd = new Date(Date.UTC(Number(targetMonth.slice(0, 4)), Number(targetMonth.slice(5)), 0)).toISOString().slice(0, 10);
        const snapshots = records(models, 'accountSnapshots').filter(row => row.accountId === policy.accountId
          && row.targetMonth === targetMonth && ['sourceScope','sourceMode','observationType','valuationCurrency'].every(field => row[field] === policy[field])
          && row.snapshotAsOf === monthEnd
          && records(models, 'importBatches').some(batch => batch.id === row.importBatchId && batch.accountId === policy.accountId
            && batch.sourceType === 'pdf' && batch.sourceProvider === (policy.provider||key) && batch.targetMonth === targetMonth
            && batch.snapshotAsOf === row.snapshotAsOf && batch.importedAt === row.importedAt));
        const input = records(models, 'monthlyAccountInputs').find(row => row.schemaVersion === 2 && row.accountId === policy.accountId && row.targetMonth === targetMonth);
        const snapshot = resolved.state ? resolved.snapshot : input ? snapshots.find(row => row.id === input.adoptedAccountSnapshotId) : snapshots.length === 1 ? snapshots[0] : null;
        if (!resolved.state && ((!input && snapshots.length > 1) || (input && !snapshot))) return { components: [], conflict: true };
        return { components: snapshot ? [{ name: '口座観測', asset: snapshot.netAssetValue ?? null,
          unrealized: snapshot.unrealizedPnl ?? null, snapshotAsOf: snapshot.snapshotAsOf, id: snapshot.id }] : [], conflict: false };
      }
      return { components: [], conflict: false };
    }
    function accountMonth(year, month, account) {
      const key = account.key, targetMonth = dateKey(year, month), resolved = calculator.resolve(year, month, key);
      const isLegacy = resolved.source === 'legacy', entered = calculator.entered(year, month, key);
      const hasData = isLegacy ? entered : present(key, targetMonth);
      const observed = observation(key, targetMonth, resolved);
      const complete = isLegacy ? entered && Number.isFinite(calculator.net(year, month, key)) : resolved.completeness?.complete === true;
      const row = calculator.row(year, month, key);
      const input = records(models, 'monthlyAccountInputs').find(item => item.accountId === resolver.policies[key]?.accountId && item.targetMonth === targetMonth);
      const adoptedRow = input && !resolved.state ? input.schemaVersion === 2
        ? {realizedPnL:input.adoptedValues.realizedPnl,swapPnL:input.adoptedValues.swapPnl,unrealizedPnL:input.adoptedValues.unrealizedPnl,deposit:input.adoptedValues.deposit,withdrawal:input.adoptedValues.withdrawal}
        : {realizedPnL:input.realizedPnl, deposit:input.deposit, withdrawal:input.withdrawal} : row;
      const read = field => hasData && resolved.source !== 'conflict' && !observed.conflict ? numeric(adoptedRow[field]) : null;
      const partial = hasData && !complete;
      const asset = complete ? calculator.net(year, month, key) : knownSum(observed.components.map(item => item.asset));
      const unrealized = complete || resolved.source === 'legacy' ? read('unrealizedPnL')
        : knownSum(observed.components.map(item => item.unrealized));
      return { key, targetMonth, sourceMonth: targetMonth, hasData, complete, partial,
        conflict: resolved.source === 'conflict' || observed.conflict, components: observed.components,
        realized: read('realizedPnL'), swap: read('swapPnL'), unrealized,
        deposit: read('deposit'), withdrawal: read('withdrawal'), asset,
        confirmed: complete ? calculator.confirmed(year, month, key) : null };
    }
    function month(year, monthNumber) {
      const rows = accounts.map(account => accountMonth(year, monthNumber, account));
      const hasData = rows.some(row => row.hasData);
      const provisional = hasData && rows.some(row => !row.complete);
      const totals = Object.fromEntries(['realized', 'swap', 'unrealized', 'deposit', 'withdrawal']
        .map(field => [field, knownSum(rows.filter(row => row.hasData).map(row => row[field]))]));
      // Old months keep their exact aggregate semantics; only new-mode display is relaxed.
      if (dateKey(year, monthNumber) < resolver.cutover) {
        for (const [field, stored] of [['realized','realizedPnL'], ['swap','swapPnL'], ['unrealized','unrealizedPnL'], ['deposit','deposit'], ['withdrawal','withdrawal']]) {
          totals[field] = calculator.monthlyFieldTotal(year, monthNumber, accounts.map(account => account.key), stored);
        }
      }
      return { rows, hasData, provisional, total: knownSum([totals.realized, totals.swap]), ...totals };
    }
    function fingerprint(year) {
      const dependencies = ['monthlyAccountStates', 'monthlyAccountInputs', 'accountSnapshots', 'holdingSnapshots', 'importBatches']
        .map(entity => records(models, entity).filter(row => row.targetMonth?.startsWith(`${year}-`)));
      const source = JSON.stringify([version, calculator.fingerprint(year), dependencies]);
      let hash = 2166136261;
      for (let i = 0; i < source.length; i++) { hash ^= source.charCodeAt(i); hash = Math.imul(hash, 16777619); }
      return `${version}-${(hash >>> 0).toString(16)}`;
    }
    function dashboard(year, throughMonth = 12, selectedAccounts = accounts) {
      const currentMonths = Array.from({ length: 12 }, (_, i) => i + 1)
        .filter(month => month <= throughMonth && selectedAccounts.some(account => present(account.key, dateKey(year, month))));
      const latestLegacy = Array.from({length: throughMonth}, (_, i) => i + 1)
        .filter(month => selectedAccounts.some(account => accountMonth(year, month, account).hasData)).at(-1);
      const baseline = currentMonths.at(-1) || latestLegacy || null;
      const metric = (value, sourceMonth, status) => ({ value: Number.isFinite(value) ? value : null, sourceMonth, status: Number.isFinite(value) ? status : 'unavailable' });
      const rows = selectedAccounts.map(account => {
        const current = baseline ? accountMonth(year, baseline, account) : null;
        let latest = null;
        for (let m = baseline || 0; m > 0; m--) {
          const row = accountMonth(year, m, account);
          if (row.complete && !row.conflict && Number.isFinite(row.asset) && Number.isFinite(row.confirmed)) { latest = row; break; }
        }
        // A current partial observation must not borrow any previous asset component.
        const assetRow = current?.hasData ? current : latest;
        const status = row => row?.targetMonth === dateKey(year, baseline) ? row.complete ? 'current complete' : 'current partial' : 'previous complete';
        const performance = latest ? calculator.performance(year, Number(latest.targetMonth.slice(5)), [account.key]) : {};
        return { ...account, metrics: {
          net: metric(assetRow?.asset, assetRow?.targetMonth ?? null, status(assetRow)),
          confirmed: metric(latest?.confirmed, latest?.targetMonth ?? null, status(latest)),
          netPnl: metric(performance.net, latest?.targetMonth ?? null, status(latest)),
          confirmedPnl: metric(performance.confirmed, latest?.targetMonth ?? null, status(latest)),
          completeNet: metric(latest?.asset, latest?.targetMonth ?? null, status(latest)) },
          conflict: current?.conflict || false };
      });
      const growth = rows.filter(row => !row.bankOnly), keys = selectedAccounts.map(account => account.key), growthKeys = growth.map(row => row.key);
      const aggregate = (metricName, partialAllowed = false, sourceRows = rows) => {
        const values = sourceRows.map(row => row.metrics[metricName]);
        return { value: (partialAllowed ? knownSum : strictSum)(values.map(item => item.value)),
          sources: values.map(({ sourceMonth, status }) => ({ sourceMonth, status })) };
      };
      const net = aggregate('net', true), confirmed = aggregate('confirmed');
      const netPnl = aggregate('netPnl', false, growth), confirmedPnl = aggregate('confirmedPnl', false, growth);
      const accountData = rows.filter(row => Number.isFinite(row.metrics.net.value) && row.metrics.net.value > 0)
        .map(row => ({ label: row.name, color: row.color, amount: row.metrics.net.value, sourceMonth: row.metrics.net.sourceMonth, status: row.metrics.net.status }));
      const rate = (value, initial) => Number.isFinite(value) && initial > 0 ? value / initial * 100 : null;
      const netDelta = aggregate('completeNet').value === null ? null : aggregate('completeNet').value - calculator.initial(year, keys, true);
      const confirmedDelta = confirmed.value === null ? null : confirmed.value - calculator.initial(year, keys);
      return { year, month: baseline, hasData: net.value !== null, rows, accountData, net, confirmed, netPnl, confirmedPnl,
        netDelta,
        confirmedDelta: confirmed.value === null ? null : confirmed.value - calculator.initial(year, keys),
        netGrowth: rate(netDelta, calculator.initial(year, keys, true)),
        confirmedGrowth: rate(confirmedDelta, calculator.initial(year, keys)),
        netPnlGrowth: rate(netPnl.value, calculator.initial(year, growthKeys, true)),
        confirmedPnlGrowth: rate(confirmedPnl.value, calculator.initial(year, growthKeys)),
        initialNet: calculator.initial(year, keys, true), initialConfirmed: calculator.initial(year, keys),
        provisional: rows.some(row => row.metrics.net.status !== 'current complete'), sourceFingerprint: fingerprint(year) };
    }
    function series(year, selectedAccounts = accounts) {
      const latest = dashboard(year, 12, selectedAccounts), keys = selectedAccounts.map(account => account.key);
      const points = Array.from({length:12}, (_, i) => {
        const hasData = selectedAccounts.some(account => accountMonth(year, i + 1, account).hasData);
        return hasData ? dashboard(year, i + 1, selectedAccounts) : null;
      });
      return { year, month: latest.month, hasData: latest.hasData, summary: latest,
        realized: points.map(p => p?.confirmed.value ?? null), total: points.map(p => p?.net.value ?? null),
        performanceConfirmedSeries: [0, ...points.map(p => p?.confirmedPnl.value ?? null)],
        performanceTotalSeries: [0, ...points.map(p => p?.netPnl.value ?? null)], accountData: latest.accountData,
        chartStartTotal: calculator.initial(year, keys), chartStartTotalWithUnrealized: calculator.initial(year, keys, true),
        sourceFingerprint: fingerprint(year) };
    }
    function yearlyTotals(year) {
      const months = Array.from({length:12}, (_, i) => month(year, i + 1));
      return Object.fromEntries([['realizedSum','realized'],['swapSum','swap'],['depositSum','deposit'],['withdrawSum','withdrawal']]
        .map(([name, field]) => [name, knownSum(months.filter(m => m.hasData).map(m => m[field]))]));
    }
    function monthlyPnl(year, monthNumber, selectedAccounts = accounts) {
      const rows = selectedAccounts.map(account => accountMonth(year, monthNumber, account)).filter(row => row.hasData);
      const realized = knownSum(rows.map(row => row.realized)), swap = knownSum(rows.map(row => row.swap));
      return {realized, swap, total: knownSum([realized, swap])};
    }
    return Object.freeze({ accountMonth, month, dashboard, series, yearlyTotals, monthlyPnl, fingerprint });
  }
  const api = Object.freeze({ create, version, years });
  if (node) module.exports = api; else root.TradeScopeMonthlyDisplay = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
