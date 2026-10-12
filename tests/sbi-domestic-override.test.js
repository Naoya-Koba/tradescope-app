// Entirely invented observations. No user files or production Storage.
const test=require('node:test'), assert=require('node:assert/strict');
const vm=require('node:vm'), fs=require('node:fs'), crypto=require('node:crypto').webcrypto;
const model=require('../assets/data-model-storage.js'), service=require('../assets/sbi-monthly-save.js');
const display=require('../assets/monthly-display-view.js'), resolver=require('../assets/monthly-account-resolver.js');
const input=require('../assets/sbi-input-draft.js'), tx=require('../assets/storage-transaction.js');
const {MemoryStorage,backupHarness,copy}=require('./gmo-support.js');
const {fixture}=require('./monthly-display-fixture.js');
const now='2026-10-11T12:00:00.000Z';
function seed(){const f=fixture();return new MemoryStorage({tradingData:JSON.stringify(f.tradingData),yearInitialFunds:JSON.stringify(f.initialFunds),yearInitialUnrealized:'{}',
  tradeScopeTopSummarySnapshotV1:'{"stale":true}',...Object.fromEntries(Object.entries(f.models).filter(([,v])=>v).map(([k,v])=>[model.keys[k],JSON.stringify(v)]))});}
const draft=()=>({targetMonth:'2026-09',domesticImportBatchId:'batch_sbi',domesticMarketValue:'195.5000000000000000001',domesticUnrealizedPnl:'18.75'});
const save=(s,d=draft())=>service.createService(s,{crypto,clock:()=>now}).save(d);
function view(s){const window={};vm.runInNewContext(fs.readFileSync(require.resolve('../assets/profit-metrics.js'),'utf8'),{window});
  const f=fixture();return display.create(window.TradeScopeProfitMetrics,JSON.parse(s.getItem('tradingData')),f.initialFunds,{},model.readModels(s),f.accounts);}
