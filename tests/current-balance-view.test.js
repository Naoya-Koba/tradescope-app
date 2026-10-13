// Anonymous fixtures only; current balance carries are never saved to monthly models.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto').webcrypto;
const display=require('../assets/monthly-display-view.js'),assets=require('../assets/current-asset-view.js'),model=require('../assets/data-model-storage.js');
const {fixture}=require('./monthly-display-fixture.js'),sbi=require('../assets/sbi-monthly-save.js');
const {MemoryStorage,now}=require('./gmo-support.js'),vc=require('./observation-override-fixture.js');
const w={};vm.runInNewContext(fs.readFileSync('assets/profit-metrics.js','utf8'),{window:w});
const shared=f=>display.create(w.TradeScopeProfitMetrics,f.tradingData,f.initialFunds,f.initialUnrealized,f.models,f.accounts);
function view(f){const d=shared(f);return assets.create(d.dashboard(2026),f.models,2026,{balanceHistory:d.balanceHistory});}
const sbiRow=v=>v.rows.find(r=>r.key==='sbi');
function storage(f){return new MemoryStorage({tradingData:JSON.stringify(f.tradingData),...Object.fromEntries(Object.entries(f.models).filter(([,v])=>v).map(([k,v])=>[model.keys[k],JSON.stringify(v)]))});}
function previousComponents(f){
 const s=storage(f);sbi.createService(s,{crypto,clock:()=>now}).save({targetMonth:'2026-09',domesticImportBatchId:'batch_sbi',
   foreignAssetValue:'500',foreignUnrealizedPnl:'2',foreignDate:'2026-09-30',cashBalance:'80',cashDate:'2026-09-30',realizedPnL:'0',deposit:'0',withdrawal:'0'});
 f.models=model.readModels(s);
}
function october(f,{domestic=true}={}){
 const b=f.models.importBatches.records[0],a=f.models.accountSnapshots.records[0],s=f.models.monthlyAccountStates.records[0];
 f.models.importBatches.records.push({...b,id:'batch_gmo_oct',targetMonth:'2026-10',snapshotAsOf:'2026-10-31'});
 f.models.accountSnapshots.records.push({...a,id:'as_gmo_oct',importBatchId:'batch_gmo_oct',targetMonth:'2026-10',snapshotAsOf:'2026-10-31'});
 f.models.monthlyAccountStates.records.push({...s,id:'mas_gmo_oct',adoptedAccountSnapshotId:'as_gmo_oct',targetMonth:'2026-10'});
 if(domestic){
   f.models.importBatches.records.push({...f.models.importBatches.records[1],id:'batch_sbi_oct',targetMonth:'2026-10',snapshotAsOf:'2026-11-02'});
   f.models.holdingSnapshots.records.push({...f.models.holdingSnapshots.records[0],id:'hs_sbi_oct',importBatchId:'batch_sbi_oct',targetMonth:'2026-10',snapshotAsOf:'2026-11-02',marketValue:'350',unrealizedPnl:'30'});
 }
}
test('SBI current domestic + previous foreign/cash keep independent confirmation months',()=>{
 const f=fixture();previousComponents(f);october(f);const v=view(f),r=sbiRow(v),by=Object.fromEntries(r.balance.components.map(c=>[c.key,c]));
 assert.equal(r.metrics.net.value,930);assert.equal(by.domestic.value,'350');assert.equal(by.domestic.currentConfirmed,true);
 for(const key of ['foreign','cash']){assert.equal(by[key].sourceMonth,'2026-09');assert.equal(by[key].carried,true);assert.equal(by[key].currentConfirmed,false);}
 assert.equal(r.balance.complete,true);assert.equal(r.balance.currentComplete,false);assert.equal(v.hasCarried,true);
 assert.equal(v.accountData.find(a=>a.label===r.name).amount,r.metrics.net.value);assert.equal(v.netPeriodComparison.growth,null);
});
test('a newer account month carries the last partial SBI observation, not an older complete whole amount',()=>{
 const f=fixture();october(f,{domestic:false});const v=view(f),r=sbiRow(v);
 assert.equal(r.metrics.net.value,200.25);assert.equal(r.metrics.net.sourceMonth,'2026-09');assert.equal(r.balance.hasCarried,true);
 assert.equal(r.balance.partial,true);assert.equal(r.balance.components.find(c=>c.key==='foreign').value,null);
 assert.equal(r.metrics.confirmed.sourceMonth,'2026-08');
});
test('first domestic observation does not double-count a prior opaque legacy account balance',()=>{
 const f=fixture();f.tradingData[2026][8].sbi.netAssets=9000;const r=sbiRow(view(f));
 assert.equal(r.metrics.net.value,200.25);assert.equal(r.balance.complete,false);assert.equal(r.balance.unknownComponents,true);
});
test('SBI all components confirmed this month remove carry even when monthly flows are still missing',()=>{
 const f=fixture();previousComponents(f);october(f);const s=storage(f);
 sbi.createService(s,{crypto,clock:()=>now}).save({targetMonth:'2026-10',domesticImportBatchId:'batch_sbi_oct',
   foreignAssetValue:'600',foreignUnrealizedPnl:'3',foreignDate:'2026-10-31',cashBalance:'90',cashDate:'2026-10-31'});
 f.models=model.readModels(s);const r=sbiRow(view(f));assert.equal(r.metrics.net.value,1040);assert.equal(r.balance.currentComplete,true);assert.equal(r.balance.hasCarried,false);
 assert.equal(shared(f).accountMonth(2026,10,f.accounts.find(a=>a.key==='sbi')).complete,false);
});
test('SBI explicit current component zero never resurrects a previous positive component',()=>{
 const f=fixture();previousComponents(f);october(f);const s=storage(f);
 sbi.createService(s,{crypto,clock:()=>now}).save({targetMonth:'2026-10',domesticImportBatchId:'batch_sbi_oct',foreignAssetValue:'0',foreignUnrealizedPnl:'0',foreignDate:'2026-10-31',cashBalance:'0',cashDate:'2026-10-31'});
 f.models=model.readModels(s);const r=sbiRow(view(f));assert.equal(r.metrics.net.value,350);
 for(const c of r.balance.components.filter(c=>c.key!=='domestic')){assert.equal(c.explicitZero,true);assert.equal(c.carried,false);}
});
test('ambiguous current SBI source blocks stale fallback instead of silently selecting a Batch',()=>{
 const f=fixture();previousComponents(f);october(f);
 f.models.importBatches.records.push({...f.models.importBatches.records.at(-1),id:'batch_ambiguous'});
 f.models.holdingSnapshots.records.push({...f.models.holdingSnapshots.records.at(-1),id:'hs_ambiguous',importBatchId:'batch_ambiguous'});
 const r=sbiRow(view(f));assert.equal(r.balance.blocked,true);assert.equal(r.metrics.net.value,null);
});
test('null current domestic total carries a prior verified total with its old month, not a current subtotal',()=>{
 const f=fixture();previousComponents(f);october(f);f.models.holdingSnapshots.records.at(-1).marketValue=null;
 const r=sbiRow(view(f)),c=r.balance.components.find(c=>c.key==='domestic');assert.equal(c.value,'200.25');assert.equal(c.carried,true);assert.equal(c.sourceMonth,'2026-09');
});
test('GMO whole-account current complete remains identical; untouched FX accounts carry complete legacy balances',()=>{
 const f=fixture();october(f);const d=shared(f).dashboard(2026),v=view(f);
 assert.equal(v.rows.find(r=>r.key==='gmo').metrics.net.value,d.rows.find(r=>r.key==='gmo').metrics.net.value);
 for(const key of ['lightfx','minano']){const r=v.rows.find(r=>r.key===key);assert.equal(r.balance.components.length,1);assert.equal(r.balance.components[0].sourceMonth,'2026-08');assert.equal(r.balance.hasCarried,true);}
});
test('a missing prior ledger month does not label a known official snapshot as a complete ledger amount',()=>{
 const f=fixture();october(f);f.models.monthlyAccountStates.records=f.models.monthlyAccountStates.records.filter(r=>r.targetMonth!=='2026-09');
 const r=view(f).rows.find(r=>r.key==='gmo');assert.equal(r.metrics.net.value,136);assert.equal(r.balance.components[0].basis,'current-asset-observation');
 assert.equal(r.metrics.confirmed.sourceMonth,'2026-08');assert.equal(shared(f).accountMonth(2026,10,f.accounts[0]).confirmed,null);
});
for(const broker of ['lightfx','minano'])test(broker+' previous PDF partial observation is carried without fabricating calendar swap',async()=>{
 const parser=require('../import/traders-parser.js'),save=require('../import/traders-save.js'),{report}=require('./traders-pdf-fixture.js');
 const s=new MemoryStorage(),api=save.createService(s,broker,{clock:()=>now,cryptoApi:crypto});
 await api.save({preview:parser.parse(report(broker),broker),fileHash:'a'.repeat(64),fileSize:100,calendarSwap:''});
 const f=fixture(),m=model.readModels(s);for(const key of Object.keys(m)){if(m[key])f.models[key]={...m[key],records:[...(f.models[key]?.records||[]),...m[key].records]};}
 october(f,{domestic:false});const r=view(f).rows.find(r=>r.key===broker);assert.equal(r.metrics.net.value,1006);assert.equal(r.balance.components[0].sourceMonth,'2026-09');
 assert.equal(r.balance.hasCarried,true);assert.equal(f.models.monthlyAccountInputs.records[0].adoptedValues.swapPnl,null);
});
test('current projection is independent of monthly flows, confirmed assets, Annual and historical Trend',()=>{
 const f=fixture();previousComponents(f);october(f);const d=shared(f);
 const capture=()=>JSON.stringify([d.dashboard(2026),d.month(2026,10),d.yearlyTotals(2026),d.monthlyPnl(2026,10),d.series(2026)]);
 const before=capture(),v=view(f);assert.equal(capture(),before);
 const original=d.dashboard(2026);for(const r of v.rows)for(const key of ['confirmed','netPnl','confirmedPnl','completeNet'])assert.deepEqual(r.metrics[key],original.rows.find(x=>x.key===r.key).metrics[key]);
});
test('current source changes fingerprint, with no carry value copied into source records',()=>{
 const f=fixture();previousComponents(f);october(f);const before=JSON.stringify(f),v=view(f);assert.equal(JSON.stringify(f),before);
 f.models.holdingSnapshots.records.at(-1).marketValue='351';assert.notEqual(view(f).sourceFingerprint,v.sourceFingerprint);
});
test('SBI VC current null cash carries only a prior month adopted value; current zero cash stops it',async()=>{
 const s=await vc.seed();await vc.pdfService(s).save(vc.source('b',{period:'2031/03/01 ～ 2031/03/31',basis:'2031/03/31'}));
 const api=vc.service(s),p=api.inspect(vc.accountId,'2031-03');
 const draft={accountId:vc.accountId,targetMonth:'2031-03',account:{...p.adopted,cashBalance:''},holdings:p.holdings.map(h=>({holdingSnapshotId:h.holdingSnapshotId,instrumentId:h.instrumentId,values:h.adopted}))};
 api.save(draft,{expectedModels:p.models});let v=assets.create({year:2031,month:3,rows:[{key:'sbivc',metrics:{}}]},model.readModels(s),2031);
 assert.equal(v.crypto.balance.components.find(c=>c.key==='cash').sourceMonth,'2031-02');assert.equal(v.crypto.hasCarried,true);
 draft.account.cashBalance='0';api.save(draft,{expectedModels:api.inspect(vc.accountId,'2031-03').models});v=assets.create({year:2031,month:3,rows:[{key:'sbivc',metrics:{}}]},model.readModels(s),2031);
 assert.equal(v.crypto.balance.components.find(c=>c.key==='cash').explicitZero,true);assert.equal(v.crypto.balance.components.find(c=>c.key==='cash').carried,false);
});
test('SBI VC latest zero roster excludes old positive holdings even when another account advances the baseline',async()=>{
 const s=await vc.seed();await vc.pdfService(s).save(vc.source('b',{zero:true,period:'2031/03/01 ～ 2031/03/31',basis:'2031/03/31'}));
 const m=model.readModels(s),v=assets.create({year:2031,month:4,rows:[{key:'sbivc',metrics:{}}]},m,2031);
 assert.equal(v.crypto.holdings.length,0);assert.equal(v.crypto.knownAssetTotal,'20000');assert.equal(v.crypto.balance.components.length,1);assert.equal(v.crypto.hasCarried,true);
 assert.equal(require('../assets/open-positions-view.js').resolve(m).length,0);
});

