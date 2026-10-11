// Entirely invented fixtures; no real CSV, user Storage or network.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto').webcrypto;
const model = require('../assets/data-model-storage.js');
const resolver = require('../assets/monthly-account-resolver.js');
const service = require('../assets/sbi-monthly-save.js');
const tx = require('../assets/storage-transaction.js');
const now = '2026-10-04T12:00:00.000Z';
const envelope = records => ({ schemaVersion: 1, records, updatedAt: now });
const copy = value => JSON.parse(JSON.stringify(value));
function legacyMetrics() {
  const window = {}; vm.runInNewContext(fs.readFileSync(require.resolve('../assets/profit-metrics.js'), 'utf8'), { window });
  return window.TradeScopeProfitMetrics;
}
class Storage {
  constructor(values = {}) { this.values = new Map(Object.entries(values)); this.writes = 0; }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.writes++; this.values.set(key, value); }
  removeItem(key) { this.writes++; this.values.delete(key); }
  snapshot() { return Object.fromEntries(this.values); }
}
function fixture(month = '2026-09') {
  const models = Object.fromEntries(Object.keys(model.keys).map(key => [key, null]));
  models.accounts = envelope(model.initialAccounts().filter(row => row.id === 'acc_sbi_sec'));
  models.instruments = envelope([{ id: 'ins_anon', assetType: 'Stock', symbol: 'ZZ01', displayName: '架空証券', enabled: true }]);
  models.importBatches = envelope([{ id: 'batch_anon', accountId: 'acc_sbi_sec', targetMonth: month, snapshotAsOf: '2026-10-04', importedAt: now, sourceType: 'csv', sourceProvider: 'sbi' }]);
  models.holdingSnapshots = envelope([{ id: 'hs_anon', accountId: 'acc_sbi_sec', instrumentId: 'ins_anon', targetMonth: month,
    snapshotAsOf: '2026-10-04', importedAt: now, sourceMode: 'imported', sourceScope: 'sbi-domestic-holdings', importBatchId: 'batch_anon', marketValue: '123.45', unrealizedPnl: '3.45' }]);
  return models;
}
function seed(models = fixture(), legacy = { 2026: { 8: { sbi: { realizedPnL: 5, deposit: 2, unrealizedPnL: 1 } } } }) {
  return new Storage({ tradingData: JSON.stringify(legacy), yearInitialFunds: '{"2026":{"sbi":100}}', yearInitialUnrealized: '{}',
    tradeScopeTradeHistoryV1: '[]', tradeScopeMemos: '[]', tradeScopeSymbolListV1: '[]', tradeScopeTopSummarySnapshotV1: '{"stale":true}',
    ...Object.fromEntries(Object.entries(models).filter(([, value]) => value !== null).map(([entity, value]) => [model.keys[entity], JSON.stringify(value)])) });
}
function draft(month = '2026-09') { return { targetMonth: month, domesticImportBatchId: 'batch_anon', foreignAssetValue: '10.25',
  foreignUnrealizedPnl: '-1.20', foreignDate: '2026-10-04', cashBalance: '20.00', cashDate: '2026-09-30', realizedPnL: '0', deposit: '0', withdrawal: '0' }; }
function save(target = seed(), input = draft(), clock = now) { return service.createService(target, { crypto, clock: () => clock }).save(input); }
function calc(target) { return resolver.createCalculator(legacyMetrics(), JSON.parse(target.getItem('tradingData')), JSON.parse(target.getItem('yearInitialFunds')), {}, model.readModels(target)); }

