// Entirely invented fixtures. No real CSV, browser Storage or network is used.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const cryptoApi = require('node:crypto').webcrypto;
const model = require('../assets/data-model-storage.js');
const transaction = require('../assets/storage-transaction.js');
const parser = require('../import/sbi-parser.js');
const preview = require('../import/model-preview.js');
const engine = require('../import/sbi-save.js');
const root = path.resolve(__dirname, '..');
const metricsContext = vm.createContext({ window: {} });
vm.runInContext(fs.readFileSync(path.join(root, 'assets/profit-metrics.js'), 'utf8'), metricsContext);
const metrics = metricsContext.window.TradeScopeProfitMetrics;
const now = '2030-10-05T12:34:56.000Z';
const copy = value => JSON.parse(JSON.stringify(value));
const envelope = records => ({ schemaVersion: 1, records, updatedAt: now });
const stock = '商品区分,銘柄名,銘柄コード,預り区分,保有数量,取得単価,現在値,評価額,評価損益\n' +
  '国内株式,架空株,ZZ01,特定,0,,0.123456789123456789,0,0\n';
const trades = '約定日,銘柄,銘柄コード,市場,商品区分,取引,預り,約定数量,約定単価,受渡日,受渡金額/決済損益,手数料/諸経費等\n' +
  '2030/09/01,架空株,ZZ01,東証,国内株式,現物買,特定,0,0.123456789123456789,2030/09/04,-123,--\n';
const fund = '投資信託（金額/NISA預り（成長投資枠））\nファンド名,保有口数,基準価額,評価額\n架空投信,0口,0,0\n';
const fundTrade = '約定日,銘柄,取引,約定数量,約定単価\n2030/10/01,架空投信,投信金額買付,0,0\n';
function source(kind = 'holdings', text = stock, hash = 'a'.repeat(64)) {
  return { preview: parser.parse(text, kind), metadata: { hash, size: Buffer.byteLength(text) },
    targetMonth: kind === 'holdings' ? '2030-09' : null, snapshotAsOf: kind === 'holdings' ? '2030-10-04' : null };
}
class Storage {
  constructor(values = {}) { this.values = new Map(Object.entries(values)); this.actions = []; this.failKey = null; this.mismatchKey = null; this.written = new Set(); }
  getItem(key) {
    if (key === this.mismatchKey && this.written.has(key)) { this.mismatchKey = null; return 'mismatch'; }
    return this.values.get(key) ?? null;
  }
  setItem(key, value) {
    this.actions.push(['set', key]);
    if (key === this.failKey) { this.failKey = null; throw new Error('quota'); }
    this.values.set(key, value); this.written.add(key);
  }
  removeItem(key) { this.actions.push(['remove', key]); this.values.delete(key); }
  snapshot() { return Object.fromEntries([...this.values].sort(([a], [b]) => a.localeCompare(b))); }
}
const service = (storage, options = {}) => engine.createService(storage, { clock: () => now, cryptoApi, ...options });
function seed(storage, changes) {
  const before = model.readModels(storage);
  model.validateModels({ ...before, ...changes });
  for (const [entity, value] of Object.entries(changes)) storage.values.set(model.keys[entity], JSON.stringify(value));
}
const sbiAccount = () => model.initialAccounts().find(item => item.id === 'acc_sbi_sec');
function backupHarness(storage) {
  const source = fs.readFileSync(path.join(root, 'top/script.js'), 'utf8');
  const part = source.slice(source.indexOf('// ===== Backup Format Core'), source.indexOf('function exportAllData()'));
  const context = vm.createContext({ window: { location: { origin: 'http://127.0.0.1:54321' },
    TradeScopeDataStorage: model, TradeScopeStorageTransaction: transaction }, localStorage: storage,
    document: { getElementById: () => null, addEventListener() {} },
    isEmptyPlainRecord: value => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0,
    PROFIT_STORAGE_KEY_TRADING: 'tradingData', PROFIT_STORAGE_KEY_INITIAL: 'yearInitialFunds',
    PROFIT_STORAGE_KEY_INITIAL_UNREALIZED: 'yearInitialUnrealized', PROFIT_STORAGE_KEY_TOP_SUMMARY_SNAPSHOT: 'tradeScopeTopSummarySnapshotV1' });
  vm.runInContext(part, context);
  return { build: context.window.TradeScopeBackupExport.buildPayload,
    format: context.window.TradeScopeBackupFormat, restore: context.window.TradeScopeBackupRestore };
}

