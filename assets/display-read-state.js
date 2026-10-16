(function(root){
  'use strict';
  const node=typeof module!=='undefined'&&module.exports;
  const model=node?require('./data-model-storage.js'):root.TradeScopeDataStorage;
  const legacyKeys=['tradingData','yearInitialFunds','yearInitialUnrealized'];
  const watchedKeys=Object.freeze([...legacyKeys,...Object.values(model.keys),'tradeScopeTradeHistoryV1','tradeScopeSymbolListV1','tradeInfo']);
  const copy=v=>JSON.parse(JSON.stringify(v));
  const token=(year,month,key)=>year+'-'+String(month).padStart(2,'0')+':'+key;
  const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  function validShape(value,key){
    if(!plain(value)||!Object.values(value).every(plain))return false;
    return key!=='tradingData'||Object.values(value).every(year=>Object.values(year).every(plain));
  }
  function failed(state,key){return state?.states?['invalid-json','invalid-schema','read-failure'].includes(state.states[key]?.status):state?.failed===true;}
  function read(adapter){
    const result={failed:false,states:{}};
    for(const key of legacyKeys){
      let raw;
      try{raw=adapter.getItem(key);}catch(_){result[key]={};result.states[key]={status:'read-failure'};result.failed=true;continue;}
      let value;
      try{value=raw===null?{}:JSON.parse(raw);}catch(_){result[key]={};result.states[key]={status:'invalid-json'};result.failed=true;continue;}
      try{if(!validShape(value,key))throw Error('invalid');model.assertJson(value);result[key]=value;
        result.states[key]={status:raw===null?'missing':Object.keys(value).length?'ready':'empty'};
      }catch(_){result[key]={};result.states[key]={status:'invalid-schema'};result.failed=true;}
    }
    try{result.models=model.createRepository({getItem:k=>adapter.getItem(k)}).read();result.states.models={status:Object.values(result.models).some(Boolean)?'ready':'empty'};
    }catch(_){
      let status='invalid-schema';
      for(const key of Object.values(model.keys)){
        let raw;try{raw=adapter.getItem(key);}catch(_){status='read-failure';break;}
        try{if(raw!==null)JSON.parse(raw);}catch(_){status='invalid-json';break;}
      }
      result.models=null;result.states.models={status};result.failed=true;
    }
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
  const api=Object.freeze({read,failed,mergeDrafts,token,watchedKeys,affects:key=>key===null||watchedKeys.includes(key)});
  if(node)module.exports=api;else root.TradeScopeDisplayReadState=api;
})(typeof globalThis!=='undefined'?globalThis:this);
