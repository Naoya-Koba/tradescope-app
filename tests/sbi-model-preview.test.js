// Independently invented, anonymous CSV/model fixtures only; never real browser data.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto').webcrypto;
const model = require('../assets/data-model-storage.js');
const sbi = require('../import/sbi-parser.js');
const preview = require('../import/model-preview.js');
const root = path.resolve(__dirname, '..');
const now = '2030-10-04T12:00:00.000Z';
const copy = value => JSON.parse(JSON.stringify(value));
const envelope = records => ({ schemaVersion: 1, records, updatedAt: now });
const stock = '商品区分,銘柄名,銘柄コード,預り区分,保有数量,取得単価,現在値,取得金額,評価額,評価損益\n' +
  '国内株式,匿名株,ZZ01,特定預り,0,,0.123456789,0,0,0\n';
const trades = '約定日,銘柄,銘柄コード,市場,商品区分,取引,預り,約定数量,約定単価,受渡日,受渡金額/決済損益,手数料/諸経費等,税額\n' +
  '2030/09/01,匿名株,ZZ01,東証,国内株式,現物買,特定預り,0,0,2030/09/04,-123,--,0\n';
const fund = '投資信託（金額/NISA預り（成長投資枠））\nファンド名,保有口数,取得単価,基準価額,取得金額,評価額,評価損益\n' +
  '匿名投信,12138口,,0.123456789,0,0,0\n';
const fundTrade = '約定日,銘柄,銘柄コード,市場,取引,預り,約定数量,約定単価,受渡日,受渡金額/決済損益,手数料/諸経費等,税額\n' +
  '2030/09/01,匿名投信,,,投信金額買付,NISA(成),0,0.123456789,2030/09/04,-123,--,0\n';
function source(kind, text, hash = 'a'.repeat(64)) {
  return { preview: sbi.parse(text, kind), metadata: { hash, size: Buffer.byteLength(text) },
    targetMonth: kind === 'holdings' ? '2030-09' : null, snapshotAsOf: kind === 'holdings' ? '2030-10-04' : null };
}
function existing(instruments = []) {
  return { ...preview.emptyModels(), accounts: envelope(model.initialAccounts()), instruments: envelope(instruments) };
}
function instrument(id = 'ins_existing', name = '匿名株') {
  return { id, assetType: 'Stock', symbol: 'ZZ01', displayName: name, enabled: true };
}
function convert(inputs, stored = preview.emptyModels(), session = preview.createSession(crypto)) {
  return preview.convert(inputs, stored, session);
}
async function storedFund() {
  const result = await convert([source('holdings', fund)]), file = result.files[0];
  return { ...existing(result.instruments.map(item => copy(item.record))),
    importBatches: envelope([{ ...file.batch, importedAt: now }]),
    holdingSnapshots: envelope(file.holdings.map(item => ({ ...item, importedAt: now }))) };
}

test('exact raw transaction mapping classifies only the explicitly confirmed SBI label', () => {
  assert.equal(preview.productCategory({ transactionType: '投信金額買付' }), '投資信託');
  for (const label of ['投信金額買付・別', '別投信金額買付', '投信買付', 'constructor', 'toString', '', null]) {
    assert.equal(preview.productCategory({ transactionType: label }), null);
  }
  assert.equal(preview.productCategory({ product: ' 投資信託 ', transactionType: '未知' }), '投資信託');
});

test('exact fund transaction creates Instrument and fact candidate without any holding file', async () => {
  const input = source('transactions', fundTrade), before = JSON.stringify(input);
  const result = await convert([input]), file = result.files[0], fact = file.transactions[0];
  assert.deepEqual(file.counts, { parserCount: 1, candidateCount: 1, savableCount: 1, needsConfirmationCount: 0, unresolvedCount: 0 });
  assert.equal(result.instruments[0].record.assetType, 'MutualFund');
  assert.equal(fact.transactionType, '投信金額買付'); assert.equal(fact.rawFields.transactionType, '投信金額買付');
  assert.ok(!Object.hasOwn(fact.rawFields, 'product')); // Do not invent a column absent in this CSV.
  assert.equal(fact.rawFields.settlementOrPnl, '-123'); assert.equal(fact.realizedPnl, null);
  assert.equal(fact.quantity, '0'); assert.equal(fact.price, '0.123456789'); assert.equal(fact.fee, null);
  assert.equal(file.transactionCandidates[0].instrumentStatus, 'resolved');
  assert.equal(file.transactionCandidates[0].saveEligible, true);
  assert.equal(file.batch.importerVersion, 'sbi-domestic-v1');
  assert.deepEqual([...file.issues, ...file.rows.flatMap(row => row.issues)], []);
  assert.ok(!JSON.stringify(result).includes('validation-only-instrument'));
  assert.equal(JSON.stringify(input), before);
});

