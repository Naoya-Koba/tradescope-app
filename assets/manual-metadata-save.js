(function(root){
 'use strict';
 const node=typeof module!=='undefined'&&module.exports;
 const model=node?require('./data-model-storage.js'):root.TradeScopeDataStorage;
 const relation=node?require('./transaction-reconciliation-v2.js'):root.TradeScopeReconciliationV2;
 const common=node?require('./monthly-source-contract.js'):root.TradeScopeMonthlySourceContract;
 const journal=node?require('./storage-transaction.js'):root.TradeScopeStorageTransaction;
 const key='tradeScopeTradeHistoryV1';
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const fields=['manualId','relationId','importedTransactionId','transactionCollectionId'];
 const stop=status=>{throw {status};};
 function binding(s,b){
  if(!b||fields.some(k=>typeof b[k]!=='string'||!b[k]))stop('invalid');
  const read=relation.read(s.manual,s.models);if(read.status!=='ok')stop('broken-reference');
  const matches=read.results.filter(r=>relation.occupies(r)&&r.id===b.relationId&&r.manualId===b.manualId
   &&r.importedTransactionId===b.importedTransactionId&&r.transactionCollectionId===b.transactionCollectionId);
  if(matches.length!==1)stop('changed');
  const entries=s.manual.filter(m=>m?.id===b.manualId);if(entries.length!==1)stop('changed');
  return entries[0];
 }
 function createService(storage){
  function snapshot(){
   const raw=storage.getItem(key),manual=JSON.parse(raw??'[]');if(!Array.isArray(manual))stop('broken-reference');
   return {raw,manual,models:model.readModels(storage)};
  }
  function prepare(reference){
   try{
    const s=snapshot(),record=binding(s,reference),financialFingerprint=relation.manualFingerprint(record,s.models);
    if(!financialFingerprint)stop('changed');
    return {status:'ready',draft:{...Object.fromEntries(fields.map(k=>[k,reference[k]])),recordFingerprint:common.hash(record),financialFingerprint},
     metadata:{memo:typeof record.memo==='string'?record.memo:'',strategy:typeof record.strategy==='string'?record.strategy:''}};
   }catch(e){return {status:e.status||'failed'};}
  }
  function save({draft,metadata}={}){
   try{
    if(!draft||Object.keys(draft).length!==fields.length+2||!metadata||Object.keys(metadata).some(k=>!['memo','strategy'].includes(k))
     ||typeof metadata.memo!=='string'||typeof metadata.strategy!=='string')stop('invalid');
    const s=snapshot(),record=binding(s,draft);
    if(relation.manualFingerprint(record,s.models)!==draft.financialFingerprint||common.hash(record)!==draft.recordFingerprint)stop('changed');
    const replacement={...record,memo:metadata.memo,strategy:metadata.strategy};
    if(same(record,replacement))return {status:'already-current'};
    const next=s.manual.map(m=>m===record?replacement:m),raw=JSON.stringify(next);
    relation.protectManualChange(storage,next);model.validateReconciliationReferences(s.models,next);
    if(relation.manualFingerprint(replacement,s.models)!==draft.financialFingerprint)stop('changed');
    // Use the existing manual key and the SAME journal/rollback protocol as Repository.
    // No normalizer, full-form save, replacement relation, or new financial record.
    if(storage.getItem(key)!==s.raw||!same(model.readModels(storage),s.models))stop('changed');
    journal.apply([{type:'set',storageKey:key,rawValue:raw}],storage,()=>{
     const verified=snapshot();if(verified.raw!==raw||!same(verified.models,s.models))return false;
     const actual=binding(verified,draft);
     return same(actual,replacement)&&relation.manualFingerprint(actual,verified.models)===draft.financialFingerprint;
    });
    return {status:'saved'};
   }catch(e){return {status:e.status||'failed'};}
  }
  return Object.freeze({prepare,save});
 }
 const api=Object.freeze({createService});if(node)module.exports=api;else root.TradeScopeManualMetadataSave=api;
})(typeof globalThis!=='undefined'?globalThis:this);
