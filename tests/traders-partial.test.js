// Invented data only. No private files, production Storage or prior-month basis.
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto').webcrypto;
const parser=require('../import/traders-parser.js'),save=require('../import/traders-save.js'),model=require('../assets/data-model-storage.js');
const resolver=require('../assets/monthly-account-resolver.js'),display=require('../assets/monthly-display-view.js');
const {report}=require('./traders-pdf-fixture.js'),{MemoryStorage,now,copy,backupHarness}=require('./gmo-support.js');
const c={window:{}};require('node:vm').runInNewContext(require('node:fs').readFileSync(require.resolve('../assets/profit-metrics.js'),'utf8'),c);const legacy=c.window.TradeScopeProfitMetrics;
const source=(broker='lightfx',hash='a',swap='')=>({preview:parser.parse(report(broker),broker),fileHash:hash.repeat(64),fileSize:100,calendarSwap:swap});
const api=(s,b='lightfx')=>save.createService(s,b,{clock:()=>now,cryptoApi:crypto});
const view=(s,b='lightfx')=>display.create(legacy,{}, {2026:{[b]:1000}}, {},model.readModels(s),[{key:b,name:b,color:'#123456'}]);
for(const broker of ['lightfx','minano'])test(`${broker}: PDF-only persists source/positions with null swap and no complete State`,async()=>{
 const s=new MemoryStorage({tradingData:'{}',yearInitialUnrealized:'{}',tradeScopeTradeHistoryV1:'[]'}),before=s.snapshot();
 const result=await api(s,broker).save(source(broker));assert.equal(result.status,'saved');assert.equal(result.complete,false);
 const m=model.readModels(s);assert.equal(m.importBatches.records.length,1);assert.equal(m.accountSnapshots.records.length,1);assert.equal(m.holdingSnapshots.records.length,2);assert.equal(m.monthlyAccountStates,null);
 const input=m.monthlyAccountInputs.records[0];assert.equal(input.schemaVersion,2);assert.equal(input.sourceValues.swapPnl,null);assert.equal(input.adoptedValues.swapPnl,null);assert.equal(input.sourceValues.realizedPnl,'10');assert.deepEqual(input.pdfObservations,{fee:'0',other:'0'});
 for(const [k,v]of Object.entries(before))assert.equal(s.getItem(k),v);assert.equal(resolver.resolve(m,{},'2026-09',broker).source,'missing');
});
for(const swap of ['0','-7','13'])test(`reload/Input completes partial with signed calendar ${swap}, immutable source metadata`,async()=>{
 const s=new MemoryStorage();await api(s).save(source());const before=model.readModels(s),reloaded=api(s),p=reloaded.monthlyInspect('2026-09');assert.equal(p.adopted.swapPnl,null);
 assert.equal(reloaded.correct({targetMonth:'2026-09',...p.adopted,swapPnl:swap},{expectedModels:p.models}).status,'saved');
 const m=model.readModels(s);assert.deepEqual(m.importBatches,before.importBatches);assert.deepEqual(m.accountSnapshots,before.accountSnapshots);assert.deepEqual(m.holdingSnapshots,before.holdingSnapshots);
 assert.equal(m.monthlyAccountStates.records[0].swapPnl,swap);assert.equal(m.monthlyAccountInputs.records[0].sourceHistory[0].sourceValues.swapPnl,null);
 assert.equal(m.monthlyAccountInputs.records[0].fieldSources.swapPnl,'manual-income-calendar-swap-accrual');assert.equal(resolver.resolve(m,{},'2026-09').source,'missing');assert.equal(resolver.resolve(m,{},'2026-09','lightfx').completeness.complete,true);
 assert.equal(view(s).month(2026,9).swap,Number(swap));
});
test('partial display exposes known flows/price unrealized/net observation, missing swap stays null',async()=>{
 const s=new MemoryStorage();await api(s).save(source());const v=view(s),month=v.month(2026,9),row=month.rows[0];assert.equal(row.partial,true);assert.equal(row.complete,false);assert.equal(row.swap,null);
 assert.equal(row.realized,10);assert.equal(row.deposit,20);assert.equal(row.withdrawal,7);assert.equal(row.unrealized,-30);assert.equal(row.asset,1006);assert.equal(row.confirmed,null);assert.equal(month.provisional,true);
 assert.equal(v.monthlyPnl(2026,9).total,10);assert.equal(v.yearlyTotals(2026).swapSum,null);assert.equal(v.dashboard(2026).accountData[0].amount,1006);assert.equal(v.dashboard(2026).rows[0].metrics.net.status,'current partial');
 const fp=v.fingerprint(2026);const p=api(s).monthlyInspect('2026-09');api(s).correct({targetMonth:'2026-09',...p.adopted,swapPnl:'13'});assert.notEqual(view(s).fingerprint(2026),fp);assert.equal(view(s).monthlyPnl(2026,9).total,23);
});
test('partial reimport is a byte-identical no-op, even when calendar is provided',async()=>{
 const s=new MemoryStorage();await api(s).save(source());const before=s.snapshot();assert.equal((await api(s).save(source('lightfx','a','13'))).status,'already-imported');assert.deepEqual(s.snapshot(),before);
});
test('partial corrected PDF retains old source, explicitly adopts new source, remains missing swap',async()=>{
 const s=new MemoryStorage(),a=api(s);await a.save(source());const old=a.read(),next=source('lightfx','b'),confirmation=await a.inspect(next);
 assert.equal(confirmation.status,'review-required');const before=s.snapshot();assert.equal((await a.save(next)).status,'review-required');assert.deepEqual(s.snapshot(),before);
 assert.equal((await a.save(next,confirmation)).complete,false);const m=a.read();assert.equal(m.accountSnapshots.records.length,2);assert.equal(m.monthlyAccountStates,null);assert.equal(m.monthlyAccountInputs.records[0].id,old.monthlyAccountInputs.records[0].id);
 assert.equal(m.monthlyAccountInputs.records[0].sourceHistory[0].adoptedAccountSnapshotId,old.accountSnapshots.records[0].id);assert.equal(view(s).month(2026,9).rows[0].asset,1006);
 assert.doesNotThrow(()=>a.monthlyInspect('2026-09'));
});
test('PDF correction alone preserves original calendar AND later adopted calendar correction',async()=>{
 const s=new MemoryStorage(),a=api(s);await a.save(source('lightfx','a','13'));let p=a.monthlyInspect('2026-09');a.correct({targetMonth:'2026-09',...p.adopted,swapPnl:'17'});
 const stateId=a.read().monthlyAccountStates.records[0].id;const next=source('lightfx','b','');await a.save(next,await a.inspect(next));p=a.monthlyInspect('2026-09');assert.equal(p.source.swapPnl,'13');assert.equal(p.adopted.swapPnl,'17');assert.equal(p.state.id,stateId);
 assert.equal(p.input.sourceHistory.length,2);assert.equal(p.state.sourceHistory.length,2);assert.equal(p.snapshot.accountSpecific.reportedSettledSwapPnl,'5');
});
test('old v7 complete source without partial input remains readable and calendar survives PDF correction',async()=>{
 const s=new MemoryStorage(),a=api(s);await a.save(source('lightfx','a','13'));s.removeItem(model.keys.monthlyAccountInputs);const old=model.readModels(s);assert.doesNotThrow(()=>model.validateBackupModels(7,Object.fromEntries(model.backupModelEntities[7].map(k=>[k,old[k]]))));
 assert.equal(a.monthlyInspect('2026-09').source.swapPnl,'13');const next=source('lightfx','b');await a.save(next,await a.inspect(next));assert.equal(a.monthlyInspect('2026-09').source.swapPnl,'13');
});
for(const broker of ['lightfx','minano'])test(`${broker}: opposite product is rejected without mutation`,async()=>{
 const s=new MemoryStorage(),before=s.snapshot();await assert.rejects(api(s,broker).save(source(broker==='lightfx'?'minano':'lightfx')));assert.deepEqual(s.snapshot(),before);
});
test('monthly calendar is independent of previous PDF/unsettled basis and August recognition',async()=>{
 const s=new MemoryStorage({tradingData:JSON.stringify({2026:{8:{lightfx:{swapPnL:777,unrealizedLegs:[123]}}}})}),old=s.getItem('tradingData');await api(s).save(source('lightfx','a','-7'));
 assert.equal(api(s).read().monthlyAccountStates.records[0].swapPnl,'-7');assert.equal(s.getItem('tradingData'),old);assert.equal(api(s).read().accountSnapshots.records.length,1);
});
test('blank later Input fails without changing partial source; stale guard and invalid decimals rejected',async()=>{
 const s=new MemoryStorage(),a=api(s);await a.save(source());const p=a.monthlyInspect('2026-09'),before=s.snapshot();assert.throws(()=>a.correct({targetMonth:'2026-09',...p.adopted,swapPnl:''}));assert.deepEqual(s.snapshot(),before);
 assert.throws(()=>a.correct({targetMonth:'2026-09',...p.adopted,swapPnl:'1.5'}));assert.deepEqual(s.snapshot(),before);
});
test('partial Backup v8 roundtrip includes null swap and history; frozen v7 refuses new input',async()=>{
 const s=new MemoryStorage();await api(s).save(source());const b=backupHarness(),payload=b.TradeScopeBackupExport.buildPayload(s,'http://localhost',now);assert.equal(payload.backupVersion,12);
 assert.equal(b.TradeScopeBackupFormat.inspectValue({...payload,backupVersion:7}).ok,false);const empty=new MemoryStorage();const info=b.TradeScopeBackupFormat.inspectValue(payload);assert.equal(info.ok,true);b.TradeScopeBackupRestore.execute(info.restorePlan,empty);
 assert.deepEqual(model.readModels(empty),model.readModels(s));assert.deepEqual(copy(b.TradeScopeBackupExport.buildPayload(empty,'http://localhost',now)),copy(payload));
 for(const version of [1,2,3,4,5,6,7]){const old=copy(payload);old.backupVersion=version;if(version===1)delete old.data.models;else old.data.models=Object.fromEntries(model.backupModelEntities[version].map(k=>[k,null]));const plan=b.TradeScopeBackupFormat.inspectValue(old);assert.equal(plan.ok,true);const target=new MemoryStorage(s.snapshot());b.TradeScopeBackupRestore.execute(plan.restorePlan,target);if(version===1)assert.deepEqual(model.readModels(target),model.readModels(s));else assert.equal(model.readModels(target).monthlyAccountInputs,null);}
 assert.doesNotMatch(JSON.stringify(payload),/filename|absolutePath|fullText|pdfBinary|phone|address|accountNumber/);
});
test('partial persistence and later completion rollback every written model/cache failure',async()=>{
 for(const complete of [false,true])for(const key of [...Object.values(model.keys),'tradeScopeTopSummarySnapshotV1']){
  const s=new MemoryStorage({tradingData:'{}',tradeScopeTopSummarySnapshotV1:'stale'});if(complete)await api(s).save(source());
  const before=s.snapshot(),set=s.setItem.bind(s),remove=s.removeItem.bind(s);let touched=false;
  s.setItem=(k,v)=>{if(k===key&&!touched){touched=true;throw Error('quota');}set(k,v);};s.removeItem=k=>{if(k===key&&!touched){touched=true;throw Error('quota');}remove(k);};
  try{if(complete){const p=api(s).monthlyInspect('2026-09');api(s).correct({targetMonth:'2026-09',...p.adopted,swapPnl:'0'});}else await api(s).save(source());}catch(_){assert.deepEqual(s.snapshot(),before);}
  if(touched)assert.deepEqual(s.snapshot(),before);
 }
});
test('partial history/source immutability, wrong reference, unknown/PII fields rejected before writes',async()=>{
 const s=new MemoryStorage();await api(s).save(source());for(const mutate of [r=>r.sourceValues.realizedPnl='999',r=>r.adoptedAccountSnapshotId='missing',r=>r.filename='PRIVATE',r=>r.fieldSources.swapPnl='imported-monthly-pdf',r=>r.sourceHistory.push({})]){
  const m=model.readModels(s),before=s.snapshot();mutate(m.monthlyAccountInputs.records[0]);assert.throws(()=>model.createRepository(s).commit({monthlyAccountInputs:m.monthlyAccountInputs}));assert.deepEqual(s.snapshot(),before);
 }
});
test('PDF correction confirmation becomes stale after calendar adoption changes',async()=>{
 const s=new MemoryStorage(),a=api(s);await a.save(source('lightfx','a','13'));const next=source('lightfx','b'),confirmation=await a.inspect(next);const p=a.monthlyInspect('2026-09');a.correct({targetMonth:'2026-09',...p.adopted,swapPnl:'17'});
 const before=s.snapshot();assert.equal((await a.save(next,confirmation)).status,'review-required');assert.deepEqual(s.snapshot(),before);
});
test('calendar source cannot disappear/rewrite even when adopting a different PDF Snapshot',async()=>{
 const s=new MemoryStorage(),a=api(s);await a.save(source('lightfx','a','13'));const next=source('lightfx','b');await a.save(next,await a.inspect(next));
 const m=a.read();m.monthlyAccountInputs.records[0].sourceValues.swapPnl='99';m.monthlyAccountInputs.records[0].adoptedValues.swapPnl='99';assert.throws(()=>model.validateModels(m));
});
test('Backup v8 Restore midway failure rolls back partial input and legacy keys together',async()=>{
 const sourceStorage=new MemoryStorage();await api(sourceStorage).save(source());const b=backupHarness(),payload=b.TradeScopeBackupExport.buildPayload(sourceStorage,'http://localhost',now),plan=b.TradeScopeBackupFormat.inspectValue(payload).restorePlan;
 const target=new MemoryStorage({tradingData:'{}',yearInitialFunds:'{}',tradeScopeMemos:'[]'}),before=target.snapshot(),set=target.setItem.bind(target);let armed=true;
 target.setItem=(k,v)=>{if(k===model.keys.monthlyAccountInputs&&armed){armed=false;throw Error('quota');}set(k,v);};assert.throws(()=>b.TradeScopeBackupRestore.execute(plan,target));assert.deepEqual(target.snapshot(),before);
});
