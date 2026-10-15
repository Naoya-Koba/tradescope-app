// Invented anonymous data only. No production Storage, real PDF or source IDs.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const candidates=require('../assets/fx-transaction-candidate-view.js'),f=require('./fx-history-fixture.js');
const model=require('../assets/data-model-storage.js'),view=require('../assets/transaction-view.js');
const {MemoryStorage,backupHarness}=require('./gmo-support.js');
function fixture(provider='lightfx',overrides={}){const m=f.fixture(provider,{quantity:'200000',price:'4.1234',...overrides});f.decision(m);return m;}
const manual=(overrides={})=>({id:'anonymous_manual',account:'LIGHT FX',symbol:'TRY/JPY',assetType:'FX',category:'partial_close',side:'sell',
  quantity:20,rate:4.1234,contractSize:10000,date:'2034-04-20',memo:'anonymous memo',strategy:'anonymous strategy',...overrides});
const read=(a,m,options)=>candidates.project(a,m,options);
const mStatus=(a,m)=>read([a],m).manual[0];
function reseal(m){f.seal(m);for(const d of m.transactionSources.records.filter(r=>r.kind==='decision'&&r.collectionId))d.collectionFingerprint=m.transactionSources.records.find(c=>c.id===d.collectionId).fingerprint;return m;}
function extra(m,overrides={}){const r={...m.importedTransactions.records[0],id:'anonymous_tx_extra',sourceRow:2,...overrides};m.importedTransactions.records.push(r);m.transactionSources.records.find(r=>r.kind==='collection').transactionIds.push(r.id);reseal(m);return r;}
function deepFreeze(o){if(o&&typeof o==='object'){Object.freeze(o);for(const v of Object.values(o))deepFreeze(v);}return o;}

