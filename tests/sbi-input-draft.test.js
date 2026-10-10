// Entirely invented records. No real CSV, Backup, Storage or network access.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const input = require('../assets/sbi-input-draft.js');
const model = require('../assets/data-model-storage.js');
const root = path.join(__dirname, '..');
const now = '2030-10-04T12:00:00.000Z';
const envelope = records => ({ schemaVersion: 1, records, updatedAt: now });
function fixture(month = '2026-09') {
  const models = Object.fromEntries(Object.keys(model.keys).map(key => [key, null]));
  models.accounts = envelope(model.initialAccounts().filter(row => row.id === 'acc_sbi_sec'));
  models.instruments = envelope([{ id: 'ins_fake', assetType: 'Stock', symbol: 'ZZ01', displayName: '架空商品', enabled: true }]);
  models.importBatches = envelope([{ id: 'batch_hold', accountId: 'acc_sbi_sec', sourceType: 'csv', sourceProvider: 'sbi',
    targetMonth: month, snapshotAsOf: '2026-10-04', importedAt: now }]);
  models.holdingSnapshots = envelope(['123456789012345678.123456789', '0.876543211'].map((value, i) => ({
    id: `hs_fake_${i}`, accountId: 'acc_sbi_sec', instrumentId: 'ins_fake', importBatchId: 'batch_hold',
    sourceMode: 'imported', sourceScope: 'sbi-domestic-holdings', targetMonth: month,
    snapshotAsOf: '2026-10-04', importedAt: now, marketValue: value, unrealizedPnl: i ? '-0.25' : '10.25', currency: 'JPY'
  })));
  return models;
}
const select = models => input.selectDomestic(models, '2026-09');
function addBatch(models, id, month = '2026-09', scope = 'sbi-domestic-holdings') {
  models.importBatches.records.push({ ...models.importBatches.records[0], id, targetMonth: month });
  models.holdingSnapshots.records.push({ ...models.holdingSnapshots.records[0], id: `hs_${id}`,
    importBatchId: id, targetMonth: month, sourceScope: scope, marketValue: '999', unrealizedPnl: '999' });
}
function storage(models) {
  const values = Object.fromEntries(Object.entries(models).filter(([, value]) => value !== null)
    .map(([entity, value]) => [model.keys[entity], JSON.stringify(value)]));
  values.tradingData = '{"2026":{"8":{"sbi":{"realizedPnL":12}},"9":{"sbi":{"holdings":[{"quantity":4}]}}}}';
  return { values, getItem: key => values[key] ?? null,
    setItem() { throw new Error('Read must not write'); }, removeItem() { throw new Error('Read must not remove'); } };
}
test('One domestic Batch displays without AccountSnapshot or MonthlyAccountState', () => {
  const models = fixture(), before = JSON.stringify(models), result = select(models);
  assert.equal(result.mode, 'draft'); assert.equal(result.status, 'ready'); assert.equal(result.importBatchId, 'batch_hold');
  assert.equal(models.accountSnapshots, null); assert.equal(models.monthlyAccountStates, null);
  assert.equal(JSON.stringify(models), before);
});
test('Market value sums decimal strings exactly without Number precision loss', () => {
  assert.equal(select(fixture()).marketValue, '123456789012345679.000000000');
});
test('Unrealized P/L sums positive and negative decimals exactly', () => {
  assert.equal(select(fixture()).unrealizedPnl, '10.00');
});
test('Another targetMonth and another sourceScope are not combined', () => {
  const models = fixture(); addBatch(models, 'batch_other_month', '2026-10');
  addBatch(models, 'batch_other_scope', '2026-09', 'another-holdings');
  assert.equal(select(models).marketValue, select(fixture()).marketValue);
});
test('Execution Batch and RawTransactions cannot become a domestic candidate', () => {
  const models = fixture(); models.importBatches.records.push({ ...models.importBatches.records[0], id: 'batch_exec' });
  models.rawTransactions = envelope([{ id: 'tx_fake', accountId: 'acc_sbi_sec', instrumentId: 'ins_fake',
    importBatchId: 'batch_exec', sourceType: 'csv', sourceProvider: 'sbi', importedAt: now, transactionType: '架空買付' }]);
  assert.equal(select(models).importBatchId, 'batch_hold');
  models.holdingSnapshots = null; assert.equal(select(models).mode, 'legacy');
});
test('Another account holdings are not included', () => {
  const models = fixture(); models.accounts.records.push({ ...models.accounts.records[0], id: 'acc_fake' });
  models.importBatches.records.push({ ...models.importBatches.records[0], id: 'batch_other', accountId: 'acc_fake' });
  models.holdingSnapshots.records.push({ ...models.holdingSnapshots.records[0], id: 'hs_other', accountId: 'acc_fake', importBatchId: 'batch_other' });
  assert.equal(select(models).marketValue, select(fixture()).marketValue);
});
for (const field of ['marketValue', 'unrealizedPnl']) {
  for (const missing of ['null', 'absent']) test(`${field} ${missing} does not become zero or a partial total`, () => {
    const models = fixture();
    if (missing === 'null') models.holdingSnapshots.records[1][field] = null;
    else delete models.holdingSnapshots.records[1][field];
    assert.equal(select(models)[field], null);
  });
}
test('Explicit decimal zero remains known zero', () => {
  const models = fixture(); models.holdingSnapshots.records.forEach(row => { row.marketValue = '0'; row.unrealizedPnl = '0'; });
  assert.equal(select(models).marketValue, '0'); assert.equal(input.formatYen('0', true), '0円');
});
test('Multiple candidates do not select latest or combine totals', () => {
  const models = fixture(); addBatch(models, 'batch_second');
  const result = select(models); assert.equal(result.status, 'multiple'); assert.equal(result.marketValue, null);
  assert.equal(result.importBatchId, undefined);
});
test('Explicit adopted reference uses only that batch without modifying state', () => {
  const models = fixture(); addBatch(models, 'batch_second');
  models.monthlyAccountStates = envelope([{ id: 'mas_fake', accountId: 'acc_sbi_sec', targetMonth: '2026-09', confirmedAt: now,
    domesticImportBatchId: 'batch_hold', foreignAccountSnapshotId: null, cashAccountSnapshotId: null,
    realizedPnl: null, swapPnl: null, deposit: null, withdrawal: null }]);
  const before = JSON.stringify(models); assert.equal(select(models).importBatchId, 'batch_hold');
  assert.equal(JSON.stringify(models), before);
});
test('Dates retain adopted month versus acquisition date without promotion', () => {
  const models = fixture(); models.holdingSnapshots.records.forEach(row => { row.observationType = 'approximateForMonth'; });
  const result = select(models); assert.equal(result.targetMonth, '2026-09'); assert.equal(result.snapshotAsOf, '2026-10-04');
  assert.equal(models.holdingSnapshots.records[0].observationType, 'approximateForMonth');
});
test('Non-JPY values are not silently treated as yen', () => {
  const models = fixture(); models.holdingSnapshots.records[0].currency = 'USD'; assert.equal(select(models).status, 'unavailable');
});
test('Display and month switching neither seed nor write any financial keys', () => {
  const adapter = storage(fixture()), before = JSON.stringify(adapter.values);
  for (const month of ['2026-09', '2026-10', '2026-08', '2026-09']) input.load(adapter, month);
  assert.equal(JSON.stringify(adapter.values), before);
  const empty = storage(Object.fromEntries(Object.keys(model.keys).map(key => [key, null])));
  const keys = Object.keys(empty.values); input.load(empty, '2026-09'); assert.deepEqual(Object.keys(empty.values), keys);
});
test('Malformed canonical data fails closed without writes', () => {
  const adapter = storage(fixture()); adapter.values[model.keys.holdingSnapshots] = '{broken';
  const before = JSON.stringify(adapter.values); assert.equal(input.load(adapter, '2026-09').status, 'unavailable');
  assert.equal(JSON.stringify(adapter.values), before);
});
test('January-August and months without new data remain legacy', () => {
  for (let month = 1; month <= 8; month++) assert.equal(input.selectDomestic(fixture(`2026-${String(month).padStart(2, '0')}`),
    `2026-${String(month).padStart(2, '0')}`).mode, 'legacy');
  assert.equal(input.selectDomestic(fixture(), '2026-10').mode, 'legacy');
});
test('Draft is month-scoped, detached from returned objects, and not persisted', () => {
  const drafts = input.createDrafts(); drafts.set('2026-09', 'realizedPnL', '0'); drafts.set('2026-10', 'deposit', '12');
  const row = drafts.read('2026-09'); row.realizedPnL = '999'; assert.equal(drafts.read('2026-09').realizedPnL, '0');
  assert.equal(drafts.read('2026-10').deposit, '12'); assert.throws(() => drafts.set('2026-09', '__saved', true));
  drafts.clear(); assert.deepEqual(drafts.read('2026-09'), {});
});
test('Read-only holdings and Draft do not change monthly entered/latest predicates', () => {
  const context = vm.createContext({ window: {} }); vm.runInContext(fs.readFileSync(path.join(root, 'assets/profit-metrics.js'), 'utf8'), context);
  const metrics = context.window.TradeScopeProfitMetrics;
  const year = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [i + 1, { sbi: { realizedPnL: i + 1 } }]));
  year[9] = { sbi: { holdings: [{ quantity: 10, valueJPY: 20 }] } };
  const before = JSON.stringify(year); select(fixture()); input.createDrafts().set('2026-09', 'realizedPnL', '0');
  assert.equal(metrics.isMonthEntered(year, 9, ['sbi']), false);
  for (let month = 1; month <= 8; month++) assert.equal(metrics.isMonthEntered(year, month, ['sbi']), true);
  assert.equal(metrics.getLatestEnteredMonth(year, ['sbi']), 8);
  assert.equal(JSON.stringify(year), before);
});

