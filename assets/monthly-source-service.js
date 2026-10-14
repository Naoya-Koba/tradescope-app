(function(root){
  'use strict';
  const node=typeof module!=='undefined'&&module.exports;
  const storage=node?require('./data-model-storage.js'):root.TradeScopeDataStorage;
  const contract=node?require('./monthly-source-contract.js'):root.TradeScopeMonthlySourceContract;
  const copy=v=>JSON.parse(JSON.stringify(v));
  const legacyKeys=['tradingData','yearInitialFunds','yearInitialUnrealized'];
  // Pure plan: brokers can combine canonical records and source records in ONE journal.
  function buildChanges(base,operation,{at,newId=()=> 'ms_'+globalThis.crypto.randomUUID()}={}){
      const models=copy(base),all=[...(models.monthlySources?.records||[])],added=[];
      const append=r=>{contract.validateRecord(r);if(all.some(old=>old.id===r.id))throw Error('DUPLICATE_MONTHLY_SOURCE_ID');all.push(r);added.push(r);models.monthlySources=contract.envelope(all,at);return r;};
      for(const descriptor of operation.sources||[]){
        const r={schemaVersion:1,id:descriptor.id??newId(),kind:'source',...contract.target(descriptor),sourceId:descriptor.sourceId,
          sourceType:descriptor.sourceType,revisionOf:descriptor.revisionOf??null,createdAt:descriptor.createdAt===undefined?at:descriptor.createdAt,
          confirmedAt:descriptor.confirmedAt===undefined?at:descriptor.confirmedAt,value:descriptor.reference?null:descriptor.value,
          reference:descriptor.reference??null,fingerprint:'0'.repeat(64)};
        if(r.sourceType==='manual'&&!r.reference&&typeof r.value==='string'&&!r.value.trim())r.value=null;
        r.fingerprint=contract.sourceFingerprint(r,models);append(r);
      }
      for(const descriptor of operation.overrides||[]){
        const source=all.find(r=>r.kind==='source'&&r.id===descriptor.revisionId);if(!source||contract.sourceFingerprint(source,models)!==source.fingerprint)throw Error('STALE_MONTHLY_SOURCE');
        const current=all.filter(r=>r.kind==='override'&&r.revisionId===source.id),used=new Set(current.map(r=>r.previousId)),last=current.find(r=>!used.has(r.id));
        append({schemaVersion:1,id:descriptor.id??newId(),kind:'override',revisionId:source.id,revisionFingerprint:source.fingerprint,previousId:last?.id??null,
          value:typeof descriptor.value==='string'&&!descriptor.value.trim()?null:descriptor.value,confirmedAt:at});
      }
      for(const descriptor of operation.adoptions||[]){
        const source=all.find(r=>r.kind==='source'&&r.id===descriptor.revisionId),target=descriptor.decision==='defer'?contract.target(descriptor):source&&contract.target(source);
        if(!target)throw Error('MISSING_MONTHLY_SOURCE');
        if(source&&contract.sourceFingerprint(source,models)!==source.fingerprint)throw Error('STALE_MONTHLY_SOURCE');
        const last=contract.heads(all).find(r=>contract.targetKey(r)===contract.targetKey(target));
        append({schemaVersion:1,id:descriptor.id??newId(),kind:'adoption',...target,decision:descriptor.decision??'adopt',revisionId:source?.id??null,
          revisionFingerprint:source?.fingerprint??null,overrideId:descriptor.overrideId??null,previousId:last?.id??null,confirmedAt:at});
      }
      for(const descriptor of operation.comparisons||[]){
        const a=all.find(r=>r.kind==='source'&&r.id===descriptor.leftId),b=all.find(r=>r.kind==='source'&&r.id===descriptor.rightId);
        if(!a||!b||[a,b].some(r=>contract.sourceFingerprint(r,models)!==r.fingerprint))throw Error('STALE_MONTHLY_SOURCE');
        append({schemaVersion:1,id:descriptor.id??newId(),kind:'comparison',leftId:a.id,rightId:b.id,leftFingerprint:a.fingerprint,rightFingerprint:b.fingerprint,
          result:contract.comparison(a,b,models),confirmedAt:at});
      }
      if(!added.length)throw Error('EMPTY_MONTHLY_SOURCE_OPERATION');
      const changes={monthlySources:models.monthlySources};
      for(const accountId of new Set(added.filter(r=>r.kind==='source').map(r=>r.accountId))){
        if(!models.accounts?.records.some(r=>r.id===accountId)){
          const known=storage.initialAccounts().find(r=>r.id===accountId);if(!known)throw Error('MISSING_SOURCE_ACCOUNT');
          models.accounts={schemaVersion:1,records:[...(models.accounts?.records||[]),known],updatedAt:at};changes.accounts=models.accounts;
        }
      }
      contract.validateSet(models);
      return {changes,added:copy(added),models};
  }
  function createService(adapter,{clock=()=>new Date().toISOString(),newId=()=> 'ms_'+globalThis.crypto.randomUUID()}={}){
    const repository=storage.createRepository(adapter);
    function inspect(){
      const models=repository.read(),legacy=Object.fromEntries(legacyKeys.map(k=>[k,adapter.getItem(k)]));
      for(const raw of Object.values(legacy)){if(raw!==null){const v=JSON.parse(raw);if(!v||typeof v!=='object'||Array.isArray(v))throw Error('INVALID_LEGACY_SOURCE');storage.assertJson(v);}}
      return {models,legacy,fingerprint:contract.draftFingerprint(models,legacy)};
    }
    function operate(operation,{expectedFingerprint}={}){
      const before=inspect();if(typeof expectedFingerprint!=='string'||before.fingerprint!==expectedFingerprint)throw Error('STALE_MONTHLY_SOURCE_DRAFT');
      const {changes,added}=buildChanges(before.models,operation,{at:clock(),newId});
      const saved=repository.commit(changes,{expectedModels:before.models,expectedLegacy:before.legacy,invalidateTopSummary:true});
      return {models:saved,added,fingerprint:contract.draftFingerprint(saved,before.legacy)};
    }
    return Object.freeze({inspect,operate});
  }
  const api=Object.freeze({createService,buildChanges});if(node)module.exports=api;else root.TradeScopeMonthlySourceService=api;
})(typeof globalThis!=='undefined'?globalThis:this);
