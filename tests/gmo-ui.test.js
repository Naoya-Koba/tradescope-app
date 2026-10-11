const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const crypto = require('node:crypto').webcrypto;
const model = require('../assets/data-model-storage.js'), engine = require('../import/gmo-save.js'), parser = require('../import/gmo-parser.js');
const { MemoryStorage } = require('./gmo-support.js'), { report } = require('./gmo-pdf-fixture.js');
class Element {
  constructor() { this.hidden=true;this.disabled=false;this.open=false;this.children=[];this.listeners={};this.textContent=''; }
  addEventListener(name, cb) { (this.listeners[name] ||= []).push(cb); }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children=children; }
  showModal() { assert.equal(this.open,false);this.open=true; }
  close() { this.open=false; }
  async fire(name,event={}) { for(const cb of this.listeners[name]||[]) await cb(event); }
}
function harness(storage=new MemoryStorage(),extracted=report()) {
  const elements={},document={getElementById:id=>elements[id] ||= new Element(),createElement:()=>new Element()};
  let saves=0;
  const context={document,localStorage:storage,crypto,Uint8Array,AbortController,TradeScopeDataStorage:model,TradeScopeGMOParser:parser,
    fakeExtractor:{extract:async()=>extracted},TradeScopeGMOSave:{createService:adapter=>{const s=engine.createService(adapter);return{inspect:s.inspect,save:async(...args)=>{saves++;return s.save(...args);}}}}};
  const code=fs.readFileSync(require.resolve('../import/gmo-preview.js'),'utf8').replace("await import('./pdf-extractor.mjs?v=20261011-1')",'fakeExtractor');
  vm.runInNewContext(code,context);
  return {elements,storage,saves:()=>saves,upload:async(char='a')=>{
    const bytes=Buffer.from('%PDF-1.7 anonymous '+char);await elements['gmo-file'].fire('change',{target:{files:[{size:bytes.length,arrayBuffer:async()=>new Uint8Array(bytes).buffer}]}});
  }};
}
test('GMO Preview, cancellation and close are read-only; errors do not expose save', async()=>{
  const h=harness(),before=h.storage.snapshot();await h.upload();assert.equal(h.elements['gmo-save'].hidden,false);
  await h.elements['gmo-save'].fire('click');assert.equal(h.elements['gmo-save-dialog'].open,true);
  await h.elements['gmo-cancel-save'].fire('click');assert.deepEqual(h.storage.snapshot(),before);
  await h.elements['gmo-close'].fire('click');assert.equal(h.elements['gmo-preview'].hidden,true);assert.deepEqual(h.storage.snapshot(),before);
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
