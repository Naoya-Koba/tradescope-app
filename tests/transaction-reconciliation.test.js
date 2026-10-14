// Invented facts only. No user PDFs, IDs, balances or production Storage.
const test=require('node:test'),assert=require('node:assert/strict');
const recon=require('../assets/transaction-reconciliation.js'),view=require('../assets/transaction-view.js');
const {Memory,storage,tx,now,pdfService,backup,copy}=require('./observation-override-fixture.js');
const parser=require('../import/sbivc-parser.js'),{tradesFixture}=require('./sbivc-trades-fixture.js');
const source=(hash='a')=>({preview:parser.parse(tradesFixture()),fileHash:hash.repeat(64),fileSize:128});
const manual=(id='manual_a',extra={})=>({id,account:'SBI VC',assetType:'暗号資産',symbol:'ZETA/JPY',side:'buy',category:'new',date:'2031-02-10',quantity:5,rate:812.34,memo:'匿名メモ',strategy:'長期',...extra});
function memory(entries=[manual()]){const s=new Memory();s.setItem(recon.manualKey,JSON.stringify(entries));return s;}
const models=s=>storage.readModels(s),records=(s,e)=>models(s)[e]?.records||[];
const decisions=(inspection,decision='replace')=>({...inspection,transactionDecisions:inspection.manualMatches.map(c=>({key:c.key,decision}))});
async function saved(decision='replace'){const s=memory(),svc=pdfService(s),p=source();await svc.save(p,decisions(await svc.inspect(p),decision));return s;}
test('1 manual ↔ 4 spot fills: exact aggregate candidate is read-only and requires confirmation',async()=>{
 const s=memory(),before=s.snapshot(),svc=pdfService(s),p=source(),r=await svc.inspect(p);
 assert.equal(r.manualMatches.length,1);assert.equal(r.manualMatches[0].count,4);assert.equal(r.manualMatches[0].quantity,'5');assert.equal(r.manualMatches[0].price,'812.34');assert.equal(r.manualMatches[0].ambiguous,false);assert.equal(s.snapshot(),before);
 assert.equal((await svc.save(p)).status,'confirmation-required');assert.equal(s.snapshot(),before);
});
for(const decision of ['replace','keep-both','defer'])test('explicit '+decision+' retains source/manual and changes only the logical set',async()=>{
 const s=memory(),raw=s.getItem(recon.manualKey),svc=pdfService(s),p=source();assert.equal((await svc.save(p,decisions(await svc.inspect(p),decision))).status,'saved');
 assert.equal(s.getItem(recon.manualKey),raw);assert.equal(records(s,'importedTransactions').length,4);assert.equal(records(s,'transactionReconciliations')[0].decision,decision);
 const logical=view.resolve(JSON.parse(raw),models(s));assert.equal(logical.length,decision==='replace'?4:5);assert.equal(logical.some(r=>r.id==='manual:manual_a'),decision!=='replace');
 assert.equal(logical.filter(r=>r.sourceProvider==='sbivc').length,4);assert.equal((await svc.inspect(p)).status,decision==='defer'?'reconciliation-ready':'already-imported');
});
test('same hash already saved can confirm the relationship only, without changing any source/model',async()=>{
 const s=memory([]),svc=pdfService(s),p=source();await svc.save(p);s.setItem(recon.manualKey,JSON.stringify([manual()]));const before=models(s),raw=s.getItem(recon.manualKey),ins=await svc.inspect(p);
 assert.equal(ins.status,'reconciliation-ready');assert.equal((await svc.save(p,decisions(ins))).reconciled,true);
 for(const e of Object.keys(storage.keys).filter(e=>e!=='transactionReconciliations'))assert.deepEqual(models(s)[e],before[e]);assert.equal(s.getItem(recon.manualKey),raw);
});
test('decide later can be explicitly confirmed on reimport with the same relation ID and unchanged source',async()=>{
 const s=await saved('defer'),before=models(s),svc=pdfService(s),p=source(),r=await svc.inspect(p);assert.equal(r.status,'reconciliation-ready');
 await svc.save(p,decisions(r));assert.equal(records(s,'transactionReconciliations').length,1);assert.equal(records(s,'transactionReconciliations')[0].id,before.transactionReconciliations.records[0].id);
 for(const e of Object.keys(storage.keys).filter(e=>e!=='transactionReconciliations'))assert.deepEqual(models(s)[e],before[e]);assert.equal(view.resolve(recon.readManual(s).records,models(s)).length,4);
});
test('unmatched manual remains active; 4 imported records remain active',async()=>{const s=memory([manual(),manual('unmatched',{quantity:6})]),svc=pdfService(s),p=source();await svc.save(p,decisions(await svc.inspect(p)));assert.deepEqual(view.resolve(recon.readManual(s).records,models(s)).filter(r=>r.manualId).map(r=>r.manualId),['unmatched']);});
for(const [name,change]of [['quantity',m=>m.quantity=4],['price',m=>m.rate=812.35],['side',m=>m.side='sell'],['account',m=>m.account='GMO'],['instrument',m=>m.symbol='OTHER/JPY'],['day',m=>m.date='2031-02-11']])test('no match on '+name+' mismatch',async()=>{const m=manual();change(m);assert.equal((await pdfService(memory([m])).inspect(source())).manualMatches,undefined);});
test('multiple identical manual candidates are ambiguous: never automatically replace',async()=>{const s=memory([manual(),manual('manual_b')]),svc=pdfService(s),p=source(),r=await svc.inspect(p);assert.equal(r.manualMatches.length,2);assert.ok(r.manualMatches.every(c=>c.ambiguous));const before=s.snapshot();assert.equal((await svc.save(p,decisions(r))).status,'confirmation-required');assert.equal(s.snapshot(),before);await svc.save(p,decisions(r,'defer'));assert.equal(view.resolve(recon.readManual(s).records,models(s)).length,6);});
test('changed manual after confirmation is rejected without writes',async()=>{const s=memory(),svc=pdfService(s),p=source(),r=await svc.inspect(p);s.setItem(recon.manualKey,JSON.stringify([manual('manual_a',{rate:999})]));const before=s.snapshot();await assert.rejects(()=>svc.save(p,decisions(r)));assert.equal(s.snapshot(),before);});
test('same-fact corrected source re-resolves old relation and hides stale imports/manual',async()=>{const s=await saved(),svc=pdfService(s),p=source('b'),old=copy(records(s,'transactionReconciliations')),raw=s.getItem(recon.manualKey);await svc.save(p,await svc.inspect(p));assert.equal(records(s,'importedTransactions').length,8);assert.deepEqual(records(s,'transactionReconciliations'),old);assert.equal(s.getItem(recon.manualKey),raw);const r=view.resolve(recon.readManual(s).records,models(s));assert.equal(r.length,4);const active=view.activeBatches(models(s));assert.ok(r.every(t=>active.has(t.sources[0].importBatchId)));});
test('changed corrected source cannot orphan a confirmed replacement or reactivate manual silently',async()=>{const s=await saved(),svc=pdfService(s),p=source('b');for(const t of p.preview.transactions)t.price='813';const ins=await svc.inspect(p),before=s.snapshot();await assert.rejects(()=>svc.save(p,ins),/訂正内容/);assert.equal(s.snapshot(),before);});
test('editing manual facts deactivates stale relationship rather than hiding the new facts',async()=>{const s=await saved();s.setItem(recon.manualKey,JSON.stringify([manual('manual_a',{quantity:8})]));assert.equal(view.resolve(recon.readManual(s).records,models(s)).length,5);});
for(const entity of ['accounts','instruments','importBatches','accountSnapshots','holdingSnapshots','monthlyAccountInputs','importedTransactions','transactionReconciliations'])test('atomic rollback failure at '+entity+' restores every source and manual byte',async()=>{const s=memory(),svc=pdfService(s),p=source(),ins=await svc.inspect(p),before=s.snapshot();s.failKey=storage.keys[entity];await assert.rejects(()=>svc.save(p,decisions(ins)));assert.equal(s.snapshot(),before);assert.equal(s.getItem(tx.journalKey),null);});
test('rollback failure keeps journal and blocks next save until explicit recovery',async()=>{const s=memory(),svc=pdfService(s),p=source(),ins=await svc.inspect(p);s.failKey=storage.keys.transactionReconciliations;s.permanent=true;await assert.rejects(()=>svc.save(p,decisions(ins)));assert.notEqual(s.getItem(tx.journalKey),null);await assert.rejects(()=>svc.save(p,decisions(ins)),/ジャーナル/);s.permanent=false;tx.recover(s);assert.equal(s.getItem(tx.journalKey),null);assert.equal(records(s,'importedTransactions').length,0);});
test('published v13 roundtrip preserves relationships, original manual and logical history exactly',async()=>{const s=await saved(),p=backup(s).build();p.backupVersion=13;delete p.data.models.monthlySources;const target=memory([]),api=backup(target),r=api.format.inspectValue(p);assert.equal(p.backupVersion,13);assert.equal(r.ok,true);api.restore.execute(r.restorePlan,target);assert.deepEqual(copy(api.build().data),{...copy(p.data),models:{...copy(p.data.models),monthlySources:null}});assert.deepEqual(view.resolve(recon.readManual(target).records,models(target)),view.resolve(recon.readManual(s).records,models(s)));});
for(let version=1;version<=12;version++)test('released Backup v'+version+' does not acquire the new relation contract',async()=>{const s=await saved(),p=copy(backup(memory([])).build());p.backupVersion=version;if(version===1)delete p.data.models;else p.data.models=Object.fromEntries(storage.backupModelEntities[version].map(e=>[e,null]));const before=s.getItem(storage.keys.transactionReconciliations),api=backup(s),r=api.format.inspectValue(p);assert.equal(r.ok,true);api.restore.execute(r.restorePlan,s);assert.equal(s.getItem(storage.keys.transactionReconciliations),version===1?before:null);});
test('released nonempty v12 backup roundtrip keeps every original field, no relation coercion',async()=>{const s=await saved(),p=copy(backup(s).build());p.backupVersion=12;delete p.data.models.transactionReconciliations;delete p.data.models.monthlySources;const target=memory([]),api=backup(target),r=api.format.inspectValue(p);assert.equal(r.ok,true);api.restore.execute(r.restorePlan,target);for(const e of storage.backupModelEntities[12])assert.deepEqual(copy(models(target)[e]),p.data.models[e]);assert.equal(models(target).transactionReconciliations,null);});
for(const [name,mutate]of [['unknown',r=>r.filename='forbidden'],['version',r=>r.schemaVersion=2],['missing member',r=>r.members[0].id='missing'],['same member',r=>r.members.push(r.members[0])],['account',r=>r.facts.accountId='acc_gmo_fx'],['quantity',r=>r.facts.quantity='999'],['decision',r=>r.decision='auto'],['subset',r=>r.members.pop()]])test('malformed relation '+name+' refuses restore before writing',async()=>{const s=await saved(),p=copy(backup(s).build());mutate(p.data.models.transactionReconciliations.records[0]);const t=memory([]),before=t.snapshot();assert.equal(backup(t).format.inspectValue(p).ok,false);assert.equal(t.snapshot(),before);});
test('relation is immutable; physical removal or manual overwrite is not a replacement API',async()=>{const s=await saved(),m=models(s),before=s.snapshot();m.transactionReconciliations.records[0].decision='keep-both';assert.throws(()=>storage.createRepository(s).commit({transactionReconciliations:m.transactionReconciliations}));assert.equal(s.snapshot(),before);});
test('v13 restore mid-relation write failure rolls back legacy and all new keys',async()=>{const s=await saved(),p=backup(s).build(),t=memory([manual('other')]),before=t.snapshot();t.failKey=storage.keys.transactionReconciliations;const api=backup(t);assert.throws(()=>api.restore.execute(api.format.inspectValue(p).restorePlan,t));assert.equal(t.snapshot(),before);});
test('no original text/PII/UI labels are persisted in relation; original manual metadata stays only in original',async()=>{const s=await saved(),r=JSON.stringify(records(s,'transactionReconciliations'));assert.doesNotMatch(r,/匿名メモ|長期|PRIVATE|filename|pdfText|rawText|fullText/);assert.equal(records(s,'monthlyAccountStates').length,0);});
test('exact decimal aggregate quantity is not rounded through Number',()=>{assert.equal(recon.sum(['0.100000000000000001','0.2']),'0.300000000000000001');});
test('duplicate manual IDs with different facts remain ambiguous and cannot replace',async()=>{
 const s=memory([manual(),manual('manual_a',{quantity:9})]),svc=pdfService(s),p=source(),r=await svc.inspect(p),before=s.snapshot();
 assert.equal(r.manualMatches[0].ambiguous,true);assert.equal((await svc.save(p,decisions(r))).status,'confirmation-required');assert.equal(s.snapshot(),before);
});
test('manual changed during storage verification rolls back sources without overwriting the external edit',async()=>{
 const s=memory(),svc=pdfService(s),p=source(),r=await svc.inspect(p),original=s.setItem.bind(s),changed=JSON.stringify([manual('manual_a',{quantity:9})]);
 s.setItem=(k,v)=>{original(k,v);if(k===storage.keys.transactionReconciliations)original(recon.manualKey,changed);};
 await assert.rejects(()=>svc.save(p,decisions(r)));assert.equal(s.getItem(recon.manualKey),changed);assert.equal(records(s,'importedTransactions').length,0);assert.equal(records(s,'transactionReconciliations').length,0);
});
class Element{constructor(){this.children=[];this.value='';this.textContent='';}append(...v){this.children.push(...v);}replaceChildren(...v){this.children=v;}setAttribute(k,v){this[k]=v;}}
const allText=e=>[e.textContent,...e.children.map(allText)].join(' ');
test('comparison UI exposes exact source wording, choices and keeps fractional precision',()=>{
 const container=new Element(),ui=require('../import/transaction-confirmation.js').create({createElement:()=>new Element()},container);
 const candidate={key:'k',account:'匿名口座',symbol:'ZETA/JPY',side:'buy',quantity:'1234.123456789',price:'812.34',count:4,sourceType:'pdf',ambiguous:false,facts:{quantityUnit:'baseAssetUnits',currency:'JPY'}};
 ui.show([candidate]);assert.match(allText(container),/手入力のデータと一致します/);assert.match(allText(container),/PDFデータに置き換える/);assert.match(allText(container),/両方残す.*今回は判断しない/);assert.match(allText(container),/1,234\.123456789/);assert.deepEqual(ui.decisions(),[{key:'k',decision:'replace'}]);
 ui.show([{...candidate,sourceType:'csv',ambiguous:true}]);assert.match(allText(container),/一致する可能性があります/);assert.match(allText(container),/CSVデータに置き換える/);assert.equal(ui.decisions()[0].decision,'defer');assert.equal(container.children[0].children.at(-1).children[0].children[0].disabled,true);
});
module.exports={memory,manual,source,decisions};
test('GMO exact 1:1 explicit unit conversion uses persisted contractSize, same shared candidate/save path',async()=>{
 const cryptoApi=require('node:crypto').webcrypto,engine=require('../import/gmo-save.js'),parser=require('../import/gmo-parser.js'),{trades}=require('./gmo-trades-fixture.js');
 const s=memory([{id:'gmo_manual',account:'GMO',assetType:'FX',symbol:'AAA/JPY',category:'new',side:'buy',date:'2026-09-01',quantity:0.0002,contractSize:10000,rate:12.345678}]);
 const p={preview:parser.parse(trades()),fileHash:'c'.repeat(64),fileSize:128},svc=engine.createService(s,{cryptoApi,clock:()=>now}),r=await svc.inspect(p);
 assert.equal(r.manualMatches[0].count,1);assert.equal(r.manualMatches[0].quantity,'2');const original=s.getItem(recon.manualKey);
 assert.equal((await svc.save(p,decisions(r))).status,'saved');assert.equal(s.getItem(recon.manualKey),original);assert.equal(view.resolve(recon.readManual(s).records,models(s)).length,2);
});
test('SBI CSV exact 1:1 uses the shared relation journal and keeps settlement amount out of P/L',async()=>{
 const cryptoApi=require('node:crypto').webcrypto,engine=require('../import/sbi-save.js'),parser=require('../import/sbi-parser.js');
 const s=memory([{id:'sbi_manual',account:'SBI',assetType:'Stock',symbol:'架空株',category:'new',side:'buy',date:'2031-02-10',quantity:4,quantityUnit:'株',rate:12}]);
 const text='約定日,銘柄,銘柄コード,市場,商品区分,取引,預り,約定数量,約定単価,受渡日,受渡金額/決済損益,手数料/諸経費等\n2031/02/10,架空株,ZZ01,東証,国内株式,現物買,特定,4,12,2031/02/13,-48,--\n';
 const p={preview:parser.parse(text,'transactions'),metadata:{hash:'d'.repeat(64),size:Buffer.byteLength(text)},targetMonth:null,snapshotAsOf:null};
 const svc=engine.createService(s,{cryptoApi,clock:()=>now}),r=await svc.inspect(p);assert.equal(r.manualMatches[0].sourceType,'csv');assert.equal(r.manualMatches[0].count,1);
 await svc.save(p,decisions(r));assert.equal(records(s,'rawTransactions').length,1);assert.equal(records(s,'rawTransactions')[0].realizedPnl,null);assert.equal(view.resolve(recon.readManual(s).records,models(s)).length,1);
 assert.equal((await svc.inspect(p)).status,'already-imported');
});
test('unknown FX unit / contractSize does not match a reported currency count',()=>{
 const m={instruments:{records:[{id:'fx',assetType:'FX',symbol:'AAA/JPY',enabled:true}]}},r={id:'manual',assetType:'FX',account:'GMO',symbol:'AAA/JPY',category:'new',side:'buy',date:'2031-02-10',quantity:1,rate:3};assert.equal(recon.facts('manual',r,m),null);
});
test('FX execution quote is distinct from individual P/L currency',()=>{
 const m={instruments:{records:[{id:'fx',assetType:'FX',symbol:'AAA/USD',quoteCurrency:'USD',enabled:true}]}},base={accountId:'acc_gmo_fx',instrumentId:'fx',tradeDate:'2031-02-10',side:'buy',normalizedTransactionType:'open',quantity:'10000',quantityUnit:'gmo-reported-count',price:'1.23',currency:'JPY'};
 assert.equal(recon.facts('importedTransactions',base,m).currency,'USD');assert.equal(recon.facts('manual',{account:'GMO',assetType:'FX',symbol:'AAA/USD',date:base.tradeDate,side:'buy',category:'new',quantity:1,contractSize:10000,rate:1.23},m).currency,'USD');
});
test('browser module order loads common dependencies before Storage and every import service',()=>{
 const fs=require('node:fs'),html=fs.readFileSync('import.html','utf8');
 for(const service of ['sbi','gmo','sbivc']){assert.ok(html.indexOf('assets/transaction-view.js')<html.indexOf('import/'+service+'-save.js'));assert.ok(html.indexOf('assets/transaction-reconciliation.js')<html.indexOf('import/'+service+'-save.js'));}
 for(const page of ['index.html','history.html','import.html','profit/soneki.html']){const h=fs.readFileSync(page,'utf8');assert.ok(h.indexOf('assets/transaction-reconciliation.js')<h.indexOf('assets/data-model-storage.js'));}
});
test('new shared matching and confirmation modules have no storage write, upload or unsafe DOM capability',()=>{
 const fs=require('node:fs');for(const path of ['assets/transaction-reconciliation.js','import/transaction-confirmation.js'])assert.doesNotMatch(fs.readFileSync(path,'utf8'),/localStorage|sessionStorage|indexedDB|\.setItem\(|fetch\(|sendBeacon|console\.|innerHTML/);
});
test('ambiguous existing instruments, similar names and malformed manual never auto-match',()=>{
 const m={instruments:{records:[{id:'a',assetType:'Crypto',symbol:'ZETA/JPY',enabled:true},{id:'b',assetType:'Crypto',symbol:'ZETA/JPY',enabled:true}]}};assert.equal(recon.facts('manual',manual(),m),null);assert.equal(recon.facts('manual',manual('m',{symbol:'ZETA-LIKE/JPY'}),{instruments:{records:[m.instruments.records[0]]}}),null);
});
test('correction with changed fill distribution/ID/fee cannot reuse a relation on aggregate alone',async()=>{
 for(const change of [p=>{p.preview.transactions[0].quantity='2';p.preview.transactions[1].quantity='1.75';},p=>p.preview.transactions[0].providerExecutionId='new-id',p=>p.preview.transactions[0].fee='12']){
  const s=await saved(),svc=pdfService(s),p=source('b');change(p);const before=s.snapshot(),inspection=await svc.inspect(p);await assert.rejects(()=>svc.save(p,inspection));assert.equal(s.snapshot(),before);
 }
});
