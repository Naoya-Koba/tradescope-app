const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const assets=require('../assets/current-asset-view.js'),observation=require('../assets/open-positions-view.js');
const {storage,accountId,month,copy,seed,source,pdfService,service,draft,backup}=require('./observation-override-fixture.js');
const {fixture}=require('./monthly-display-fixture.js');
const display=require('../assets/monthly-display-view.js');
function base(){return {rows:fixture().accounts.map((a,i)=>({...a,metrics:Object.fromEntries(['net','confirmed','netPnl','confirmedPnl','completeNet'].map(k=>[k,{value:a.key==='sbivc'?99999:100+i,sourceMonth:'2031-01',status:'previous complete'}]))})),sourceFingerprint:'anonymous-base',hasData:true};}
function view(s,year=2031,b=base()){return assets.create(b,storage.readModels(s),year);}
function change(s,fields={},account={}){const inspected=service(s).inspect(accountId,month),d=draft(inspected);Object.assign(d.account,account);Object.assign(d.holdings[0].values,fields);service(s).save(d,{expectedModels:inspected.models});}
const amount=v=>v.accountData.find(r=>r.label==='SBI VC')?.amount??null;
test('Top/Allocation replace legacy once using identical canonical amount and source month',async()=>{
 const s=await seed(),b=base(),before=copy(b),v=view(s,2031,b);assert.equal(v.crypto.knownAssetTotal,'20126.375');
 assert.equal(v.rows.find(r=>r.key==='sbivc').metrics.net.value,amount(v));assert.equal(v.net.value,20126.375+511);
 assert.equal(v.accountData.find(r=>r.label==='SBI VC').sourceMonth,v.crypto.sourceMonth);assert.equal(v.crypto.sourceMonth,month);assert.deepEqual(b,before);
});
for(const [name,options,cash,expected]of [['crypto only',{},'0','126.375'],['JPY only',{zero:true},'20000','20000'],['all zero',{zero:true},'0','0']])test(name+' retains explicit values without resurrecting holdings',async()=>{
 const s=await seed(options);const inspected=service(s).inspect(accountId,month),d=draft(inspected);d.account.cashBalance=cash;service(s).save(d,{expectedModels:inspected.models});
 const v=view(s);assert.equal(v.crypto.knownAssetTotal,expected);assert.equal(v.crypto.complete,true);assert.equal(v.crypto.monthlyComplete,false);if(name==='all zero')assert.equal(amount(v),null);
});
for(const [name,fields,account,total,unknown]of [
 ['quantity zero',{quantity:'0'},{},'20084.250',false],['quantity null',{quantity:''},{},'20084.250',true],
 ['valuation null',{marketValue:''},{},'20084.250',true],['cash null',{}, {cashBalance:''},'126.375',true],
 ['known zero with unknown',{marketValue:''},{cashBalance:'0'},'84.250',true]
])test(name+' is distinct from complete zero',async()=>{
 const s=await seed();change(s,fields,account);const v=view(s);assert.equal(v.crypto.knownAssetTotal,total);assert.equal(v.crypto.unknownComponents,unknown);assert.equal(v.crypto.complete,!unknown);
});
test('all components null produces null; a known cash zero with unknown holding is a partial zero',async()=>{
 const s=await seed({assets:['USDC']} );change(s,{quantity:'',marketValue:''},{cashBalance:''});assert.equal(view(s).crypto.knownAssetTotal,null);
 change(s,{quantity:'',marketValue:''},{cashBalance:'0'});const v=view(s);assert.equal(v.crypto.knownAssetTotal,'0');assert.equal(v.crypto.complete,false);assert.equal(v.crypto.unknownQuantity,true);
});
for(const[field,value,account]of [['quantity','0.000000000000000001',false],['marketPrice','123.1234567890123456789',false],['marketValue','54321.12345000',false],['cashBalance','123.000000000000000001',true]])test('adopted '+field+' override updates shared view/fingerprint without source mutation',async()=>{
 const s=await seed(),before=copy(storage.readModels(s)),old=view(s);change(s,account?{}:{[field]:value},account?{[field]:value}:{});const v=view(s);
 assert.equal(account?v.crypto.cashBalance:v.crypto.holdings[0][field],value);assert.notEqual(old.sourceFingerprint,v.sourceFingerprint);
 assert.deepEqual(storage.readModels(s).holdingSnapshots,before.holdingSnapshots);assert.deepEqual(storage.readModels(s).accountSnapshots,before.accountSnapshots);
 assert.equal(amount(v),v.rows.find(r=>r.key==='sbivc').metrics.net.value);
});
test('very small decimal subtotal is preserved and does not break dashboard addition',async()=>{
 const s=await seed({assets:['USDC']});change(s,{marketValue:'0.000000000000000001'},{cashBalance:'0'});assert.equal(view(s).crypto.knownAssetTotal,'0.000000000000000001');assert.ok(Number.isFinite(view(s).net.value));
});
test('corrected adopted PDF excludes retained old holdings and report/collateral totals',async()=>{
 const s=await seed(),old=view(s);const next=source('b',{assets:['USDC']});await pdfService(s).save(next,await pdfService(s).inspect(next));
 const v=view(s);assert.equal(v.crypto.holdings.length,1);assert.equal(v.crypto.knownAssetTotal,'20042.125');assert.equal(storage.readModels(s).holdingSnapshots.records.length,4);
 assert.notEqual(old.sourceFingerprint,v.sourceFingerprint);assert.ok(v.crypto.holdings.every(h=>h.accountSnapshotId===v.crypto.accountSnapshotId));
});
test('latest zero source excludes previous positive source',async()=>{
 const s=await seed();await pdfService(s).save(source('b',{zero:true,period:'2031/03/01 ～ 2031/03/31',basis:'2031/03/31'}));
 assert.equal(view(s).crypto.holdings.length,0);assert.equal(view(s).crypto.knownAssetTotal,'20000');assert.equal(view(s).crypto.sourceMonth,'2031-03');
});
test('year-scoped latest selection preserves global Open Positions/Portfolio selection',async()=>{
 const s=await seed();await pdfService(s).save(source('b',{assets:['USDC'],period:'2030/11/01 ～ 2030/11/30',basis:'2030/11/30'}));
 await pdfService(s).save(source('c',{assets:['BTC'],period:'2031/03/01 ～ 2031/03/31',basis:'2031/03/31'}));
 const m=storage.readModels(s);assert.equal(view(s,2030).crypto.sourceMonth,'2030-11');assert.equal(view(s,2031).crypto.sourceMonth,'2031-03');
 assert.equal(observation.latestObservation(m).targetMonth,'2031-03');assert.equal(observation.resolve(m)[0].targetMonth,'2031-03');assert.equal(view(s,2029).crypto.hasSource,false);
});
test('absent canonical year never borrows another year, monthly legacy or manual transactions',async()=>{
 const s=await seed();s.setItem('tradingData','{"2029":{"8":{"sbivc":{"netAssets":12345,"holdings":[{"symbol":"FAKE","valueJPY":12345}]}}}}');
 const v=view(s,2029);assert.equal(v.crypto.knownAssetTotal,null);assert.equal(amount(v),null);assert.equal(v.net.value,511);assert.ok(!JSON.stringify(v).includes('FAKE'));
});
test('missing Input and invalid canonical references fail closed rather than restore legacy',async()=>{
 const s=await seed(),m=storage.readModels(s);m.monthlyAccountInputs=null;assert.equal(assets.create(base(),m,2031).crypto.hasSource,false);
 m.monthlyAccountInputs={schemaVersion:1,records:[{id:'broken'}]};const v=assets.create(base(),m,2031);assert.equal(v.crypto.error,true);assert.equal(v.net.value,511);
});
test('negative other account remains in Top but excluded from Allocation',async()=>{
 const s=await seed(),b=base();b.rows[0].metrics.net.value=-100;const v=view(s,2031,b);assert.equal(v.rows[0],b.rows[0]);
 assert.equal(v.accountData.some(r=>r.label==='GMO'),false);assert.equal(v.net.value,v.accountData.reduce((n,r)=>n+r.amount,0)-100);
});
for(const key of ['gmo','sbi','lightfx','minano','smbc'])test(key+' source and all period metrics remain unchanged with newer SBI VC observation',async()=>{
 const s=await seed(),b=base(),v=view(s,2031,b);assert.equal(v.rows.find(r=>r.key===key),b.rows.find(r=>r.key===key));
 const old=b.rows.find(r=>r.key==='sbivc').metrics,overlay=v.rows.find(r=>r.key==='sbivc').metrics;
 for(const field of ['confirmed','completeNet','netPnl','confirmedPnl'])assert.equal(overlay[field],old[field]);
});
test('real shared monthly dashboard/Annual/Trend calculation remains byte unchanged',()=>{
 const f=fixture(),w={};vm.runInNewContext(fs.readFileSync('assets/profit-metrics.js','utf8'),{window:w});const d=display.create(w.TradeScopeProfitMetrics,f.tradingData,f.initialFunds,f.initialUnrealized,f.models,f.accounts);
 const before=JSON.stringify([d.dashboard(2026),d.series(2026),d.monthlyPnl(2026,9)]);assets.create(d.dashboard(2026),f.models,2026);
 assert.equal(JSON.stringify([d.dashboard(2026),d.series(2026),d.monthlyPnl(2026,9)]),before);
});
test('Storage and Backup v13 remain byte unchanged after repeat/year projections',async()=>{
 const s=await seed(),before=s.snapshot(),payload=copy(backup(s).build());view(s);view(s,2029);view(s);assert.equal(s.snapshot(),before);assert.deepEqual(copy(backup(s).build()),payload);assert.equal(payload.backupVersion,13);
});
test('read-only modules have no Storage mutation, history dependency or log',()=>{
 for(const file of ['assets/current-asset-view.js','assets/open-positions-view.js'])assert.doesNotMatch(fs.readFileSync(file,'utf8'),/setItem|removeItem|\.commit\(|console\.|fetch\(|TradeScopeHistory/);
 const code=fs.readFileSync('top/script.js','utf8');assert.match(code,/const cryptoAccount = \(topSeries\.accountData/);assert.match(code,/const annualNetPnL = latestDashboard\.netPnl\.value/);
 assert.match(code,/elTotal\.textContent = Number\.isFinite\(currentAssetView\.net\.value\)/);assert.match(code,/accountData = currentAssetView\.accountData/);
});
test('UI uses shared overlay for Top/Allocation, source date and obtained-only ratio',()=>{
 const code=fs.readFileSync('top/script.js','utf8'),html=fs.readFileSync('index.html','utf8');assert.match(code,/評価額取得分の比率/);assert.match(code,/portfolioMonthLabel\(crypto\.sourceMonth\)/);
 assert.match(html,/id="topAssetSourceStatus"/);assert.match(html,/id="allocationSourceStatus"/);assert.ok(html.indexOf('current-asset-view.js')<html.indexOf('const topScriptVersion'));
});
