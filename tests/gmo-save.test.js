const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), cryptoApi = require('node:crypto').webcrypto;
const model = require('../assets/data-model-storage.js'), tx = require('../assets/storage-transaction.js');
const engine = require('../import/gmo-save.js'), parser = require('../import/gmo-parser.js'), resolver = require('../assets/monthly-account-resolver.js');
const { report } = require('./gmo-pdf-fixture.js');
const { MemoryStorage, copy, backupHarness, now } = require('./gmo-support.js');
const source = (hash = 'a') => ({ preview: parser.parse(report()), fileHash: hash.repeat(64), fileSize: 1234 });
const service = target => engine.createService(target, { cryptoApi, clock: () => now });
function calculator(target) {
  const context = { window: {} }; vm.runInNewContext(fs.readFileSync(require.resolve('../assets/profit-metrics.js'), 'utf8'), context);
  return resolver.createCalculator(context.window.TradeScopeProfitMetrics, JSON.parse(target.getItem('tradingData') || '{}'), {2026:{gmo:100}}, {}, model.readModels(target));
}
test('GMO read/Preview inspection does not seed or mutate any storage', async () => {
  const t = new MemoryStorage(), before = t.snapshot(); assert.equal((await service(t).inspect(source())).status, 'ready'); assert.deepEqual(t.snapshot(), before);
});
test('one verified save creates minimal Batch/Snapshot/State and invalidates cache, not legacy data', async () => {
  const t = new MemoryStorage({ tradingData:'{"2026":{"8":{"__saved":true,"gmo":{"realizedPnL":0,"swapPnL":0,"unrealizedPnL":0}}}}', tradeScopeTopSummarySnapshotV1:'{"old":true}' }), legacy = t.getItem('tradingData');
  assert.equal((await service(t).save(source())).status, 'saved'); const m = model.readModels(t);
  assert.equal(m.accounts.records.length, 1); assert.equal(m.instruments, null); assert.equal(m.rawTransactions, null);
  assert.equal(m.importBatches.records.length, 1); assert.equal(m.accountSnapshots.records.length, 1); assert.equal(m.monthlyAccountStates.records.length, 1);
  assert.equal(m.monthlyAccountStates.records[0].schemaVersion, 2); assert.equal(m.accountSnapshots.records[0].assetValue, undefined);
  assert.equal(m.importBatches.records[0].sourceScope, undefined); assert.equal(m.importBatches.records[0].importedAt, now);
  assert.equal(t.getItem('tradingData'), legacy); assert.equal(t.getItem(tx.journalKey), null); assert.equal(t.getItem('tradeScopeTopSummarySnapshotV1'), null);
  assert.equal(calculator(t).confirmed(2026,9,'gmo'),115); assert.equal(calculator(t).net(2026,9,'gmo'),112);
});
test('exact reimport/reload/double invocation adds no records, retains existing Account metadata', async () => {
  const t = new MemoryStorage(); await service(t).save(source());
  const m = model.readModels(t); m.accounts.records[0].displayName = '架空の表示名'; model.createRepository(t).commit({accounts:m.accounts});
  const before = t.snapshot(); const s = service(t);
  const result = await Promise.all([s.save(source()), s.save(source())]); assert.ok(result.every(r=>r.status==='already-imported'||r.status==='busy'));
  assert.deepEqual(t.snapshot(),before); assert.equal(model.readModels(t).accounts.records[0].displayName,'架空の表示名');
});
test('different hash requires explicit correction; keeps old history and stable State ID', async () => {
  const t = new MemoryStorage(), s=service(t); await s.save(source()); const before=t.snapshot(), old=model.readModels(t);
  const proposed=source('b'); const info=await s.inspect(proposed); assert.equal(info.status,'review-required');
  assert.equal((await s.save(proposed)).status,'review-required'); assert.deepEqual(t.snapshot(),before);
  assert.equal((await s.save(proposed,{stateId:info.stateId,adoptedSnapshotId:'stale'})).status,'review-required');
  assert.equal((await s.save(proposed,{stateId:info.stateId,adoptedSnapshotId:info.adoptedSnapshotId})).corrected,true);
  const after=model.readModels(t); assert.equal(after.importBatches.records.length,2); assert.equal(after.accountSnapshots.records.length,2);
  assert.equal(after.monthlyAccountStates.records.length,1); assert.equal(after.monthlyAccountStates.records[0].id,old.monthlyAccountStates.records[0].id);
  assert.notEqual(after.monthlyAccountStates.records[0].adoptedAccountSnapshotId,old.monthlyAccountStates.records[0].adoptedAccountSnapshotId);
  assert.deepEqual(after.accountSnapshots.records[0],old.accountSnapshots.records[0]);
});
test('every save position including derived cache failure fully rolls back', async () => {
  for(const key of [model.keys.accounts,model.keys.importBatches,model.keys.accountSnapshots,model.keys.monthlyAccountStates,'tradeScopeTopSummarySnapshotV1']) {
    const t=new MemoryStorage({tradingData:'{}',tradeScopeTopSummarySnapshotV1:'{"anonymous":true}'}), before=t.snapshot();
    const set=t.setItem.bind(t),remove=t.removeItem.bind(t);let fail=true;
    t.setItem=(k,v)=>{if(k===key&&fail){fail=false;throw Error('quota');}set(k,v);};
    t.removeItem=k=>{if(k===key&&fail){fail=false;throw Error('quota');}remove(k);};
    await assert.rejects(service(t).save(source())); assert.deepEqual(t.snapshot(),before);
  }
});
test('journal failure prevents writes; rollback failure retains journal and blocks next save', async () => {
  const t=new MemoryStorage(),set=t.setItem.bind(t);
  t.setItem=(k,v)=>{if(k===tx.journalKey)throw Error('quota');set(k,v);};await assert.rejects(service(t).save(source()));assert.deepEqual(t.snapshot(),{});
  const broken=new MemoryStorage(),bset=broken.setItem.bind(broken);broken.setItem=(k,v)=>{if(k===model.keys.accountSnapshots)throw Error('quota');bset(k,v);};
  broken.removeItem=k=>{if(k===model.keys.accounts)throw Error('unavailable');broken.values.delete(k);};
  await assert.rejects(service(broken).save(source()));assert.notEqual(broken.getItem(tx.journalKey),null);const before=broken.snapshot();
  await assert.rejects(service(broken).save(source()),/ジャーナル/);assert.deepEqual(broken.snapshot(),before);
});
test('invalid source, unknown fields, PII, null financial facts rejected before writing', async () => {
  for(const mutate of [s=>s.filename='private.pdf',s=>s.preview.values.name='非保存',s=>s.preview.values.swapPnl=null,s=>s.preview.valid=false,s=>s.preview.importerVersion='unknown',s=>s.preview.snapshotAsOf='2026-09-29',s=>s.preview.values.netAssetValue='999']){
    const t=new MemoryStorage(),s=source();mutate(s);await assert.rejects(service(t).save(s));assert.equal(t.writes,0);
  }
});
test('meaningful legacy conflicts cannot be bypassed by correction options', async () => {
  const t=new MemoryStorage({tradingData:'{"2026":{"9":{"gmo":{"realizedPnL":2}}}}'}),before=t.snapshot();
  assert.equal((await service(t).save(source(),{stateId:'force',adoptedSnapshotId:'force'})).status,'conflict');assert.deepEqual(t.snapshot(),before);
});
test('GMO save -> v4 export -> anonymous empty -> restore -> calculation/re-export match', async () => {
  const t=new MemoryStorage();await service(t).save(source());const api=backupHarness(),backup=api.TradeScopeBackupExport.buildPayload(t,'http://localhost',now);
  assert.equal(backup.backupVersion,4);assert.doesNotMatch(JSON.stringify(backup),/filename|absolutePath|rawText|fullText|pdfBinary|accountNumber/);
  const empty=new MemoryStorage();api.TradeScopeBackupRestore.execute(api.TradeScopeBackupFormat.inspectValue(backup).restorePlan,empty);
  assert.deepEqual(model.readModels(empty),model.readModels(t));assert.equal(calculator(empty).net(2026,9,'gmo'),calculator(t).net(2026,9,'gmo'));
  assert.deepEqual(copy(api.TradeScopeBackupExport.buildPayload(empty,'http://localhost',now)),copy(backup));
});
test('UI only uses GMO save service, explicit confirmation, no forced/canonical writes or financial logs', () => {
  const code=fs.readFileSync(require.resolve('../import/gmo-preview.js'),'utf8'),html=fs.readFileSync(require.resolve('../import.html'),'utf8');
  assert.match(code,/saveService\(\)\.save/);assert.match(code,/gmo-confirm-save/);assert.match(code,/busy = true/);assert.match(code,/訂正して保存/);
  assert.doesNotMatch(code,/\.setItem\(|\.commit\(|console\.|fetch\(|sendBeacon|XMLHttpRequest|innerHTML/);
  assert.match(html,/accept="\.pdf,application\/pdf"/);assert.match(code,/already-imported/);
});
