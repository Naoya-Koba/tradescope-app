// Invented anonymous records; no browser, real CSV, Backup or network access.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const model = require('../assets/data-model-storage.js');
const transaction = require('../assets/storage-transaction.js');
const now = '2030-10-04T12:00:00.000Z';
const stateKey = model.keys.monthlyAccountStates;
const copy = value => JSON.parse(JSON.stringify(value));
const envelope = records => ({ schemaVersion: 1, records, updatedAt: now });
const absent = () => Object.fromEntries(Object.keys(model.keys).map(entity => [entity, null]));
class Storage {
  constructor(values = {}) { this.values = new Map(Object.entries(values)); this.writes = 0; }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.writes++; this.values.set(key, value); }
  removeItem(key) { this.writes++; this.values.delete(key); }
  snapshot() { return Object.fromEntries([...this.values].sort(([a], [b]) => a.localeCompare(b))); }
}
function fixture() {
  const accountId = 'acc_sbi_sec', targetMonth = '2030-09', snapshotAsOf = '2030-10-04';
  const imported = { accountId, targetMonth, snapshotAsOf, importedAt: now, sourceMode: 'imported',
    sourceScope: 'sbi-domestic-holdings', importBatchId: 'batch_domestic' };
  const manual = { accountId, targetMonth, snapshotAsOf: null, importedAt: now, sourceMode: 'manual', valuationCurrency: 'JPY' };
  return {
    accounts: envelope(model.initialAccounts().filter(item => item.id === accountId)),
    instruments: envelope([{ id: 'ins_anonymous', assetType: 'Stock', symbol: 'ZZ01', displayName: '架空株', enabled: true }]),
    importBatches: envelope([{ id: 'batch_domestic', accountId, targetMonth, snapshotAsOf, sourceType: 'csv',
      sourceProvider: 'sbi', importedAt: now, importerId: 'sbi-domestic-csv', importerVersion: 'sbi-domestic-v1' }]),
    rawTransactions: envelope([{ id: 'tx_anonymous', accountId, instrumentId: 'ins_anonymous', sourceType: 'manual',
      sourceProvider: 'sbi', importedAt: now, transactionType: '架空買付', quantity: '0', realizedPnl: null }]),
    holdingSnapshots: envelope([{ id: 'hs_anonymous', ...imported, instrumentId: 'ins_anonymous',
      marketValue: '0', unrealizedPnl: null, quantity: '123456789012345.123456789', observationType: 'approximateForMonth' }]),
    accountSnapshots: envelope([{ id: 'as_foreign', ...manual, sourceScope: 'sbi-foreign-securities',
      assetValue: '0', unrealizedPnl: null }, { id: 'as_cash', ...manual, sourceScope: 'sbi-cash', cashBalance: '0' }]),
    monthlyAccountStates: envelope([{ id: 'mas_anonymous', accountId, targetMonth, confirmedAt: now,
      domesticImportBatchId: 'batch_domestic', foreignAccountSnapshotId: 'as_foreign', cashAccountSnapshotId: 'as_cash',
      realizedPnl: null, swapPnl: '0', deposit: '123456789012345.123456789', withdrawal: '-0.25' }])
  };
}
function seed(models = fixture()) {
  return new Storage({ tradingData: ' {"2030":{"8":{"__saved":true}}} ', yearInitialFunds: '{}', yearInitialUnrealized: '{}',
    tradeScopeTradeHistoryV1: '[]', tradeScopeMemos: '[]', tradeScopeSymbolListV1: '[]',
    tradeScopeTopSummarySnapshotV1: '{"stale":true}',
    ...Object.fromEntries(Object.entries(models).filter(([, value]) => value !== null).map(([entity, value]) => [model.keys[entity], JSON.stringify(value)])) });
}
function harness() {
  const source = fs.readFileSync(path.join(__dirname, '../top/script.js'), 'utf8');
  const context = vm.createContext({ window: { TradeScopeDataStorage: model, TradeScopeStorageTransaction: transaction },
    document: { getElementById: () => null, addEventListener() {} },
    isEmptyPlainRecord: value => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0,
    PROFIT_STORAGE_KEY_TRADING: 'tradingData', PROFIT_STORAGE_KEY_INITIAL: 'yearInitialFunds',
    PROFIT_STORAGE_KEY_INITIAL_UNREALIZED: 'yearInitialUnrealized', PROFIT_STORAGE_KEY_TOP_SUMMARY_SNAPSHOT: 'tradeScopeTopSummarySnapshotV1' });
  vm.runInContext(source.slice(source.indexOf('// ===== Backup Format Core'), source.indexOf('function exportAllData()')), context);
  return { inspect: context.window.TradeScopeBackupFormat.inspectValue, restore: context.window.TradeScopeBackupRestore,
    build: context.window.TradeScopeBackupExport.buildPayload, fileName: context.formatCompleteBackupFileName };
}
function backup(version, models = fixture()) {
  const value = { product: 'TradeScope', backupVersion: version, exportedAt: now,
    data: { monthly: {}, initialFunds: {}, initialUnrealized: {}, transactions: [], memos: [], symbols: [] } };
  if (version > 1) value.data.models = Object.fromEntries(model.backupModelEntities[version].map(entity => [entity, models[entity]]));
  return value;
}
function rejectWithoutWrites(mutate) {
  const values = fixture(); mutate(values);
  const storage = seed(), before = storage.snapshot();
  assert.throws(() => model.createRepository(storage).commit(values));
  assert.deepEqual(storage.snapshot(), before); assert.equal(storage.writes, 0);
}

