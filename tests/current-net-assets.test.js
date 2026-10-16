const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const assets=require('../assets/current-asset-view.js'),display=require('../assets/monthly-display-view.js'),results=require('../assets/display-results.js');
const {currentFixture}=require('./current-net-assets-fixture.js'),{backup}=require('./observation-override-fixture.js');
const w={};vm.runInNewContext(fs.readFileSync('assets/profit-metrics.js','utf8'),{window:w});
const view=f=>display.create(w.TradeScopeProfitMetrics,f.tradingData,f.initialFunds,f.initialUnrealized,f.models,f.accounts);
const bundle=(f,year)=>{const d=view(f);return results.create(d,year,{initialSources:{funds:f.initialFunds,unrealized:f.initialUnrealized},currentFactory:()=>assets.latest(d,f.models,{tradingData:f.tradingData})});};
const source=file=>fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
function render(f,year){
 const elements=new Map(),document={getElementById(id){if(!elements.has(id))elements.set(id,{textContent:'',dataset:{},classList:{remove(){},add(){}}});return elements.get(id);}};
 const r=bundle(f,year),ctx={document,window:{},currentAssetView:r.current,latestDashboard:r.period,latestResults:r,topSeries:{year},
  linkedCalculator:()=>({warning:()=>''}),portfolioMonthLabel:m=>m,fmtJPY:v=>'¥'+Math.round(v).toLocaleString(),setSignClass(){},
  sharedDisplayResults:()=>r,displayReadFailed:false,monthlyCalculator:()=>({warning:()=>''}),currentYear:year,
  displayAccountName:k=>k,monthlyDisplayView:()=>view(f),calculateInitialCapital:()=>600,ACCOUNTS:f.accounts,GROWTH_TARGET_ACCOUNTS:f.accounts.filter(a=>!a.bankOnly),yearInitialUnrealized:f.initialUnrealized};
 vm.createContext(ctx);
 const profit=source('profit/soneki.js');
 vm.runInContext(profit.slice(profit.indexOf('function formatOptionalJPY'),profit.indexOf('function optionalSignStyle')),ctx);
 vm.runInContext(source('top/script.js').match(/function updateKPIs\(\) \{[\s\S]*?\n}\nupdateKPIs\(\);/)[0],ctx);
 vm.runInContext(profit.slice(profit.indexOf('function renderAnnualSummary()'),profit.indexOf('function formatOptionalJPY'))+'\nrenderAnnualSummary();',ctx);
 return {r,elements};
}
test('production Home/profit renderers use identical current assets, even for older or empty selected years',async()=>{
 const f=await currentFixture(),before=f.store.snapshot(),current=bundle(f,2026).current;
 for(const year of [2025,2026,2028,2029]){
  const {r,elements:e}=render(f,year);assert.deepEqual(r.current,current);
  assert.equal(e.get('kpiTotal').textContent,e.get('totalAssets').textContent);
  assert.equal(e.get('kpiTotal').dataset.basis,e.get('totalAssets').dataset.basis);
  assert.equal(e.get('deltaTotal').textContent,e.get('totalAssetsDelta').textContent);
  assert.equal(e.get('growthTotal').textContent,e.get('yearGrowthRate').textContent);
 }
 assert.equal(f.store.snapshot(),before);
});
test('September official spot + JPY cash stays current while VC period completeness falls back to August',async()=>{
 const f=await currentFixture(),d=view(f),r=bundle(f,2026),row=r.current.rows.find(a=>a.key==='sbivc');
 assert.equal(row.metrics.net.sourceMonth,'2026-09');assert.equal(row.metrics.net.value,20042.125);
 assert.equal(r.current.year,2026);assert.equal(r.current.targetMonth,'2026-09');
 assert.equal(r.period.rows.find(a=>a.key==='sbivc').metrics.net.sourceMonth,'2026-08');
 const vc=d.accountMonth(2026,9,f.accounts.find(a=>a.key==='sbivc'));
 assert.equal(vc.realized,null);assert.equal(vc.unrealized,null);assert.equal(vc.complete,false);
 assert.notEqual(d.dashboard(2026,8).net.value,r.current.net.value);
 assert.notEqual(d.month(2025,1).rows.find(a=>a.key==='sbivc').asset,row.metrics.net.value);
 assert.equal(r.current.netPeriodComparison.delta,null);assert.equal(r.current.netPeriodComparison.growth,null);
});
test('all six existing current account readers and Allocation amounts are preserved',async()=>{
 const f=await currentFixture(),d=view(f),old=assets.create(d.dashboard(2026),f.models,2026,{balanceHistory:d.balanceHistory}),now=bundle(f,2025).current;
 for(const key of ['gmo','lightfx','minano','sbi','sbivc','smbc'])assert.deepEqual(now.rows.find(r=>r.key===key),old.rows.find(r=>r.key===key));
 assert.deepEqual(now.accountData,old.accountData);assert.equal(now.net.value,old.net.value);
});
test('current projection leaves fixed-month, annual, trend and confirmed calculations byte unchanged',async()=>{
 const f=await currentFixture(),d=view(f),periods=()=>JSON.stringify([2025,2026,2028].map(y=>[d.dashboard(y),d.series(y),d.yearlyTotals(y),d.month(y,8)])),before=periods();
 for(const year of [2025,2026,2028])bundle(f,year);
 assert.equal(periods(),before);
});
test('explicit observed zero remains known and missing valuation is never replaced by a ledger zero',async()=>{
 const f=await currentFixture({zero:true}),r=bundle(f,2025).current;
 assert.equal(r.rows.find(a=>a.key==='sbivc').metrics.net.value,20000);
 const cash=f.models.accountSnapshots.records.find(a=>a.accountId==='acc_sbivc_crypto');cash.cashBalance='0';
 const zero=bundle(f,2025).current;assert.equal(zero.rows.find(a=>a.key==='sbivc').metrics.net.value,0);
 const unknown=await currentFixture(),vc=require('./observation-override-fixture.js');
 const inspected=vc.service(unknown.store).inspect(vc.accountId,'2026-09'),draft=vc.draft(inspected);
 draft.targetMonth='2026-09';draft.account.cashBalance='';draft.holdings[0].values.quantity='';draft.holdings[0].values.marketValue='';
 vc.service(unknown.store).save(draft,{expectedModels:inspected.models});unknown.models=vc.storage.readModels(unknown.store);
 const missing=bundle(unknown,2025).current;assert.equal(missing.rows.find(a=>a.key==='sbivc').metrics.net.value,null);
 assert.equal(missing.unknownComponents,true);
});
test('failed reads fail closed, even with known legacy values supplied',async()=>{
 const f=await currentFixture(),v=assets.latest(view(f),f.models,{tradingData:f.tradingData,readFailed:true});
 assert.equal(v.net.value,null);assert.equal(v.accountData.length,0);assert.equal(v.netPeriodComparison.growth,null);
});
test('both actual renderers display a completely known total zero identically',async()=>{
 const f=await currentFixture({zero:true});f.models.accountSnapshots.records[0].cashBalance='0';
 f.initialFunds[2026]=Object.fromEntries(f.accounts.map(a=>[a.key,0]));
 for(const rows of Object.values(f.tradingData[2026]))for(const account of f.accounts){
  rows[account.key]={__saved:true,realizedPnL:0,swapPnL:0,unrealizedPnL:0,deposit:0,withdrawal:0,...(account.bankOnly?{monthEndBalance:0}:{})};
 }
 const {r,elements:e}=render(f,2028);assert.equal(r.current.net.value,0);
 assert.equal(e.get('kpiTotal').textContent,'¥0');assert.equal(e.get('totalAssets').textContent,'¥0');
});
test('current comparison uses current source-year initial values rather than a missing selected-year denominator',async()=>{
 const f=await currentFixture();f.accounts=f.accounts.filter(a=>a.key!=='sbivc');f.models=Object.fromEntries(Object.keys(f.models).map(k=>[k,null]));
 const current=bundle(f,2026).current,older=bundle(f,2029).current;
 assert.equal(current.netPeriodComparison.comparable,true);assert.deepEqual(older,current);
 delete f.initialFunds[2026].gmo;
 assert.equal(bundle(f,2025).current.netPeriodComparison.comparable,false);
 assert.equal(bundle(f,2025).current.netPeriodComparison.growth,null);
});
test('Backup v16 round trip remains compatible and projection never writes Storage or Backup',async()=>{
 const f=await currentFixture(),b=backup(f.store),payload=b.build(),before=f.store.snapshot();
 assert.equal(payload.backupVersion,16);bundle(f,2025);bundle(f,2026);
 assert.equal(f.store.snapshot(),before);assert.deepEqual(b.build(),payload);
 const target=new (require('./observation-override-fixture.js').Memory)(),roundtrip=backup(target),plan=roundtrip.format.inspectValue(payload);
 assert.equal(plan.ok,true);roundtrip.restore.execute(plan.restorePlan,target);
 assert.deepEqual(JSON.parse(JSON.stringify(roundtrip.build().data)),JSON.parse(JSON.stringify(payload.data)));
});
test('both production factories call canonical latest without passing the UI selection',()=>{
 for(const file of ['top/script.js','profit/soneki.js'])assert.match(source(file),/currentFactory:\s*\(\)\s*=>\s*window\.TradeScopeCurrentAssets\.latest\(display,/);
});
