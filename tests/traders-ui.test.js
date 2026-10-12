// Synthetic only: never opens private PDFs or production Storage.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto').webcrypto;
const parser=require('../import/traders-parser.js'),save=require('../import/traders-save.js'),storage=require('../assets/data-model-storage.js');
const {report}=require('./traders-pdf-fixture.js'),{MemoryStorage}=require('./gmo-support.js');
class Element {
 constructor(tag){this.tag=tag;this.children=[];this.style={};this.dataset={};this.listeners={};this.classList={contains:()=>true};this.scrollHeight=600;this.value='';this.open=false;this.hidden=false;this.disabled=false;}
 append(...nodes){this.children.push(...nodes);}appendChild(n){this.append(n);}replaceChildren(...nodes){this.children=[...nodes];}setAttribute(){}addEventListener(k,f){(this.listeners[k]??=[]).push(f);}
 async fire(k,event={}){for(const f of this.listeners[k]||[])await f({target:this,...event});}
 showModal(){this.open=true;}close(){this.open=false;}
}
async function monthly(broker='lightfx',saved=true,swap='13',existing=null){const adapter=existing||new MemoryStorage({tradingData:'{}'});
 if(saved&&!existing)await save.createService(adapter,broker,{cryptoApi:crypto}).save({preview:parser.parse(report(broker),broker),fileHash:'a'.repeat(64),fileSize:100,calendarSwap:swap});
 const context=vm.createContext({document:{createElement:tag=>new Element(tag)},TradeScopeTradersSave:save});vm.runInContext(fs.readFileSync(require.resolve('../assets/traders-monthly-ui.js'),'utf8'),context);
 let card,saves=0;const ui=context.TradeScopeTradersMonthlyUI.createController({adapter,onSaved:()=>{saves++;render();}}),render=()=>card=ui.renderCard({key:broker,color:'blue'},'2026-09',parser.products[broker].name);render();
 const all=()=>{const walk=n=>[n,...n.children.flatMap(walk)];return walk(card);},control=f=>all().find(e=>e.dataset.field===f),button=()=>all().find(e=>e.className?.includes('monthly-account-save'));
 return {adapter,all,control,button,render,saves:()=>saves,change:async(f,v)=>{control(f).value=v;await control(f).fire('input');}};
}
for(const broker of ['lightfx','minano'])test(`${broker} Input: five consistent fields, calendar helper, no position inputs or display writes`,async()=>{
 const h=await monthly(broker),before=h.adapter.snapshot();assert.equal(h.all().filter(e=>e.dataset.field).length,5);assert.equal(h.button().textContent,'保存');
 assert.equal(h.all().filter(e=>e.textContent==='収益カレンダー「スワップ付与」月間合計').length,1);await h.change('swapPnl','-12');h.render();assert.equal(h.control('swapPnl').value,'-12');assert.deepEqual(h.adapter.snapshot(),before);
});
test('Input correction/reset/reload preserves original source and selected-account-only writes',async()=>{const h=await monthly();await h.change('swapPnl','17');await h.button().fire('click');assert.equal(h.saves(),1);assert.equal(h.control('swapPnl').value,'17');
 const before=h.adapter.snapshot();await h.all().find(e=>e.className==='monthly-source-reset').fire('click');assert.equal(h.control('swapPnl').value,'13');assert.deepEqual(h.adapter.snapshot(),before);await h.button().fire('click');assert.equal(h.control('swapPnl').value,'13');assert.equal(h.adapter.getItem('tradingData'),'{}');
});
test('Input missing state/blank calendar does not create a complete state',async()=>{const h=await monthly('minano',false);assert.equal(h.button().disabled,true);assert.equal(h.adapter.writes,0);const n=await monthly();const before=n.adapter.snapshot();await n.change('swapPnl','');await n.button().fire('click');assert.equal(n.saves(),0);assert.deepEqual(n.adapter.snapshot(),before);});
function preview(adapter=new MemoryStorage()){
 const ids=['provider','file','read-status','cancel-read','preview','close','summary','issues','swap-group','swap','save-status','save','dialog','confirm-summary','confirm-save','cancel-save'];
 const elements=Object.fromEntries(['lightfx','minano'].flatMap(b=>ids.map(id=>[`${b}-${id}`,new Element('div')])));
 const viewerSources=new Map();
 const context=vm.createContext({TradeScopePdfViewer:{setSource:(key,file)=>file?viewerSources.set(key,file):viewerSources.delete(key)},window:{addEventListener(){}},document:{getElementById:id=>elements[id],createElement:t=>new Element(t)},TradeScopeTradersParser:parser,TradeScopeTradersSave:save,TradeScopeDataStorage:{...storage,localStorageAdapter:()=>adapter},localStorage:adapter,AbortController,Uint8Array,crypto,extractor:{extract:async()=>report(context.selected)}});
 const source=fs.readFileSync(require.resolve('../import/traders-preview.js'),'utf8').replace(/await import\('\.\/pdf-extractor\.mjs\?v=[^']+'\)/,'globalThis.extractor');vm.runInContext(source,context);
 const el=(id,b='lightfx')=>elements[`${b}-${id}`];
 async function upload(b='lightfx',product=b,bytes=[37,80,68,70,45,49,46,55]){context.selected=product;el('file',b).files=[{size:bytes.length,arrayBuffer:async()=>new Uint8Array(bytes).buffer}];await el('file',b).fire('change');}
 async function swap(v,b='lightfx'){el('swap',b).value=v;await el('swap',b).fire('input');await new Promise(resolve=>setImmediate(resolve));}
 return {adapter,el,upload,swap,context,viewerSources};
}
test('PDF Preview only: blank swap permits partial save but display leaves Storage unchanged',async()=>{const h=preview();await h.upload();assert.equal(h.el('preview').hidden,false);assert.equal(h.el('save').hidden,false);assert.equal(h.adapter.writes,0);assert.equal(h.el('issues').children.length,0);});

for(const broker of ['lightfx','minano'])test(`${broker} original File retention never fills missing swap or changes confirmation/Storage`,async()=>{
 const h=preview(),before=h.adapter.snapshot();await h.upload(broker);const file=h.viewerSources.get(broker);assert.ok(file);assert.equal(h.el('swap',broker).value,'');
 await h.el('save',broker).fire('click');assert.equal(h.el('dialog',broker).open,true);await h.el('cancel-save',broker).fire('click');
 assert.equal(h.viewerSources.get(broker),file);assert.equal(h.el('swap',broker).value,'');assert.deepEqual(h.adapter.snapshot(),before);
 await h.el('close',broker).fire('click');assert.equal(h.viewerSources.size,0);
});
test('Traders source references stay independent; wrong-broker Viewer does not enable import',async()=>{
 const h=preview();await h.upload('lightfx');await h.upload('minano');assert.equal(h.viewerSources.size,2);
 await h.el('close','lightfx').fire('click');assert.ok(h.viewerSources.get('minano'));
 await h.upload('lightfx','minano');assert.ok(h.viewerSources.get('lightfx'));assert.equal(h.el('save','lightfx').hidden,true);assert.equal(h.adapter.writes,0);
});
test('Preview signed zero -> confirm -> verified save -> saved, exact reimport/reload no duplicate',async()=>{const h=preview();await h.upload();await h.swap('0');assert.equal(h.el('save').hidden,false);await h.el('save').fire('click');assert.equal(h.el('dialog').open,true);
 await Promise.all([h.el('confirm-save').fire('click'),h.el('confirm-save').fire('click')]);assert.equal(h.el('save-status').textContent,'保存済み');assert.equal(h.el('save').hidden,true);assert.equal(storage.readModels(h.adapter).importBatches.records.length,1);
 const n=preview(h.adapter),before=h.adapter.snapshot();await n.upload();assert.equal(n.el('save-status').textContent,'保存済み');assert.deepEqual(n.adapter.snapshot(),before);
});
test('Preview cross-product blocks LIGHT PDF in Minna slot with no persistence',async()=>{const h=preview();await h.upload('minano','lightfx');assert.equal(h.el('save','minano').hidden,true);assert.ok(h.el('issues','minano').children.some(e=>e.textContent.includes('LIGHT FX')&&e.textContent.includes('みんなのFXとしては取り込めません')));assert.equal(h.adapter.writes,0);});
test('PDF correction requires second explicit confirmation, retains earlier observation',async()=>{const h=preview();await h.upload();await h.swap('13');await h.el('save').fire('click');await h.el('confirm-save').fire('click');const before=h.adapter.snapshot();await h.upload('lightfx','lightfx',[37,80,68,70,45,49,46,55,2]);await h.swap('14');assert.equal(h.el('save').textContent,'訂正する');assert.deepEqual(h.adapter.snapshot(),before);await h.el('save').fire('click');await h.el('confirm-save').fire('click');assert.equal(storage.readModels(h.adapter).accountSnapshots.records.length,2);assert.equal(storage.readModels(h.adapter).monthlyAccountStates.records.length,1);});
test('malformed extraction exposes only safe stage/code, never source exception text',async()=>{const h=preview();h.context.extractor.extract=async()=>{throw Object.assign(Error('PRIVATE PII'),{code:'PDF_TEXT_EXTRACTION_FAILED',stage:'text'});};await h.upload();assert.match(h.el('issues').children[0].textContent,/PDF_TEXT_EXTRACTION_FAILED/);assert.doesNotMatch(h.el('issues').children[0].textContent,/PRIVATE/);assert.equal(h.adapter.writes,0);});
test('UI URLs/load order/PWA and historic forms remain separate; no direct writes/network/logging',()=>{const html=fs.readFileSync(require.resolve('../import.html'),'utf8'),profit=fs.readFileSync(require.resolve('../profit/soneki.js'),'utf8');
 for(const b of ['lightfx','minano'])assert.match(html,new RegExp(`id="${b}-file"[^>]+accept=".pdf,application/pdf"`));
 assert.match(profit,/tradersMonthlyUI.renderCard/);assert.match(profit,/inputTargetMonth\(\)\s*>=\s*window.TradeScopeMonthlyResolver.policies\[account.key\].cutover/);assert.match(profit,/UNREALIZED_HELPER_ACCOUNTS.has/);
 for(const file of ['../import/traders-preview.js','../assets/traders-monthly-ui.js']){const text=fs.readFileSync(require.resolve(file),'utf8');assert.doesNotMatch(text,/\.setItem\(|\.removeItem\(|\.commit\(|console\.|fetch\(|XMLHttpRequest|innerHTML/);}
 assert.doesNotMatch(fs.readFileSync(require.resolve('../profit/soneki.html'),'utf8'),/id="saveMonthData"/);
});
for(const broker of ['lightfx','minano'])test(`${broker}: Preview PDF-only save -> reload Input blank -> explicit zero completes without PDF reselection`,async()=>{
 const h=preview();await h.upload(broker);assert.equal(h.el('save',broker).hidden,false);await h.el('save',broker).fire('click');await h.el('confirm-save',broker).fire('click');
 assert.equal(h.el('save-status',broker).textContent,'保存済み');assert.equal(storage.readModels(h.adapter).monthlyAccountStates,null);
 const n=await monthly(broker,false,'',h.adapter),before=n.adapter.snapshot();assert.equal(n.control('swapPnl').value,'');assert.equal(n.control('realizedPnl').value,'10');assert.equal(n.control('unrealizedPnl').value,'-30');assert.equal(n.button().disabled,false);assert.deepEqual(n.adapter.snapshot(),before);
 await n.change('swapPnl','0');await n.button().fire('click');assert.equal(n.saves(),1);assert.equal(storage.readModels(n.adapter).monthlyAccountStates.records[0].swapPnl,'0');
 const reread=await monthly(broker,false,'',n.adapter);assert.equal(reread.control('swapPnl').value,'0');
});
test('corrected PDF displays retained calendar value, not a silently ignored new entry',async()=>{
 const h=preview();await h.upload();await h.swap('13');await h.el('save').fire('click');await h.el('confirm-save').fire('click');
 await h.upload('lightfx','lightfx',[37,80,68,70,45,49,46,55,9]);assert.equal(h.el('swap').value,'13');assert.equal(h.el('swap').disabled,true);await h.el('save').fire('click');
 assert.equal(h.el('confirm-summary').children.at(-1).textContent,'13円');await h.el('confirm-save').fire('click');assert.equal(storage.readModels(h.adapter).monthlyAccountStates.records[0].swapPnl,'13');
});
