// Anonymous synthetic Storage only. Never opens user PDFs, backups or browser Storage.
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto').webcrypto;
const native=require('../import/traders-save.js'),parser=require('../import/traders-parser.js');
const model=require('../assets/data-model-storage.js'),core=require('../assets/monthly-source-contract.js');
const sources=require('../assets/monthly-source-service.js'),resolver=require('../assets/monthly-account-resolver.js');
const scalar=require('../assets/lightfx-scalar-adoption.js'),progress=require('../assets/monthly-progress-view.js');
const journal=require('../assets/storage-transaction.js'),{report}=require('./traders-pdf-fixture.js');
const {MemoryStorage,now,copy,backupHarness}=require('./gmo-support.js');
const month='2026-09',read=s=>model.readModels(s);let sequence=0;
const service=(s,b,options={})=>native.createService(s,b,{clock:()=>now,cryptoApi:crypto,...options});
function input(b,hash='a',revised=false){
 const doc=report(b);
 if(revised)for(const [x,y,text]of [[36,617,'1058'],[255,617,'-42'],[324,617,'1016'],[487,463,'-30'],[332,535,'30'],[139,320,'30'],[349,320,'40'],[485,320,'1075'],[349,304,'-17'],[485,304,'1058']])doc.pages[0].items.find(i=>i.x===x&&i.y===y).text=text;
 const preview=parser.parse(doc,b);assert.equal(preview.valid,true);
 return {preview,fileHash:hash.repeat(64),fileSize:100,calendarSwap:'13'};
}
const account=b=>scalar.forBroker(b).accountId,scope=b=>resolver.policies[b].sourceScope;
const resolved=(s,b)=>resolver.resolve(read(s),{},month,b);
async function seed(b){const s=new MemoryStorage({tradingData:'{}',tradeScopeTradeHistoryV1:'[]',memo:'anonymous note',strategy:'manual strategy'});await service(s,b).save(input(b));return s;}
async function update(s,b,source=input(b,'b',true),options={}){const api=service(s,b,options),guard=await api.inspect(source);return api.save(source,guard);}
function operate(s,operation){const api=sources.createService(s,{clock:()=>now,newId:()=>`reimport_test_${++sequence}`});return api.operate(operation,{expectedFingerprint:api.inspect().fingerprint});}
function reference(s,b,metric,entity='monthlyAccountInputs'){
 const m=read(s),record=m[entity].records[0];
 const r=core.descriptor({accountId:account(b),targetMonth:month,asOf:'2026-09-30'},metric,null,
  {id:`old_reference_${++sequence}`,sourceId:`old_source_${sequence}`,sourceType:'pdf',reference:{entity,id:record.id,field:'sourceValues.'+metric,sourceScope:scope(b)}});
 operate(s,{sources:[r],adoptions:[{revisionId:r.id}]});return read(s).monthlySources.records.find(v=>v.id===r.id);
}
function manual(s,b,metric,value){const id=`independent_${++sequence}`,r=core.descriptor({accountId:account(b),targetMonth:month,asOf:'2026-09-30'},metric,value,{id,sourceId:id,sourceType:'manual'});operate(s,{sources:[r],adoptions:[{revisionId:id}]});return id;}
for(const b of ['lightfx','minano']){
 test(`${b}: five PDF metrics switch only after explicit confirmation`,async()=>{
  const s=await seed(b),api=service(s,b),p=input(b,'b',true),before=s.snapshot(),guard=await api.inspect(p);
  assert.equal(guard.status,'review-required');assert.equal((await api.save(p)).status,'review-required');assert.deepEqual(s.snapshot(),before);
  assert.equal((await api.save(p,guard)).verified,true);const r=resolved(s,b);
  assert.deepEqual([r.observedAsset,r.unrealizedPnl,r.realizedPnl,r.deposit,r.withdrawal],['1016','-50','30','40','17']);
  const m=read(s),snapshot=m.accountSnapshots.records[1];
  assert.equal(m.monthlyAccountInputs.records[0].adoptedAccountSnapshotId,snapshot.id);
  assert.equal(m.monthlyAccountStates.records[0].adoptedAccountSnapshotId,snapshot.id);
  assert.ok(scalar.forBroker(b).resolve(m,month).metrics.every(r=>r.source.reference.id===snapshot.id));
 });
 test(`${b}: calendar/manual/memo/other accounts and transaction stores retained`,async()=>{
  const s=await seed(b),api=service(s,b),p=api.monthlyInspect(month);api.correct({targetMonth:month,...p.adopted,swapPnl:'-19'});
  const old=s.snapshot();await update(s,b);assert.equal(resolved(s,b).swapPnl,'-19');
  assert.equal(read(s).monthlyAccountInputs.records[0].sourceValues.swapPnl,'13');
  for(const k of ['memo','strategy','tradingData','tradeScopeTradeHistoryV1',model.keys.importedTransactions,model.keys.transactionSources,model.keys.transactionReconciliations])assert.equal(s.getItem(k),old[k]??null);
  assert.equal(read(s).accounts.records.length,1);
 });
 test(`${b}: old raw records and source-specific corrections remain only in history`,async()=>{
  const s=await seed(b),api=service(s,b),p=api.monthlyInspect(month);api.correct({targetMonth:month,...p.adopted,realizedPnl:'90',deposit:'99',withdrawal:'8',unrealizedPnl:'-2'});
  const old=read(s);await update(s,b);const m=read(s),next=m.monthlyAccountInputs.records[0];
  assert.deepEqual(m.accountSnapshots.records[0],old.accountSnapshots.records[0]);assert.deepEqual(m.holdingSnapshots.records.slice(0,2),old.holdingSnapshots.records);
  assert.deepEqual(next.sourceHistory.at(-1).adoptedValues,old.monthlyAccountInputs.records[0].adoptedValues);
  assert.deepEqual(next.overrideFields,[]);assert.equal(resolved(s,b).realizedPnl,'30');
 });
 test(`${b}: healthy same PDF reread is zero-write, zero duplicate`,async()=>{
  const s=await seed(b),before=s.snapshot(),writes=s.writes,p=input(b);p.calendarSwap='';
  assert.equal((await service(s,b).inspect(p)).status,'already-imported');const r=await service(s,b).save(p);
  assert.equal(r.unchanged,true);assert.equal(r.verified,true);assert.equal(s.writes,writes);assert.deepEqual(s.snapshot(),before);
 });
 test(`${b}: same PDF repairs candidates using existing canonical only`,async()=>{
  const s=await seed(b);s.removeItem(model.keys.monthlySources);const old=read(s);await update(s,b,input(b));const m=read(s);
  for(const k of ['importBatches','accountSnapshots','holdingSnapshots','monthlyAccountInputs','monthlyAccountStates'])assert.deepEqual(m[k],old[k]);
  assert.equal(m.monthlySources.records.filter(r=>r.kind==='source').length,2);assert.equal((await service(s,b).save(input(b))).unchanged,true);
 });
 test(`${b}: same PDF missing usage can explicitly start use without raw duplication`,async()=>{
  const s=await seed(b);s.removeItem(model.keys.monthlyAccountInputs);s.removeItem(model.keys.monthlyAccountStates);const old=read(s);
  await update(s,b,input(b));const m=read(s);for(const k of ['importBatches','accountSnapshots','holdingSnapshots'])assert.deepEqual(m[k],old[k]);
  assert.equal(resolved(s,b).observedAsset,'1006');assert.equal(resolved(s,b).realizedPnl,'10');
 });
 test(`${b}: defer-without-current can be recovered by explicit reimport`,async()=>{
  const s=await seed(b),query=core.descriptor({accountId:account(b),targetMonth:month,asOf:'2026-09-30'},'marketValue',null);
  operate(s,{adoptions:[{...query,decision:'defer'}]});assert.equal(scalar.forBroker(b).resolve(read(s),month).blocked,true);
  await update(s,b,input(b));assert.equal(resolved(s,b).observedAsset,'1006');
 });
 for(const metric of ['marketValue','unrealizedPnl','realizedPnl','deposit','withdrawal'])test(`${b}: independent manual ${metric} requires confirmation and retains history`,async()=>{
  const s=await seed(b),id=manual(s,b,metric,'9'),api=service(s,b),p=input(b),before=s.snapshot();
  assert.equal((await api.save(p)).status,'review-required');assert.deepEqual(s.snapshot(),before);
  const guard=await api.inspect(p);assert.equal(guard.replaceCurrent,true);assert.equal((await api.save(p,{...guard,replaceCurrent:false})).status,'review-required');
  await api.save(p,guard);const m=read(s);assert.ok(m.monthlySources.records.some(r=>r.id===id&&r.value==='9'));
  assert.equal(resolved(s,b)[metric==='marketValue'?'observedAsset':metric],{marketValue:'1006',unrealizedPnl:'-30',realizedPnl:'10',deposit:'20',withdrawal:'7'}[metric]);
 });
 test(`${b}: same original PDF cannot silently replace another PDF`,async()=>{
  const s=await seed(b);await update(s,b);const old=s.snapshot(),api=service(s,b),p=input(b);
  assert.equal((await api.save(p)).status,'review-required');assert.deepEqual(s.snapshot(),old);
  await api.save(p,await api.inspect(p));assert.equal(resolved(s,b).observedAsset,'1006');assert.equal(read(s).accountSnapshots.records.length,2);
 });
 test(`${b}: active PDF correction is retained on same revision but not next revision`,async()=>{
  const s=await seed(b),source=read(s).monthlySources.records.find(r=>r.metric==='marketValue');
  operate(s,{overrides:[{id:'original_override',revisionId:source.id,value:'777'}],adoptions:[{revisionId:source.id,overrideId:'original_override'}]});
  await update(s,b,input(b));assert.equal(resolved(s,b).observedAsset,'777');await update(s,b);assert.equal(resolved(s,b).observedAsset,'1016');
  assert.ok(read(s).monthlySources.records.some(r=>r.id==='original_override'));
 });
 test(`${b}: explicit zero aggregates replace old imported amounts`,async()=>{
  const s=await seed(b),p=input(b,'b');for(const f of ['realizedPnl','deposit','withdrawal'])p.preview.values[f]='0';await update(s,b,p);
  assert.deepEqual(['realizedPnl','deposit','withdrawal'].map(k=>resolved(s,b)[k]),['0','0','0']);
 });
 test(`${b}: zero NAV is not missing or previous-positive fallback`,async()=>{
  const s=await seed(b),p=input(b,'b');p.preview.values.cashBalance='22';p.preview.values.netAssetValue='0';await update(s,b,p);assert.equal(resolved(s,b).observedAsset,'0');
 });
 test(`${b}: empty new holdings are confirmed zero price evaluation, not old positions`,async()=>{
  const s=await seed(b),p=input(b,'b');p.preview.positions=[];
  Object.assign(p.preview.values,{unrealizedPnl:'0',monthEndUnsettledSwap:'0',reportedAccountEvaluationPnl:'0',netAssetValue:'1028'});
  await update(s,b,p);const m=read(s),snapshot=m.accountSnapshots.records.at(-1);
  assert.equal(m.holdingSnapshots.records.filter(h=>h.accountSnapshotId===snapshot.id).length,0);assert.equal(m.holdingSnapshots.records.length,2);
  assert.equal(resolved(s,b).unrealizedPnl,'0');assert.equal((await update(s,b,p)).unchanged,true);
 });
 test(`${b}: fixed-month display and current projection both use updated observations without future carry`,async()=>{
  const s=await seed(b);await update(s,b);const w={};require('node:vm').runInNewContext(require('node:fs').readFileSync('assets/profit-metrics.js','utf8'),{window:w});
  const display=require('../assets/monthly-display-view.js').create(w.TradeScopeProfitMetrics,{}, {2026:{[b]:1000}}, {},read(s),[{key:b,name:b,color:'blue'}]);
  const row=display.month(2026,9).rows[0];assert.deepEqual([row.asset,row.unrealized,row.realized,row.deposit,row.withdrawal,row.swap],[1016,-50,30,40,17,13]);
  assert.equal(display.accountMonth(2026,10,{key:b}).asset,null);const current=require('../assets/current-asset-view.js').create(display.dashboard(2026),read(s),2026,{balanceHistory:display.balanceHistory});
  assert.equal(current.rows[0].metrics.net.value,1016);assert.equal(current.rows[0].metrics.net.sourceMonth,'2026-09');
 });
 test(`${b}: missing parsed aggregate is rejected, never converted to zero`,async()=>{
  const s=await seed(b),p=input(b,'b'),before=s.snapshot();p.preview.values.deposit=null;await assert.rejects(update(s,b,p));assert.deepEqual(s.snapshot(),before);
 });
 for(const entity of ['monthlyAccountInputs','monthlyAccountStates'])for(const metric of ['unrealizedPnl','realizedPnl','deposit','withdrawal'])test(`${b}: immutable ${entity}/${metric} survives pointer advancement via exact history`,async()=>{
  const s=await seed(b),old=reference(s,b,metric,entity),value=core.sourceValue(old,read(s));await update(s,b);const m=read(s);
  assert.equal(core.sourceFingerprint(old,m),old.fingerprint);assert.equal(core.sourceValue(old,m),value);assert.doesNotThrow(()=>core.validateSet(m,{strictStale:true}));
  assert.equal(resolved(s,b)[metric],{unrealizedPnl:'-50',realizedPnl:'30',deposit:'40',withdrawal:'17'}[metric]);
  // Old revisions remain reselectable as the same old fact, not the new pointer.
  operate(s,{adoptions:[{revisionId:old.id}]});assert.equal(resolved(s,b)[metric],value);
 });
 test(`${b}: history mismatch cannot launder a stale source`,async()=>{
  const s=await seed(b),old=reference(s,b,'deposit');await update(s,b);const m=read(s);m.monthlyAccountInputs.records[0].sourceHistory[0].sourceValues.deposit='999';
  assert.notEqual(core.sourceFingerprint(old,m),old.fingerprint);
 });
 test(`${b}: stale preview stops before any write and leaves draft unchanged`,async()=>{
  const s=await seed(b),api=service(s,b),p=input(b,'b',true),guard=await api.inspect(p);manual(s,b,'unrealizedPnl','-9');const old=s.snapshot(),draft=copy(p);
  await assert.rejects(api.save(p,guard),/STALE/);assert.deepEqual(p,draft);assert.deepEqual(s.snapshot(),old);
 });
 test(`${b}: broken canonical reference is not automatically repaired`,async()=>{
  const s=await seed(b),m=read(s);m.accountSnapshots.records=[];s.setItem(model.keys.accountSnapshots,JSON.stringify(m.accountSnapshots));const old=s.snapshot();
  await assert.rejects(service(s,b).save(input(b)));assert.deepEqual(s.snapshot(),old);
 });
 test(`${b}: same PDF changed normalized facts stops without overwriting raw data`,async()=>{
  const s=await seed(b),old=s.snapshot();await assert.rejects(service(s,b).save(input(b,'a',true)),/CANONICAL_MISMATCH/);assert.deepEqual(s.snapshot(),old);
 });
 test(`${b}: cutover, fixed-month no-carry and progress preserve their rules`,async()=>{
  const s=await seed(b);await update(s,b);const m=read(s),p=input(b,'c');p.preview.targetMonth='2026-08';p.preview.snapshotAsOf='2026-08-31';const old=s.snapshot();
  await assert.rejects(service(s,b).save(p));assert.deepEqual(s.snapshot(),old);
  assert.equal(resolver.resolve(m,{},'2026-10',b).observedAsset,null);assert.equal(resolver.resolve(m,{},'2026-08',b).source,'legacy');
  assert.equal(progress.create({models:m}).account(b,month).periodRequirementsSatisfied,true);
 });
 test(`${b}: one journal owns balance/source/Input/State update`,async()=>{
  const s=await seed(b),journals=[],set=s.setItem.bind(s);s.setItem=(k,v)=>{if(k===journal.journalKey)journals.push(JSON.parse(v));set(k,v);};await update(s,b);
  assert.equal(journals.length,1);for(const key of ['importBatches','accountSnapshots','holdingSnapshots','monthlySources','monthlyAccountInputs','monthlyAccountStates'])assert.ok(journals[0].entries.some(e=>e.storageKey===model.keys[key]));
  assert.equal(s.getItem(journal.journalKey),null);
 });
 for(const key of ['importBatches','accountSnapshots','holdingSnapshots','monthlySources','monthlyAccountInputs','monthlyAccountStates'])test(`${b}: failure at ${key} rolls back entire revision`,async()=>{
  const s=await seed(b),before=s.snapshot(),set=s.setItem.bind(s);let armed=true;s.setItem=(k,v)=>{if(k===model.keys[key]&&armed){armed=false;throw Error('synthetic quota');}set(k,v);};
  await assert.rejects(update(s,b));assert.deepEqual(s.snapshot(),before);assert.equal(s.getItem(journal.journalKey),null);
 });
 test(`${b}: source plan failure is zero-write`,async()=>{
  const s=await seed(b),old=s.snapshot();await assert.rejects(update(s,b,input(b,'b',true),{buildSourceChanges:()=>{throw Error('synthetic plan');}}));assert.deepEqual(s.snapshot(),old);
 });
 test(`${b}: failed post-write reread verification rolls back`,async()=>{
  const s=await seed(b),old=s.snapshot();await assert.rejects(update(s,b,input(b,'b',true),{verifySaved:()=>false}));assert.deepEqual(s.snapshot(),old);assert.equal(s.getItem(journal.journalKey),null);
 });
 test(`${b}: impossible rollback retains recovery journal`,async()=>{
  const s=await seed(b),set=s.setItem.bind(s);s.setItem=(k,v)=>{if(k===model.keys.monthlySources||k===model.keys.monthlyAccountStates)throw Error('synthetic permanent failure');set(k,v);};
  await assert.rejects(update(s,b));assert.notEqual(s.getItem(journal.journalKey),null);
 });
 test(`${b}: Backup v15 roundtrip includes exact old native source facts without schema changes`,async()=>{
  const s=await seed(b),old=reference(s,b,'deposit');await update(s,b);const h=backupHarness(),payload=h.TradeScopeBackupExport.buildPayload(s,'http://localhost',now),dest=new MemoryStorage();
  assert.equal(payload.backupVersion,16);const inspection=h.TradeScopeBackupFormat.inspectValue(payload);assert.equal(inspection.ok,true);h.TradeScopeBackupRestore.execute(inspection.restorePlan,dest);
  assert.deepEqual(read(dest),read(s));assert.equal(core.sourceValue(old,read(dest)),'20');assert.equal(resolved(dest,b).deposit,'40');
 });
 test(`${b}: adopted independent manual calendar source is never changed`,async()=>{
  const s=await seed(b),id=manual(s,b,'swapPnl','-27');const old=read(s).monthlySources.records.filter(r=>r.metric==='swapPnl');
  await update(s,b);assert.equal(resolved(s,b).swapPnl,'-27');assert.deepEqual(read(s).monthlySources.records.filter(r=>r.metric==='swapPnl'),old);
  assert.equal(core.month(read(s),account(b),month).find(r=>r.metric==='swapPnl').source.id,id);
 });
 for(const metric of ['realizedPnl','deposit','withdrawal'])test(`${b}: native correction after common PDF flow switch stays revision-specific`,async()=>{
  const s=await seed(b),old=reference(s,b,metric);await update(s,b);const api=service(s,b),p=api.monthlyInspect(month);
  api.correct({targetMonth:month,...p.adopted,[metric]:'0'});assert.equal(resolved(s,b)[metric],'0');assert.equal(api.monthlyInspect(month).adopted[metric],'0');
  assert.equal(core.sourceValue(old,read(s)),{realizedPnl:'10',deposit:'20',withdrawal:'7'}[metric]);
  await update(s,b,input(b,'c',true));assert.equal(resolved(s,b)[metric],{realizedPnl:'30',deposit:'40',withdrawal:'17'}[metric]);
 });
 test(`${b}: updated PDF is subsequently zero-write even with adoption records`,async()=>{
  const s=await seed(b);await update(s,b);const old=s.snapshot(),writes=s.writes;const result=await update(s,b);
  assert.equal(result.unchanged,true);assert.equal(s.writes,writes);assert.deepEqual(s.snapshot(),old);
 });
 for(const failure of ['reread','fingerprint'])test(`${b}: post-write ${failure} failure rolls back real persisted changes`,async()=>{
  const s=await seed(b),api=service(s,b),p=input(b,'b',true),guard=await api.inspect(p),old=s.snapshot();
  const set=s.setItem.bind(s),get=s.getItem.bind(s);let written=false,armed=true;
  s.setItem=(k,v)=>{set(k,v);if(k===model.keys.monthlySources)written=true;};
  s.getItem=k=>{if(written&&armed&&k===model.keys.accountSnapshots){armed=false;if(failure==='reread')throw Error('synthetic read failure');const m=JSON.parse(get(k));m.records.at(-1).netAssetValue='999';return JSON.stringify(m);}return get(k);};
  await assert.rejects(api.save(p,guard));assert.equal(armed,false);assert.deepEqual(s.snapshot(),old);assert.equal(get(journal.journalKey),null);
 });
 test(`${b}: native calendar missing stays missing even if reimport supplies a value`,async()=>{
  const s=new MemoryStorage(),p=input(b);p.calendarSwap='';await service(s,b).save(p);await update(s,b);
  assert.equal(read(s).monthlyAccountInputs.records[0].adoptedValues.swapPnl,null);assert.equal(read(s).monthlyAccountStates,null);
  assert.equal(progress.create({models:read(s)}).account(b,month).periodRequirementsSatisfied,false);
 });
}
test('one broker update never rewrites the other broker records or usage',async()=>{
 const s=await seed('lightfx');await service(s,'minano').save(input('minano'));const old=read(s);await update(s,'lightfx');const m=read(s);
 for(const entity of ['accountSnapshots','holdingSnapshots','monthlyAccountInputs','monthlyAccountStates','importBatches','monthlySources'])
  assert.deepEqual((m[entity]?.records||[]).filter(r=>r.accountId==='acc_minna_fx'),(old[entity]?.records||[]).filter(r=>r.accountId==='acc_minna_fx'));
});
