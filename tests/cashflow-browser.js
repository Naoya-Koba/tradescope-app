(function(){
 'use strict';
 const result=document.getElementById('result'),show=value=>{result.textContent=JSON.stringify(value,null,2);};
 const allowed=['tradingData','yearInitialFunds','yearInitialUnrealized','tradeScopeTradeHistoryV1','tradeScopeMemos','tradeScopeSymbolListV1','tradeScopeTopSummarySnapshotV1','tradeScopeSelectedYear'];
 const local=()=>{if(!['127.0.0.1','localhost'].includes(location.hostname)||!location.port)throw Error('localhost only');};
 const owns=()=>{local();if(localStorage.getItem('yearInitialFunds')!==JSON.stringify({2026:{gmo:1000,lightfx:1000,minano:1000,sbi:1000,sbivc:1000,smbc:1000000}}))throw Error('not this anonymous fixture');};
 document.getElementById('prepare').onclick=()=>{try{local();if(localStorage.length)throw Error('fresh origin required');
  const keys=['gmo','lightfx','minano','sbi','sbivc','smbc'],data={2026:{}};
  for(let month=1;month<=3;month++){data[2026][month]={__saved:true};for(const key of keys)data[2026][month][key]={__saved:true,realizedPnL:0,swapPnL:0,unrealizedPnL:0,deposit:0,withdrawal:0};Object.assign(data[2026][month].smbc,{monthEndBalance:[1000000,1200000,1300000][month-1],deposit:[0,200000,100000][month-1]});}
  const seed={tradingData:data,yearInitialFunds:{2026:{gmo:1000,lightfx:1000,minano:1000,sbi:1000,sbivc:1000,smbc:1000000}},yearInitialUnrealized:{2026:{gmo:0,lightfx:0,minano:0,sbi:0,sbivc:0,smbc:0}},tradeScopeTradeHistoryV1:[],tradeScopeMemos:[],tradeScopeSymbolListV1:[]};
  for(const[key,value]of Object.entries(seed))localStorage.setItem(key,JSON.stringify(value));show({prepared:true,expectedBalances:[1000000,1200000,1300000]});
 }catch(e){show({error:e.message});}};
 document.getElementById('inspect').onclick=()=>{try{owns();const data=JSON.parse(localStorage.getItem('tradingData'));show([1,2,3].map(month=>{const view=window.TradeScopeCashflowView.bank(data,null,`2026-0${month}`);return {month,balance:view.observation.value,change:view.balanceChange.value,oldStoredDeposit:data[2026][month].smbc.deposit};}));}catch(e){show({error:e.message});}};
 document.getElementById('cleanup').onclick=async()=>{try{owns();const keys=Object.keys(localStorage);if(keys.some(k=>!allowed.includes(k)))throw Error('unexpected key; cleanup stopped');for(const key of keys)localStorage.removeItem(key);for(const r of await navigator.serviceWorker.getRegistrations())await r.unregister();for(const name of await caches.keys())if(name.startsWith('tradescope-static-'))await caches.delete(name);show({cleaned:true,remainingKeys:localStorage.length});}catch(e){show({error:e.message});}};
})();
