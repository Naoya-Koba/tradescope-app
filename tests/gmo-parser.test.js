const test = require('node:test'), assert = require('node:assert/strict');
const parser = require('../import/gmo-parser.js');
const { report, pdfBytes, text } = require('./gmo-pdf-fixture.js');
test('GMO detector and official table parser, including terminal subtotal rows', () => {
  const r = parser.parse(report()); assert.equal(r.valid, true); assert.deepEqual(r.errors, []);
  assert.deepEqual(r.values, { realizedPnl: '10', swapPnl: '5', cashBalance: '115', netAssetValue: '112', unrealizedPnl: '-3', requiredMargin: '20', deposit: '0', withdrawal: '0' });
  assert.equal(r.snapshotAsOf, '2026-09-30'); assert.equal(r.observationType, 'officialMonthEnd');
});
test('detector rejects other reports and filename is irrelevant', () => {
  const r = report(); r.pages[0].items[0].text = '別会社'; assert.equal(parser.detect(r), false); assert.equal(parser.parse(r).valid, false);
  assert.equal(parser.parse({ ...report(), filename: 'not-a-report.csv' }).valid, true);
});
test('official totals, row subtotals, cash, net and margin discrepancies stop eligibility', () => {
  for (const [page, needle] of [[2, '10'], [3, '115'], [4, '112'], [5, '20']]) {
    const r = report(), item = r.pages[page - 1].items.find(i => i.text === needle && (page !== 5 || i.x === 479)); item.text = '999';
    assert.equal(parser.parse(r).valid, false);
  }
});
test('blank is not zero; fees, after-close movement and unsupported foreign currencies stop', () => {
  for (const [page, x, y, value] of [[3, 230, 420, ''], [3, 402, 420, '1'], [4, 151, 420, '1'], [3, 230, 400, '1']]) {
    const r = report(); r.pages[page - 1].items.find(i => i.x === x && i.y === y).text = value;
    assert.equal(parser.parse(r).valid, false);
  }
});
test('external deposits/withdrawals remain gross flows even when net is zero', () => {
  const r = report(), page = r.pages[1];
  for (const [day, kind, amount, y] of [['26/09/02', '入金', '7', 330], ['26/09/02', '出金', '-7', 310]])
    for (const [value, x] of [[day, 27], ['日本円', 82], [kind, 114], [amount, 217], ['0', 307]]) page.items.push(text(value, x, y));
  // Keep totals after all chronological detail rows.
  page.items.filter(i => i.y === 380 || i.y === 360).forEach(i => { i.y -= 100; });
  const parsed = parser.parse(r); assert.equal(parsed.valid, true); assert.equal(parsed.values.deposit, '7'); assert.equal(parsed.values.withdrawal, '7');
});
test('unknown ledger type or missing ledger cannot infer zero movement', () => {
  const r = report(); r.pages[1].items.find(i => i.text.startsWith('取引損益')).text = '不明な移動';
  assert.equal(parser.parse(r).valid, false);
  const empty = report(); empty.pages.splice(1, 1); assert.equal(parser.parse(empty).valid, false);
});
test('parser does not leak arbitrary PDF PII to its allowlisted result/errors', () => {
  const r = report(); r.pages[0].items.push(text('匿名氏名 非保存 口座番号000000 住所テスト', 30, 490));
  assert.doesNotMatch(JSON.stringify(parser.parse(r)), /匿名氏名|000000|住所テスト/);
});
test('same parser works on actual local PDF.js text items from an anonymous Japanese PDF', async () => {
  globalThis.DOMMatrix ||= class {}; globalThis.Path2D ||= class {}; globalThis.ImageData ||= class {};
  const extractor = await import('../import/pdf-extractor.mjs');
  const parsed = parser.parse(await extractor.extract(pdfBytes())); assert.equal(parsed.valid, true);
});
