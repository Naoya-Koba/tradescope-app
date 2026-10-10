// Entirely fictitious fixtures. Run: node --test tests/sbi-import.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const csv = require('../import/csv-core.js');
const sbi = require('../import/sbi-parser.js');
const modelPreview = require('../import/model-preview.js');
const root = path.resolve(__dirname, '..');
const holdings = '商品区分,銘柄名,銘柄コード,預り区分,保有数量,取得単価,現在値,取得金額,評価額,評価損益\r\n' +
  '国内株式,"架空,株式会社",0001,特定預り,2,500,550,1000,1100,100\r\n' +
  '投資信託,架空ファンド,TEST,一般預り,10000,100,100,100,100,0\r\n';
const transactions = '約定日,銘柄名,銘柄コード,市場,商品区分,注文種別,取引区分,預り区分,約定数量,約定単価,受渡日,受渡金額 / 決済損益\n' +
  '2026/09/02,架空株式会社,0001,東証,国内株式,指値,現物買,特定預り,2,500,2026/09/04,-1000\n';
const has = (result, code) => [...result.issues, ...result.rows.flatMap(row => row.issues)].some(item => item.code === code);

test('A: holdings fields, decimal sums and section groups', () => {
  const result = sbi.parse(holdings, 'holdings');
  assert.equal(result.summary.validCount, 2); assert.equal(result.summary.valuation, '1200');
  assert.equal(result.summary.unrealizedPnl, '100'); assert.equal(result.summary.groups.length, 2);
  assert.equal(result.rows[0].data.acquisitionPrice, '500');
  assert.equal(result.rows[1].data.quantity, '10000');
});
test('B: trade facts, combined column is NOT realized P/L', () => {
  const result = sbi.parse(transactions, 'transactions');
  assert.equal(result.summary.validCount, 1);
  assert.equal(result.rows[0].data.settlementOrPnl, '-1000');
  assert.equal(result.rows[0].data.reportedRealizedPnl, undefined);
  assert.deepEqual(result.summary.period, ['2026-09-02', '2026-09-02']);
});
test('C/D: preserve zero and blank independently', () => {
  assert.equal(csv.decimal('0'), '0'); assert.equal(csv.decimal(''), null);
  assert.equal(csv.decimal(null), null); assert.equal(csv.sum(['0', null]), null);
  const result = sbi.parse('銘柄名,保有数量,評価額,評価損益\n架空,0,0,\n', 'holdings');
  assert.equal(result.summary.valuation, '0'); assert.equal(result.summary.unrealizedPnl, null);
  assert.equal(result.rows[0].data.unrealizedPnl, null);
  assert.equal(csv.sum(['0.1', '0.2']), '0.3');
});
test('E: quoted comma, escaped quote, quoted newline, CRLF/LF, BOM', () => {
  const result = csv.parseCSV('\uFEFFa,b\r\n"one, two","a""b\nc"\r\n');
  assert.deepEqual(result[1].cells, ['one, two', 'a"b\nc']);
  assert.equal(sbi.parse(holdings, 'holdings').rows[0].data.name, '架空,株式会社');
});
test('F: invalid numeric row separated, normal rows survive', () => {
  const result = sbi.parse('銘柄名,数量,評価額\n架空A,1,10\n架空B,no,20\n', 'holdings');
  assert.equal(result.summary.validCount, 1); assert.equal(result.summary.invalidCount, 1);
  assert.ok(has(result, 'number')); assert.ok(has(result, 'partial'));
  assert.throws(() => csv.decimal('1,00')); assert.throws(() => csv.decimal('Infinity'));
});
test('required blanks and unsupported products cannot enter valid totals', () => {
  const result = sbi.parse('商品区分,銘柄名,数量,評価額\n国内株式,架空,1,\n外国株式,架空,1,100\n', 'holdings');
  assert.equal(result.summary.validCount, 0); assert.equal(result.summary.valuation, null);
  assert.equal(result.rows[0].data.valuation, null); assert.ok(has(result, 'out-of-scope'));
});
test('G: missing/duplicate/misspelled headers and wrong kind rejected', () => {
  assert.ok(has(sbi.parse('銘柄名,数量\n架空,1', 'holdings'), 'header'));
  assert.ok(has(sbi.parse('銘柄名,数量,評価額,時価評価額\n架空,1,1,1', 'holdings'), 'header'));
  assert.ok(has(sbi.parse('銘柄名,数量,評価額X\n架空,1,1', 'holdings'), 'header'));
  assert.ok(has(sbi.parse(transactions, 'holdings'), 'header'));
});
test('H: unknown/PII columns and preamble discarded from intermediate', () => {
  const result = sbi.parse('氏名,PRIVATE_PERSON\n銘柄名,数量,評価額,口座番号\n架空,1,1,PRIVATE_ACCOUNT', 'holdings');
  assert.equal(result.summary.validCount, 1); assert.ok(has(result, 'extra-columns'));
  assert.ok(!JSON.stringify(result).includes('PRIVATE_'));
});
test('I: matching/mismatching/negative/decimal totals without correction', () => {
  const source = '銘柄名,数量,評価額,評価損益\n架空,1,0.1,-1.2\n合計,,0.1,-1.2';
  assert.ok(!has(sbi.parse(source, 'holdings'), 'total-mismatch'));
  const bad = sbi.parse(source.replace('合計,,0.1', '合計,,0.2'), 'holdings');
  assert.ok(has(bad, 'total-mismatch')); assert.equal(bad.summary.valuation, '0.1');
  assert.equal(bad.totals[0].valuation, '0.2');
});
test('section-specific totals, no double counting of totals', () => {
  const source = '株式（現物/特定預り）\n銘柄名,数量,評価額\n架空株,1,100\n合計,,100\n' +
    '投資信託（金額/一般預り）\nファンド名,保有口数,評価額\n架空投信,10000,200\n合計,,200';
  const result = sbi.parse(source, 'holdings');
  assert.equal(result.summary.valuation, '300'); assert.equal(result.summary.validCount, 2);
  assert.ok(!has(result, 'total-mismatch')); assert.equal(result.rows[1].data.product, '投資信託');
  assert.equal(result.rows[1].sourceHeaders.quantity, '保有口数');
});
test('CSV grammar failures contain no source data', () => {
  const result = sbi.parse('銘柄名,数量,評価額\n"PRIVATE_SECRET,1,1', 'holdings');
  assert.ok(has(result, 'csv')); assert.ok(!JSON.stringify(result).includes('PRIVATE_SECRET'));
  assert.throws(() => csv.parseCSV('a,"b"extra'));
});
test('date validation and observation evidence, no invented year/timezone', () => {
  assert.equal(csv.date('2026/9/2'), '2026-09-02');
  assert.throws(() => csv.date('26/09/02')); assert.throws(() => csv.date('2026/02/30'));
  assert.equal(csv.observation('2026/10/04 16:54'), '2026-10-04T16:54');
  const dated = sbi.parse('基準日,2026/10/04\n' + holdings, 'holdings');
  assert.equal(dated.snapshotAsOf, '2026-10-04'); assert.equal(dated.snapshotAsOfSource, 'file');
  assert.equal(sbi.parse(holdings, 'holdings').snapshotAsOf, null);
});
test('UTF-8 BOM / Shift_JIS CP932 decoding and unsupported bytes', () => {
  assert.equal(csv.decodeCSV(Buffer.from('\uFEFF' + holdings)).encoding, 'utf-8');
  // Japanese CP932 header 銘柄名,数量,評価額 with ASCII data; no real source file.
  const bytes = Buffer.from('96c195bf96bc2c909497ca2c955d89bf8a7a0a4142432c302c300a', 'hex');
  const decoded = csv.decodeCSV(bytes);
  assert.equal(decoded.encoding, 'shift_jis');
  assert.equal(sbi.parse(decoded.text, 'holdings').summary.valuation, '0');
  assert.throws(() => csv.decodeCSV(Buffer.from([0xFF, 0xFE])));
});

