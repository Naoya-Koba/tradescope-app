// Synthetic source only; no private PDF, real balances or production storage.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const crypto=require('node:crypto').webcrypto,model=require('../assets/data-model-storage.js'),tx=require('../assets/storage-transaction.js');
const save=require('../import/sbivc-save.js'),parser=require('../import/sbivc-parser.js'),{fixture}=require('./sbivc-pdf-fixture.js');
const inputUI=require('../assets/observation-input-ui.js');
const now='2031-03-01T12:34:56.000Z',copy=x=>JSON.parse(JSON.stringify(x));
class Memory{
 constructor(){this.data=new Map([['tradingData','{"2031":{"2":{"sbivc":{"realizedPnL":17}}}}'],['tradeScopeTradeHistoryV1','[{"id":"manual_crypto","symbol":"ETH/JPY"}]']]);this.failKey=null;this.persistentFail=false;this.writes=0;}
 getItem(k){return this.data.get(k)??null;}
 setItem(k,v){if(k===this.failKey){if(!this.persistentFail)this.failKey=null;throw Error('quota');}this.writes++;this.data.set(k,v);}
 removeItem(k){if(k===this.failKey&&this.persistentFail)throw Error('quota');this.data.delete(k);}
 snapshot(){return JSON.stringify([...this.data]);}
}
function source(hash='a',options={}){return{preview:parser.parse(fixture(options)),fileHash:hash.repeat(64),fileSize:128};}
const service=s=>save.createService(s,{cryptoApi:crypto,clock:()=>now});
const records=(s,k)=>model.readModels(s)[k]?.records||[];
async function saved(){const s=new Memory();assert.equal((await service(s).save(source())).status,'saved');return s;}
function backup(s){
 const code=fs.readFileSync('top/script.js','utf8'),context=vm.createContext({window:{location:{origin:'http://127.0.0.1:57680'},TradeScopeDataStorage:model,TradeScopeStorageTransaction:tx},localStorage:s,
 document:{getElementById:()=>null,addEventListener(){}},isEmptyPlainRecord:v=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===0,
 PROFIT_STORAGE_KEY_TRADING:'tradingData',PROFIT_STORAGE_KEY_INITIAL:'yearInitialFunds',PROFIT_STORAGE_KEY_INITIAL_UNREALIZED:'yearInitialUnrealized',PROFIT_STORAGE_KEY_TOP_SUMMARY_SNAPSHOT:'tradeScopeTopSummarySnapshotV1',console:{log(){throw Error('log forbidden');},error(){throw Error('log forbidden');}}});
 vm.runInContext(code.slice(code.indexOf('// ===== Backup Format Core'),code.indexOf('function exportAllData()')),context);
 return{build:()=>context.window.TradeScopeBackupExport.buildPayload(s,'http://127.0.0.1:57680',now),format:context.window.TradeScopeBackupFormat,restore:context.window.TradeScopeBackupRestore};
}
test('inspect/read/initialization never seeds; anonymous normal save uses one verified journal',async()=>{
 const s=new Memory(),svc=service(s),before=s.snapshot();assert.equal((await svc.inspect(source())).status,'ready');assert.equal(svc.read('2031-02'),null);assert.equal(s.snapshot(),before);
 assert.equal((await svc.save(source())).status,'saved');assert.equal(records(s,'accounts').length,1);assert.equal(records(s,'instruments').length,3);
 assert.equal(records(s,'importBatches').length,1);assert.equal(records(s,'accountSnapshots').length,1);assert.equal(records(s,'holdingSnapshots').length,3);assert.equal(s.getItem(tx.journalKey),null);
 const p=svc.read('2031-02');assert.equal(p.input.schemaVersion,3);assert.equal(p.complete,false);assert.equal(p.realizedPnl,null);assert.equal(p.unrealizedPnl,null);
});
test('official decimal quantity/rate/valuation retained; cost and P/L null',async()=>{
 const s=await saved(),h=records(s,'holdingSnapshots')[0],a=records(s,'accountSnapshots')[0];
 assert.equal(h.quantity,'0.1234567890123456789');assert.equal(h.marketPrice,'321.123456789');assert.equal(h.marketValue,'42.125');
 assert.equal(h.acquisitionPrice,null);assert.equal(h.unrealizedPnl,null);assert.equal(a.netAssetValue,null);assert.equal(a.unrealizedPnl,null);assert.equal(a.reportedMonthlyRealizedPnl,null);
 assert.equal(a.assetValue,'1234567');assert.equal(a.cashBalance,'20000');assert.equal(a.importedAt,now);assert.equal(a.snapshotAsOf,'2031-02-28');
});
test('multiple/4+ character assets use exact Crypto symbol without 3-letter coercion',async()=>{const s=await saved(),i=records(s,'instruments').find(i=>i.symbol==='USDC/JPY');assert.equal(i.quoteCurrency,'JPY');assert.equal(i.baseCurrency,undefined);});
test('existing Crypto Instrument metadata and legacy manual ETH/JPY retained',async()=>{
 const s=new Memory(),repo=model.createRepository(s);repo.save('instruments',[{id:'old_eth',assetType:'Crypto',symbol:'ETH/JPY',displayName:'Existing anonymous label',enabled:true,aliases:['old label']}]);
 const before=s.getItem(model.keys.instruments),legacy=s.getItem('tradeScopeTradeHistoryV1');await service(s).save(source());
 assert.deepEqual(records(s,'instruments').find(i=>i.id==='old_eth'),JSON.parse(before).records[0]);assert.equal(records(s,'instruments').length,3);
 assert.equal(records(s,'holdingSnapshots').find(h=>h.instrumentId==='old_eth').quantity,'0.1234567890123456789');assert.equal(s.getItem('tradeScopeTradeHistoryV1'),legacy);
});
test('ambiguous Instrument mapping stops with no writes',async()=>{const s=new Memory();model.createRepository(s).save('instruments',['one','two'].map(id=>({id,assetType:'Crypto',symbol:'ETH/JPY',displayName:'ETH/JPY',enabled:true})));const before=s.snapshot();assert.equal((await service(s).save(source())).status,'conflict');assert.equal(s.snapshot(),before);});
test('same full identity/hash is no-op after reload/service recreation',async()=>{const s=await saved(),before=s.snapshot();assert.equal((await service(s).inspect(source())).status,'already-imported');assert.equal((await service(s).save(source())).status,'already-imported');assert.equal(s.snapshot(),before);});
test('hash alone cannot identify source; other month stays independent',async()=>{const s=await saved();const next=source('a',{period:'2031/03/01 ～ 2031/03/31',basis:'2031/03/31'});assert.equal((await service(s).save(next)).status,'saved');assert.equal(records(s,'importBatches').length,2);});
test('same hash inconsistent size/content is blocked, not mistaken for complete save',async()=>{const s=await saved(),before=s.snapshot(),a=source();a.fileSize++;assert.equal((await service(s).save(a)).status,'conflict');const b=source();b.preview.spotHoldings[0].quantity='2';assert.equal((await service(s).save(b)).status,'conflict');assert.equal(s.snapshot(),before);});
test('correction/cancel are non-mutating until explicit guarded confirmation; old sources retained',async()=>{
 const s=await saved(),svc=service(s),before=s.snapshot(),next=source('b',{assets:['ETH','SOL']});
 const inspection=await svc.inspect(next);assert.equal(inspection.status,'review-required');assert.equal((await svc.save(next)).status,'review-required');assert.equal(s.snapshot(),before);
 const old=svc.read('2031-02');assert.equal((await svc.save(next,inspection)).status,'saved');const active=svc.read('2031-02');
 assert.equal(active.input.id,old.input.id);assert.notEqual(active.snapshot.id,old.snapshot.id);assert.equal(active.holdings.length,2);
 assert.equal(records(s,'holdingSnapshots').length,5);assert.equal(records(s,'accountSnapshots').length,2);assert.equal(active.input.sourceHistory[0].adoptedAccountSnapshotId,old.snapshot.id);
 assert.equal((await svc.save(source())).status,'already-imported');assert.equal(svc.read('2031-02').snapshot.id,active.snapshot.id);
});
test('stale correction guard cannot overwrite newly adopted source',async()=>{const s=await saved(),svc=service(s),guard=await svc.inspect(source('b'));await svc.save(source('c'),await svc.inspect(source('c')));const before=s.snapshot();assert.equal((await svc.save(source('b'),guard)).status,'review-required');assert.equal(s.snapshot(),before);});
for(const entity of ['instruments','importBatches','accountSnapshots','holdingSnapshots','monthlyAccountInputs'])test('atomic failure at '+entity+' rolls back new Account/Instrument/Batch/all snapshots',async()=>{const s=new Memory(),before=s.snapshot();s.failKey=model.keys[entity];await assert.rejects(()=>service(s).save(source()));assert.equal(s.snapshot(),before);assert.equal(s.getItem(tx.journalKey),null);});
test('journal write failure leaves all data untouched',async()=>{const s=new Memory(),before=s.snapshot();s.failKey=tx.journalKey;await assert.rejects(()=>service(s).save(source()));assert.equal(s.snapshot(),before);});
test('rollback inability retains journal and blocks following save',async()=>{const s=new Memory();s.setItem(model.keys.accounts,JSON.stringify({schemaVersion:1,updatedAt:now,records:model.initialAccounts()}));s.failKey=model.keys.accounts;s.persistentFail=true;const changed=source();
 // Failure after an existing value was replaced, then an earlier written key cannot be rolled back.
 const set=s.setItem.bind(s);s.failKey=null;let triggered=false;s.setItem=(k,v)=>{if(k===model.keys.holdingSnapshots&&!triggered){triggered=true;s.failKey=model.keys.importBatches;s.persistentFail=true;throw Error('quota');}set(k,v);};
 await assert.rejects(()=>service(s).save(changed));assert.notEqual(s.getItem(tx.journalKey),null);await assert.rejects(()=>service(s).save(changed),/ジャーナル/);
});
test('null rate vs relevant explicit zero retained, no fake cost/P/L or State',async()=>{const s=await saved(),svc=service(s),zero=source('b',{zero:true,blankRate:true});await svc.save(zero,await svc.inspect(zero));const holdings=svc.read('2031-02').holdings;assert.equal(holdings.length,3);assert.ok(holdings.every(h=>h.marketPrice===null&&h.marketValue==='0'&&h.unrealizedPnl===null));assert.equal(s.getItem(model.keys.monthlyAccountStates),null);});
test('empty spot portfolio can save explicit cash observation without invented holding',async()=>{const s=new Memory();await service(s).save(source('a',{assets:[]}));assert.equal(records(s,'holdingSnapshots').length,0);assert.equal(records(s,'instruments').length,0);assert.equal(records(s,'accountSnapshots').length,1);});
test('leverage/source events never merge into spot or monthly canonical records',async()=>{const s=await saved();assert.ok(records(s,'holdingSnapshots').every(h=>h.schemaVersion===1&&h.rawFields===undefined));for(const e of ['rawTransactions','importedTransactions','monthlyAccountStates'])assert.equal(s.getItem(model.keys[e]),null);});
test('PII, PDF body, path/name, cashflow and reward do not persist',async()=>{const s=await saved(),text=s.snapshot();assert.doesNotMatch(text,/PRIVATE_PERSON|PRIVATE_ADDRESS|PHONE_123|ACCOUNT_123|filename|fileName|absolutePath|baseAsset|ステーキング|fullText|pdfBinary/);});
test('malformed source cannot write; invalid quantity/ticker/provider/month/zero-vs-null reject',async()=>{
 for(const mutate of [x=>x.preview.valid=false,x=>x.preview.report.provider='gmo',x=>x.preview.report.snapshotAsOf='2031-02-27',x=>x.preview.spotHoldings[0].quantity=null,x=>x.preview.spotHoldings[0].asset='PRIVATE NAME',x=>x.filename='private.pdf']){const s=new Memory(),before=s.snapshot(),a=source();mutate(a);await assert.rejects(()=>service(s).save(a));assert.equal(s.snapshot(),before);}
});
test('v10 export/empty restore/re-export exactly protects active and old sources',async()=>{const s=await saved(),svc=service(s);await svc.save(source('b'),await svc.inspect(source('b')));const h=backup(s),payload=h.build();assert.equal(payload.backupVersion,13);const target=new Memory(),r=backup(target),p=r.format.inspectValue(payload);assert.equal(p.ok,true);r.restore.execute(p.restorePlan,target);assert.deepEqual(copy(r.build().data),copy(payload.data));assert.equal(service(target).read('2031-02').holdings.length,3);});
test('v9 rejects new observation-only Input, v10 accepts; fields are not silently stripped',async()=>{const s=await saved(),payload=backup(s).build();assert.throws(()=>model.validateBackupModels(9,payload.data.models));assert.equal(model.validateBackupModels(10,Object.fromEntries(model.backupModelEntities[10].map(k=>[k,payload.data.models[k]]))),true);});
for(let version=1;version<=9;version++)test('old v'+version+' restore preserves published semantics',async()=>{const sourceStorage=new Memory(),h=backup(sourceStorage),payload=copy(h.build());payload.backupVersion=version;
 if(version===1)delete payload.data.models;else{const keys=model.backupModelEntities[version];payload.data.models=Object.fromEntries(keys.map(k=>[k,null]));}
 const target=await saved(),r=backup(target),before=target.getItem(model.keys.monthlyAccountInputs),inspection=r.format.inspectValue(payload);assert.equal(inspection.ok,true);r.restore.execute(inspection.restorePlan,target);
 assert.equal(target.getItem(model.keys.monthlyAccountInputs),version===1?before:null);
});
test('v10 absent optional data and explicit null model roundtrip',()=>{const s=new Memory(),h=backup(s),p=h.build(),target=new Memory(),r=backup(target);r.restore.execute(r.format.inspectValue(p).restorePlan,target);assert.deepEqual(copy(r.build().data),copy(p.data));assert.ok(Object.values(p.data.models).every(v=>v===null));});
test('unknown observation field/version/missing reference/month mismatch reject before restore writes',async()=>{const s=await saved(),payload=backup(s).build();for(const mutate of [p=>p.data.models.monthlyAccountInputs.records[0].unknown=true,p=>p.data.models.monthlyAccountInputs.records[0].schemaVersion=77,p=>p.data.models.monthlyAccountInputs.records[0].adoptedAccountSnapshotId='missing',p=>p.data.models.monthlyAccountInputs.records[0].targetMonth='2031-03',p=>p.data.models.accountSnapshots.records[0].netAssetValue='123']){const p=copy(payload);mutate(p);const target=new Memory(),r=backup(target),before=target.snapshot();assert.equal(r.format.inspectValue(p).ok,false);assert.equal(target.snapshot(),before);}});
test('v10 restore partial failure rolls back old legacy and every new-model key',async()=>{const s=await saved(),payload=backup(s).build(),target=new Memory(),before=target.snapshot(),r=backup(target);target.failKey=model.keys.monthlyAccountInputs;assert.throws(()=>r.restore.execute(r.format.inspectValue(payload).restorePlan,target));assert.equal(target.snapshot(),before);});
class Element{
 constructor(tag){this.tagName=tag;this.children=[];this.textContent='';this.dataset={};this.style={};this.attributes={};this.events={};
  this.classList={contains:k=>this.className.split(' ').includes(k),add:k=>{if(!this.classList.contains(k))this.className+=' '+k;},remove:k=>{this.className=this.className.split(' ').filter(c=>c!==k).join(' ');},toggle:k=>{const open=!this.classList.contains(k);this.classList[open?'add':'remove'](k);return open;}};}
 append(...v){this.children.push(...v);}
 replaceChildren(...v){this.children=[...v];}
 setAttribute(k,v){this.attributes[k]=v;}
 addEventListener(k,fn){this.events[k]=fn;}
}
const text=e=>[e.textContent,...e.children.map(text)].join(' ');
async function observationCard(){const adapter=await saved();return{adapter,card:inputUI.render({document:{createElement:tag=>new Element(tag)},adapter,accountId:'acc_sbivc_crypto',targetMonth:'2031-02',displayName:'SBI VC',color:'#123456'})};}
function bindAccountToggle(card){
 const [button,body]=card.children;body.scrollHeight=120;
 const source=fs.readFileSync('profit/soneki.js','utf8');
 const start=source.indexOf("  document.querySelectorAll('.account-toggle').forEach(btn => {");
 const end=source.indexOf('\n  UNREALIZED_HELPER_ACCOUNTS.forEach',start);
 vm.runInNewContext(source.slice(start,end),{document:{querySelectorAll:()=>[button]},container:{querySelector:selector=>selector==='[data-account-body="sbivc"]'?body:null},requestAnimationFrame:fn=>fn()});
 return{button,body};
}
test('SBI VC saved Input defaults collapsed with common button, color and accessible controls',async()=>{
 const {card}=await observationCard(),[button,body]=card.children;
 assert.equal(card.className,'account-card');assert.equal(button.tagName,'button');assert.equal(button.type,'button');
 assert.equal(button.dataset.accountToggle,'sbivc');assert.equal(button.attributes['aria-expanded'],'false');
 assert.equal(button.attributes['aria-controls'],body.id);assert.equal(body.dataset.accountBody,'sbivc');assert.equal(body.className,'account-body');
 assert.equal(button.children[0].className,'account-title');assert.equal(button.children[0].children[0].style.backgroundColor,'#123456');
 assert.equal(text(button).trim(),'SBI VC ▼');assert.doesNotMatch(text(button),/保存済み|2031|JPY|現物保有/);
 const css=fs.readFileSync('profit/soneki.css','utf8');assert.match(css,/\.account-body\s*\{[^}]*visibility: hidden/s);assert.match(css,/\.account-body\.open\s*\{[^}]*visibility: visible/s);
});
test('shared Input header click expands and collapses SBI VC without Storage writes',async()=>{
 const {card,adapter}=await observationCard(),before=adapter.snapshot(),{button,body}=bindAccountToggle(card);
 button.events.click();assert.equal(button.attributes['aria-expanded'],'true');assert.equal(body.classList.contains('open'),true);assert.equal(body.style.maxHeight,'120px');
 assert.match(text(body),/資産・保有情報を保存済み/);assert.match(text(body),/2031\/02|JPY残高|帳票上の資産合計|現物保有（3銘柄）/);
 button.events.click();assert.equal(button.attributes['aria-expanded'],'false');assert.equal(body.classList.contains('open'),false);assert.equal(body.style.maxHeight,'0px');
 button.events.click();assert.equal(body.classList.contains('open'),true);assert.equal(adapter.snapshot(),before);
});
test('holdings disclosure resizes the common expanded body without opening a collapsed card',async()=>{
 const {card}=await observationCard(),{button,body}=bindAccountToggle(card),details=body.children[2];
 details.events.toggle();assert.equal(body.style.maxHeight,undefined);button.events.click();body.scrollHeight=640;details.events.toggle();assert.equal(body.style.maxHeight,'640px');
 button.events.click();details.events.toggle();assert.equal(body.style.maxHeight,'0px');
});
test('reload reads identical saved observation into a newly collapsed read-only card',async()=>{
 const {card,adapter}=await observationCard(),before=adapter.snapshot();bindAccountToggle(card).button.events.click();
 const reloaded=new Memory();for(const key of Object.values(model.keys)){const value=adapter.getItem(key);if(value!==null)reloaded.setItem(key,value);}
 const next=inputUI.render({document:{createElement:tag=>new Element(tag)},adapter:reloaded,accountId:'acc_sbivc_crypto',targetMonth:'2031-02',displayName:'SBI VC'});
 assert.equal(next.children[0].attributes['aria-expanded'],'false');assert.equal(text(next.children[1]),text(card.children[1]));
 const tags=e=>[e.tagName,...e.children.flatMap(tags)];assert.ok(!tags(next.children[1]).includes('input'));assert.match(text(next.children[1]),/修正/);assert.equal(adapter.snapshot(),before);
});
test('45-row saved source shows only relevant positive holdings inside the shared body',async()=>{
 const adapter=new Memory();await service(adapter).save(listedSource());const before=adapter.snapshot();
 const card=inputUI.render({document:{createElement:tag=>new Element(tag)},adapter,accountId:'acc_sbivc_crypto',targetMonth:'2031-02',displayName:'SBI VC'});
 assert.match(text(card.children[1]),/現物保有（1銘柄）/);assert.doesNotMatch(text(card),/COIN2\/JPY|COIN45\/JPY/);assert.equal(adapter.snapshot(),before);
});
test('asset observations and manual overrides do not alter shared Top, allocation, Summary or trend amounts',async()=>{
 const s=new Memory(),context={window:{}};vm.runInNewContext(fs.readFileSync('assets/profit-metrics.js','utf8'),context);
 const display=require('../assets/monthly-display-view.js'),f=require('./monthly-display-fixture.js').fixture();
 const view=models=>display.create(context.window.TradeScopeProfitMetrics,f.tradingData,f.initialFunds,f.initialUnrealized,models,f.accounts);
 const before=view(f.models);await service(s).save(source('a',{period:'2026/09/01 ～ 2026/09/30',basis:'2026/09/30'}));
 const manual=require('../assets/observation-override-save.js').createService(s),prepared=manual.inspect('acc_sbivc_crypto','2026-09');
 manual.save({accountId:'acc_sbivc_crypto',targetMonth:'2026-09',account:{...prepared.adopted,assetValue:'9'},
  holdings:prepared.holdings.map(h=>({holdingSnapshotId:h.holdingSnapshotId,instrumentId:h.instrumentId,values:h.adopted}))},{expectedModels:prepared.models});
 const added=model.readModels(s),merged=copy(f.models);for(const entity of Object.keys(model.keys))if(added[entity])merged[entity]={...added[entity],records:[...(merged[entity]?.records||[]),...added[entity].records]};
 const after=view(merged),amounts=d=>({month:d.month,net:d.net,confirmed:d.confirmed,netPnl:d.netPnl,accountData:d.accountData});
 assert.deepEqual(amounts(after.dashboard(2026)),amounts(before.dashboard(2026)));assert.deepEqual(after.month(2026,9),before.month(2026,9));
 assert.deepEqual(after.yearlyTotals(2026),before.yearlyTotals(2026));assert.deepEqual(after.series(2026).total,before.series(2026).total);
 assert.deepEqual(after.series(2026).performanceTotalSeries,before.series(2026).performanceTotalSeries);
});
test('Input read-only uses only adopted holdings; no hidden identifiers/fake P/L/storage writes',async()=>{const s=await saved(),svc=service(s);await svc.save(source('b',{assets:['SOL']}),await svc.inspect(source('b',{assets:['SOL']})));const before=s.snapshot(),d={createElement:()=>new Element()},card=inputUI.render({document:d,adapter:s,accountId:'acc_sbivc_crypto',targetMonth:'2031-02',displayName:'SBI VC'}),t=text(card);assert.match(t,/資産・保有情報を保存済み|SOL\/JPY/);assert.doesNotMatch(t,/ETH\/JPY|月次損益|取得原価|as_|batch_|ins_/);assert.equal(s.snapshot(),before);assert.equal(inputUI.render({document:d,adapter:s,accountId:'acc_sbivc_crypto',targetMonth:'2031-01',displayName:'SBI VC'}),null);});
test('legacy, monthly metrics, Top and Risk are not changed or connected',async()=>{const s=new Memory(),legacy=s.getItem('tradingData'),history=s.getItem('tradeScopeTradeHistoryV1');s.setItem('tradeScopeTopSummarySnapshotV1','{"anonymousCache":true}');const cache=s.getItem('tradeScopeTopSummarySnapshotV1');await service(s).save(source());assert.equal(s.getItem('tradingData'),legacy);assert.equal(s.getItem('tradeScopeTradeHistoryV1'),history);assert.equal(s.getItem('tradeScopeTopSummarySnapshotV1'),cache);assert.ok(!fs.readFileSync('assets/monthly-account-resolver.js','utf8').includes('sbivc-monthly-assets'));});