test('code-free SBI fund reuses exact official identity from prior transactions alone', async () => {
  const first = await convert([source('transactions', fundTrade)]), file = first.files[0];
  const stored = { ...existing(first.instruments.map(item => copy(item.record))),
    importBatches: envelope([{ ...file.batch, importedAt: now }]),
    rawTransactions: envelope(file.transactions.map(item => ({ ...item, importedAt: now }))) };
  const before = JSON.stringify(stored), input = source('transactions', fundTrade.replace('2030/09/01', '2030/10/01'), 'b'.repeat(64));
  const result = await convert([input], stored);
  assert.equal(result.instruments[0].status, 'existing');
  assert.equal(result.files[0].transactions[0].instrumentId, stored.instruments.records[0].id);
  assert.equal(result.files[0].counts.needsConfirmationCount, 0);
  assert.equal(JSON.stringify(stored), before);
});

test('transaction-classified funds never merge similar or partial non-whitespace names', async () => {
  const stored = await storedFund();
  const exact = source('transactions', fundTrade); exact.preview.rows[0].data.name = '  匿名投信  ';
  assert.equal((await convert([exact], stored)).instruments[0].status, 'existing');
  for (const name of ['匿名投信A', '匿名投信（別型）']) {
    const result = await convert([source('transactions', fundTrade.replace('匿名投信', name), 'b'.repeat(64))], stored);
    assert.equal(result.instruments[0].status, 'new'); assert.equal(result.files[0].transactions.length, 1);
    assert.notEqual(result.files[0].transactions[0].instrumentId, stored.instruments.records[0].id);
  }
});

test('same classified fund across custody and both CSVs shares one Instrument', async () => {
  const input = source('transactions', fundTrade + fundTrade.split('\n')[1].replace('NISA(成)', '特定') + '\n');
  const result = await convert([input, source('holdings', fund)]), file = result.files[1];
  assert.equal(result.instruments.length, 1); assert.equal(file.transactions.length, 2);
  assert.equal(file.transactions[0].instrumentId, result.files[0].holdings[0].instrumentId);
  assert.equal(file.transactions[1].instrumentId, file.transactions[0].instrumentId);
  assert.notEqual(file.transactions[0].rawFields.custody, file.transactions[1].rawFields.custody);
});

test('unknown transaction retains facts as unresolved Preview, not a save-ready or guessed Instrument', async () => {
  const result = await convert([source('transactions', fundTrade.replace('投信金額買付', '未知取引'))]);
  const file = result.files[0], candidate = file.transactionCandidates[0];
  assert.deepEqual(file.counts, { parserCount: 1, candidateCount: 1, savableCount: 0, needsConfirmationCount: 1, unresolvedCount: 1 });
  assert.equal(file.transactions.length, 0); assert.equal(result.instruments.length, 0);
  assert.equal(candidate.facts.transactionType, '未知取引'); assert.equal(candidate.facts.rawFields.transactionType, '未知取引');
  assert.equal(candidate.facts.quantity, '0'); assert.equal(candidate.facts.instrumentId, null);
  assert.equal(candidate.facts.realizedPnl, null); assert.equal(candidate.record, null);
  assert.equal(candidate.instrumentStatus, 'unresolved'); assert.equal(candidate.saveEligible, false);
  assert.equal(candidate.status, 'needs-confirmation');
  assert.deepEqual(candidate.issues.map(item => [item.severity, item.code]), [['warning', 'instrument-type']]);
  assert.ok(!JSON.stringify(result).includes('validation-only-instrument'));
});

test('explicit conflicting product cannot erase transaction facts or guess a new Instrument', async () => {
  const input = source('transactions', fundTrade); input.preview.rows[0].data.product = '国内株式';
  const file = (await convert([input])).files[0];
  assert.equal(file.transactionCandidates.length, 1); assert.equal(file.transactions.length, 0);
  assert.equal(file.transactionCandidates[0].facts.transactionType, '投信金額買付');
  assert.equal(file.transactionCandidates[0].issues[0].code, 'product-conflict');
  assert.equal(file.transactionCandidates[0].status, 'needs-confirmation');
});

