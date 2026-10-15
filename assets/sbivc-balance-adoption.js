(function(root){
  'use strict';
  const node=typeof module!=='undefined'&&module.exports;
  const storage=node?require('./data-model-storage.js'):root.TradeScopeDataStorage;
  const native=node?require('./observation-adoption.js'):root.TradeScopeObservationAdoption;
  const common=node?require('./monthly-source-contract.js'):root.TradeScopeMonthlySourceContract;
  const decimal=node?require('../import/csv-core.js'):root.TradeScopeCSV;
  const accountId='acc_sbivc_crypto',scope='sbivc-monthly-assets',rows=(m,e)=>m?.[e]?.records||[];
  const blocked=v=>['stale','conflict','unresolved'].includes(v.status);
  const relevant=r=>r.accountId===accountId&&['holdings','cashBalance','marketValue'].includes(r.metric);
  function months(models,{year}={}){
    return [...new Set([...rows(models,'monthlyAccountInputs').filter(r=>r.accountId===accountId&&[3,4].includes(r.schemaVersion)),
      ...common.heads(rows(models,'monthlySources')).filter(relevant)].map(r=>r.targetMonth))]
      .filter(m=>year===undefined||m.startsWith(String(year).padStart(4,'0')+'-')).sort();
  }
  function resolve(models,targetMonth){
    storage.validateModels(models);
    const old=native.resolve(models,accountId,targetMonth);
    const decisions=common.heads(rows(models,'monthlySources')).filter(r=>relevant(r)&&r.targetMonth===targetMonth);
    if(decisions.some(r=>r.metric==='marketValue'))throw Error('SBIVC_BALANCE_ADOPTION_UNSUPPORTED');
    if(!old&&!decisions.length)return null;
    const choose=(component,metric)=>{
      const matches=decisions.filter(r=>r.metric===metric);
      if(matches.some(r=>r.component!==component||r.currency!=='JPY')||matches.length>1)throw Error('SBIVC_BALANCE_ADOPTION_CONFLICT');
      const chosen=matches.length?common.resolve(models,matches[0]):null;
      if(chosen?.source?.reference){
        const ref=chosen.source.reference;
        if(ref.sourceScope!==scope||(metric==='holdings'?ref.entity!=='importBatches'||ref.field!=='holdings'
          :ref.entity!=='accountSnapshots'||ref.field!=='cashBalance'))throw Error('SBIVC_BALANCE_REFERENCE_UNSUPPORTED');
      }
      return chosen;
    };
    const spot=choose('spot','holdings'),cash=choose('cash','cashBalance');
    const provenance=(choice,fallback)=>{
      if(!choice)return fallback;
      const ref=choice.source?.reference,batch=ref?.entity==='importBatches'?rows(models,'importBatches').find(b=>b.id===ref.id):null;
      const snapshot=ref?.entity==='accountSnapshots'?rows(models,'accountSnapshots').find(s=>s.id===ref.id)
        :batch?rows(models,'accountSnapshots').find(s=>s.importBatchId===batch.id&&s.sourceScope===scope):null;
      return {recordId:snapshot?.id??null,importBatchId:batch?.id??snapshot?.importBatchId??null,
        sourceScope:ref?.sourceScope??null,sourceType:choice.source?.sourceType??null,revisionId:choice.source?.id??null,
        adoptionId:choice.adoption?.id??null,snapshotAsOf:choice.source?.asOf??null,sourceMonth:targetMonth,status:choice.status};
    };
    const fallback=old?{recordId:old.snapshot.id,importBatchId:old.snapshot.importBatchId,sourceScope:scope,
      sourceType:'pdf',revisionId:null,adoptionId:null,snapshotAsOf:old.snapshot.snapshotAsOf,sourceMonth:targetMonth,status:'compatibility'}:null;
    const holdingSource=provenance(spot,fallback),cashSource=provenance(cash,fallback);
    let holdings=old?.holdings??[];
    if(spot){
      holdings=[];
      if(spot.status==='adopted'&&Array.isArray(spot.value)){
        const original=common.sourceValue(spot.source,models);
        holdings=spot.value.map(h=>{
          const instrument=rows(models,'instruments').find(i=>i.id===h.instrumentId);
          if(instrument?.assetType!=='Crypto')throw Error('SBIVC_BALANCE_INSTRUMENT_INVALID');
          const physical=rows(models,'holdingSnapshots').find(r=>r.importBatchId===holdingSource.importBatchId&&r.instrumentId===h.instrumentId&&r.sourceScope===scope);
          const source=original.find(r=>r.instrumentId===h.instrumentId),values=Object.fromEntries(native.holdingFields.map(f=>[f,h[f]]));
          return {instrumentId:h.instrumentId,holdingSnapshotId:physical?.id??null,source:Object.fromEntries(native.holdingFields.map(f=>[f,source[f]])),
            adopted:values,overriddenFields:native.holdingFields.filter(f=>!native.same(source[f],h[f]))};
        });
      }
    }
    const holdingSetKnown=spot?spot.status==='adopted':!!old;
    return {input:old?.input??null,snapshot:old?.snapshot??null,source:old?.source??{cashBalance:null,assetValue:null},
      adopted:{cashBalance:cash?cash.status==='adopted'?cash.value:null:old?.adopted.cashBalance??null,assetValue:old?.adopted.assetValue??null},holdings,
      holdingSource,cashSource,holdingSetKnown,emptyHoldingSet:holdingSetKnown&&holdings.every(h=>h.adopted.quantity!==null&&storage.equalDecimal(h.adopted.quantity,'0')),
      blocked:!!(spot&&blocked(spot)||cash&&blocked(cash)),spotStatus:spot?.status??(old?'compatibility':'missing'),cashStatus:cash?.status??(old?'compatibility':'missing'),
      hasOverrides:!!(spot?.override||cash?.override||!spot&&old?.holdings.some(h=>h.overriddenFields.length)||!cash&&old?.overriddenFields.includes('cashBalance')||old?.overriddenFields.includes('assetValue')),
      complete:false,targetMonth};
  }
  function latest(models,options={}){
    const history=months(models,options).map(m=>resolve(models,m));
    const last=history.at(-1);if(!last)return null;
    // Latest adopted collection and cash source can have different confirmation months.
    // An explicit missing/deferred/stale decision is still a source state, not absence.
    const spot=history.filter(v=>v.holdingSource||v.spotStatus!=='missing').at(-1),cash=history.filter(v=>v.cashSource||v.cashStatus!=='missing').at(-1);
    return {...last,holdings:spot?.holdings??[],holdingSource:spot?.holdingSource??null,holdingSetKnown:spot?.holdingSetKnown??false,
      emptyHoldingSet:spot?.emptyHoldingSet??false,spotStatus:spot?.spotStatus??'missing',cashSource:cash?.cashSource??null,
      cashStatus:cash?.cashStatus??'missing',adopted:{...last.adopted,cashBalance:cash?.adopted.cashBalance??null},
      blocked:!!(spot&&['stale','conflict','unresolved'].includes(spot.spotStatus)||cash&&['stale','conflict','unresolved'].includes(cash.cashStatus)),
      hasOverrides:!!(spot?.hasOverrides||cash?.hasOverrides)};
  }
  // Fixed-month observation only. No carry, ledger, income or statement-total inference.
  function fixedObservation(models,targetMonth){
    const value=resolve(models,targetMonth);if(!value)return null;
    const holdings=value.holdings.map(h=>h.adopted),known=value.holdingSetKnown&&holdings.every(h=>h.quantity!==null);
    const positive=holdings.filter(h=>h.quantity!==null&&!storage.equalDecimal(h.quantity,'0'));
    const spot=known&&positive.every(h=>h.marketValue!==null)?positive.length?decimal.sum(positive.map(h=>h.marketValue)):'0':null;
    const components=[{key:'spot',name:'現物保有',asset:spot,unrealized:null,id:value.holdingSource?.recordId??null,
      snapshotAsOf:value.holdingSource?.snapshotAsOf??null,empty:value.emptyHoldingSet},
      {key:'cash',name:'現金・預り金',asset:value.adopted.cashBalance,unrealized:null,id:value.cashSource?.recordId??null,
        snapshotAsOf:value.cashSource?.snapshotAsOf??null}];
    const amounts=components.map(c=>c.asset).filter(v=>v!==null);
    return {targetMonth,components,asset:amounts.length?decimal.sum(amounts):null,complete:components.every(c=>c.asset!==null),blocked:value.blocked};
  }
  const api=Object.freeze({resolve,latest,months,fixedObservation,accountId,scope});if(node)module.exports=api;else root.TradeScopeSBIVCBalanceAdoption=api;
})(typeof globalThis!=='undefined'?globalThis:this);