test('Monthly state accepts explicit confirmation, all nullable fields, decimal precision and actual zero', () => {
  const storage = new Storage(), repo = model.createRepository(storage);
  repo.commit(fixture()); assert.deepEqual(repo.read(), fixture());
  const state = repo.list('monthlyAccountStates')[0];
  assert.equal(state.realizedPnl, null); assert.equal(state.swapPnl, '0');
  assert.equal(state.deposit, '123456789012345.123456789');
  const nullable = { ...state, domesticImportBatchId: null, foreignAccountSnapshotId: null, cashAccountSnapshotId: null,
    realizedPnl: null, swapPnl: null, deposit: null, withdrawal: null };
  repo.upsert('monthlyAccountStates', nullable); assert.deepEqual(repo.list('monthlyAccountStates'), [nullable]);
  assert.equal(repo.list('holdingSnapshots')[0].snapshotAsOf, '2030-10-04');
  assert.equal(repo.list('holdingSnapshots')[0].targetMonth, '2030-09');
  assert.equal(repo.list('holdingSnapshots')[0].observationType, 'approximateForMonth');
});

for (const [label, patch] of [
  ['unknown field', { status: 'draft' }], ['schemaVersion', { schemaVersion: 2 }],
  ['decimal Number', { realizedPnl: 0 }], ['decimal empty', { realizedPnl: '' }], ['decimal exponent', { realizedPnl: '1e3' }],
  ['month', { targetMonth: '2030-13' }], ['timestamp timezone', { confirmedAt: '2030-10-04T12:00:00' }],
  ['timestamp calendar', { confirmedAt: '2030-02-30T12:00:00Z' }], ['null identity', { id: null }],
  ['Account', { accountId: 'missing' }], ['Batch', { domesticImportBatchId: 'missing' }],
  ['foreign reference', { foreignAccountSnapshotId: 'missing' }], ['cash reference', { cashAccountSnapshotId: 'missing' }]
]) test(`Monthly state rejects ${label} before writes`, () => rejectWithoutWrites(values => Object.assign(values.monthlyAccountStates.records[0], patch)));

test('Monthly state required fields, prototype controls and envelope versions reject before writes', () => {
  for (const field of Object.keys(fixture().monthlyAccountStates.records[0])) rejectWithoutWrites(values => { delete values.monthlyAccountStates.records[0][field]; });
  for (const field of ['__proto__', 'constructor', 'prototype']) rejectWithoutWrites(values => {
    Object.defineProperty(values.monthlyAccountStates.records[0], field, { value: {}, enumerable: true });
  });
  rejectWithoutWrites(values => { values.monthlyAccountStates.schemaVersion = 2; });
});

