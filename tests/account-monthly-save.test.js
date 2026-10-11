const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const legacy=require('../assets/legacy-monthly-save.js'),{MemoryStorage}=require('./gmo-support.js');
const window={};vm.runInNewContext(fs.readFileSync(require.resolve('../assets/profit-metrics.js'),'utf8'),{window});const metrics=window.TradeScopeProfitMetrics;
test('one legacy account save preserves other accounts, months and existing month flag',()=>{
 const data={2026:{8:{__saved:true,gmo:{realizedPnL:2},sbi:{holdings:[{symbol:'架空商品',quantity:1}]},lightfx:{swapPnL:3}},7:{gmo:{realizedPnL:4}}}};
 const adapter=new MemoryStorage({tradingData:JSON.stringify(data),yearInitialFunds:'{"anonymous":1}'});
 const result=legacy.createService(adapter).save({year:2026,month:8,accountKey:'gmo',row:{realizedPnL:0,swapPnL:0},expectedRow:data[2026][8].gmo});
 assert.deepEqual(result.data[2026][8].sbi,data[2026][8].sbi);assert.deepEqual(result.data[2026][8].lightfx,data[2026][8].lightfx);
 assert.deepEqual(result.data[2026][7],data[2026][7]);assert.equal(result.data[2026][8].__saved,true);assert.equal(adapter.getItem('yearInitialFunds'),'{"anonymous":1}');
});
test('new zero month saves account-level evidence only, not another zero placeholder',()=>{
 const adapter=new MemoryStorage({tradingData:'{"2026":{"8":{"minano":{"realizedPnL":0}}}}'});
 const data=legacy.createService(adapter).save({year:2026,month:8,accountKey:'lightfx',row:{realizedPnL:0,swapPnL:0,unrealizedPnL:0},expectedRow:{}}).data;
 assert.equal(data[2026][8].__saved,undefined);assert.equal(metrics.isAccountMonthEntered(data[2026],8,'lightfx'),true);
 assert.equal(metrics.isAccountMonthEntered(data[2026],8,'minano'),false);assert.equal(metrics.isMonthEntered(data[2026],8,['lightfx']),true);
});
test('legacy save starts from fresh persisted data, not another account memory Draft',()=>{
 const adapter=new MemoryStorage({tradingData:'{"2026":{"8":{"gmo":{"realizedPnL":1},"lightfx":{"realizedPnL":5}}}}'});
 const saved=legacy.createService(adapter).save({year:2026,month:8,accountKey:'gmo',row:{realizedPnL:2},expectedRow:{realizedPnL:1}});
 assert.equal(saved.data[2026][8].lightfx.realizedPnL,5);
});
test('legacy service rejects empty row and canonical cutover accounts without writes',()=>{
 const adapter=new MemoryStorage(),service=legacy.createService(adapter);
 for(const params of [{accountKey:'lightfx',row:{}},...['sbi','gmo','lightfx','minano'].map(accountKey=>({accountKey,row:{realizedPnL:1}}))])assert.throws(()=>service.save({year:2026,month:9,...params}));assert.equal(adapter.writes,0);
});
test('legacy stale row and quota failure preserve exact saved data and derived cache',()=>{
 const adapter=new MemoryStorage({tradingData:' {"2026":{"8":{"gmo":{"realizedPnL":1}}}} ',tradeScopeTopSummarySnapshotV1:'{}'}),service=legacy.createService(adapter),before=adapter.snapshot();
 assert.throws(()=>service.save({year:2026,month:8,accountKey:'gmo',row:{realizedPnL:2},expectedRow:{realizedPnL:3}}));assert.deepEqual(adapter.snapshot(),before);
 const set=adapter.setItem.bind(adapter);let failed=false;adapter.setItem=(key,value)=>{if(!failed&&key==='tradingData'){failed=true;throw Error('quota');}set(key,value);};
 assert.throws(()=>service.save({year:2026,month:8,accountKey:'gmo',row:{realizedPnL:2},expectedRow:{realizedPnL:1}}));assert.deepEqual(adapter.snapshot(),before);
});
test('Input has account actions, memory-only edits and no global save collector',()=>{
 const html=fs.readFileSync(require.resolve('../profit/soneki.html'),'utf8'),source=fs.readFileSync(require.resolve('../profit/soneki.js'),'utf8');
 assert.doesNotMatch(html,/id="saveMonthData"/);assert.doesNotMatch(source,/getElementById\('saveMonthData'\)/);
 assert.match(source,/data-save-account/);assert.match(source,/legacyMonthlySave\.save/);assert.match(source,/legacyInputData\[currentYear\]\[currentMonth\]\[account\]/);
 const save=source.slice(source.indexOf('function saveToStorage()'),source.indexOf('function loadFromStorage()'));assert.doesNotMatch(save,/legacyInputData/);
});
