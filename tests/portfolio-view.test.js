const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const observation=require('../assets/open-positions-view.js');
const {storage,accountId,month,copy,seed,source,pdfService,service,draft,backup}=require('./observation-override-fixture.js');
const code=fs.readFileSync('top/script.js','utf8');
const otherEntries=[{account:'GMO',assetType:'FX',symbol:'AAA/JPY',quantity:2,rate:3,side:'buy'},
 {account:'SBI',assetType:'証券',symbol:'匿名証券',quantity:4,rate:5,side:'buy'}];
function setup(s,tab='暗号資産'){
 const elements={},element=id=>elements[id]||(elements[id]={hidden:false,textContent:'',innerHTML:'',style:{},dataset:{},
  classList:{add(){},remove(){},toggle(){}},setAttribute(){},querySelectorAll:()=>[],getContext:()=>({}),closest:()=>null});
 const context=vm.createContext({window:{TradeScopeOpenPositionsView:observation,TradeScopeDataStorage:storage},localStorage:s,
  document:{getElementById:element,querySelectorAll:()=>[],querySelector:()=>null},Element:class{},Chart:class{constructor(ctx,config){this.config=config;}destroy(){}},
  topSeries:{year:2031,month:2},TOP_BASE_YEAR:2031,PROFIT_STORAGE_KEY_TRADING:'tradingData',activePortfolioAssetTab:tab,currentPortfolioChart:null,
  parseStoredJson:k=>JSON.parse(s.getItem(k)||'{}'),escapeHtml:v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
  displayAccountName:x=>x,formatLossJPY:v=>v==null?'—':String(v),applyRateClass(){},requestAnimationFrame(){},lockBackgroundScroll(){},
  bindSectionDonutReveal(){},isElementInViewport:()=>false,playDonutReveal(){},
  historyCore:{parseEntries:()=>[...otherEntries,{account:'SBI VC',assetType:'暗号資産',symbol:'FAKE/JPY',quantity:99,rate:10,side:'buy'}],
   calculateOpenPositions:e=>e.map(x=>({...x,absQuantity:x.quantity,avgRate:x.rate})),
   buildSecuritiesOpenPositions:e=>e.filter(x=>x.account==='SBI').map(x=>({...x,absQuantity:x.quantity,avgRate:x.rate}))}});
 vm.runInContext(code.slice(0,code.indexOf('const setSignClass')),context);
 vm.runInContext(code.slice(code.indexOf('function normalizeAssetTypeLabel'),code.indexOf('\nbindPortfolioTabs();')),context);
 vm.runInContext(code.slice(code.indexOf('function buildDetailDataFromPosition'),code.indexOf('function closeDetail()')),context);
 for(const id of ['detailPanel','detailTitle','detailProfit','detailRate','detailLots','detailAvg','detailNow','detailMMR','detailZero','detailHalf','detailNote','detailScrim'])context[id]=element(id);
 return{context,elements,run:()=>vm.runInContext('buildCurrentPortfolioView()',context),render:()=>vm.runInContext('renderCurrentPortfolioSection()',context),
  detail:row=>{context.row=row;vm.runInContext('openDetail(row)',context);return elements;}};
}
function change(s,field,value,{account=false}={}){const v=service(s).inspect(accountId,month),d=draft(v);if(account)d.account[field]=value;else d.holdings[0].values[field]=value;service(s).save(d,{expectedModels:v.models});}
const cryptoRows=v=>Array.from(v.rows.filter(r=>r.account===accountId));
test('Portfolio latest adopted positive rows equal the Open Positions projection plus cash',async()=>{
 const s=await seed(),h=setup(s),v=h.run(),r=cryptoRows(v);assert.equal(r.length,4);assert.deepEqual(r.map(x=>x.symbol),['BTC/JPY','ETH/JPY','USDC/JPY','JPY']);
 const op=observation.resolve(storage.readModels(s));for(let i=0;i<op.length;i++)for(const f of ['quantity','marketPrice','marketValue','holdingSnapshotId'])assert.equal(r[i][f],op[i][f]);
 assert.equal(r[3].holdingType,'cash-observation');assert.equal(r[3].metricValue,'20000');
});
for(const[field,value,account]of [['quantity','3.28199800000000000001',false],['marketPrice','12345.1234567890123456789',false],['marketValue','54321.12345000',false],['cashBalance','123.000000000000000001',true]])test('Portfolio adopted '+field+' override preserves source and decimal',async()=>{
 const s=await seed(),before=copy(storage.readModels(s));change(s,field,value,{account});const r=cryptoRows(setup(s).run());assert.equal(account?r.at(-1).quantity:r[0][field],value);
 const m=storage.readModels(s);assert.deepEqual(m.accountSnapshots,before.accountSnapshots);assert.deepEqual(m.holdingSnapshots,before.holdingSnapshots);
});
test('corrected adopted PDF source excludes old holdings without deleting them',async()=>{
 const s=await seed();await pdfService(s).save(source('b',{assets:['USDC']}),await pdfService(s).inspect(source('b',{assets:['USDC']})));
 assert.equal(storage.readModels(s).holdingSnapshots.records.length,4);const r=cryptoRows(setup(s).run());assert.deepEqual(r.map(x=>x.symbol),['USDC/JPY','JPY']);
 assert.ok(r.every(x=>x.id.includes('cash::')||x.accountSnapshotId===storage.readModels(s).monthlyAccountInputs.records[0].adoptedAccountSnapshotId));
});
test('latest target month ignores created order and selected Top year',async()=>{
 const s=await seed();await pdfService(s).save(source('b',{assets:['USDC'],period:'2031/03/01 ～ 2031/03/31',basis:'2031/03/31'}));
 const h=setup(s),a=cryptoRows(h.run());h.context.topSeries={year:1999,month:8};assert.deepEqual(cryptoRows(h.run()),a);assert.ok(a.every(r=>r.targetMonth==='2031-03'));
});
test('latest all-zero holdings never resurrect previous positives, legacy holdings or manual positions',async()=>{
 const s=await seed();await pdfService(s).save(source('b',{zero:true,period:'2031/03/01 ～ 2031/03/31',basis:'2031/03/31'}));
 s.setItem('tradingData',JSON.stringify({2031:{2:{sbivc:{holdings:[{symbol:'FAKE',quantity:999,rate:9,valueJPY:8991}]}}}}));
 const h=setup(s),r=cryptoRows(h.run());assert.deepEqual(r.map(x=>x.symbol),['JPY']);assert.equal(h.run().crypto.hasSource,true);h.render();assert.doesNotMatch(h.elements.currentPortfolioList.innerHTML,/FAKE|BTC|ETH|USDC/);
});
test('latest adopted quantity zero or null excludes only that holding',async()=>{
 for(const value of ['0','']){const s=await seed();change(s,'quantity',value);assert.deepEqual(cryptoRows(setup(s).run()).map(x=>x.symbol),['ETH/JPY','USDC/JPY','JPY']);}
});
test('unknown adopted quantity does not imply a complete holdings ratio',async()=>{
 const s=await seed();change(s,'quantity','');const h=setup(s);h.render();assert.equal(h.run().crypto.hasUnknownQuantity,true);assert.equal(h.elements.currentPortfolioRatioTitle.textContent,'評価額取得分の比率');
});
test('no canonical source excludes SBI VC legacy/manual while preserving other accounts',async()=>{
 const s=await seed();s.removeItem(storage.keys.monthlyAccountInputs);const h=setup(s);assert.equal(cryptoRows(h.run()).length,0);assert.equal(h.run().crypto.hasSource,false);
 assert.deepEqual(Array.from(h.run().rows,r=>r.symbol).sort(),otherEntries.map(e=>e.symbol).sort());
});
test('other account crypto positions are not indiscriminately replaced by SBI VC observation rows',async()=>{
 const s=await seed(),h=setup(s);h.context.historyCore.parseEntries=()=>[{account:'OTHER',assetType:'暗号資産',symbol:'OTHER/JPY',quantity:6,rate:7,side:'buy'}];
 const r=h.run().rows;assert.equal(r.filter(x=>x.symbol==='OTHER/JPY').length,1);assert.equal(cryptoRows(h.run()).length,4);
});
test('malformed canonical Storage fails closed, does not revive legacy, and renders other accounts',async()=>{
 const s=await seed();s.setItem(storage.keys.monthlyAccountInputs,'{');const h=setup(s);assert.equal(h.run().crypto.error,true);assert.equal(cryptoRows(h.run()).length,0);h.render();assert.match(h.elements.currentPortfolioSourceStatus.textContent,/取得できません/);assert.doesNotMatch(h.elements.currentPortfolioList.innerHTML,/FAKE/);
});
test('cash and holding valuations count once; report total/collateral do not become Portfolio rows',async()=>{
 const s=await seed(),r=cryptoRows(setup(s).run());assert.equal(r.reduce((sum,x)=>sum+Number(x.metricValue),0),20126.375);
 assert.equal(r.filter(x=>x.symbol==='JPY').length,1);assert.ok(r.every(x=>!['1234567','5000','4880'].includes(x.metricValue)));
});
test('adopted cash null remains unknown and explicit zero is not a positive asset',async()=>{
 for(const value of ['','0']){const s=await seed();change(s,'cashBalance',value,{account:true});const h=setup(s),r=cryptoRows(h.run());
  if(value===''){assert.equal(r.at(-1).marketValue,null);h.render();assert.match(h.elements.currentPortfolioList.innerHTML,/JPY（現金）/);assert.match(h.elements.currentPortfolioRatioTitle.textContent,/評価額取得分/);}
  else assert.ok(!r.some(x=>x.symbol==='JPY'));
 }
});
test('acquisition and unrealized P/L remain null, valuation rate never enters avgRate',async()=>{
 const s=await seed(),h=setup(s),r=cryptoRows(h.run())[0];assert.equal(r.acquisitionPrice,null);assert.equal(r.unrealizedPnl,null);assert.equal(r.avgRate,undefined);
 const el=h.detail(r);assert.equal(el.detailAvg.textContent,'—');assert.equal(el.detailAcquisitionLabel.textContent,'取得原価');assert.equal(el.detailValuationLabel.textContent,'評価レート');assert.equal(el.detailNow.textContent,'321.123456789 円');assert.equal(el.detailLossRiskSection.hidden,true);assert.equal(el.detailZero.textContent,'—');
});
test('unknown quantity/rate/valuation never turns into displayed zero',async()=>{
 const s=await seed({blankRate:true});change(s,'marketValue','');const h=setup(s),r=cryptoRows(h.run())[0];h.render();assert.equal(r.marketPrice,null);assert.equal(r.metricValue,null);
 assert.match(h.elements.currentPortfolioList.innerHTML,/評価額 —/);assert.match(h.elements.currentPortfolioList.innerHTML,/評価レート —/);assert.equal(h.detail(r).detailNow.textContent,'—');
});
test('very small quantity and long rate/value retain digits in list and detail',async()=>{
 const s=await seed();change(s,'quantity','0.000000000000000001');change(s,'marketPrice','12345.1234567890123456789');change(s,'marketValue','98765.1234567890123456789');
 const h=setup(s);h.render();const html=h.elements.currentPortfolioList.innerHTML;for(const text of ['0.000000000000000001 BTC','12,345.1234567890123456789 円','98,765.1234567890123456789 円'])assert.ok(html.includes(text));
 const el=h.detail(cryptoRows(h.run())[0]);assert.equal(el.detailLots.textContent,'0.000000000000000001 BTC');assert.equal(el.detailNow.textContent,'12,345.1234567890123456789 円');
});
test('list/chart use identical rows and value sources including cash',async()=>{
 const s=await seed(),h=setup(s);h.render();const chart=h.context.currentPortfolioChart.config;
 assert.deepEqual([...chart.data.labels],['BTC/JPY','ETH/JPY','USDC/JPY','JPY（現金）']);assert.deepEqual([...chart.data.datasets[0].data],[42.125,42.125,42.125,20000]);
 assert.match(h.elements.currentPortfolioList.innerHTML,/評価額 42\.125 円/);assert.match(h.elements.currentPortfolioList.innerHTML,/評価額 20,000 円/);assert.equal(h.elements.currentPortfolioRatioTitle.textContent,'保有比率');
 assert.match(chart.options.plugins.tooltip.callbacks.label({dataIndex:0,label:'BTC/JPY',parsed:42.125}),/42\.125 円/);
});
test('partial valuation uses obtained-only ratio, not zero valuation or full-holdings claim',async()=>{
 const s=await seed();change(s,'marketValue','');const h=setup(s);h.render();assert.equal(h.elements.currentPortfolioRatioTitle.textContent,'評価額取得分の比率');assert.equal(h.context.currentPortfolioChart.config.data.labels.length,3);
 assert.match(h.elements.currentPortfolioList.innerHTML,/評価額 —/);assert.equal(h.run().crypto.holdings[0].marketValue,null);
});
test('explicit zero valuation is shown as zero while contributing no chart sector',async()=>{
 const s=await seed();change(s,'marketValue','0');const h=setup(s);h.render();assert.match(h.elements.currentPortfolioList.innerHTML,/評価額 0 円/);assert.equal(h.context.currentPortfolioChart.config.data.labels.length,3);assert.equal(h.elements.currentPortfolioRatioTitle.textContent,'保有比率');
});
test('empty canonical holdings and zero cash keep crypto tab empty rather than auto-switching or falling back',async()=>{
 const s=await seed();for(const field of ['quantity']){const v=service(s).inspect(accountId,month),d=draft(v);d.holdings.forEach(h=>h.values[field]='0');d.account.cashBalance='0';service(s).save(d,{expectedModels:v.models});}
 const h=setup(s);h.render();assert.equal(h.context.activePortfolioAssetTab,'暗号資産');assert.match(h.elements.currentPortfolioList.innerHTML,/データなし/);assert.equal(h.context.currentPortfolioChart,null);assert.match(h.elements.currentPortfolioSourceStatus.textContent,/2031年2月時点/);
});
test('FX and SBI securities Portfolio aggregation/display remains unchanged',async()=>{
 const s=await seed();s.setItem('tradingData',JSON.stringify({2031:{2:{sbi:{holdings:[{symbol:'匿名証券',quantity:4,rate:8,acquisitionRate:5,valueJPY:32,valueFilled:true}]}}}}));
 const h=setup(s,'FX');h.render();assert.match(h.elements.currentPortfolioList.innerHTML,/2 Lot/);assert.deepEqual([...h.context.currentPortfolioChart.config.data.datasets[0].data],[2400]);
 const fx=h.run().rows.find(x=>x.assetType==='FX'),el=h.detail(fx);assert.equal(el.detailQuantityLabel.textContent,'ロット数');assert.equal(el.detailAcquisitionLabel.textContent,'平均建値');assert.equal(el.detailLossRiskSection.hidden,false);assert.equal(el.detailObservationPnlRow.hidden,true);
 h.context.activePortfolioAssetTab='証券';h.render();assert.match(h.elements.currentPortfolioList.innerHTML,/評価損益/);assert.match(h.elements.currentPortfolioList.innerHTML,/¥12/);
});
test('projection/reload/render leave all Storage and Backup v13 byte identical',async()=>{
 const s=await seed(),before=s.snapshot(),payload=copy(backup(s).build()),h=setup(s);h.run();h.render();h.detail(cryptoRows(h.run())[0]);setup(s).render();
 assert.equal(s.snapshot(),before);assert.equal(payload.backupVersion,14);assert.deepEqual(copy(backup(s).build()),payload);assert.equal(s.getItem(storage.keys.monthlyAccountStates),null);
});
test('Portfolio modules, responsive styles, null-safe display and canonical refresh remain scoped',()=>{
 const html=fs.readFileSync('index.html','utf8'),css=fs.readFileSync('top/style.css','utf8');
 assert.ok(html.indexOf('observation-adoption.js')<html.indexOf('open-positions-view.js'));assert.match(html,/detailQuantityLabel/);assert.match(css,/\.holding-observation-detail \.detail-grid strong[\s\S]*overflow-wrap: anywhere/);
 const block=code.slice(code.indexOf('function isPortfolioObservation'),code.indexOf('function isEtfLikeSecuritiesSymbol'));assert.doesNotMatch(block,/\.setItem\(|\.commit\(|\.removeItem\(|console\./);
 assert.doesNotMatch(code,/buildCryptoPortfolioFromMonthlyHoldings|applyMonthlyCryptoRows/);assert.match(code,/Object\.values\(window\.TradeScopeDataStorage\.keys\)/);
});