for (const [label, mutate] of [
  ['Batch wrong month', values => { values.monthlyAccountStates.records[0].targetMonth = '2030-08'; }],
  ['Batch wrong Account', values => { const state = values.monthlyAccountStates.records[0];
    values.accounts.records.push({ ...values.accounts.records[0], id: 'acc_other_sbi' }); state.accountId = 'acc_other_sbi'; }],
  ['Batch not CSV', values => { values.importBatches.records[0].sourceType = 'pdf'; }],
  ['Batch not SBI', values => { values.importBatches.records[0].sourceProvider = 'other'; }],
  ['Batch has no holdings', values => { values.holdingSnapshots.records = []; }],
  ['Batch execution scope', values => { values.holdingSnapshots.records[0].sourceScope = 'sbi-executions'; }],
  ['foreign wrong scope', values => { values.accountSnapshots.records[0].sourceScope = 'sbi-cash'; }],
  ['cash wrong scope', values => { values.accountSnapshots.records[1].sourceScope = 'sbi-foreign-securities'; }],
  ['foreign wrong month', values => { values.accountSnapshots.records[0].targetMonth = '2030-08'; }],
  ['cash wrong Account', values => { values.accounts.records.push({ ...values.accounts.records[0], id: 'acc_other_sbi' });
    values.accountSnapshots.records[1].accountId = 'acc_other_sbi'; }],
  ['foreign not manual', values => { Object.assign(values.accountSnapshots.records[0], { sourceMode: 'imported',
    importBatchId: 'batch_domestic', snapshotAsOf: '2030-10-04' }); }],
  ['cash not JPY', values => { values.accountSnapshots.records[1].valuationCurrency = 'USD'; }]
]) test(`Monthly state rejects ${label}`, () => rejectWithoutWrites(mutate));

test('one Account/month, stable ID on edits, no silent retargeting of IDs', () => {
  rejectWithoutWrites(values => values.monthlyAccountStates.records.push({ ...values.monthlyAccountStates.records[0], id: 'mas_second' }));
  const storage = seed(), repo = model.createRepository(storage), before = storage.snapshot();
  const state = repo.list('monthlyAccountStates')[0];
  assert.throws(() => repo.save('monthlyAccountStates', [{ ...state, id: 'mas_second' }]));
  assert.throws(() => repo.save('monthlyAccountStates', [{ ...state, targetMonth: '2030-08',
    domesticImportBatchId: null, foreignAccountSnapshotId: null, cashAccountSnapshotId: null }]));
  assert.deepEqual(storage.snapshot(), before);
  repo.upsert('monthlyAccountStates', { ...state, deposit: '0' });
  assert.equal(repo.list('monthlyAccountStates').length, 1); assert.equal(repo.list('monthlyAccountStates')[0].id, state.id);
});

test('lazy Repository/read/export neither seeds models nor generates monthly confirmation', () => {
  const storage = new Storage(), repo = model.createRepository(storage);
  assert.deepEqual(repo.read(), absent()); assert.deepEqual(repo.list('monthlyAccountStates'), []);
  const h = harness(), value = h.build(storage, 'http://localhost', now);
  assert.equal(value.backupVersion, 3); assert.deepEqual(copy(value.data.models), absent());
  assert.equal(storage.writes, 0);
  const target = seed(); h.restore.execute(h.inspect(value).restorePlan, target);
  assert.deepEqual(model.readModels(target), absent());
});

test('v3 seven models round-trip; filename and exportedAt unchanged, no draft/aggregate fields', () => {
  const h = harness(), source = seed(), before = source.snapshot();
  const value = h.build(source, 'http://localhost', now);
  assert.equal(value.backupVersion, 3); assert.equal(value.exportedAt, now);
  assert.deepEqual(copy(value.data.models), fixture()); assert.deepEqual(source.snapshot(), before);
  const target = new Storage(); h.restore.execute(h.inspect(value).restorePlan, target);
  assert.deepEqual(copy(h.build(target, 'http://localhost', now)), copy(value));
  assert.equal(target.getItem(transaction.journalKey), null); assert.equal(target.getItem('tradeScopeTopSummarySnapshotV1'), null);
  assert.equal(h.fileName(new Date(2030, 0, 2, 3, 4)), 'TradeScope_20300102_0304_Backup.json');
  const state = model.readModels(target).monthlyAccountStates.records[0];
  for (const field of ['status', 'sourceAvailability', 'sourceFingerprint', 'assetValue', 'unrealizedPnl']) assert.ok(!(field in state));
});

