// Invented observations and in-memory adapters only. No production data or real PDFs.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const f=require('./observation-override-fixture.js'),core=require('../assets/monthly-source-contract.js'),service=require('../assets/monthly-source-service.js');
const balance=require('../assets/sbivc-balance-adoption.js'),display=require('../assets/monthly-display-view.js'),results=require('../assets/display-results.js');
const progress=require('../assets/monthly-progress-view.js'),positions=require('../assets/open-positions-view.js'),current=require('../assets/current-asset-view.js');
const transactions=require('../assets/transaction-view.js'),{createUI}=require('../import/sbivc-preview.js'),parser=require('../import/sbivc-parser.js');
const {fixture}=require('./sbivc-pdf-fixture.js'),{tradesFixture}=require('./sbivc-trades-fixture.js');
const w={};vm.runInNewContext(fs.readFileSync('assets/profit-metrics.js','utf8'),{window:w});
const models=s=>f.storage.readModels(s),rows=(s,e)=>models(s)[e]?.records||[],account={key:'sbivc',name:'SBI VC'};
const view=s=>display.create(w.TradeScopeProfitMetrics,{}, {},{},models(s),[account]);
const row=s=>results.month(view(s),2031,2).rows[0],raw=s=>JSON.stringify(models(s));
let sequence=0;
function operate(s,operation){const a=service.createService(s,{clock:()=>f.now,newId:()=> 'anonymous_'+(++sequence)}),v=a.inspect();return a.operate(operation,{expectedFingerprint:v.fingerprint});}
function candidate(s,metric){return core.candidates(models(s),{accountId:f.accountId,targetMonth:f.month}).find(c=>c.metric===metric);}
function manual(s,metric,value){const r=core.descriptor({accountId:f.accountId,targetMonth:f.month,component:metric==='holdings'?'spot':'cash',asOf:'2031-02-28'},metric,value,
 {id:'manual_'+(++sequence),sourceId:'manual_'+sequence,sourceType:'manual'});operate(s,{sources:[r],adoptions:[{revisionId:r.id}]});return r;}
const inspect=(s,p=f.source())=>f.pdfService(s).inspect(p,{balanceImport:true});
async function reimport(s,p=f.source(),confirm=true){const g=await inspect(s,p);return f.pdfService(s).save(p,{...g,...(confirm&&g.balanceUpdateRequired?{confirmBalanceUpdate:true}:{})});}
const financial=s=>Object.fromEntries(['accounts','instruments','importBatches','accountSnapshots','holdingSnapshots','monthlyAccountInputs','importedTransactions','transactionReconciliations','transactionSources'].map(e=>[e,models(s)[e]]));

for(const registered of [true,false])test('fixed-month balance uses '+(registered?'registered candidates':'old compatibility without source records'),async()=>{
 const s=await f.seed();if(!registered)s.removeItem(f.storage.keys.monthlySources);const before=s.snapshot(),r=row(s);
 assert.equal(r.hasData,true);assert.equal(r.status,'partial');assert.equal(r.asset,20126.375);assert.equal(r.components.length,2);
 for(const k of ['realized','swap','unrealized','total'])assert.equal(r[k],null);assert.equal(s.snapshot(),before);
});
test('fixed balance never creates monthly P/L or monthly State',async()=>{const s=await f.seed(),p=progress.create({models:models(s)}).account('sbivc',f.month);
 assert.equal(p.balanceRequirementsSatisfied,true);assert.equal(p.periodRequirementsSatisfied,false);assert.equal(p.periodStatus,'unsupported-canonical-pnl');assert.deepEqual(p.missingRequired.balance,[]);assert.equal(models(s).monthlyAccountStates,null);});