test('partial domestic adoption persists source, exact decimals, metadata without false State or observation',()=>{
  const s=seed(),before=s.snapshot(),r=save(s);assert.equal(r.complete,false);assert.equal(r.state,null);
  assert.deepEqual(r.input.sourceValues,{marketValue:'200.25',unrealizedPnl:'20.125'});
  assert.deepEqual(r.input.adoptedValues,{marketValue:draft().domesticMarketValue,unrealizedPnl:'18.75'});
  assert.deepEqual(r.input.overrideFields,['marketValue','unrealizedPnl']);assert.equal(r.input.overrideUpdatedAt,now);
  for(const k of ['foreignAccountSnapshotId','cashAccountSnapshotId','realizedPnl','deposit','withdrawal'])assert.equal(r.input[k],null);
  for(const [k,v] of Object.entries(before))if(![model.keys.monthlyAccountInputs,'tradeScopeTopSummarySnapshotV1'].includes(k))assert.equal(s.getItem(k),v);
  assert.equal(r.models.monthlyAccountStates.records.length,1);assert.equal(r.models.accountSnapshots.records.length,1);assert.equal(s.getItem(tx.journalKey),null);
});
for(const field of ['realizedPnL','deposit','withdrawal'])test(`partial nullable ${field} does not imply zero or confirmation`,()=>{
  const r=save(seed(),{...draft(),[field]:''});assert.equal(r.input[field==='realizedPnL'?'realizedPnl':field],null);assert.equal(r.complete,false);
});
test('explicit zero remains zero and imported acquisition date is unchanged',()=>{
  const s=seed(),raw=s.getItem(model.keys.holdingSnapshots),r=save(s,{...draft(),domesticMarketValue:'0',domesticUnrealizedPnl:'0',deposit:'0'});
  assert.equal(r.input.adoptedValues.marketValue,'0');assert.equal(r.input.deposit,'0');assert.equal(r.input.withdrawal,null);
  assert.equal(s.getItem(model.keys.holdingSnapshots),raw);assert.equal(input.load(s,'2026-09').snapshotAsOf,'2026-10-04');
});
test('source reset preserves identity, clears exact override fields and never changes raw holdings',()=>{
  const s=seed(),first=save(s),raw=s.getItem(model.keys.holdingSnapshots);
  const reset=save(s,{...draft(),domesticMarketValue:'200.25',domesticUnrealizedPnl:'20.125'});
  assert.equal(reset.input.id,first.input.id);assert.deepEqual(reset.input.overrideFields,[]);assert.equal(s.getItem(model.keys.holdingSnapshots),raw);
});
test('all shared display consumers read adoption; partial performance remains unknown rather than inferred',()=>{
  const s=seed(),old=view(s),fingerprint=old.fingerprint(2026);save(s);const v=view(s),dashboard=v.dashboard(2026),monthly=v.month(2026,9),series=v.series(2026);
  const row=monthly.rows.find(r=>r.key==='sbi');assert.equal(row.asset,195.5);assert.equal(row.unrealized,18.75);assert.equal(row.complete,false);
  assert.equal(row.realized,null);assert.equal(row.deposit,null);assert.equal(row.withdrawal,null);
  const account=dashboard.rows.find(r=>r.key==='sbi');assert.equal(account.metrics.net.value,195.5);
  assert.equal(dashboard.accountData.find(r=>r.label==='SBI').amount,195.5);
  assert.equal(series.total[8],dashboard.net.value);assert.equal(series.summary.net.value,dashboard.net.value);
  assert.equal(series.performanceTotalSeries[9],dashboard.netPnl.value);assert.notEqual(v.fingerprint(2026),fingerprint);
  assert.equal(resolver.resolve(model.readModels(s),JSON.parse(s.getItem('tradingData')),'2026-09').source,'missing');
});
test('complete explicit save creates State only when all required inputs exist and adopts domestic pnl',()=>{
  const s=seed(),r=save(s,{...draft(),foreignAssetValue:'0',foreignUnrealizedPnl:'0',foreignDate:'2026-10-04',cashBalance:'0',cashDate:'2026-10-04',realizedPnL:'0',deposit:'0',withdrawal:'0'});
  assert.equal(r.complete,true);assert.equal(r.state.domesticImportBatchId,'batch_sbi');
  const resolved=resolver.resolve(r.models,JSON.parse(s.getItem('tradingData')),'2026-09');assert.equal(resolved.unrealizedPnl,'18.75');
  assert.equal(resolved.observedAsset,draft().domesticMarketValue);assert.equal(view(s).month(2026,9).rows.find(r=>r.key==='sbi').unrealized,18.75);
});
test('partial foreign/cash observation keeps explicit references; reediting domestic does not duplicate them',()=>{
  const s=seed(),d={...draft(),foreignAssetValue:'10',foreignUnrealizedPnl:'1',foreignDate:'2026-10-04',cashBalance:'0',cashDate:'2026-10-04'};
  const first=save(s,d),again=save(s,{...d,domesticMarketValue:'199'});
  assert.equal(again.complete,false);assert.equal(again.input.foreignAccountSnapshotId,first.input.foreignAccountSnapshotId);
  assert.equal(again.input.cashAccountSnapshotId,first.input.cashAccountSnapshotId);assert.equal(again.models.accountSnapshots.records.length,3);
  assert.equal(view(s).month(2026,9).rows.find(r=>r.key==='sbi').asset,209);
});
for(const name of [model.keys.monthlyAccountInputs,model.keys.accountSnapshots,model.keys.monthlyAccountStates,tx.journalKey])test(`atomic rollback when ${name} fails`,()=>{
  const s=seed(),before=s.snapshot(),set=s.setItem.bind(s);let failed=false;
  s.setItem=(key,value)=>{if(key===name&&!failed){failed=true;throw Error('Anonymous failure');}set(key,value);};
  assert.throws(()=>save(s,{...draft(),foreignAssetValue:'0',foreignUnrealizedPnl:'0',foreignDate:'2026-10-04',cashBalance:'0',cashDate:'2026-10-04',realizedPnL:'0',deposit:'0',withdrawal:'0'}));
  assert.deepEqual(s.snapshot(),before);
});
test('source rewrite, unknown field, metadata lie and dangling reference are rejected before writes',()=>{
  const s=seed();save(s);for(const change of [r=>r.sourceValues.marketValue='1',r=>r.filename='private.csv',r=>r.overrideFields=[],r=>r.domesticImportBatchId='missing']){
    const repo=model.createRepository(s),models=repo.read(),before=s.snapshot();change(models.monthlyAccountInputs.records[0]);
    assert.throws(()=>repo.commit({monthlyAccountInputs:models.monthlyAccountInputs}));assert.deepEqual(s.snapshot(),before);
  }
});
test('v6 exports empty models and round-trips partial adoption exactly',()=>{
  const api=backupHarness();assert.equal(api.TradeScopeBackupFormat.inspectValue(api.TradeScopeBackupExport.buildPayload(new MemoryStorage())).ok,true);
  const s=seed();save(s);const payload=api.TradeScopeBackupExport.buildPayload(s);assert.equal(payload.backupVersion,12);
  const empty=new MemoryStorage();api.TradeScopeBackupRestore.execute(api.TradeScopeBackupFormat.inspectValue(payload).restorePlan,empty);
  assert.deepEqual(model.readModels(empty),model.readModels(s));assert.deepEqual(view(empty).dashboard(2026),view(s).dashboard(2026));
  assert.deepEqual(copy(api.TradeScopeBackupExport.buildPayload(empty).data),copy(payload.data));
  assert.doesNotMatch(JSON.stringify(payload),/filename|absolutePath|csvText|accountNumber|address/);
});
for(const version of [1,2,3,4,5])test(`v${version} Restore preserves its contract and handles absent new input explicitly`,()=>{
  const api=backupHarness(),s=seed();save(s);const saved=s.getItem(model.keys.monthlyAccountInputs),old=api.TradeScopeBackupExport.buildPayload(seed());old.backupVersion=version;
  if(version===1)delete old.data.models;
  else {const keep=model.backupModelEntities[version];for(const key of Object.keys(old.data.models))if(!keep.includes(key))delete old.data.models[key];}
  if(version===3)old.data.models.monthlyAccountStates=null; // Published v3 cannot carry GMO State v2.
  const parsed=api.TradeScopeBackupFormat.inspectValue(old);assert.equal(parsed.ok,true);api.TradeScopeBackupRestore.execute(parsed.restorePlan,s);
  assert.equal(s.getItem(model.keys.monthlyAccountInputs),version===1?saved:null);
});
test('v5 cannot accept new input model; v6 rollback protects both old and new keys',()=>{
  const api=backupHarness(),s=seed();save(s);const payload=api.TradeScopeBackupExport.buildPayload(s),v5=copy(payload);v5.backupVersion=5;
  assert.equal(api.TradeScopeBackupFormat.inspectValue(v5).ok,false);
  const target=seed(),before=target.snapshot(),set=target.setItem.bind(target);let failed=false;
  target.setItem=(key,value)=>{if(key===model.keys.monthlyAccountInputs&&!failed){failed=true;throw Error('Anonymous failure');}set(key,value);};
  assert.throws(()=>api.TradeScopeBackupRestore.execute(api.TradeScopeBackupFormat.inspectValue(payload).restorePlan,target));assert.deepEqual(target.snapshot(),before);
});
test('another canonical month retains its record and original holdings during September adoption',()=>{
  const s=seed(),m=model.readModels(s),env=records=>({schemaVersion:1,records,updatedAt:now});
  m.importBatches.records.push({...m.importBatches.records.find(r=>r.id==='batch_sbi'),id:'batch_october',targetMonth:'2026-10'});
  m.holdingSnapshots.records.push({...m.holdingSnapshots.records[0],id:'hs_october',importBatchId:'batch_october',targetMonth:'2026-10'});
  model.createRepository(s).commit({importBatches:env(m.importBatches.records),holdingSnapshots:env(m.holdingSnapshots.records)});
  save(s,{...draft(),targetMonth:'2026-10',domesticImportBatchId:'batch_october'});
  const before=copy(model.readModels(s).monthlyAccountInputs.records[0]),raw=s.getItem(model.keys.holdingSnapshots);
  save(s);assert.deepEqual(model.readModels(s).monthlyAccountInputs.records.find(r=>r.targetMonth==='2026-10'),before);
  assert.equal(s.getItem(model.keys.holdingSnapshots),raw);
});
test('read, inspect and domestic Draft projection do not create or change any storage key',()=>{
  const s=seed(),before=s.snapshot();input.load(s,'2026-09');view(s).dashboard(2026);service.createService(s).inspect(draft());
  assert.deepEqual(s.snapshot(),before);assert.equal(s.getItem(model.keys.monthlyAccountInputs),null);assert.equal(s.writes,0);
});
test('stale partial save is rejected before journal and cannot overwrite another tab adoption',()=>{
  const s=seed(),svc=service.createService(s,{crypto,clock:()=>now}),expected=svc.inspect(draft()).models;
  save(s);const before=s.snapshot();assert.throws(()=>svc.save({...draft(),domesticMarketValue:'191'},{expectedModels:expected}),/変更/);
  assert.deepEqual(s.snapshot(),before);
});
test('invalid source account, scope, month and currency cannot be accepted as new input origin',()=>{
  const s=seed();save(s);for(const [field,value] of [['sourceScope','unverified'],['accountId','acc_gmo_fx'],['targetMonth','2026-10'],['currency','USD']]){
    const m=model.readModels(s);m.holdingSnapshots.records[0][field]=value;assert.throws(()=>model.validateModels(m));
  }
});
