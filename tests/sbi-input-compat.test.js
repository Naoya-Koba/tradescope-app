// Invented records only: never reads browser Storage, real CSV or Backup files.
const test = require('node:test'), assert = require('node:assert/strict');
const crypto = require('node:crypto').webcrypto, fs = require('node:fs'), vm = require('node:vm');
const model = require('../assets/data-model-storage.js'), parser = require('../import/sbi-parser.js');
const converter = require('../import/model-preview.js'), input = require('../assets/sbi-input-draft.js');
const now = '2030-01-01T00:00:00.000Z';
const envelope = records => ({ schemaVersion: 1, records, updatedAt: now });
async function fixture() {
  const holdings = '商品区分,銘柄名,銘柄コード,預り区分,保有数量,取得単価,現在値,取得金額,評価額,評価損益\n'
    + Array.from({ length: 10 }, (_, i) => `国内株式,架空検証商品${i + 1},ZZ${i + 1},特定預り,1,1,1,1,${i < 9 ? '450000' : '493033'},${i < 9 ? '38000' : '47340'}`).join('\n');
  const executions = '約定日,銘柄,銘柄コード,市場,商品区分,取引,預り,約定数量,約定単価,受渡日,受渡金額/決済損益\n'
    + Array.from({ length: 6 }, (_, i) => `2026/09/01,架空検証商品${i + 1},ZZ${i + 1},東証,国内株式,現物買,特定預り,1,1,2026/09/04,-1`).join('\n');
  const plan = await converter.convert([
    { preview: parser.parse(holdings, 'holdings'), metadata: { hash: 'a'.repeat(64), size: 1000 }, targetMonth: '2026-09', snapshotAsOf: '2026-10-04' },
    { preview: parser.parse(executions, 'transactions'), metadata: { hash: 'b'.repeat(64), size: 1000 } }
  ], converter.emptyModels(), converter.createSession(crypto));
  assert.equal(plan.files.flatMap(file => [...file.issues, ...file.rows.flatMap(row => row.issues)]).length, 0);
  return { ...converter.emptyModels(), accounts: envelope([plan.account.record]), instruments: envelope(plan.instruments.map(item => item.record)),
    importBatches: envelope(plan.files.map(file => ({ ...file.batch, importedAt: now }))),
    holdingSnapshots: envelope(plan.files[0].holdings.map(row => ({ ...row, importedAt: now }))),
    rawTransactions: envelope(plan.files[1].transactions.map(row => ({ ...row, importedAt: now }))) };
}
function adapter(models) {
  const values = Object.fromEntries(Object.entries(models).filter(([, value]) => value !== null).map(([entity, value]) => [model.keys[entity], JSON.stringify(value)]));
  values.tradingData = '{"2026":{"8":{"sbi":{"realizedPnL":12}},"9":{"sbi":{"holdings":[{"quantity":1}]}}}}';
  return { values, getItem: key => values[key] ?? null, setItem() { throw new Error('No writes'); }, removeItem() { throw new Error('No removes'); } };
}
test('Parser/converter currency-less domestic records display through read-only Repository', async () => {
  const models = await fixture(); assert.equal(model.validateModels(models), true);
  assert.equal(models.holdingSnapshots.records.length, 10);
  assert.ok(models.holdingSnapshots.records.every(row => !Object.hasOwn(row, 'currency')));
  assert.ok(!Object.hasOwn(models.importBatches.records[1], 'targetMonth'));
  assert.equal(models.accountSnapshots, null); assert.equal(models.monthlyAccountStates, null);
  const store = adapter(models), before = JSON.stringify(store.values), result = input.load(store, '2026-09');
  assert.equal(result.status, 'ready'); assert.equal(result.importBatchId, models.importBatches.records[0].id);
  assert.equal(input.formatYen(result.marketValue), '4,543,033円'); assert.equal(input.formatYen(result.unrealizedPnl, true), '+389,340円');
  assert.equal(result.snapshotAsOf.replace(/-/g, '/'), '2026/10/04');
  for (let month = 1; month <= 8; month++) assert.equal(input.load(store, `2026-${String(month).padStart(2, '0')}`).mode, 'legacy');
  for (const month of ['2026-10', '2026-09']) input.load(store, month);
  assert.equal(JSON.stringify(store.values), before);
  const context = vm.createContext({ window: {} }); vm.runInContext(fs.readFileSync(require.resolve('../assets/profit-metrics.js'), 'utf8'), context);
  const year = JSON.parse(store.values.tradingData)['2026'];
  assert.equal(context.window.TradeScopeProfitMetrics.isMonthEntered(year, 9, ['sbi']), false); assert.equal(year[9].__saved, undefined);
});
test('Undefined/null/JPY currency is compatible; empty and explicit foreign currency fail closed', async () => {
  for (const currency of [undefined, null, 'JPY', 'USD', '']) {
    const models = await fixture(); models.holdingSnapshots.records.forEach(row => { if (currency !== undefined) row.currency = currency; });
    const store = adapter(models), before = JSON.stringify(store.values);
    assert.equal(input.load(store, '2026-09').status, currency === 'USD' || currency === '' ? 'unavailable' : 'ready');
    if (currency === '') assert.throws(() => model.validateModels(models));
    assert.equal(JSON.stringify(store.values), before);
  }
});
test('Currency compatibility never includes other scopes, brokers or accounts', async () => {
  const models = await fixture(); models.accounts.records[0].providerCode = 'other';
  assert.equal(input.selectDomestic(models, '2026-09').status, 'unavailable'); models.accounts.records[0].providerCode = 'sbi';
  models.importBatches.records[0].sourceProvider = 'other'; assert.equal(input.selectDomestic(models, '2026-09').status, 'unavailable');
  models.importBatches.records[0].sourceProvider = 'sbi';
  models.holdingSnapshots.records.forEach(row => { row.sourceScope = 'sbi-foreign-securities'; });
  assert.equal(input.selectDomestic(models, '2026-09').mode, 'legacy');
  models.holdingSnapshots.records.forEach(row => { row.sourceScope = 'sbi-domestic-holdings'; }); models.accounts.records[0].id = 'acc_other';
  for (const entity of ['importBatches', 'holdingSnapshots', 'rawTransactions']) models[entity].records.forEach(row => { row.accountId = 'acc_other'; });
  assert.equal(input.selectDomestic(models, '2026-09').mode, 'legacy');
});
test('Missing financial values remain unknown with compatible omitted currency', async () => {
  for (const field of ['marketValue', 'unrealizedPnl']) for (const missing of ['null', 'absent']) {
    const models = await fixture(); if (missing === 'null') models.holdingSnapshots.records[0][field] = null; else delete models.holdingSnapshots.records[0][field];
    const result = input.selectDomestic(models, '2026-09'); assert.equal(result.status, 'ready'); assert.equal(result[field], null);
  }
});
