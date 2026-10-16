(function(root){
  'use strict';
  const node=typeof module!=='undefined'&&module.exports;
  const csv=node?require('../import/csv-core.js'):root.TradeScopeCSV;
  const sources=node?require('./monthly-source-contract.js'):root.TradeScopeMonthlySourceContract;
  const version='cashflow-view-v1';
  const external=()=>({status:'not-derived',deposit:null,withdrawal:null});
  const month=value=>typeof value==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(value);
  function decimal(value){
    if(value===null||value===undefined||value==='')return null;
    if(typeof value!=='string'&&typeof value!=='number'||typeof value==='number'&&!Number.isFinite(value))return null;
    try{return csv.decimal(String(value));}catch(_){return null;}
  }
  const subtract=(a,b)=>a===null||b===null?null:csv.sum([a,b.startsWith('-')?b.slice(1):'-'+b]);
  const rowAt=(data,targetMonth)=>data?.[Number(targetMonth.slice(0,4))]?.[Number(targetMonth.slice(5))]?.smbc??{};
  function previousMonth(targetMonth){
    if(!month(targetMonth))throw Error('INVALID_CASHFLOW_MONTH');
    const year=Number(targetMonth.slice(0,4)),m=Number(targetMonth.slice(5));
    return m===1?String(year-1).padStart(4,'0')+'-12':targetMonth.slice(0,5)+String(m-1).padStart(2,'0');
  }
  // Only explicit observations qualify. Legacy ledger/carry/initial funds are NOT observations.
  function bankObservation(tradingData,models,targetMonth){
    if(!month(targetMonth))throw Error('INVALID_CASHFLOW_MONTH');
    const selected=sources.month(models,'acc_smbc_bank',targetMonth).filter(v=>v.metric==='cashBalance'&&v.currency==='JPY');
    if(selected.length){
      const source=selected[0],value=selected.length===1&&source.status==='adopted'?decimal(source.value):null;
      return {kind:value===null?'unavailable':'bank-balance-observation',value,targetMonth,
        explicit:true,status:value===null?'unavailable':'observed',source:source.source??null};
    }
    const row=rowAt(tradingData,targetMonth),value=decimal(row.monthEndBalance);
    return {kind:value===null?'unavailable':'bank-balance-observation',value,targetMonth,
      explicit:Object.hasOwn(row,'monthEndBalance'),status:value===null?'unavailable':'observed',
      source:value===null?null:{storageKey:'tradingData',accountKey:'smbc',targetMonth,field:'monthEndBalance'}};
  }
  function bank(tradingData,models,targetMonth){
    const observation=bankObservation(tradingData,models,targetMonth),previous=bankObservation(tradingData,models,previousMonth(targetMonth));
    const value=subtract(observation.value,previous.value);
    return {kind:'bank-balance-observation',accountKey:'smbc',accountId:'acc_smbc_bank',targetMonth,currency:'JPY',
      observation,balanceChange:{kind:'bank-balance-change',status:value===null?'unavailable':'derived',value,
        previousMonth:previous.targetMonth,previousBalance:previous.value},deposit:null,withdrawal:null,net:null,externalFlow:external()};
  }
  const accountKeys=keys=>keys.filter(key=>key!=='smbc');
  function account({accountKey,targetMonth,values={},resolved={},input=null,models=null,tradingData={}}){
    if(!month(targetMonth))throw Error('INVALID_CASHFLOW_MONTH');
    if(accountKey==='smbc')return bank(tradingData,models,targetMonth);
    function field(metric){
      const value=decimal(values[metric]);
      const adopted=(resolved.sourceAdoptions??[]).filter(v=>v.metric===metric&&v.currency==='JPY');
      const source=adopted.length===1?adopted[0].source:null;
      const reported=source?source.sourceType==='pdf':!!resolved.snapshot?.importBatchId
        ||resolved.state?.fieldSources?.[metric]==='imported-monthly-pdf'||input?.fieldSources?.[metric]==='imported-monthly-pdf';
      const hasOverride=adopted.length?!!adopted[0].override:(resolved.state??input)?.overrideFields?.includes(metric)===true;
      return {kind:value===null?'unavailable':reported&&!hasOverride?'reported-account-flow':'manual-account-flow',value,
        originKind:reported?'reported-account-flow':'manual-account-flow',hasOverride,
        source:source?.reference??(resolved.state?{entity:'monthlyAccountStates',id:resolved.state.id}:null)};
    }
    const deposit=field('deposit'),withdrawal=field('withdrawal');
    return {kind:'account-flow',accountKey,targetMonth,currency:'JPY',deposit:deposit.value,withdrawal:withdrawal.value,
      fields:{deposit,withdrawal},net:subtract(deposit.value,withdrawal.value),externalFlow:external()};
  }
  function totals(views){
    const rows=views.filter(v=>v.kind==='account-flow'),sum=field=>{const known=rows.map(r=>r[field]).filter(v=>v!==null);return known.length?csv.sum(known):null;};
    const deposit=sum('deposit'),withdrawal=sum('withdrawal');
    return {kind:'account-flow-total',deposit,withdrawal,net:subtract(deposit,withdrawal),
      partial:rows.some(r=>r.deposit===null||r.withdrawal===null),externalFlow:external()};
  }
  const api=Object.freeze({version,decimal,previousMonth,bankObservation,bank,accountKeys,account,totals});
  if(node)module.exports=api;else root.TradeScopeCashflowView=api;
})(typeof globalThis!=='undefined'?globalThis:this);