// Public layout/header vocabulary only. Every name, code, date, amount and
// quantity below is independently invented, not copied from a user's CSV.
const stockHeader = '銘柄コード,銘柄名称,保有株数,売却注文中,取得単価,現在値,取得金額,評価額,評価損益';
const fundHeader = 'ファンド名,保有口数,売却注文中,取得単価,基準価額,取得金額,評価額,評価損益,分配金受取方法';
const sbiHoldings = '保有証券一覧\r\n\r\n' +
  '株式（特定預り）合計\r\n評価額合計,評価損益合計\r\n200,+20\r\n\r\n' +
  '株式（特定預り）\r\n' + stockHeader + '\r\nZZ01,架空株A,2,,90,100.00,180,200,+20 \r\n\r\n' +
  '株式（NISA預り（成長投資枠））合計\r\n評価額合計,評価損益合計\r\n300,-30\r\n\r\n' +
  '株式（NISA預り（成長投資枠））\r\n' + stockHeader + '\r\nZZ02,架空株B,3,,110,100,330,300,-30\r\n\r\n' +
  '投資信託（金額/NISA預り（成長投資枠））合計\r\n評価額合計,評価損益合計\r\n100,+10\r\n\r\n' +
  '投資信託（金額/NISA預り（成長投資枠））\r\n' + fundHeader + '\r\n架空投信C,10口,,90,100.5,90,100,+10,再投資\r\n\r\n' +
  '投資信託（金額/NISA預り（つみたて投資枠））合計\r\n評価額合計,評価損益合計\r\n100,0\r\n\r\n' +
  '投資信託（金額/NISA預り（つみたて投資枠））\r\n' + fundHeader + '\r\n架空投信D,20口,,100,100,100,100,0,受取\r\n';
