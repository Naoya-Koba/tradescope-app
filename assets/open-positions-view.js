(function(root){
  'use strict';
  const node=typeof module!=='undefined'&&module.exports;
  const storage=node?require('./data-model-storage.js'):root.TradeScopeDataStorage;
  const adoption=node?require('./observation-adoption.js'):root.TradeScopeObservationAdoption;
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
  function resolve(models){
    storage.validateModels(models);
    const inputs=rows(models,'monthlyAccountInputs').filter(i=>i.accountId===accountId&&[3,4].includes(i.schemaVersion));
    const month=inputs.map(i=>i.targetMonth).sort().at(-1);
    if(!month)return [];
    const view=adoption.resolve(models,accountId,month);
    if(!view)throw new Error('OPEN_POSITIONS_SOURCE_UNAVAILABLE');
    return view.holdings.filter(h=>h.adopted.quantity!==null&&!storage.equalDecimal(h.adopted.quantity,'0')).map(h=>{
      const instrument=rows(models,'instruments').find(i=>i.id===h.instrumentId);
      return{holdingType:'spot-observation',account:accountId,symbol:instrument.symbol,assetType:'暗号資産',
        quantity:h.adopted.quantity,marketPrice:h.adopted.marketPrice,marketValue:h.adopted.marketValue,
        acquisitionPrice:null,unrealizedPnl:null,realizedPnl:null,targetMonth:month,snapshotAsOf:view.snapshot.snapshotAsOf,
        importBatchId:view.snapshot.importBatchId,accountSnapshotId:view.snapshot.id,holdingSnapshotId:h.holdingSnapshotId,
        instrumentId:h.instrumentId,hasOverrides:h.overriddenFields.length>0};
    });
  }
  const api=Object.freeze({resolve,legacyEntries,decimalLabel});
  if(node)module.exports=api;else root.TradeScopeOpenPositionsView=api;
})(typeof globalThis!=='undefined'?globalThis:this);