test('confirmed empty holding set is a known zero, not missing',async()=>{const s=await f.seed({zero:true}),r=row(s);assert.equal(r.hasData,true);assert.equal(r.components[0].asset,'0');assert.equal(r.components[0].empty,true);assert.equal(rows(s,'holdingSnapshots').length,0);});
for(const value of ['0',null])test('JPY '+value+' remains distinct in fixed balance',async()=>{const s=await f.seed();manual(s,'cashBalance',value);const r=row(s);assert.equal(r.components[1].asset,value);assert.equal(r.asset,value===null?126.375:126.375);assert.equal(r.realized,null);});
test('empty collection plus explicit zero cash is a known zero account',async()=>{const s=await f.seed({zero:true});manual(s,'cashBalance','0');assert.equal(row(s).asset,0);assert.equal(balance.fixedObservation(models(s),f.month).complete,true);});
test('unknown quantity never becomes empty or zero',async()=>{const s=await f.seed(),h=core.sourceValue(candidate(s,'holdings'),models(s));h[0].quantity=null;manual(s,'holdings',h);const r=row(s);assert.equal(r.components[0].asset,null);assert.equal(r.components[0].empty,false);});
test('fixed month never carries earlier/future observations',async()=>{const s=await f.seed();for(const m of [1,3]){const r=results.month(view(s),2031,m).rows[0];assert.equal(r.status,'missing');assert.equal(r.asset,null);assert.deepEqual(r.components,[]);}});
test('no observations remain missing',()=>{const s=new f.Memory();assert.equal(row(s).status,'missing');assert.equal(row(s).asset,null);});
test('only fixed-month detail changes; annual, trend, monthly P/L and current remain unchanged',async()=>{
 const s=new f.Memory(),before=view(s),old={dashboard:before.dashboard(2031),series:before.series(2031),annual:before.yearlyTotals(2031),pnl:before.monthlyPnl(2031,2)};
 await f.pdfService(s).save(f.source());const after=view(s);
 assert.deepEqual(after.dashboard(2031),{...old.dashboard,sourceFingerprint:after.dashboard(2031).sourceFingerprint});
 const strip=x=>{const c=f.copy(x);delete c.sourceFingerprint;if(c.summary)delete c.summary.sourceFingerprint;return c;};
 assert.deepEqual(strip(after.series(2031)),strip(old.series));assert.deepEqual(after.yearlyTotals(2031),old.annual);assert.deepEqual(after.monthlyPnl(2031,2),old.pnl);
 const m=models(s),snapshot=raw(s);positions.resolve(m);current.create(after.dashboard(2031),m,2031);assert.equal(raw(s),snapshot);
});

test('healthy same PDF inspection offers read-only reimport',async()=>{const s=await f.seed(),before=s.snapshot(),g=await inspect(s);assert.equal(g.status,'already-imported');assert.equal(g.reimport,true);assert.equal(g.needsRepair,false);assert.equal(g.balanceUpdateRequired,false);assert.equal(s.snapshot(),before);});
test('healthy same PDF does not write a journal or any record',async()=>{const s=await f.seed(),before=s.snapshot();let writes=0;const set=s.setItem.bind(s);s.setItem=(...a)=>{writes++;set(...a);};const r=await reimport(s);assert.equal(r.balanceVerified,true);assert.equal(r.repaired,false);assert.equal(writes,0);assert.equal(s.snapshot(),before);});
for(const missing of ['all','holdings','cashBalance','reportedAssetTotal'])test('same PDF fills only missing '+missing+' candidates',async()=>{
 const s=await f.seed(),m=models(s),kept=m.monthlySources.records.filter(r=>missing!=='all'&&r.metric!==missing),original=financial(s);
 if(kept.length)s.setItem(f.storage.keys.monthlySources,JSON.stringify(core.envelope(kept,f.now)));else s.removeItem(f.storage.keys.monthlySources);
 const g=await inspect(s);assert.equal(g.needsRepair,true);assert.equal(g.balanceUpdateRequired,false);const r=await reimport(s);
 assert.equal(r.repaired,true);assert.equal(rows(s,'monthlySources').filter(r=>r.kind==='source').length,3);assert.deepEqual(financial(s),original);
 assert.ok(kept.every(k=>rows(s,'monthlySources').some(r=>JSON.stringify(r)===JSON.stringify(k))));
});
test('canonical values are never copied to monthly sources',async()=>{const s=await f.seed();s.removeItem(f.storage.keys.monthlySources);await reimport(s);for(const r of rows(s,'monthlySources')){assert.equal(r.kind,'source');assert.equal(r.value,null);assert.ok(r.reference);}});
test('no legacy Input but valid canonical can be explicitly used without inventing Input',async()=>{
 const s=await f.seed();s.removeItem(f.storage.keys.monthlyAccountInputs);s.removeItem(f.storage.keys.monthlySources);assert.equal(balance.resolve(models(s),f.month),null);
 const before=financial(s);await reimport(s);assert.equal(balance.resolve(models(s),f.month).spotStatus,'adopted');assert.equal(row(s).asset,20126.375);assert.deepEqual(financial(s),before);
});
test('defer with no current adoption can be explicitly activated by reimport',async()=>{const s=await f.seed();operate(s,{adoptions:['holdings','cashBalance'].map(m=>({...core.target(candidate(s,m)),decision:'defer'}))});
 const g=await inspect(s);assert.equal(g.balanceUpdateRequired,false);await reimport(s);const b=balance.resolve(models(s),f.month);assert.equal(b.spotStatus,'adopted');assert.equal(b.cashStatus,'adopted');});