const tradeHeader = '約定日,銘柄,銘柄コード,市場,取引,期限,預り,課税,約定数量,約定単価,手数料/諸経費等,税額,受渡日,受渡金額/決済損益';
const sbiTrades = '約定履歴照会\n\n商品指定,約定開始年月日,約定終了年月日,明細数,明細指定開始,明細指定終了\n' +
  'すべて,2030年01月01日,2030年01月31日,2,1,2\n\n架空の注意文\n\n' + tradeHeader + '\n' +
  '2030/01/02,架空投信E,,,買付,--,NISA(成),--,10,100,--,--,2030/01/04,-100\n' +
  '2030/01/05,架空投信F,,,売却,--,NISA(つ),--,20,200,0,0,2030/01/09,+200\n';
const allIssues = result => [...result.issues, ...result.rows.flatMap(row => row.issues)];

test('file type detection recognises exact SBI section and flat headers without file-name guessing', () => {
  for (const text of [holdings, sbiHoldings, '\uFEFF' + sbiHoldings]) assert.equal(sbi.detectKind(text), 'holdings');
  for (const text of [transactions, sbiTrades]) assert.equal(sbi.detectKind(text), 'transactions');
  assert.equal(sbi.detectKind('保有証券一覧\n知らない列,値\n架空,1'), null);
  assert.equal(sbi.detectKind(''), null);
  assert.equal(sbi.detectKind('銘柄名,数量,評価額\n"閉じていない引用符'), null);
  assert.equal(sbi.detectKind(sbiHoldings + '\n' + sbiTrades), null);
  assert.equal(sbi.detectKind('銘柄名,数量,評価額,評価額\n架空,1,1,1'), null);
});

