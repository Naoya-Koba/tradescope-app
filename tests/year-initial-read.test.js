// Invented amounts only. All Storage adapters below are disposable in-memory objects.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const initial=require('../assets/year-initial-view.js'),read=require('../assets/display-read-state.js'),display=require('../assets/monthly-display-view.js');
const resolver=require('../assets/monthly-account-resolver.js'),results=require('../assets/display-results.js'),assets=require('../assets/current-asset-view.js');
const {currentFixture}=require('./current-net-assets-fixture.js'),{backup}=require('./observation-override-fixture.js');
const w={};vm.runInNewContext(fs.readFileSync('assets/profit-metrics.js','utf8'),{window:w});const metrics=w.TradeScopeProfitMetrics;
const accounts=[{key:'gmo',name:'G'},{key:'sbi',name:'S'}],amounts={2026:{gmo:100,sbi:200}},zero={2026:{gmo:0,sbi:0}};
for(const [value,status,expected]of [[100,'known',100],['100','known',100],[0,'known',0],['0','known',0],[-2,'known',-2],['-2.25','known',-2.25],[null,'null',null],['','invalid',null],['bad','invalid',null],[true,'invalid',null],[{},'invalid',null]])test('opening field '+JSON.stringify(value)+' keeps its meaning',()=>{
 const f=initial.field({2026:{gmo:value}},2026,'gmo');assert.equal(f.status,status);assert.equal(f.value,expected);
});
test('numeric strings, multiple accounts and decimal addition never concatenate or add floating noise',()=>{
 assert.equal(initial.create({2026:{gmo:'100',sbi:'200'}},zero,2026,accounts).funds.value,300);
 assert.equal(initial.create({2026:{gmo:'0.1',sbi:0.2}},zero,2026,accounts).funds.value,0.3);
 assert.equal(initial.decimal(1e-18),'0.000000000000000001');
});
for(const missing of ['funds','unrealized'])test(missing+' unknown preserves the independent known input and known subtotal',()=>{
 const f=structuredClone(amounts),u={2026:{gmo:-10,sbi:5}};delete (missing==='funds'?f:u)[2026].sbi;
 const r=initial.create(f,u,2026,accounts);
 assert.equal(r[missing].value,null);assert.equal(r[missing].complete,false);
 assert.equal(r[missing].knownSubtotal,missing==='funds'?100:-10);
 assert.equal(r[missing==='funds'?'unrealized':'funds'].complete,true);assert.equal(r.net.value,null);
 assert.equal(r.accounts[1][missing].status,'missing');
});
test('bank unrealized is not applicable rather than a fabricated stored zero',()=>{
 const r=initial.create({2026:{smbc:'100'}},{},2026,[{key:'smbc',bankOnly:true}]);
 assert.equal(r.net.value,100);assert.equal(r.accounts[0].unrealized.status,'not-applicable');assert.equal(r.accounts[0].unrealized.value,null);
});
function legacy(funds=amounts,unrealized=zero){
 const row={__saved:true,realizedPnL:10,swapPnL:0,unrealizedPnL:0,deposit:0,withdrawal:0};
 const td={2026:{1:{gmo:{...row},sbi:{...row}}}},models=Object.fromEntries(Object.keys(require('../assets/data-model-storage.js').keys).map(k=>[k,null]));
 return {td,models,d:display.create(metrics,td,funds,unrealized,models,accounts),c:resolver.createCalculator(metrics,td,funds,unrealized,models)};
}
for(const value of [null,undefined,'bad'])test('unknown opening '+String(value)+' blocks scope-mismatched deltas/rates without stopping monthly P/L',()=>{
 const f={2026:{gmo:100}};if(value!==undefined)f[2026].sbi=value;
 const {d,c}=legacy(f),p=d.dashboard(2026);assert.equal(p.initialNet,null);assert.equal(p.initialConfirmed,null);
 for(const key of ['netDelta','confirmedDelta','netGrowth','confirmedGrowth','netPnlGrowth','confirmedPnlGrowth'])assert.equal(p[key],null);
 assert.equal(p.netPnl.value,10);assert.equal(p.netPnl.completeValue,null);assert.equal(p.confirmedPnl.value,10);assert.equal(p.confirmedPnl.completeValue,null);assert.equal(c.confirmed(2026,1,'sbi'),null);
 assert.equal(d.monthlyPnl(2026,1).total,20);assert.equal(d.yearlyTotals(2026).realizedSum,20);
});
test('missing opening unrealized blocks net performance only; confirmed performance stays known',()=>{
 const {d}=legacy(amounts,{2026:{gmo:0}}),p=d.dashboard(2026);
 assert.equal(p.initialNet,null);assert.equal(p.initialConfirmed,300);assert.equal(p.netPnl.value,10);assert.equal(p.netPnl.completeValue,null);assert.equal(p.netPnlGrowth,null);
 assert.equal(p.confirmedPnl.value,20);assert.equal(p.confirmedPnlGrowth,20/300*100);
 assert.equal(d.series(2026).performanceTotalSeries[0],null);assert.equal(d.series(2026).performanceConfirmedSeries[0],0);
});
test('explicit zero denominator, negative opening unrealized and separate years use unchanged rate formulas',()=>{
 const {d}=legacy(zero,zero),p=d.dashboard(2026);assert.equal(p.initialNet,0);assert.equal(p.netPnl.value,20);assert.equal(p.netGrowth,null);
 assert.equal(initial.create(amounts,{2026:{gmo:-10,sbi:0}},2026,accounts).net.value,290);
 const a={2025:{gmo:50,sbi:50},2026:{gmo:100,sbi:200}};assert.equal(initial.create(a,zero,2025,accounts).funds.value,100);
 assert.equal(initial.create(a,zero,2026,accounts).funds.value,300);
});
function stored(){const f=legacy();const map=new Map([['tradingData',JSON.stringify(f.td)],['yearInitialFunds',JSON.stringify(amounts)],['yearInitialUnrealized',JSON.stringify(zero)]]);return {map,getItem:k=>map.get(k)??null,setItem(){throw Error('write forbidden');},removeItem(){throw Error('delete forbidden');}};}
function project(store){const s=read.read(store),d=display.create(metrics,s.tradingData,s.yearInitialFunds,s.yearInitialUnrealized,s.models,accounts,{readState:s});return {s,d,r:results.create(d,2026,{readFailed:s.failed})};}
for(const [raw,status]of [['{}','empty'],['broken','invalid-json'],['[]','invalid-schema'],['{"2026":[]}','invalid-schema'],['null','invalid-schema']])test('read state distinguishes '+status+' without repairing Storage: '+raw,()=>{
 const a=stored();a.map.set('yearInitialFunds',raw);const before=JSON.stringify([...a.map]),{s,d,r}=project(a);
 assert.equal(s.states.yearInitialFunds.status,status);assert.equal(s.failed,status!=='empty');assert.equal(JSON.stringify([...a.map]),before);
 assert.equal(d.initial(2026).funds.value,null);assert.equal(r.period.confirmedGrowth,null);
 assert.equal(d.series(2026).realized[0],null);assert.equal(d.series(2026).total[0],null);
 assert.equal(r.months[0].total,20);assert.equal(r.annual.realizedSum,20);
});
test('missing optional collections and normal empty data are not read failures',()=>{
 const a={getItem:()=>null},s=read.read(a);assert.equal(s.failed,false);assert.equal(s.states.tradingData.status,'missing');assert.equal(s.states.models.status,'empty');
 const d=display.create(metrics,{}, {},{},s.models,accounts,{readState:s});assert.equal(d.dashboard(2026).hasData,false);assert.equal(d.month(2026,1).total,null);
});
test('corrupt opening-unrealized JSON retains known funds and confirmed performance',()=>{
 const a=stored();a.map.set('yearInitialUnrealized','broken');const {d,r}=project(a);
 assert.equal(r.initial.funds.value,300);assert.equal(r.initial.unrealized.value,null);assert.equal(r.initial.net.value,null);
 assert.equal(r.period.confirmedPnl.value,20);assert.equal(r.period.confirmedGrowth,20/300*100);
 assert.equal(r.period.netPnl.value,null);assert.equal(r.period.netPnlGrowth,null);assert.equal(d.series(2026).chartStartTotal,300);
});
for(const key of ['tradingData',require('../assets/data-model-storage.js').keys.accountSnapshots])test('unreadable '+key+' cannot produce healthy ledger or P/L numbers',()=>{
 const a=stored();a.map.set(key,'broken');const {d,r,s}=project(a);assert.equal(s.failed,true);
 assert.equal(r.period.net.value,null);assert.equal(r.period.confirmed.value,null);assert.equal(r.months[0].total,null);
 assert.equal(r.annual.realizedSum,null);assert.equal(d.series(2026).total.every(v=>v===null),true);
 assert.equal(r.initial.funds.value,300);assert.equal(r.initial.unrealized.value,0);
});
test('adapter read error and canonical JSON/schema errors are distinct, non-destructive states',()=>{
 const a=stored();const s=read.read({getItem:k=>{if(k==='yearInitialFunds')throw Error('denied');return a.getItem(k);}});assert.equal(s.states.yearInitialFunds.status,'read-failure');
 const key=require('../assets/data-model-storage.js').keys.accountSnapshots;a.map.set(key,'broken');assert.equal(read.read(a).states.models.status,'invalid-json');
 a.map.set(key,'{}');assert.equal(read.read(a).states.models.status,'invalid-schema');
});
test('corrupt opening funds cannot erase independent adopted current observations or opening unrealized',async()=>{
 const f=await currentFixture();f.store.setItem('yearInitialFunds','broken');const before=f.store.snapshot(),s=read.read(f.store);
 const d=display.create(metrics,s.tradingData,s.yearInitialFunds,s.yearInitialUnrealized,s.models,f.accounts,{readState:s});
 const current=assets.latest(d,s.models,{tradingData:s.tradingData,readFailed:read.failed(s,'models')}),r=results.create(d,2026,{readFailed:s.failed,currentFactory:()=>current});
 assert.equal(r.current.rows.find(a=>a.key==='sbivc').metrics.net.value,20042.125);assert.equal(r.current.netPeriodComparison.growth,null);
 assert.equal(r.initial.unrealized.value,0);assert.equal(r.initial.funds.value,null);assert.equal(f.store.snapshot(),before);
});
test('production Home Trend calls the formal reader on broken initial JSON',()=>{
 const source=fs.readFileSync('top/script.js','utf8'),store=stored();store.map.set('yearInitialFunds','broken');const before=JSON.stringify([...store.map]);
 const context={window:{TradeScopeDisplayReadState:read,TradeScopeMonthlyDisplay:display},localStorage:store,profitMetrics:metrics,LINKED_ACCOUNTS:accounts,
  getNumericYears:o=>Object.keys(o||{}).map(Number),createEmptyTopSeries:()=>({hasData:false}),TOP_BASE_YEAR:2025};vm.createContext(context);
 vm.runInContext(source.slice(source.indexOf('function buildTopLinkedData('),source.indexOf('function buildSharedResults(')),context);
 const series=context.buildTopLinkedData(2026);assert.equal(series,null);assert.equal(context.linkedDisplay().initial(2026).funds.value,null);
 assert.equal(context.linkedDisplay().monthlyPnl(2026,1).total,20);assert.equal(JSON.stringify([...store.map]),before);
});
test('profit opening consumer reads the same numeric-string result as the common reader',()=>{
 const {d}=legacy({2026:{gmo:'100',sbi:'200'}}),source=fs.readFileSync('profit/soneki.js','utf8'),ctx={monthlyDisplayView:()=>d,ACCOUNTS:accounts};vm.createContext(ctx);
 vm.runInContext(source.slice(source.indexOf('function calculateInitialCapital('),source.indexOf('function hasMeaningfulMonthData(')),ctx);
 assert.equal(ctx.calculateInitialCapital(2026),300);assert.equal(d.series(2026).chartStartTotal,300);
});
test('decimal-formatted opening strings use the same normalized amount in the legacy ledger',()=>{
 const {d,c}=legacy({2026:{gmo:'1,000.25',sbi:'+200.5'}});
 assert.equal(d.initial(2026).funds.value,1200.75);assert.equal(c.confirmed(2026,1,'gmo'),1010.25);
 assert.equal(d.dashboard(2026).confirmed.value,1220.75);assert.equal(d.dashboard(2026).confirmedPnl.value,20);
});
const profitSource=fs.readFileSync('profit/soneki.js','utf8');
function dom(){const nodes=new Map();return {nodes,getElementById(id){if(!nodes.has(id))nodes.set(id,{textContent:'',value:'',dataset:{},classList:{remove(){},add(){}},addEventListener(type,fn){this[type]=fn;}});return nodes.get(id);}};}
test('actual Annual Summary retains independent annual flows when all opening-dependent assets are unavailable',()=>{
 const a=stored();a.map.set('yearInitialFunds','broken');const {s,d}=project(a),r=results.create(d,2026,{readFailed:s.failed,currentFactory:()=>assets.latest(d,s.models,{tradingData:s.tradingData})});
 const document=dom(),ctx={document,sharedDisplayResults:()=>r,monthlyCalculator:()=>({warning:()=>''}),displayReadFailed:true,currentYear:2026,
  displayAccountName:k=>k,fmtJPY:v=>'¥'+v,setSignClass(){},calculateInitialCapital:()=>d.initial(2026).funds.value};vm.createContext(ctx);
 vm.runInContext(profitSource.slice(profitSource.indexOf('function renderAnnualSummary()'),profitSource.indexOf('function optionalSignStyle'))+'\nrenderAnnualSummary();',ctx);
 assert.equal(document.getElementById('yearInitialCapital').textContent,'—');assert.equal(document.getElementById('confirmedAssets').textContent,'—');
 assert.equal(document.getElementById('confirmedYearGrowthRate').textContent,'—');assert.equal(document.getElementById('yearRealizedSum').textContent,'¥20');
 assert.equal(document.getElementById('yearInitialUnrealizedTotal').textContent,'0円');
});
function chartInputs(d){
 const document=dom(),ctx={document,Chart(){},hasMonthlyDisplayYear:()=>true,currentYear:2026,monthlyDisplayView:()=>d,ACCOUNTS:accounts,GROWTH_TARGET_ACCOUNTS:accounts};vm.createContext(ctx);
 const start=profitSource.indexOf('function renderPerformanceChart('),end=profitSource.indexOf('  // 口座別表示時はPerformanceビュー',start);
 vm.runInContext(profitSource.slice(start,end)+'return {confirmedTrendData,assetsTrendData,performanceConfirmedTrendData,performanceAssetsTrendData,totalPnlData};}\nvar points=renderPerformanceChart();',ctx);
 return {points:ctx.points,document};
}
test('actual profit chart arrays and Home series share opening points, nulls and known independent monthly P/L',()=>{
 for(const bad of [false,true]){
  const a=stored();if(bad)a.map.set('yearInitialFunds','broken');const {d}=project(a),{points,document}=chartInputs(d),home=d.series(2026);
  assert.equal(points.confirmedTrendData[0],home.chartStartTotal);assert.equal(points.assetsTrendData[0],home.chartStartTotalWithUnrealized);
  assert.equal(points.performanceAssetsTrendData[0],home.performanceTotalSeries[0]);assert.equal(points.totalPnlData[0],20);
  assert.equal(document.getElementById('assetsTrendChart').hidden,bad);assert.equal(document.getElementById('pnlBarChart').hidden,false);
 }
});
test('settings display saved numeric strings/null/zero without zero-filling unknown inputs',async()=>{
 const f=await currentFixture();f.initialFunds[2026].gmo='100';f.initialFunds[2026].sbi=null;delete f.initialFunds[2026].lightfx;
 f.initialUnrealized[2026].gmo='-10';delete f.initialUnrealized[2026].sbi;
 const d=display.create(metrics,f.tradingData,f.initialFunds,f.initialUnrealized,f.models,f.accounts),document=dom();
 const ctx={document,currentYear:2026,monthlyDisplayView:()=>d,window:{TradeScopeYearInitial:initial},tradingData:f.tradingData,displayReadFailed:false,
  updateYearSelect(){},bindInitialCapitalInputBehavior(){},updateInitialCapitalStatus(){},calculateAccountConfirmedAssets:()=>null};vm.createContext(ctx);
 vm.runInContext(profitSource.slice(profitSource.indexOf('function renderInitialCapitalForm()'),profitSource.indexOf('function updateInitialCapitalStatus()'))+'\nrenderInitialCapitalForm();',ctx);
 assert.equal(document.getElementById('initGMO').value,'100');assert.equal(document.getElementById('initSBI').value,'');
 assert.equal(document.getElementById('initLightFX').value,'');assert.equal(document.getElementById('initSBIUnrealized').value,'');
 assert.equal(document.getElementById('initGMOUnrealized').value,'-10');assert.equal(document.getElementById('initSMBC').value,'100');
});
function saveOpening(failed){
 const document=dom(),funds={2026:{gmo:100,sbi:null}},unrealized={2026:{gmo:0}},calls={saves:0},ctx={document,displayReadFailed:failed,yearInitialFunds:funds,yearInitialUnrealized:unrealized,
  window:{TradeScopeYearInitial:initial},saveToStorage:()=>calls.saves++,dirtyInitialDrafts:new Set(),updateInitialCapitalStatus(){},renderAnnualSummary(){},renderPerformanceChart(){},renderAccountInputs(){},
  setTimeout(){}};
 document.getElementById('yearSelect').value='2026';document.body={appendChild(){}};document.createElement=()=>({style:{}});vm.createContext(ctx);
 const start=profitSource.indexOf("document.getElementById('saveInitialCapital').addEventListener"),end=profitSource.indexOf("document.getElementById('exportDataBtn')",start);
 vm.runInContext(profitSource.slice(start,end),ctx);document.getElementById('saveInitialCapital').click();return {funds,unrealized,calls};
}
test('explicit blank save preserves null/missing distinctions and never invents a stored zero',()=>{
 const {funds,unrealized,calls}=saveOpening(false);assert.equal(calls.saves,1);assert.equal(funds[2026].gmo,null);assert.equal(funds[2026].sbi,null);
 assert.equal(Object.hasOwn(funds[2026],'lightfx'),false);assert.equal(unrealized[2026].gmo,null);assert.equal(Object.hasOwn(unrealized[2026],'sbi'),false);
});
test('actual opening save handler refuses all writes while reading has failed',()=>{
 const {funds,unrealized,calls}=saveOpening(true);assert.equal(calls.saves,0);assert.equal(funds[2026].gmo,100);assert.equal(unrealized[2026].gmo,0);
});
test('input rendering stops safely before source-service inspection when persisted input JSON is broken',()=>{
 const container={innerHTML:''},ctx={document:{getElementById:()=>container},refreshMonthlyModels(){},displayReadFailed:true};vm.createContext(ctx);
 vm.runInContext(profitSource.slice(profitSource.indexOf('function renderAccountInputs()'),profitSource.indexOf('function handleAccountInputFocus('))+'\nrenderAccountInputs();',ctx);
 assert.match(container.innerHTML,/保存データの一部を確認できません/);
});
test('Backup v16 and saved numeric-string/null values remain byte unchanged after reads',async()=>{
 const f=await currentFixture();f.store.setItem('yearInitialFunds','{"2026":{"gmo":"100","sbi":null}}');const b=backup(f.store),before=f.store.snapshot(),payload=b.build();
 const s=read.read(f.store),d=display.create(metrics,s.tradingData,s.yearInitialFunds,s.yearInitialUnrealized,s.models,f.accounts,{readState:s});
 d.series(2026);results.create(d,2026);assets.latest(d,s.models,{tradingData:s.tradingData});assert.equal(f.store.snapshot(),before);
 assert.equal(payload.backupVersion,16);assert.deepEqual(b.build(),payload);assert.equal(b.format.inspectValue(payload).ok,true);
});
