// Synthetic anonymous data only. No production Storage, PDFs or real backups.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto').webcrypto;
const reader=require('../assets/official-fx-position-view.js'),model=require('../assets/data-model-storage.js');
const save=require('../import/traders-save.js'),parser=require('../import/traders-parser.js'),core=require('../assets/monthly-source-contract.js');
const sources=require('../assets/monthly-source-service.js'),scalar=require('../assets/lightfx-scalar-adoption.js');
const {report}=require('./traders-pdf-fixture.js'),{MemoryStorage,now,copy,backupHarness}=require('./gmo-support.js');
const account=b=>b==='lightfx'?'acc_lightfx_fx':'acc_minna_fx',models=s=>model.readModels(s);let sequence=0;
const api=(s,b)=>save.createService(s,b,{clock:()=>now,cryptoApi:crypto});
function source(b,hash='a',month='2026-09',{empty=false}={}){
 const doc=report(b);
 if(empty){doc.pages[0].items=doc.pages[0].items.filter(i=>!(i.y>420&&i.y<470));
  for(const [x,y,value]of [[105,617,'0'],[255,617,'0'],[324,617,'1028']])doc.pages[0].items.find(i=>i.x===x&&i.y===y).text=value;}
 for(const page of doc.pages)for(const item of page.items)item.text=item.text.replaceAll('2026-09',month).replaceAll('2026/09',month.replace('-','/'));
 const preview=parser.parse(doc,b);assert.equal(preview.valid,true);
 if(!empty){preview.positions[0].symbol='TRY/JPY';preview.positions[0].quantity='200000';preview.positions[1].symbol='HUF/JPY';preview.positions[1].quantity='2000000';}
 return {preview,fileHash:hash.repeat(64),fileSize:100,calendarSwap:'13'};
}
async function seed(b){const s=new MemoryStorage({tradingData:'{}',tradeScopeTradeHistoryV1:'[]',tradeScopeMemos:'[]'});await api(s,b).save(source(b));return s;}
async function update(s,b,p){const a=api(s,b);return a.save(p,await a.inspect(p));}
function operate(s,operation){const a=sources.createService(s,{clock:()=>now,newId:()=>`official_test_${++sequence}`});return a.operate(operation,{expectedFingerprint:a.inspect().fingerprint});}
function adoptManual(s,b,metric,month='2026-09'){
 const id=`manual_${++sequence}`,r=core.descriptor({accountId:account(b),targetMonth:month,asOf:month+'-30'},metric,'9',{id,sourceId:id,sourceType:'manual'});
 operate(s,{sources:[r],adoptions:[{revisionId:id}]});
}
const official=(s,b)=>reader.resolve(models(s),b);
const fixtureRow={accountId:'acc_lightfx_fx',provider:'lightfx',instrumentId:'instrument',symbol:'TRY/JPY',baseCurrency:'TRY',quoteCurrency:'JPY',side:'buy',quantityUnit:'reportedQuantity',quantity:'1',acquisitionPrice:'4',marketPrice:'5',unrealizedPnl:'-1',unsettledSwap:'2',requiredMargin:'3',snapshotAsOf:'2026-09-30',targetMonth:'2026-09'};
for(const b of ['lightfx','minano']){
 test(`${b}: active PDF returns full raw official rows and provenance`,async()=>{
  const s=await seed(b),m=models(s),view=official(s,b);assert.equal(view.status,'official');assert.equal(view.holdings.length,2);assert.equal(view.hasOfficialSource,true);
  assert.equal(view.sourceMonth,'2026-09');assert.equal(view.targetMonth,'2026-09');assert.equal(view.snapshotAsOf,'2026-09-30');assert.equal(view.confirmedEmpty,false);
  for(const row of view.holdings){const raw=m.holdingSnapshots.records.find(h=>h.id===row.holdingSnapshotId);
   for(const field of ['quantity','acquisitionPrice','marketPrice','unrealizedPnl'])assert.equal(row[field],raw[field]);
   for(const [field,rawField]of [['side','side'],['quantityUnit','quantityUnit'],['unsettledSwap','unsettledSwap'],['requiredMargin','requiredMargin'],['executedAt','executedAt'],['sourceOrderRef','orderId']])assert.equal(row[field],raw.fxPosition[rawField]);
   assert.equal(row.accountId,account(b));assert.equal(row.accountSnapshotId,view.accountSnapshotId);assert.equal(row.importBatchId,view.importBatchId);
  }
 });
 test(`${b}: saved parser section and known Snapshot lineage prove confirmed empty`,async()=>{
  const s=new MemoryStorage(),p=source(b,'a','2026-09',{empty:true});assert.equal(p.preview.positions.length,0);await api(s,b).save(p);
  const v=official(s,b);assert.equal(v.status,'official');assert.equal(v.confirmedEmpty,true);assert.deepEqual(v.holdings,[]);assert.deepEqual(reader.project(v),[]);
 });
 test(`${b}: missing source is legacy, never confirmed zero`,()=>{
  const m=models(new MemoryStorage()),v=reader.resolve(m,b);assert.equal(v.status,'legacy');assert.equal(v.hasOfficialSource,false);assert.equal(v.confirmedEmpty,false);assert.deepEqual(v.holdings,[]);
 });
 test(`${b}: real current selection overrides import order and old holdings stay hidden`,async()=>{
  const s=await seed(b),old=models(s),p=source(b,'b');p.preview.positions[0].quantity='300000';await update(s,b,p);const m=models(s),v=official(s,b);
  assert.equal(m.holdingSnapshots.records.length,4);assert.deepEqual(m.holdingSnapshots.records.slice(0,2),old.holdingSnapshots.records);
  assert.equal(v.holdings[0].quantity,'300000');assert.ok(v.holdings.every(h=>h.accountSnapshotId===m.accountSnapshots.records[1].id));
  m.accountSnapshots.records.reverse();m.holdingSnapshots.records.reverse();assert.equal(reader.resolve(m,b).accountSnapshotId,v.accountSnapshotId);
 });
 test(`${b}: same PDF canonical reuse yields no duplicate positions or writes`,async()=>{
  const s=await seed(b),old=s.snapshot(),writes=s.writes,before=official(s,b);await api(s,b).save(source(b));assert.deepEqual(official(s,b),before);assert.deepEqual(s.snapshot(),old);assert.equal(s.writes,writes);
 });
 test(`${b}: current keeps actual source month; fixed missing month never carries`,async()=>{
  const s=await seed(b);assert.equal(official(s,b).sourceMonth,'2026-09');const missing=reader.resolve(models(s),b,{targetMonth:'2026-10'});
  assert.equal(missing.status,'unknown');assert.equal(missing.targetMonth,'2026-10');assert.equal(missing.sourceMonth,null);assert.equal(missing.confirmedEmpty,false);assert.deepEqual(missing.holdings,[]);
 });
 test(`${b}: latest selected month is used, not last imported row`,async()=>{
  const s=await seed(b);await api(s,b).save(source(b,'b','2026-10'));const v=official(s,b);assert.equal(v.sourceMonth,'2026-10');assert.equal(v.snapshotAsOf,'2026-10-31');
  const fixed=reader.resolve(models(s),b,{targetMonth:'2026-09'});assert.equal(fixed.sourceMonth,'2026-09');assert.notEqual(fixed.accountSnapshotId,v.accountSnapshotId);
 });
 test(`${b}: unselected future PDF candidate does not replace active observation`,async()=>{
  const s=await seed(b);await api(s,b).save(source(b,'b','2026-10'));const m=models(s);
  for(const entity of ['monthlyAccountInputs','monthlyAccountStates'])m[entity].records=m[entity].records.filter(r=>r.targetMonth!=='2026-10');
  assert.equal(reader.resolve(m,b).sourceMonth,'2026-09');
 });
 for(const metric of ['marketValue','unrealizedPnl'])test(`${b}: adopted manual ${metric} makes official positions unknown, not legacy`,async()=>{
  const s=await seed(b);adoptManual(s,b,metric);const v=official(s,b);assert.equal(v.status,'unknown');assert.equal(v.hasOfficialSource,true);assert.equal(v.confirmedEmpty,false);assert.deepEqual(v.holdings,[]);
  assert.deepEqual(reader.legacyEntries([{account:account(b)},{account:'GMO'}],[v]),[{account:'GMO'}]);
 });
 test(`${b}: latest manual month never silently falls back to previous official month`,async()=>{
  const s=await seed(b);adoptManual(s,b,'marketValue','2026-10');assert.equal(official(s,b).status,'unknown');assert.equal(official(s,b).targetMonth,'2026-10');
  assert.equal(reader.resolve(models(s),b,{targetMonth:'2026-09'}).status,'official');
 });
 test(`${b}: independently selected different PDF metrics cannot choose a position set`,async()=>{
  const s=await seed(b);await update(s,b,source(b,'b'));const m=models(s),old=m.monthlySources.records.find(r=>r.kind==='source'&&r.metric==='unrealizedPnl');
  operate(s,{adoptions:[{revisionId:old.id}]});assert.equal(official(s,b).status,'unknown');assert.deepEqual(official(s,b).holdings,[]);
 });
 test(`${b}: source-specific scalar override does not alter official raw position facts`,async()=>{
  const s=await seed(b),m=models(s),r=m.monthlySources.records.find(r=>r.metric==='unrealizedPnl');
  operate(s,{overrides:[{id:'scalar_override',revisionId:r.id,value:'-999'}],adoptions:[{revisionId:r.id,overrideId:'scalar_override'}]});
  assert.equal(official(s,b).status,'official');assert.equal(official(s,b).holdings[0].unrealizedPnl,'-10');
 });
 test(`${b}: native historical source reference selects its original Snapshot, not mutable pointer`,async()=>{
  const s=await seed(b),m=models(s),record=m.monthlyAccountInputs.records[0],r=core.descriptor({accountId:account(b),targetMonth:'2026-09',asOf:'2026-09-30'},'unrealizedPnl',null,
   {id:'historical_native',sourceId:'historical_native',sourceType:'pdf',reference:{entity:'monthlyAccountInputs',id:record.id,field:'sourceValues.unrealizedPnl',sourceScope:scalar.forBroker(b).resolve(m,'2026-09').metrics[1].source.reference.sourceScope}});
  operate(s,{sources:[r],adoptions:[{revisionId:r.id}]});await update(s,b,source(b,'b'));
  const rawOld=models(s).monthlySources.records.find(v=>v.kind==='source'&&v.metric==='marketValue');operate(s,{adoptions:[{revisionId:r.id},{revisionId:rawOld.id}]});
  assert.equal(official(s,b).accountSnapshotId,m.accountSnapshots.records[0].id);
 });
 for(const [name,mutate]of [
  ['missing Snapshot',m=>m.accountSnapshots.records=[]],['missing Batch',m=>m.importBatches.records=[]],
  ['holding account mismatch',m=>m.holdingSnapshots.records[0].accountId='acc_gmo_fx'],
  ['holding Batch mismatch',m=>m.holdingSnapshots.records[0].importBatchId='absent'],
  ['holding Snapshot mismatch',m=>m.holdingSnapshots.records[0].accountSnapshotId='absent'],
  ['holding target month mismatch',m=>m.holdingSnapshots.records[0].targetMonth='2026-10'],
  ['provider mismatch',m=>m.importBatches.records[0].sourceProvider='gmo'],
  ['Batch target month mismatch',m=>m.importBatches.records[0].targetMonth='2026-10'],
  ['basis date mismatch',m=>m.accountSnapshots.records[0].snapshotAsOf='2026-09-29'],
  ['unknown importer version',m=>m.importBatches.records[0].importerVersion='unknown-v99'],
  ['missing importer lineage',m=>delete m.importBatches.records[0].importerId],
  ['duplicate order reference',m=>m.holdingSnapshots.records[1].fxPosition.orderId=m.holdingSnapshots.records[0].fxPosition.orderId],
  ['missing member',m=>m.holdingSnapshots.records.pop()],
  ['invalid price',m=>m.holdingSnapshots.records[0].marketPrice='0']
 ])test(`${b}: ${name} fails closed and suppresses manual fallback`,async()=>{
  const s=await seed(b),m=models(s);mutate(m);const v=reader.resolve(m,b);assert.equal(v.status,'unknown');assert.equal(v.confirmedEmpty,false);assert.deepEqual(v.holdings,[]);
  assert.deepEqual(reader.legacyEntries([{account:account(b)},{account:'GMO'}],[v]),[{account:'GMO'}]);
 });
 test(`${b}: zero holding count alone is not evidence of empty`,async()=>{
  const s=await seed(b),m=models(s);m.holdingSnapshots.records=[];m.accountSnapshots.records[0].unrealizedPnl='0';Object.assign(m.accountSnapshots.records[0].accountSpecific,{monthEndUnsettledSwap:'0',reportedAccountEvaluationPnl:'0'});m.accountSnapshots.records[0].netAssetValue='1028';
  assert.equal(reader.resolve(m,b).status,'unknown');assert.equal(reader.resolve(m,b).confirmedEmpty,false);
 });
 test(`${b}: stale compatibility source never becomes normal official observation`,async()=>{
  const s=await seed(b),m=models(s);m.accountSnapshots.records[0].cashBalance='1038';m.accountSnapshots.records[0].netAssetValue='1016';
  assert.equal(reader.resolve(m,b).status,'unknown');
 });
 test(`${b}: broken adoption chain and conflicting heads never fallback`,async()=>{
  const s=await seed(b),r=models(s).monthlySources.records.find(r=>r.metric==='marketValue');operate(s,{adoptions:[{revisionId:r.id}]});
  for(const mutate of [m=>m.monthlySources.records.find(v=>v.kind==='adoption').revisionId='absent',m=>{const d=m.monthlySources.records.find(v=>v.kind==='adoption');m.monthlySources=core.envelope([...m.monthlySources.records,{...d,id:'conflicting_head'}],now);}]){
   const m=models(s);mutate(m);assert.equal(reader.resolve(m,b).status,'unknown');
  }
 });
 test(`${b}: transaction-only ImportBatch never activates official position path`,()=>{
  const m=models(new MemoryStorage()),provider=b==='lightfx'?'lightfx':'minna';m.accounts={schemaVersion:1,records:model.initialAccounts().filter(a=>a.id===account(b)),updatedAt:now};
  m.importBatches={schemaVersion:1,records:[{id:'transaction_only',accountId:account(b),sourceType:'pdf',sourceProvider:provider,targetMonth:'2025-04',snapshotAsOf:'2025-04-30',importedAt:now,importerId:provider+'-executions',importerVersion:'traders-monthly-v1',sourceFileMetadata:{hash:'a'.repeat(64),size:100}}],updatedAt:now};
  assert.equal(reader.resolve(m,b).status,'legacy');assert.equal(reader.legacyEntries([{account:account(b)}],[reader.resolve(m,b)]).length,1);
 });
 test(`${b}: transaction-first shared Batch with balance observation is complete lineage`,async()=>{
  const s=await seed(b),m=models(s);m.importBatches.records[0].importerId=(b==='lightfx'?'lightfx':'minna')+'-executions';m.monthlySources=null;
  assert.equal(reader.resolve(m,b).status,'official');
 });
 test(`${b}: display-only Lot conversion uses existing TRY/HUF rules`,async()=>{
  const s=await seed(b),v=official(s,b),rows=reader.project(v);assert.deepEqual(rows.map(r=>r.quantityLabel),['20 Lot','20 Lot']);assert.deepEqual(v.holdings.map(h=>h.quantity),['200000','2000000']);assert.ok(v.holdings.every(h=>h.quantityUnit==='reportedQuantity'));
 });
 test(`${b}: same account/instrument/side aggregation preserves all individual holdings`,async()=>{
  const s=new MemoryStorage(),p=source(b);Object.assign(p.preview.positions[0],{acquisitionPrice:'4'});Object.assign(p.preview.positions[1],{symbol:'TRY/JPY',quantity:'100000',acquisitionPrice:'7'});await api(s,b).save(p);
  const v=official(s,b),r=reader.project(v);assert.equal(r.length,1);assert.equal(r[0].quantity,'300000');assert.equal(r[0].acquisitionPrice,'5');assert.equal(r[0].unrealizedPnl,'-30');assert.equal(r[0].unsettledSwap,'8');assert.equal(r[0].requiredMargin,'50');assert.equal(r[0].holdings.length,2);assert.equal(v.holdings.length,2);
 });
 test(`${b}: buy and sell never net or average together`,async()=>{
  const s=new MemoryStorage(),p=source(b);p.preview.positions[1].symbol='TRY/JPY';p.preview.positions[1].side='sell';await api(s,b).save(p);assert.deepEqual(reader.project(official(s,b)).map(r=>r.side),['buy','sell']);
 });
 test(`${b}: inconsistent evaluation rates are unavailable, never averaged`,async()=>{
  const s=new MemoryStorage(),p=source(b);p.preview.positions[1].symbol='TRY/JPY';p.preview.positions[1].marketPrice='9';await api(s,b).save(p);const row=reader.project(official(s,b))[0];assert.equal(row.marketPrice,null);assert.equal(row.marketPriceConflict,true);assert.equal(row.holdings[1].marketPrice,'9');
 });
 test(`${b}: read/projection is detached and Storage/Backup byte-identical`,async()=>{
  const s=await seed(b),m=models(s),before=s.snapshot(),writes=s.writes,payload=backupHarness().TradeScopeBackupExport.buildPayload(s,'http://localhost',now),json=JSON.stringify(m);
  const v=reader.resolve(m,b),projection=reader.project(v);projection[0].holdings[0].quantity='999';v.holdings[0].marketPrice='999';assert.equal(JSON.stringify(m),json);assert.deepEqual(s.snapshot(),before);assert.equal(s.writes,writes);assert.deepEqual(copy(backupHarness().TradeScopeBackupExport.buildPayload(s,'http://localhost',now)),copy(payload));
 });
 test(`${b}: v15 and v14 roundtrip preserve official set without new records`,async()=>{
  const s=await seed(b);await update(s,b,source(b,'b'));const h=backupHarness(),payload=h.TradeScopeBackupExport.buildPayload(s,'http://localhost',now);
  for(const version of [15,14]){const p=copy(payload);p.backupVersion=version;if(version===14)delete p.data.models.transactionSources;const info=h.TradeScopeBackupFormat.inspectValue(p);assert.equal(info.ok,true);const dest=new MemoryStorage();h.TradeScopeBackupRestore.execute(info.restorePlan,dest);assert.deepEqual(official(dest,b),official(s,b));}
 });
 test(`${b}: huge and leading-zero order references remain exact strings, not UI identity`,async()=>{
  const s=new MemoryStorage(),p=source(b),id='000123456789012345678901234567890123456789';p.preview.positions[0].orderId=id;await api(s,b).save(p);
  assert.equal(official(s,b).holdings[0].sourceOrderRef,id);assert.equal(typeof official(s,b).holdings[0].sourceOrderRef,'string');
  const h=render(s);assert.doesNotMatch(h.elements.openPositionsBody.innerHTML,new RegExp(id));
 });
 test(`${b}: official positions do not require completed calendar or period calculation`,async()=>{
  const s=new MemoryStorage(),p=source(b);p.calendarSwap='';await api(s,b).save(p);assert.equal(models(s).monthlyAccountStates,null);assert.equal(official(s,b).status,'official');
 });
 test(`${b}: once official observations exist, removing current decisions cannot revive manual positions`,async()=>{
  const s=await seed(b),m=models(s);m.monthlyAccountInputs=null;m.monthlyAccountStates=null;m.monthlySources=null;
  const v=reader.resolve(m,b);assert.equal(v.status,'unknown');assert.equal(v.hasOfficialSource,true);assert.deepEqual(reader.legacyEntries([{account:account(b)}],[v]),[]);
 });
 test(`${b}: latest confirmed empty never resurrects earlier month holdings`,async()=>{
  const s=await seed(b);await api(s,b).save(source(b,'b','2026-10',{empty:true}));const v=official(s,b);assert.equal(v.sourceMonth,'2026-10');assert.equal(v.confirmedEmpty,true);assert.deepEqual(v.holdings,[]);
  assert.equal(reader.resolve(models(s),b,{targetMonth:'2026-09'}).holdings.length,2);
 });
}
test('invalid provider/month request is rejected, not silently guessed',()=>{assert.throws(()=>reader.resolve({},'gmo'));assert.throws(()=>reader.resolve({},'minna'));assert.throws(()=>reader.resolve({},'lightfx',{targetMonth:'2026-99'}));});
test('unknown pair keeps raw currency quantity; no speculative Lot conversion',()=>{const v={status:'official',sourceMonth:'2026-09',holdings:[{...fixtureRow,symbol:'AAA/JPY',baseCurrency:'AAA',quantity:'200000.123456789012345678'}]},r=reader.project(v)[0];assert.equal(r.displayLots,null);assert.equal(r.quantityLabel,'200,000.123456789012345678 AAA');});
test('weighted decimal mean and original precision avoid binary floating point',()=>{const v={status:'official',sourceMonth:'2026-09',holdings:[{...fixtureRow,quantity:'1',acquisitionPrice:'0.1'},{...fixtureRow,quantity:'2',acquisitionPrice:'0.2'}]},r=reader.project(v)[0];assert.equal(r.acquisitionPrice,'0.166666666666666667');assert.equal(v.holdings[0].acquisitionPrice,'0.1');});
test('all broker aliases suppressed only when their official path exists',()=>{
 const entries=['LIGHT FX','Light FX','lightfx','acc_lightfx_fx','minano','minna','みんなのFX','acc_minna_fx','GMO','SBI','SBI VC'].map(account=>({account}));
 const views=reader.accounts(models(new MemoryStorage()));assert.deepEqual(reader.legacyEntries(entries,views),entries);
 assert.deepEqual(reader.legacyEntries(entries,views.map(v=>({...v,status:'unknown'}))).map(e=>e.account),['GMO','SBI','SBI VC']);
});
test('reader has no transaction reader or write path; financial/Portfolio consumers stay independent',()=>{
 const code=fs.readFileSync('assets/official-fx-position-view.js','utf8');assert.doesNotMatch(code,/localStorage|setItem\(|removeItem\(|\.commit\(|fetch\(|console\.|transaction-adoption|transaction-view|importedTransactions|parseExecutions/);
 for(const file of ['top/script.js','profit/soneki.js','assets/current-asset-view.js','assets/balance-view.js','assets/transaction-view.js','assets/trade-history-core.js','assets/open-positions-view.js'])assert.doesNotMatch(fs.readFileSync(file,'utf8'),/official-fx-position|OfficialFXPosition/);
 assert.equal(Object.keys(model.keys).length,12);assert.equal(model.backupModelEntities[15].length,12);
});
const manualEntries=[['Light FX','MANUAL/JPY'],['みんなのFX','MANUAL/JPY'],['GMO','USD/JPY']].map(([account,symbol],i)=>({id:'anonymous_manual_'+i,date:'2026-09-01',account,symbol,assetType:'FX',category:'new',side:'buy',quantity:99,rate:3,strategy:'キャリー',memo:'anonymous note'}));
function render(s,{mode='merged',entries=manualEntries,missingModule=false}={}){
 const elements=Object.fromEntries(['openPositionsBody','openPositionsSummary','openPositionsPrimaryHeader','openPositionsValuationHeader','openPositionDetail','openPositionsSourceStatus'].map(id=>[id,{hidden:true,textContent:'',innerHTML:'',querySelectorAll:()=>[]}]));
 const context=vm.createContext({window:{TradeScopeOpenPositionsView:require('../assets/open-positions-view.js'),TradeScopeOfficialFXPositionView:missingModule?undefined:reader,TradeScopeTransactionDisplay:require('../assets/transaction-display.js'),TradeScopeDataStorage:model},
  localStorage:s,document:{getElementById:id=>elements[id]},openPositionsView:mode,displayAccountName:require('../assets/account-ui.js').displayAccountName});
 vm.runInContext(fs.readFileSync('assets/trade-history-core.js','utf8'),context);context.historyCore=context.window.TradeScopeHistory;
 const text=fs.readFileSync('history/history.js','utf8');
 for(const [start,end]of [['function escapeHtml','function openDrawer'],['function fmtJPY','function toOptionHtml'],['function aggregateOpenPositions','// ===== Close Position Modal'],['function renderOpenPositionDetail','function renderHistoryTable']])vm.runInContext(text.slice(text.indexOf(start),text.indexOf(end)),context);
 context.entries=entries;vm.runInContext('renderOpenPositions(entries)',context);return {elements,context};
}
for(const b of ['lightfx','minano'])for(const mode of ['merged','account'])test(`${b} ${mode}: anonymous UI uses official rows, raw precision and basis date, no manual duplicate`,async()=>{
 const s=await seed(b),old=s.snapshot(),entries=copy(manualEntries),h=render(s,{mode,entries}),html=h.elements.openPositionsBody.innerHTML;
 assert.match(html,/TRY\/JPY/);assert.match(html,/HUF\/JPY/);assert.match(html,/20 Lot/);assert.match(html,/09\/30時点/);assert.match(html,/平均建値/);assert.match(html,/評価損益/);
 assert.ok(!html.includes('data-close-position-index="'+(html.includes('LIGHT FX')?'2':'3')+'"'));
 assert.doesNotMatch(html,/holdingSnapshotId|schemaVersion|candidate|revision|sourceOrderRef|collection|source fingerprint/);
 assert.equal(h.elements.openPositionsValuationHeader.textContent,'評価額 / 損益');assert.deepEqual(entries,manualEntries);assert.deepEqual(s.snapshot(),old);
 const grouped=reader.project(official(s,b))[0];h.context.position=grouped;vm.runInContext('renderOpenPositionDetail(position)',h.context);
 const detail=h.elements.openPositionDetail.innerHTML;for(const label of ['平均建値','評価レート','未決済スワップ','必要証拠金','2026-09-30'])assert.ok(detail.includes(label));
 assert.doesNotMatch(detail,/現在価格|注文番号|accountSnapshotId/);assert.deepEqual(s.snapshot(),old);
});
for(const b of ['lightfx','minano'])test(`${b}: explicit empty and unknown are distinct in anonymous UI`,async()=>{
 const s=await seed(b);await update(s,b,source(b,'b','2026-09',{empty:true}));const entries=manualEntries.filter(e=>e.account===(b==='lightfx'?'Light FX':'みんなのFX'));
 const empty=render(s,{entries});assert.match(empty.elements.openPositionsSourceStatus.textContent,/建玉なし（09\/30時点）/);assert.doesNotMatch(empty.elements.openPositionsBody.innerHTML,/MANUAL/);
 assert.match(empty.elements.openPositionsSummary.textContent,/ありません/);
 adoptManual(s,b,'marketValue');const unknown=render(s,{entries});assert.match(unknown.elements.openPositionsSourceStatus.textContent,/未確認/);assert.match(unknown.elements.openPositionsBody.innerHTML,/未確認/);assert.doesNotMatch(unknown.elements.openPositionsBody.innerHTML,/MANUAL|建玉がありません/);
});
for(const b of ['lightfx','minano'])test(`${b}: reread switches official rows and hides old expanded revision details`,async()=>{
 const s=await seed(b),h=render(s);h.context.position=reader.project(official(s,b))[0];vm.runInContext('renderOpenPositionDetail(position)',h.context);assert.equal(h.elements.openPositionDetail.hidden,false);
 const p=source(b,'b');p.preview.positions[0].quantity='300000';await update(s,b,p);vm.runInContext('renderOpenPositions(entries)',h.context);
 assert.match(h.elements.openPositionsBody.innerHTML,/30 Lot/);assert.equal(h.elements.openPositionDetail.hidden,true);
});
test('legacy LIGHT/Minna manual Open Positions and GMO are maintained without official sources',()=>{
 const s=new MemoryStorage(),before=s.snapshot(),h=render(s);assert.match(h.elements.openPositionsBody.innerHTML,/MANUAL\/JPY/);assert.match(h.elements.openPositionsBody.innerHTML,/USD\/JPY/);
 assert.equal(h.elements.openPositionsSourceStatus.hidden,true);assert.deepEqual(s.snapshot(),before);
});
test('both official accounts plus SBI VC remain separate; GMO legacy and close action unaffected',async()=>{
 const obs=require('./observation-override-fixture.js'),s=await obs.seed();await api(s,'lightfx').save(source('lightfx'));await api(s,'minano').save(source('minano','b'));
 const old=s.snapshot(),entries=[...manualEntries,{account:'SBI VC',assetType:'暗号資産',symbol:'FAKE/JPY',quantity:99,rate:8,side:'buy',category:'new',date:'2026-09-01'}];
 const h=render(s,{entries}),html=h.elements.openPositionsBody.innerHTML;assert.match(html,/LIGHT FX/);assert.match(html,/みんなのFX/);assert.match(html,/SBI VC/);assert.match(html,/BTC\/JPY/);assert.match(html,/USD\/JPY/);assert.doesNotMatch(html,/MANUAL|FAKE/);
 assert.equal((html.match(/data-close-position-index=/g)||[]).length,1);assert.equal((html.match(/TRY\/JPY/g)||[]).length,2);assert.equal(s.snapshot(),old);
});
test('broken canonical Storage or missing reader script cannot resurrect manual FX positions',async()=>{
 const s=await seed('lightfx');s.setItem(model.keys.accountSnapshots,'{');const broken=render(s);assert.doesNotMatch(broken.elements.openPositionsBody.innerHTML,/MANUAL/);assert.match(broken.elements.openPositionsSourceStatus.textContent,/未確認/);assert.match(broken.elements.openPositionsBody.innerHTML,/USD\/JPY/);
 const missing=render(new MemoryStorage(),{missingModule:true});assert.doesNotMatch(missing.elements.openPositionsBody.innerHTML,/MANUAL/);assert.match(missing.elements.openPositionsSourceStatus.textContent,/未確認/);
});
test('position rendering leaves existing manual Risk and transaction History calculations unchanged',async()=>{
 const s=await seed('lightfx');await api(s,'minano').save(source('minano','b'));const h=render(s),risk=copy(h.context.historyCore.calculateRiskSummary(manualEntries)),tx=require('../assets/transaction-view.js');
 const before=copy(tx.resolve(manualEntries,models(s))),m=JSON.stringify(models(s)),entries=copy(manualEntries);render(s);assert.equal(JSON.stringify(models(s)),m);assert.deepEqual(entries,manualEntries);
 assert.deepEqual(copy(h.context.historyCore.calculateRiskSummary(manualEntries)),risk);assert.deepEqual(copy(tx.resolve(manualEntries,models(s))),before);
});
test('only history loads official reader, with exact dependencies and visible mobile basis label',()=>{
 const html=fs.readFileSync('history.html','utf8'),css=fs.readFileSync('history/history.css','utf8');for(const dependency of ['data-model-storage.js','monthly-source-contract.js','lightfx-scalar-adoption.js','transaction-display.js'])assert.ok(html.indexOf(dependency)<html.indexOf('official-fx-position-view.js'));
 assert.ok(html.indexOf('official-fx-position-view.js')<html.indexOf('history/history.js'));for(const file of ['index.html','profit/soneki.html','import.html'])assert.doesNotMatch(fs.readFileSync(file,'utf8'),/official-fx-position-view/);
 assert.match(css,/\.official-position-basis \{ display: block;/);assert.doesNotMatch(css,/\.official-position-basis[^}]*display:\s*none/);
});
test('production HTML dependency order initializes reader in browser-global VM without console or writes',async()=>{
 const s=await seed('lightfx');await api(s,'minano').save(source('minano','b'));const old=s.snapshot();
 const context=vm.createContext({TextEncoder,console:{error:()=>assert.fail('console error'),warn:()=>assert.fail('console warning')}});
 const names=new Set(['csv-core.js','storage-transaction.js','transaction-reconciliation.js','monthly-source-contract.js','transaction-source-contract.js','data-model-storage.js','transaction-display.js','lightfx-scalar-adoption.js','official-fx-position-view.js']);
 for(const m of fs.readFileSync('history.html','utf8').matchAll(/<script[^>]*src="([^"]+)"/g)){const file=m[1].split('?')[0];if(names.has(file.split('/').at(-1)))vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});}
 context.json=JSON.stringify(models(s));const result=vm.runInContext('TradeScopeOfficialFXPositionView.accounts(JSON.parse(json))',context);
 assert.deepEqual(Array.from(result,v=>v.status),['official','official']);assert.deepEqual(s.snapshot(),old);
});
test('cross-tab/BFCache refresh updates only positions; unsaved forms and History are untouched',()=>{
 const listeners={},documentListeners={},draft={value:'unsaved manual memo'},calls=[];
 const context=vm.createContext({window:{addEventListener:(name,fn)=>listeners[name]=fn},document:{getElementById:()=>draft,visibilityState:'visible',addEventListener:(name,fn)=>documentListeners[name]=fn},
  historyCore:{parseEntries:()=>manualEntries},transactionHistory:{},renderOpenPositions:entries=>calls.push(entries)});
 const text=fs.readFileSync('history/history.js','utf8');vm.runInContext(text.slice(text.indexOf('const officialPositionKeys'),text.indexOf('// Read-only History refresh:')),context);
 for(const key of [model.keys.accountSnapshots,model.keys.holdingSnapshots,model.keys.monthlySources,'tradeScopeRestoreJournalV1',null])listeners.storage({key});
 assert.equal(calls.length,5);listeners.storage({key:model.keys.importedTransactions});assert.equal(calls.length,5);
 listeners.pageshow({persisted:true});documentListeners.visibilitychange();assert.equal(calls.length,7);assert.equal(draft.value,'unsaved manual memo');
});
test('pending Repository journal cannot expose transient official or manual FX rows',async()=>{
 const s=await seed('lightfx');s.setItem('tradeScopeRestoreJournalV1','pending anonymous commit');const h=render(s);
 assert.doesNotMatch(h.elements.openPositionsBody.innerHTML,/TRY\/JPY|MANUAL/);assert.match(h.elements.openPositionsSourceStatus.textContent,/未確認/);
});