test('cutover preserves August legacy; absent State and other-account saved zero placeholders remain missing', () => {
  const models = fixture(), data = { 2026: { 9: { __saved: true, gmo: { realizedPnL: 2 }, sbi: { realizedPnL: 0, swapPnL: 0, deposit: 0, withdrawal: 0,
    netAssets: 123, unrealizedPnL: 123, holdings: [{ quantity: 3, valueJPY: 123, valueFilled: true }] } } } };
  const before = copy(data);
  assert.equal(resolver.resolve(models, data, '2026-08').source, 'legacy');
  assert.equal(resolver.resolve(models, data, '2026-09').source, 'missing');
  assert.equal(resolver.resolve(models, data, '2026-09', 'gmo').source, 'conflict');
  assert.deepEqual(data, before);
});
function backupHarness(target) {
  const source = fs.readFileSync(require.resolve('../top/script.js'), 'utf8');
  const context = vm.createContext({ window: { TradeScopeDataStorage: model, TradeScopeStorageTransaction: tx, location: { origin: 'http://127.0.0.1:anonymous' } },
    document: { getElementById: () => null, addEventListener() {} }, localStorage: target,
    isEmptyPlainRecord: value => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0,
    PROFIT_STORAGE_KEY_TRADING: 'tradingData', PROFIT_STORAGE_KEY_INITIAL: 'yearInitialFunds',
    PROFIT_STORAGE_KEY_INITIAL_UNREALIZED: 'yearInitialUnrealized', PROFIT_STORAGE_KEY_TOP_SUMMARY_SNAPSHOT: 'tradeScopeTopSummarySnapshotV1' });
  vm.runInContext(source.slice(source.indexOf('// ===== Backup Format Core'), source.indexOf('function exportAllData()')), context);
  return context.window;
}
test('real monthly service save and correction survive unchanged v3 export/empty restore calculations', () => {
  const original = seed();
  for (const correction of [false, true]) {
    save(original, { ...draft(), foreignUnrealizedPnl: correction ? '5.25' : '-1.20' });
    const before = model.readModels(original), expected = calc(original).snapshot(2026, [{ key: 'sbi', name: 'SBI' }]);
    const api = backupHarness(original), backup = api.TradeScopeBackupExport.buildPayload(original);
    assert.equal(backup.backupVersion, 4);
    const empty = new Storage(), parsed = api.TradeScopeBackupFormat.inspectValue(backup);
    assert.equal(parsed.ok, true); api.TradeScopeBackupRestore.execute(parsed.restorePlan, empty);
    assert.deepEqual(model.readModels(empty), before);
    assert.deepEqual(calc(empty).snapshot(2026, [{ key: 'sbi', name: 'SBI' }]), expected);
  }
});
test('UI routing uses shared calculation and service, preserves backup core, and never writes Draft fields', () => {
  const profit = fs.readFileSync(require.resolve('../profit/soneki.js'), 'utf8');
  const top = fs.readFileSync(require.resolve('../top/script.js'), 'utf8');
  const ui = fs.readFileSync(require.resolve('../assets/sbi-monthly-ui.js'), 'utf8');
  assert.match(profit, /monthlyDisplayView\(\)\.series/); assert.match(top, /TradeScopeMonthlyDisplay\.create/);
  assert.match(ui, /service\.save/); assert.doesNotMatch(ui, /\.setItem\(|\.commit\(/);
  assert.doesNotMatch(ui, /placeholder\s*=\s*['"]0/); assert.match(ui, /dataset.draft = 'sbi'/);
  assert.match(profit, /if \(input.dataset.draft === 'sbi'\) return/);
});
test('all eight legacy months and other accounts retain asset/performance/flow results', () => {
  const old = legacyMetrics(), data = { 2026: {} }, funds = { 2026: { sbi: 100, gmo: 200, smbc: 50 } };
  for (let month = 1; month <= 8; month++) data[2026][month] = { __saved: true,
    sbi: { realizedPnL: month % 2 ? -1 : 0, swapPnL: 2, deposit: 3, withdrawal: 1, unrealizedPnL: -month },
    gmo: { realizedPnL: 2, swapPnL: 1, deposit: 0, withdrawal: 0, unrealizedPnL: month } };
  const before = copy(data), c = resolver.createCalculator(old, data, funds, {}, fixture());
  for (let month = 1; month <= 8; month++) for (const key of ['sbi', 'gmo']) {
    assert.equal(c.confirmed(2026, month, key), old.calculateAccountConfirmedAssets(data, funds, 2026, month, key));
    assert.equal(c.net(2026, month, key), old.calculateAccountNetAssets(data, funds, 2026, month, key));
  }
  assert.equal(c.net(2026, 9, 'smbc'), 50); assert.deepEqual(data, before);
});
test('canonical yearly independence retains missing January rather than using prior-year observations', () => {
  const target = seed(fixture('2027-02')); save(target, draft('2027-02'));
  assert.equal(calc(target).confirmed(2027, 2, 'sbi'), null);
  assert.equal(calc(target).monthlyFieldTotal(2027, 2, ['sbi'], 'swapPnL'), 0);
});
for (const field of ['realizedPnL', 'swapPnL', 'deposit', 'withdrawal']) test(`meaningful legacy ${field} stops cutover save`, () => {
  const target = seed(fixture(), { 2026: { 9: { sbi: { [field]: 1 } } } }), before = target.snapshot();
  assert.equal(resolver.resolve(model.readModels(target), JSON.parse(target.getItem('tradingData')), '2026-09').source, 'conflict');
  assert.throws(() => save(target), /従来方式/); assert.deepEqual(target.snapshot(), before);
});
test('complete atomic save resolves observed values separately from ledger and fixes SBI swap only', () => {
  const target = seed(), before = target.snapshot(); save(target);
  const c = calc(target), row = c.resolve(2026, 9, 'sbi');
  assert.equal(row.source, 'canonical'); assert.equal(row.completeness.complete, true); assert.equal(row.swapPnl, '0');
  assert.equal(row.observedAsset, '153.70'); assert.equal(row.observedUnrealized, '2.25');
  assert.equal(c.confirmed(2026, 9, 'sbi'), 107); assert.equal(c.net(2026, 9, 'sbi'), 109.25);
  assert.equal(c.monthlyFieldTotal(2026, 9, ['sbi'], 'realizedPnL'), 0);
  assert.equal(c.resolve(2026, 9, 'sbivc').source, 'legacy');
  for (const key of Object.keys(before).filter(key => ![model.keys.accountSnapshots, model.keys.monthlyAccountStates, 'tradeScopeTopSummarySnapshotV1'].includes(key))) assert.equal(target.getItem(key), before[key]);
  assert.equal(target.getItem(tx.journalKey), null); assert.equal(target.getItem('tradeScopeTopSummarySnapshotV1'), null);
  assert.equal(model.readModels(target).accountSnapshots.records[1].observationType, 'approximateForMonth');
});
test('explicit zeros and decimal precision persist; automatic seeding/aggregate fields never occur', () => {
  const target = seed(), svc = service.createService(target, { crypto, clock: () => now });
  const input = { ...draft(), foreignAssetValue: '0', foreignUnrealizedPnl: '0', cashBalance: '0', deposit: '0.1234567890123456789' };
  const before = target.snapshot(); svc.inspect(input); assert.deepEqual(target.snapshot(), before);
  svc.save(input); const models = model.readModels(target);
  assert.equal(models.monthlyAccountStates.records[0].deposit, input.deposit);
  assert.equal(resolver.resolve(models, {}, '2026-09').completeness.complete, true);
  assert.ok(!('observedAsset' in models.monthlyAccountStates.records[0]));
});
for (const field of ['foreignAssetValue', 'foreignUnrealizedPnl', 'foreignDate', 'cashBalance', 'cashDate', 'realizedPnL', 'deposit', 'withdrawal']) test(`blank/null ${field} reject before any writes`, () => {
  for (const value of ['', null]) { const target = seed(), before = target.snapshot(); assert.throws(() => save(target, { ...draft(), [field]: value })); assert.deepEqual(target.snapshot(), before); assert.equal(target.writes, 0); }
});
test('domestic exact Batch excludes executions/other months; multiple candidates stop without latest choice', () => {
  const models = fixture(); models.importBatches.records.push({ ...models.importBatches.records[0], id: 'batch_exec' });
  assert.equal(resolver.domesticCandidates(models, '2026-09').length, 1);
  models.importBatches.records.push({ ...models.importBatches.records[0], id: 'batch_second' });
  models.holdingSnapshots.records.push({ ...models.holdingSnapshots.records[0], id: 'hs_second', importBatchId: 'batch_second' });
  const target = seed(models), before = target.snapshot(); assert.throws(() => save(target), /複数/); assert.deepEqual(target.snapshot(), before);
  assert.throws(() => save(seed(), { ...draft(), domesticImportBatchId: 'different' }), /変更/);
});
test('domestic null or non-JPY is unknown; partial unrealized never becomes partial total', () => {
  const target = seed(); save(target); const models = model.readModels(target);
  models.holdingSnapshots.records[0].unrealizedPnl = null;
  const row = resolver.resolve(models, {}, '2026-09'); assert.equal(row.unrealizedPnl, null); assert.equal(row.completeness.complete, false);
  assert.throws(() => save(seed(models)), /不足/);
  models.holdingSnapshots.records[0].currency = 'USD'; assert.equal(resolver.domesticCandidates(models, '2026-09')[0].marketValue, null);
});
test('missing September propagates cumulative unknown while October monthly P/L stays local', () => {
  const target = seed(fixture('2026-10')); save(target, { ...draft('2026-10'), realizedPnL: '3' }); const c = calc(target);
  assert.equal(c.confirmed(2026, 10, 'sbi'), null); assert.equal(c.net(2026, 10, 'sbi'), null);
  assert.equal(c.monthlyFieldTotal(2026, 10, ['sbi'], 'realizedPnL'), 3);
  assert.equal(c.performance(2026, 10, ['sbi']).confirmed, null);
  assert.equal(c.yearlyTotals(2026, ['sbi']).realizedSum, null);
  assert.equal(c.monthEntered(2026, 9, ['sbi']), false); assert.equal(c.latestMonth(2026, ['sbi']), 10);
});
test('correction preserves State ID, appends changed Snapshot and retains unchanged IDs and old records', () => {
  const target = seed(); const first = save(target), before = copy(first.models);
  const second = save(target, { ...draft(), foreignAssetValue: '11' }, '2026-10-05T12:00:00.000Z');
  assert.equal(second.state.id, first.state.id); assert.notEqual(second.state.foreignAccountSnapshotId, first.state.foreignAccountSnapshotId);
  assert.equal(second.state.cashAccountSnapshotId, first.state.cashAccountSnapshotId); assert.notEqual(second.state.confirmedAt, first.state.confirmedAt);
  assert.equal(second.models.accountSnapshots.records.length, 3);
  for (const row of before.accountSnapshots.records) assert.deepEqual(second.models.accountSnapshots.records.find(item => item.id === row.id), row);
});
test('expectedModels reread protects changed domestic data before journal', () => {
  const target = seed(), svc = service.createService(target, { crypto, clock: () => now }), expected = svc.inspect(draft()).models;
  model.createRepository(target).upsert('holdingSnapshots', { ...expected.holdingSnapshots.records[0], marketValue: '321' });
  const before = target.snapshot(); assert.throws(() => svc.save(draft(), { expectedModels: expected }), /変更/); assert.deepEqual(target.snapshot(), before);
});
for (const key of [tx.journalKey, model.keys.accountSnapshots, model.keys.monthlyAccountStates]) test(`write failure ${key} leaves both collections and all legacy unchanged`, () => {
  const target = seed(), before = target.snapshot(), set = target.setItem.bind(target); let failed = false;
  target.setItem = (name, value) => { if (name === key && !failed) { failed = true; throw new Error('Anonymous failure'); } set(name, value); };
  assert.throws(() => save(target)); assert.deepEqual(target.snapshot(), before);
});
test('cache deletion failure still rejects old fingerprint; every adopted dependency changes fingerprint', () => {
  const target = seed(), c = calc(target), fingerprint = c.fingerprint(2026), remove = target.removeItem.bind(target);
  target.removeItem = key => { if (key === 'tradeScopeTopSummarySnapshotV1') throw new Error('Anonymous cache failure'); remove(key); };
  const result = save(target); assert.equal(result.cacheInvalidated, false); assert.notEqual(calc(target).fingerprint(2026), fingerprint);
  const original = result.models, base = resolver.createCalculator(legacyMetrics(), {}, {}, {}, original).fingerprint(2026);
  for (const [entity, field, value] of [['monthlyAccountStates', 'deposit', '2'], ['importBatches', 'importerVersion', 'test-v2'],
    ['holdingSnapshots', 'marketValue', '999'], ['accountSnapshots', 'assetValue', '999']]) {
    const models = copy(original); models[entity].records[0][field] = value;
    assert.notEqual(resolver.createCalculator(legacyMetrics(), {}, {}, {}, models).fingerprint(2026), base);
  }
});
test('canonical annual/Trend data and fingerprints are pure; all legacy months/other accounts unchanged', () => {
  const target = seed(); save(target); const before = target.snapshot(), c = calc(target), legacy = legacyMetrics();
  for (let month = 1; month <= 8; month++) assert.equal(c.confirmed(2026, month, 'sbi'), legacy.calculateAccountConfirmedAssets(JSON.parse(target.getItem('tradingData')), { 2026: { sbi: 100 } }, 2026, month, 'sbi'));
  const snapshot = c.snapshot(2026, [{ key: 'sbi', name: 'SBI', color: 'red' }]);
  assert.equal(snapshot.realized[8], 107); assert.equal(snapshot.total[8], 109.25);
  assert.equal(snapshot.total[9], null); assert.equal(c.snapshotCurrent(snapshot, 2026, ['sbi']), true);
  assert.deepEqual(target.snapshot(), before);
});
