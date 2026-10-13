const test=require('node:test'),assert=require('node:assert/strict');
const view=require('../assets/balance-view.js');
const observation=(value,month='2032-10',key='cash',extra={})=>({key,value,sourceMonth:month,source:{recordId:'anonymous',sourceType:'manual'},...extra});
const resolve=rows=>view.resolve(rows,{targetMonth:'2032-10',componentKeys:['cash']});
test('balance uses the current confirmed value and keeps independent source provenance',()=>{
 const v=resolve([observation('7','2032-09'),observation('11')]),c=v.components[0];
 assert.equal(c.value,'11');assert.equal(c.currentConfirmed,true);assert.equal(c.carried,false);assert.equal(c.sourceMonth,'2032-10');
 assert.equal(c.source.sourceType,'manual');assert.equal(v.currentComplete,true);
});
test('unconfirmed current balance carries the latest known value without becoming a current input',()=>{
 const c=resolve([observation('8','2032-08'),observation('9','2032-09'),observation(null)]).components[0];
 assert.equal(c.value,'9');assert.equal(c.sourceMonth,'2032-09');assert.equal(c.currentConfirmed,false);assert.equal(c.carried,true);
});
for(const missing of [null,undefined,'','  '])test('missing '+String(missing)+' remains unknown without a prior value',()=>{
 const v=resolve([observation(missing)]);assert.equal(v.knownTotal,null);assert.equal(v.components[0].explicitZero,false);assert.equal(v.unknownComponents,true);assert.equal(v.complete,false);
});
for(const zero of ['0','0.00','-0.000',0])test('explicit '+String(zero)+' stops previous positive fallback',()=>{
 const v=resolve([observation('99','2032-09'),observation(zero)]);assert.equal(v.components[0].explicitZero,true);assert.equal(v.components[0].carried,false);assert.equal(Number(v.knownTotal),0);
});
test('a previous confirmed zero is carried instead of an older positive',()=>{
 const c=resolve([observation('9','2032-08'),observation('0','2032-09')]).components[0];assert.equal(c.value,'0');assert.equal(c.explicitZero,true);assert.equal(c.carried,true);
});
test('partial subtotal is not complete; carried complete coverage is not current complete',()=>{
 const options={targetMonth:'2032-10',componentKeys:['cash','holding']};
 let v=view.resolve([observation('0')],options);assert.equal(v.knownTotal,'0');assert.equal(v.partial,true);assert.equal(v.complete,false);
 v=view.resolve([observation('8'),observation('3','2032-09','holding')],options);assert.equal(v.knownTotal,'11');assert.equal(v.complete,true);assert.equal(v.hasCarried,true);assert.equal(v.currentComplete,false);
 v=view.resolve([observation('8'),observation('3','2032-10','holding')],options);assert.equal(v.currentComplete,true);assert.equal(v.hasCarried,false);
});
test('exact decimals, negative balances and numeric exponent notation do not use zero defaults',()=>{
 const v=view.resolve([observation('0.000000000000000001'),observation('-2','2032-10','holding')],{targetMonth:'2032-10',componentKeys:['cash','holding']});
 assert.equal(v.knownTotal,'-1.999999999999999999');assert.equal(view.decimal(1e-18),'0.000000000000000001');assert.equal(view.decimal(1e21),'1000000000000000000000');
});
test('same-month ambiguous observations stop instead of selecting one or falling back',()=>{
 const v=resolve([observation('9','2032-09'),observation('10'),observation('11')]);assert.equal(v.knownTotal,null);assert.equal(v.blocked,true);
});
test('an explicit termination/unknown-roster barrier prevents stale holdings from revival',()=>{
 assert.equal(resolve([observation('9','2032-09'),observation(null,'2032-10','cash',{preventCarry:true})]).knownTotal,null);
});
test('source formats do not imply source priority; adoption is provided by the caller',()=>{
 const v=resolve([observation('9','2032-09','cash',{source:{sourceType:'pdf'}}),observation('11','2032-10','cash',{source:{sourceType:'manual'}})]);
 assert.equal(v.knownTotal,'11');assert.equal(v.components[0].source.sourceType,'manual');
});
test('year/future boundaries and read-only state are preserved',()=>{
 const rows=[observation('9','2031-12'),observation('12','2032-11')],before=JSON.stringify(rows);assert.equal(resolve(rows).knownTotal,null);assert.equal(JSON.stringify(rows),before);
});
test('invalid balance values fail rather than become zeros',()=>{
 for(const invalid of [NaN,Infinity,true,{},'bad'])assert.throws(()=>resolve([observation(invalid)]),/INVALID_BALANCE_VALUE/);
});
