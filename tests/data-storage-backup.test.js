// Independently invented fixtures only. No real browser storage, CSV or network.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto').webcrypto;
const model = require('../assets/data-model-storage.js');
const transaction = require('../assets/storage-transaction.js');
const root = path.resolve(__dirname, '..');
const now = '2030-01-20T12:00:00.000Z';
const copy = value => JSON.parse(JSON.stringify(value));
const envelope = records => ({ schemaVersion: 1, records, updatedAt: now });
const emptyModels = () => Object.fromEntries(Object.keys(model.keys).map(key => [key, null]));
class MemoryStorage {
  constructor(values = {}) { this.values = new Map(Object.entries(values)); this.writes = 0; this.failKey = null; this.mismatchKey = null; this.corruptAfterWrite = null; }
  getItem(key) {
    if (this.mismatchKey === key && this.corruptAfterWrite === key) { this.mismatchKey = null; return 'verification mismatch'; }
    return this.values.has(key) ? this.values.get(key) : null;
  }
  setItem(key, value) {
    this.writes++;
    if (this.failKey === key) { this.failKey = null; throw new Error('QuotaExceededError'); }
    this.values.set(key, value);
    if (this.mismatchKey === key) this.corruptAfterWrite = key;
  }
  removeItem(key) {
    this.writes++;
    if (this.failKey === key) { this.failKey = null; throw new Error('Removal failure'); }
    this.values.delete(key);
  }
  snapshot() { return Object.fromEntries([...this.values.entries()].sort(([a], [b]) => a.localeCompare(b))); }
}
function fixture() {
  const accountId = 'acc_sbi_sec', instrumentId = 'ins_fixture', importBatchId = 'batch_fixture';
  const source = { accountId, importBatchId, importedAt: now, targetMonth: '2029-12',
    snapshotAsOf: '2030-01-20', sourceMode: 'imported', sourceScope: 'domestic-holdings', observationType: 'approximateForMonth' };
  return {
    accounts: envelope(model.initialAccounts()),
    instruments: envelope([{ id: instrumentId, assetType: 'MutualFund', symbol: '架空投信', displayName: '架空投信', enabled: true }]),
    importBatches: envelope([{ id: importBatchId, accountId, sourceType: 'csv', sourceProvider: 'sbi', importedAt: now,
      targetMonth: source.targetMonth, snapshotAsOf: source.snapshotAsOf, sourceFileMetadata: { hash: 'a'.repeat(64), size: 100 } }]),
    rawTransactions: envelope([{ id: 'tx_fixture', accountId, instrumentId, importBatchId, sourceType: 'csv',
      sourceProvider: 'sbi', importedAt: now, executedAt: '2030-01-02', transactionType: '買付', side: 'buy', sourceRowNumber: 1,
      quantity: '0', price: '1234567890123456.123456789', fee: null, swap: '0', realizedPnl: null, currency: 'JPY',
      rawFields: { settlementOrPnl: '-123', name: '架空投信' } }]),
    accountSnapshots: envelope([{ id: 'as_fixture', ...source, valuationCurrency: 'JPY', assetValue: '0',
      cashBalance: null, unrealizedPnl: '0' }]),
    holdingSnapshots: envelope([{ id: 'hs_fixture', ...source, accountSnapshotId: 'as_fixture', instrumentId,
      quantity: '0', acquisitionPrice: null, marketPrice: '123.123456789', marketValue: '0', unrealizedPnl: null, currency: 'JPY' }])
  };
}
function seeded() {
  const result = { tradingData: JSON.stringify({ 2026: { 8: { gmo: { realizedPnL: 1, unrealizedPnL: 2 } },
    9: { sbi: { holdings: [{ quantity: 1, valueJPY: 2 }] } } } }), yearInitialFunds: '{"2026":{"gmo":10}}',
    yearInitialUnrealized: '{}', tradeScopeTradeHistoryV1: '[{"id":"legacy","unknownFact":"kept"}]',
    tradeScopeMemos: '[{"id":"memo","text":"匿名メモ"}]', tradeScopeSymbolListV1: '["USD/JPY"]',
    tradeInfo: '[{"legacy":"anonymous"}]', tradeScopeTopSummarySnapshotV1: '{"stale":true}' };
  for (const [entity, value] of Object.entries(fixture())) result[model.keys[entity]] = JSON.stringify(value);
  return new MemoryStorage(result);
}
function backupHarness(storage = new MemoryStorage()) {
  const source = fs.readFileSync(path.join(root, 'top/script.js'), 'utf8');
  const part = source.slice(source.indexOf('// ===== Backup Format Core'), source.indexOf('function exportAllData()'));
  const context = vm.createContext({ window: { location: { origin: 'http://127.0.0.1:54321' },
    TradeScopeDataStorage: model, TradeScopeStorageTransaction: transaction }, localStorage: storage,
    document: { getElementById: () => null, addEventListener() {} },
    isEmptyPlainRecord: value => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0,
    PROFIT_STORAGE_KEY_TRADING: 'tradingData', PROFIT_STORAGE_KEY_INITIAL: 'yearInitialFunds',
    PROFIT_STORAGE_KEY_INITIAL_UNREALIZED: 'yearInitialUnrealized', PROFIT_STORAGE_KEY_TOP_SUMMARY_SNAPSHOT: 'tradeScopeTopSummarySnapshotV1',
    console: { log() { throw new Error('No data logging'); }, error() { throw new Error('No data logging'); } } });
  vm.runInContext(part, context);
  return { format: context.window.TradeScopeBackupFormat, restore: context.window.TradeScopeBackupRestore,
    build: context.window.TradeScopeBackupExport.buildPayload };
}
function v1() {
  return { product: 'TradeScope', backupVersion: 1, exportedAt: now,
    data: { monthly: {}, initialFunds: {}, initialUnrealized: {}, transactions: [{ id: 'old', unknownFact: 'preserved' }],
      memos: [], symbols: [] } };
}
test('A: new model write/read via adapter preserves all six versioned envelopes', () => {
  const storage = new MemoryStorage(); const repo = model.createRepository(model.localStorageAdapter(storage), { clock: () => now });
  const values = fixture(); repo.commit(values);
  assert.deepEqual(repo.read(), values); assert.equal(storage.getItem(transaction.journalKey), null);
  for (const key of Object.values(model.keys)) assert.ok(storage.getItem(key));
});
test('module construction/read does not seed Accounts or touch any storage key', () => {
  const storage = new MemoryStorage(); const repo = model.createRepository(storage);
  assert.deepEqual(repo.read(), emptyModels()); assert.equal(storage.writes, 0);
  assert.equal(model.initialAccounts().length, 6); assert.equal(storage.writes, 0);
});
test('B: decimal precision, null and actual zero survive write/read without conversion', () => {
  const repo = model.createRepository(new MemoryStorage()); repo.commit(fixture());
  const item = repo.list('rawTransactions')[0];
  assert.equal(item.quantity, '0'); assert.equal(item.fee, null); assert.equal(item.swap, '0');
  assert.equal(item.price, '1234567890123456.123456789'); assert.equal(item.realizedPnl, null);
  assert.equal(item.rawFields.settlementOrPnl, '-123');
});
test('allowlisted raw blank/N-A cells keep their original form, without turning into zero', () => {
  const values = fixture(); values.rawTransactions.records[0].rawFields.fee = '';
  values.rawTransactions.records[0].rawFields.tax = '--';
  const repo = model.createRepository(new MemoryStorage()); repo.commit(values);
  assert.equal(repo.list('rawTransactions')[0].rawFields.fee, '');
  assert.equal(repo.list('rawTransactions')[0].rawFields.tax, '--');
  assert.equal(repo.list('rawTransactions')[0].fee, null);
});
test('Account rename/disable retains stable ID; physical deletion is not a Repository operation', () => {
  const repo = model.createRepository(new MemoryStorage(), { clock: () => now }); repo.commit(fixture());
  const account = repo.list('accounts').find(item => item.id === 'acc_sbi_sec');
  repo.upsert('accounts', { ...account, displayName: '匿名の別名', enabled: false });
  assert.equal(repo.list('rawTransactions')[0].accountId, account.id);
  assert.equal(repo.list('accounts').find(item => item.id === account.id).enabled, false);
  assert.throws(() => repo.save('accounts', repo.list('accounts').filter(item => item.id !== 'acc_smbc_bank')));
});