for(const [metric,value]of [['cashBalance','9'],['cashBalance','20000'],['cashBalance','0'],['cashBalance',null]])test('manual '+metric+' '+value+' is protected until confirmation',async()=>{
 const s=await f.seed();manual(s,metric,value);const before=s.snapshot(),g=await inspect(s);assert.equal(g.balanceUpdateRequired,true);await reimport(s,f.source(),false);assert.equal(s.snapshot(),before);
 await reimport(s);assert.equal(balance.resolve(models(s),f.month).adopted.cashBalance,'20000');assert.ok(rows(s,'monthlySources').some(r=>r.sourceType==='manual'));
});
test('manual holdings are protected and both components switch in one operation',async()=>{const s=await f.seed(),h=core.sourceValue(candidate(s,'holdings'),models(s));h[0].quantity='8';manual(s,'holdings',h);manual(s,'cashBalance','9');const before=s.snapshot();await reimport(s,f.source(),false);assert.equal(s.snapshot(),before);await reimport(s);assert.equal(balance.resolve(models(s),f.month).holdings[0].adopted.quantity,'0.1234567890123456789');});
for(const metric of ['holdings','cashBalance'])test('common '+metric+' override requires confirmation and is retained in history',async()=>{
 const s=await f.seed(),r=candidate(s,metric),value=metric==='holdings'?core.sourceValue(r,models(s)):'7';if(Array.isArray(value))value[0].quantity='7';
 operate(s,{overrides:[{id:'override_'+metric,revisionId:r.id,value}],adoptions:[{revisionId:r.id,overrideId:'override_'+metric}]});const before=s.snapshot();
 assert.equal((await inspect(s)).balanceUpdateRequired,true);await reimport(s,f.source(),false);assert.equal(s.snapshot(),before);await reimport(s);
 assert.ok(rows(s,'monthlySources').some(r=>r.id==='override_'+metric));assert.equal((await inspect(s)).balanceUpdateRequired,false);
});
test('native v4 cash override is protected but not inherited after explicit replacement',async()=>{const s=await f.seed(),v=f.service(s).inspect(f.accountId,f.month),d=f.draft(v);d.account.cashBalance='7';f.service(s).save(d,{expectedModels:v.models});const before=financial(s);assert.equal((await inspect(s)).balanceUpdateRequired,true);await reimport(s);assert.equal(balance.resolve(models(s),f.month).adopted.cashBalance,'20000');assert.deepEqual(financial(s),before);assert.equal((await inspect(s)).balanceUpdateRequired,false);});
test('same hash old revision needs confirmation, never silently replaces newer PDF',async()=>{const s=await f.seed(),p=f.source('b',{assets:['SOL']}),a=f.pdfService(s);await a.save(p,await a.inspect(p));const before=s.snapshot();await reimport(s,f.source(),false);assert.equal(s.snapshot(),before);await reimport(s);assert.equal(balance.resolve(models(s),f.month).holdings.length,3);assert.equal(rows(s,'importBatches').length,2);});
test('same month different PDF retains all originals and explicitly switches balance',async()=>{
 const s=await f.seed(),before=financial(s),p=f.source('b',{assets:['SOL']}),g=await inspect(s,p);assert.equal(g.status,'review-required');assert.equal(g.balanceUpdateRequired,true);
 await f.pdfService(s).save(p,g);assert.deepEqual(financial(s),before);await reimport(s,p);assert.equal(rows(s,'importBatches').length,2);assert.equal(rows(s,'accountSnapshots').length,2);
 assert.deepEqual(rows(s,'holdingSnapshots').slice(0,3),before.holdingSnapshots.records);assert.equal(balance.resolve(models(s),f.month).holdings.length,1);
 assert.deepEqual(models(s).monthlyAccountInputs,before.monthlyAccountInputs);assert.ok(rows(s,'monthlySources').some(r=>r.revisionOf!==null));
});
test('balance-only correction does not switch active transaction Batch or reconciliation',async()=>{
 const s=new f.Memory(),p={preview:parser.parse(tradesFixture()),fileHash:'c'.repeat(64),fileSize:256},next={...f.copy(p),fileHash:'d'.repeat(64)};
 await f.pdfService(s).save(p);const m=models(s),old=transactions.resolve([],m),input=f.copy(m.monthlyAccountInputs);
 await reimport(s,next);assert.deepEqual(transactions.resolve([],models(s)),old);assert.deepEqual(models(s).monthlyAccountInputs,input);assert.equal(models(s).transactionReconciliations,m.transactionReconciliations);
 const before=s.snapshot();await reimport(s,next);assert.equal(s.snapshot(),before);
});
test('same PDF balance reimport cannot create transaction reconciliation',async()=>{const s=await f.seed(),before=financial(s);await reimport(s);assert.deepEqual(financial(s),before);});
test('preview fingerprint protects newer adoption and preserves original preview',async()=>{const s=await f.seed(),p=f.source(),original=f.copy(p),g=await inspect(s);manual(s,'cashBalance','8');const before=s.snapshot();const r=await f.pdfService(s).save(p,{...g,confirmBalanceUpdate:true});assert.equal(r.status,'stale');assert.equal(s.snapshot(),before);assert.deepEqual(p,original);});
test('reimport with no fingerprint is not authorization to write',async()=>{const s=await f.seed();s.removeItem(f.storage.keys.monthlySources);const before=s.snapshot();assert.equal((await f.pdfService(s).save(f.source(),{balanceImport:true})).status,'stale');assert.equal(s.snapshot(),before);});
test('candidate repair and both adoptions use exactly one journal',async()=>{const s=await f.seed();s.removeItem(f.storage.keys.monthlyAccountInputs);s.removeItem(f.storage.keys.monthlySources);let journals=0;const set=s.setItem.bind(s);s.setItem=(k,v)=>{if(k===f.tx.journalKey)journals++;set(k,v);};await reimport(s);assert.equal(journals,1);assert.equal(s.getItem(f.tx.journalKey),null);assert.equal(rows(s,'monthlySources').filter(r=>r.kind==='adoption').length,2);});
test('candidate write failure rolls back with no partial adoption',async()=>{const s=await f.seed();s.removeItem(f.storage.keys.monthlySources);const before=s.snapshot();s.failKey=f.storage.keys.monthlySources;await assert.rejects(reimport(s));assert.equal(s.snapshot(),before);assert.equal(s.getItem(f.tx.journalKey),null);});
test('rollback failure retains journal and stops subsequent saves',async()=>{const s=await f.seed();s.removeItem(f.storage.keys.monthlySources);s.failKey=f.storage.keys.monthlySources;s.permanent=true;await assert.rejects(reimport(s));assert.notEqual(s.getItem(f.tx.journalKey),null);await assert.rejects(inspect(s));});
test('domain postcondition failure rolls back inside repository journal',async()=>{const s=await f.seed(),before=s.snapshot(),m=models(s);assert.throws(()=>f.storage.createRepository(s).commit({monthlySources:{...m.monthlySources,updatedAt:'2031-03-02T00:00:00.000Z'}},{expectedModels:m,verifyModels:()=>false}));assert.equal(s.snapshot(),before);assert.equal(s.getItem(f.tx.journalKey),null);});
test('successful domain verification sees reloaded models before journal is removed',async()=>{const s=await f.seed(),m=models(s);let calls=0;f.storage.createRepository(s).commit({monthlySources:{...m.monthlySources,updatedAt:'2031-03-02T00:00:00.000Z'}},{verifyModels:v=>{calls++;assert.notEqual(s.getItem(f.tx.journalKey),null);assert.equal(balance.fixedObservation(v,f.month).asset,'20126.375');return true;}});assert.equal(calls,1);assert.equal(s.getItem(f.tx.journalKey),null);});
for(const key of ['accountSnapshots','holdingSnapshots','importBatches','monthlySources'])test('different PDF failure at '+key+' rolls back all changes',async()=>{const s=await f.seed(),p=f.source('b'),g=await inspect(s,p),before=s.snapshot();s.failKey=f.storage.keys[key];await assert.rejects(f.pdfService(s).save(p,{...g,confirmBalanceUpdate:true}));assert.equal(s.snapshot(),before);});
for(const fault of ['missing-snapshot','broken-adoption','stale'])test('severe '+fault+' stops without deleting or bypassing validation',async()=>{
 const s=await f.seed(),c=candidate(s,'cashBalance');if(fault!=='missing-snapshot')operate(s,{adoptions:[{revisionId:c.id}]});const m=models(s);
 if(fault==='missing-snapshot')m.accountSnapshots.records=[];else if(fault==='broken-adoption')m.monthlySources.records.find(r=>r.kind==='adoption').revisionId='absent';else m.accountSnapshots.records[0].cashBalance='999';
 for(const e of ['accountSnapshots','monthlySources'])s.setItem(f.storage.keys[e],JSON.stringify(m[e]));const before=s.snapshot();await assert.rejects(inspect(s));assert.equal(s.snapshot(),before);
});
test('positive rows missing from same PDF are not reconstructed as empty',async()=>{const s=await f.seed(),m=models(s);s.removeItem(f.storage.keys.monthlySources);s.setItem(f.storage.keys.holdingSnapshots,JSON.stringify({...m.holdingSnapshots,records:[]}));const before=s.snapshot();assert.equal((await inspect(s)).status,'conflict');assert.equal(s.snapshot(),before);});
test('Backup v15 roundtrip retains repaired references, empty and zero',async()=>{const s=new f.Memory(),p=f.source('a',{zero:true});p.preview.accountObservations.jpyCash='0';await f.pdfService(s).save(p);s.removeItem(f.storage.keys.monthlyAccountInputs);await reimport(s,p);const payload=f.backup(s).build(),dest=new f.Memory(),b=f.backup(dest);assert.equal(payload.backupVersion,16);b.restore.execute(b.format.inspectValue(payload).restorePlan,dest);assert.deepEqual(f.copy(b.build().data),f.copy(payload.data));assert.equal(balance.fixedObservation(models(dest),f.month).components[0].empty,true);assert.equal(balance.resolve(models(dest),f.month).adopted.cashBalance,'0');});
test('public keys and validators remain unchanged; no parser, event or flow rewiring',()=>{
 assert.equal(Object.keys(f.storage.keys).length,12);assert.equal(f.storage.keys.monthlySources,'tradeScopeMonthlySourcesV1');
 const code=fs.readFileSync('import/sbivc-save.js','utf8');assert.doesNotMatch(code,/localStorage\.(?:setItem|removeItem)|netAssetValue:p\.|deposit:p\.|realizedPnl:p\./);
});

