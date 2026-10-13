const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const view=require('../assets/open-positions-view.js'),adoption=require('../assets/observation-adoption.js');
const {storage,accountId,month,copy,seed,source,pdfService,service,draft,backup}=require('./observation-override-fixture.js');
const models=s=>storage.readModels(s);
function change(s,field,value){const v=service(s).inspect(accountId,month),d=draft(v);d.holdings[0].values[field]=value;return service(s).save(d,{expectedModels:v.models});}
test('positive SBI VC holdings read latest adopted official quantity/rate/value with exact precision',async()=>{
 const s=await seed(),m=models(s),r=view.resolve(m);assert.equal(r.length,3);assert.deepEqual(r.map(h=>h.symbol),['BTC/JPY','ETH/JPY','USDC/JPY']);
 for(const h of r){assert.equal(h.account,accountId);assert.equal(h.quantity,'0.1234567890123456789');assert.equal(h.marketPrice,'321.123456789');assert.equal(h.marketValue,'42.125');assert.equal(h.targetMonth,month);assert.equal(h.importBatchId,m.accountSnapshots.records[0].importBatchId);}
});
test('no adopted input means no holdings even if legacy/manual/imported history exists',async()=>{const s=await seed(),m=models(s);m.monthlyAccountInputs=null;assert.deepEqual(view.resolve(m),[]);});
test('corrected source retains old holdings but projects only the adopted source',async()=>{const s=await seed(),p=source('b',{assets:['USDC']});await pdfService(s).save(p,await pdfService(s).inspect(p));assert.equal(models(s).holdingSnapshots.records.length,4);const r=view.resolve(models(s));assert.deepEqual(r.map(h=>h.symbol),['USDC/JPY']);assert.equal(r[0].accountSnapshotId,models(s).monthlyAccountInputs.records[0].adoptedAccountSnapshotId);});
test('latest targetMonth adoption wins over importedAt/created order; zero never falls back to prior positive',async()=>{
 const s=await seed(),p=source('b',{assets:['BTC','ETH','USDC'],zero:true,period:'2031/03/01 ～ 2031/03/31',basis:'2031/03/31'});
 await pdfService(s).save(p);const m=models(s);m.monthlyAccountInputs.records.reverse();assert.deepEqual(view.resolve(m),[]);
});
for(const [field,value]of [['quantity','3.28199800000000000001'],['marketPrice','12345.1234567890123456789'],['marketValue','54321.12345000']])test('manual adopted '+field+' reflected without modifying source',async()=>{
 const s=await seed(),before=copy(models(s).holdingSnapshots);change(s,field,value);const r=view.resolve(models(s));assert.equal(r[0][field],value);assert.equal(r[0].hasOverrides,true);assert.deepEqual(models(s).holdingSnapshots,before);
});
test('adopted zero excludes formerly held asset; unrelated unheld zero never appears',async()=>{const s=await seed();change(s,'quantity','0.000');assert.equal(view.resolve(models(s)).length,2);const p=source('b',{assets:['BTC','ETH','USDC','UNUSED'],zero:true});await pdfService(s).save(p,await pdfService(s).inspect(p));assert.deepEqual(view.resolve(models(s)),[]);assert.equal(models(s).instruments.records.length,3);});
test('adopted null quantity is unknown, not a current holding or prior-month fallback',async()=>{const s=await seed();change(s,'quantity','');assert.equal(view.resolve(models(s)).length,2);});
test('missing rate/value stay null; no computed valuation, acquisition cost or P/L',async()=>{const s=await seed({blankRate:true});change(s,'marketValue','');const r=view.resolve(models(s));assert.equal(r[0].marketValue,null);for(const h of r){assert.equal(h.marketPrice,null);assert.equal(h.acquisitionPrice,null);assert.equal(h.unrealizedPnl,null);assert.equal(h.realizedPnl,null);}});
test('leverage collateral and cash never become positions',async()=>{const s=await seed(),r=view.resolve(models(s));assert.ok(r.every(h=>h.holdingType==='spot-observation'&&h.symbol.endsWith('/JPY')));assert.equal(r.length,models(s).holdingSnapshots.records.length);assert.ok(r.every(h=>h.marketValue!=='20000'&&h.marketValue!=='5000'));});
test('all SBI VC aliases excluded from transaction-derived positions regardless of replacement/active state',()=>{
 const aliases=['SBI VC','sbivc','acc_sbivc_crypto','SBI VCトレード',' SBI VC '],other=['GMO','Light FX','みんなのFX','SBI'];
 const entries=[...aliases,...other].map(account=>({account,quantity:99,symbol:'ETH/JPY'}));assert.deepEqual(view.legacyEntries(entries).map(e=>e.account),other);
});
test('legacy FX source objects and quantities untouched',()=>{const entries=['GMO','Light FX','みんなのFX'].map(account=>({account,assetType:'FX',symbol:'AAA/JPY',quantity:2,rate:3,side:'buy'}));assert.deepEqual(view.legacyEntries(entries),entries);assert.strictEqual(view.legacyEntries(entries)[0],entries[0]);});
test('source mismatch or missing adopted Snapshot fails closed',async()=>{const s=await seed();for(const mutate of[m=>m.accountSnapshots.records=[],m=>m.holdingSnapshots.records[0].importBatchId='missing',m=>m.accountSnapshots.records[0].accountId='wrong']){const m=models(s);mutate(m);assert.throws(()=>view.resolve(m));}});
test('read/reload projection mutates neither models nor Storage, Backup v13/legacy remain byte identical',async()=>{const s=await seed(),before=s.snapshot(),m=models(s),json=JSON.stringify(m),payload=backup(s).build();assert.deepEqual(view.resolve(models(s)),view.resolve(m));assert.equal(JSON.stringify(m),json);assert.equal(s.snapshot(),before);assert.equal(payload.backupVersion,13);assert.deepEqual(copy(backup(s).build()),copy(payload));assert.equal(s.getItem(storage.keys.monthlyAccountStates),null);});
test('decimal display preserves small quantities and long rate precision, trims only trailing zeros',()=>{
 for(const [input,expected]of [['3.281998000','3.281998'],['0.000000000000000001','0.000000000000000001'],['12345.1234567890123456789','12,345.1234567890123456789'],['0.000','0'],[null,'—']])assert.equal(view.decimalLabel(input),expected);
});
function render(s,mode='merged'){
 const text=fs.readFileSync('history/history.js','utf8'),elements=Object.fromEntries(['openPositionsBody','openPositionsSummary','openPositionsPrimaryHeader','openPositionDetail','openPositionsSourceStatus'].map(id=>[id,{hidden:true,textContent:'',innerHTML:'',querySelectorAll:()=>[]}]));
 const context=vm.createContext({window:{TradeScopeOpenPositionsView:view,TradeScopeDataStorage:storage},localStorage:s,document:{getElementById:id=>elements[id]},openPositionsView:mode,
 historyCore:{calculateOpenPositions:entries=>entries.map(e=>({...e,absQuantity:e.quantity,avgRate:e.rate})),buildSecuritiesOpenPositions:()=>[]},displayAccountName:require('../assets/account-ui.js').displayAccountName});
 for(const [start,end]of [['function escapeHtml','function openDrawer'],['function fmtJPY','function toOptionHtml'],['function aggregateOpenPositions','// ===== Close Position Modal'],['function renderOpenPositionDetail','function renderHistoryTable']])vm.runInContext(text.slice(text.indexOf(start),text.indexOf(end)),context);
 context.entries=[{account:'SBI VC',symbol:'FAKE/JPY',assetType:'暗号資産',side:'buy',quantity:99,rate:8},{account:'GMO',symbol:'AAA/JPY',assetType:'FX',side:'buy',quantity:2,rate:3}];
 vm.runInContext('renderOpenPositions(entries)',context);return{elements,context};
}
for(const mode of ['merged','account'])test(mode+' UI shows observation rate/value/precision, not transaction rate/quantity or close action',async()=>{
 const s=await seed(),before=s.snapshot(),{elements,context}=render(s,mode),html=elements.openPositionsBody.innerHTML;
 assert.match(html,/SBI VC/);assert.match(html,/0\.1234567890123456789 BTC/);assert.match(html,/評価レート.*321\.123456789 円/);assert.match(html,/42\.125 円/);assert.doesNotMatch(html,/FAKE|99 ETH/);assert.equal((html.match(/data-close-position-index=/g)||[]).length,1);assert.match(html,/2 Lot/);
 context.position=view.resolve(models(s))[0];vm.runInContext('renderOpenPositionDetail(position)',context);assert.match(elements.openPositionDetail.innerHTML,/取得原価:<\/strong> —/);assert.match(elements.openPositionDetail.innerHTML,/評価損益:<\/strong> —/);assert.equal(s.snapshot(),before);
});
test('unreadable canonical Storage cannot resurrect manual SBI VC quantity; FX display continues',async()=>{const s=await seed();s.setItem(storage.keys.monthlyAccountInputs,'{');const {elements}=render(s);assert.equal(elements.openPositionsSourceStatus.hidden,false);assert.doesNotMatch(elements.openPositionsBody.innerHTML,/FAKE|BTC/);assert.match(elements.openPositionsBody.innerHTML,/AAA\/JPY/);});
test('Open Positions responsive table and dependencies isolated from other consumers',()=>{const html=fs.readFileSync('history.html','utf8'),css=fs.readFileSync('history/history.css','utf8');assert.ok(html.indexOf('observation-adoption.js')<html.indexOf('open-positions-view.js'));assert.ok(html.indexOf('open-positions-view.js')<html.indexOf('history/history.js'));assert.match(css,/@media \(max-width: 600px\)[\s\S]*\.open-positions \.data-table \{ min-width: 0;/);for(const p of ['index.html','import.html','profit/soneki.html'])assert.doesNotMatch(fs.readFileSync(p,'utf8'),/open-positions-view/);assert.doesNotMatch(fs.readFileSync('assets/open-positions-view.js','utf8'),/\.setItem\(|\.commit\(|fetch\(|console\./);});
