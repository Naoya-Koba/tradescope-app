(function(){
  'use strict';
  if(location.protocol!=='http:'||!['localhost','127.0.0.1'].includes(location.hostname)||!location.port)return;
  const model=TradeScopeDataStorage,keys=['tradingData','yearInitialFunds','yearInitialUnrealized',...Object.values(model.keys)];
  const token='anonymousCurrentBalanceBaseline',show=v=>document.getElementById('result').textContent=JSON.stringify(v,null,2);
  const baseline=()=>sessionStorage.setItem(token,JSON.stringify(keys.map(k=>[k,localStorage.getItem(k)])));
  function render(){
    if(!sessionStorage.getItem(token))return;
    const f=AnonymousMonthlyDisplay.fixture(),models=model.readModels(localStorage);
    const display=TradeScopeMonthlyDisplay.create(TradeScopeProfitMetrics,JSON.parse(localStorage.getItem('tradingData')),f.initialFunds,{},models,f.accounts);
    const current=TradeScopeCurrentAssets.create(display.dashboard(2026),models,2026,{balanceHistory:display.balanceHistory});
    const row=current.rows.find(r=>r.key==='sbi'),body=document.getElementById('balances');body.replaceChildren();
    for(const c of row.balance.components){const tr=document.createElement('tr');for(const value of [c.label,c.value??'—',c.sourceMonth??'—',c.carried?'以前の確認値':c.missing?'未取得':c.explicitZero?'確認済み0':'当月確認済み']){
      const td=document.createElement('td');td.textContent=value;tr.appendChild(td);}body.appendChild(tr);}
    show({anonymousOnly:true,sbiCurrentAmount:row.metrics.net.value,carry:row.balance.hasCarried,completeBalance:row.balance.complete,
      topAndAllocationMatch:current.accountData.find(a=>a.label==='SBI')?.amount===row.metrics.net.value,
      sbiOctoberStateAbsent:!models.monthlyAccountStates.records.some(s=>s.accountId==='acc_sbi_sec'&&s.targetMonth==='2026-10')});
  }
  document.getElementById('prepare').onclick=()=>{
    if(keys.some(k=>localStorage.getItem(k)!==null))return show({refused:'fresh origin required'});
    const f=AnonymousMonthlyDisplay.fixture();
    localStorage.setItem('tradingData',JSON.stringify(f.tradingData));localStorage.setItem('yearInitialFunds',JSON.stringify(f.initialFunds));localStorage.setItem('yearInitialUnrealized','{}');
    for(const [k,v]of Object.entries(f.models))if(v)localStorage.setItem(model.keys[k],JSON.stringify(v));
    TradeScopeSbiMonthlySave.createService(localStorage).save({targetMonth:'2026-09',domesticImportBatchId:'batch_sbi',foreignAssetValue:'500',foreignUnrealizedPnl:'2',foreignDate:'2026-09-30',cashBalance:'80',cashDate:'2026-09-30',realizedPnL:'0',deposit:'0',withdrawal:'0'});
    const m=model.readModels(localStorage),b=m.importBatches.records[0],a=m.accountSnapshots.records[0],s=m.monthlyAccountStates.records[0];
    m.importBatches.records.push({...b,id:'batch_gmo_oct',targetMonth:'2026-10',snapshotAsOf:'2026-10-31'},
      {...m.importBatches.records[1],id:'batch_sbi_oct',targetMonth:'2026-10',snapshotAsOf:'2026-11-02'});
    m.accountSnapshots.records.push({...a,id:'as_gmo_oct',importBatchId:'batch_gmo_oct',targetMonth:'2026-10',snapshotAsOf:'2026-10-31'});
    m.monthlyAccountStates.records.push({...s,id:'mas_gmo_oct',adoptedAccountSnapshotId:'as_gmo_oct',targetMonth:'2026-10'});
    m.holdingSnapshots.records.push({...m.holdingSnapshots.records[0],id:'hs_sbi_oct',importBatchId:'batch_sbi_oct',targetMonth:'2026-10',snapshotAsOf:'2026-11-02',marketValue:'350',unrealizedPnl:'30'});
    model.validateModels(m);for(const [k,v]of Object.entries(m))if(v)localStorage.setItem(model.keys[k],JSON.stringify(v));
    baseline();render();
  };
  function confirm(zero){
    if(!sessionStorage.getItem(token))return show({refused:true});
    TradeScopeSbiMonthlySave.createService(localStorage).save({targetMonth:'2026-10',domesticImportBatchId:'batch_sbi_oct',foreignAssetValue:zero?'0':'600',foreignUnrealizedPnl:zero?'0':'3',foreignDate:'2026-10-31',cashBalance:zero?'0':'90',cashDate:'2026-10-31'});
    baseline();render();
  }
  document.getElementById('complete').onclick=()=>confirm(false);document.getElementById('zero').onclick=()=>confirm(true);
  document.getElementById('inspect').onclick=()=>{const old=JSON.parse(sessionStorage.getItem(token)||'null');show({storageUnchanged:old?.every(([k,v])=>localStorage.getItem(k)===v)??null});};
  document.getElementById('cleanup').onclick=async()=>{
    if(!sessionStorage.getItem(token))return show({refused:true});
    for(const k of keys)localStorage.removeItem(k);
    for(const k of ['tradeScopeTopSummarySnapshotV1','tradeScopeTopSplashSeen','tradeScopeSelectedYear','tradeScopeSelectedMonth','profitSelectedYear','profitSelectedMonth'])localStorage.removeItem(k);
    for(const r of await navigator.serviceWorker.getRegistrations())await r.unregister();
    for(const k of await caches.keys())if(k.startsWith('tradescope-static-'))await caches.delete(k);
    sessionStorage.removeItem(token);show({cleaned:true,canonicalAbsent:keys.every(k=>localStorage.getItem(k)===null)});
  };
  render();
})();