test('construction/read/Preview never seed Accounts or persist a key; UI delegates to service', async () => {
  const storage = new Storage(), save = service(storage), before = storage.snapshot();
  assert.deepEqual(save.read(), preview.emptyModels());
  await preview.convert([source()], preview.readExisting(storage), preview.createSession(cryptoApi));
  assert.deepEqual(storage.snapshot(), before); assert.equal(storage.actions.length, 0);
  const html = fs.readFileSync(path.join(root, 'import.html'), 'utf8');
  const ui = fs.readFileSync(path.join(root, 'import/preview.js'), 'utf8');
  assert.ok(html.includes('import/sbi-save.js')); assert.ok(!/\.commit\(/.test(ui));
});
test('Holdings new file creates only required four collections, one Batch and one transaction', async () => {
  const storage = new Storage(), input = source(), before = JSON.stringify(input);
  const outcome = await service(storage).save(input);
  assert.equal(outcome.status, 'saved'); assert.equal(outcome.recordCount, 1);
  const saved = model.readModels(storage), batch = saved.importBatches.records[0], holding = saved.holdingSnapshots.records[0];
  assert.equal(saved.accounts.records.length, 1); assert.equal(saved.accounts.records[0].id, 'acc_sbi_sec');
  assert.equal(saved.instruments.records.length, 1); assert.equal(holding.instrumentId, saved.instruments.records[0].id);
  assert.equal(holding.importBatchId, batch.id); assert.equal(holding.accountId, batch.accountId);
  assert.equal(batch.importedAt, now); assert.equal(holding.importedAt, now);
  assert.equal(batch.importerVersion, parser.version); assert.equal(batch.sourceType, 'csv');
  assert.equal(holding.targetMonth, '2030-09'); assert.equal(holding.snapshotAsOf, '2030-10-04');
  assert.ok(!Object.hasOwn(holding, 'observationType'));
  assert.equal(saved.accountSnapshots, null); assert.equal(saved.rawTransactions, null);
  assert.equal(storage.actions.filter(([type, key]) => type === 'set' && key === transaction.journalKey).length, 1);
  assert.equal(storage.getItem(transaction.journalKey), null); assert.equal(JSON.stringify(input), before);
});
test('Execution saves facts, decimal precision/null/0 and original mixed settlement column', async () => {
  const storage = new Storage(); assert.equal((await service(storage).save(source('transactions', trades))).status, 'saved');
  const saved = model.readModels(storage), tx = saved.rawTransactions.records[0];
  assert.equal(tx.quantity, '0'); assert.equal(tx.price, '0.123456789123456789'); assert.equal(tx.fee, null);
  assert.equal(tx.realizedPnl, null); assert.equal(tx.rawFields.settlementOrPnl, '-123');
  assert.equal(tx.importedAt, now); assert.equal(saved.holdingSnapshots, null); assert.equal(saved.accountSnapshots, null);
});
test('existing edited SBI Account and Instrument reused without any overwrite or envelope update', async () => {
  const storage = new Storage();
  seed(storage, { accounts: envelope([{ ...sbiAccount(), displayName: 'ユーザー名義ではない別表示', legacyRefs: ['custom'] }]),
    instruments: envelope([{ id: 'ins_existing', assetType: 'Stock', symbol: 'ZZ01', displayName: '別表示',
      enabled: true, aliases: ['別名'], userAdded: true }]) });
  const before = storage.snapshot(); assert.equal((await service(storage).save(source())).status, 'saved');
  assert.equal(storage.getItem(model.keys.accounts), before[model.keys.accounts]);
  assert.equal(storage.getItem(model.keys.instruments), before[model.keys.instruments]);
  assert.equal(model.readModels(storage).holdingSnapshots.records[0].instrumentId, 'ins_existing');
});
test('conflicting provider/type or disabled SBI Account cannot be overwritten', async () => {
  for (const edit of [{ providerCode: 'other' }, { accountType: 'fx' }, { enabled: false }]) {
    const storage = new Storage(); seed(storage, { accounts: envelope([{ ...sbiAccount(), ...edit }]) });
    const before = storage.snapshot(); assert.equal((await service(storage).save(source())).status, 'conflict');
    assert.deepEqual(storage.snapshot(), before); assert.equal(storage.actions.length, 0);
  }
});
test('multiple Instruments/holdings and custody records share one observed Batch', async () => {
  const text = stock + '国内株式,別架空株,ZZ02,NISA,1,0,1,1,1\n国内株式,架空株,ZZ01,NISA,1,0,1,1,1\n';
  const storage = new Storage(); const outcome = await service(storage).save(source('holdings', text));
  assert.equal(outcome.status, 'saved'); const saved = model.readModels(storage);
  assert.equal(saved.instruments.records.length, 2); assert.equal(saved.holdingSnapshots.records.length, 3);
  assert.equal(new Set(saved.holdingSnapshots.records.map(item => item.importBatchId)).size, 1);
  assert.equal(saved.holdingSnapshots.records[0].instrumentId, saved.holdingSnapshots.records[2].instrumentId);
  assert.notEqual(saved.holdingSnapshots.records[0].rawFields.custody, saved.holdingSnapshots.records[2].rawFields.custody);
});
test('two files commit separately; exact SBI fund identity reused across Holdings and Execution', async () => {
  const storage = new Storage(), save = service(storage);
  assert.equal((await save.save(source('holdings', fund))).status, 'saved');
  assert.equal((await save.save(source('transactions', fundTrade, 'b'.repeat(64)))).status, 'saved');
  const saved = save.read(); assert.equal(saved.instruments.records.length, 1); assert.equal(saved.importBatches.records.length, 2);
  assert.equal(saved.rawTransactions.records[0].instrumentId, saved.holdingSnapshots.records[0].instrumentId);
  assert.equal(saved.rawTransactions.records[0].transactionType, '投信金額買付');
  assert.equal(storage.actions.filter(([type, key]) => type === 'set' && key === transaction.journalKey).length, 2);
});
test('Preview and save-time resolution share whitespace identity and preserve original labels', async () => {
  const storage = new Storage(), save = service(storage);
  const holding = source('holdings', fund.replace('架空投信', '架空　投信'));
  assert.equal((await save.save(holding)).status, 'saved');
  const existing = save.read(), id = existing.instruments.records[0].id;
  const instrumentBytes = storage.getItem(model.keys.instruments);
  const input = source('transactions', fundTrade.replace('架空投信', '架空  投信'), 'b'.repeat(64));
  const draft = await preview.convert([input], existing, preview.createSession(cryptoApi));
  assert.equal(draft.files[0].transactions[0].instrumentId, id);
  assert.equal((await save.inspect(input)).status, 'ready');
  assert.equal((await save.save(input)).status, 'saved');
  const saved = save.read();
  assert.equal(saved.instruments.records.length, 1);
  assert.equal(saved.rawTransactions.records[0].instrumentId, id);
  assert.equal(storage.getItem(model.keys.instruments), instrumentBytes);
  assert.equal(saved.instruments.records[0].symbol, '架空　投信');
  assert.equal(saved.instruments.records[0].displayName, '架空　投信');
  assert.equal(saved.holdingSnapshots.records[0].rawFields.name, '架空　投信');
  assert.equal(saved.rawTransactions.records[0].rawFields.name, '架空  投信');
});

test('whitespace identity preserves already-imported and transaction fingerprint protection', async () => {
  const storage = new Storage(), save = service(storage);
  const input = source('transactions', fundTrade.replace('架空投信', '架空　投信'));
  assert.equal((await save.save(input)).status, 'saved');
  const before = storage.snapshot(), actions = storage.actions.length;
  assert.equal((await save.save(input)).status, 'already-imported');
  const other = source('transactions', fundTrade, 'b'.repeat(64));
  const outcome = await save.save(other);
  assert.equal(outcome.status, 'review-required');
  assert.equal(outcome.reason, 'duplicate-transaction');
  assert.deepEqual(storage.snapshot(), before);
  assert.equal(storage.actions.length, actions);
});

test('save-time normalized fund ambiguity never chooses, merges or deletes existing IDs', async () => {
  const storage = new Storage(), save = service(storage);
  assert.equal((await save.save(source('holdings', fund))).status, 'saved');
  const saved = save.read();
  seed(storage, {
    instruments: envelope([...saved.instruments.records,
      { ...saved.instruments.records[0], id: 'ins_other', symbol: '架空 投信', displayName: '架空 投信' }]),
    holdingSnapshots: envelope([...saved.holdingSnapshots.records,
      { ...saved.holdingSnapshots.records[0], id: 'holding_other', instrumentId: 'ins_other',
        rawFields: { ...saved.holdingSnapshots.records[0].rawFields, name: '架空 投信' } }])
  });
  const before = storage.snapshot(), actions = storage.actions.length;
  const input = source('transactions', fundTrade, 'b'.repeat(64));
  assert.equal((await save.inspect(input)).status, 'review-required');
  assert.equal((await save.save(input)).status, 'review-required');
  assert.deepEqual(storage.snapshot(), before);
  assert.equal(storage.actions.length, actions);
});

test('code-free fund saves independently of current holdings; similar name is not merged', async () => {
  const storage = new Storage(), save = service(storage);
  await save.save(source('transactions', fundTrade));
  await save.save(source('transactions', fundTrade.replace('架空投信', '架空投信別'), 'b'.repeat(64)));
  assert.equal(save.read().instruments.records.length, 2); assert.equal(save.read().rawTransactions.records.length, 2);
});
test('exact file reimport returns already-imported with every key byte-for-byte unchanged', async () => {
  for (const input of [source(), source('transactions', trades)]) {
    const storage = new Storage(), save = service(storage); await save.save(input);
    const before = storage.snapshot(), count = storage.actions.length;
    assert.equal((await save.save(input)).status, 'already-imported');
    assert.deepEqual(storage.snapshot(), before); assert.equal(storage.actions.length, count);
  }
});
test('same Holdings observation, different hash -> conflict without append or replacement', async () => {
  const storage = new Storage(), save = service(storage); await save.save(source()); const before = storage.snapshot();
  const outcome = await save.save(source('holdings', stock, 'b'.repeat(64)));
  assert.equal(outcome.status, 'conflict'); assert.equal(outcome.reason, 'holding-observation');
  assert.deepEqual(storage.snapshot(), before);
});
test('matching transaction candidate from another file -> whole-file review, no merge/delete/partial save', async () => {
  const storage = new Storage(), save = service(storage); await save.save(source('transactions', trades));
  const before = storage.snapshot();
  const text = trades + '2030/09/02,別架空株,ZZ02,東証,国内株式,現物買,特定,1,1,2030/09/05,-1,--\n';
  const outcome = await save.save(source('transactions', text, 'b'.repeat(64)));
  assert.equal(outcome.status, 'review-required'); assert.equal(outcome.reason, 'duplicate-transaction');
  assert.deepEqual(storage.snapshot(), before);
});
test('ambiguous/conflicting/disabled Instrument stops entire file, no automatic merge', async () => {
  for (const instruments of [
    [{ id: 'ins_a', assetType: 'Stock', symbol: 'ZZ01', displayName: 'A', enabled: true },
      { id: 'ins_b', assetType: 'Stock', symbol: 'ZZ01', displayName: 'B', enabled: true }],
    [{ id: 'ins_a', assetType: 'MutualFund', symbol: 'ZZ01', displayName: 'A', enabled: true }],
    [{ id: 'ins_a', assetType: 'Stock', symbol: 'ZZ01', displayName: 'A', enabled: false }]
  ]) {
    const storage = new Storage(); seed(storage, { instruments: envelope(instruments) }); const before = storage.snapshot();
    assert.equal((await service(storage).save(source())).status, 'review-required'); assert.deepEqual(storage.snapshot(), before);
  }
});
test('invalid or unresolved source rejects before writing (including empty files and future Parser)', async () => {
  const invalid = [source('transactions', trades.replace('現物買', '未知').replace(',ZZ01', ',').replace(',国内株式', ',')),
    source('holdings', stock.replace(',0,,', ',wrong,,')), source('holdings', stock.split('\n')[0]),
    { ...source(), targetMonth: null }, { ...source(), snapshotAsOf: null }, { ...source(), metadata: { hash: 'bad', size: 0 } }];
  const future = source(); future.preview.parserVersion = 'unknown'; invalid.push(future);
  for (const input of invalid) {
    const storage = new Storage(), before = storage.snapshot();
    assert.notEqual((await service(storage).save(input)).status, 'saved'); assert.deepEqual(storage.snapshot(), before);
    assert.equal(storage.actions.length, 0);
  }
});
test('Parser warnings stop before any record is saved; total mismatch is never corrected', async () => {
  const input = source(); input.preview.issues.push({ severity: 'warning', code: 'totals', message: 'anonymous' });
  const storage = new Storage(); assert.equal((await service(storage).save(input)).status, 'review-required');
  assert.equal(storage.actions.length, 0);
});
test('save-time timestamp validation failure leaves Storage untouched', async () => {
  const storage = new Storage(); assert.equal((await service(storage, { clock: () => 'invalid' }).save(source())).status, 'invalid');
  assert.equal(storage.actions.length, 0);
});
test('journal allocation failure cannot start primary writes', async () => {
  const storage = new Storage(), before = storage.snapshot(); storage.failKey = transaction.journalKey;
  await assert.rejects(service(storage).save(source()), /ジャーナルを保存できません/);
  assert.deepEqual(storage.snapshot(), before);
  assert.ok(storage.actions.every(([, key]) => key === transaction.journalKey));
});
test('every primary write failure restores existing raw strings and originally absent keys', async () => {
  for (const entity of ['accounts', 'instruments', 'importBatches', 'holdingSnapshots', 'rawTransactions']) {
    const storage = new Storage({ tradingData: ' {"unchanged":true} ' }), before = storage.snapshot();
    storage.failKey = model.keys[entity];
    await assert.rejects(service(storage).save(entity === 'rawTransactions' ? source('transactions', trades) : source()), /元の状態へ戻しました/);
    assert.deepEqual(storage.snapshot(), before); assert.equal(storage.getItem(transaction.journalKey), null);
  }
});
test('failure also protects existing Account/Instrument/Batch envelopes', async () => {
  const storage = new Storage(), save = service(storage); await save.save(source('transactions', trades));
  const before = storage.snapshot(); storage.failKey = model.keys.holdingSnapshots;
  await assert.rejects(save.save(source('holdings', stock.replace('ZZ01', 'ZZ02'), 'b'.repeat(64))), /元の状態へ戻しました/);
  assert.deepEqual(storage.snapshot(), before);
});
test('byte reread mismatch causes complete rollback', async () => {
  const storage = new Storage(), before = storage.snapshot(); storage.mismatchKey = model.keys.holdingSnapshots;
  await assert.rejects(service(storage).save(source()), /元の状態へ戻しました/); assert.deepEqual(storage.snapshot(), before);
});
test('Repository semantic reread failure occurs before journal removal and rolls back', async () => {
  const storage = new Storage(), before = storage.snapshot(); let readsAfterWrite = 0;
  const adapter = { setItem: (key, value) => storage.setItem(key, value), removeItem: key => storage.removeItem(key),
    getItem(key) {
      if (key === model.keys.holdingSnapshots && storage.written.has(key) && ++readsAfterWrite === 2) return '{broken';
      return storage.getItem(key);
    } };
  await assert.rejects(service(adapter).save(source()), /元の状態へ戻しました/); assert.deepEqual(storage.snapshot(), before);
});
test('rollback failure retains journal, blocks subsequent saves, and allows explicit recovery', async () => {
  const storage = new Storage(), save = service(storage); let broken = false;
  const adapter = { getItem: key => storage.getItem(key), setItem(key, value) {
    if (key === model.keys.holdingSnapshots) { broken = true; throw new Error('write failed'); }
    storage.setItem(key, value);
  }, removeItem(key) {
    if (broken && key === model.keys.accounts) throw new Error('rollback failed');
    storage.removeItem(key);
  } };
  await assert.rejects(service(adapter).save(source()), /元の状態へ戻せませんでした/);
  assert.ok(storage.getItem(transaction.journalKey)); const before = storage.snapshot();
  await assert.rejects(save.save(source()), /未完了/); assert.deepEqual(storage.snapshot(), before);
  transaction.recover(storage); assert.deepEqual(storage.snapshot(), {});
});
test('optimistic guard stops a second asynchronous save on changed Storage, without lost updates', async () => {
  const storage = new Storage(), save = service(storage);
  const outcomes = await Promise.allSettled([save.save(source()), save.save(source())]);
  assert.equal(outcomes.filter(item => item.status === 'fulfilled' && item.value.status === 'saved').length, 1);
  assert.equal(outcomes.filter(item => item.status === 'rejected').length, 1);
  assert.equal(save.read().importBatches.records.length, 1); assert.equal(storage.getItem(transaction.journalKey), null);
});
test('canonical extraction excludes raw document, file name/path and nonallowlist PII', async () => {
  const input = source(); input.filename = 'PRIVATE_FILE'; input.absolutePath = 'C:/PRIVATE_PATH'; input.rawCSV = 'PRIVATE_CSV';
  Object.assign(input.preview.rows[0].rawFields, { email: 'PRIVATE_EMAIL', accountNumber: 'PRIVATE_ACCOUNT',
    address: 'PRIVATE_ADDRESS', userId: 'PRIVATE_USER', rawRow: 'PRIVATE_ROW' });
  const storage = new Storage(); assert.equal((await service(storage).save(input)).status, 'saved');
  assert.ok(!JSON.stringify(storage.snapshot()).includes('PRIVATE_'));
});
test('prototype controls are rejected before writes and never leak into records', async () => {
  const input = source(); input.preview.rows[0].rawFields = JSON.parse('{"__proto__":{"polluted":true}}');
  const storage = new Storage(); assert.equal((await service(storage).save(input)).status, 'invalid');
  assert.equal(storage.actions.length, 0); assert.equal({}.polluted, undefined);
});
test('Backup v3 exports saved models exactly and round-trips; v1 keeps new data', async () => {
  const storage = new Storage(), save = service(storage);
  await save.save(source()); await save.save(source('transactions', trades, 'b'.repeat(64)));
  const h = backupHarness(storage), payload = h.build(storage, 'http://localhost', now);
  assert.equal(payload.backupVersion, 3); assert.deepEqual(copy(payload.data.models), save.read());
  assert.equal(payload.data.models.accountSnapshots, null);
  const target = new Storage(), other = backupHarness(target); other.restore.execute(other.format.inspectValue(payload).restorePlan, target);
  assert.deepEqual(model.readModels(target), save.read());
  const v1 = { product: 'TradeScope', backupVersion: 1, exportedAt: now,
    data: { monthly: {}, initialFunds: {}, initialUnrealized: {}, transactions: [], memos: [], symbols: [] } };
  const before = Object.fromEntries(Object.values(model.keys).map(key => [key, target.getItem(key)]));
  other.restore.execute(other.format.inspectValue(v1).restorePlan, target);
  for (const key of Object.values(model.keys)) assert.equal(target.getItem(key), before[key]);
});
test('legacy monthly, history, Summary Snapshot and UI keys never change; holdings do not mark months entered', async () => {
  const legacy = { tradingData: '{"2026":{"8":{"__saved":true,"gmo":{"unrealizedPnL":1}},"9":{"sbi":{"holdings":[{"quantity":1}]}}}}',
    yearInitialFunds: '{}', yearInitialUnrealized: '{}', tradeScopeTradeHistoryV1: '[]', tradeScopeMemos: '[]',
    tradeScopeSymbolListV1: '[]', tradeInfo: '[]', tradeScopeTopSummarySnapshotV1: '{"cache":"unchanged"}', profitSkipDemoSeed: '1' };
  const storage = new Storage(legacy); await service(storage).save(source());
  for (const [key, value] of Object.entries(legacy)) assert.equal(storage.getItem(key), value);
  assert.equal(metrics.getLatestEnteredMonth(JSON.parse(storage.getItem('tradingData'))['2026'], ['gmo', 'sbi']), 8);
});
test('engine has no direct storage writes/communication/logging; only import page connects it', () => {
  const source = fs.readFileSync(path.join(root, 'import/sbi-save.js'), 'utf8');
  assert.ok(!/localStorage|sessionStorage|indexedDB|\.setItem\(|\.removeItem\(|fetch\(|XMLHttpRequest|WebSocket|sendBeacon|console\./.test(source));
  for (const file of ['index.html', 'history.html', 'profit/soneki.html']) {
    assert.ok(!/sbi-save|TradeScopeSBISave/.test(fs.readFileSync(path.join(root, file), 'utf8')));
  }
});