for(const provider of ['lightfx','minna'])test(`${provider} reciprocal unique candidate is date-level evidence, not confirmation`,()=>{
  const m=fixture(provider),a=manual({account:provider==='minna'?'みんなのFX':'LIGHT FX'}),p=read([a],m);
  assert.equal(p.manual[0].status,'unique-candidate');assert.equal(p.imported[0].status,'unique-candidate');
  assert.deepEqual(p.manual[0].importedIds,['tx_a']);assert.deepEqual(p.imported[0].manualIds,[a.id]);
  assert.equal(p.manual[0].reason,'EXACT_AT_DATE_PRECISION');assert.equal(p.manual[0].provider,provider);
  assert(!JSON.stringify(p).includes('confirmedMatch'));assert.equal(p.sources[0].sourceStatus,'adopted');
});
for(const category of ['new','add','partial_close','full_close'])test(`category ${category} maps action independently of side`,()=>{
  const action=['new','add'].includes(category)?'open':'close',m=fixture('lightfx',{action,realizedPnl:action==='open'?null:'-1'});
  assert.equal(mStatus(manual({category}),m).status,'unique-candidate');assert.equal(mStatus(manual({category}),m).matchingFields.action,action);
});
test('exact canonical account ID and known alias resolve',()=>{for(const account of ['acc_lightfx_fx','LIGHT FX','lightfx'])assert.equal(mStatus(manual({account}),fixture()).status,'unique-candidate');});
test('cross-account identical facts never match',()=>{const p=read([manual({account:'みんなのFX'})],fixture());assert.equal(p.manual[0].status,'unmatched-manual');assert.equal(p.imported[0].status,'unmatched-imported');});
test('same-looking LIGHT and Minna trades remain separate with both sources active',()=>{
  const m=fixture(),n=fixture('minna');
  for(const r of n.importBatches.records)r.id='minna_'+r.id;
  for(const r of n.importedTransactions.records){r.id='minna_'+r.id;r.importBatchId='minna_'+r.importBatchId;r.collectionId='minna_'+r.collectionId;}
  for(const r of n.transactionSources.records){r.id='minna_'+r.id;if(r.kind==='collection'){r.importBatchId='minna_'+r.importBatchId;r.transactionIds=r.transactionIds.map(id=>'minna_'+id);}else{r.collectionId='minna_'+r.collectionId;if(r.previousId)r.previousId='minna_'+r.previousId;}}
  for(const k of ['importBatches','importedTransactions','transactionSources'])m[k].records.push(...n[k].records);reseal(m);model.validateModels(m);
  const p=read([manual(),manual({id:'minna_manual',account:'みんなのFX'})],m);
  assert.deepEqual(p.manual.map(r=>r.importedIds),[['tx_a'],['minna_tx_a']]);
});
for(const [name,edit,reason]of [
  ['unknown account',{account:'anonymous unknown'},'ACCOUNT_UNRESOLVED'],
  ['provider conflict',{sourceProvider:'minna'},'PROVIDER_CONFLICT'],
  ['other provider field',{provider:'gmo'},'PROVIDER_CONFLICT'],
  ['unknown symbol',{symbol:'UNKNOWN/JPY'},'INSTRUMENT_UNRESOLVED'],
  ['missing symbol',{symbol:undefined},'INSTRUMENT_UNRESOLVED'],
  ['unsupported category',{category:'adjustment'},'CATEGORY_UNSUPPORTED'],
  ['prototype category',{category:'toString'},'CATEGORY_UNSUPPORTED'],
  ['missing side',{side:null},'SIDE_UNKNOWN'],
  ['invalid date',{date:'2034-02-30'},'DATE_INVALID'],
  ['datetime instead of date',{date:'2034-04-20T11:22:33'},'DATE_INVALID'],
  ['missing contractSize',{contractSize:undefined},'CONTRACT_SIZE_UNKNOWN'],
  ['conflicting contractSize',{contractSize:100000},'CONTRACT_SIZE_CONFLICT'],
  ['unknown quantity unit',{quantityUnit:'shares'},'QUANTITY_UNIT_UNKNOWN'],
  ['zero quantity',{quantity:0},'QUANTITY_INVALID'],
  ['negative quantity',{quantity:-1},'QUANTITY_INVALID'],
  ['nonfinite quantity',{quantity:Infinity},'QUANTITY_INVALID'],
  ['blank quantity',{quantity:''},'QUANTITY_INVALID'],
  ['nonfinite price',{rate:NaN},'PRICE_INVALID'],
  ['blank price',{rate:''},'PRICE_INVALID'],
  ['missing manual ID',{id:null},'INVALID_MANUAL_ID'],
  ['asset type missing',{assetType:undefined},'ASSET_TYPE_UNCONFIRMED']
])test(`${name} incomparable without guessing`,()=>{const r=mStatus(manual(edit),fixture());assert.equal(r.status,'incomparable');assert.equal(r.reason,reason);assert.deepEqual(r.importedIds,[]);});
test('formal account provider mismatch blocks matching',()=>{const m=fixture();m.accounts.records.find(r=>r.id==='acc_lightfx_fx').providerCode='minna';const p=read([manual()],m);assert.equal(p.manual[0].status,'incomparable');assert.equal(p.imported.length,0);});
test('imported provider mismatch is exposed as unavailable, never unmatched usable PDF',()=>{const m=fixture();m.importedTransactions.records[0].sourceProvider='minna';const p=read([manual()],m);assert.equal(p.manual[0].status,'incomparable');assert.equal(p.imported.length,0);assert(p.sources.every(s=>s.status==='incomparable'));});
test('alias must resolve one enabled FX Instrument',()=>{const m=fixture();m.instruments.records[0].aliases=['anonymous TRY'];assert.equal(mStatus(manual({symbol:'anonymous TRY'}),m).status,'unique-candidate');m.instruments.records.push({...m.instruments.records[0],id:'second_ins'});assert.equal(mStatus(manual(),m).reason,'INSTRUMENT_AMBIGUOUS');});
test('disabled Instrument is not comparable',()=>{const m=fixture();m.instruments.records[0].enabled=false;assert.equal(mStatus(manual(),m).status,'incomparable');});
test('TRY raw quantity is comparison-only',()=>{const r=mStatus(manual(),fixture());assert.equal(r.matchingFields.quantity,'200000');assert.equal(r.matchingFields.quantityUnit,'baseCurrencyUnits');});
test('HUF reuses 100000-unit Lot definition',()=>{const m=fixture('minna',{quantity:'2000000'});m.instruments.records[0].symbol='HUF/JPY';reseal(m);assert.equal(mStatus(manual({account:'みんなのFX',symbol:'HUF/JPY',contractSize:100000}),m).status,'unique-candidate');});
test('legacy ZAR unit conflict not corrected even when arithmetic totals agree',()=>{const m=fixture();m.instruments.records[0].symbol='ZAR/JPY';reseal(m);assert.equal(mStatus(manual({symbol:'ZAR/JPY',quantity:2,contractSize:100000}),m).reason,'CONTRACT_SIZE_CONFLICT');});
test('unknown official Lot rule incomparable on both sides',()=>{const m=fixture();m.instruments.records[0].symbol='AAA/JPY';reseal(m);const p=read([manual({symbol:'AAA/JPY'})],m);assert.equal(p.manual[0].reason,'LOT_RULE_UNKNOWN');assert.equal(p.imported[0].status,'incomparable');});
test('fractional Number Lot multiplied with decimal arithmetic, no float product',()=>{const m=fixture('lightfx',{quantity:'1230'});assert.equal(mStatus(manual({quantity:0.123}),m).status,'unique-candidate');});
test('small exponent Number expands exactly without tolerance',()=>{const m=fixture('lightfx',{quantity:'0.001'});assert.equal(mStatus(manual({quantity:1e-7}),m).status,'unique-candidate');});
test('decimal price trailing zero normalization',()=>{const m=fixture('lightfx',{price:'3.5000'});assert.equal(mStatus(manual({rate:3.5}),m).status,'unique-candidate');});
for(const [name,edit]of [['rounded price',{rate:4.123}],['side mismatch',{side:'buy'}],['different date',{date:'2034-04-19'}],['different quantity',{quantity:19}],['different action',{category:'new'}]])test(`${name} is unmatched, not approximate`,()=>{const p=read([manual(edit)],fixture());assert.equal(p.manual[0].status,'unmatched-manual');assert.equal(p.imported[0].status,'unmatched-imported');});
test('Number precision loss cannot be repaired with tolerance',()=>{const m=fixture('lightfx',{price:'4.1234567890123456789'});assert.equal(mStatus(manual({rate:Number('4.1234567890123456789')}),m).status,'unmatched-manual');});
test('createdAt and hypothetical manual time ignored, PDF tradeDate is the key',()=>{const m=fixture(),a=manual(),before=read([a],m);a.createdAt=1;a.executedAt='1999-01-01T00:00:00Z';assert.deepEqual(read([a],m),before);m.importedTransactions.records[0].executedAt='2034-04-20T23:59:59';reseal(m);assert.equal(mStatus(a,m).status,'unique-candidate');});
test('settlement date does not change matching month',()=>{assert.equal(mStatus(manual(),fixture('lightfx',{settlementDate:'2034-05-02'})).status,'unique-candidate');});
test('one manual to two identical PDF rows is ambiguous, no ID/time tie-break',()=>{const m=fixture();extra(m,{executedAt:'2034-04-20T12:00:00'});const p=read([manual()],m);assert.equal(p.manual[0].status,'ambiguous');assert(p.imported.every(r=>r.status==='ambiguous'));assert.equal(p.manual[0].importedIds.length,2);});
test('two manuals to one PDF row is ambiguous',()=>{const p=read([manual(),manual({id:'other_manual'})],fixture());assert(p.manual.every(r=>r.status==='ambiguous'));assert.equal(p.imported[0].manualIds.length,2);});
test('duplicate manual identity incomparable, never overwrite Map',()=>{const p=read([manual(),manual()],fixture());assert(p.manual.every(r=>r.reason==='MANUAL_ID_AMBIGUOUS'));assert.equal(p.imported[0].status,'unmatched-imported');});
test('split close equal quantity total flagged for review, not unique',()=>{const m=fixture('lightfx',{quantity:'100000'});extra(m,{quantity:'100000'});const p=read([manual()],m);assert.equal(p.manual[0].status,'ambiguous');assert.equal(p.manual[0].reason,'AGGREGATE_ONLY_REQUIRES_REVIEW');assert(p.imported.every(r=>r.status==='ambiguous'));});
test('many manuals equal one PDF quantity flagged for review',()=>{const p=read([manual({quantity:10}),manual({id:'other',quantity:10})],fixture());assert(p.manual.every(r=>r.status==='ambiguous'));assert.equal(p.imported[0].reason,'AGGREGATE_ONLY_REQUIRES_REVIEW');});
test('no arbitrary subset sum or weighted price search',()=>{const m=fixture('lightfx',{quantity:'100000'});extra(m,{quantity:'150000'});const p=read([manual()],m);assert.equal(p.manual[0].status,'unmatched-manual');assert(p.imported.every(r=>r.status==='unmatched-imported'));});
for(const field of ['realizedPnl','transactionSwap','fee'])test(`${field} never participates in matching`,()=>{for(const value of [null,'0','-21.25']){const m=fixture('lightfx',{[field]:value});assert.equal(mStatus(manual({[field]:'99999'}),m).status,'unique-candidate');}});
test('manual source IDs not required or compared',()=>{const m=fixture();assert.equal(mStatus(manual({sourceOrderId:'unrelated',sourceOpenOrderRef:'unrelated'}),m).status,'unique-candidate');assert.equal(m.importedTransactions.records[0].sourceExecutionId,null);assert(!JSON.stringify(read([manual()],m)).includes(m.importedTransactions.records[0].sourceOrderId));});
test('same collection and facts give stable projection despite metadata changes',()=>{const m=fixture(),a=manual(),p=read([a],m);assert.deepEqual(read(f.copy([a]),f.copy(m)),p);a.memo='changed';a.strategy='changed';a.extra={unknown:'retained'};assert.deepEqual(read([a],m),p);});
test('candidate addition does not switch, active revision switch recomputes IDs',()=>{const m=fixture(),a=manual(),p=read([a],m);f.revision(m,{quantity:'200000',price:'4.1234'});assert.deepEqual(read([a],m).manual,p.manual);f.decision(m,'adopt','collection_b');const next=read([a],m);assert.deepEqual(next.manual[0].importedIds,['tx_b']);assert.equal(next.imported[0].collectionId,'collection_b');assert.equal(m.importedTransactions.records.length,2);});
for(const [name,change]of [
  ['candidate-only',m=>m.transactionSources.records.pop()],
  ['stale',m=>m.transactionSources.records.at(-1).collectionFingerprint='f'.repeat(64)],
  ['broken',m=>m.transactionSources.records.at(-1).collectionId='missing'],
  ['conflict',m=>m.transactionSources.records.push({...m.transactionSources.records.at(-1),id:'conflicting_head'})]
])test(`${name} collection excluded without balance fallback`,()=>{const m=fixture();change(m);m.monthlyAccountStates={records:[{adoptedAccountSnapshotId:'fake'}]};const p=read([manual()],m);assert.deepEqual(p.imported,[]);assert.equal(p.manual[0].status,'incomparable');assert.equal(p.manual[0].reason,'SOURCE_UNAVAILABLE');});
test('defer with current can compare, without current cannot',()=>{const m=fixture();f.decision(m,'defer');assert.equal(mStatus(manual(),m).status,'unique-candidate');const n=f.fixture();f.decision(n,'defer');assert.equal(mStatus(manual(),n).status,'incomparable');});
test('reader fingerprint guard excludes obsolete input',()=>{const m=fixture();assert.equal(read([manual()],m,{expectedFingerprint:'old'}).imported.length,0);});
test('no collection is not confirmed zero; complete adopted empty is explicit',()=>{const m=fixture();m.transactionSources=null;m.importedTransactions=null;const p=read([manual()],m);assert.equal(p.manual[0].status,'unmatched-manual');assert.deepEqual(p.sources,[]);const n=fixture();n.importedTransactions.records=[];n.transactionSources.records[0].transactionIds=[];reseal(n);const empty=read([manual()],n);assert.equal(empty.sources[0].confirmedEmpty,true);assert.deepEqual(empty.imported,[]);});
test('GMO and SBI manual/imported contracts excluded',()=>{const m=fixture(),a=f.legacy(m),p=read([...a,manual({account:'GMO',id:'gmo'}),manual({account:'SBI証券',id:'sbi',assetType:'証券'})],m);assert.equal(p.manual.length,1);assert.equal(p.imported.length,1);});
test('frozen raw records including unknown metadata are never normalized or modified',()=>{const m=fixture(),a=manual({tags:['anon'],extra:{retain:true}}),before=JSON.stringify([a,m]);deepFreeze(m);deepFreeze(a);read([a],m);assert.equal(JSON.stringify([a,m]),before);});
test('result detached; no source or manual metadata copied',()=>{const m=fixture(),a=manual(),p=read([a],m);p.manual[0].matchingFields.quantity='1';p.imported[0].manualIds.push('extra');assert.equal(m.importedTransactions.records[0].quantity,'200000');assert(!JSON.stringify(p).includes('anonymous memo'));assert(!JSON.stringify(p).includes('anonymous strategy'));});
test('History and financial/position consumers remain disconnected',()=>{const m=fixture(),a=[manual()],before=view.resolve(a,m);read(a,m);assert.deepEqual(view.resolve(a,m),before);assert.equal(before.length,2);
  for(const file of ['assets/official-fx-position-view.js','assets/open-positions-view.js','assets/current-asset-view.js','assets/profit-metrics.js','history/transaction-ui.js','history/history.js','top/script.js','profit/soneki.js'])assert(!fs.readFileSync(require.resolve('../'+file),'utf8').includes('TradeScopeFxTransactionCandidateView'),file);
});
test('Backup v15 raw manual plus adopted rows roundtrip preserves candidates, no new key',()=>{const m=fixture(),s=new MemoryStorage(),a=[manual({extra:{retain:true}})];model.createRepository(s).commit(Object.fromEntries(Object.entries(m).filter(([,v])=>v!==null)));s.setItem('tradeScopeTradeHistoryV1',JSON.stringify(a));const raw=s.getItem('tradeScopeTradeHistoryV1'),h=backupHarness(),p=h.TradeScopeBackupExport.buildPayload(s,'http://localhost',f.now),dest=new MemoryStorage();assert.equal(p.backupVersion,16);const inspect=h.TradeScopeBackupFormat.inspectValue(p);assert.equal(inspect.ok,true);h.TradeScopeBackupRestore.execute(inspect.restorePlan,dest);assert.equal(dest.getItem('tradeScopeTradeHistoryV1'),raw);assert.deepEqual(read(a,model.readModels(dest)),read(a,m));assert.equal(Object.keys(model.keys).length,12);});
test('browser-global API loads in dependency order with all Storage access forbidden',()=>{const context=vm.createContext({TextEncoder,localStorage:new Proxy({},{get(){throw Error('STORAGE_FORBIDDEN');}})});vm.runInContext(fs.readFileSync(require.resolve('../import/csv-core.js'),'utf8'),context);for(const file of ['monthly-source-contract','transaction-source-contract','transaction-adoption-view','transaction-reconciliation','transaction-view','transaction-display','fx-transaction-candidate-view'])vm.runInContext(fs.readFileSync(require.resolve('../assets/'+file+'.js'),'utf8'),context);const m=fixture(),a=[manual()];assert.equal(context.TradeScopeFxTransactionCandidateView.project(a,m).manual[0].status,'unique-candidate');});
test('anonymous memory Storage remains byte-identical after projection',()=>{const s=new MemoryStorage(),m=fixture();model.createRepository(s).commit(Object.fromEntries(Object.entries(m).filter(([,v])=>v!==null)));s.setItem('tradeScopeTradeHistoryV1',JSON.stringify([manual()]));const before=s.snapshot(),writes=s.writes;read(JSON.parse(s.getItem('tradeScopeTradeHistoryV1')),model.readModels(s));assert.deepEqual(s.snapshot(),before);assert.equal(s.writes,writes);});
