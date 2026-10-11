const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const resolver = require('../assets/monthly-account-resolver.js');
const { fixture, copy } = require('./gmo-support.js');
const enabledKeys = ['gmo'];
function metrics() { const window = {}; vm.runInNewContext(fs.readFileSync(require.resolve('../assets/profit-metrics.js'), 'utf8'), { window }); return window.TradeScopeProfitMetrics; }
function calc(models = fixture(), legacy = {}) { return resolver.createCalculator(metrics(), legacy, { 2026: { gmo: 100 } }, {}, models, { enabledKeys }); }
test('GMO adapter stays inactive by default, August legacy / September missing', () => {
  assert.equal(resolver.resolve(fixture(), {}, '2026-09', 'gmo').source, 'legacy');
  assert.equal(resolver.resolve(fixture(), {}, '2026-08', 'gmo', enabledKeys).source, 'legacy');
  const models = fixture(); models.monthlyAccountStates = null;
  assert.equal(resolver.resolve(models, { 2026: { 9: { __saved: true, gmo: { realizedPnL: 0 } } } }, '2026-09', 'gmo', enabledKeys).source, 'missing');
});
test('GMO canonical ledger never adds observed equity; missing propagates to flows/performance', () => {
  const c = calc(); assert.equal(c.confirmed(2026, 9, 'gmo'), 115); assert.equal(c.net(2026, 9, 'gmo'), 112);
  assert.equal(c.monthlyFieldTotal(2026, 9, ['gmo'], 'swapPnL'), 5); assert.equal(c.performance(2026, 9, ['gmo']).net, 12);
  assert.equal(c.confirmed(2026, 10, 'gmo'), null); assert.equal(c.flows(2026, 10, ['gmo']).deposit, null);
  const data = fixture(); data.accountSnapshots.records[0].netAssetValue = '999999'; assert.equal(calc(data).net(2026, 9, 'gmo'), 112);
});
test('pure GMO adapter rejects broken adoption and real legacy input, not placeholders', () => {
  const models = fixture(); models.monthlyAccountStates.records[0].adoptedAccountSnapshotId = 'missing';
  assert.equal(resolver.resolve(models, {}, '2026-09', 'gmo', enabledKeys).source, 'conflict');
  assert.equal(resolver.resolve(fixture(), { 2026: { 9: { gmo: { unrealizedPnL: 2 } } } }, '2026-09', 'gmo', enabledKeys).source, 'conflict');
  assert.equal(resolver.resolve(fixture(), { 2026: { 9: { gmo: { realizedPnL: 0 } } } }, '2026-09', 'gmo', enabledKeys).source, 'canonical');
});
test('fingerprint tracks State, adopted Snapshot, Batch and policy', () => {
  const before = calc().fingerprint(2026);
  for (const [entity, field, value] of [['monthlyAccountStates', 'swapPnl', '6'], ['accountSnapshots', 'cashBalance', '116'], ['importBatches', 'importerVersion', 'anonymous-v2']]) {
    const models = copy(fixture()); models[entity].records[0][field] = value; assert.notEqual(calc(models).fingerprint(2026), before);
  }
  assert.notEqual(resolver.createCalculator(metrics(), {}, { 2026: { gmo: 100 } }, {}, fixture()).fingerprint(2026), before);
});
