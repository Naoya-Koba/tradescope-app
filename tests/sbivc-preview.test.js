const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs');
const { createUI } = require('../import/sbivc-preview.js'), parser = require('../import/sbivc-parser.js'), { fixture } = require('./sbivc-pdf-fixture.js');
class Element {
  constructor(tag = 'div') { this.tagName = tag; this.children = []; this.listeners = {}; this.dataset = {}; this.hidden = false; this.open = true; this.textContent = ''; }
  append(...items) { this.children.push(...items); } replaceChildren(...items) { this.children = items; }
  addEventListener(key, fn) { this.listeners[key] = fn; }
  showModal(){this.open=true;}close(){this.open=false;}
}
function setup(options = {}) {
  const elements = {}, sources = new Map(), events = {}, document = { getElementById: id => elements[id] ||= new Element(), createElement: tag => new Element(tag) };
  const ui = createUI({ document, window: { addEventListener: (key, fn) => events[key] = fn }, parser,
    service:options.service,hashBytes:options.hashBytes||(async()=> 'a'.repeat(64)),
    extract: options.extract || (async () => fixture(options)), viewer: () => ({ setSource: (key, file) => file ? sources.set(key, file) : sources.delete(key) }) });
  return { ui, elements, sources, events, file: new Blob(['%PDF-1.7 synthetic']) };
}
function text(element) { return [element.textContent, ...element.children.map(text)].join(' '); }
test('official spot Preview shows four fills and signed receipt fees; confirms count before explicit save',async()=>{
 const {tradesFixture}=require('./sbivc-trades-fixture.js');let calls=0;
 const h=setup({extract:async()=>tradesFixture(),service:{inspect:async()=>({status:'ready',holdingCount:1,transactionCount:4}),save:async()=>{calls++;return{status:'saved'};}}});
 await h.ui.select(h.file);assert.equal(calls,0);assert.match(text(h.elements['sbivc-events']),/現物取引（4件）/);assert.match(text(h.elements['sbivc-events']),/手数料（受取＋／支払−） \+11円/);
 h.elements['sbivc-save'].listeners.click();assert.match(text(h.elements['sbivc-confirm-summary']),/現物取引 4件/);
 await h.elements['sbivc-confirm-save'].listeners.click();assert.equal(calls,1);assert.equal(h.elements['sbivc-save'].hidden,true);assert.equal(h.elements['sbivc-save-status'].textContent,'資産・保有・取引情報を保存済み');
});
test('unsupported spot sell Preview never offers save or mislabels it as new/open',async()=>{const {tradesFixture}=require('./sbivc-trades-fixture.js');const h=setup({extract:async()=>tradesFixture({side:'売'}),service:{inspect:async()=>{throw Error('should not inspect invalid source');}}});await h.ui.select(h.file);assert.equal(h.elements['sbivc-save'].hidden,true);assert.match(text(h.elements['sbivc-issues']),/まだ対応していません/);});
test('source hash precedes PDF worker buffer transfer',async()=>{
 let originalHash;const crypto=require('node:crypto');
 const h=setup({hashBytes:async bytes=>crypto.createHash('sha256').update(bytes).digest('hex'),
  extract:async bytes=>{originalHash=crypto.createHash('sha256').update(bytes).digest('hex');structuredClone(bytes,{transfer:[bytes.buffer]});return fixture();},
  service:{inspect:async source=>{assert.equal(source.fileHash,originalHash);assert.notEqual(source.fileHash,crypto.createHash('sha256').update('').digest('hex'));return{status:'ready'};}}});
 await h.ui.select(h.file);assert.equal(h.elements['sbivc-save'].hidden,false);
});
test('storage inspection failure uses safe storage stage without private details',async()=>{
 const h=setup({service:{inspect:async()=>{throw Error('PRIVATE_PERSON');}}});await h.ui.select(h.file);
 assert.equal(h.elements['sbivc-read-status'].dataset.stage,'storage');assert.equal(h.elements['sbivc-read-status'].dataset.errorCode,'SBIVC_SAVE_INSPECTION_FAILED');assert.doesNotMatch(text(h.elements['sbivc-issues']),/PRIVATE_PERSON/);assert.equal(h.elements['sbivc-save'].hidden,true);
});
test('Preview renders compact observations/holdings without monthly P/L', async () => {
  const h = setup(); await h.ui.select(h.file); const t = text(h.elements['sbivc-summary']);
  assert.match(t, /JPY残高/); assert.match(t, /帳票上の資産合計/); assert.doesNotMatch(t, /取得原価|実現損益|月次損益|評価損益|Account|Snapshot/);
  assert.match(text(h.elements['sbivc-holdings']), /USDC/); assert.equal(h.sources.get('sbivc'), h.file);
});
test('display groups integer only and preserves every decimal digit', async () => { const h = setup(); await h.ui.select(h.file); const t = text(h.elements['sbivc-holdings']); assert.match(t, /0\.1234567890123456789/); assert.match(t, /321\.123456789円/); assert.doesNotMatch(t, /\.123,/); });
test('Preview source belongs to shared Viewer and is released on close', async () => { const h = setup(); await h.ui.select(h.file); h.ui.clear(); assert.equal(h.sources.size, 0); assert.equal(h.elements['sbivc-preview'].hidden, true); assert.equal(h.elements['sbivc-holdings'].children.length, 0); });
test('pagehide and provider close release source/read-only preview', async () => { const h = setup(); await h.ui.select(h.file); h.elements['sbivc-provider'].open = false; h.elements['sbivc-provider'].listeners.toggle(); assert.equal(h.sources.size, 0); await h.ui.select(h.file); h.events.pagehide(); assert.equal(h.sources.size, 0); });
test('malformed engine error displays controlled code only', async () => { const h = setup({ extract: async () => { throw Object.assign(new Error('PRIVATE_PERSON FULL_TEXT'), { code: 'PDF_DOCUMENT_LOAD_FAILED' }); } }); await h.ui.select(h.file); assert.equal(h.sources.size, 0); assert.equal(h.elements['sbivc-read-status'].dataset.errorCode, 'PDF_DOCUMENT_LOAD_FAILED'); assert.doesNotMatch(text(h.elements['sbivc-issues']), /PRIVATE|FULL_TEXT/); });
test('wrong provider gives no asset preview', async () => { const h = setup({ extract: async () => ({ pages: [] }) }); await h.ui.select(h.file); assert.equal(h.elements['sbivc-read-status'].dataset.errorCode, 'SBIVC_DOCUMENT_NOT_RECOGNIZED'); assert.equal(h.elements['sbivc-summary'].children.length, 0); });
test('missing values prevent normal preview, no inferred zero', async () => { const f = fixture(); f.pages[0].items.find(i => i.text === '42.125').text = 'invalid'; const h = setup({ extract: async () => f }); await h.ui.select(h.file); assert.equal(h.elements['sbivc-summary'].children.length, 0); assert.ok(h.elements['sbivc-issues'].children.length); });
test('replacement/cancel cannot revive stale preview', async () => { let finish; const h = setup({ extract: () => new Promise(resolve => { finish = resolve; }) }); const selection = h.ui.select(h.file); await new Promise(r => setImmediate(r)); h.ui.clear(); finish(fixture()); await selection; assert.equal(h.sources.size, 0); assert.equal(h.elements['sbivc-preview'].hidden, true); });
test('zero balances folded but not discarded; missing rate is dash', async () => { const h = setup({ zero: true, blankRate: true }); await h.ui.select(h.file); assert.match(text(h.elements['sbivc-holdings']), /残高0の銘柄（3件）/); assert.match(text(h.elements['sbivc-holdings']), /—/); });
test('synthetic HTML-shaped cashflow type is not echoed', async () => { const h = setup({ type: '<img src=x onerror=alert(1)>' }); await h.ui.select(h.file); assert.doesNotMatch(text(h.elements['sbivc-events']), /<img|onerror/); assert.equal(h.elements['sbivc-read-status'].dataset.stage, 'preview'); });
test('preview-only injection does not write; production picker is PDF-only with initially hidden save', async () => {
  const storage = Object.freeze({ tradingData: '{"2031":{"2":{"__saved":false}}}', tradeScopeTopSummarySnapshotV1: 'anonymous-cache', tradeScopeAccountsV1: null });
  const before = JSON.stringify(storage), h = setup(); await h.ui.select(h.file); h.ui.clear(); assert.equal(JSON.stringify(storage), before);
  const html = fs.readFileSync('import.html', 'utf8'), slot = html.slice(html.indexOf('<details id="sbivc-provider"'), html.indexOf('  <dialog id="pdf-viewer-dialog"'));
  assert.match(slot, /id="sbivc-save"[^>]*hidden/); assert.doesNotMatch(slot, /\.csv|\.zip/); assert.match(slot, /\.pdf,application\/pdf/);
  assert.match(fs.readFileSync('import/pdf-viewer-ui.js', 'utf8'), /'minano', 'sbivc'/);
});
test('valid Preview inspects read-only, then explicit confirmation calls service once',async()=>{
 let saves=0;const h=setup({service:{inspect:async()=>({status:'ready'}),save:async()=>{saves++;return{status:'saved'};}}});
 await h.ui.select(h.file);assert.equal(saves,0);assert.equal(h.elements['sbivc-save'].hidden,false);
 h.elements['sbivc-save'].listeners.click();assert.match(text(h.elements['sbivc-confirm-summary']),/2031\/02/);assert.equal(saves,0);
 await h.elements['sbivc-confirm-save'].listeners.click();assert.equal(saves,1);assert.equal(h.elements['sbivc-save'].hidden,true);assert.match(h.elements['sbivc-save-status'].textContent,/資産・保有情報を保存済み/);
});
test('same-hash canonical inspection shows saved after reload with no write',async()=>{let writes=0;const h=setup({service:{inspect:async()=>({status:'already-imported'}),save:()=>writes++}});await h.ui.select(h.file);assert.equal(h.elements['sbivc-save'].hidden,true);assert.match(h.elements['sbivc-save-status'].textContent,/保存済み/);assert.equal(writes,0);});
test('correction requires modal confirmation; cancel does not save',async()=>{let count=0;const guard={status:'review-required',inputId:'anonymous',adoptedSnapshotId:'old',adoptedAt:'2031-03-01T00:00:00Z'},h=setup({service:{inspect:async()=>guard,save:async(_,g)=>{assert.deepEqual(g,guard);count++;return{status:'saved'};}}});await h.ui.select(h.file);h.elements['sbivc-save'].listeners.click();assert.match(text(h.elements['sbivc-confirm-summary']),/訂正/);h.elements['sbivc-cancel-save'].listeners.click();assert.equal(count,0);});
test('conflict never offers save',async()=>{const h=setup({service:{inspect:async()=>({status:'conflict'})}});await h.ui.select(h.file);assert.equal(h.elements['sbivc-save'].hidden,true);assert.match(h.elements['sbivc-save-status'].textContent,/照合できません/);});
test('double-click blocked; success only after service verification',async()=>{let finish,calls=0;const h=setup({service:{inspect:async()=>({status:'ready'}),save:()=>{calls++;return new Promise(r=>finish=r);}}});await h.ui.select(h.file);h.elements['sbivc-save'].listeners.click();const first=h.elements['sbivc-confirm-save'].listeners.click();await h.elements['sbivc-confirm-save'].listeners.click();assert.equal(calls,1);assert.equal(h.elements['sbivc-save-status'].textContent,'保存中…');assert.equal(h.elements['sbivc-file'].disabled,true);finish({status:'saved'});await first;assert.match(h.elements['sbivc-save-status'].textContent,/保存済み/);assert.equal(h.elements['sbivc-file'].disabled,false);});
test('quota/save error never claims success or exposes private error',async()=>{const h=setup({service:{inspect:async()=>({status:'ready'}),save:async()=>{throw Error('PRIVATE_PERSON');}}});await h.ui.select(h.file);h.elements['sbivc-save'].listeners.click();await h.elements['sbivc-confirm-save'].listeners.click();assert.match(h.elements['sbivc-save-status'].textContent,/保存できません/);assert.doesNotMatch(h.elements['sbivc-save-status'].textContent,/PRIVATE_PERSON|保存済み/);assert.equal(h.elements['sbivc-save'].hidden,false);});

test('confirmation uses persistence selection count, without hiding source zero rows or warning',async()=>{
 const h=setup({zero:true,blankRate:true,service:{inspect:async()=>({status:'ready',holdingCount:1})}});await h.ui.select(h.file);
 h.elements['sbivc-save'].listeners.click();assert.match(text(h.elements['sbivc-confirm-summary']),/現物保有銘柄 1件/);
 assert.match(text(h.elements['sbivc-holdings']),/残高0の銘柄（3件）/);assert.equal(h.elements['sbivc-issues'].children.length,0);
});
test('all-zero observation can confirm zero selected holdings without becoming an error',async()=>{
 const h=setup({zero:true,blankRate:true,service:{inspect:async()=>({status:'ready',holdingCount:0}),save:async()=>({status:'saved'})}});await h.ui.select(h.file);
 h.elements['sbivc-save'].listeners.click();assert.match(text(h.elements['sbivc-confirm-summary']),/現物保有銘柄 0件/);
 await h.elements['sbivc-confirm-save'].listeners.click();assert.match(h.elements['sbivc-save-status'].textContent,/保存済み/);assert.equal(h.elements['sbivc-issues'].children.length,0);
});
