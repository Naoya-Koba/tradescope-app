const test=require('node:test'),assert=require('node:assert/strict');
const ui=require('../assets/observation-input-ui.js');
const {accountId,month,seed,service,pdfService,source,draft,storage}=require('./observation-override-fixture.js');
class Element{
 constructor(tag){this.tagName=tag;this.children=[];this.textContent='';this.dataset={};this.style={};this.attributes={};this.events={};this.className='';this.scrollHeight=500;
  this.classList={contains:k=>this.className.split(' ').includes(k),add:k=>{this.className+=' '+k;}};}
 append(...v){this.children.push(...v);}replaceChildren(...v){this.children=[...v];}
 setAttribute(k,v){this.attributes[k]=v;}addEventListener(k,fn){this.events[k]=fn;}
}
const all=e=>[e,...e.children.flatMap(all)],text=e=>[e.textContent,...e.children.map(text)].join(' ');
const button=(card,label)=>all(card).find(e=>e.tagName==='button'&&e.textContent===label);
const input=(card,suffix)=>all(card).find(e=>e.tagName==='input'&&e.id.endsWith(suffix));
function render(s){return ui.render({document:{createElement:t=>new Element(t)},adapter:s,accountId,targetMonth:month,displayName:'SBI VC'});}
function edit(s){const card=render(s);button(card,'修正').events.click();return card;}
const inspect=s=>service(s).inspect(accountId,month);
test('normal saved card keeps compact common accordion, adopted status and edit-only operation',async()=>{
 const s=await seed(),v=inspect(s),d=draft(v);d.account.cashBalance='1';service(s).save(d,{expectedModels:v.models});const before=s.snapshot(),card=render(s);
 assert.equal(card.children[0].attributes['aria-expanded'],'false');assert.match(text(card.children[1]),/手動補正あり|JPY残高|1円/);assert.doesNotMatch(text(card.children[0]),/保存済み|手動補正/);
 assert.equal(all(card).filter(e=>e.tagName==='input').length,0);assert.ok(button(card,'修正'));assert.ok(!button(card,'保存'));assert.equal(s.snapshot(),before);
});
test('edit only exposes five value fields; month/source/Instrument identities remain read-only',async()=>{
 const s=await seed({assets:['USDC']}),card=edit(s),inputs=all(card).filter(e=>e.tagName==='input');assert.equal(inputs.length,5);
 assert.ok(inputs.every(e=>e.type==='text'&&e.inputMode==='decimal'&&!e.className.includes('input-account')));assert.match(text(card),/2026|2031\/02|USDC\/JPY/);
 assert.ok(button(card,'保存'));assert.ok(button(card,'キャンセル'));assert.ok(button(card,'PDF値に戻す'));
});
test('typing and cancelling restores adopted display without any writes',async()=>{const s=await seed(),before=s.snapshot(),card=edit(s);input(card,'cashBalance').value='1';input(card,'quantity').value='9';assert.equal(s.snapshot(),before);button(card,'キャンセル').events.click();assert.equal(all(card).filter(e=>e.tagName==='input').length,0);assert.doesNotMatch(text(card),/手動補正あり/);assert.equal(s.snapshot(),before);});
test('explicit UI save verifies adoption, exits editing and survives reload precisely',async()=>{const s=await seed(),card=edit(s);input(card,'cashBalance').value='0';input(card,'quantity').value='7.1234500000000000001';input(card,'marketPrice').value='99.123456789000001';button(card,'保存').events.click();assert.equal(inspect(s).adopted.cashBalance,'0');assert.equal(inspect(s).holdings[0].adopted.quantity,'7.1234500000000000001');assert.match(text(render(s)),/手動補正あり|0円|7.1234500000000000001/);assert.ok(!button(card,'保存'));});
test('PDF reset changes only draft; cancel retains override; save removes active override',async()=>{const s=await seed(),v=inspect(s),d=draft(v);d.account.cashBalance='1';service(s).save(d,{expectedModels:v.models});let card=edit(s),before=s.snapshot();button(card,'PDF値に戻す').events.click();assert.equal(input(card,'cashBalance').value,'20000');assert.equal(s.snapshot(),before);button(card,'キャンセル').events.click();assert.equal(inspect(s).adopted.cashBalance,'1');card=edit(s);button(card,'PDF値に戻す').events.click();button(card,'保存').events.click();assert.equal(inspect(s).hasOverrides,false);});
test('invalid numeric UI input shows safe error, retains draft and leaves Storage unchanged',async()=>{const s=await seed(),before=s.snapshot(),card=edit(s);input(card,'quantity').value='1e9';button(card,'保存').events.click();assert.match(text(card),/保存できませんでした/);assert.equal(input(card,'quantity').value,'1e9');assert.equal(s.snapshot(),before);assert.equal(button(card,'保存').disabled,false);});
test('blank manual field stays missing rather than zero in saved adopted display',async()=>{const s=await seed(),card=edit(s);input(card,'assetValue').value='';button(card,'保存').events.click();assert.equal(inspect(s).adopted.assetValue,null);assert.match(text(card),/帳票上の資産合計 —/);});
test('persisted relevant zero holding stays editable but unrelated source zero has no edit record',async()=>{const s=await seed({assets:['DEMO']});const p=source('b',{assets:['DEMO','UNUSED'],zero:true,blankRate:true});await pdfService(s).save(p,await pdfService(s).inspect(p));const card=edit(s);assert.match(text(card),/DEMO\/JPY/);assert.doesNotMatch(text(card),/UNUSED/);assert.equal(all(card).filter(e=>e.tagName==='input').length,5);});
test('concurrent source correction cannot save stale Input draft onto a new PDF',async()=>{const s=await seed(),card=edit(s);input(card,'cashBalance').value='1';const p=source('b');await pdfService(s).save(p,await pdfService(s).inspect(p));const before=s.snapshot();button(card,'保存').events.click();assert.match(text(card),/保存できませんでした/);assert.equal(s.snapshot(),before);});
test('double/reentrant save click is blocked during the protected journal operation',async()=>{const s=await seed(),card=edit(s),set=s.setItem.bind(s);let clicks=0;s.setItem=(key,value)=>{if(key===storage.keys.monthlyAccountInputs){clicks++;button(card,'保存').events.click();}set(key,value);};input(card,'cashBalance').value='1';button(card,'保存').events.click();assert.equal(clicks,1);assert.equal(inspect(s).adopted.cashBalance,'1');assert.equal(inspect(s).input.overrideHistory.length,0);});