test('invalid fact or file metadata keeps a visible issue row but cannot yield save-ready records', async () => {
  const badFact = source('transactions', fundTrade); badFact.preview.rows[0].data.quantity = 'invalid';
  const file = (await convert([badFact])).files[0];
  assert.equal(file.transactionCandidates.length, 1); assert.equal(file.transactions.length, 0);
  assert.equal(file.rows[0].status, 'invalid'); assert.equal(file.rows[0].facts, null);
  const badFile = source('transactions', fundTrade); badFile.metadata.hash = 'invalid';
  const blocked = (await convert([badFile])).files[0];
  assert.equal(blocked.transactionCandidates.length, 1); assert.equal(blocked.transactions.length, 0);
  assert.equal(blocked.transactionCandidates[0].saveEligible, false);
  assert.ok(blocked.issues.some(item => item.severity === 'error'));
});
test('A: holding file -> Batch/Instrument/flat Holding records, one observation; no save timestamp', async () => {
  const result = await convert([source('holdings', stock)]), file = result.files[0];
  assert.equal(result.account.accountId, 'acc_sbi_sec'); assert.equal(result.account.needsCreation, true);
  assert.equal(file.holdings.length, 1); assert.equal(file.transactions.length, 0);
  assert.equal(result.instruments.length, 1); assert.equal(file.batch.sourceProvider, 'sbi');
  assert.equal(file.observation.records.length, 1);
  assert.equal(file.holdings[0].importBatchId, file.batch.id);
  assert.equal(file.holdings[0].instrumentId, result.instruments[0].record.id);
  assert.ok(!JSON.stringify(result).includes('importedAt'));
  assert.ok(!Object.hasOwn(file.holdings[0], 'cashBalance'));
  assert.ok(!Object.hasOwn(file.holdings[0], 'holdings'));
});
test('B/G: trade facts retain settlement/custody/market/fee/tax, never derive realized P/L or side', async () => {
  const result = await convert([source('transactions', trades)]), file = result.files[0], row = file.transactions[0];
  assert.equal(file.transactions.length, 1); assert.equal(row.executedAt, '2030-09-01');
  assert.equal(row.rawFields.settlementDate, '2030/09/04');
  assert.equal(row.rawFields.settlementOrPnl, '-123'); assert.equal(row.realizedPnl, null);
  assert.equal(row.rawFields.tax, '0'); assert.equal(row.rawFields.market, '東証');
  assert.equal(row.fee, null); assert.equal(row.rawFields.fee, '--');
  assert.ok(!Object.hasOwn(row, 'side')); assert.ok(!Object.hasOwn(row, 'currency'));
});
test('C: exact code across both CSVs shares one candidate, but batches are distinct', async () => {
  const result = await convert([source('transactions', trades), source('holdings', stock)]);
  const [a, b] = result.files;
  assert.equal(result.instruments.length, 1); assert.notEqual(a.batch.id, b.batch.id);
  assert.equal(a.holdings[0].instrumentId, b.transactions[0].instrumentId);
});
test('C: transaction with missing product uses unique code evidence from holdings, not a name guess', async () => {
  const trade = source('transactions', trades); trade.preview.rows[0].data.product = null;
  const result = await convert([trade, source('holdings', stock)]);
  assert.equal(result.files[1].transactions.length, 1); assert.equal(result.instruments.length, 1);
});
test('D/I: exact SBI fund name shares a candidate; unqualified same-name master is not merged', async () => {
  const first = source('holdings', fund), row = copy(first.preview.rows[0]); row.rowNumber += 1;
  first.preview.rows.push(row);
  const stored = existing([{ id: 'ins_fund_existing', assetType: 'MutualFund', symbol: '匿名投信', displayName: '匿名投信', enabled: true }]);
  const result = await convert([first], stored);
  assert.equal(result.instruments.length, 1); assert.equal(result.files[0].holdings.length, 2);
  assert.equal(result.files[0].holdings[0].instrumentId, result.files[0].holdings[1].instrumentId);
  assert.ok(result.instruments.every(item => item.requiresConfirmation && item.status === 'new'));
  assert.deepEqual(result.instruments[0].possibleMatches, ['ins_fund_existing']);
  assert.ok(result.files[0].rows.every(row => row.status === 'needs-confirmation'));
  assert.equal(result.files[0].holdings[0].quantity, '12138');
  assert.equal(result.files[0].holdings[0].rawFields.quantityUnit, '口');
});
test('same code-free SBI fund next month reuses its stable Instrument from source evidence', async () => {
  const stored = await storedFund(), before = JSON.stringify(stored), input = source('holdings', fund, 'b'.repeat(64));
  input.targetMonth = '2030-10'; input.snapshotAsOf = '2030-11-04';
  const result = await convert([input], stored);
  assert.equal(result.instruments.length, 1); assert.equal(result.instruments[0].status, 'existing');
  assert.equal(result.files[0].holdings[0].instrumentId, stored.instruments.records[0].id);
  assert.equal(result.files[0].rows[0].status, 'candidate'); assert.equal(JSON.stringify(stored), before);
});
test('similar fund names and different provider/product evidence never automatically merge', async () => {
  const stored = await storedFund(), input = source('holdings', fund.replace('匿名投信', '匿名投信・別型'));
  assert.equal((await convert([input], stored)).instruments[0].status, 'new');
  const renamed = copy(stored); renamed.instruments.records[0].displayName = '任意の表示名';
  assert.equal((await convert([source('holdings', fund)], renamed)).instruments[0].status, 'existing');
  for (const field of ['provider', 'product']) {
    const other = copy(stored);
    if (field === 'provider') other.importBatches.records[0].sourceProvider = 'other';
    else other.holdingSnapshots.records[0].rawFields.product = '株式';
    const result = await convert([source('holdings', fund)], other);
    assert.equal(result.instruments[0].status, 'new'); assert.equal(result.instruments[0].requiresConfirmation, true);
  }
});
test('fund identity ignores whitespace only, never aliases or other spelling changes', async () => {
  const stored = await storedFund();
  const exact = source('holdings', fund); exact.preview.rows[0].data.name = '  匿名投信  ';
  assert.equal((await convert([exact], stored)).instruments[0].status, 'existing');
  for (const name of ['匿名投信A', '匿名投信（別型）', '匿名投資', '匿名\u200b投信', '匿名\u2060投信', '匿名ﾄｳｼﾝ']) {
    const input = source('holdings', fund.replace('匿名投信', name));
    assert.equal((await convert([input], stored)).instruments[0].status, 'new');
  }
  stored.instruments.records[0].aliases = ['参考別名'];
  assert.equal((await convert([source('holdings', fund.replace('匿名投信', '参考別名'))], stored)).instruments[0].status, 'new');
});

