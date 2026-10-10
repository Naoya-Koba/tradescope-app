(function (root) {
  'use strict';
  const storage = typeof module !== 'undefined' && module.exports
    ? require('./data-model-storage.js') : root.TradeScopeDataStorage;
  const csv = typeof module !== 'undefined' && module.exports
    ? require('../import/csv-core.js') : root.TradeScopeCSV;
  const accountId = 'acc_sbi_sec';
  const records = (models, entity) => models[entity]?.records || [];

  // This is an Input view, never a monthly ledger or a write/migration path.
  function selectDomestic(models, targetMonth) {
    storage.validateModels(models);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(targetMonth)) throw new Error('対象月が不正です');
    // Preserve the established legacy Input through August 2026.
    if (targetMonth < '2026-09') return { mode: 'legacy' };
    const holdings = records(models, 'holdingSnapshots').filter(row =>
      row.accountId === accountId && row.targetMonth === targetMonth
      && row.sourceMode === 'imported' && row.sourceScope === 'sbi-domestic-holdings');
    const batchIds = new Set(holdings.map(row => row.importBatchId));
    const batches = records(models, 'importBatches').filter(batch => batchIds.has(batch.id)
      && batch.accountId === accountId && batch.targetMonth === targetMonth
      && batch.sourceProvider === 'sbi' && batch.sourceType === 'csv');
    const state = records(models, 'monthlyAccountStates').find(row =>
      row.accountId === accountId && row.targetMonth === targetMonth);
    if (!holdings.length && !state) return { mode: 'legacy' };
    const base = { mode: 'draft', targetMonth, marketValue: null, unrealizedPnl: null, snapshotAsOf: null };
    const account = records(models, 'accounts').find(row => row.id === accountId);
    if (account?.providerCode !== 'sbi' || account.accountType !== 'securities') return { ...base, status: 'unavailable' };
    // A future explicit adoption may identify a batch; never infer adoption from recency.
    const selected = state ? batches.find(batch => batch.id === state.domesticImportBatchId)
      : batches.length === 1 ? batches[0] : null;
    if (!selected) return { ...base, status: batches.length > 1 ? 'multiple' : 'unavailable' };
    const group = holdings.filter(row => row.importBatchId === selected.id);
    // Historical SBI domestic CSV records omit currency. This compatibility is
    // limited to the source/account/scope-validated group above, never persisted.
    if (group.some(row => row.currency != null && row.currency !== 'JPY')) return { ...base, status: 'unavailable' };
    return { ...base, status: 'ready', importBatchId: selected.id, snapshotAsOf: selected.snapshotAsOf,
      marketValue: csv.sum(group.map(row => row.marketValue ?? null)),
      unrealizedPnl: csv.sum(group.map(row => row.unrealizedPnl ?? null)) };
  }

  function load(adapter, targetMonth) {
    // Only read capability is passed to the Repository; no seed or initialization writes.
    try {
      return selectDomestic(storage.createRepository({ getItem: key => adapter.getItem(key) }).read(), targetMonth);
    } catch (_) {
      return targetMonth < '2026-09' ? { mode: 'legacy' }
        : { mode: 'draft', targetMonth, status: 'unavailable', marketValue: null, unrealizedPnl: null, snapshotAsOf: null };
    }
  }

  function createDrafts() {
    const months = new Map();
    const fields = ['realizedPnL', 'deposit', 'withdrawal'];
    return Object.freeze({
      read: month => ({ ...(months.get(month) || {}) }),
      set: (month, field, value) => {
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !fields.includes(field)) throw new Error('Draft項目が不正です');
        months.set(month, { ...(months.get(month) || {}), [field]: String(value ?? '') });
      },
      clear: () => months.clear()
    });
  }

  function formatYen(value, signed = false) {
    if (value === null || value === undefined) return '—';
    const negative = value.startsWith('-');
    const [integer, fraction] = value.replace(/^-/, '').split('.');
    const nonzero = /[1-9]/.test(value);
    return (negative ? '−' : signed && nonzero ? '+' : '')
      + integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fraction ? '.' + fraction : '') + '円';
  }
  const api = Object.freeze({ selectDomestic, load, createDrafts, formatYen });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TradeScopeSbiInput = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
