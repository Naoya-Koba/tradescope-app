(function(){
  'use strict';
  if(location.protocol!=='http:'||!['localhost','127.0.0.1'].includes(location.hostname)||!location.port)return;
  const model=TradeScopeDataStorage,keys=[...TradeScopeStorageTransaction.primaryKeys],token='anonymousProgressBaseline';
  const show=v=>document.getElementById('result').textContent=JSON.stringify(v,null,2);
  const original=()=>keys.map(k=>[k,localStorage.getItem(k)]);
  const unchanged=()=>JSON.stringify(original())===sessionStorage.getItem(token);
  function render(targetMonth){
    if(!sessionStorage.getItem(token))return show({refused:'prepare fresh anonymous origin first'});
    const f=AnonymousMonthlyDisplay.fixture(),models=model.readModels(localStorage),data=JSON.parse(localStorage.getItem('tradingData'));
    const d=TradeScopeMonthlyDisplay.create(TradeScopeProfitMetrics,data,f.initialFunds,{},models,f.accounts),[year,month]=targetMonth.split('-').map(Number);
    const currentBalances=Object.fromEntries(f.accounts.map(a=>{const h=d.balanceHistory(year,a,month);return [a.key,TradeScopeBalanceView.resolve(h.observations,{targetMonth,componentKeys:h.componentKeys})];}));
    const p=TradeScopeMonthlyProgress.create({models,tradingData:data}).month(targetMonth,{scope:'current-balance',currentBalances});
    const body=document.getElementById('rows');body.replaceChildren();
    for(const a of p.accounts){const tr=document.createElement('tr');for(const text of [a.accountKey,String(a.balanceRequirementsSatisfied),a.periodStatus,a.carriedComponents.map(c=>c.key+':'+c.sourceMonth).join(', ')||'—']){const td=document.createElement('td');td.textContent=text;tr.appendChild(td);}body.appendChild(tr);}
    const period=TradeScopeMonthlyResolver.resolve(models,data,targetMonth,'sbi');
    show({anonymousOnly:true,targetMonth,accountCount:p.accounts.length,storageUnchanged:unchanged(),approvalAlwaysNotRecorded:p.accounts.every(a=>a.approvalStatus==='not-recorded'),
      derivedPeriod:period.periodInput?.derived??false,periodSatisfied:period.completeness?.complete===true,sbiStatePresent:models.monthlyAccountStates?.records.some(s=>s.accountId==='acc_sbi_sec'&&s.targetMonth===targetMonth)===true,
      sbi:p.accounts.find(a=>a.accountKey==='sbi'),smbc:p.accounts.find(a=>a.accountKey==='smbc')});
  }
  function prepare(bridge=false){
    if(localStorage.length)return show({refused:'fresh origin required'});
    const f=AnonymousMonthlyDisplay.fixture();f.tradingData[2026][9]={smbc:{monthEndBalance:0,__saved:true}};
    localStorage.setItem('tradingData',JSON.stringify(f.tradingData));localStorage.setItem('yearInitialFunds',JSON.stringify(f.initialFunds));localStorage.setItem('yearInitialUnrealized','{}');
    for(const [key,value]of Object.entries(f.models))if(value)localStorage.setItem(model.keys[key],JSON.stringify(value));
    TradeScopeSbiMonthlySave.createService(localStorage).save({targetMonth:'2026-09',domesticImportBatchId:'batch_sbi',realizedPnL:'0',deposit:'0',withdrawal:'0',
      ...(bridge?{}:{foreignAssetValue:'50',foreignUnrealizedPnl:'-2',foreignDate:'2026-09-30',cashBalance:'0',cashDate:'2026-09-30'})});
    if(bridge){
      const service=TradeScopeMonthlySourceService.createService(localStorage),models=service.inspect().models,core=TradeScopeMonthlySourceContract;
      const sources=core.candidates(models,{accountId:'acc_sbi_sec',targetMonth:'2026-09'}).filter(s=>s.component==='domestic'&&['marketValue','unrealizedPnl'].includes(s.metric));
      for(const [component,metric,value]of [['foreign','marketValue','50'],['foreign','unrealizedPnl','-2'],['cash','cashBalance','0']])sources.push(core.descriptor({accountId:'acc_sbi_sec',targetMonth:'2026-09',component,asOf:'2026-09-30'},metric,value,{id:'anonymous_'+metric+'_'+component,sourceId:'anonymous_'+metric+'_'+component,sourceType:'manual'}));
      service.operate({sources:sources.filter(s=>!s.registered),adoptions:sources.map(s=>({revisionId:s.id}))},{expectedFingerprint:service.inspect().fingerprint});
    }
    sessionStorage.setItem(token,JSON.stringify(original()));render('2026-09');
  }
  document.getElementById('prepare').onclick=()=>prepare();document.getElementById('bridge').onclick=()=>prepare(true);
  document.getElementById('light').onclick=async()=>{
    if(localStorage.length)return show({refused:'fresh origin required'});
    prepare();
    const names=['cashBalance','requiredMargin','orderRequiredMargin','reportedAccountEvaluationPnl','netAssetValue','transferableAmount','maintenanceRate','unsettledAmount','unrealizedPnl','monthEndUnsettledSwap','realizedPnl','reportedSettledSwapPnl','deposit','withdrawal','fee','other'];
    const values=Object.fromEntries(names.map(k=>[k,['cashBalance','netAssetValue','transferableAmount'].includes(k)?'1000':'0']));
    await TradeScopeTradersSave.createService(localStorage,'lightfx').save({preview:{broker:'lightfx',importerVersion:TradeScopeTradersParser.version,targetMonth:'2026-09',snapshotAsOf:'2026-09-30',observationType:'officialMonthEnd',valuationCurrency:'JPY',values,positions:[],errors:[],warnings:[],valid:true},fileHash:'c'.repeat(64),fileSize:100,calendarSwap:'0'});
    const api=TradeScopeMonthlySourceService.createService(localStorage),core=TradeScopeMonthlySourceContract;
    const sources=['2000','1000'].map((value,i)=>core.descriptor({accountId:'acc_lightfx_fx',targetMonth:'2026-09',component:'account',asOf:'2026-09-30'},'marketValue',value,{id:'anonymous_light_'+i,sourceId:'anonymous_light_'+i,sourceType:'manual'}));
    api.operate({sources,adoptions:[{revisionId:sources[0].id}]},{expectedFingerprint:api.inspect().fingerprint});
    sessionStorage.setItem(token,JSON.stringify(original()));show({anonymousOnly:true,lightPrepared:true,storageUnchanged:unchanged()});
  };
  document.getElementById('baseline').onclick=()=>{if(!sessionStorage.getItem(token))return show({refused:true});sessionStorage.setItem(token,JSON.stringify(original()));show({anonymousOnly:true,baselineCaptured:true});};
  document.getElementById('september').onclick=()=>render('2026-09');document.getElementById('october').onclick=()=>render('2026-10');
  document.getElementById('inspect').onclick=()=>show({storageUnchanged:!!sessionStorage.getItem(token)&&unchanged()});
  document.getElementById('cleanup').onclick=async()=>{
    if(!sessionStorage.getItem(token))return show({refused:true});
    for(const k of keys)localStorage.removeItem(k);
    for(const k of ['tradeScopeTopSummarySnapshotV1','tradeScopeTopSplashSeen','tradeScopeSelectedYear','tradeScopeSelectedMonth','profitSelectedYear','profitSelectedMonth'])localStorage.removeItem(k);
    for(const r of await navigator.serviceWorker.getRegistrations())await r.unregister();
    for(const k of await caches.keys())if(k.startsWith('tradescope-static-'))await caches.delete(k);
    sessionStorage.removeItem(token);show({cleaned:true,financialKeysAbsent:keys.every(k=>localStorage.getItem(k)===null)});
  };
})();
