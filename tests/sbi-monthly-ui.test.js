const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const model = require('../assets/data-model-storage.js'), input = require('../assets/sbi-input-draft.js');
const resolver = require('../assets/monthly-account-resolver.js'), service = require('../assets/sbi-monthly-save.js');
const monthlyInput = require('../assets/monthly-input-ui.js');
const now = '2026-10-04T12:00:00Z', env = records => ({schemaVersion:1,records,updatedAt:now});
const fields = {foreignAssetValue:'0',foreignUnrealizedPnl:'0',foreignDate:'2026-10-04',cashBalance:'0',cashDate:'2026-09-30',realizedPnL:'0',deposit:'0',withdrawal:'0'};
class Element {
 constructor(tag) { this.tag=tag;this.children=[];this.style={};this.dataset={};this.listeners={};this.hidden=false;this.textContent='';
   this.classList={contains:name=>name==='open'};this.scrollHeight=1200; }
 setAttribute() {}
 append(...nodes) { this.children.push(...nodes); }
 replaceChildren(...nodes) { this.children=[...nodes]; }
 appendChild(node) { this.append(node); return node; }
 addEventListener(name,fn) { this.listeners[name]=fn; }
 set innerHTML(value) {
   this.parts=Object.fromEntries(['.sbi-account-label','.account-color-dot','.sbi-domestic-input','.sbi-domestic-value','.sbi-domestic-pnl','.sbi-import-status','.sbi-domestic-date','.account-body'].map(key=>[key,new Element('div')]));
 }
 querySelector(selector) { return this.parts[selector]; }
}
function harness(mutator = () => {}) {
 const models=Object.fromEntries(Object.keys(model.keys).map(key=>[key,null]));
 models.accounts=env(model.initialAccounts().filter(row=>row.id==='acc_sbi_sec'));
 models.instruments=env([{id:'ins_fake',assetType:'Stock',symbol:'ZZ01',displayName:'架空証券',enabled:true}]);
 models.importBatches=env([{id:'batch_fake',accountId:'acc_sbi_sec',targetMonth:'2026-09',snapshotAsOf:'2026-10-04',importedAt:now,sourceType:'csv',sourceProvider:'sbi'}]);
 models.holdingSnapshots=env([{id:'hs_fake',accountId:'acc_sbi_sec',instrumentId:'ins_fake',importBatchId:'batch_fake',targetMonth:'2026-09',snapshotAsOf:'2026-10-04',importedAt:now,sourceMode:'imported',sourceScope:'sbi-domestic-holdings',marketValue:'0',unrealizedPnl:'0'}]);
 mutator(models);
 const values={tradingData:'{}',...Object.fromEntries(Object.entries(models).filter(([,v])=>v).map(([key,v])=>[model.keys[key],JSON.stringify(v)]))};
 const adapter={getItem:key=>values[key]??null,setItem:(key,v)=>{values[key]=v;},removeItem:key=>{delete values[key];}};
 const drafts=input.createDrafts(), document={createElement:tag=>new Element(tag)};
 const context=vm.createContext({document,TradeScopeCSV:require('../import/csv-core.js'),TradeScopeMonthlyInputUI:monthlyInput,TradeScopeDataStorage:model,TradeScopeSbiInput:input,TradeScopeMonthlyResolver:resolver,TradeScopeSbiMonthlySave:service,
   TradeScopeSbiBalanceAdoption:require('../assets/sbi-balance-adoption.js'),TradeScopeScalarSourceSelection:require('../assets/scalar-source-selection.js'),TradeScopeScalarSourceUI:require('../assets/scalar-source-ui.js')});
 vm.runInContext(fs.readFileSync(require.resolve('../assets/sbi-monthly-ui.js'),'utf8'),context);
 let card, saved=0;
 const controller=context.TradeScopeSbiMonthlyUI.createController({adapter,drafts,legacyData:()=>JSON.parse(values.tradingData),onSaved:()=>{saved++;render();}});
 function render() { card=controller.renderCard({key:'sbi',color:'red'},input.load(adapter,'2026-09'),'2026-09','SBI証券');return card; }
 function children() { const walk=node=>[node,...node.children.flatMap(walk)];return walk(card.parts['.account-body']); }
 const control=field=>children().find(el=>el.dataset.field===field);
 const button=()=>children().find(el=>el.className?.split(' ').includes('sbi-monthly-save'));
 const status=()=>children().find(el=>el.className==='sbi-monthly-status').textContent;
 const error=()=>children().find(el=>el.className==='sbi-monthly-error');
 function fill(field,value) { const el=control(field);el.value=value;el.listeners.input(); }
 render(); return {values,adapter,drafts,render,control,button,status,error,fill,children,fillAll:()=>Object.entries(fields).forEach(([k,v])=>fill(k,v)),saved:()=>saved,card:()=>card};
}
test('Input rendering and editing remain detached; blanks have no zero placeholder',()=>{
 const h=harness(), before=JSON.stringify(h.values);h.fillAll();
 assert.equal(JSON.stringify(h.values),before);assert.equal(h.saved(),0);
 for(const key of Object.keys(fields))assert.equal(h.control(key).placeholder,key.endsWith('Date')?undefined:'—');
 assert.equal(h.drafts.read('2026-09').realizedPnL,'0');
});
test('SBI account totals precede collapsed breakdown and no swap control exists',()=>{
 const h=harness(),before=JSON.stringify(h.values);
 const groups=h.children().filter(el=>el.className==='form-group');
 assert.deepEqual(groups.slice(0,5).map(group=>group.children[0].textContent),['評価額','評価損益','実現損益','入金','出金']);
 const readonly=h.children().filter(el=>el.readOnly);
 assert.equal(readonly.find(el=>el.dataset.monthlyField==='swapPnL'),undefined);
 assert.equal(readonly.find(el=>el.dataset.monthlyField==='unrealizedPnL').value,'0');
 assert.ok(readonly.every(el=>!el.className.split(' ').includes('input-account')));
 assert.equal(JSON.stringify(h.values),before);
 const breakdown=h.children().find(el=>el.tag==='details');assert.notEqual(breakdown.open,true);assert.equal(breakdown.children[0].textContent,'資産内訳');
});
test('SBI explicit canonical swap zero is retained without any swap UI',()=>{
 const h=harness();h.fillAll();h.button().listeners.click();
 const swap=h.children().find(el=>el.dataset.monthlyField==='swapPnL');assert.equal(swap,undefined);
 assert.equal(JSON.parse(h.values[model.keys.monthlyAccountStates]).records[0].swapPnl,'0');
 assert.equal(h.drafts.read('2026-09').swapPnL,undefined);
});
test('explicit-zero save verifies, keeps save button without saved row, and reload rehydrates',()=>{
 const h=harness();h.fillAll();h.button().listeners.click();
 assert.equal(h.saved(),1);assert.equal(h.status(),'');assert.equal(h.button().hidden,false);
 h.drafts.clear();h.render();assert.equal(h.status(),'');assert.equal(h.control('cashBalance').value,'0');
 assert.equal(JSON.parse(h.values[model.keys.monthlyAccountStates]).records[0].swapPnl,'0');
});
test('editable domestic fields update aggregate Draft only, persist partial and rehydrate without State',()=>{
 const h=harness(),before=JSON.stringify(h.values),raw=h.values[model.keys.holdingSnapshots];
 assert.notEqual(h.control('domesticMarketValue').readOnly,true);assert.notEqual(h.control('domesticUnrealizedPnl').readOnly,true);
 h.fill('domesticMarketValue','125.25');h.fill('domesticUnrealizedPnl','-1.5');assert.equal(JSON.stringify(h.values),before);
 const aggregate=h.children().find(el=>el.dataset.monthlyField==='assetValue');assert.equal(aggregate.value,'125.25');
 h.button().listeners.click();assert.equal(h.saved(),1);assert.equal(h.values[model.keys.monthlyAccountStates],undefined);
 assert.equal(h.values[model.keys.holdingSnapshots],raw);assert.equal(h.status(),'');assert.equal(h.button().hidden,false);
 h.drafts.clear();h.render();assert.equal(h.control('domesticMarketValue').value,'125.25');assert.equal(h.control('realizedPnL').value,'');
 assert.equal(h.children().find(el=>el.className==='sbi-domestic-date').textContent,'取得日：2026/10/04');
});
test('each domestic reset changes Draft only; explicit save clears metadata without changing acquisition date',()=>{
 const h=harness();h.fill('domesticMarketValue','12');h.fill('domesticUnrealizedPnl','3');h.button().listeners.click();
 const before=JSON.stringify(h.values),resets=h.children().filter(el=>el.className==='monthly-source-reset'&&el.textContent==='取込値に戻す');assert.equal(resets.length,2);
 resets[0].listeners.click();assert.equal(h.control('domesticMarketValue').value,'0');assert.equal(h.control('domesticUnrealizedPnl').value,'3');
 resets[1].listeners.click();assert.equal(JSON.stringify(h.values),before);h.button().listeners.click();
 assert.deepEqual(JSON.parse(h.values[model.keys.monthlyAccountInputs]).records[0].overrideFields,[]);
 assert.equal(h.values[model.keys.monthlyAccountStates],undefined);
});
test('reediting returns action without changing canonical data; correction retains old snapshots',()=>{
 const h=harness();h.fillAll();h.button().listeners.click();const before=JSON.stringify(h.values);
 const id=JSON.parse(h.values[model.keys.monthlyAccountStates]).records[0].id;
 h.fill('foreignAssetValue','12.25');assert.equal(h.button().hidden,false);assert.equal(h.status(),'');assert.equal(JSON.stringify(h.values),before);
 h.button().listeners.click();assert.equal(JSON.parse(h.values[model.keys.monthlyAccountStates]).records[0].id,id);
 assert.equal(JSON.parse(h.values[model.keys.accountSnapshots]).records.length,3);assert.equal(h.status(),'');
});
test('missing input returns specific error, keeps Draft, and expands body for visible message',()=>{
 const h=harness(),before=JSON.stringify(h.values);h.button().listeners.click();
 assert.equal(h.error().textContent,'外国証券の評価額を入力してください');assert.equal(h.error().hidden,false);
 assert.equal(h.card().parts['.account-body'].style.maxHeight,'1200px');assert.equal(JSON.stringify(h.values),before);
});
test('canonical unavailability and multiple domestic candidates disable save without writes',()=>{
 for(const multiple of [false,true]) {
 const h=harness(m=>{if(!multiple)m.holdingSnapshots=null;else {m.importBatches.records.push({...m.importBatches.records[0],id:'batch_second'});
 m.holdingSnapshots.records.push({...m.holdingSnapshots.records[0],id:'hs_second',importBatchId:'batch_second'});}});
 const before=JSON.stringify(h.values);h.button().listeners.click();assert.equal(h.button().disabled,true);assert.equal(JSON.stringify(h.values),before);
 assert.match(h.error().textContent,multiple?/複数/:/取り込んで/);
 }
});
test('meaningful legacy conflict prevents save, without hiding the conflict',()=>{
 const h=harness();h.values.tradingData='{"2026":{"9":{"sbi":{"deposit":1}}}}';h.render();
 const before=JSON.stringify(h.values);h.button().listeners.click();assert.equal(h.button().disabled,true);
 assert.match(h.error().textContent,/従来方式/);assert.equal(JSON.stringify(h.values),before);
});
test('failed transaction never shows saved status or clears edited values',()=>{
 const h=harness(),before=JSON.stringify(h.values);h.fillAll();const set=h.adapter.setItem;
 let failed=false;h.adapter.setItem=(key,value)=>{if(key===model.keys.monthlyAccountStates&&!failed){failed=true;throw Error('Anonymous write failure');}set(key,value);};
 h.button().listeners.click();assert.equal(h.saved(),0);assert.equal(h.status(),'');assert.equal(h.error().hidden,false);
 assert.equal(h.drafts.read('2026-09').cashBalance,'0');assert.equal(JSON.stringify(h.values),before);
});
test('SBI known component totals update with Draft without changing Storage or domestic observations',()=>{
 const h=harness(),before=JSON.stringify(h.values);h.fill('foreignAssetValue','12.25');h.fill('foreignUnrealizedPnl','-2.5');h.fill('cashBalance','4');
 const readonly=h.children().filter(el=>el.readOnly);assert.equal(readonly.find(el=>el.dataset.monthlyField==='assetValue').value,'16.25');
 assert.equal(readonly.find(el=>el.dataset.monthlyField==='unrealizedPnL').value,'-2.5');assert.equal(JSON.stringify(h.values),before);
});