function editHarness(mode = 'draft') {
  const source = fs.readFileSync(path.join(root, 'profit/soneki.js'), 'utf8');
  const draft = { dataset: { account: 'sbi', field: 'realizedPnL', draft: 'sbi' }, value: '99' };
  const other = { dataset: { account: 'gmo', field: 'realizedPnL' }, value: '' };
  const legacy = { 2026: { 8: { sbi: { realizedPnL: 12 } }, 9: { sbi: { holdings: [{ quantity: 5 }] } } } };
  const context = vm.createContext({ currentYear: 2026, currentMonth: 9, tradingData: legacy, ACCOUNTS: [{ key: 'sbi' }, { key: 'gmo' }],
    sbiInputDrafts: input.createDrafts(), inputTargetMonth: () => '2026-09', usesSbiDraft: () => mode === 'draft',
    UNREALIZED_HELPER_ACCOUNTS: new Set(), document: { querySelectorAll: () => [draft, other] },
    applyBankBalanceInputsForMonth() {}, normalizeCashflowValue: (_, value) => value });
  vm.runInContext(source.slice(source.indexOf('function ensureYearMonth('), source.indexOf('function calculateMonthlyTotals(')), context);
  vm.runInContext(source.slice(source.indexOf('function updateInputs('), source.indexOf('function updateHoldingsInputs(')), context);
  return { context, draft, other, legacy, source };
}
test('Real SBI input event changes only Draft, not legacy memory or __saved', () => {
  const h = editHarness(), before = JSON.stringify(h.legacy); h.context.updateInputs({ target: h.draft });
  assert.equal(h.context.sbiInputDrafts.read('2026-09').realizedPnL, '99'); assert.equal(JSON.stringify(h.legacy), before);
});
test('Other account synchronization cannot copy SBI Draft into legacy', () => {
  const h = editHarness(); h.other.value = '3'; h.context.updateInputs({ render: false });
  assert.equal(h.legacy[2026][9].gmo.realizedPnL, 3); assert.equal(h.legacy[2026][9].sbi.realizedPnL, undefined);
  assert.equal(h.legacy[2026][9].__saved, undefined); assert.equal(h.legacy[2026][8].sbi.realizedPnL, 12);
});
test('Month save excludes Draft-only input before __saved or Storage save', () => {
  const h = editHarness(); let click, saves = 0;
  h.context.document.getElementById = () => ({ addEventListener: (_, fn) => { click = fn; } });
  h.context.window = { confirm: () => true, alert() {} }; h.context.saveToStorage = () => saves++;
  const start = h.source.indexOf("document.getElementById('saveMonthData').addEventListener");
  vm.runInContext(h.source.slice(start, h.source.indexOf('monthlyDetailClose?.addEventListener', start)), h.context);
  const before = JSON.stringify(h.legacy); click(); assert.equal(saves, 0); assert.equal(JSON.stringify(h.legacy), before);
});
test('Another account month save persists only legacy inputs, never SBI Draft/domestic values', () => {
  const h = editHarness(); h.other.value = '3'; let click, saved;
  h.context.document.getElementById = () => ({ addEventListener: (_, fn) => { click = fn; } });
  h.context.document.createElement = () => ({ style: {}, remove() {} });
  h.context.document.body = { appendChild() {} };
  h.context.document.querySelectorAll = selector => selector === '.input-holdings' ? [] : [h.draft, h.other];
  h.context.window = { confirm: () => true, alert() {} };
  h.context.saveToStorage = () => { saved = JSON.parse(JSON.stringify(h.legacy)); };
  h.context.monthlyDetailPane = { classList: { contains: () => false } };
  h.context.setTimeout = () => {};
  for (const name of ['updateHoldingsInputs', 'renderAnnualSummary', 'renderPerformanceChart', 'renderMonthlySection']) h.context[name] = () => {};
  const start = h.source.indexOf("document.getElementById('saveMonthData').addEventListener");
  vm.runInContext(h.source.slice(start, h.source.indexOf('monthlyDetailClose?.addEventListener', start)), h.context);
  click(); assert.equal(saved[2026][9].gmo.realizedPnL, 3);
  assert.equal(saved[2026][9].sbi.realizedPnL, undefined); assert.deepEqual(saved[2026][9].sbi.holdings, [{ quantity: 5 }]);
  assert.equal(saved[2026][8].sbi.realizedPnL, 12);
});
test('Other input synchronization never creates an SBI row for Draft', () => {
  const h = editHarness(); delete h.legacy[2026][9].sbi; h.other.value = '3'; h.context.updateInputs({ render: false });
  assert.equal(h.legacy[2026][9].sbi, undefined);
});
test('No new-mode module write, network, logging or adoption/confirmation path exists', () => {
  const source = fs.readFileSync(path.join(root, 'assets/sbi-input-draft.js'), 'utf8');
  assert.doesNotMatch(source, /\.setItem\(|\.removeItem\(|\.commit\(|\.upsert\(|\.save\(|fetch\(|XMLHttpRequest|sendBeacon|console\./);
  const profit = fs.readFileSync(path.join(root, 'profit/soneki.js'), 'utf8');
  const card = profit.slice(profit.indexOf('function renderSbiDraftCard('), profit.indexOf('function handleAccountInputBlur('));
  assert.doesNotMatch(card, /__saved|\.setItem\(|AccountSnapshot|MonthlyAccountState/);
});
test('Profit HTML script order, PWA versions, cache existence and unique URLs are aligned', () => {
  const html = fs.readFileSync(path.join(root, 'profit/soneki.html'), 'utf8');
  const context = vm.createContext({ self: { addEventListener() {} } });
  const urls = vm.runInContext(fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8') + '\nCORE_ASSETS', context);
  assert.equal(urls.length, new Set(urls).size);
  for (const url of urls) assert.ok(fs.existsSync(path.join(root, url.split('?')[0])));
  for (const [, url] of html.matchAll(/(?:src|href)="([^" ]+\.(?:js|css)(?:\?[^" ]+)?)"/g)) {
    if (/^https?:/.test(url)) continue;
    const relative = path.posix.normalize('profit/' + url); assert.ok(urls.includes('./' + relative), relative);
  }
  assert.ok(html.indexOf('data-model-storage.js') < html.indexOf('sbi-input-draft.js'));
  assert.ok(html.indexOf('csv-core.js') < html.indexOf('sbi-input-draft.js'));
  assert.ok(html.indexOf('sbi-input-draft.js') < html.indexOf('src="soneki.js'));
});