for (const [label, name] of [
  ['ASCII space', '匿名 投信'], ['full-width space', '匿名　投信'],
  ['repeated mixed spaces', '匿名 　\u00a0 投信'], ['Unicode whitespace', '匿名\u2009\u202f投信'],
  ['tab', '匿名\t投信']
]) {
  test(`code-free SBI fund ${label} shares identity across both previews and existing source facts`, async () => {
    const holdingInput = source('holdings', fund.replace('匿名投信', name));
    const tradeInput = source('transactions', fundTrade, 'b'.repeat(64));
    const inputsBefore = JSON.stringify([holdingInput, tradeInput]);
    const planned = await convert([tradeInput, holdingInput]);
    assert.equal(planned.instruments.length, 1);
    assert.equal(planned.files[0].holdings[0].instrumentId, planned.files[1].transactions[0].instrumentId);
    assert.equal(planned.instruments[0].record.displayName, name);
    assert.equal(planned.instruments[0].record.symbol, name);
    assert.equal(planned.files[0].holdings[0].rawFields.name, name);
    assert.equal(planned.files[1].transactions[0].rawFields.name, '匿名投信');
    assert.equal(JSON.stringify([holdingInput, tradeInput]), inputsBefore);
    const stored = { ...existing(planned.instruments.map(item => copy(item.record))),
      importBatches: envelope([{ ...planned.files[0].batch, importedAt: now }]),
      holdingSnapshots: envelope(planned.files[0].holdings.map(item => ({ ...item, importedAt: now }))) };
    const before = JSON.stringify(stored);
    const reused = await convert([tradeInput], stored);
    assert.equal(reused.instruments[0].status, 'existing');
    assert.equal(reused.files[0].transactions[0].instrumentId, stored.instruments.records[0].id);
    assert.equal(JSON.stringify(stored), before);
  });
}