test('v1 and each Legacy Restore preserve all seven model keys including unreadable future State', () => {
  const h = harness();
  const inputs = [backup(1), { tradescope: 'all-backup', exportedAt: now, profitData: { tradingData: {}, yearInitialFunds: {} }, historyData: { entries: [] } },
    { tradingData: {}, yearInitialFunds: {}, exportedAt: now }, { tradescope: 'history-backup', entries: [], exportedAt: now }];
  for (const input of inputs) {
    const target = seed(); target.setItem(stateKey, ' {"schemaVersion":99} '); const before = target.snapshot();
    h.restore.execute(h.inspect(input).restorePlan, target);
    for (const key of Object.values(model.keys)) assert.equal(target.getItem(key), before[key]);
  }
});

test('v2 is strictly six-model format, restores them and clears State in the same journal', () => {
  const h = harness(), value = backup(2), target = seed(), restorePlan = h.inspect(value).restorePlan;
  assert.equal(Object.keys(value.data.models).length, 6); assert.equal(h.inspect(value).ok, true);
  const set = target.setItem.bind(target); let protectedState = false;
  target.setItem = (key, raw) => { if (key === transaction.journalKey) protectedState = JSON.parse(raw).entries.some(item => item.storageKey === stateKey && item.existed);
    set(key, raw); };
  h.restore.execute(restorePlan, target); assert.equal(protectedState, true);
  assert.equal(target.getItem(stateKey), null);
  for (const entity of model.backupModelEntities[2]) assert.deepEqual(JSON.parse(target.getItem(model.keys[entity])), value.data.models[entity]);
  const noModels = backup(2, absent()); h.restore.execute(h.inspect(noModels).restorePlan, target);
  assert.deepEqual(model.readModels(target), absent());
  const mislabeled = backup(3); mislabeled.backupVersion = 2;
  assert.equal(h.inspect(mislabeled).ok, false);
  const future = backup(3); future.backupVersion = 4; assert.equal(h.inspect(future).ok, false);
});

test('v3 malformed State/model/ref fails inspection and forged plan fails before journal', () => {
  const h = harness(), target = seed(), before = target.snapshot();
  const mutations = [v => { delete v.data.models.monthlyAccountStates; }, v => { v.data.models.monthlyAccountStates.records[0].realizedPnl = 0; },
    v => { v.data.models.monthlyAccountStates.records[0].foreignAccountSnapshotId = 'missing'; },
    v => { v.data.models.extra = null; }, v => { v.data.models.monthlyAccountStates.schemaVersion = 2; }];
  for (const mutate of mutations) { const value = backup(3); mutate(value); assert.equal(h.inspect(value).ok, false); }
  const forged = copy(h.inspect(backup(3)).restorePlan);
  forged.operations.find(item => item.storageKey === stateKey).value.records[0].deposit = 'bad';
  assert.throws(() => h.restore.execute(forged, target));
  const v2Plan = copy(h.inspect(backup(2)).restorePlan); v2Plan.operations = v2Plan.operations.filter(item => item.storageKey !== stateKey);
  assert.throws(() => h.restore.execute(v2Plan, target));
  assert.deepEqual(target.snapshot(), before); assert.equal(target.writes, 0);
});

test('every v2/v3 primary write/remove, journal and cache failure restores old and new raw values', () => {
  const h = harness();
  for (const version of [2, 3]) {
    const plan = h.inspect(backup(version)).restorePlan;
    for (const failureKey of [...plan.operations.map(item => item.storageKey), transaction.journalKey, 'tradeScopeTopSummarySnapshotV1']) {
      const target = seed(), before = target.snapshot(), set = target.setItem.bind(target), remove = target.removeItem.bind(target);
      let failed = false;
      const injected = (key, action) => { if (!failed && key === failureKey) { failed = true; throw new Error('Anonymous failure'); } action(); };
      target.setItem = (key, raw) => injected(key, () => set(key, raw));
      target.removeItem = key => injected(key, () => remove(key));
      assert.throws(() => h.restore.execute(plan, target)); assert.deepEqual(target.snapshot(), before);
    }
  }
});

