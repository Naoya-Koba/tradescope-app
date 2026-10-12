(function(root){
  'use strict';
  const node=typeof module!=='undefined'&&module.exports;
  const storage=node?require('./data-model-storage.js'):root.TradeScopeDataStorage;
  const accountFields=Object.freeze(['cashBalance','assetValue']),holdingFields=Object.freeze(['quantity','marketPrice','marketValue']);
  const copy=v=>JSON.parse(JSON.stringify(v)),rows=(models,entity)=>models[entity]?.records||[];
  const same=(a,b)=>a===null||b===null?a===b:storage.equalDecimal(a,b);
  const empty=()=>({account:{},holdings:[]});
  function revision(input){return{adoptedAccountSnapshotId:input.adoptedAccountSnapshotId,observationOverrides:copy(input.observationOverrides),overrideUpdatedAt:input.overrideUpdatedAt};}
  function resolve(models,accountId,targetMonth){
    const input=rows(models,'monthlyAccountInputs').find(r=>[3,4].includes(r.schemaVersion)&&r.accountId===accountId&&r.targetMonth===targetMonth);
    if(!input)return null;
    const snapshot=rows(models,'accountSnapshots').find(s=>s.id===input.adoptedAccountSnapshotId);if(!snapshot)return null;
    const overrides=input.schemaVersion===4?input.observationOverrides:empty();
    const source=Object.fromEntries(accountFields.map(f=>[f,snapshot[f]??null]));
    const holdings=rows(models,'holdingSnapshots').filter(h=>h.accountSnapshotId===snapshot.id).map(h=>{
      const sourceValues=Object.fromEntries(holdingFields.map(f=>[f,h[f]??null]));
      const values=overrides.holdings.find(o=>o.holdingSnapshotId===h.id&&o.instrumentId===h.instrumentId)?.values||{};
      return{holdingSnapshotId:h.id,instrumentId:h.instrumentId,source:sourceValues,adopted:{...sourceValues,...values},overriddenFields:Object.keys(values)};
    });
    return{input:copy(input),snapshot:copy(snapshot),source,adopted:{...source,...overrides.account},holdings,
      overriddenFields:Object.keys(overrides.account),hasOverrides:!!(Object.keys(overrides.account).length||overrides.holdings.length),complete:false};
  }
  const api=Object.freeze({resolve,accountFields,holdingFields,same,empty,revision});
  if(node)module.exports=api;else root.TradeScopeObservationAdoption=api;
})(typeof globalThis!=='undefined'?globalThis:this);