test('crypto quantity/rate confirmation states are separate from unchanged latest holding consumers',async()=>{
 const s=await vc.seed();await vc.pdfService(s).save(vc.source('b',{period:'2031/03/01 ～ 2031/03/31',basis:'2031/03/31'}));
 const api=vc.service(s),p=api.inspect(vc.accountId,'2031-03');
 const draft={accountId:vc.accountId,targetMonth:'2031-03',account:vc.copy(p.adopted),holdings:p.holdings.map(h=>({holdingSnapshotId:h.holdingSnapshotId,instrumentId:h.instrumentId,values:{...h.adopted,marketPrice:''}}))};
 api.save(draft,{expectedModels:p.models});const m=model.readModels(s);
 const v=assets.create({year:2031,month:3,rows:[{key:'sbivc',metrics:{}}]},m,2031),fields=v.crypto.balance.holdingFields[0].fields;
 assert.equal(fields.find(f=>f.key==='quantity').currentConfirmed,true);
 assert.equal(fields.find(f=>f.key==='marketPrice').carried,true);
 assert.equal(fields.find(f=>f.key==='marketPrice').sourceMonth,'2031-02');
 assert.equal(v.crypto.holdings[0].marketPrice,null);
 assert.equal(require('../assets/open-positions-view.js').resolve(m)[0].marketPrice,null);
});
test('SBI VC corrected same-month unknown does not borrow the unadopted original PDF value',async()=>{
 const s=await vc.seed();const next=vc.source('b');await vc.pdfService(s).save(next,await vc.pdfService(s).inspect(next));
 const p=vc.service(s).inspect(vc.accountId,vc.month),draft=vc.draft(p);draft.holdings[0].values.marketValue='';vc.service(s).save(draft,{expectedModels:p.models});
 const v=assets.create({year:2031,month:2,rows:[{key:'sbivc',metrics:{}}]},model.readModels(s),2031);
 assert.equal(v.crypto.balance.components.find(c=>c.key.startsWith('holding:')).value,null);assert.equal(v.crypto.unknownComponents,true);
});
test('repeat balance projections do not write Storage or change Backup v13',async()=>{
 const s=await vc.seed(),before=s.snapshot(),b=vc.copy(vc.backup(s).build());
 for(const month of [2,3,4])assets.create({year:2031,month,rows:[{key:'sbivc',metrics:{}}]},model.readModels(s),2031);
 assert.equal(s.snapshot(),before);assert.deepEqual(vc.copy(vc.backup(s).build()),b);assert.equal(b.backupVersion,13);
});
test('Risk, Portfolio and Open Positions stay on their original source; no production carry consumer outside Top',()=>{
 const top=fs.readFileSync('top/script.js','utf8');assert.match(top,/const cryptoAccount = \(topSeries\.accountData/);
 for(const file of ['profit/soneki.js','history/history.js'])assert.doesNotMatch(fs.readFileSync(file,'utf8'),/balanceHistory|TradeScopeBalanceView|TradeScopeCurrentAssets/);
 for(const file of ['assets/balance-view.js','assets/current-asset-view.js'])assert.doesNotMatch(fs.readFileSync(file,'utf8'),/setItem|removeItem|\.commit\(|fetch\(|console\./);
});