test('SBI section layouts: stock/fund headers, all NISA contexts, separate totals, no noise', () => {
  const result = sbi.parse(sbiHoldings, 'holdings');
  assert.equal(result.summary.validCount, 4); assert.equal(result.totals.length, 4);
  assert.equal(result.summary.valuation, '700'); assert.equal(result.summary.groups.length, 4);
  assert.equal(result.rows[0].data.custody, '特定預り');
  assert.equal(result.rows[1].data.custody, 'NISA預り（成長投資枠）');
  assert.equal(result.rows[3].data.custody, 'NISA預り（つみたて投資枠）');
  assert.deepEqual(allIssues(result), []);
});
test('SBI fund quantity unit, nullable sell order, absent code, decimal quote, signed/trailing-space values', () => {
  const result = sbi.parse(sbiHoldings, 'holdings');
  assert.equal(result.rows[2].data.quantity, '10'); assert.equal(result.rows[2].data.quantityUnit, '口');
  assert.equal(result.rows[2].rawFields.quantity, '10口');
  assert.equal(result.rows[2].data.code, undefined); assert.equal(result.rows[2].data.sellOrderQuantity, null);
  assert.equal(result.rows[2].data.marketPrice, '100.5');
  assert.equal(result.rows[0].data.unrealizedPnl, '20'); assert.equal(result.rows[1].data.unrealizedPnl, '-30');
});
test('SBI normal N/A markers do not fabricate zero or warnings', () => {
  const result = sbi.parse(sbiHoldings.replace(',90,100.5,', ',--,--,'), 'holdings');
  assert.equal(result.rows[2].data.marketPrice, null); assert.equal(result.rows[2].data.acquisitionPrice, null);
  assert.deepEqual(allIssues(result), []);
});
test('SBI separate section total mismatch is only warning; amount is not corrected', () => {
  const result = sbi.parse(sbiHoldings.replace('200,+20', '201,+20'), 'holdings');
  assert.equal(result.summary.valuation, '700'); assert.equal(result.totals[0].valuation, '201');
  assert.deepEqual(allIssues(result).map(item => [item.severity, item.code]), [['warning', 'total-mismatch']]);
});
test('SBI transaction preamble: search period/count, normal blank code/market and -- fields', () => {
  const result = sbi.parse(sbiTrades, 'transactions');
  assert.equal(result.summary.validCount, 2); assert.deepEqual(allIssues(result), []);
  assert.deepEqual(result.summary.searchPeriod, ['2030-01-01', '2030-01-31']);
  assert.deepEqual(result.summary.period, ['2030-01-02', '2030-01-05']);
  assert.equal(result.sourceMetadata.detailCount, 2);
  assert.equal(result.rows[0].data.code, null); assert.equal(result.rows[0].data.market, null);
  assert.equal(result.rows[0].data.fee, null); assert.equal(result.rows[1].data.fee, '0');
  assert.equal(result.rows[0].data.tax, null); assert.equal(result.rows[0].data.maturity, null);
  assert.equal(result.rows[0].data.settlementOrPnl, '-100');
  assert.equal(result.rows[0].data.reportedRealizedPnl, undefined);
});
test('SBI declared count mismatch and paged ranges', () => {
  assert.ok(has(sbi.parse(sbiTrades.replace(',2,1,2', ',3,1,3'), 'transactions'), 'detail-count'));
  const paged = sbi.parse(sbiTrades.replace(',2,1,2', ',100,3,4'), 'transactions');
  assert.ok(!has(paged, 'detail-count')); assert.ok(!has(paged, 'detail-range'));
});
test('SBI missing required facts still error, metadata dates do not become observation date', () => {
  const result = sbi.parse(sbiTrades.replace(',10,100,', ',--,100,'), 'transactions');
  assert.equal(result.summary.invalidCount, 1); assert.ok(has(result, 'required-value'));
  assert.equal(result.snapshotAsOf, null);
});
test('SBI unsupported sections, truncated totals and broken rows cannot silently pass checking', () => {
  assert.ok(has(sbi.parse('株式（未対応預り）\n' + stockHeader + '\nZZ00,架空,1,,1,1,1,1,0', 'holdings'), 'section'));
  assert.equal(sbi.parse('株式（未対応預り）\n' + stockHeader + '\nZZ00,架空,1,,1,1,1,1,0', 'holdings').rows.length, 0);
  assert.ok(has(sbi.parse('株式（特定預り）合計\n評価額合計,評価損益合計', 'holdings'), 'total-missing'));
  assert.ok(has(sbi.parse(sbiHoldings.replace('ZZ01,架空株A,2,,90,100.00,180,200,+20 ', 'ZZ01,架空株A,2,,90,100.00,180,200'), 'holdings'), 'total-unchecked'));
});

