const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const display = require('../assets/monthly-display-view.js'), resolver = require('../assets/monthly-account-resolver.js');
const model = require('../assets/data-model-storage.js'), {fixture} = require('./monthly-display-fixture.js');
const window = {}; vm.runInNewContext(fs.readFileSync(require.resolve('../assets/profit-metrics.js'),'utf8'),{window});
const metrics = window.TradeScopeProfitMetrics;
const view = f => display.create(metrics,f.tradingData,f.initialFunds,f.initialUnrealized,f.models,f.accounts);
test('Top uses complete GMO September, partial SBI September and untouched August accounts',()=>{
 const d=view(fixture()).dashboard(2026), by=key=>d.rows.find(r=>r.key===key).metrics;
 assert.equal(d.month,9);assert.equal(by('gmo').net.value,136);assert.equal(by('gmo').net.status,'current complete');
 assert.equal(by('sbi').net.value,200.25);assert.equal(by('sbi').net.status,'current partial');
 for(const key of ['lightfx','minano','sbivc','smbc']) {assert.equal(by(key).net.sourceMonth,'2026-08');assert.equal(by(key).net.status,'previous complete');}
 assert.equal(d.provisional,true);assert.equal(d.hasData,true);
});
test('partial account never borrows previous foreign or cash values',()=>{
 const f=fixture();f.tradingData[2026][8].sbi.netAssets=999;f.tradingData[2026][8].sbi.holdings=[{valueJPY:999}];
 const row=view(f).dashboard(2026).rows.find(r=>r.key==='sbi');assert.equal(row.metrics.net.value,200.25);
 assert.equal(row.metrics.confirmed.sourceMonth,'2026-08');assert.equal(row.metrics.netPnl.sourceMonth,'2026-08');
});
test('Top cards/pie/account list share exact account amounts and metric source months',()=>{
 const d=view(fixture()).dashboard(2026);assert.equal(d.net.value,d.accountData.reduce((s,r)=>s+r.amount,0));
 for(const r of d.accountData)assert.equal(r.amount,d.rows.find(a=>a.name===r.label).metrics.net.value);
 assert.ok(d.net.sources.some(s=>s.sourceMonth==='2026-08'));assert.ok(d.net.sources.some(s=>s.sourceMonth==='2026-09'));
});
test('unsafe growth/delta and P&L use complete metric sources, not partial asset',()=>{
 const f=fixture(),before=view(f).dashboard(2026);f.models.holdingSnapshots.records[0].marketValue='900';
 const after=view(f).dashboard(2026);assert.notEqual(before.net.value,after.net.value);
 for(const field of ['netPnlGrowth','confirmedPnlGrowth','netDelta','confirmedDelta'])assert.equal(before[field],after[field]);
 assert.equal(before.netPnl.value,after.netPnl.value);
});
test('Monthly September shows only selected-month data, with provisional known totals',()=>{
 const m=view(fixture()).month(2026,9);assert.equal(m.provisional,true);assert.equal(m.realized,10);assert.equal(m.swap,5);
 const sbi=m.rows.find(r=>r.key==='sbi');assert.equal(sbi.unrealized,20.125);assert.equal(sbi.asset,200.25);
 for(const field of ['realized','swap','deposit','withdrawal'])assert.equal(sbi[field],null);
 assert.equal(sbi.components.find(c=>c.name==='外国証券').asset,null);
 for(const key of ['lightfx','minano','sbivc','smbc'])assert.equal(m.rows.find(r=>r.key===key).hasData,false);
});
test('explicit zero is retained; missing is not zero',()=>{
 const f=fixture();f.models.holdingSnapshots.records[0].unrealizedPnl='0';
 const m=view(f).month(2026,9);assert.equal(m.rows.find(r=>r.key==='gmo').deposit,0);
 assert.equal(m.rows.find(r=>r.key==='sbi').unrealized,0);assert.equal(m.rows.find(r=>r.key==='sbi').deposit,null);
});
test('null within a domestic group does not become a partial invented group total',()=>{
 const f=fixture();f.models.holdingSnapshots.records.push({...f.models.holdingSnapshots.records[0],id:'hs_second',marketValue:null,unrealizedPnl:null});
 const s=view(f).month(2026,9).rows.find(r=>r.key==='sbi');assert.equal(s.asset,null);assert.equal(s.unrealized,null);
});
test('multiple domestic batches stop display rather than selecting latest or summing',()=>{
 const f=fixture();f.models.importBatches.records.push({...f.models.importBatches.records[1],id:'other'});
 f.models.holdingSnapshots.records.push({...f.models.holdingSnapshots.records[0],id:'other_hs',importBatchId:'other'});
 const s=view(f).month(2026,9).rows.find(r=>r.key==='sbi');assert.equal(s.conflict,true);assert.equal(s.asset,null);
});
test('execution batch and another month never enter domestic asset sum',()=>{
 const f=fixture();f.models.importBatches.records.push({...f.models.importBatches.records[1],id:'execution'});
 f.models.holdingSnapshots.records.push({...f.models.holdingSnapshots.records[0],id:'august',targetMonth:'2026-08'});
 // Use a consistent August batch rather than bypassing reference validation.
 f.models.importBatches.records.push({...f.models.importBatches.records[1],id:'aug_batch',targetMonth:'2026-08'});
 f.models.holdingSnapshots.records.at(-1).importBatchId='aug_batch';
 assert.equal(view(f).month(2026,9).rows.find(r=>r.key==='sbi').asset,200.25);
});
test('holding-only month is visible without State or AccountSnapshot, but never entered',()=>{
 const f=fixture();f.models.monthlyAccountStates=null;f.models.accountSnapshots=null;
 const d=view(f);assert.equal(d.month(2026,9).rows.find(r=>r.key==='sbi').hasData,true);
 const calc=resolver.createCalculator(metrics,f.tradingData,f.initialFunds,{},f.models);
 assert.equal(calc.entered(2026,9,'sbi'),false);assert.equal(calc.net(2026,9,'sbi'),null);
});
test('display projection and fingerprint never mutate inputs or write storage',()=>{
 const f=fixture(),before=JSON.stringify(f);const d=view(f);d.dashboard(2026);d.month(2026,9);d.month(2026,10);d.fingerprint(2026);
 assert.equal(JSON.stringify(f),before);assert.equal(f.tradingData[2026][9],undefined);
 const source=fs.readFileSync(require.resolve('../assets/monthly-display-view.js'),'utf8');assert.doesNotMatch(source,/setItem|removeItem|\.commit\(|console\.|fetch\(/);
});
for(const entity of ['holdingSnapshots','importBatches','accountSnapshots','monthlyAccountStates'])test(`display fingerprint tracks ${entity} including unadopted observation`,()=>{
 const f=fixture(),before=view(f).fingerprint(2026);f.models[entity].updatedAt='2026-10-12T00:00:00Z';
 // Record change must be relevant; envelope timestamps alone aren't financial dependencies.
 f.models[entity].records[0][entity==='holdingSnapshots'?'marketValue':entity==='importBatches'?'importerVersion':entity==='accountSnapshots'?'cashBalance':'swapPnl']=entity==='importBatches'?'anonymous-v2':'40';
 assert.notEqual(view(f).fingerprint(2026),before);
});
test('canonical annual/trend remain strict while display is partial',()=>{
 const f=fixture(),calc=resolver.createCalculator(metrics,f.tradingData,f.initialFunds,{},f.models);
 const before=JSON.stringify(calc.snapshot(2026,f.accounts));view(f).dashboard(2026);view(f).month(2026,9);
 assert.equal(JSON.stringify(calc.snapshot(2026,f.accounts)),before);assert.equal(calc.totalNet(2026,9,f.accounts.map(a=>a.key)),null);
 assert.equal(calc.snapshot(2026,f.accounts).total[8],null);
});
test('August legacy aggregate semantics are retained',()=>{
 const f=fixture(),calc=resolver.createCalculator(metrics,f.tradingData,f.initialFunds,{},f.models),m=view(f).month(2026,8);
 assert.equal(m.realized,calc.monthlyFieldTotal(2026,8,f.accounts.map(a=>a.key),'realizedPnL'));
 for(const a of f.accounts)assert.equal(m.rows.find(r=>r.key===a.key).asset,calc.net(2026,8,a.key));
});
test('empty data produces unavailable, not fictional zeros',()=>{
 const f=fixture();f.models=Object.fromEntries(Object.keys(model.keys).map(k=>[k,null]));f.tradingData={};f.initialFunds={};
 const d=view(f).dashboard(2026);assert.equal(d.hasData,false);assert.equal(d.net.value,null);assert.equal(view(f).month(2026,9).realized,null);
});
test('official GMO observation without State remains display-only partial, never a ledger value',()=>{
 const f=fixture();f.models.monthlyAccountStates=null;const row=view(f).dashboard(2026).rows.find(r=>r.key==='gmo');
 assert.equal(row.metrics.net.value,136);assert.equal(row.metrics.net.status,'current partial');
 assert.equal(row.metrics.confirmed.sourceMonth,'2026-08');
 assert.equal(view(f).month(2026,9).rows.find(r=>r.key==='gmo').realized,null);
 const calc=resolver.createCalculator(metrics,f.tradingData,f.initialFunds,{},f.models);assert.equal(calc.net(2026,9,'gmo'),null);
});
test('unadopted official observation with non-month-end date is not silently used',()=>{
 const f=fixture();f.models.monthlyAccountStates=null;f.models.accountSnapshots.records[0].snapshotAsOf='2026-09-29';f.models.importBatches.records[0].snapshotAsOf='2026-09-29';
 assert.equal(view(f).dashboard(2026).rows.find(r=>r.key==='gmo').metrics.net.value,null);
});
test('shared Summary supplies all four metrics, deltas and rates for both screens',()=>{
 const f=fixture();f.initialUnrealized={2026:Object.fromEntries(f.accounts.map(a=>[a.key,0]))};
 const d=view(f),top=d.dashboard(2026),annual=d.series(2026).summary;
 assert.deepEqual(top,annual);
 for(const field of ['netGrowth','confirmedGrowth','netPnlGrowth','confirmedPnlGrowth'])assert.ok(Number.isFinite(top[field]));
});
test('September asset point exactly matches latest Summary, with no future invented points',()=>{
 const d=view(fixture()),s=d.series(2026),summary=d.dashboard(2026);
 assert.equal(s.total[8],summary.net.value);assert.equal(s.realized[8],summary.confirmed.value);
 assert.deepEqual(s.total.slice(9),[null,null,null]);
});
test('known September P/L is displayed and accumulated despite missing SBI State',()=>{
 const f=fixture(),d=view(f),p=d.monthlyPnl(2026,9),annual=d.yearlyTotals(2026);
 assert.deepEqual(p,{realized:10,swap:5,total:15});
 assert.equal(annual.realizedSum,view(f).yearlyTotals(2026).realizedSum);
 assert.equal(annual.realizedSum,50);assert.equal(annual.swapSum,85);
 assert.equal(d.monthlyPnl(2026,10).total,null);
});
test('partial import changes Summary and same-month trend point together',()=>{
 const f=fixture(),before=view(f).series(2026);f.models.holdingSnapshots.records[0].marketValue='201.125';
 const d=view(f),after=d.series(2026);assert.notEqual(before.total[8],after.total[8]);
 assert.equal(after.total[8],d.dashboard(2026).net.value);assert.notEqual(before.sourceFingerprint,after.sourceFingerprint);
});
test('a missing month between two imported months remains a real chart gap',()=>{
 const f=fixture(),b={...f.models.importBatches.records[1],id:'nov_batch',targetMonth:'2026-11'};
 f.models.importBatches.records.push(b);f.models.holdingSnapshots.records.push({...f.models.holdingSnapshots.records[0],id:'nov_holding',importBatchId:b.id,targetMonth:b.targetMonth});
 const s=view(f).series(2026);assert.notEqual(s.total[8],null);assert.equal(s.total[9],null);assert.notEqual(s.total[10],null);
});
test('partial P/L keeps known realized even when swap is missing',()=>{
 const f=fixture();f.models.monthlyAccountStates=null;f.models.accountSnapshots=null;
 // SBI VC remains legacy in September; Traders now deliberately rejects post-cutover legacy inputs.
 f.tradingData[2026][9]={sbivc:{realizedPnL:7,swapPnL:null,unrealizedPnL:1}};
 assert.deepEqual(view(f).monthlyPnl(2026,9),{realized:7,swap:null,total:7});
});
test('display source code keeps all Summary and trend consumers on the shared projection',()=>{
 const top=fs.readFileSync(require.resolve('../top/script.js'),'utf8'),profit=fs.readFileSync(require.resolve('../profit/soneki.js'),'utf8');
 assert.match(top,/currentAssetView\.netPeriodComparison\.growth/);assert.match(profit,/current\.netPeriodComparison\.growth/);
 assert.match(fs.readFileSync(require.resolve('../assets/current-asset-view.js'),'utf8'),/Number\.isFinite\(dashboard\.netGrowth\)\?dashboard\.netGrowth:null/);
 assert.match(top,/linkedDisplay\(\)\.series\(year\)/);assert.match(profit,/display\.dashboard\(currentYear, m, targetAccounts\)/);
 assert.match(profit,/monthlyDisplayView\(\)\.yearlyTotals/);
});
