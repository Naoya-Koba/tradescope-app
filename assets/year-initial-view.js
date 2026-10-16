(function(root){
  'use strict';
  const node=typeof module!=='undefined'&&module.exports;
  const csv=node?require('../import/csv-core.js'):root.TradeScopeCSV;
  const balance=node?require('./balance-view.js'):null;
  const version='year-initial-v1';
  function decimal(value){
    if(value===null||value===undefined||typeof value==='string'&&!value.trim())return null;
    if(typeof value!=='string'&&typeof value!=='number'||typeof value==='number'&&!Number.isFinite(value))return null;
    try{return typeof value==='number'?(balance||root.TradeScopeBalanceView).decimal(value):csv.decimal(value);}catch(_){return null;}
  }
  function field(values,year,key,{failed=false,applicable=true}={}){
    const stored=Object.hasOwn(values?.[year]??{},key),raw=values?.[year]?.[key],value=decimal(raw);
    const status=!applicable?'not-applicable':failed?'read-failure':!stored?'missing':raw===null?'null':value===null?'invalid':'known';
    return {value:status==='known'?Number(value):null,decimal:status==='known'?value:null,status,stored,applicable};
  }
  function total(fields){
    const applicable=fields.filter(f=>f.applicable),known=applicable.filter(f=>f.status==='known');
    const complete=applicable.length>0&&known.length===applicable.length;
    const subtotal=known.length?csv.sum(known.map(f=>f.decimal)):null;
    return {value:complete?Number(subtotal):null,knownSubtotal:subtotal===null?null:Number(subtotal),complete,
      missing:applicable.filter(f=>f.status!=='known'),status:complete?'complete':known.length?'partial':applicable.length?'unavailable':'not-applicable'};
  }
  function failed(state,key){return state?.states?['invalid-json','invalid-schema','read-failure'].includes(state.states[key]?.status):state?.failed===true;}
  function create(funds,unrealized,year,accounts,{readState}={}){
    const rows=accounts.map(account=>{
      const key=typeof account==='string'?account:account.key,bank=key==='smbc'||account.bankOnly===true;
      const f=field(funds,year,key,{failed:failed(readState,'yearInitialFunds')}),u=field(unrealized,year,key,{failed:failed(readState,'yearInitialUnrealized'),applicable:!bank});
      const parts=bank?[f]:[f,u],n=total(parts);
      return {key,funds:f,unrealized:u,net:{...n,decimal:n.complete?csv.sum(parts.map(p=>p.decimal)):null,applicable:true,status:n.complete?'known':'unavailable'}};
    });
    return {version,year,accounts:rows,funds:total(rows.map(r=>r.funds)),unrealized:total(rows.map(r=>r.unrealized)),net:total(rows.map(r=>r.net))};
  }
  const api=Object.freeze({version,decimal,field,total,failed,create});if(node)module.exports=api;else root.TradeScopeYearInitial=api;
})(typeof globalThis!=='undefined'?globalThis:this);
