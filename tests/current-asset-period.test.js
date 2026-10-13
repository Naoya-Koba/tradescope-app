const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const assets=require('../assets/current-asset-view.js');
const {fixture}=require('./monthly-display-fixture.js');
const display=require('../assets/monthly-display-view.js');
const {seed,storage}=require('./observation-override-fixture.js');
function dashboard(){
  const metric=(value,month='2032-09',status='current complete')=>({value,sourceMonth:month,status});
  return {year:2032,hasData:true,sourceFingerprint:'anonymous-period',netDelta:25,netGrowth:25/300*100,
    confirmedDelta:20,confirmedGrowth:7,initialNet:300,initialConfirmed:280,
    confirmed:{value:300},netPnl:{value:5},confirmedPnl:{value:4},netPnlGrowth:2,confirmedPnlGrowth:1,
    rows:['gmo','lightfx'].map((key,i)=>({key,name:key,color:'#888',metrics:{net:metric(150+i*25),
      completeNet:metric(150+i*25)}}))};
}
const view=d=>assets.create(d,{},2032);
test('same complete per-account bases expose unchanged period values without mutation',()=>{
  const d=dashboard(),before=JSON.stringify(d),v=view(d);
  assert.equal(v.netPeriodComparison.comparable,true);assert.equal(v.netPeriodComparison.delta,25);
  assert.equal(v.netPeriodComparison.growth,d.netGrowth);assert.equal(JSON.stringify(d),before);
  assert.equal(v.netPeriodComparison.sources[0].period.sourceMonth,'2032-09');
});
test('matching previous complete months remain comparable without requiring a new shared month',()=>{
  const d=dashboard();for(const field of ['net','completeNet'])Object.assign(d.rows[1].metrics[field],{sourceMonth:'2032-08',status:'previous complete'});
  assert.equal(view(d).netPeriodComparison.comparable,true);
});
for(const [name,change,reason]of [
  ['partial',d=>d.rows[0].metrics.net.status='current partial','partial'],
  ['missing current',d=>d.rows[0].metrics.net.value=null,'unknown'],
  ['missing period',d=>d.rows[0].metrics.completeNet.value=null,'unknown'],
  ['different month',d=>d.rows[0].metrics.completeNet.sourceMonth='2032-08','source-month-mismatch'],
  ['missing month',d=>d.rows[0].metrics.net.sourceMonth=null,'source-month-mismatch'],
  ['other year',d=>{for(const field of ['net','completeNet'])d.rows[0].metrics[field].sourceMonth='2031-09';},'source-month-mismatch'],
  ['different value',d=>d.rows[0].metrics.net.value=999,'value-mismatch'],
  ['conflict',d=>d.rows[0].conflict=true,'conflict'],
  ['different selected year',d=>d.year=2031,'year-mismatch'],
  ['no account',d=>d.rows=[],'missing-accounts']
])test(name+' hides only net-card period values with an explicit reason',()=>{
  const d=dashboard();change(d);const before=JSON.stringify(d),v=view(d),p=v.netPeriodComparison;
  assert.equal(p.comparable,false);assert.equal(p.delta,null);assert.equal(p.growth,null);
  assert.ok(p.reasons.some(r=>r.reason===reason));assert.equal(JSON.stringify(d),before);
});
test('equal observed and period amounts do not prove comparable source semantics',async()=>{
  const s=await seed(),models=storage.readModels(s),d=dashboard();d.year=2031;
  for(const row of d.rows)for(const field of ['net','completeNet'])row.metrics[field].sourceMonth='2031-02';
  d.rows.push({key:'sbivc',name:'SBI VC',metrics:{net:{value:20126.375,sourceMonth:'2031-02',status:'current complete'},
    completeNet:{value:20126.375,sourceMonth:'2031-02',status:'current complete'}}});
  const v=assets.create(d,models,2031);assert.equal(v.rows.at(-1).metrics.net.value,v.rows.at(-1).metrics.completeNet.value);
  assert.equal(v.netPeriodComparison.comparable,false);
  assert.ok(v.netPeriodComparison.reasons.some(r=>r.accountKey==='sbivc'&&r.reason==='observation-vs-period'));
});
test('explicit zero, negative growth and unknown denominator are not conflated',()=>{
  const d=dashboard();d.netDelta=0;d.netGrowth=0;
  assert.equal(view(d).netPeriodComparison.delta,0);assert.equal(view(d).netPeriodComparison.growth,0);
  d.netDelta=-15;d.netGrowth=-5;assert.equal(view(d).netPeriodComparison.growth,-5);
  d.netGrowth=null;assert.equal(view(d).netPeriodComparison.delta,-15);assert.equal(view(d).netPeriodComparison.growth,null);
});
test('real partial monthly projection keeps calculator, annual/period metrics and series unchanged',()=>{
  const f=fixture(),w={};vm.runInNewContext(fs.readFileSync('assets/profit-metrics.js','utf8'),{window:w});
  const shared=display.create(w.TradeScopeProfitMetrics,f.tradingData,f.initialFunds,f.initialUnrealized,f.models,f.accounts);
  const before=JSON.stringify([shared.dashboard(2026),shared.series(2026),shared.monthlyPnl(2026,9),f]);
  const d=shared.dashboard(2026),v=assets.create(d,f.models,2026);
  assert.equal(v.netPeriodComparison.delta,null);assert.equal(v.netPeriodComparison.growth,null);
  assert.equal(JSON.stringify([shared.dashboard(2026),shared.series(2026),shared.monthlyPnl(2026,9),f]),before);
});
function render(d){
  const elements=new Map();const document={getElementById(id){if(!elements.has(id))elements.set(id,{textContent:'',classList:{remove(){},add(){}}});return elements.get(id);}};
  const code=fs.readFileSync('top/script.js','utf8').replace(/\r\n/g,'\n').match(/function updateKPIs\(\) \{[\s\S]*?\n}\nupdateKPIs\(\);/)[0];
  vm.runInNewContext(code,{document,window:{},currentAssetView:view(d),latestDashboard:d,topSeries:{year:2032},
    linkedCalculator:()=>({warning:()=>''}),portfolioMonthLabel:m=>m,fmtJPY:v=>String(v),
    setSignClass:(el,value)=>el.signValue=value});
  return elements;
}
test('Top hides incomparable delta/growth and resets sign while retaining assets and other KPIs',()=>{
  const d=dashboard();d.rows[0].metrics.net.status='current partial';const el=render(d);
  assert.equal(el.get('deltaTotal').textContent,'—');assert.equal(el.get('growthTotal').textContent,'—');
  assert.equal(el.get('deltaTotal').signValue,null);assert.equal(el.get('growthTotal').signValue,null);
  assert.equal(el.get('kpiTotal').textContent,'325');assert.equal(el.get('kpiRealized').textContent,'300');
  assert.equal(el.get('annualNetPnL').textContent,'5');assert.equal(el.get('annualConfirmedPnL').textContent,'4');
  assert.equal(el.get('growthNet').textContent,'+7.0%');assert.equal(el.get('annualNetPnLGrowth').textContent,'+2.0%');
});
test('Top still shows comparable zero and negative period values instead of coercing missing',()=>{
  const d=dashboard();d.netDelta=0;d.netGrowth=0;let el=render(d);
  assert.equal(el.get('deltaTotal').textContent,'0');assert.equal(el.get('growthTotal').textContent,'+0.0%');
  d.netDelta=-15;d.netGrowth=-5;el=render(d);
  assert.equal(el.get('deltaTotal').textContent,'-15');assert.equal(el.get('growthTotal').textContent,'-5.0%');
});
