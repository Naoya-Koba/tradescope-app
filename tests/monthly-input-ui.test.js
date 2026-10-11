const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const ui=require('../assets/monthly-input-ui.js');
const model=require('../assets/data-model-storage.js'),{fixture}=require('./monthly-display-fixture.js');
class Element {constructor(tag){this.tag=tag;this.children=[];this.dataset={};} append(...nodes){this.children.push(...nodes);}appendChild(node){this.append(node);}}
const document={createElement:tag=>new Element(tag)};
test('imported monthly form uses the same five ordered labels as editable legacy FX',()=>{
 const container=new Element('div');ui.renderReadOnly(document,container,{realizedPnL:'-12.5',swapPnL:'2',unrealizedPnL:null,deposit:'0',withdrawal:null},'gmo');
 assert.deepEqual(container.children.map(group=>group.children[0].textContent),['決済損益','スワップ損益','評価損益','入金','出金']);
 const inputs=container.children.map(group=>group.children[1]);assert.deepEqual(inputs.map(input=>input.value),['-12.5','2','','0','']);
 assert.ok(inputs.every(input=>input.readOnly&&input.placeholder==='—'&&!input.className.split(' ').includes('input-account')));
});
test('UI preserves decimal string display and does not create writable Draft/legacy controls',()=>{
 const group=ui.readOnlyField(document,'unrealizedPnL','評価損益','0.1234567890123456789','anonymous');
 assert.equal(group.children[1].value,'0.1234567890123456789');assert.equal(group.children[1].dataset.account,undefined);
 assert.equal(group.children[1].dataset.field,undefined);
});
test('Input UI has no writes, network, calculation, override or save engine changes',()=>{
 const source=fs.readFileSync(require.resolve('../assets/monthly-input-ui.js'),'utf8');
 assert.doesNotMatch(source,/localStorage|setItem|removeItem|\.commit\(|fetch\(|console\.|reportedMonthlyRealizedPnl/);
 const profit=fs.readFileSync(require.resolve('../profit/soneki.js'),'utf8');
 const render=profit.slice(profit.indexOf('function renderAccountInputs()'),profit.indexOf('function handleAccountInputBlur('));
 assert.match(render,/gmoMonthlyUI.renderCard/);assert.doesNotMatch(render,/\.setItem\(|\.commit\(|__saved\s*=/);
});
test('readonly helper is loaded before SBI and profit UI with aligned precache version',()=>{
 const html=fs.readFileSync(require.resolve('../profit/soneki.html'),'utf8');
 assert.ok(html.indexOf('monthly-input-ui.js')<html.indexOf('sbi-monthly-ui.js'));assert.ok(html.indexOf('sbi-monthly-ui.js')<html.indexOf('src="soneki.js'));
});
test('manual override audit: current v2 still rejects adopted realized mismatch',()=>{
 const f=fixture();f.models.monthlyAccountStates.records[0].realizedPnl='11';assert.throws(()=>model.validateModels(f.models));
});
test('manual override audit: unknown override metadata is not silently accepted by current schema',()=>{
 const f=fixture();f.models.monthlyAccountStates.records[0].overrides={realizedPnl:true};assert.throws(()=>model.validateModels(f.models));
});
