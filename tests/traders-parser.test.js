const test=require('node:test'),assert=require('node:assert/strict');
const parser=require('../import/traders-parser.js'),{report,pdfBytes,text}=require('./traders-pdf-fixture.js');
for(const broker of ['lightfx','minano'])test(`${broker}: product/header/month/price-only unrealized and complete internal checks`,()=>{
 const p=parser.parse(report(broker),broker);assert.equal(p.valid,true);assert.deepEqual(p.errors,[]);assert.equal(p.broker,broker);
 assert.equal(p.targetMonth,'2026-09');assert.equal(p.snapshotAsOf,'2026-09-30');assert.equal(p.positions.length,2);
 assert.equal(p.values.unrealizedPnl,'-30');assert.equal(p.values.monthEndUnsettledSwap,'8');assert.equal(p.values.reportedAccountEvaluationPnl,'-22');
 assert.equal(p.values.realizedPnl,'10');assert.equal(p.values.reportedSettledSwapPnl,'5');assert.equal(p.values.deposit,'20');assert.equal(p.values.withdrawal,'7');
 assert.equal(p.values.cashBalance,'1028');assert.equal(p.values.netAssetValue,'1006');assert.equal(p.values.requiredMargin,'50');assert.equal(p.values.swapPnl,undefined);
 assert.equal(p.positions[0].acquisitionPrice,'1.23456789');assert.equal(p.positions[0].symbol,'AAA/JPY');
});
test('product isolation uses report header, never filename or LIGHT-labelled position',()=>{
 const r=report('minano');r.pages[0].items.push(text('LIGHT FX',215,400));r.filename='LIGHT.pdf';
 assert.equal(parser.detect(r),'minano');assert.ok(parser.parse(r,'lightfx').errors.includes('TRADERS_WRONG_PRODUCT'));
 assert.ok(parser.parse(report(),'minano').errors.includes('TRADERS_WRONG_PRODUCT'));
});
test('unrecognised/malformed document and missing financial sections stop',()=>{for(const r of [{pages:[]},{pages:[{items:[text('別の報告書',0,0)]}]}])assert.equal(parser.parse(r).valid,false);});
for(const [name,x,y,value]of [['fee',307,320,'1'],['other',447,320,'1'],['unsettled',528,617,'1'],['price mismatch',487,463,'-999'],['net mismatch',324,617,'999'],['cash mismatch',36,617,'999'],['blank',139,320,'']])test(`${name} is not silently ignored`,()=>{
 const r=report();const item=r.pages[0].items.find(i=>i.x===x&&i.y===y);assert.ok(item);item.text=value;assert.equal(parser.parse(r).valid,false);
});
test('report zero is explicit; no net movement inference; blank remains missing',()=>{assert.equal(parser.decimal('0'),'0');assert.equal(parser.decimal(''),null);assert.equal(parser.decimal('−'),null);const p=parser.parse(report());assert.notEqual(p.values.deposit,'13');});
test('pair normalisation is narrow ASCII FX identity; no typo guesses',()=>{assert.equal(parser.pair('tryjpy'),'TRY/JPY');assert.equal(parser.pair('HUF/JPY'),'HUF/JPY');assert.equal(parser.pair('TRY-JPY'),null);assert.equal(parser.pair('EUDUSD'),'EUD/USD');});
test('PII and arbitrary source text never enter output or errors',()=>{const r=report();r.pages[0].items.push(text('PRIVATE_NAME PRIVATE_PHONE PRIVATE_ACCOUNT',20,760));assert.doesNotMatch(JSON.stringify(parser.parse(r)),/PRIVATE/);});
test('local text-only extraction feeds shared parser for both products',async()=>{
 globalThis.DOMMatrix||=class{};globalThis.Path2D||=class{};globalThis.ImageData||=class{};
 const e=await import('../import/pdf-extractor.mjs');for(const broker of ['lightfx','minano'])assert.equal(parser.parse(await e.extract(pdfBytes(report(broker))),broker).valid,true);
});
test('additional fixed Japanese CMap is local and licensed',()=>{const fs=require('node:fs');assert.ok(fs.statSync('vendor/pdfjs-6.4.299/cmaps/UniJIS-UCS2-H.bcmap').size>0);assert.ok(fs.existsSync('vendor/pdfjs-6.4.299/cmaps/LICENSE'));});
test('trade fee and offsetting nonzero ledger fees/other are blocked even if monthly net is zero',()=>{
 for(const x of [307,447]){const r=report();r.pages[0].items.find(i=>i.x===x&&i.y===320).text='1';r.pages[0].items.find(i=>i.x===x&&i.y===304).text='-1';assert.equal(parser.parse(r).valid,false);}
 const r=report();r.pages[0].items.find(i=>i.x===380&&i.y===535).text='1';assert.ok(parser.parse(r).errors.includes('TRADERS_UNSUPPORTED_FEE'));
});
test('conflicting report periods and foreign unit suffix do not silently become a JPY observation',()=>{
 const r=report();r.pages.push({number:2,items:[text('作成基準日：',366,700),text('2026-10',422,700)]});assert.ok(parser.parse(r).errors.includes('TRADERS_PERIOD_INVALID'));
 const foreign=report();foreign.pages[0].items.find(i=>i.x===36&&i.y===617).text='1028(USD)';assert.equal(parser.parse(foreign).valid,false);
});