class Element{constructor(){this.children=[];this.listeners={};this.dataset={};this.hidden=false;this.open=false;this.textContent='';}append(...a){this.children.push(...a);}replaceChildren(...a){this.children=a;}addEventListener(k,f){this.listeners[k]=f;}showModal(){this.open=true;}close(){this.open=false;}}
const text=e=>[e.textContent,...e.children.map(text)].join(' ');
function ui(service){const elements={},document={getElementById:id=>elements[id]??=new Element(),createElement:()=>new Element()};const api=createUI({document,window:{addEventListener(){}},parser,service:{inspect:(p,m)=>service.inspect({...p,fileSize:128},m),save:(p,g)=>service.save({...p,fileSize:128},g)},hashBytes:async()=> 'a'.repeat(64),extract:async()=>fixture(),viewer:()=>({setSource(){}})});return {api,e:elements};}
test('anonymous DOM healthy same PDF can be explicitly rechecked without a write',async()=>{const s=await f.seed(),h=ui(f.pdfService(s)),before=s.snapshot();await h.api.select(new Blob(['anonymous']));assert.equal(h.e['sbivc-save'].hidden,false);assert.equal(h.e['sbivc-save'].textContent,'再取り込み');h.e['sbivc-save'].listeners.click();await h.e['sbivc-confirm-save'].listeners.click();assert.equal(h.e['sbivc-save-status'].textContent,'保存内容を確認しました');assert.equal(s.snapshot(),before);});
test('anonymous DOM repair completes only after verified save',async()=>{const s=await f.seed();s.removeItem(f.storage.keys.monthlySources);const h=ui(f.pdfService(s));await h.api.select(new Blob(['anonymous']));h.e['sbivc-save'].listeners.click();await h.e['sbivc-confirm-save'].listeners.click();assert.equal(h.e['sbivc-save-status'].textContent,'再取り込みしました');assert.equal(row(s).asset,20126.375);});
test('anonymous DOM current value confirmation is simple and cancellation preserves it',async()=>{const s=await f.seed();manual(s,'cashBalance','5');const h=ui(f.pdfService(s)),before=s.snapshot();await h.api.select(new Blob(['anonymous']));h.e['sbivc-save'].listeners.click();assert.match(text(h.e['sbivc-confirm-summary']),/現在使用中の値があります。今回のPDFで更新しますか/);assert.doesNotMatch(text(h.e['sbivc-confirm-summary']),/candidate|revision|source|採用|stale/);h.e['sbivc-cancel-save'].listeners.click();assert.equal(s.snapshot(),before);h.e['sbivc-save'].listeners.click();await h.e['sbivc-confirm-save'].listeners.click();assert.equal(balance.resolve(models(s),f.month).adopted.cashBalance,'20000');});
test('anonymous DOM stale reimport retains preview and never reports success',async()=>{const s=await f.seed(),h=ui(f.pdfService(s));await h.api.select(new Blob(['anonymous']));h.e['sbivc-save'].listeners.click();manual(s,'cashBalance','5');const before=s.snapshot();await h.e['sbivc-confirm-save'].listeners.click();assert.match(h.e['sbivc-save-status'].textContent,/変更されています/);assert.equal(h.e['sbivc-preview'].hidden,false);assert.equal(s.snapshot(),before);});