test('whitespace comparison does not merge code-free Stock or replace code-based identity', async () => {
  const codeFreeStock = source('holdings', stock); codeFreeStock.preview.rows[0].data.code = null;
  const otherStock = copy(codeFreeStock); otherStock.metadata.hash = 'b'.repeat(64);
  otherStock.preview.rows[0].data.name = '匿名 株';
  const session = preview.createSession(crypto);
  const first = await convert([codeFreeStock], preview.emptyModels(), session);
  const second = await convert([otherStock], preview.emptyModels(), session);
  assert.notEqual(first.instruments[0].record.id, second.instruments[0].record.id);
  const stored = existing([instrument('ins_code', '元表示')]);
  const coded = source('holdings', stock.replace('匿名株', '匿名 株'));
  assert.equal((await convert([coded], stored)).files[0].holdings[0].instrumentId, 'ins_code');
  coded.preview.rows[0].data.code = 'ZZ02';
  assert.equal((await convert([coded], stored)).instruments[0].status, 'new');
});

test('non-SBI Account or Batch provenance cannot gain whitespace-based fund reuse', async () => {
  for (const scope of ['account', 'batch']) {
    const stored = await storedFund();
    if (scope === 'account') stored.accounts.records.find(item => item.id === preview.accountId).providerCode = 'other';
    else stored.importBatches.records[0].sourceProvider = 'other';
    const before = JSON.stringify(stored);
    const planned = await convert([source('transactions', fundTrade.replace('匿名投信', '匿名 投信'))], stored);
    assert.ok(!planned.instruments.some(item => item.status === 'existing'));
    assert.equal(JSON.stringify(stored), before);
  }
});

