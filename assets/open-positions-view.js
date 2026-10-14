(function(root){
  'use strict';
  const node=typeof module!=='undefined'&&module.exports;
  const storage=node?require('./data-model-storage.js'):root.TradeScopeDataStorage;
  const adoption=node?require('./sbivc-balance-adoption.js'):root.TradeScopeSBIVCBalanceAdoption;
  const accountId='acc_sbivc_crypto',rows=(m,e)=>m[e]?.records||[];
  const identity=v=>String(v||'').trim().toUpperCase().replace(/\s+/g,'');
  const account=storage.initialAccounts().find(a=>a.id===accountId);
  const aliases=new Set([account.id,account.providerCode,account.displayName,...account.legacyRefs].map(identity));
  function legacyEntries(entries){return(entries||[]).filter(e=>!aliases.has(identity(e.account)));}
  // Display decimal strings without Number conversion, rounding or mutation.
  function decimalLabel(value){
    if(typeof value!=='string'||!/^\d+(?:\.\d+)?$/.test(value))return '—';
    const [whole,fraction='']=value.split('.'),tail=fraction.replace(/0+$/,'');
    return whole.replace(/\B(?=(\d{3})+(?!\d))/g,',')+(tail?'.'+tail:'');
  }
  // Shared current-observation selection; an adopted source with no positive rows
  // is distinct from no source. Cash is not a position and resolve() stays compatible.
  function latestObservation(models,{year}={}){
    storage.validateModels(models);
    if(year!==undefined&&(!Number.isInteger(year)||year<1||year>9999))throw new Error('INVALID_OBSERVATION_YEAR');
    const month=adoption.months(models,{year}).at(-1);
    if(!month)return {hasSource:false,targetMonth:null,snapshotAsOf:null,cashBalance:null,holdings:[]};
    const view=adoption.latest(models,{year});
    if(!view)throw new Error('OPEN_POSITIONS_SOURCE_UNAVAILABLE');
    const holdings=view.holdings.filter(h=>h.adopted.quantity!==null&&!storage.equalDecimal(h.adopted.quantity,'0')).map(h=>{
      const instrument=rows(models,'instruments').find(i=>i.id===h.instrumentId);
      return{holdingType:'spot-observation',account:accountId,symbol:instrument.symbol,assetType:'暗号資産',
        quantity:h.adopted.quantity,marketPrice:h.adopted.marketPrice,marketValue:h.adopted.marketValue,
        acquisitionPrice:null,unrealizedPnl:null,realizedPnl:null,targetMonth:view.holdingSource?.sourceMonth??month,snapshotAsOf:view.holdingSource?.snapshotAsOf??null,
        importBatchId:view.holdingSource?.importBatchId??null,accountSnapshotId:view.holdingSource?.recordId??null,holdingSnapshotId:h.holdingSnapshotId,
        instrumentId:h.instrumentId,hasOverrides:h.overriddenFields.length>0};
    });
    return {hasSource:true,targetMonth:month,snapshotAsOf:view.holdingSource?.snapshotAsOf??view.cashSource?.snapshotAsOf??null,
      cashBalance:view.adopted.cashBalance,accountSnapshotId:view.holdingSource?.recordId??view.cashSource?.recordId??null,
      importBatchId:view.holdingSource?.importBatchId??null,hasOverrides:view.hasOverrides,
      holdingSource:view.holdingSource,cashSource:view.cashSource,blocked:view.blocked,holdingSetKnown:view.holdingSetKnown,
      emptyHoldingSet:view.emptyHoldingSet,hasUnknownQuantity:!view.holdingSetKnown||view.holdings.some(h=>h.adopted.quantity===null),holdings};
  }
  function resolve(models){return latestObservation(models).holdings;}
  const api=Object.freeze({resolve,latestObservation,legacyEntries,decimalLabel});
  if(node)module.exports=api;else root.TradeScopeOpenPositionsView=api;
})(typeof globalThis!=='undefined'?globalThis:this);
