const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const result=require('../assets/display-results.js'),read=require('../assets/display-read-state.js'),display=require('../assets/monthly-display-view.js');
const {fixture}=require('./monthly-display-fixture.js'),model=require('../assets/data-model-storage.js');
const window={};vm.runInNewContext(fs.readFileSync('assets/profit-metrics.js','utf8'),{window});
const view=f=>display.create(window.TradeScopeProfitMetrics,f.tradingData,f.initialFunds,f.initialUnrealized,f.models,f.accounts);
for(const key of ['net','confirmed','netPnl','confirmedPnl'])test('shared period '+key+' is directly referenced, not recalculated by consumers',()=>{
 const f=fixture(),d=view(f),period=d.dashboard(2026),shared=result.create({...d,dashboard:()=>period},2026);
 const top=shared.period[key],annual=shared.period[key];assert.strictEqual(top,period[key]);assert.strictEqual(annual,top);
});
for(const key of ['realizedSum','swapSum','depositSum','withdrawSum'])test('shared annual '+key+' preserves the common calculation',()=>{
 const d=view(fixture()),annual=d.yearlyTotals(2026),shared=result.create({...d,yearlyTotals:()=>annual},2026);
 assert.strictEqual(shared.annual,annual);assert.equal(shared.annual[key],annual[key]);assert.equal(shared.swap.cumulativeSwap,annual.swapSum);
});
test('period and current asset results are explicitly separate even within one shared bundle',()=>{
 const f=fixture(),d=view(f),before=JSON.stringify(f),current=require('../assets/current-asset-view.js');
 const v=result.create(d,2026,{currentFactory:p=>current.create(p,f.models,2026,{balanceHistory:d.balanceHistory})});
 assert.notEqual(v.current.net.value,v.period.net.value);assert.equal(v.basis,'period-dashboard');assert.equal(JSON.stringify(f),before);
});
test('same complete period basis exposes delta and growth',()=>{
 const p=view(fixture()).dashboard(2026,8),c=result.periodComparison(p);assert.equal(c.comparable,true);assert.equal(c.delta,p.netDelta);assert.equal(c.growth,p.netGrowth);
});
for(const change of [p=>p.rows[0].metrics.net.basis='observation',p=>p.rows[0].metrics.net.sourceMonth='2026-07',p=>p.rows[0].metrics.net.status='current partial',p=>p.rows[0].metrics.net.value=null,p=>p.rows[0].conflict=true])test('different/incomplete comparison basis hides period delta and growth',()=>{
 const p=view(fixture()).dashboard(2026,8);change(p);const c=result.periodComparison(p);assert.equal(c.comparable,false);assert.equal(c.delta,null);assert.equal(c.growth,null);
});
for(const initial of [null,0,-1])test('unknown/non-positive denominator '+initial+' cannot create a growth rate',()=>{
 const p=view(fixture()).dashboard(2026,8);p.initialNet=initial;p.netGrowth=99;assert.equal(result.periodComparison(p).growth,null);
});
test('partial annual asset cannot be compared with the separate complete-month amount',()=>{
 const d=view(fixture()),v=result.create(d,2026);assert.notEqual(v.period.net.value-v.period.initialNet,v.period.netDelta);assert.equal(v.netComparison.delta,null);
});
for(const missing of ['funds','unrealized'])test('missing '+missing+' source cannot be hidden by legacy zero contribution in the denominator',()=>{
 const f=fixture(),d=view(f),period=d.dashboard(2026,8),initialSources={funds:f.initialFunds,unrealized:{2026:Object.fromEntries(f.accounts.filter(a=>!a.bankOnly).map(a=>[a.key,0]))}};
 delete initialSources[missing][2026].gmo;
 const v=result.create({...d,dashboard:()=>period},2026,{initialSources,currentFactory:p=>require('../assets/current-asset-view.js').create(p,{},2026)});
 assert.equal(v.netComparison.growth,null);assert.equal(v.netComparison.delta,null);assert.equal(v.current.netPeriodComparison.growth,null);assert.equal(v.current.netPeriodComparison.delta,null);
});
test('explicit initial zero is known; a positive total can be compared without a guessed missing component',()=>{
 const f=fixture(),d=view(f),period=d.dashboard(2026,8),initialSources={funds:f.initialFunds,unrealized:{2026:Object.fromEntries(f.accounts.filter(a=>!a.bankOnly).map(a=>[a.key,0]))}};
 initialSources.funds[2026].gmo=0;const v=result.create({...d,dashboard:()=>period},2026,{initialSources});assert.equal(v.netComparison.comparable,true);
});
for(const key of ['gmo','lightfx','minano','sbi','sbivc','smbc'])test(key+' August legacy numbers are unchanged by September canonical data',()=>{
 const f=fixture(),a=view(f).accountMonth(2026,8,f.accounts.find(r=>r.key===key)),empty={...f,models:Object.fromEntries(Object.keys(f.models).map(k=>[k,null]))};
 const b=view(empty).accountMonth(2026,8,f.accounts.find(r=>r.key===key));assert.deepEqual(a,b);
});
test('monthly detail includes all six missing accounts, without prior assets or initial funds',()=>{
 const f=fixture(),m=result.month(view(f),2026,10);assert.equal(m.rows.length,6);assert.equal(m.total,null);
 for(const r of m.rows){assert.equal(r.status,'missing');assert.equal(r.asset,null);assert.equal(r.total,null);assert.equal(r.confirmed,null);}
});
test('explicit saved zero remains zero, and does not turn missing peers into zeros',()=>{
 const f=fixture();f.tradingData[2026][7]={gmo:{__saved:true,realizedPnL:0,swapPnL:0,unrealizedPnL:0,deposit:0,withdrawal:0}};
 const m=result.month(view(f),2026,7);assert.equal(m.rows[0].realized,0);assert.equal(m.rows[0].total,0);assert.equal(m.rows[1].realized,null);
});
test('read failure keeps six unknown rows and does not expose an annual rate',()=>{
 const v=result.create(view(fixture()),2026,{readFailed:true});assert.equal(v.period.net.value,null);assert.equal(v.annual.swapSum,null);assert.equal(v.netComparison.growth,null);
 for(const r of v.months[7].rows){assert.equal(r.status,'read-failure');assert.equal(r.asset,null);assert.equal(r.total,null);}
});
test('current carry does not change Annual/Performance/Asset Trend/Risk period source',()=>{
 const f=fixture(),d=view(f),before=JSON.stringify([d.series(2026),d.month(2026,8),d.yearlyTotals(2026)]);
 result.create(d,2026,{currentFactory:p=>require('../assets/current-asset-view.js').create(p,f.models,2026,{balanceHistory:d.balanceHistory})});
 assert.equal(JSON.stringify([d.series(2026),d.month(2026,8),d.yearlyTotals(2026)]),before);
 const top=fs.readFileSync('top/script.js','utf8');assert.match(top,/const cryptoAccount = \(topSeries\.accountData/);
});
test('both screens call the same result factory; Top swap has no second monthly reducer',()=>{
 const top=fs.readFileSync('top/script.js','utf8'),profit=fs.readFileSync('profit/soneki.js','utf8');
 for(const src of [top,profit])assert.match(src,/TradeScopeDisplayResults\.create/);
 assert.match(top,/latestDashboard = latestResults\.period/);assert.match(profit,/const summary = result\.period/);
 const swap=top.slice(top.indexOf('function buildSwapSummary'),top.indexOf('function updateSwap'));assert.doesNotMatch(swap,/reduce|calculateLinkedMonthlyTotals/);
 assert.match(profit,/const accountTotal = view\.total/);assert.doesNotMatch(profit,/if \(!view\.hasData\) return ''/);
});
function adapter(f){const data=new Map([['tradingData',JSON.stringify(f.tradingData)],['yearInitialFunds',JSON.stringify(f.initialFunds)],['yearInitialUnrealized',JSON.stringify(f.initialUnrealized)],...Object.entries(f.models).filter(([,v])=>v).map(([k,v])=>[model.keys[k],JSON.stringify(v)])]);return{data,getItem:k=>data.get(k)??null,setItem(){throw Error('write forbidden');},removeItem(){throw Error('write forbidden');}};}
for(const key of ['tradingData','yearInitialFunds','yearInitialUnrealized'])test('read refresh receives external '+key+' changes without writes',()=>{
 const a=adapter(fixture()),before=read.read(a);a.data.set(key,JSON.stringify({2026:{8:{anonymous:9}}}));const after=read.read(a);
 assert.notDeepEqual(after[key],before[key]);assert.equal(read.affects(key),true);
});
test('canonical keys, history/symbols and Storage.clear are explicit reload dependencies',()=>{
 for(const k of [...Object.values(model.keys),'tradeScopeTradeHistoryV1','tradeScopeSymbolListV1','tradeInfo',null])assert.equal(read.affects(k),true);
 assert.equal(read.affects('irrelevant'),false);const a=adapter(fixture());a.data.delete(model.keys.holdingSnapshots);a.data.delete(model.keys.monthlyAccountInputs);assert.equal(read.read(a).models.holdingSnapshots,null);
});
test('dirty legacy drafts survive refresh, clean rows update, and canonical drafts retain by month',()=>{
 const old={2026:{8:{gmo:{realizedPnL:19},sbi:{realizedPnL:1}}}},fresh={2026:{8:{gmo:{realizedPnL:5},sbi:{realizedPnL:2}}}},dirty=new Set([read.token(2026,8,'gmo')]);
 const merged=read.mergeDrafts(old,fresh,dirty);assert.equal(merged[2026][8].gmo.realizedPnL,19);assert.equal(merged[2026][8].sbi.realizedPnL,2);assert.equal(old[2026][8].sbi.realizedPnL,1);
 const drafts=require('../assets/sbi-input-draft.js').createDrafts();drafts.initialize('2026-09',{deposit:'19'});drafts.initialize('2026-10',{deposit:'1'});drafts.retain(m=>m==='2026-09');assert.equal(drafts.read('2026-09').deposit,'19');assert.deepEqual(drafts.read('2026-10'),{});
});
test('malformed legacy read fails closed instead of manufacturing a zero',()=>{
 const a=adapter(fixture());a.data.set('yearInitialFunds','broken');assert.equal(read.read(a).failed,true);
});
test('invalid canonical Storage is a read failure, not an empty registry or permission to seed demo data',()=>{
 const a=adapter(fixture());a.data.set(model.keys.accountSnapshots,'broken');assert.equal(read.read(a).failed,true);
 const seed=profitSource.slice(profitSource.indexOf('function seedDemoDataIfEmpty()'),profitSource.indexOf('function seedDemoDataIfEmpty()')+200);assert.match(seed,/if \(displayReadFailed\) return/);
});
test('external refresh/BFCache wiring preserves live Draft controls and does not call destructive initial load',()=>{
 const src=fs.readFileSync('profit/soneki.js','utf8'),refresh=src.slice(src.indexOf('function refreshExternalDisplay()'),src.indexOf('function seedDemoDataIfEmpty()'));
 assert.match(refresh,/mergeDrafts/);assert.match(refresh,/if\(!editing\)/);assert.match(refresh,/if\(!dirtyInitialDrafts\.has/);assert.doesNotMatch(refresh,/setItem|saveToStorage|\.clear\(|loadFromStorage/);
 assert.match(src,/if \(event.persisted\) refreshExternalDisplay\(\)/);assert.match(src,/DisplayReadState\.affects\(event.key\)/);
});

// Execute the production handlers against read-only, anonymous Storage and DOM stubs.
const profitSource=fs.readFileSync('profit/soneki.js','utf8');
function refreshHarness(){
 const f=fixture(),store=adapter(f),calls={},events={};
 const context={window:{TradeScopeDisplayReadState:read,addEventListener:(name,fn)=>events[name]=fn},localStorage:store,
  tradingData:f.tradingData,legacyInputData:structuredClone(f.tradingData),yearInitialFunds:f.initialFunds,yearInitialUnrealized:f.initialUnrealized,
  monthlyModels:f.models,displayReadFailed:false,currentYear:2026,currentMonth:8,ACCOUNTS:f.accounts,
  dirtyAccountDrafts:new Set(),dirtyInitialDrafts:new Set(),inputTargetMonth:()=> '2026-08',
  monthlyDetailPane:{classList:{contains:()=>true}},
  sbiInputDrafts:{retain:fn=>calls.sbi=fn},gmoMonthlyUI:{retainDrafts:fn=>calls.gmo=fn},tradersMonthlyUI:{retainDrafts:fn=>calls.traders=fn}};
 for(const name of ['updateYearSelect','renderAnnualSummary','renderPerformanceChart','renderMonthlySection','renderMonthTabs','renderMonthlyDetailPane','renderAccountInputs','renderInitialCapitalForm'])context[name]=()=>calls[name]=(calls[name]??0)+1;
 vm.createContext(context);
 vm.runInContext(profitSource.slice(profitSource.indexOf('function refreshExternalDisplay()'),profitSource.indexOf('function seedDemoDataIfEmpty()')),context);
 vm.runInContext(profitSource.slice(profitSource.indexOf("window.addEventListener('pageshow', event => {",profitSource.indexOf("window.addEventListener('load'")),profitSource.indexOf("document.getElementById('accountInputGrid').addEventListener('input'")),context);
 return {f,store,calls,context,events};
}
for(const key of ['tradingData','yearInitialFunds','yearInitialUnrealized'])test('production storage handler updates the displayed result for '+key,()=>{
 const h=refreshHarness(),old=view(h.f).dashboard(2026,8);
 const changed=JSON.parse(h.store.getItem(key));
 if(key==='tradingData')changed[2026][8].gmo.realizedPnL=23;else {changed[2026]??={};changed[2026].gmo=43;}
 h.store.data.set(key,JSON.stringify(changed));const storageBefore=JSON.stringify([...h.store.data]);h.events.storage({key});
 const c=h.context,newView=view({tradingData:c.tradingData,initialFunds:c.yearInitialFunds,initialUnrealized:c.yearInitialUnrealized,models:c.monthlyModels,accounts:h.f.accounts});
 const metric=key==='yearInitialUnrealized'?'netPnl':'net';assert.notEqual(newView.dashboard(2026,8)[metric].value,old[metric].value);assert.equal(h.calls.renderAnnualSummary,1);assert.equal(h.calls.renderMonthlyDetailPane,1);
 assert.equal(JSON.stringify([...h.store.data]),storageBefore);assert.equal(h.calls.renderAccountInputs,1);
});
test('production storage handler refreshes canonical data but ignores unrelated keys',()=>{
 const h=refreshHarness();h.events.storage({key:'irrelevant'});assert.equal(h.calls.renderAnnualSummary,undefined);
 h.store.data.delete(model.keys.monthlyAccountStates);h.events.storage({key:model.keys.monthlyAccountStates});assert.equal(h.context.monthlyModels.monthlyAccountStates,null);assert.equal(h.calls.renderAnnualSummary,1);
});
test('BFCache refresh preserves dirty live account/initial controls and unsaved legacy row',()=>{
 const h=refreshHarness(),c=h.context;c.dirtyAccountDrafts.add(read.token(2026,8,'gmo'));c.dirtyInitialDrafts.add(2026);c.legacyInputData[2026][8].gmo.realizedPnL=87;
 const changed=structuredClone(h.f.tradingData);changed[2026][8].gmo.realizedPnL=17;changed[2026][8].sbi.realizedPnL=19;h.store.data.set('tradingData',JSON.stringify(changed));
 const before=JSON.stringify([...h.store.data]);h.events.pageshow({persisted:false});assert.equal(h.calls.renderAnnualSummary,undefined);h.events.pageshow({persisted:true});
 assert.equal(c.tradingData[2026][8].gmo.realizedPnL,17);assert.equal(c.legacyInputData[2026][8].gmo.realizedPnL,87);assert.equal(c.legacyInputData[2026][8].sbi.realizedPnL,19);
 assert.equal(h.calls.renderAccountInputs,undefined);assert.equal(h.calls.renderInitialCapitalForm,undefined);assert.equal(h.calls.renderAnnualSummary,1);assert.equal(h.calls.gmo('2026-08'),true);assert.equal(h.calls.gmo('2026-09'),false);assert.equal(JSON.stringify([...h.store.data]),before);
});
test('canonical editing is retained without rebuilding controls or adopting stale save guards',()=>{
 const h=refreshHarness(),c=h.context;c.currentMonth=9;c.inputTargetMonth=()=> '2026-09';c.dirtyAccountDrafts.add(read.token(2026,9,'sbi'));
 h.events.storage({key:model.keys.holdingSnapshots});assert.equal(h.calls.sbi('2026-09'),true);assert.equal(h.calls.sbi('2026-10'),false);assert.equal(h.calls.renderAccountInputs,undefined);
});
test('read failure refresh preserves Draft and marks display unknown without Storage writes',()=>{
 const h=refreshHarness(),before=JSON.stringify(h.context.legacyInputData);h.store.data.set('tradingData','broken');const storageBefore=JSON.stringify([...h.store.data]);
 h.events.storage({key:'tradingData'});assert.equal(h.context.displayReadFailed,true);assert.equal(JSON.stringify(h.context.legacyInputData),before);assert.equal(JSON.stringify([...h.store.data]),storageBefore);
});
function detailHtml(f,month,readFailed=false){
 const m=result.month(view(f),2026,month,{readFailed}),body={innerHTML:'',querySelector:()=>null};
 const context={currentYear:2026,currentMonth:month,monthlyDetailTitle:{},monthlyDetailBody:body,ACCOUNTS:f.accounts,tradingData:f.tradingData,
  monthlyDisplayTotals:()=>({...m,depositSum:m.deposit,withdrawSum:m.withdrawal,realizedSum:m.realized,swapSum:m.swap,unrealizedSum:m.unrealized}),
  displayAccountName:k=>f.accounts.find(r=>r.key===k).name,fmtJPY:v=>'¥'+v,optionalSignStyle:()=>'',monthlyComponentHtml:()=>'',profitMetrics:{isMonthEntered:()=>false}};
 vm.createContext(context);
 vm.runInContext(profitSource.slice(profitSource.indexOf('function formatOptionalJPY'),profitSource.indexOf('function optionalSignStyle')),context);
 vm.runInContext(profitSource.slice(profitSource.indexOf('function renderMonthlyDetailPane'),profitSource.indexOf('function openMonthlyDetailPane'))+'\nrenderMonthlyDetailPane();',context);
 return body.innerHTML;
}
test('production monthly detail DOM renders six empty rows as dash, not zero or initial/prior balances',()=>{
 const html=detailHtml(fixture(),10);assert.equal((html.match(/data-month-status="missing"/g)||[]).length,6);assert.equal((html.match(/class="detail-account-name"/g)||[]).length,6);assert.doesNotMatch(html,/0円|¥\d/);
});
test('production monthly detail DOM distinguishes explicit zero from five missing peers',()=>{
 const f=fixture();f.tradingData[2026][7]={gmo:{__saved:true,realizedPnL:0,swapPnL:0,unrealizedPnL:0,deposit:0,withdrawal:0}};
 const html=detailHtml(f,7);assert.match(html,/0円/);assert.equal((html.match(/data-month-status="missing"/g)||[]).length,5);assert.equal((html.match(/data-month-status="complete"/g)||[]).length,1);
});
test('production detail DOM keeps conflicted and read-failure rows visible but unknown',()=>{
 const f=fixture();f.models.importBatches.records.push({...f.models.importBatches.records[1],id:'ambiguous'});f.models.holdingSnapshots.records.push({...f.models.holdingSnapshots.records[0],id:'ambiguous-holding',importBatchId:'ambiguous'});
 assert.match(detailHtml(f,9),/data-month-status="conflict"/);const html=detailHtml(f,8,true);assert.equal((html.match(/data-month-status="read-failure"/g)||[]).length,6);assert.doesNotMatch(html,/0円|¥\d/);
});
