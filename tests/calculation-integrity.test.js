// Invented facts only; no production Storage or private documents.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const model=require('../assets/data-model-storage.js'),display=require('../assets/monthly-display-view.js'),result=require('../assets/display-results.js'),current=require('../assets/current-asset-view.js');
const service=require('../assets/monthly-source-service.js'),core=require('../assets/monthly-source-contract.js');
const {fixture}=require('./monthly-display-fixture.js'),{currentFixture}=require('./current-net-assets-fixture.js'),{Memory,backup}=require('./observation-override-fixture.js');
const w={};vm.runInNewContext(fs.readFileSync('assets/profit-metrics.js','utf8'),{window:w});const metrics=w.TradeScopeProfitMetrics;
const view=(f,options={})=>display.create(metrics,f.tradingData,f.initialFunds,f.initialUnrealized,f.models,f.accounts,{asOf:'2026-10-16',...options});
function legacy(){const f=fixture();f.models=Object.fromEntries(Object.keys(model.keys).map(k=>[k,null]));f.accounts=f.accounts.slice(0,1);f.tradingData={2026:{1:{gmo:{__saved:true,realizedPnL:10,swapPnL:0,deposit:0,withdrawal:0,unrealizedPnL:3}}}};f.initialUnrealized={2026:{gmo:0}};return f;}
test('F1 raw future ImportBatch cannot advance current or change any adopted asset',async()=>{
 const f=await currentFixture(),before=current.latest(view(f),f.models,{tradingData:f.tradingData});
 f.models.importBatches.records.push({...f.models.importBatches.records[0],id:'unadopted_2027',targetMonth:'2027-01',snapshotAsOf:'2027-01-31'});
 const after=current.latest(view(f),f.models,{tradingData:f.tradingData});assert.equal(after.year,before.year);assert.equal(after.targetMonth,before.targetMonth);
 assert.deepEqual(after.rows.map(r=>[r.key,r.metrics.net.value]),before.rows.map(r=>[r.key,r.metrics.net.value]));
});
test('F1 current carries each account across years while fixed-month assets stay empty',async()=>{
 const f=await currentFixture(),before=current.latest(view(f),f.models,{tradingData:f.tradingData});
 f.tradingData[2027]={1:{smbc:{__saved:true,monthEndBalance:500}}};f.initialFunds[2027]={};
 const d=view(f),after=current.latest(d,f.models,{tradingData:f.tradingData});assert.equal(after.year,2027);
 for(const row of before.rows.filter(r=>r.key!=='smbc'))assert.equal(after.rows.find(r=>r.key===row.key).metrics.net.value,row.metrics.net.value);
 const vc=after.rows.find(r=>r.key==='sbivc');assert.equal(vc.metrics.net.sourceMonth,'2026-09');assert.equal(vc.balance.hasCarried,true);
 assert.equal(d.month(2027,1).rows.find(r=>r.key==='sbivc').asset,null);assert.equal(after.rows.find(r=>r.key==='smbc').metrics.net.value,500);
});
for(const raw of [10,'10',0,'0',null,undefined])test('F2 every monthly P/L consumer shares one result for '+String(raw),()=>{
 const f=legacy();f.tradingData[2026][1].gmo.realizedPnL=raw;f.tradingData[2026][1].gmo.swapPnL=null;
 const d=view(f),m=result.month(d,2026,1),p=d.monthlyPnl(2026,1),annual=d.yearlyTotals(2026);
 assert.equal(m.total,p.total);assert.equal(m.rows[0].total,p.total);assert.equal(annual.total,p.total);assert.equal(annual.realizedSum,p.realized);
 assert.equal(p.total,raw==null?null:Number(raw));assert.equal(p.coverage.total.complete,false);
});
test('F2 adopted partial flow before cutover has identical Summary, detail, graph and annual results',()=>{
 const f=legacy(),store=new Memory();for(const [k,v]of Object.entries({tradingData:f.tradingData,yearInitialFunds:f.initialFunds,yearInitialUnrealized:f.initialUnrealized}))store.setItem(k,JSON.stringify(v));
 const api=service.createService(store,{clock:()=> '2026-10-16T00:00:00.000Z',newId:()=> 'adopted_partial'});
 const source=core.descriptor({accountId:'acc_gmo_fx',targetMonth:'2026-01',component:'account',asOf:null},'realizedPnl','10',{id:'partial_source',sourceId:'manual_partial',sourceType:'manual',reference:null});
 api.operate({sources:[source],adoptions:[{revisionId:source.id}]},{expectedFingerprint:api.inspect().fingerprint});f.models=model.readModels(store);
 f.tradingData[2026][1].gmo={};const d=view(f),m=result.month(d,2026,1);assert.equal(m.total,10);assert.equal(m.rows[0].total,10);assert.equal(d.monthlyPnl(2026,1).total,10);assert.equal(d.yearlyTotals(2026).total,10);
});
for(const swap of [null,undefined,0,-5])test('F3 FX swap '+String(swap)+' preserves subtotal and completeness independently',()=>{
 const f=legacy();f.tradingData[2026][1].gmo.swapPnL=swap;const p=view(f).monthlyPnl(2026,1);
 assert.equal(p.total,10+(swap??0));assert.equal(p.coverage.total.complete,swap!=null);assert.equal(p.coverage.total.completeValue,swap==null?null:p.total);
});
test('F3 annual coverage distinguishes gaps, future, explicit account opening and closing',()=>{
 const f=legacy();f.tradingData[2026][3]=structuredClone(f.tradingData[2026][1]);const d=view(f),annual=d.yearlyTotals(2026);
 assert.equal(annual.realizedSum,20);assert.equal(annual.coverage.realizedSum.complete,false);
 assert.equal(d.month(2026,2).rows[0].coverage.realized.eligibility,'unknown-lifecycle');assert.equal(d.month(2026,11).rows[0].coverage.realized.status,'not-due');
 const scoped=view(f,{accountPeriods:{gmo:{startMonth:'2026-03',endMonth:'2026-03'}}});
 assert.equal(scoped.month(2026,2).rows[0].coverage.realized.status,'before-open');assert.equal(scoped.month(2026,4).rows[0].coverage.realized.status,'after-close');
 assert.equal(scoped.yearlyTotals(2026).realizedSum,10);assert.equal(scoped.yearlyTotals(2026).coverage.realizedSum.complete,true);
});
for(const key of ['sbi','sbivc','smbc'])test('F3 '+key+' unsupported or inapplicable metrics are not missing FX swap',()=>{
 const f=legacy();f.accounts=[{key,bankOnly:key==='smbc'}];f.tradingData={2026:{}};const row=view(f).month(2026,1).rows[0];
 assert.equal(row.coverage.swap.status,'not-applicable');assert.equal(row.coverage.total.value,null);
 if(key!=='smbc')assert.equal(row.coverage.realized.status,'not-implemented');
});
test('F3 partial annual amount never becomes a complete growth denominator/numerator',()=>{
 const f=legacy();f.accounts.push({key:'lightfx'});f.initialFunds[2026].lightfx=100;f.initialUnrealized[2026].lightfx=0;
 const p=view(f).dashboard(2026);assert.equal(p.confirmedPnl.value,10);assert.equal(p.confirmedPnl.completeValue,null);assert.equal(p.confirmedPnlGrowth,null);assert.equal(p.confirmedGrowth,null);
});
test('F4 confirmed assets and performance advance with unknown unrealized while net stays on its own fallback',()=>{
 const f=legacy();f.tradingData[2026][2]={gmo:{__saved:true,realizedPnL:5,swapPnL:0,deposit:2,withdrawal:0,unrealizedPnL:null}};
 const d=view(f),r=d.accountMonth(2026,2,f.accounts[0]),p=d.dashboard(2026);assert.equal(r.confirmed,117);assert.equal(r.confirmedComplete,true);assert.equal(r.asset,null);
 assert.equal(p.confirmed.value,117);assert.equal(p.rows[0].metrics.confirmed.sourceMonth,'2026-02');assert.equal(p.rows[0].metrics.completeNet.sourceMonth,'2026-01');assert.equal(p.confirmedPnl.value,15);
});
test('F4 adopted September confirmed ledger remains available without snapshot unrealized',()=>{
 const f=fixture();f.models=Object.fromEntries(Object.keys(model.keys).map(k=>[k,null]));f.initialUnrealized={2026:{gmo:0}};f.accounts=f.accounts.slice(0,1);
 const store=new Memory();for(const [k,v]of Object.entries({tradingData:f.tradingData,yearInitialFunds:f.initialFunds,yearInitialUnrealized:f.initialUnrealized}))store.setItem(k,JSON.stringify(v));
 let id=0;const api=service.createService(store,{clock:()=> '2026-10-16T00:00:00.000Z',newId:()=> 'confirmed_'+(++id)});
 const sources=Object.entries({realizedPnl:'10',swapPnl:'5',deposit:'0',withdrawal:'0',unrealizedPnl:null}).map(([metric,value])=>core.descriptor({accountId:'acc_gmo_fx',targetMonth:'2026-09',component:'account',asOf:null},metric,value,{id:'f4_'+metric,sourceId:'manual_'+metric,sourceType:'manual',reference:null}));
 api.operate({sources,adoptions:sources.map(s=>({revisionId:s.id}))},{expectedFingerprint:api.inspect().fingerprint});f.models=model.readModels(store);
 const d=view(f),row=d.accountMonth(2026,9,f.accounts[0]);assert.equal(row.confirmed,139);assert.equal(row.complete,false);
 assert.equal(d.dashboard(2026).rows[0].metrics.confirmed.sourceMonth,'2026-09');assert.equal(d.dashboard(2026).rows[0].metrics.completeNet.sourceMonth,'2026-08');
});
test('F2 actual legacy Input renders adopted metric fields from the shared monthly result without copying into saved data',()=>{
 const inputs=['realizedPnL','swapPnL','unrealizedPnL','deposit','withdrawal'].map(field=>({dataset:{field},value:'999',readOnly:false}));
 const card={querySelectorAll:()=>inputs},ctx={currentYear:2026,currentMonth:1,monthlyCalculator:()=>({resolve:()=>({sourceAdoptions:[{metric:'realizedPnl'}]})}),
  monthlyDisplayView:()=>({accountMonth:()=>({realized:10,swap:null,unrealized:2,deposit:0,withdrawal:0})})};vm.createContext(ctx);
 const source=fs.readFileSync('profit/soneki.js','utf8');vm.runInContext(source.slice(source.indexOf('function renderAdoptedLegacyFields('),source.indexOf('function renderAccountInputs(')),ctx);
 assert.equal(ctx.renderAdoptedLegacyFields(card,{key:'gmo'}),true);assert.deepEqual(inputs.map(i=>i.value),['10','','2','0','0']);assert.equal(inputs.every(i=>i.readOnly),true);
});
for(const field of ['realizedPnL','swapPnL','deposit','withdrawal'])test('F4 missing required '+field+' prevents falsely complete confirmed assets',()=>{
 const f=legacy();f.tradingData[2026][1].gmo[field]=null;const d=view(f);assert.equal(d.accountMonth(2026,1,f.accounts[0]).confirmed,null);assert.equal(d.dashboard(2026).confirmed.completeValue,null);
});
test('F7 actual observation dates are not replaced with display month or import/adoption date',async()=>{
 const f=await currentFixture(),d=view(f),c=current.latest(d,f.models,{tradingData:f.tradingData}),vc=c.rows.find(r=>r.key==='sbivc');
 assert.equal(c.effectiveTime,c.targetMonth);assert.equal(vc.balance.components.find(r=>r.key==='cash').snapshotAsOf,'2026-09-30');
 const p=d.dashboard(2026);assert.equal(p.rows[0].time.simultaneousSnapshot,false);assert.equal(p.rows[0].time.calculationCutoff,'2026-12');
 assert.equal(p.rows[0].time.net?.imports.every(i=>i.periodStart===null&&i.periodEnd===null)??true,true);
 const native=fixture(),adopted=current.latest(view(native),native.models,{tradingData:native.tradingData}).rows.find(r=>r.key==='gmo').time.observations[0];
 assert.equal(adopted.adoptedAt,native.models.monthlyAccountStates.records[0].confirmedAt);assert.equal(adopted.importedAt,native.models.importBatches.records[0].importedAt);
});
test('v16 Backup and raw values stay unchanged after current/period/coverage reads',async()=>{
 const f=await currentFixture(),b=backup(f.store),payload=b.build(),before=f.store.snapshot(),d=view(f);
 d.month(2026,9);d.yearlyTotals(2026);current.latest(d,f.models,{tradingData:f.tradingData});assert.equal(payload.backupVersion,16);assert.equal(f.store.snapshot(),before);assert.deepEqual(b.build(),payload);
});
test('F3 complete coverage through known cutoff is distinct from a full calendar year',()=>{
 const f=legacy();for(let m=2;m<=8;m++)f.tradingData[2026][m]=structuredClone(f.tradingData[2026][1]);
 const annual=view(f,{asOf:'2026-08-31'}).yearlyTotals(2026);assert.equal(annual.realizedSum,80);assert.equal(annual.coverage.realizedSum.complete,true);
 assert.equal(annual.coverage.realizedSum.calendarYearComplete,false);assert.equal(annual.calendarCutoff,'2026-08');assert.equal(annual.cutoff,'2026-12');
});
test('F4 confirmed-only year still supplies Summary and chart consumers when net is unknown',()=>{
 const f=legacy();f.tradingData[2026][1].gmo.unrealizedPnL=null;const d=view(f),p=d.dashboard(2026);
 assert.equal(p.net.value,null);assert.equal(p.confirmed.value,110);assert.equal(p.hasData,true);assert.equal(d.series(2026).realized[0],110);
});
test('F3 bank explicit zero and unconfirmed legacy zero placeholders remain distinct',()=>{
 const f=legacy();f.accounts=[{key:'smbc',bankOnly:true},{key:'gmo'}];f.tradingData={2026:{1:{smbc:{monthEndBalance:0},gmo:{realizedPnL:0,swapPnL:0,deposit:0,withdrawal:0,unrealizedPnL:0}}}};
 const m=view(f).month(2026,1);assert.equal(m.rows[0].asset,0);assert.equal(m.rows[1].confirmed,null);assert.equal(m.rows[1].coverage.realized.status,'missing');
});
test('F2 source override is applied exactly once by every monthly consumer',async()=>{
 const f=await require('./calculation-integrity-fixture.js').integrityFixture('partial'),api=service.createService(f.store,{clock:()=> '2026-10-16T00:00:00.000Z',newId:()=> 'override_adoption'});
 api.operate({overrides:[{id:'integrity_override',revisionId:'integrity_realized',value:'12'}],adoptions:[{revisionId:'integrity_realized',overrideId:'integrity_override'}]},{expectedFingerprint:api.inspect().fingerprint});f.models=model.readModels(f.store);
 const d=view(f),p=d.monthlyPnl(2026,1),m=result.month(d,2026,1);assert.equal(p.total,24);assert.equal(m.total,24);assert.equal(m.rows.find(r=>r.key==='gmo').total,12);
});
test('F2 actual chart renderer uses canonical all-account and account P/L arrays',async()=>{
 const f=await require('./calculation-integrity-fixture.js').integrityFixture('partial'),d=view(f),source=fs.readFileSync('profit/soneki.js','utf8');
 const ctx={document:{getElementById:()=>({})},Chart(){},hasMonthlyDisplayYear:()=>true,currentYear:2026,monthlyDisplayView:()=>d,ACCOUNTS:f.accounts,GROWTH_TARGET_ACCOUNTS:f.accounts.filter(a=>!a.bankOnly)};vm.createContext(ctx);
 const start=source.indexOf('function renderPerformanceChart('),end=source.indexOf('  // 口座別表示時はPerformanceビュー',start);
 vm.runInContext(source.slice(start,end)+'return totalPnlData;}\nvar all=renderPerformanceChart(),gmo=renderPerformanceChart({accountFilter:"gmo"});',ctx);
 assert.equal(ctx.all[0],22);assert.equal(ctx.gmo[0],10);assert.equal(ctx.all[0],result.month(d,2026,1).total);
});
test('F1 unadopted future Snapshot with its Batch does not replace adopted current assets',async()=>{
 const f=await currentFixture(),before=current.latest(view(f),f.models,{tradingData:f.tradingData});
 const snapshot=f.models.accountSnapshots.records[0],batch=f.models.importBatches.records.find(b=>b.id===snapshot.importBatchId);
 f.models.importBatches.records.push({...batch,id:'candidate_future',targetMonth:'2027-01',snapshotAsOf:'2027-01-31'});
 f.models.accountSnapshots.records.push({...snapshot,id:'candidate_snapshot',importBatchId:'candidate_future',targetMonth:'2027-01',snapshotAsOf:'2027-01-31'});
 const after=current.latest(view(f),f.models,{tradingData:f.tradingData});assert.equal(after.net.value,before.net.value);assert.equal(after.targetMonth,before.targetMonth);
});