// Lightweight DOM harness: no browser or package dependency. The app is executed
// with read-only injected storage and forbidden write/network APIs.
class Element {
  constructor(tag = 'div') { this.tagName = tag; this.children = []; this.listeners = {}; this.dataset = {}; this.value = ''; this.files = []; this.textContent = ''; this.hidden = false; }
  append(...elements) { this.children.push(...elements); }
  replaceChildren(...elements) { this.children = elements; this.textContent = ''; }
  addEventListener(type, handler) { this.listeners[type] = handler; }
  async fire(type) { await this.listeners[type]?.({ target: this }); }
  showModal() { this.open = true; }
  close() { this.open = false; }
}
function harness(stored = {}) {
  const ids = [...fs.readFileSync(path.join(root, 'import.html'), 'utf8').matchAll(/id="([^"]+)"/g)].map(match => match[1]);
  const elements = Object.fromEntries(ids.map(id => [id, new Element()]));
  const files = ['holdings', 'transactions'].map(kind => { const element = elements[kind + '-file']; element.dataset.kind = kind; return element; });
  const helps = ['holdings', 'transactions'].map(kind => { const element = new Element(); element.dataset.help = kind; return element; });
  elements.encoding.value = 'auto';
  const deny = () => { throw new Error('Forbidden persistence/network API'); };
  const storage = new Proxy({}, { get: deny });
  const saved = { ...stored };
  const win = { localStorage: { getItem: key => saved[key] ?? null, setItem: deny, removeItem: deny, clear: deny },
    addEventListener: (type, handler) => { win[type] = handler; } };
  class Reader {
    readAsArrayBuffer(file) { this.result = new TextEncoder().encode(file.text).buffer; queueMicrotask(() => this.onload()); }
  }
  const context = vm.createContext({ document: { getElementById: id => elements[id], createElement: tag => new Element(tag),
    querySelectorAll: query => query === 'input[type=file]' ? files : helps },
    window: win, FileReader: Reader, TradeScopeCSV: csv, TradeScopeSBI: sbi, TradeScopeSBIModelPreview: modelPreview,
    localStorage: storage, sessionStorage: storage, indexedDB: storage, caches: storage,
    fetch: deny, XMLHttpRequest: deny, WebSocket: deny, console: { log: deny, error: deny } });
  vm.runInContext(fs.readFileSync(path.join(root, 'import/preview.js'), 'utf8'), context);
  async function upload(kind, text) {
    const input = elements[kind + '-file']; input.files = [{ text, size: text.length }];
    await input.fire('change'); await new Promise(resolve => setImmediate(resolve));
  }
  return { elements, helps, win, upload, saved };
}
test('J/K/L: file input preview, safe text rendering, close clears data; no storage writes/network/logging', async () => {
  const h = harness();
  const source = '銘柄名,数量,評価額\n<img src=x onerror=alert(1)>,1,10';
  await h.upload('holdings', source);
  assert.equal(h.elements.preview.hidden, false);
  const text = h.elements['detail-body'].children[0].children[2].textContent;
  assert.equal(text, '<img src=x onerror=alert(1)>');
  assert.equal(h.elements['detail-body'].children[0].children[2].children.length, 0);
  await h.elements['close-preview'].fire('click');
  assert.equal(h.elements.preview.hidden, true); assert.equal(h.elements['detail-body'].children.length, 0);
  assert.equal(h.elements['holdings-file'].value, '');
  await h.upload('transactions', transactions); assert.equal(h.elements.preview.hidden, false);
  h.win.pagehide(); assert.equal(h.elements['detail-body'].children.length, 0);
});
test('planned UI responds to month/date, shows one observation and clears drafts without writes', async () => {
  const h = harness({ tradingData: '{"unchanged":true}', tradeScopeTopSummarySnapshotV1: '{"unchanged":true}' });
  const before = JSON.stringify(h.saved);
  await h.upload('holdings', holdings);
  assert.equal(h.elements.planned.hidden, false);
  assert.ok(h.elements['planned-issues'].children.some(item => item.textContent.includes('対象月')));
  h.elements['target-month'].value = '2030-09'; await h.elements['target-month'].fire('change');
  h.elements['observed-date'].value = '2030-10-04'; await h.elements['observed-date'].fire('change');
  assert.deepEqual(h.elements['planned-summary'].children.map(item => item.textContent), [
    '保有記録', '2件', '新規銘柄候補', '2件', '既存銘柄再利用', '0件', '対象月', '2030年09月分', '取得日', '2030-10-04', '保有の観測', '1件']);
  assert.equal(h.elements['planned-rows'].children.length, 2);
  await h.elements['close-preview'].fire('click');
  assert.equal(h.elements.planned.hidden, true); assert.equal(h.elements['planned-rows'].children.length, 0);
  assert.equal(JSON.stringify(h.saved), before);
});
test('two CSVs share code evidence in memory; closing resets it, no internal IDs in UI', async () => {
  const h = harness(); await h.upload('holdings', holdings);
  h.elements['target-month'].value = '2030-09'; await h.elements['target-month'].fire('change');
  h.elements['observed-date'].value = '2030-10-04'; await h.elements['observed-date'].fire('change');
  const noProduct = transactions.replace(',商品区分', '').replace(',国内株式', '');
  await h.upload('transactions', noProduct);
  assert.equal(h.elements['planned-summary'].children[1].textContent, '1件');
  const text = JSON.stringify(h.elements['planned-summary'].children.map(item => item.textContent));
  assert.ok(!/acc_|ins_|batch_|RawTransaction|HoldingSnapshot/.test(text));
  await h.elements['close-preview'].fire('click');
  await h.upload('transactions', noProduct);
  assert.deepEqual(h.elements['planned-summary'].children.slice(0, 6).map(item => item.textContent), [
    '取引候補', '1件', '保存可能', '0件', '要確認', '1件']);
  assert.ok(h.elements['planned-issues'].children.some(item => item.textContent.includes('商品区分')));
});
test('explicit SBI fund trade type shows compact ready count with no holdings evidence or storage writes', async () => {
  const h = harness(), before = JSON.stringify(h.saved);
  const text = '約定日,銘柄,銘柄コード,市場,取引,預り,約定数量,約定単価,受渡日,受渡金額/決済損益\n' +
    '2030/09/01,匿名投信,,,投信金額買付,NISA(成),0,0,2030/09/04,0\n';
  await h.upload('transactions', text);
  assert.equal(h.elements.planned.hidden, false);
  const summary = h.elements['planned-summary'].children.map(item => item.textContent);
  assert.deepEqual(summary.slice(0, 2), ['取引候補', '1件']);
  assert.ok(!summary.includes('要確認')); assert.equal(h.elements['planned-issues'].children.length, 0);
  assert.equal(h.elements['planned-rows'].children.length, 1);
  assert.equal(JSON.stringify(h.saved), before);
});

