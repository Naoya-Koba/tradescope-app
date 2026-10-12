const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const crypto = require('node:crypto').webcrypto;
const model = require('../assets/data-model-storage.js'), engine = require('../import/gmo-save.js'), parser = require('../import/gmo-parser.js');
const { MemoryStorage } = require('./gmo-support.js'), { report } = require('./gmo-pdf-fixture.js');
const { trades } = require('./gmo-trades-fixture.js');
class Element {
  constructor() { this.hidden=true;this.disabled=false;this.open=false;this.children=[];this.listeners={};this.textContent='';this.dataset={}; }
  addEventListener(name, cb) { (this.listeners[name] ||= []).push(cb); }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children=children; }
  showModal() { assert.equal(this.open,false);this.open=true; }
  close() { this.open=false; }
  async fire(name,event={}) { for(const cb of this.listeners[name]||[]) await cb(event); }
}
function harness(storage=new MemoryStorage(),extracted=report(),overrides={}) {
  const elements={},document={getElementById:id=>elements[id] ||= new Element(),createElement:()=>new Element()};
  let saves=0; const viewerSources=new Map();
  const context={document,localStorage:storage,crypto,Uint8Array,AbortController,TradeScopeDataStorage:model,TradeScopeGMOParser:parser,
    TradeScopePdfViewer:{setSource:(key,file)=>file?viewerSources.set(key,file):viewerSources.delete(key)},
    fakeExtractor:{extract:async()=>extracted},TradeScopeGMOSave:{createService:adapter=>{const s=engine.createService(adapter);return{inspect:s.inspect,save:async(...args)=>{saves++;return s.save(...args);}}}}};
  Object.defineProperties(context,Object.getOwnPropertyDescriptors(overrides));
  const code=fs.readFileSync(require.resolve('../import/gmo-preview.js'),'utf8').replace(/await import\('\.\/pdf-extractor\.mjs\?v=[^']+'\)/,'fakeExtractor');
  vm.runInNewContext(code,context);
  return {elements,storage,viewerSources,saves:()=>saves,upload:async(char='a',fileOverride={})=>{
    const bytes=Buffer.from('%PDF-1.7 anonymous '+char);await elements['gmo-file'].fire('change',{target:{files:[{size:bytes.length,arrayBuffer:async()=>new Uint8Array(bytes).buffer,...fileOverride}]}});
  }};
}
test('GMO Preview, cancellation and close are read-only; errors do not expose save', async()=>{
  const h=harness(),before=h.storage.snapshot();await h.upload();assert.equal(h.elements['gmo-save'].hidden,false);
  await h.elements['gmo-save'].fire('click');assert.equal(h.elements['gmo-save-dialog'].open,true);
  await h.elements['gmo-cancel-save'].fire('click');assert.deepEqual(h.storage.snapshot(),before);
  await h.elements['gmo-close'].fire('click');assert.equal(h.elements['gmo-preview'].hidden,true);assert.deepEqual(h.storage.snapshot(),before);
});

test('GMO Viewer retains current File through save confirmation/cancel and releases on Preview close',async()=>{
  const h=harness(),before=h.storage.snapshot();await h.upload();const file=h.viewerSources.get('gmo');assert.ok(file);
  await h.elements['gmo-save'].fire('click');await h.elements['gmo-cancel-save'].fire('click');assert.equal(h.viewerSources.get('gmo'),file);
  assert.deepEqual(h.storage.snapshot(),before);await h.elements['gmo-close'].fire('click');assert.equal(h.viewerSources.size,0);
});
test('GMO wrong-report remains rejected although successfully decoded original is viewable',async()=>{
  const document=report();document.pages[0].items[0].text='別帳票';const h=harness(new MemoryStorage(),document);await h.upload();
  assert.ok(h.viewerSources.get('gmo'));assert.equal(h.elements['gmo-save'].hidden,true);assert.equal(h.saves(),0);assert.deepEqual(h.storage.snapshot(),{});
});
test('unsupported report displays a concrete error, no save action, no source/PII text', async()=>{
  const document=report();document.pages[0].items[0].text='匿名の別帳票';
  const h=harness(new MemoryStorage(),document),before=h.storage.snapshot();await h.upload();
  assert.equal(h.elements['gmo-save'].hidden,true);assert.equal(h.elements['gmo-preview'].hidden,false);
  assert.match(h.elements['gmo-issues'].children[0].textContent,/月次取引残高報告書/);
  assert.doesNotMatch(h.elements['gmo-issues'].children[0].textContent,/匿名の別帳票/);assert.deepEqual(h.storage.snapshot(),before);
});
test('double confirmation/open clicks execute one verified save then replace action with saved text', async()=>{
  const h=harness();await h.upload();await Promise.all([h.elements['gmo-save'].fire('click'),h.elements['gmo-save'].fire('click')]);
  await Promise.all([h.elements['gmo-confirm-save'].fire('click'),h.elements['gmo-confirm-save'].fire('click')]);
  assert.equal(h.saves(),1);assert.equal(h.elements['gmo-save'].hidden,true);assert.equal(h.elements['gmo-save-status'].textContent,'保存済み');
  assert.equal(model.readModels(h.storage).importBatches.records.length,1);
});
test('fresh UI after reload selects exact file as saved from canonical Storage, not memory', async()=>{
  const first=harness();await first.upload();await first.elements['gmo-save'].fire('click');await first.elements['gmo-confirm-save'].fire('click');
  const before=first.storage.snapshot(),next=harness(first.storage);await next.upload();
  assert.equal(next.elements['gmo-save-status'].textContent,'保存済み');assert.equal(next.elements['gmo-save'].hidden,true);assert.deepEqual(first.storage.snapshot(),before);
});
test('different report cannot overwrite until explicit correction confirmation, previous observations retained', async()=>{
  const h=harness();await h.upload();await h.elements['gmo-save'].fire('click');await h.elements['gmo-confirm-save'].fire('click');
  const before=h.storage.snapshot();await h.upload('b');assert.equal(h.elements['gmo-save'].textContent,'訂正する');assert.match(h.elements['gmo-save-status'].textContent,/同じ月/);
  assert.deepEqual(h.storage.snapshot(),before);await h.elements['gmo-save'].fire('click');assert.equal(h.elements['gmo-confirm-save'].textContent,'訂正して保存');
  await h.elements['gmo-confirm-save'].fire('click');assert.equal(model.readModels(h.storage).accountSnapshots.records.length,2);
});
test('legacy conflict prevents save button and does not mutate existing monthly values', async()=>{
  const h=harness(new MemoryStorage({tradingData:'{"2026":{"9":{"gmo":{"realizedPnL":2}}}}'}));const before=h.storage.snapshot();await h.upload();
  assert.equal(h.elements['gmo-save'].hidden,true);assert.match(h.elements['gmo-save-status'].textContent,/従来/);assert.deepEqual(h.storage.snapshot(),before);
});

for (const [code, stage] of [['PDF_WORKER_INIT_FAILED','worker'],['PDF_DOCUMENT_LOAD_FAILED','document'],['PDF_TEXT_EXTRACTION_FAILED','text']])
test(`UI identifies ${code} safely and cannot save a failed extraction`, async()=>{
  const h=harness(new MemoryStorage(),report(),{fakeExtractor:{extract:async()=>{throw Object.assign(new Error('PRIVATE_NAME PDF_FULL_TEXT'),{code,stage});}}});
  const before=h.storage.snapshot();await h.upload();
  assert.equal(h.elements['gmo-read-status'].dataset.errorCode,code);assert.equal(h.elements['gmo-read-status'].dataset.stage,stage);
  assert.match(h.elements['gmo-issues'].children[0].textContent,new RegExp(code));
  assert.doesNotMatch(h.elements['gmo-issues'].children[0].textContent,/PRIVATE|FULL_TEXT/);
  assert.equal(h.elements['gmo-save'].hidden,true);assert.deepEqual(h.storage.snapshot(),before);
});

test('file read failure is distinct and contains no original error or filename',async()=>{
  const h=harness();await h.upload('a',{arrayBuffer:async()=>{throw new Error('PRIVATE_PATH');}});
  assert.equal(h.elements['gmo-read-status'].dataset.errorCode,'PDF_FILE_READ_FAILED');
  assert.doesNotMatch(h.elements['gmo-issues'].children[0].textContent,/PRIVATE/);
});

test('engine load failure is distinct from an unsupported GMO document',async()=>{
  const h=harness(new MemoryStorage(),report(),{get fakeExtractor(){throw new Error('PRIVATE_ENGINE_URL');}});
  await h.upload();assert.equal(h.elements['gmo-read-status'].dataset.errorCode,'PDF_ENGINE_LOAD_FAILED');
});

test('GMO detector/parser/validation failures have distinct diagnostic codes and no save',async()=>{
  const unsupported=report();unsupported.pages[0].items[0].text='PRIVATE_OTHER_REPORT';
  const detector=harness(new MemoryStorage(),unsupported);await detector.upload();
  assert.equal(detector.elements['gmo-read-status'].dataset.errorCode,'GMO_DOCUMENT_NOT_RECOGNIZED');
  const broken=harness(new MemoryStorage(),report(),{TradeScopeGMOParser:{detect:()=>true,parse:()=>{throw new Error('PRIVATE_ROW');}}});
  await broken.upload();assert.equal(broken.elements['gmo-read-status'].dataset.errorCode,'GMO_PARSE_FAILED');
  const invalid=harness(new MemoryStorage(),report(),{TradeScopeGMOParser:{detect:()=>true,parse:()=>({valid:false,targetMonth:null,snapshotAsOf:null,values:{},errors:['必要項目がありません'],warnings:[]})}});
  await invalid.upload();assert.equal(invalid.elements['gmo-read-status'].dataset.errorCode,'GMO_VALIDATION_FAILED');
  for(const h of [detector,broken,invalid]) {assert.equal(h.elements['gmo-save'].hidden,true);assert.doesNotMatch(h.elements['gmo-issues'].children[0].textContent,/PRIVATE/);}
});

async function oldImport() {
  const h=harness();await h.upload();await h.elements['gmo-save'].fire('click');await h.elements['gmo-confirm-save'].fire('click');return h.storage;
}
test('zero-detail existing source offers explicit addition; file selection and cancellation do not write',async()=>{
  const storage=await oldImport(),before=storage.snapshot(),h=harness(storage,trades());await h.upload();
  assert.equal(h.elements['gmo-save'].textContent,'取引明細を追加');assert.equal(h.elements['gmo-save'].hidden,false);assert.deepEqual(storage.snapshot(),before);
  await h.elements['gmo-save'].fire('click');assert.equal(h.elements['gmo-confirm-save'].textContent,'取引明細を追加');
  assert.ok(h.elements['gmo-save-summary'].children.some(e=>e.textContent==='2件'));
  await h.elements['gmo-cancel-save'].fire('click');assert.deepEqual(storage.snapshot(),before);assert.equal(h.saves(),0);
});
test('confirmed addition executes once, preserves monthly bytes, and reload/reselection is saved',async()=>{
  const storage=await oldImport(),before=storage.snapshot(),h=harness(storage,trades());await h.upload();await h.elements['gmo-save'].fire('click');
  await Promise.all([h.elements['gmo-confirm-save'].fire('click'),h.elements['gmo-confirm-save'].fire('click')]);assert.equal(h.saves(),1);
  assert.equal(h.elements['gmo-save-status'].textContent,'既存取込に取引明細を追加しました');assert.equal(h.elements['gmo-save'].hidden,true);
  for(const [key,value] of Object.entries(before))assert.equal(storage.getItem(key),value);
  assert.equal(model.readModels(storage).importedTransactions.records.length,2);
  const saved=storage.snapshot(),next=harness(storage,trades());await next.upload();assert.equal(next.elements['gmo-save-status'].textContent,'保存済み');assert.equal(next.elements['gmo-save'].hidden,true);assert.deepEqual(storage.snapshot(),saved);
});
test('partial persisted detail set displays a concrete stop message, without a save path',async()=>{
  const storage=await oldImport(),h=harness(storage,trades());await h.upload();await h.elements['gmo-save'].fire('click');await h.elements['gmo-confirm-save'].fire('click');
  const m=model.readModels(storage);m.importedTransactions.records.pop();model.createRepository(storage).commit({importedTransactions:m.importedTransactions});
  const before=storage.snapshot(),next=harness(storage,trades());await next.upload();assert.equal(next.elements['gmo-save'].hidden,true);assert.match(next.elements['gmo-save-status'].textContent,/保存済みの取引明細と一致しません/);assert.deepEqual(storage.snapshot(),before);
});
test('enrichment detail audit mismatch hides addition and leaves all storage unchanged',async()=>{
  const storage=await oldImport(),before=storage.snapshot(),document=trades();document.pages[6].items.find(r=>r.text==='+10.00 JPY').text='+11 JPY';
  const h=harness(storage,document);await h.upload();assert.equal(h.elements['gmo-save'].hidden,true);assert.match(h.elements['gmo-save-status'].textContent,/損益照合が一致しません/);assert.deepEqual(storage.snapshot(),before);
});
