// Entirely invented data. This helper never opens user files or browser Storage.
const fs = require('node:fs');
const vm = require('node:vm');
const model = require('../assets/data-model-storage.js');
const tx = require('../assets/storage-transaction.js');
const now = '2026-10-11T12:00:00.000Z';
const envelope = records => ({ schemaVersion: 1, records, updatedAt: now });
const copy = value => JSON.parse(JSON.stringify(value));
class MemoryStorage {
  constructor(values = {}) { this.values = new Map(Object.entries(values)); this.writes = 0; }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.writes++; this.values.set(key, value); }
  removeItem(key) { this.writes++; this.values.delete(key); }
  snapshot() { return Object.fromEntries(this.values); }
}
function fixture() {
  const models = Object.fromEntries(Object.keys(model.keys).map(key => [key, null]));
  models.accounts = envelope(model.initialAccounts().filter(row => row.id === 'acc_gmo_fx'));
  models.importBatches = envelope([{ id: 'batch_gmo', accountId: 'acc_gmo_fx', sourceType: 'pdf', sourceProvider: 'gmo',
    targetMonth: '2026-09', snapshotAsOf: '2026-09-30', importedAt: now }]);
  models.accountSnapshots = envelope([{ id: 'as_gmo', accountId: 'acc_gmo_fx', sourceMode: 'imported', sourceScope: 'gmo-fx-monthly-report',
    targetMonth: '2026-09', snapshotAsOf: '2026-09-30', importedAt: now, importBatchId: 'batch_gmo', observationType: 'officialMonthEnd',
    valuationCurrency: 'JPY', cashBalance: '115', netAssetValue: '112', unrealizedPnl: '-3', reportedMonthlyRealizedPnl: '10',
    accountSpecific: { requiredMargin: '20' } }]);
  models.monthlyAccountStates = envelope([{ schemaVersion: 2, id: 'mas_gmo', accountId: 'acc_gmo_fx', targetMonth: '2026-09', confirmedAt: now,
    adoptedAccountSnapshotId: 'as_gmo', domesticImportBatchId: null, foreignAccountSnapshotId: null, cashAccountSnapshotId: null,
    realizedPnl: '10', swapPnl: '5', deposit: '0', withdrawal: '0' }]);
  return models;
}
function backupHarness() {
  const source = fs.readFileSync(require.resolve('../top/script.js'), 'utf8');
  const context = vm.createContext({ window: { TradeScopeDataStorage: model, TradeScopeStorageTransaction: tx, location: { origin: 'http://localhost' } },
    document: { getElementById: () => null, addEventListener() {} },
    PROFIT_STORAGE_KEY_TRADING: 'tradingData', PROFIT_STORAGE_KEY_INITIAL: 'yearInitialFunds',
    PROFIT_STORAGE_KEY_INITIAL_UNREALIZED: 'yearInitialUnrealized', PROFIT_STORAGE_KEY_TOP_SUMMARY_SNAPSHOT: 'tradeScopeTopSummarySnapshotV1' });
  vm.runInContext(source.slice(source.indexOf('// ===== Backup Format Core'), source.indexOf('function exportAllData()')), context);
  return context.window;
}
module.exports = { now, envelope, copy, MemoryStorage, fixture, backupHarness };