test('State reread mismatch and originally absent key are fully rolled back', () => {
  const h = harness(), target = seed(), before = target.snapshot();
  const get = target.getItem.bind(target), set = target.setItem.bind(target); let written = false, mismatched = false;
  target.setItem = (key, raw) => { set(key, raw); if (key === stateKey) written = true; };
  target.getItem = key => { if (key === stateKey && written && !mismatched) { mismatched = true; return 'mismatch'; } return get(key); };
  assert.throws(() => h.restore.execute(h.inspect(backup(3)).restorePlan, target)); assert.deepEqual(target.snapshot(), before);
  const empty = new Storage(), repo = model.createRepository(empty), remove = empty.removeItem.bind(empty); let failed = false;
  empty.removeItem = key => { if (key === transaction.journalKey && !failed) { failed = true; throw new Error('Cleanup failure'); } remove(key); };
  assert.throws(() => repo.commit(fixture())); assert.deepEqual(empty.snapshot(), {});
});

test('State expectedModels prevents stale save, semantic reread mismatch rolls back', () => {
  const target = seed(), repo = model.createRepository(target), expected = repo.read();
  repo.upsert('monthlyAccountStates', { ...expected.monthlyAccountStates.records[0], deposit: '0' });
  const before = target.snapshot();
  assert.throws(() => repo.commit({ monthlyAccountStates: expected.monthlyAccountStates }, { expectedModels: expected }), /変更/);
  assert.deepEqual(target.snapshot(), before);
  const get = target.getItem.bind(target), set = target.setItem.bind(target); let reads = 0, written = false;
  target.setItem = (key, raw) => { set(key, raw); if (key === stateKey) written = true; };
  target.getItem = key => { if (key === stateKey && written && ++reads === 2) {
    const value = JSON.parse(get(key)); value.records[0].deposit = '999'; return JSON.stringify(value);
  } return get(key); };
  assert.throws(() => repo.upsert('monthlyAccountStates', { ...expected.monthlyAccountStates.records[0], deposit: '1' }));
  assert.deepEqual(target.snapshot(), before);
});

test('State rollback failure keeps journal, blocks saves, explicit recovery restores all keys', () => {
  const h = harness(), target = seed(), before = target.snapshot(), set = target.setItem.bind(target);
  let primaryFailed = false;
  target.setItem = (key, raw) => {
    if (key === stateKey) { primaryFailed = true; throw new Error('State unavailable'); }
    if (primaryFailed && key === model.keys.accounts) throw new Error('Rollback unavailable');
    set(key, raw);
  };
  assert.throws(() => h.restore.execute(h.inspect(backup(3)).restorePlan, target), /戻せません/);
  assert.notEqual(target.getItem(transaction.journalKey), null);
  assert.throws(() => model.createRepository(target).upsert('monthlyAccountStates', fixture().monthlyAccountStates.records[0]), /ジャーナル/);
  target.setItem = set; assert.equal(transaction.recover(target), true); assert.deepEqual(target.snapshot(), before);
});

test('monthly State save never modifies legacy monthly, financial calculations or Summary cache', () => {
  const target = seed(), before = target.snapshot(), repo = model.createRepository(target);
  repo.upsert('monthlyAccountStates', { ...repo.list('monthlyAccountStates')[0], realizedPnl: '0' });
  for (const key of ['tradingData', 'yearInitialFunds', 'yearInitialUnrealized', 'tradeScopeTradeHistoryV1',
    'tradeScopeMemos', 'tradeScopeSymbolListV1', 'tradeScopeTopSummarySnapshotV1']) assert.equal(target.getItem(key), before[key]);
  const ui = fs.readFileSync(path.join(__dirname, '../profit/soneki.js'), 'utf8');
  assert.ok(!ui.includes('monthlyAccountStates')); assert.ok(!ui.includes(stateKey));
});