test('source locators cannot persist absolute paths/URLs; hash types and sparse JSON are rejected', () => {
  const storage = new MemoryStorage(), repo = model.createRepository(storage);
  for (const sourceLocator of ['C:\\anonymous\\file.csv', '/anonymous/file.csv', '\\\\host\\file.csv', 'file:///anonymous/file.csv', 'https://example.invalid/file.csv']) {
    const values = fixture(); values.rawTransactions.records[0].sourceLocator = sourceLocator;
    assert.throws(() => repo.commit(values));
    assert.equal(storage.writes, 0);
  }
  const values = fixture(); values.rawTransactions.records[0].sourceLocator = 'page:1-row:2';
  assert.equal(model.validateModels(values), true);
  values.importBatches.records[0].sourceFileMetadata.hash = 123;
  assert.throws(() => repo.commit(values));
  assert.throws(() => model.assertJson(new Array(1)));
  assert.equal(storage.writes, 0);
});
test('C: same-ID update is explicit; broker ID duplicates rejected, never merged', () => {
  const storage = new MemoryStorage(); const repo = model.createRepository(storage, { clock: () => now }); repo.commit(fixture());
  const item = repo.list('rawTransactions')[0]; repo.upsert('rawTransactions', { ...item, externalTransactionId: 'broker-fixture-id', fee: '0' });
  assert.equal(repo.list('rawTransactions').length, 1); assert.equal(repo.list('rawTransactions')[0].fee, '0');
  const before = storage.snapshot();
  assert.throws(() => repo.upsert('rawTransactions', { ...item, id: 'tx_other', sourceRowNumber: 2, externalTransactionId: 'broker-fixture-id' }));
  assert.deepEqual(storage.snapshot(), before);
});
test('C: fact fingerprint is only a candidate; legitimate identical facts on distinct rows retained', async () => {
  const repo = model.createRepository(new MemoryStorage(), { clock: () => now }); repo.commit(fixture());
  const item = repo.list('rawTransactions')[0], other = { ...item, id: 'tx_other', sourceRowNumber: 2 };
  const a = await model.dedupeCandidate(item, crypto), b = await model.dedupeCandidate(other, crypto);
  assert.deepEqual(a, b); assert.equal(a.automaticMerge, false);
  repo.upsert('rawTransactions', other); assert.equal(repo.list('rawTransactions').length, 2);
  const external = await model.dedupeCandidate({ ...item, externalTransactionId: 'fixture-id' }, crypto);
  assert.equal(external.kind, 'external-id'); assert.equal(external.automaticMerge, false);
  assert.equal((await model.hashBytes(new Uint8Array([1, 2]), crypto)).length, 64);
  assert.match(model.newId('tx', crypto), /^tx_[a-f0-9-]+$/);
});
test('D: Repository write fails halfway and restores all prior raw strings and absent keys', () => {
  const storage = new MemoryStorage({ tradeScopeAccountsV1: JSON.stringify(fixture().accounts), tradingData: '{"unchanged":true}' });
  const before = storage.snapshot(); storage.failKey = model.keys.rawTransactions;
  assert.throws(() => model.createRepository(storage).commit(fixture()), /元の状態へ戻しました/);
  assert.deepEqual(storage.snapshot(), before);
});
test('D: journal quota failure never begins primary writes', () => {
  const storage = new MemoryStorage(); const before = storage.snapshot(); storage.failKey = transaction.journalKey;
  assert.throws(() => model.createRepository(storage).commit(fixture()), /ジャーナルを保存できません/);
  assert.deepEqual(storage.snapshot(), before);
});
test('read corruption/unsupported schema does not silently replace or initialise data', () => {
  const storage = new MemoryStorage({ [model.keys.accounts]: 'broken JSON' }); const before = storage.snapshot();
  assert.throws(() => model.createRepository(storage).read()); assert.deepEqual(storage.snapshot(), before);
  const values = fixture(); values.accounts.schemaVersion = 999;
  assert.throws(() => model.validateModels(values));
});
test('Snapshot source/observation/reference consistency is validated; month is not the observed date', () => {
  const values = fixture(); model.validateModels(values);
  assert.equal(values.holdingSnapshots.records[0].targetMonth, '2029-12');
  assert.equal(values.holdingSnapshots.records[0].snapshotAsOf, '2030-01-20');
  values.holdingSnapshots.records[0].snapshotAsOf = '2029-12-31'; assert.throws(() => model.validateModels(values));
  const separate = fixture(); separate.holdingSnapshots.records[0].importBatchId = 'missing';
  assert.throws(() => model.validateModels(separate));
});
test('manual observation can be unknown, but invalid dates/fictional time normalisation never enter storage', () => {
  const values = fixture(); values.accountSnapshots = envelope([]); values.holdingSnapshots = envelope([]);
  values.accountSnapshots.records.push({ id: 'manual_snapshot', accountId: 'acc_smbc_bank', sourceMode: 'manual',
    sourceScope: 'cash', importedAt: now, snapshotAsOf: null, cashBalance: '0' });
  model.validateModels(values);
  values.accountSnapshots.records[0].snapshotAsOf = '2030-02-30'; assert.throws(() => model.validateModels(values));
});
test('E/K: v1 full restore keeps new models and absent legacy tradeInfo; unknown history fields survive', () => {
  const storage = seeded(), before = storage.snapshot(), h = backupHarness(storage);
  const inspection = h.format.inspectValue(v1()); assert.equal(inspection.ok, true);
  h.restore.execute(inspection.restorePlan, storage);
  for (const key of Object.values(model.keys)) assert.equal(storage.getItem(key), before[key]);
  assert.equal(storage.getItem('tradeInfo'), before.tradeInfo);
  assert.equal(JSON.parse(storage.getItem('tradeScopeTradeHistoryV1'))[0].unknownFact, 'preserved');
  assert.equal(storage.getItem('profitSkipDemoSeed'), '1');
  assert.equal(storage.getItem('tradeScopeTopSummarySnapshotV1'), null);
  assert.equal(storage.getItem(transaction.journalKey), null);
});
test('v1 restore does not parse, reset or migrate even an unreadable/future new-model key', () => {
  const target = seeded(); target.setItem(model.keys.accounts, '{"schemaVersion":999,"futureData":true}');
  target.setItem(model.keys.rawTransactions, 'unreadable new-model data');
  const before = target.snapshot(), h = backupHarness(target);
  h.restore.execute(h.format.inspectValue(v1()).restorePlan, target);
  for (const key of Object.values(model.keys)) assert.equal(target.getItem(key), before[key]);
});
test('F: v2 export -> cleared anonymous fixture -> restore -> re-export exact data equality', () => {
  const source = seeded(), h = backupHarness(source), before = source.snapshot();
  const payload = h.build(source, 'http://127.0.0.1:54321', now);
  assert.deepEqual(source.snapshot(), before); assert.equal(payload.backupVersion, 2);
  assert.equal(payload.source.origin, 'http://127.0.0.1:54321');
  const target = new MemoryStorage(), targetHarness = backupHarness(target);
  const inspection = targetHarness.format.inspectJson(JSON.stringify(payload)); assert.equal(inspection.ok, true);
  targetHarness.restore.execute(inspection.restorePlan, target);
  const reexport = targetHarness.build(target, payload.source.origin, now);
  assert.deepEqual(copy(reexport), copy(payload)); assert.equal(target.getItem(transaction.journalKey), null);
});
test('F: v2 missing model keys use null, not invented timestamps/seeds; restore reproduces absence', () => {
  const empty = new MemoryStorage(), h = backupHarness(empty), payload = h.build(empty, 'http://localhost', now);
  assert.deepEqual(copy(payload.data.models), emptyModels()); assert.equal(empty.writes, 0);
  const target = seeded(); h.restore.execute(h.format.inspectValue(payload).restorePlan, target);
  for (const key of Object.values(model.keys)) assert.equal(target.getItem(key), null);
  assert.equal(target.getItem('tradeInfo'), '[{"legacy":"anonymous"}]');
  assert.equal(target.getItem('profitSkipDemoSeed'), '1');
});
test('G: v2 halfway failure rolls back legacy + new models + cache to byte-for-byte prior state', () => {
  const source = seeded(), h = backupHarness(source), payload = h.build(source, 'http://localhost', now);
  const target = new MemoryStorage({ tradingData: ' {"preserveWhitespace":true} ',
    tradeScopeMemos: '[{"old":true}]', tradeScopeTopSummarySnapshotV1: '{"old":true}' });
  const before = target.snapshot(); target.failKey = model.keys.rawTransactions;
  assert.throws(() => h.restore.execute(h.format.inspectValue(payload).restorePlan, target), /元の状態へ戻しました/);
  assert.deepEqual(target.snapshot(), before);
});
test('G: readback mismatch also rolls back; invalid journal cannot target arbitrary storage keys', () => {
  const target = seeded(), before = target.snapshot(), h = backupHarness(target);
  target.mismatchKey = 'tradeScopeMemos';
  assert.throws(() => h.restore.execute(h.format.inspectValue(v1()).restorePlan, target));
  assert.deepEqual(target.snapshot(), before);
  const journal = { product: 'TradeScope', journalVersion: 1, entries: [{ storageKey: 'credentials', existed: false, previousRawValue: null }] };
  target.setItem(transaction.journalKey, JSON.stringify(journal)); const saved = target.snapshot();
  assert.throws(() => h.restore.recoverPending(target)); assert.deepEqual(target.snapshot(), saved);
});
test('pending valid journals recover new and legacy keys without normalisation', () => {
  const storage = new MemoryStorage({ tradingData: ' {"before":1} ' });
  const actions = [{ type: 'set', storageKey: 'tradingData', rawValue: '{}' },
    { type: 'set', storageKey: model.keys.accounts, rawValue: JSON.stringify(fixture().accounts) }];
  transaction.createJournal(actions, storage);
  storage.setItem('tradingData', '{}'); storage.setItem(model.keys.accounts, actions[1].rawValue);
  assert.throws(() => model.createRepository(storage).commit(fixture()), /ジャーナル/);
  assert.equal(transaction.recover(storage), true);
  assert.deepEqual(storage.snapshot(), { tradingData: ' {"before":1} ' });
});
test('H/I: broken JSON, unknown versions, bad types, missing/unknown models, duplicate IDs, unsafe keys rejected before writes', () => {
  const storage = seeded(), h = backupHarness(storage), good = h.build(storage, 'http://localhost', now);
  const mutations = [value => { value.backupVersion = 99; }, value => { value.product = 'Other'; },
    value => { value.data.models.accounts.schemaVersion = 2; }, value => { delete value.data.models.rawTransactions; },
    value => { value.data.models.unknown = envelope([]); }, value => { value.data.models.accounts.records.push(value.data.models.accounts.records[0]); },
    value => { value.data.models.rawTransactions.records[0].quantity = 0; }, value => { value.data.models.accounts.records[0].enabled = 'yes'; },
    value => { value.data.models.rawTransactions.records[0].strategy = 'forbidden'; },
    value => { value.data.models.rawTransactions.records[0].rawFields.accountNumber = 'PRIVATE_MARKER'; },
    value => { value.data.models.importBatches.records[0].sourceFileMetadata.fileName = 'PRIVATE_MARKER'; }];
  const before = storage.snapshot(), writes = storage.writes;
  for (const mutate of mutations) { const value = copy(good); mutate(value); assert.equal(h.format.inspectValue(value).ok, false); }
  assert.equal(h.format.inspectJson('{broken').ok, false);
  assert.equal(h.format.inspectJson(JSON.stringify(good).replace('"models":{', '"models":{"__proto__":{},')).ok, false);
  assert.deepEqual(storage.snapshot(), before); assert.equal(storage.writes, writes); assert.equal({}.polluted, undefined);
});
test('H: invalid/forged restore plans cannot bypass type validation or write outside the allowlist', () => {
  const storage = seeded(), before = storage.snapshot(), h = backupHarness(storage);
  const plan = copy(h.format.inspectValue(v1()).restorePlan);
  plan.operations.push({ type: 'set', storageKey: 'credentials', value: 'forbidden' });
  assert.throws(() => h.restore.execute(plan, storage));
  const wrong = copy(h.format.inspectValue(v1()).restorePlan); wrong.operations[0].value = [];
  assert.throws(() => h.restore.execute(wrong, storage)); assert.deepEqual(storage.snapshot(), before);
});
test('J: PII/raw document fields are rejected, not silently removed or leaked into backup', () => {
  const storage = seeded(), repo = model.createRepository(storage), before = storage.snapshot();
  for (const field of ['csvText', 'pdfText', 'rawRow', 'absolutePath', 'fileName', 'address', 'accountNumber', 'userId']) {
    const values = fixture(); values.importBatches.records[0][field] = 'PRIVATE_MARKER';
    assert.throws(() => repo.commit(values));
  }
  const h = backupHarness(storage), exported = JSON.stringify(h.build(storage, 'http://localhost', now));
  assert.ok(!exported.includes('PRIVATE_MARKER')); assert.deepEqual(storage.snapshot(), before);
});
test('K: all three old formats remain partial; omitted data/new keys remain untouched', () => {
  const inputs = [
    { tradescope: 'all-backup', exportedAt: now, profitData: { tradingData: {}, yearInitialFunds: {} }, historyData: { entries: [] } },
    { exportedAt: now, tradingData: {}, yearInitialFunds: {}, yearInitialUnrealized: {} },
    { tradescope: 'history-backup', exportedAt: now, entries: [] }
  ];
  for (const value of inputs) {
    const storage = seeded(), before = storage.snapshot(), h = backupHarness(storage), inspection = h.format.inspectValue(value);
    assert.equal(inspection.ok, true); assert.equal(inspection.restorePlan.mode, 'legacy-partial');
    h.restore.execute(inspection.restorePlan, storage);
    for (const key of [...Object.values(model.keys), 'tradeScopeMemos', 'tradeScopeSymbolListV1', 'tradeInfo']) assert.equal(storage.getItem(key), before[key]);
  }
});
test('L: Repository storage is independent of all existing monthly/top/history/backup data', () => {
  const storage = seeded(), before = storage.snapshot(), repo = model.createRepository(storage, { clock: () => now });
  const account = repo.list('accounts')[0]; repo.upsert('accounts', { ...account, displayName: '匿名変更' });
  for (const key of ['tradingData', 'yearInitialFunds', 'yearInitialUnrealized', 'tradeScopeTradeHistoryV1',
    'tradeScopeMemos', 'tradeScopeSymbolListV1', 'tradeScopeTopSummarySnapshotV1']) assert.equal(storage.getItem(key), before[key]);
  const html = fs.readFileSync(path.join(root, 'import.html'), 'utf8');
  assert.ok(!/data-model-storage|storage-transaction/.test(html));
  const preview = fs.readFileSync(path.join(root, 'import/preview.js'), 'utf8');
  assert.ok(!/TradeScopeDataStorage|createRepository|\.save\(|\.commit\(|localStorage|sessionStorage|indexedDB/.test(preview));
});
test('every v2 write/removal position, including Snapshot and journal cleanup, rolls back exactly', () => {
  const h = backupHarness(), payload = h.build(seeded(), 'http://localhost', now);
  const plan = h.format.inspectValue(payload).restorePlan;
  for (const failureKey of [...plan.operations.map(item => item.storageKey), 'tradeScopeTopSummarySnapshotV1', transaction.journalKey]) {
    const target = new MemoryStorage({ tradingData: ' {"before":1} ', tradeScopeTopSummarySnapshotV1: '{"cache":true}' });
    const before = target.snapshot();
    if (failureKey === transaction.journalKey) {
      const remove = target.removeItem.bind(target);
      target.removeItem = key => {
        if (key === transaction.journalKey) { target.removeItem = remove; throw new Error('Cleanup failure'); }
        remove(key);
      };
    } else target.failKey = failureKey;
    assert.throws(() => h.restore.execute(plan, target)); assert.deepEqual(target.snapshot(), before);
  }
});
test('actual quota budget exhausted after journal/first write still preserves the original state', () => {
  const probe = new MemoryStorage();
  const actions = Object.entries(fixture()).map(([entity, value]) => ({ type: 'set', storageKey: model.keys[entity], rawValue: JSON.stringify(value) }));
  transaction.createJournal(actions, probe);
  const size = values => [...values.entries()].reduce((sum, [key, value]) => sum + key.length + value.length, 0);
  const budget = size(probe.values) + actions[0].storageKey.length + actions[0].rawValue.length + 1;
  class QuotaStorage extends MemoryStorage {
    setItem(key, value) {
      const next = new Map(this.values); next.set(key, value);
      if (size(next) > budget) throw new Error('QuotaExceededError');
      super.setItem(key, value);
    }
  }
  const target = new QuotaStorage();
  assert.throws(() => model.createRepository(target).commit(fixture()), /元の状態へ戻しました/);
  assert.deepEqual(target.snapshot(), {});
});
test('rollback failure retains journal and blocks further saves until explicit recovery', () => {
  const target = new MemoryStorage({ tradingData: ' {"before":1} ' }), h = backupHarness(target);
  const plan = h.format.inspectValue(v1()).restorePlan;
  const set = target.setItem.bind(target);
  let failed = false;
  target.setItem = (key, value) => {
    if (key === 'tradeScopeMemos') { failed = true; throw new Error('Storage unavailable'); }
    if (failed && key === 'tradingData') throw new Error('Storage unavailable');
    set(key, value);
  };
  assert.throws(() => h.restore.execute(plan, target), /元の状態へ戻せません/);
  assert.notEqual(target.getItem(transaction.journalKey), null);
  assert.throws(() => model.createRepository(target).commit(fixture()), /ジャーナル/);
  target.setItem = set; h.restore.recoverPending(target);
  assert.deepEqual(target.snapshot(), { tradingData: ' {"before":1} ' });
});
test('empty v1 and optional tradeInfo remain compatible; journal failure cannot start restore', () => {
  const target = seeded(), h = backupHarness(target), value = v1();
  value.data.transactions = []; value.data.legacy = { tradeInfo: [{ legacy: 'restored' }] };
  const before = target.snapshot(); target.failKey = transaction.journalKey;
  assert.throws(() => h.restore.execute(h.format.inspectValue(value).restorePlan, target), /ジャーナルを保存できません/);
  assert.deepEqual(target.snapshot(), before);
  h.restore.execute(h.format.inspectValue(value).restorePlan, target);
  assert.equal(target.getItem('tradeInfo'), '[{"legacy":"restored"}]');
  assert.equal(target.getItem('profitSkipDemoSeed'), '1');
});
test('module load has no storage/network/log effects and PWA HTML/SW share versioned dependencies', () => {
  const deny = () => { throw new Error('Forbidden side effect'); };
  const context = vm.createContext({ localStorage: new Proxy({}, { get: deny }), sessionStorage: new Proxy({}, { get: deny }),
    indexedDB: new Proxy({}, { get: deny }), fetch: deny, XMLHttpRequest: deny, WebSocket: deny, console: { log: deny, error: deny } });
  for (const file of ['storage-transaction.js', 'data-model-storage.js']) {
    const code = fs.readFileSync(path.join(root, 'assets', file), 'utf8');
    assert.ok(!/fetch\(|XMLHttpRequest|WebSocket|sendBeacon|console\.|sessionStorage|indexedDB/.test(code));
    vm.runInContext(code, context);
  }
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
  for (const file of ['storage-transaction.js', 'data-model-storage.js']) {
    const url = `assets/${file}?v=20261009-1`; assert.ok(html.includes(url)); assert.ok(sw.includes('./' + url));
  }
  assert.ok(html.indexOf('storage-transaction.js') < html.indexOf('data-model-storage.js'));
  assert.match(html, /topScriptVersion = '20261009-1'/); assert.ok(sw.includes('./top/script.js?v=20261009-1'));
});
