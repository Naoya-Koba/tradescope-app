(function(root){
  'use strict';
  const node=typeof module!=='undefined'&&module.exports;
  const model=node?require('./data-model-storage.js'):root.TradeScopeDataStorage;
  const legacyKeys=['tradingData','yearInitialFunds','yearInitialUnrealized'];
  const watchedKeys=Object.freeze([...legacyKeys,...Object.values(model.keys),'tradeScopeTradeHistoryV1','tradeScopeSymbolListV1','tradeInfo']);
  const copy=v=>JSON.parse(JSON.stringify(v));
  const token=(year,month,key)=>year+'-'+String(month).padStart(2,'0')+':'+key;
  function read(adapter){
    const result={failed:false};
    for(const key of legacyKeys){
      try{const raw=adapter.getItem(key),v=raw===null?{}:JSON.parse(raw);
        if(!v||typeof v!=='object'||Array.isArray(v))throw Error('invalid');model.assertJson(v);result[key]=v;
      }catch(_){result[key]={};result.failed=true;}
    }
    try{result.models=model.createRepository({getItem:k=>adapter.getItem(k)}).read();}catch(_){result.models=null;result.failed=true;}
    return result;
  }
  function mergeDrafts(previous,fresh,dirty){
    const merged=copy(fresh);
    for(const [year,months]of Object.entries(previous))for(const [month,rows]of Object.entries(months)){
      if(!rows||typeof rows!=='object')continue;
      for(const [key,row]of Object.entries(rows))if(dirty.has(token(year,month,key))){merged[year]??={};merged[year][month]??={};merged[year][month][key]=copy(row);}
    }
    return merged;
  }
  const api=Object.freeze({read,mergeDrafts,token,watchedKeys,affects:key=>key===null||watchedKeys.includes(key)});
  if(node)module.exports=api;else root.TradeScopeDisplayReadState=api;
})(typeof globalThis!=='undefined'?globalThis:this);