test('invalid stored model blocks planned conversion without hiding CSV Preview or writing', async () => {
  const h = harness({ tradeScopeAccountsV1: '{broken' }), before = JSON.stringify(h.saved);
  await h.upload('transactions', transactions);
  assert.equal(h.elements.preview.hidden, false); assert.equal(h.elements.planned.hidden, false);
  assert.match(h.elements['planned-issues'].children[0].textContent, /保存予定内容を確認できません/);
  assert.equal(h.elements['planned-summary'].children.length, 0); assert.equal(JSON.stringify(h.saved), before);
});

test('both CSV counts remain visible, switching preserves dates and clears correctly without storage writes', async () => {
  const h = harness(), before = JSON.stringify(h.saved);
  await h.upload('holdings', holdings);
  h.elements['target-month'].value = '2030-09'; await h.elements['target-month'].fire('change');
  h.elements['observed-date'].value = '2030-10-04'; await h.elements['observed-date'].fire('change');
  await h.upload('transactions', transactions);
  assert.equal(h.elements['loaded-previews'].hidden, false);
  assert.deepEqual(h.elements['loaded-previews'].children.map(item => item.textContent), ['保有証券 2件', '約定履歴 1件']);
  await h.elements['loaded-previews'].children[0].fire('click');
  assert.equal(h.elements['target-month'].value, '2030-09'); assert.equal(h.elements['observed-date'].value, '2030-10-04');
  assert.equal(h.elements['planned-summary'].children[1].textContent, '2件');
  assert.equal(h.elements['planned-issues'].children.length, 0);
  await h.elements['loaded-previews'].children[1].fire('click');
  assert.equal(h.elements['planned-summary'].children[1].textContent, '1件');
  await h.elements['close-preview'].fire('click');
  assert.equal(h.elements['loaded-previews'].hidden, true); assert.equal(h.elements['loaded-previews'].children.length, 0);
  assert.equal(JSON.stringify(h.saved), before);
});

