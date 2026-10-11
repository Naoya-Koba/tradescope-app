(function (root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const resolver = node ? require('./monthly-account-resolver.js') : root.TradeScopeMonthlyResolver;
  const csv = node ? require('../import/csv-core.js') : root.TradeScopeCSV;
  const version = 'monthly-display-v1';
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

  // Display-only projection. Never feeds the monthly ledger, saves, or strict trend series.
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
        const domestic = resolved.state ? candidates.find(item => item.batch.id === resolved.state.domesticImportBatchId)
          : candidates.length === 1 ? candidates[0] : null;
        if (!resolved.state && candidates.length > 1) return { components: [], conflict: true };
        const components = domestic ? [{ name: '国内証券', asset: domestic.marketValue, unrealized: domestic.unrealizedPnl,
          snapshotAsOf: domestic.batch.snapshotAsOf, id: domestic.batch.id }] : [];
        for (const [name, scope, adopted, value] of [['外国証券', 'sbi-foreign-securities', resolved.foreign, 'assetValue'],
          ['現金・預り金', 'sbi-cash', resolved.cash, 'cashBalance']]) {
          const candidates = records(models, 'accountSnapshots').filter(row => row.accountId === resolver.policies.sbi.accountId
            && row.targetMonth === targetMonth && row.sourceScope === scope && row.sourceMode === 'manual' && row.valuationCurrency === 'JPY');
          const snapshot = resolved.state ? adopted : candidates.length === 1 ? candidates[0] : null;
          if (!resolved.state && candidates.length > 1) return { components: [], conflict: true };
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
            && batch.sourceType === 'pdf' && batch.sourceProvider === key && batch.targetMonth === targetMonth
            && batch.snapshotAsOf === row.snapshotAsOf && batch.importedAt === row.importedAt));
        const snapshot = resolved.state ? resolved.snapshot : snapshots.length === 1 ? snapshots[0] : null;
        if (!resolved.state && snapshots.length > 1) return { components: [], conflict: true };
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
      const read = field => hasData && resolved.source !== 'conflict' ? numeric(row[field]) : null;
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
      return { rows, hasData, provisional, ...totals };
    }
    function fingerprint(year) {
      const dependencies = ['monthlyAccountStates', 'accountSnapshots', 'holdingSnapshots', 'importBatches']
        .map(entity => records(models, entity).filter(row => row.targetMonth?.startsWith(`${year}-`)));
      const source = JSON.stringify([version, calculator.fingerprint(year), dependencies]);
      let hash = 2166136261;
      for (let i = 0; i < source.length; i++) { hash ^= source.charCodeAt(i); hash = Math.imul(hash, 16777619); }
      return `${version}-${(hash >>> 0).toString(16)}`;
    }
    function dashboard(year) {
      const currentMonths = Array.from({ length: 12 }, (_, i) => i + 1)
        .filter(month => accounts.some(account => present(account.key, dateKey(year, month))));
      const baseline = currentMonths.at(-1) || calculator.latestMonth(year, accounts.map(account => account.key));
      const metric = (value, sourceMonth, status) => ({ value: Number.isFinite(value) ? value : null, sourceMonth, status: Number.isFinite(value) ? status : 'unavailable' });
      const rows = accounts.map(account => {
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
      const growth = rows.filter(row => !row.bankOnly), keys = accounts.map(account => account.key), growthKeys = growth.map(row => row.key);
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
      return { year, month: baseline, hasData: net.value !== null, rows, accountData, net, confirmed, netPnl, confirmedPnl,
        netDelta: aggregate('completeNet').value === null ? null : aggregate('completeNet').value - calculator.initial(year, keys, true),
        confirmedDelta: confirmed.value === null ? null : confirmed.value - calculator.initial(year, keys),
        netPnlGrowth: rate(netPnl.value, calculator.initial(year, growthKeys, true)),
        confirmedPnlGrowth: rate(confirmedPnl.value, calculator.initial(year, growthKeys)),
        initialNet: calculator.initial(year, keys, true), initialConfirmed: calculator.initial(year, keys),
        provisional: rows.some(row => row.metrics.net.status !== 'current complete'), sourceFingerprint: fingerprint(year) };
    }
    return Object.freeze({ accountMonth, month, dashboard, fingerprint });
  }
  const api = Object.freeze({ create, version, years });
  if (node) module.exports = api; else root.TradeScopeMonthlyDisplay = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