test('normalized fund identity collision across existing IDs remains ambiguous without mutation', async () => {
  const stored = await storedFund();
  stored.instruments.records.push({ ...stored.instruments.records[0], id: 'ins_whitespace_duplicate',
    displayName: '匿名　投信', symbol: '匿名　投信' });
  stored.holdingSnapshots.records.push({ ...stored.holdingSnapshots.records[0], id: 'hs_whitespace_duplicate',
    instrumentId: 'ins_whitespace_duplicate', rawFields: { ...stored.holdingSnapshots.records[0].rawFields, name: '匿名　投信' } });
  const before = JSON.stringify(stored);
  for (const input of [source('holdings', fund), source('transactions', fundTrade)]) {
    const file = (await convert([input], stored)).files[0];
    assert.equal(file.rows[0].instrumentStatus, 'unresolved');
    assert.equal(file.rows[0].saveEligible, false);
    assert.ok(file.rows[0].issues.some(item => item.code === 'instrument-ambiguous'));
  }
  assert.equal(JSON.stringify(stored), before);
});
test('custody is a Holding attribute, not fund identity; same exact name across both CSVs shares ID', async () => {
  const holdings = source('holdings', fund + '\n' + fund.replace('NISA預り（成長投資枠）', '特定預り'));
  const transaction = source('transactions', trades.replace('国内株式,', '投資信託,').replace('匿名株,ZZ01,', '匿名投信,,').replace(',東証,', ',,'));
  const result = await convert([holdings, transaction]), file = result.files[0];
  assert.equal(result.instruments.length, 1); assert.equal(file.holdings.length, 2);
  assert.equal(file.holdings[0].instrumentId, file.holdings[1].instrumentId);
  assert.notEqual(file.holdings[0].rawFields.custody, file.holdings[1].rawFields.custody);
  assert.equal(result.files[1].transactions[0].instrumentId, file.holdings[0].instrumentId);
});
test('multiple SBI source-qualified IDs for one official fund name require resolution', async () => {
  const stored = await storedFund();
  stored.instruments.records.push({ ...stored.instruments.records[0], id: 'ins_other' });
  stored.holdingSnapshots.records.push({ ...stored.holdingSnapshots.records[0], id: 'hs_other', instrumentId: 'ins_other' });
  const result = await convert([source('holdings', fund)], stored);
  assert.equal(result.files[0].holdings.length, 0); assert.equal(result.files[0].rows[0].issues[0].code, 'instrument-ambiguous');
});
test('generic listed security category permits a candidate with unknown subtype; no name/code heuristic', async () => {
  const input = source('holdings', stock.replace('匿名株', '匿名ETFという表示名'));
  const result = await convert([input]);
  assert.equal(result.files[0].holdings.length, 1); assert.equal(result.instruments[0].record.assetType, 'Stock');
  assert.equal(result.instruments[0].subtype, null);
  assert.equal((await convert([source('holdings', stock.replace('国内株式', '国内ETF'))])).instruments[0].subtype, 'ETF');
});
test('Parser version is defined once, copied into results/batches, and identifies a reparse session', async () => {
  const input = source('holdings', fund), session = preview.createSession(crypto);
  const first = await convert([input], preview.emptyModels(), session);
  assert.equal(input.preview.parserVersion, sbi.version); assert.equal(sbi.version, 'sbi-domestic-v1');
  assert.equal(first.files[0].batch.importerVersion, input.preview.parserVersion);
  input.preview.parserVersion = 'anonymous-test-next-parser';
  const next = await convert([input], preview.emptyModels(), session);
  assert.notEqual(first.files[0].batch.id, next.files[0].batch.id);
  assert.equal(next.files[0].batch.importerVersion, input.preview.parserVersion);
  delete input.preview.parserVersion;
  assert.equal((await convert([input])).files[0].holdings.length, 0);
});
test('all flat Holding records share one Batch/Account/month/observation and resolve csv source through Batch', async () => {
  const input = source('holdings', fund + '\n' + stock), result = await convert([input]), file = result.files[0];
  assert.equal(file.holdings.length, 2); assert.equal(file.observation.records.length, 2);
  for (const item of file.holdings) {
    for (const key of ['importBatchId', 'accountId', 'targetMonth', 'snapshotAsOf', 'sourceScope']) {
      assert.equal(item[key], file.observation[key]);
    }
    assert.equal(item.sourceMode, 'imported'); assert.equal(item.importBatchId, file.batch.id);
  }
  assert.equal(file.batch.sourceType, 'csv'); assert.equal(file.observation.sourceType, 'csv');
  assert.ok(file.holdings.every(item => !Object.hasOwn(item, 'sourceType'))); // Existing schema: resolved via shared Batch.
});
test('E: null/zero and long decimal precision survive conversion, no fund scaling', async () => {
  const result = await convert([source('holdings', stock)]), row = result.files[0].holdings[0];
  assert.equal(row.quantity, '0'); assert.equal(row.acquisitionPrice, null);
  assert.equal(row.marketPrice, '0.123456789'); assert.equal(row.marketValue, '0'); assert.equal(row.unrealizedPnl, '0');
});
test('F: target month, actual observation and file evidence remain distinct; never official month-end', async () => {
  const input = source('holdings', '基準日時,2030/10/04 16:54\n' + stock); input.snapshotAsOf = '2030-09-30';
  const result = await convert([input]), file = result.files[0];
  assert.equal(file.batch.targetMonth, '2030-09'); assert.equal(file.batch.snapshotAsOf, '2030-10-04T16:54');
  assert.equal(file.holdings[0].snapshotAsOf, file.batch.snapshotAsOf);
  assert.ok(!Object.hasOwn(file.holdings[0], 'observationType'));
});
test('H: existing Instrument reused by code, even after display name change', async () => {
  const result = await convert([source('holdings', stock)], existing([instrument('ins_existing', '別の表示名')]));
  assert.equal(result.account.exists, true); assert.equal(result.account.needsCreation, false);
  assert.equal(result.instruments[0].status, 'existing'); assert.equal(result.files[0].holdings[0].instrumentId, 'ins_existing');
});
test('I: ambiguous code or disabled Instrument cannot become a normal planned row', async () => {
  for (const instruments of [[instrument(), instrument('ins_second')], [{ ...instrument(), enabled: false }]]) {
    const result = await convert([source('holdings', stock)], existing(instruments));
    assert.equal(result.files[0].holdings.length, 0);
    assert.equal(result.files[0].rows[0].status, 'invalid');
    assert.ok(result.files[0].rows[0].issues.some(item => item.severity === 'error'));
  }
});
test('conflicting asset type for the same code is unresolved, not a second master candidate', async () => {
  const input = source('transactions', trades); input.preview.rows[0].data.product = '投資信託';
  const result = await convert([source('holdings', stock), input]);
  assert.equal(result.files[0].holdings.length, 1); assert.equal(result.files[1].transactions.length, 0);
  assert.equal(result.instruments.length, 1);
  assert.equal(result.files[1].rows[0].issues[0].code, 'instrument-conflict');
});
test('invalid fact rows cannot leave orphan Instrument candidates in the planned output', async () => {
  const input = source('holdings', stock); input.preview.rows[0].data.quantity = 42;
  const result = await convert([input]);
  assert.equal(result.files[0].holdings.length, 0); assert.equal(result.instruments.length, 0);
  assert.equal(result.files[0].observation, null);
});
test('unknown product/no-code trade is unresolved rather than guessing a MutualFund from blank market', async () => {
  const input = source('transactions', trades); input.preview.rows[0].data.product = null; input.preview.rows[0].data.code = null;
  const result = await convert([input]); assert.equal(result.files[0].transactions.length, 0);
  assert.equal(result.files[0].rows[0].issues[0].code, 'instrument-type');
});
test('J: matching file hash and transaction fact candidates warn but do not delete records', async () => {
  const stored = existing([instrument()]), first = await convert([source('transactions', trades)], stored);
  stored.importBatches = envelope([{ ...first.files[0].batch, id: 'batch_old', importedAt: now }]);
  stored.rawTransactions = envelope([{ ...first.files[0].transactions[0], id: 'tx_old', importBatchId: 'batch_old', importedAt: now,
    externalTransactionId: 'broker_id' }]);
  const before = JSON.stringify(stored), result = await convert([source('transactions', trades)], stored);
  assert.equal(result.files[0].transactions.length, 0); assert.deepEqual(result.files[0].duplicateBatches, ['batch_old']);
  assert.equal(result.files[0].transactionCandidates.length, 1);
  assert.equal(result.files[0].transactionCandidates[0].facts.quantity, '0');
  assert.equal(result.files[0].transactionCandidates[0].saveEligible, false);
  assert.deepEqual(result.files[0].rows[0].duplicateCandidates, ['tx_old']);
  assert.equal(result.files[0].rows[0].status, 'needs-confirmation'); assert.equal(JSON.stringify(stored), before);
});
test('same observation with a different file hash warns without deleting or combining holdings', async () => {
  const stored = existing([instrument()]), first = await convert([source('holdings', stock)], stored);
  stored.importBatches = envelope([{ ...first.files[0].batch, id: 'batch_old', importedAt: now }]);
  stored.holdingSnapshots = envelope([{ ...first.files[0].holdings[0], id: 'hs_old', importBatchId: 'batch_old', importedAt: now }]);
  const before = JSON.stringify(stored), result = await convert([source('holdings', stock, 'b'.repeat(64))], stored);
  assert.deepEqual(result.files[0].duplicateBatches, []);
  assert.deepEqual(result.files[0].duplicateObservations, ['batch_old']);
  assert.ok(result.files[0].issues.some(item => item.code === 'duplicate-observation'));
  assert.equal(result.files[0].holdings.length, 1); assert.equal(JSON.stringify(stored), before);
});
test('metadata uses browser SHA-256/size only; batch version is from the actual Parser', async () => {
  const bytes = new TextEncoder().encode('anonymous');
  const metadata = await preview.fileMetadata(bytes.buffer, crypto);
  assert.deepEqual(Object.keys(metadata).sort(), ['hash', 'size']); assert.equal(metadata.hash.length, 64);
  const result = await convert([source('holdings', stock)]);
  assert.equal(result.files[0].batch.importerVersion, sbi.version);
});
test('conversion rejects missing/invalid dates, target month, hash, account or number without modifying input', async () => {
  const cases = [input => { input.targetMonth = null; }, input => { input.targetMonth = '2030-13'; },
    input => { input.snapshotAsOf = null; }, input => { input.snapshotAsOf = '2030-02-30'; },
    input => { input.metadata.hash = 'not-hash'; }, input => { input.preview.rows[0].data.quantity = 0; }];
  for (const mutate of cases) {
    const input = source('holdings', stock); mutate(input); const before = JSON.stringify(input);
    const result = await convert([input]); assert.equal(result.files[0].holdings.length, 0);
    assert.ok([...result.files[0].issues, ...result.files[0].rows.flatMap(row => row.issues)].some(item => item.severity === 'error'));
    assert.equal(JSON.stringify(input), before);
  }
  const stored = existing(); stored.accounts.records.find(item => item.id === preview.accountId).enabled = false;
  assert.equal((await convert([source('holdings', stock)], stored)).files[0].holdings.length, 0);
});
test('K/L: read-only adapter, no Account seed, and all old/new key strings remain unchanged', async () => {
  const values = { tradingData: '{"2030":{"9":{"sbi":{"holdings":[{"quantity":1}]}}}}',
    tradeScopeTopSummarySnapshotV1: '{"unchanged":true}', tradeScopeTradeHistoryV1: '[{"unchanged":true}]' };
  for (const [entity, value] of Object.entries(existing([instrument()]))) if (value) values[model.keys[entity]] = JSON.stringify(value);
  const before = JSON.stringify(values), reads = [];
  const storage = { getItem(key) { reads.push(key); return values[key] ?? null; },
    setItem() { throw new Error('Forbidden'); }, removeItem() { throw new Error('Forbidden'); } };
  const stored = preview.readExisting(storage); await convert([source('holdings', stock)], stored);
  assert.deepEqual(reads.sort(), Object.values(model.keys).sort()); assert.equal(JSON.stringify(values), before);
  const ctx = vm.createContext({ window: {} }); vm.runInContext(fs.readFileSync(path.join(root, 'assets/profit-metrics.js'), 'utf8'), ctx);
  const months = { 8: { gmo: { realizedPnL: 1 } }, 9: { sbi: { holdings: [{ quantity: 1 }] } } };
  assert.equal(ctx.window.TradeScopeProfitMetrics.isMonthEntered(months, 9, ['gmo', 'sbi']), false);
  assert.equal(ctx.window.TradeScopeProfitMetrics.getLatestEnteredMonth(months, ['gmo', 'sbi']), 8);
});
test('M: original document, PII and nonallowlist fields cannot enter model drafts or messages', async () => {
  const input = source('holdings', stock); input.preview.rows[0].rawFields.accountNumber = 'PRIVATE_MARKER';
  input.preview.rows[0].data.address = 'PRIVATE_MARKER'; input.csvText = 'PRIVATE_MARKER'; input.fileName = 'PRIVATE_MARKER';
  input.preview.rows[0].rawFields.constructor = 'PRIVATE_MARKER';
  const result = await convert([input]); assert.ok(!JSON.stringify(result).includes('PRIVATE_MARKER'));
  assert.equal(result.files[0].holdings.length, 1);
});
test('IDs stable for the same in-memory session/date refresh; a new session creates new draft IDs', async () => {
  const session = preview.createSession(crypto), input = source('holdings', stock);
  const a = await convert([input], preview.emptyModels(), session); input.targetMonth = '2030-10';
  const b = await convert([input], preview.emptyModels(), session), c = await convert([input]);
  assert.equal(a.files[0].batch.id, b.files[0].batch.id); assert.equal(a.files[0].holdings[0].id, b.files[0].holdings[0].id);
  assert.notEqual(b.files[0].batch.id, c.files[0].batch.id);
});
test('corrupted/unsupported existing storage is not treated as an empty master', () => {
  assert.throws(() => preview.readExisting({ getItem: () => '{broken' }));
  assert.throws(() => preview.readExisting({ getItem: key => key === model.keys.accounts ? '{"schemaVersion":9}' : null }));
});
test('no source storage writers/network/logging or unsafe DOM insertion; read-only boundary is explicit', () => {
  for (const file of ['import/model-preview.js', 'import/preview.js']) {
    const code = fs.readFileSync(path.join(root, file), 'utf8');
    assert.ok(!/\.commit\(|createRepository|\.setItem\(|\.removeItem\(|sessionStorage|indexedDB|fetch\(|XMLHttpRequest|sendBeacon|console\.|innerHTML/.test(code));
  }
});
test('browser-style modules load without storage effects and convert through read-only adapter', async () => {
  const values = { tradingData: '{"unchanged":true}' }, before = JSON.stringify(values), reads = [];
  const deny = () => { throw new Error('Forbidden'); };
  const context = vm.createContext({ crypto, TextEncoder, TextDecoder,
    localStorage: { getItem(key) { reads.push(key); return values[key] ?? null; }, setItem: deny, removeItem: deny },
    fetch: deny, XMLHttpRequest: deny, console: { log: deny, error: deny } });
  for (const file of ['assets/storage-transaction.js', 'assets/data-model-storage.js', 'import/csv-core.js',
    'import/sbi-parser.js', 'import/model-preview.js']) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
  assert.equal(reads.length, 0);
  context.anonymous = stock;
  const result = await vm.runInContext(`TradeScopeSBIModelPreview.convert([{preview: TradeScopeSBI.parse(anonymous, 'holdings'),
    metadata: {hash: 'a'.repeat(64), size: 1}, targetMonth: '2030-09', snapshotAsOf: '2030-10-04'}],
    TradeScopeSBIModelPreview.readExisting(localStorage))`, context);
  assert.equal(result.files[0].holdings.length, 1); assert.equal(reads.length, 6);
  assert.equal(JSON.stringify(values), before);
});
