(function () {
  'use strict';
  if (location.protocol !== 'http:' || !['localhost','127.0.0.1'].includes(location.hostname) || !location.port) return;
  const model=TradeScopeDataStorage;
  const keys=['tradingData','yearInitialFunds','yearInitialUnrealized','tradeScopeTopSummarySnapshotV1',...Object.values(model.keys)];
  const show=value=>{document.getElementById('result').textContent=JSON.stringify(value,null,2);};
  const sessionKey='anonymousDisplayTestBaseline';
  document.getElementById('prepare').onclick=()=>{
    if(keys.some(key=>localStorage.getItem(key)!==null))return show({refused:'fresh origin required'});
    const f=AnonymousMonthlyDisplay.fixture();
    const values={tradingData:JSON.stringify(f.tradingData),yearInitialFunds:JSON.stringify(f.initialFunds),yearInitialUnrealized:'{}'};
    for(const [entity,envelope] of Object.entries(f.models))if(envelope)values[model.keys[entity]]=JSON.stringify(envelope);
    for(const [key,value] of Object.entries(values))localStorage.setItem(key,value);
    sessionStorage.setItem(sessionKey,JSON.stringify(keys.map(key=>[key,localStorage.getItem(key)])));
    show({prepared:true,anonymousOnly:true});
  };
  document.getElementById('inspect').onclick=()=>{
    const baseline=JSON.parse(sessionStorage.getItem(sessionKey)||'null');
    show({unchanged:baseline?.every(([key,value])=>localStorage.getItem(key)===value)??null,
      sbiStateAbsent:!model.createRepository({getItem:key=>localStorage.getItem(key)}).read().monthlyAccountStates?.records.some(r=>r.accountId==='acc_sbi_sec'),
      septemberLegacyAbsent:JSON.parse(localStorage.getItem('tradingData')||'{}')[2026]?.[9]===undefined});
  };
  document.getElementById('override-inspect').onclick=()=>{
    const baseline=JSON.parse(sessionStorage.getItem(sessionKey)||'null');
    if(!baseline)return show({refused:true});
    const models=model.createRepository({getItem:key=>localStorage.getItem(key)}).read();
    const state=models.monthlyAccountStates.records.find(r=>r.accountId==='acc_gmo_fx');
    const oldModels=JSON.parse(baseline.find(([key])=>key===model.keys.monthlyAccountStates)[1]);
    const oldState=oldModels.records.find(r=>r.accountId==='acc_gmo_fx');
    const oldSnapshot=JSON.parse(baseline.find(([key])=>key===model.keys.accountSnapshots)[1]).records.find(r=>r.id===state.adoptedAccountSnapshotId);
    show({legacyUnchanged:baseline.filter(([key])=>['tradingData','yearInitialFunds','yearInitialUnrealized'].includes(key)).every(([key,value])=>localStorage.getItem(key)===value),
      snapshotsUnchanged:baseline.filter(([key])=>[model.keys.accountSnapshots,model.keys.holdingSnapshots,model.keys.importBatches,model.keys.instruments,model.keys.accounts].includes(key)).every(([key,value])=>localStorage.getItem(key)===value),
      sourceProtected:state.schemaVersion===3&&Object.entries(state.sourceValues).every(([key,value])=>value===(key==='unrealizedPnl'?oldSnapshot.unrealizedPnl:oldState[key])),
      stateVersion:state.schemaVersion,changedFields:state.overrideFields??[],
      sbiStateAbsent:!models.monthlyAccountStates.records.some(r=>r.accountId==='acc_sbi_sec'),
      septemberLegacyAbsent:JSON.parse(localStorage.getItem('tradingData')||'{}')[2026]?.[9]===undefined,
      journalAbsent:localStorage.getItem('tradeScopeRestoreJournalV1')===null});
  };
  document.getElementById('pwa-inspect').onclick=async()=>{
    const names=(await caches.keys()).filter(name=>name.startsWith('tradescope-static-'));
    const requests=names.length===1?await(await caches.open(names[0])).keys():[];
    const paths=requests.map(r=>new URL(r.url).pathname);
    show({cacheNames:names,controller:Boolean(navigator.serviceWorker.controller),
      duplicatePaths:paths.filter((path,index)=>paths.indexOf(path)!==index),
      accountSaveAssets:['gmo-monthly-ui.js','gmo-monthly-save.js','legacy-monthly-save.js'].every(file=>requests.some(r=>r.url.includes('/assets/'+file+'?')))});
  };
  document.getElementById('account-inspect').onclick=()=>{
    // Expected edits are independent invented amounts entered only by this anonymous smoke test.
    const old=AnonymousMonthlyDisplay.fixture().tradingData;
    const actual=JSON.parse(localStorage.getItem('tradingData')||'{}');
    const saved=actual[2026]?.[8]?.lightfx;
    const others=JSON.parse(JSON.stringify(actual));
    if(others[2026]?.[8])others[2026][8].lightfx=old[2026][8].lightfx;
    show({targetSaved:saved?.realizedPnL===2&&saved?.__saved===true,
      otherAccountsAndMonthsUnchanged:JSON.stringify(others)===JSON.stringify(old),
      otherDraftNotSaved:actual[2026]?.[8]?.minano?.realizedPnL===1,
      oldMonthFlagPreserved:actual[2026]?.[8]?.__saved===true,
      septemberLegacyAbsent:actual[2026]?.[9]===undefined});
  };
  document.getElementById('cleanup').onclick=()=>{
    // A browser dialog can require replacing the test tab; verify our unique anonymous records first.
    let anonymousFixture=false;
    try{
      const models=model.createRepository({getItem:key=>localStorage.getItem(key)}).read();
      anonymousFixture=models.monthlyAccountStates?.records.some(r=>r.id==='mas_gmo')
        &&models.holdingSnapshots?.records.some(r=>r.id==='hs_sbi')
        &&models.instruments?.records.every(r=>r.id==='ins_anonymous');
    }catch(_){}
    if(!sessionStorage.getItem(sessionKey)&&!anonymousFixture)return show({refused:true});
    for(const key of keys)localStorage.removeItem(key);
    // Only this fresh anonymous test origin is touched.
    for(const key of ['profitSkipDemoSeed','tradeScopeSelectedYear','tradeScopeSelectedMonth','profitSelectedYear','profitSelectedMonth','tradeScopeRestoreJournalV1'])localStorage.removeItem(key);
    sessionStorage.removeItem(sessionKey);show({cleaned:true,canonicalAbsent:keys.every(key=>localStorage.getItem(key)===null)});
  };
  document.getElementById('cache-cleanup').onclick=async()=>{
    for(const registration of await navigator.serviceWorker.getRegistrations())await registration.unregister();
    for(const name of await caches.keys())if(name.startsWith('tradescope-static-'))await caches.delete(name);
    show({testCacheCleaned:true});
  };
})();