test('stale different PDF confirmation cannot downgrade into the legacy save path',async()=>{const s=await f.seed(),p=f.source('b'),g=await inspect(s,p);manual(s,'cashBalance','5');const before=s.snapshot();assert.equal((await f.pdfService(s).save(p,{...g,confirmBalanceUpdate:true})).status,'stale');assert.equal(s.snapshot(),before);});
test('different PDF with manual balance retains source until confirmed',async()=>{const s=await f.seed();manual(s,'cashBalance','5');const p=f.source('b'),before=s.snapshot();await reimport(s,p,false);assert.equal(s.snapshot(),before);await reimport(s,p);assert.equal(balance.resolve(models(s),f.month).adopted.cashBalance,'20000');assert.ok(rows(s,'monthlySources').some(r=>r.sourceType==='manual'));});
test('same PDF explicit source decisions remain stable after successful repair',async()=>{const s=await f.seed();manual(s,'cashBalance','5');await reimport(s);const before=s.snapshot();assert.equal((await inspect(s)).balanceUpdateRequired,false);await reimport(s);assert.equal(s.snapshot(),before);});
test('fixed balance observes overrides but never reported total or collateral',async()=>{const s=await f.seed(),r=candidate(s,'cashBalance');operate(s,{overrides:[{id:'cash_fix',revisionId:r.id,value:'0'}],adoptions:[{revisionId:r.id,overrideId:'cash_fix'}]});assert.equal(row(s).asset,126.375);assert.equal(row(s).components[1].asset,'0');assert.notEqual(row(s).asset,Number(rows(s,'accountSnapshots')[0].assetValue));});
test('current observations do not alter August legacy results',async()=>{const s=await f.seed(),old={2031:{1:{sbivc:{__saved:true,realizedPnL:2,deposit:0,withdrawal:0,unrealizedPnL:3}}}},m=models(s),d=display.create(w.TradeScopeProfitMetrics,old,{2031:{sbivc:100}}, {},m,[account]);const r=d.accountMonth(2031,1,account);assert.equal(r.sourceMonth,'2031-01');assert.equal(r.hasData,true);assert.equal(r.realized,2);assert.deepEqual(r.components,[]);});
test('fixed balance with unknown valuation preserves known cash subtotal',async()=>{const s=await f.seed(),h=core.sourceValue(candidate(s,'holdings'),models(s));h[0].marketValue=null;manual(s,'holdings',h);assert.equal(row(s).asset,20000);assert.equal(row(s).components[0].asset,null);assert.equal(balance.fixedObservation(models(s),f.month).complete,false);});
test('month summary rendering shows balance and missing P/L without internal wording',()=>{const code=fs.readFileSync('profit/soneki.js','utf8'),context=vm.createContext({formatOptionalJPY:v=>v===null?'—':v+'円',optionalSignStyle:()=>''});vm.runInContext(code.slice(code.indexOf('function buildMonthlyCardHtml('),code.indexOf('function renderMonthlyDisplay(')),context);const html=vm.runInContext('buildMonthlyCardHtml(2,{showBalance:true,balance:0})',context);assert.match(html,/月末残高/);assert.match(html,/0円/);assert.match(html,/—/);assert.doesNotMatch(html,/candidate|revision|source|stale|採用/);assert.match(vm.runInContext('buildMonthlyCardHtml(2,{showBalance:true,balance:10,balancePartial:true})',context),/取得済み残高/);});
test('monthly detail renders confirmed empty separately from missing',()=>{const code=fs.readFileSync('profit/soneki.js','utf8'),context=vm.createContext({formatOptionalJPY:v=>v===null?'—':v+'円'});vm.runInContext(code.slice(code.indexOf('function monthlyComponentHtml('),code.indexOf('function hasMonthlyDisplayYear(')),context);const html=vm.runInContext('monthlyComponentHtml({name:"現物保有",asset:"0",unrealized:null,empty:true})',context);assert.match(html,/保有なしを確認済み/);assert.match(html,/0円/);assert.match(html,/—/);});
test('browser import dependency order places balance reader before explicit reimport',()=>{const html=fs.readFileSync('import.html','utf8');assert.ok(html.indexOf('observation-adoption.js')<html.indexOf('sbivc-balance-adoption.js'));assert.ok(html.indexOf('sbivc-balance-adoption.js')<html.indexOf('sbivc-save.js'));assert.match(fs.readFileSync('import/sbivc-preview.js','utf8'),/inspect\(source,\{balanceImport:true\}\)/);});
test('browser-global real import module order can recheck anonymous canonical without side effects',async()=>{
 const s=await f.seed(),before=s.snapshot(),context=vm.createContext({crypto:require('node:crypto').webcrypto,TextEncoder});
 const allowed=new Set(['csv-core','sbivc-transactions-parser','sbivc-parser','storage-transaction','transaction-reconciliation','monthly-source-contract','transaction-source-contract','data-model-storage','monthly-source-service','observation-adoption','sbivc-balance-adoption','sbivc-save']);
 for(const match of fs.readFileSync('import.html','utf8').matchAll(/<script[^>]*src="([^"]+)"/g)){
  const file=match[1].split('?')[0],name=file.split('/').at(-1).replace(/\.js$/,'');if(allowed.has(name))vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
 }
 const api=context.TradeScopeSBIVCSave.createService(s,{clock:()=>f.now}),g=await api.inspect(f.source(),{balanceImport:true});
 assert.equal(g.reimport,true);assert.equal((await api.save(f.source(),g)).balanceVerified,true);assert.equal(s.snapshot(),before);
 assert.equal(context.TradeScopeSBIVCBalanceAdoption.fixedObservation(models(s),f.month).asset,'20126.375');
});
test('Backup v15 retains distinct legacy transaction and corrected balance references',async()=>{
 const s=await f.seed();await reimport(s,f.source('b',{assets:['SOL']}));const payload=f.backup(s).build(),dest=new f.Memory(),b=f.backup(dest),inspection=b.format.inspectValue(payload);
 assert.equal(inspection.ok,true);b.restore.execute(inspection.restorePlan,dest);assert.deepEqual(f.copy(b.build().data),f.copy(payload.data));
 assert.notEqual(balance.resolve(models(dest),f.month).holdingSource.importBatchId,rows(dest,'accountSnapshots').find(a=>a.id===rows(dest,'monthlyAccountInputs')[0].adoptedAccountSnapshotId).importBatchId);
});