function listedSource(hash='a',month='2031-02',positive=true){
 const end=new Date(Date.UTC(+month.slice(0,4),+month.slice(5),0)).toISOString().slice(0,10);
 const f=fixture({assets:Array.from({length:45},(_,n)=>'COIN'+(n+1)),zero:true,blankRate:true,
  period:month.replace('-','/')+'/01 ～ '+end.replaceAll('-','/'),basis:end.replaceAll('-','/')});
 if(positive){f.pages[0].items.find(i=>i.x===272&&i.y===560).text='0.1234567890123456789';
  f.pages[0].items.find(i=>i.x===535&&i.y===560).text='42.125';f.pages[0].items.push({x:425,y:560,text:'321.123456789',width:80});}
 return{preview:parser.parse(f),fileHash:hash.repeat(64),fileSize:128};
}
test('45 source rows remain intact; 1 positive and 44 irrelevant zeros create only 1 Instrument/holding',async()=>{
 const s=new Memory(),svc=service(s),p=listedSource(),original=copy(p),before=s.snapshot();
 assert.equal((await svc.inspect(p)).holdingCount,1);assert.equal(s.snapshot(),before);await svc.save(p);
 assert.deepEqual(p,original);assert.equal(p.preview.spotHoldings.length,45);assert.equal(records(s,'instruments').length,1);assert.equal(records(s,'holdingSnapshots').length,1);
 assert.equal(records(s,'accountSnapshots')[0].assetValue,p.preview.accountObservations.assetTotalObservation);
});
test('all zero new user saves official Batch/Snapshot/Input without Instruments or holdings',async()=>{
 const s=new Memory(),p=listedSource('a','2031-02',false);assert.equal((await service(s).inspect(p)).holdingCount,0);
 assert.equal((await service(s).save(p)).status,'saved');assert.equal(records(s,'instruments').length,0);assert.equal(records(s,'holdingSnapshots').length,0);
 for(const e of ['importBatches','accountSnapshots','monthlyAccountInputs'])assert.equal(records(s,e).length,1);
 assert.equal(records(s,'monthlyAccountInputs')[0].schemaVersion,3);assert.equal(s.getItem(model.keys.monthlyAccountStates),null);
 assert.equal((await service(s).save(p)).status,'already-imported');
});
test('prior adopted positive -> current explicit zero and continuing zero persist without duplicate Instrument',async()=>{
 const s=new Memory(),svc=service(s);await svc.save(listedSource());
 for(const [hash,month] of [['b','2031-03'],['c','2031-04']]){const p=listedSource(hash,month,false);assert.equal((await svc.inspect(p)).holdingCount,1);await svc.save(p);assert.equal(svc.read(month).holdings[0].quantity,'0.00000000');assert.equal((await svc.save(p)).status,'already-imported');}
 assert.equal(records(s,'instruments').length,1);assert.equal(records(s,'holdingSnapshots').length,3);
});
test('prior zero-only observation and registry existence do not establish SBI VC positive history',async()=>{
 const s=new Memory();model.createRepository(s).save('instruments',[{id:'unused',assetType:'Crypto',symbol:'COIN1/JPY',displayName:'COIN1/JPY',enabled:true}]);
 await service(s).save(listedSource('a','2031-02',false));await service(s).save(listedSource('b','2031-03',false));
 assert.equal(records(s,'holdingSnapshots').length,0);assert.equal(records(s,'instruments').length,1);
 // An older unfiltered zero record is not deleted and is still not positive evidence.
 const snapshot=records(s,'accountSnapshots')[0],oldZero={id:'old_zero',schemaVersion:1,accountId:snapshot.accountId,importBatchId:snapshot.importBatchId,
  sourceMode:snapshot.sourceMode,sourceScope:snapshot.sourceScope,targetMonth:snapshot.targetMonth,snapshotAsOf:snapshot.snapshotAsOf,
  importedAt:snapshot.importedAt,observationType:snapshot.observationType,instrumentId:'unused',accountSnapshotId:snapshot.id,quantity:'0',marketPrice:null,marketValue:'0',currency:'JPY'};
 model.createRepository(s).save('holdingSnapshots',[oldZero]);const p=listedSource('c','2031-04',false);
 assert.equal((await service(s).inspect(p)).holdingCount,0);await service(s).save(p);assert.deepEqual(records(s,'holdingSnapshots'),[oldZero]);
});
test('other-account positive, orphan/non-adopted source and legacy manual buy are not evidence',async()=>{
 const s=new Memory();s.setItem('tradeScopeTradeHistoryV1','[{"id":"legacy_buy","symbol":"COIN1/JPY","side":"buy"}]');
 const legacy=s.snapshot();assert.equal(save.persistableHoldings(model.readModels(s),listedSource('a','2031-02',false).preview).length,0);
 await service(s).save(listedSource());const models=model.readModels(s),zero=listedSource('b','2031-03',false).preview;
 const other=copy(models);other.monthlyAccountInputs.records[0].accountId='other';other.holdingSnapshots.records[0].accountId='other';
 assert.equal(save.persistableHoldings(other,zero).length,0);
 const orphan=copy(models);orphan.monthlyAccountInputs.records=[];assert.equal(save.persistableHoldings(orphan,zero).length,0);
 assert.ok(legacy.includes('legacy_buy'));assert.equal(s.getItem('tradeScopeTradeHistoryV1'),'[{"id":"legacy_buy","symbol":"COIN1/JPY","side":"buy"}]');
});
test('future adopted positive is not evidence for an earlier zero month',async()=>{
 const s=new Memory();await service(s).save(listedSource('a','2031-03'));await service(s).save(listedSource('b','2031-02',false));assert.equal(service(s).read('2031-02').holdings.length,0);
});
test('same-month adopted positive -> corrected zero retains zero and old source, then no-op after reload',async()=>{
 const s=new Memory(),svc=service(s);await svc.save(listedSource());const old=svc.read('2031-02'),p=listedSource('b','2031-02',false),guard=await svc.inspect(p);
 assert.equal(guard.status,'review-required');assert.equal(guard.holdingCount,1);const before=s.snapshot();assert.equal((await svc.save(p)).status,'review-required');assert.equal(s.snapshot(),before);
 await svc.save(p,guard);const active=svc.read('2031-02');assert.equal(active.holdings.length,1);assert.equal(active.holdings[0].quantity,'0.00000000');
 assert.notEqual(active.snapshot.id,old.snapshot.id);assert.equal(records(s,'holdingSnapshots').length,2);assert.equal(records(s,'instruments').length,1);
 assert.equal((await service(s).save(p)).status,'already-imported');assert.equal((await service(s).save(listedSource())).status,'already-imported');
});
test('stale corrected positive alone is not history evidence for later sources',async()=>{
 const s=new Memory(),svc=service(s);await svc.save(listedSource());const zero=listedSource('b','2031-02',false);await svc.save(zero,await svc.inspect(zero));
 const next=listedSource('c','2031-03',false);assert.equal((await svc.inspect(next)).holdingCount,0);await svc.save(next);assert.equal(svc.read('2031-03').holdings.length,0);
});
test('corrected zero -> positive persists necessary Instrument only',async()=>{
 const s=new Memory(),svc=service(s);await svc.save(listedSource('a','2031-02',false));const p=listedSource('b');await svc.save(p,await svc.inspect(p));
 assert.equal(records(s,'instruments').length,1);assert.equal(svc.read('2031-02').holdings.length,1);assert.equal(records(s,'accountSnapshots').length,2);
});
test('filtered exact reimport omits 44 zeros normally; missing selected positive still conflicts',async()=>{
 const s=new Memory(),p=listedSource();await service(s).save(p);const before=s.snapshot();assert.equal((await service(s).inspect(p)).status,'already-imported');
 assert.equal((await service(s).save(p)).status,'already-imported');assert.equal(s.snapshot(),before);
 const missing=copy(p);missing.preview.spotHoldings[0].quantity='0';assert.equal((await service(s).inspect(missing)).status,'conflict');assert.equal(s.snapshot(),before);
});
test('same-hash historical selection survives subsequent earlier-month correction',async()=>{
 const s=new Memory();let tick=0;const svc=save.createService(s,{cryptoApi:crypto,clock:()=>new Date(Date.UTC(2031,4,1,0,0,tick++)).toISOString()});
 const first=listedSource(),zero=listedSource('b','2031-03',false);await svc.save(first);await svc.save(zero);
 const corrected=listedSource('c','2031-02',false);await svc.save(corrected,await svc.inspect(corrected));
 assert.equal((await svc.save(zero)).status,'already-imported');assert.equal((await svc.inspect(listedSource('d','2031-04',false))).holdingCount,0);
});
test('filtered Instrument creation rolls back atomically when holdings fail',async()=>{
 const s=new Memory(),before=s.snapshot();s.failKey=model.keys.holdingSnapshots;await assert.rejects(()=>service(s).save(listedSource()));assert.equal(s.snapshot(),before);
});
test('Backup v10 roundtrip preserves filtered positive and adopted explicit zero observations',async()=>{
 const s=new Memory(),svc=service(s);await svc.save(listedSource());const zero=listedSource('b','2031-03',false);await svc.save(zero);
 const payload=backup(s).build(),target=new Memory(),r=backup(target);assert.equal(payload.backupVersion,13);r.restore.execute(r.format.inspectValue(payload).restorePlan,target);
 assert.deepEqual(copy(r.build().data),copy(payload.data));assert.equal(records(target,'instruments').length,1);assert.equal(records(target,'holdingSnapshots').length,2);
 assert.equal((await service(target).save(zero)).status,'already-imported');
});
