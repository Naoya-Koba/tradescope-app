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
  document.getElementById('cleanup').onclick=()=>{
    if(!sessionStorage.getItem(sessionKey))return show({refused:true});
    for(const key of keys)localStorage.removeItem(key);
    // Only this fresh anonymous test origin is touched.
    for(const key of ['profitSkipDemoSeed','tradeScopeSelectedYear','tradeScopeSelectedMonth','profitSelectedYear','profitSelectedMonth'])localStorage.removeItem(key);
    sessionStorage.removeItem(sessionKey);show({cleaned:true,canonicalAbsent:keys.every(key=>localStorage.getItem(key)===null)});
  };
  document.getElementById('cache-cleanup').onclick=async()=>{
    for(const registration of await navigator.serviceWorker.getRegistrations())await registration.unregister();
    for(const name of await caches.keys())if(name.startsWith('tradescope-static-'))await caches.delete(name);
    show({testCacheCleaned:true});
  };
})();
