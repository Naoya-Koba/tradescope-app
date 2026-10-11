const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const service=require('../assets/gmo-monthly-save.js'),storage=require('../assets/data-model-storage.js');
const {MemoryStorage,fixture,copy}=require('./gmo-support.js');
class Element{
 constructor(tag){this.tag=tag;this.children=[];this.style={};this.dataset={};this.listeners={};this.classList={contains:()=>true};this.scrollHeight=600;}
 append(...nodes){this.children.push(...nodes);}appendChild(node){this.append(node);}setAttribute(){}addEventListener(name,fn){this.listeners[name]=fn;}
 set innerHTML(_){this.parts=Object.fromEntries(['.monthly-account-label','.account-color-dot','.account-body'].map(key=>[key,new Element('div')]));}
 querySelector(key){return this.parts[key];}
}
function harness(){const adapter=new MemoryStorage({tradingData:'{}'});storage.createRepository(adapter).commit(Object.fromEntries(Object.entries(fixture()).filter(([,v])=>v)));
 const context=vm.createContext({document:{createElement:tag=>new Element(tag)},TradeScopeGmoMonthlySave:service});
 vm.runInContext(fs.readFileSync(require.resolve('../assets/gmo-monthly-ui.js'),'utf8'),context);let card,saved=0;
 const controller=context.TradeScopeGmoMonthlyUI.createController({adapter,onSaved:()=>{saved++;render();}});
 const render=()=>{card=controller.renderCard({color:'blue'},'2026-09','GMO FXneo');};render();
 const elements=()=>{const walk=node=>[node,...node.children.flatMap(walk)];return walk(card.parts['.account-body']);};
 const button=()=>elements().find(el=>el.className?.includes('monthly-account-save'));
 const control=field=>elements().find(el=>el.dataset.field===field);
 const change=(field,value)=>{control(field).value=value;control(field).listeners.input();};
 return {adapter,render,button,control,change,elements,saved:()=>saved};
}
test('GMO five adopted fields are editable without legacy controls or standalone import status',()=>{const h=harness(),before=h.adapter.snapshot();
 assert.equal(h.button().textContent,'保存');for(const field of service.fields){const input=h.control(field);assert.equal(input.disabled,false);assert.equal(input.type,'text');assert.equal(input.className,'input-gmo-draft');}
 h.change('swapPnl','7.1234567890123456789');assert.equal(h.control('swapPnl').value,'7.1234567890123456789');assert.deepEqual(h.adapter.snapshot(),before);
 assert.equal(h.elements().some(el=>el.textContent==='取込済み'),false);
});
test('GMO edit/save/reload adopts v3 and hides unchanged action only after verification',()=>{const h=harness();assert.equal(h.button().hidden,true);h.change('realizedPnl','11');h.button().listeners.click();
 assert.equal(h.saved(),1);assert.equal(h.button().hidden,true);assert.equal(storage.readModels(h.adapter).monthlyAccountStates.records[0].schemaVersion,3);
 h.render();assert.equal(h.control('realizedPnl').value,'11');assert.equal(h.elements().find(el=>el.className==='sbi-monthly-status').textContent,'保存済み');
});
test('return-to-import changes Draft only; save restores baseline without removing provenance',()=>{const h=harness();h.change('realizedPnl','11');h.button().listeners.click();const before=h.adapter.snapshot();
 const reset=h.elements().find(el=>el.className==='monthly-source-reset');assert.equal(reset.hidden,false);reset.listeners.click();assert.equal(h.control('realizedPnl').value,'10');assert.deepEqual(h.adapter.snapshot(),before);
 h.button().listeners.click();assert.deepEqual(storage.readModels(h.adapter).monthlyAccountStates.records[0].overrideFields,[]);
});
test('invalid or failed GMO save keeps Draft and never reports success',()=>{const h=harness(),before=h.adapter.snapshot();h.change('swapPnl','');h.button().listeners.click();assert.equal(h.saved(),0);assert.deepEqual(h.adapter.snapshot(),before);
 assert.equal(h.elements().find(el=>el.className==='sbi-monthly-error').hidden,false);
});
