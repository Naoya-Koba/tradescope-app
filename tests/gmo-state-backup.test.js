const test = require('node:test');
const assert = require('node:assert/strict');
const model = require('../assets/data-model-storage.js');
const tx = require('../assets/storage-transaction.js');
const { fixture, copy, MemoryStorage, backupHarness, now } = require('./gmo-support.js');
test('GMO generic v2 State validates without seeding or changing envelope version', () => {
  const data = fixture(); assert.equal(model.validateModels(data), true);
  assert.equal(data.monthlyAccountStates.schemaVersion, 1);
  const repo = model.createRepository(new MemoryStorage()); repo.commit(Object.fromEntries(Object.entries(data).filter(([, v]) => v !== null))); assert.deepEqual(repo.read(), data);
});
for (const [label, mutate] of [
  ['missing Snapshot', m => m.accountSnapshots.records = []],
  ['account mismatch', m => m.monthlyAccountStates.records[0].accountId = 'other'],
  ['month mismatch', m => m.monthlyAccountStates.records[0].targetMonth = '2026-10'],
  ['scope mismatch', m => m.accountSnapshots.records[0].sourceScope = 'sbi-cash'],
  ['approximate observation', m => m.accountSnapshots.records[0].observationType = 'approximateForMonth'],
  ['non-month-end', m => { m.accountSnapshots.records[0].snapshotAsOf = m.importBatches.records[0].snapshotAsOf = '2026-09-29'; }],
  ['CSV Batch', m => m.importBatches.records[0].sourceType = 'csv'],
  ['non-JPY', m => m.accountSnapshots.records[0].valuationCurrency = 'USD'],
  ['SBI refs mixed', m => m.monthlyAccountStates.records[0].cashAccountSnapshotId = 'as_gmo'],
  ['reported/adopted mismatch', m => m.monthlyAccountStates.records[0].realizedPnl = '11'],
  ['unknown field', m => m.monthlyAccountStates.records[0].filename = 'anonymous.pdf'],
  ['unsupported version', m => m.monthlyAccountStates.records[0].schemaVersion = 4]
]) test(`GMO State rejects ${label} before any write`, () => {
  const data = fixture(); mutate(data); const target = new MemoryStorage();
  assert.throws(() => model.createRepository(target).commit(data)); assert.equal(target.writes, 0);
});
test('v3 rejects new State; v4 accepts old and new States; decimal equality is numerical', () => {
  const data = fixture(); assert.throws(() => model.validateBackupModels(3, Object.fromEntries(model.backupModelEntities[3].map(k=>[k,data[k]]))));
  assert.equal(model.validateBackupModels(4, Object.fromEntries(model.backupModelEntities[4].map(k=>[k,data[k]]))), true);
  data.monthlyAccountStates.records[0].realizedPnl = '10.00'; assert.equal(model.validateModels(data), true);
  const old = copy(data); delete old.monthlyAccountStates.records[0].schemaVersion; delete old.monthlyAccountStates.records[0].adoptedAccountSnapshotId;
  assert.equal(model.validateBackupModels(3, Object.fromEntries(model.backupModelEntities[3].map(k=>[k,old[k]]))), true); assert.equal(model.validateBackupModels(4, Object.fromEntries(model.backupModelEntities[4].map(k=>[k,old[k]]))), true);
});
test('v1-v4 Restore semantics and new State v4 roundtrip', () => {
  const api = backupHarness(), target = new MemoryStorage(); model.createRepository(target).commit(Object.fromEntries(Object.entries(fixture()).filter(([, v]) => v !== null)));
  const exported = api.TradeScopeBackupExport.buildPayload(target, 'http://localhost', now);
  assert.equal(exported.backupVersion, 13); const empty = new MemoryStorage();
  api.TradeScopeBackupRestore.execute(api.TradeScopeBackupFormat.inspectValue(exported).restorePlan, empty);
  assert.deepEqual(model.readModels(empty), fixture());
  assert.deepEqual(copy(api.TradeScopeBackupExport.buildPayload(empty, 'http://localhost', now)), copy(exported));
  for (const version of [1, 2, 3, 4]) {
    const backup = copy(exported); backup.backupVersion = version;
    if (version === 1) delete backup.data.models;
    else { delete backup.data.models.transactionReconciliations; delete backup.data.models.monthlyAccountInputs; delete backup.data.models.importedTransactions; for (const entity of Object.keys(backup.data.models)) backup.data.models[entity] = null;
      if (version === 2) delete backup.data.models.monthlyAccountStates; }
    const seeded = new MemoryStorage(); model.createRepository(seeded).commit(Object.fromEntries(Object.entries(fixture()).filter(([, v]) => v !== null)));
    const before = seeded.getItem(model.keys.monthlyAccountStates);
    const parsed = api.TradeScopeBackupFormat.inspectValue(backup); assert.equal(parsed.ok, true);
    api.TradeScopeBackupRestore.execute(parsed.restorePlan, seeded);
    assert.equal(seeded.getItem(model.keys.monthlyAccountStates), version === 1 ? before : null);
    assert.equal(seeded.getItem(tx.journalKey), null);
  }
});
test('v4 Restore failures roll back every old and new key', () => {
  const api = backupHarness(), source = new MemoryStorage(); model.createRepository(source).commit(Object.fromEntries(Object.entries(fixture()).filter(([, v]) => v !== null)));
  const plan = api.TradeScopeBackupFormat.inspectValue(api.TradeScopeBackupExport.buildPayload(source)).restorePlan;
  for (const operation of plan.operations) {
    const target = new MemoryStorage({ tradingData: ' {"anonymous":true} ' }), before = target.snapshot();
    const set = target.setItem.bind(target), remove = target.removeItem.bind(target); let failed = false;
    const intercept = (key, action) => { if (!failed && key === operation.storageKey) { failed = true; throw Error('Anonymous quota'); } action(); };
    target.setItem = (key, value) => intercept(key, () => set(key, value)); target.removeItem = key => intercept(key, () => remove(key));
    assert.throws(() => api.TradeScopeBackupRestore.execute(plan, target)); assert.deepEqual(target.snapshot(), before);
  }
});