test('reselecting same holdings file retains chosen dates, different file does not inherit them', async () => {
  const h = harness(); await h.upload('holdings', holdings);
  h.elements['target-month'].value = '2030-09'; await h.elements['target-month'].fire('change');
  h.elements['observed-date'].value = '2030-10-04'; await h.elements['observed-date'].fire('change');
  await h.upload('transactions', transactions);
  await h.upload('holdings', holdings);
  assert.equal(h.elements['target-month'].value, '2030-09'); assert.equal(h.elements['observed-date'].value, '2030-10-04');
  assert.equal(h.elements['planned-issues'].children.length, 0);
  await h.upload('holdings', holdings.replace('架空ファンド', '別の架空ファンド'));
  assert.equal(h.elements['target-month'].value, ''); assert.equal(h.elements['observed-date'].value, '');
  assert.ok(h.elements['planned-issues'].children.length > 0);
  await h.elements['loaded-previews'].children[1].fire('click');
  assert.equal(h.elements['planned-summary'].children[1].textContent, '1件');
});
test('planned rows use text only; exact SBI fund identities need no name-only warning', async () => {
  const h = harness(), text = '投資信託（金額/NISA預り（成長投資枠））\nファンド名,保有口数,評価額\n' +
    '<img src=x onerror=alert(1)>,1口,0\n匿名投信,1口,0';
  await h.upload('holdings', text);
  h.elements['target-month'].value = '2030-09'; await h.elements['target-month'].fire('change');
  h.elements['observed-date'].value = '2030-10-04'; await h.elements['observed-date'].fire('change');
  assert.equal(h.elements['planned-rows'].children.length, 2);
  const name = h.elements['planned-rows'].children[0].children[0];
  assert.equal(name.textContent, '<img src=x onerror=alert(1)>'); assert.equal(name.children.length, 0);
  assert.equal(h.elements['planned-issues'].children.length, 0);
});
test('preview date is user-specified or file-derived, not lastModified', async () => {
  const h = harness(); await h.upload('holdings', holdings);
  assert.equal(h.elements['observed-date'].value, ''); assert.equal(h.elements['observed-date'].readOnly, false);
  h.elements['observed-date'].value = '2026-10-04'; await h.elements['observed-date'].fire('change');
  await h.upload('holdings', '基準日時,2026/10/04 16:54\n' + holdings);
  assert.equal(h.elements['observed-date'].value, '2026-10-04'); assert.equal(h.elements['observed-date'].readOnly, true);
});
test('SBI-format UTF-8 fixtures preview with no noise and display search/actual periods separately', async () => {
  const h = harness(); await h.upload('holdings', sbiHoldings);
  assert.equal(h.elements['detail-body'].children.length, 4);
  assert.equal(h.elements.issues.children[0].textContent, 'エラー 0 / 注意 0');
  await h.upload('transactions', sbiTrades);
  assert.equal(h.elements['detail-body'].children.length, 2);
  assert.equal(h.elements.issues.children[0].textContent, 'エラー 0 / 注意 0');
  const labels = h.elements.summary.children.map(child => child.textContent);
  assert.ok(labels.includes('検索期間')); assert.ok(labels.includes('約定期間'));
  await h.elements['close-preview'].fire('click'); assert.equal(h.elements['detail-body'].children.length, 0);
});
test('provider starts closed; open/close clears preview and remains reusable without persistence', async () => {
  const html = fs.readFileSync(path.join(root, 'import.html'), 'utf8');
  assert.match(html, /<details id="sbi-provider" class="provider">/);
  for (const provider of ['GMOクリック証券', 'LIGHT FX', 'みんなのFX', 'SBI VCトレード']) {
    assert.ok(html.includes(`<button class="provider-pending" disabled><span>${provider}</span>`));
  }
  const h = harness();
  h.elements['sbi-provider'].open = true; await h.elements['sbi-provider'].fire('toggle');
  await h.upload('holdings', sbiHoldings); assert.equal(h.elements.preview.hidden, false);
  h.elements['sbi-provider'].open = false; await h.elements['sbi-provider'].fire('toggle');
  assert.equal(h.elements.preview.hidden, true); assert.equal(h.elements['detail-body'].children.length, 0);
  assert.equal(h.elements['read-status'].textContent, '');
  h.elements['sbi-provider'].open = true; await h.elements['sbi-provider'].fire('toggle');
  await h.upload('transactions', sbiTrades); assert.equal(h.elements.preview.hidden, false);
});
test('both wrong file slots stop preview, show concise type errors, and allow correct reselection', async () => {
  const h = harness();
  await h.upload('holdings', sbiTrades);
  assert.equal(h.elements.preview.hidden, true);
  assert.equal(h.elements['read-status'].textContent, '約定履歴CSVです。約定履歴から選択してください。');
  assert.equal(h.elements['detail-body'].children.length, 0);
  await h.upload('holdings', sbiHoldings);
  assert.equal(h.elements.preview.hidden, false); assert.equal(h.elements['detail-body'].children.length, 4);
  await h.upload('transactions', sbiHoldings);
  assert.equal(h.elements.preview.hidden, true);
  assert.equal(h.elements['read-status'].textContent, '保有証券CSVです。保有証券から選択してください。');
  assert.equal(h.elements.summary.children.length, 0);
  await h.upload('transactions', sbiTrades);
  assert.equal(h.elements.preview.hidden, false); assert.equal(h.elements['detail-body'].children.length, 2);
});
test('closing the provider during FileReader activity does not resurrect a preview', async () => {
  const h = harness();
  const input = h.elements['holdings-file']; input.files = [{ text: sbiHoldings, size: sbiHoldings.length }];
  const reading = input.fire('change');
  h.elements['sbi-provider'].open = false;
  await h.elements['sbi-provider'].fire('toggle'); await reading;
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.elements.preview.hidden, true); assert.equal(h.elements['detail-body'].children.length, 0);
  assert.equal(h.elements['read-status'].textContent, '');
});
test('type detection also works after CP932 decoding without changing the existing decoder', () => {
  const bytes = Buffer.from('96c195bf96bc2c909497ca2c955d89bf8a7a0a4142432c302c300a', 'hex');
  assert.equal(sbi.detectKind(csv.decodeCSV(bytes).text), 'holdings');
});
test('unknown or mixed CSV never becomes normal preview and does not prevent the next selection', async () => {
  const h = harness();
  for (const text of ['未知の項目,値\n架空,0', sbiHoldings + '\n' + sbiTrades]) {
    await h.upload('holdings', text);
    assert.equal(h.elements.preview.hidden, true);
    assert.equal(h.elements['read-status'].textContent, '対応するSBI証券CSVを確認できませんでした');
    assert.equal(h.elements['detail-body'].children.length, 0);
  }
  await h.upload('holdings', sbiHoldings); assert.equal(h.elements.preview.hidden, false);
});
test('mobile detail labels are static and preserve the existing preview values', async () => {
  const h = harness(); await h.upload('holdings', sbiHoldings);
  const cells = h.elements['detail-body'].children[0].children;
  assert.deepEqual(cells.slice(0, 3).map(cell => cell.dataset.label), ['行', '状態', '銘柄']);
  assert.equal(cells[2].textContent, '架空株A');
  assert.equal(cells[10].dataset.label, '評価額'); assert.equal(cells[10].textContent, '200');
});
test('repeated open/close, help, encoding reset and paging are transient', async () => {
  const h = harness();
  await h.helps[0].fire('click'); assert.equal(h.elements['help-dialog'].open, true);
  assert.ok(h.elements['official-help'].href.startsWith('https://search.sbisec.co.jp/'));
  await h.elements['close-help'].fire('click'); assert.equal(h.elements['help-dialog'].open, false);
  const source = '銘柄名,数量,評価額\n' + Array.from({ length: 101 }, (_, index) => `架空${index},1,1`).join('\n');
  await h.upload('holdings', source); assert.equal(h.elements['detail-body'].children.length, 100);
  assert.equal(h.elements['more-rows'].hidden, false); await h.elements['more-rows'].fire('click');
  assert.equal(h.elements['detail-body'].children.length, 101); assert.equal(h.elements['more-rows'].hidden, true);
  await h.elements.encoding.fire('change'); assert.equal(h.elements.preview.hidden, true);
  await h.upload('holdings', holdings); assert.equal(h.elements['detail-body'].children.length, 2);
  await h.elements['close-preview'].fire('click'); assert.equal(h.elements['detail-body'].children.length, 0);
});
test('latest monthly logic remains independent and non-destructive', () => {
  const context = vm.createContext({ window: {} });
  vm.runInContext(fs.readFileSync(path.join(root, 'assets/profit-metrics.js'), 'utf8'), context);
  const metrics = context.window.TradeScopeProfitMetrics;
  const months = { 8: { gmo: { realizedPnL: 10, unrealizedPnL: 1 } }, 9: { sbi: { holdings: [{ quantity: 100, valueJPY: 20 }] } } };
  const before = JSON.stringify(months);
  sbi.parse(holdings, 'holdings');
  assert.equal(metrics.isMonthEntered(months, 9, ['gmo', 'sbi']), false);
  assert.equal(metrics.getLatestEnteredMonth(months, ['gmo', 'sbi']), 8);
  assert.equal(JSON.stringify(months), before);
});
test('standalone page uses read-only model preview without legacy app modules, local assets and CSP', () => {
  const html = fs.readFileSync(path.join(root, 'import.html'), 'utf8');
  assert.ok(html.includes("connect-src 'none'"));
  assert.ok(!/top\/script|soneki.js|profit-metrics|trade-history-core/.test(html));
  assert.ok(!/src="https?:/.test(html));
  for (const file of ['csv-core.js', 'sbi-parser.js', 'preview.js', 'model-preview.js']) {
    const code = fs.readFileSync(path.join(root, 'import', file), 'utf8');
    assert.ok(!/sessionStorage|indexedDB|\.setItem\(|\.removeItem\(|\.commit\(|createRepository|fetch\(|XMLHttpRequest|sendBeacon|console\./.test(code));
  }
});
test('Service Worker precache exists, has no duplicate URLs and matches preview HTML', () => {
  const context = vm.createContext({ self: { addEventListener() {} } });
  const code = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
  const urls = vm.runInContext(code + '\nCORE_ASSETS', context);
  assert.equal(new Set(urls).size, urls.length);
  urls.forEach(url => assert.ok(fs.existsSync(path.join(root, url.split('?')[0])), 'Missing static asset'));
  const html = fs.readFileSync(path.join(root, 'import.html'), 'utf8');
  [...html.matchAll(/(?:src|href)="((?:import|assets)\/[^" ]+)"/g)].forEach(match => assert.ok(urls.includes('./' + match[1])));
});

test('localhost HTTP smoke: preview document and all local resources are served', async () => {
  const http = require('node:http');
  const allowed = new Set(['import.html', 'assets/icon-192.png', 'assets/storage-transaction.js', 'assets/data-model-storage.js',
    'import/csv-core.js', 'import/sbi-parser.js', 'import/model-preview.js', 'import/preview.js', 'import/preview.css']);
  const server = http.createServer((request, response) => {
    const file = new URL(request.url, 'http://localhost').pathname.slice(1);
    if (!allowed.has(file)) { response.writeHead(404).end(); return; }
    response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : 'text/html; charset=utf-8');
    response.end(fs.readFileSync(path.join(root, file)));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const file of allowed) assert.equal((await fetch(origin + '/' + file)).status, 200);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
