(function(root){
  'use strict';
  const node=typeof module!=='undefined'&&module.exports;
  const adoption=node?require('./transaction-adoption-view.js'):root.TradeScopeTransactionAdoptionView;
  const view=node?require('./transaction-view.js'):root.TradeScopeTransactionView;
  // Reuse only decimal arithmetic; never send v3 rows through reconciliation v1.
  const decimal=node?require('./transaction-reconciliation.js'):root.TradeScopeTransactionReconciliation;
  const display=node?require('./transaction-display.js'):root.TradeScopeTransactionDisplay;
  const providers=Object.freeze({acc_lightfx_fx:'lightfx',acc_minna_fx:'minna'});
  const providerFor=accountId=>Object.hasOwn(providers,accountId)?providers[accountId]:null;
  const actions=Object.freeze({new:'open',add:'open',partial_close:'close',full_close:'close'});
  const rows=(m,key)=>m?.[key]?.records||[];
  const id=value=>typeof value==='string'&&value.trim().length>0;
  const number=value=>(typeof value==='string'&&value.length<=128||typeof value==='number'&&Number.isFinite(value))?decimal.decimals(value):null;
  const positive=value=>value!==null&&!value.startsWith('-')&&/[1-9]/.test(value);
  const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)
    &&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
  const scope=provider=>provider+'-fx-trades';
  function account(accountId,models){
    const matches=rows(models,'accounts').filter(a=>a.id===accountId);
    return matches.length===1&&matches[0].enabled&&matches[0].accountType==='fx'&&matches[0].providerCode===providerFor(accountId);
  }
  function instrument(symbol,models){
    if(!id(symbol))return [];
    const pair=view.fxPair(symbol);
    return rows(models,'instruments').filter(i=>i.enabled&&i.assetType==='FX'
      &&([i.symbol,i.displayName,...(i.aliases||[])].includes(symbol)||pair&&view.fxPair(i.symbol)===pair));
  }
  const summary=(accountId,ins,action,side,quantity,price,tradeDate)=>({accountId,provider:providerFor(accountId),
    instrumentId:ins.id,action,side,quantity,quantityUnit:'baseCurrencyUnits',price,tradeDate});
  function manualFacts(record,models){
    if(!record||typeof record!=='object'||Array.isArray(record))return {reason:'INVALID_MANUAL_RECORD'};
    const accountId=view.accountId(record.account,models),provider=providerFor(accountId);
    if(accountId&&!provider)return {excluded:true};
    if(record.assetType&&record.assetType!=='FX')return {excluded:true};
    const context={accountId:accountId||null,provider:provider||null};
    const bad=reason=>({...context,reason});
    if(!provider)return bad('ACCOUNT_UNRESOLVED');
    if(!account(accountId,models)||record.sourceProvider!=null&&record.sourceProvider!==provider
      ||record.provider!=null&&record.provider!==provider)return bad('PROVIDER_CONFLICT');
    if(record.assetType!=='FX')return bad('ASSET_TYPE_UNCONFIRMED');
    if(!id(record.id))return bad('INVALID_MANUAL_ID');
    const matches=instrument(record.symbol,models);
    if(matches.length!==1)return bad(matches.length?'INSTRUMENT_AMBIGUOUS':'INSTRUMENT_UNRESOLVED');
    const ins=matches[0],action=Object.hasOwn(actions,record.category)?actions[record.category]:null;
    if(!action)return bad('CATEGORY_UNSUPPORTED');
    if(!['buy','sell'].includes(record.side))return bad('SIDE_UNKNOWN');
    if(!date(record.date))return bad('DATE_INVALID');
    if(record.quantityUnit!=null&&!['Lot','lot','lots'].includes(record.quantityUnit))return bad('QUANTITY_UNIT_UNKNOWN');
    const quantity=number(record.quantity),size=number(record.contractSize),price=number(record.rate);
    if(!positive(quantity))return bad('QUANTITY_INVALID');
    if(!positive(size))return bad('CONTRACT_SIZE_UNKNOWN');
    const expected=display.getFxLotSize({provider,accountId,instrument:ins});
    if(!expected)return bad('LOT_RULE_UNKNOWN');
    if(size!==String(expected))return bad('CONTRACT_SIZE_CONFLICT');
    if(!positive(price))return bad('PRICE_INVALID');
    return {...context,facts:summary(accountId,ins,action,record.side,display.multiply(quantity,size),price,record.date)};
  }
  function importedFacts(record,models){
    const accountId=record.accountId,provider=providerFor(accountId),bad=reason=>({accountId,provider:provider||null,reason});
    if(!provider||record.sourceProvider!==provider||!account(accountId,models))return bad('PROVIDER_CONFLICT');
    const matches=rows(models,'instruments').filter(i=>i.id===record.instrumentId&&i.enabled&&i.assetType==='FX');
    if(matches.length!==1)return bad('INSTRUMENT_UNRESOLVED');
    if(!display.getFxLotSize({provider,accountId,instrument:matches[0]}))return bad('LOT_RULE_UNKNOWN');
    return {accountId,provider,facts:summary(accountId,matches[0],record.action,record.side,number(record.quantity),number(record.price),record.tradeDate)};
  }
  const key=(facts,aggregate=false)=>JSON.stringify(Object.entries(facts).filter(([name])=>!aggregate||name!=='quantity'));
  function group(entries,aggregate=false){
    const groups=new Map();
    for(const entry of entries.filter(e=>e.matchingFields)){
      const k=key(entry.matchingFields,aggregate);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(entry);
    }
    return groups;
  }
  // Inputs are raw manual records plus repository models. No Storage, normalizer, writes,
  // saved relationships or History mutation. A candidate never confirms event identity.
  function project(manual,models,options={}){
    if(!Array.isArray(manual))throw new TypeError('MANUAL_ARRAY_REQUIRED');
    const adopted=adoption.readAll(models,options);
    const relevant=adopted.results.filter(r=>providerFor(r.target.accountId)||Object.values(providers).includes(r.target.sourceProvider));
    const sources=relevant.map(r=>({...r.target,sourceStatus:r.status,status:r.usable?'usable':'incomparable',
      reason:r.usable?null:'SOURCE_UNAVAILABLE',collectionId:r.collection?.id??null,confirmedEmpty:r.confirmedEmpty}));
    const manualIds=new Map();for(const r of manual)if(id(r?.id))manualIds.set(r.id,(manualIds.get(r.id)||0)+1);
    const manuals=[];
    for(const r of manual){
      const result=manualFacts(r,models);if(result.excluded)continue;
      const duplicate=id(r?.id)&&manualIds.get(r.id)>1;
      const unavailable=result.facts&&relevant.some(s=>s.target.accountId===result.accountId
        &&s.target.targetMonth===r.date.slice(0,7)&&(!s.usable||s.target.sourceProvider!==result.provider||s.target.sourceScope!==scope(result.provider)));
      const reason=result.reason||(duplicate?'MANUAL_ID_AMBIGUOUS':unavailable?'SOURCE_UNAVAILABLE':null);
      manuals.push({manualId:id(r?.id)?r.id:null,accountId:result.accountId??null,provider:result.provider??null,
        status:reason?'incomparable':'unmatched-manual',reason:reason||'NO_EXACT_CANDIDATE',
        matchingFields:reason?null:result.facts,importedIds:[]});
    }
    const imported=relevant.filter(r=>r.usable&&providerFor(r.target.accountId)===r.target.sourceProvider
      &&r.target.sourceScope===scope(r.target.sourceProvider)).flatMap(s=>s.transactions.map(r=>{
      const result=importedFacts(r,models);
      return {importedId:r.id,collectionId:s.collection.id,accountId:result.accountId,provider:result.provider,
        status:result.reason?'incomparable':'unmatched-imported',reason:result.reason||'NO_EXACT_CANDIDATE',
        matchingFields:result.facts||null,manualIds:[]};
    }));
    const mg=group(manuals),ig=group(imported);
    function link(ms,is,reason){
      const status=reason==='EXACT_AT_DATE_PRECISION'?'unique-candidate':'ambiguous';
      for(const m of ms)Object.assign(m,{status,reason,importedIds:is.map(i=>i.importedId).sort()});
      for(const i of is)Object.assign(i,{status,reason,manualIds:ms.map(m=>m.manualId).sort()});
    }
    for(const [k,ms]of mg){const is=ig.get(k);if(is)link(ms,is,ms.length===1&&is.length===1?'EXACT_AT_DATE_PRECISION':'MULTIPLE_EXACT_CANDIDATES');}
    // Only flag equal totals of whole, otherwise-unmatched same-fact groups. Never search
    // arbitrary subsets, average prices, select fills, or call an aggregate a unique match.
    const ma=group(manuals.filter(m=>m.status==='unmatched-manual'),true);
    const ia=group(imported.filter(i=>i.status==='unmatched-imported'),true);
    for(const [k,ms]of ma){const is=ia.get(k);if(!is||ms.length===1&&is.length===1)continue;
      if(decimal.sum(ms.map(m=>m.matchingFields.quantity))===decimal.sum(is.map(i=>i.matchingFields.quantity)))link(ms,is,'AGGREGATE_ONLY_REQUIRES_REVIEW');
    }
    return {version:'fx-transaction-candidates-v1',sourceFingerprint:adopted.fingerprint,sources,manual:manuals,imported};
  }
  const api=Object.freeze({version:'fx-transaction-candidates-v1',project});
  if(node)module.exports=api;else root.TradeScopeFxTransactionCandidateView=api;
})(typeof globalThis!=='undefined'?globalThis:this);
