(function(root){
 'use strict';
 const node=typeof module!=='undefined'&&module.exports;
 const model=node?require('./data-model-storage.js'):root.TradeScopeDataStorage;
 const relation=node?require('./transaction-reconciliation-v2.js'):root.TradeScopeReconciliationV2;
 const candidate=node?require('./fx-transaction-candidate-view.js'):root.TradeScopeFxTransactionCandidateView;
 const adoption=node?require('./transaction-adoption-view.js'):root.TradeScopeTransactionAdoptionView;
 const source=node?require('./transaction-source-contract.js'):root.TradeScopeTransactionSourceContract;
 const common=node?require('./monthly-source-contract.js'):root.TradeScopeMonthlySourceContract;
 const journal=node?require('./storage-transaction.js'):root.TradeScopeStorageTransaction;
 const manualKey='tradeScopeTradeHistoryV1',version='reconciliation-v2-save-v1';
 const policies={lightfx:'acc_lightfx_fx',minna:'acc_minna_fx'},copy=v=>JSON.parse(JSON.stringify(v));
 const rows=(m,k)=>m[k]?.records||[],same=(a,b)=>common.hash(a)===common.hash(b);
 const pairFields=['accountId','sourceProvider','manualId','importedTransactionId','transactionCollectionId'];
 const bindingFields=[...pairFields,'manualFactsFingerprint','importedRowFingerprint','collectionFingerprint','head'];
 const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
 const stop=status=>{const error=Error(status);error.status=status;throw error;};
 function pairValid(p){
  return exact(p,pairFields)&&pairFields.every(k=>typeof p[k]==='string'&&p[k].trim())&&policies[p.sourceProvider]===p.accountId;
 }
 const pairOf=b=>Object.fromEntries(pairFields.map(k=>[k,b[k]]));
 function snapshot(storage){
  if(storage.getItem(journal.journalKey)!==null)stop('conflict');
  const models=model.readModels(storage),raw=storage.getItem(manualKey),manual=JSON.parse(raw??'[]');
  if(!Array.isArray(manual))stop('broken-reference');
  const read=relation.read(manual,models);if(read.status!=='ok')stop(read.status==='conflict'?'conflict':'broken-reference');
  return {models,manual,raw,read};
 }
 function binding(s,p,requireActive){
  if(!pairValid(p))stop('invalid-request');
  const ms=s.manual.filter(m=>m?.id===p.manualId),ts=rows(s.models,'importedTransactions').filter(t=>t.id===p.importedTransactionId);
  const cs=rows(s.models,'transactionSources').filter(c=>c.kind==='collection'&&c.id===p.transactionCollectionId);
  if(ms.length!==1||ts.length!==1||cs.length!==1)stop('broken-reference');
  const t=ts[0],c=cs[0],a=rows(s.models,'accounts').find(a=>a.id===p.accountId);
  source.validateRow(t);source.validateRecord(c);
  if(t.schemaVersion!==3||!a?.enabled||a.accountType!=='fx'||a.providerCode!==p.sourceProvider
   ||[t,c].some(r=>r.accountId!==p.accountId||r.sourceProvider!==p.sourceProvider)
   ||t.collectionId!==c.id||source.targetKey(t)!==source.targetKey(c)||t.importBatchId!==c.importBatchId
   ||c.transactionIds.filter(id=>id===t.id).length!==1||source.rowFingerprint(t)!==t.rowFingerprint
   ||source.collectionFingerprint(c,s.models)!==c.fingerprint)stop('broken-reference');
  const projection=candidate.project(s.manual,s.models),m=projection.manual.find(m=>m.manualId===p.manualId);
  if(m?.accountId!==p.accountId||m.provider!==p.sourceProvider)stop('invalid-candidate');
  const manualFactsFingerprint=relation.manualFingerprint(ms[0],s.models);if(!manualFactsFingerprint)stop('stale-manual');
  if(requireActive){
   const active=adoption.resolve(s.models,c);
   if(!active.usable)stop(['conflict','broken-reference'].includes(active.status)?active.status:'collection-changed');
   if(active.collection.id!==c.id)stop('collection-changed');
  }
  const entry=s.read.results.find(r=>r.decision&&relation.pairKey(r.decision)===relation.pairKey(p));
  return {...p,manualFactsFingerprint,importedRowFingerprint:t.rowFingerprint,collectionFingerprint:c.fingerprint,head:entry?.decision??null};
 }
 // Kept separate from the record/save mechanism: future explicit-selection policy can
 // be designed independently. This release admits reciprocal unique candidates only.
 function uniquePolicy(s,p){
  const projection=candidate.project(s.manual,s.models),m=projection.manual.find(m=>m.manualId===p.manualId);
  const t=projection.imported.find(t=>t.importedId===p.importedTransactionId&&t.collectionId===p.transactionCollectionId);
  return m?.status==='unique-candidate'&&t?.status==='unique-candidate'
   &&m.importedIds.length===1&&m.importedIds[0]===t.importedId&&t.manualIds.length===1&&t.manualIds[0]===m.manualId;
 }
 function checkBinding(expected,actual){
  if(!same(expected.head,actual.head))stop('conflict');
  if(expected.manualFactsFingerprint!==actual.manualFactsFingerprint)stop('stale-manual');
  if(expected.importedRowFingerprint!==actual.importedRowFingerprint||expected.collectionFingerprint!==actual.collectionFingerprint)stop('collection-changed');
 }
 function occupied(s,p,releasing){
  return s.read.results.some(r=>relation.occupies(r)&&r.id!==releasing
   &&relation.pairKey(r.decision)!==relation.pairKey(p)
   &&(r.manualId===p.manualId||r.importedTransactionId===p.importedTransactionId));
 }
 function record(binding,decision,id,at){
  // Revocation retains the original binding even when a PDF is no longer current.
  const b=decision==='revoked'?binding.head:binding;
  return {schemaVersion:2,id,createdAt:at,previousId:binding.head?.id??null,...pairOf(binding),
   manualFactsFingerprint:b.manualFactsFingerprint,importedRowFingerprint:b.importedRowFingerprint,
   collectionFingerprint:b.collectionFingerprint,factsVersion:relation.factsVersion,relationType:'one-to-one',decision,decisionMethod:'user'};
 }
 function draftValid(d){
  const validBinding=b=>exact(b,bindingFields)&&pairValid(pairOf(b))
   &&['manualFactsFingerprint','importedRowFingerprint','collectionFingerprint'].every(k=>typeof b[k]==='string'&&/^[a-f0-9]{64}$/.test(b[k]))
   &&(b.head===null||(()=>{try{relation.validateRecord(b.head);return relation.pairKey(b.head)===relation.pairKey(b);}catch(_){return false;}})());
  return exact(d,['version','operation','target','from'])&&d.version===version
   &&['confirmed','rejected','revoked','reassign'].includes(d.operation)&&validBinding(d.target)
   &&(d.operation==='reassign'?validBinding(d.from)&&d.from.head?.decision==='confirmed'
    &&d.from.accountId===d.target.accountId&&d.from.sourceProvider===d.target.sourceProvider
    &&(d.from.manualId===d.target.manualId||d.from.importedTransactionId===d.target.importedTransactionId)
    &&relation.pairKey(d.from)!==relation.pairKey(d.target):d.from===null);
 }
 function plannedRecords(d,base,at){
  if(d.operation==='reassign')return [record(d.from,'revoked',base+'_1',at),record(d.target,'confirmed',base+'_2',at)];
  if(d.operation==='revoked'&&(!d.target.head||d.target.head.decision==='revoked'))return [];
  return [record(d.target,d.operation,base+'_1',at)];
 }
 // Intent-bound IDs also protect no-write operations without inventing an operation
 // record/schema. Create once with the draft, then retain both across every retry.
 function requestIdFor(draft,nonce=''){
  if(!draftValid(draft)||typeof nonce!=='string'||nonce.length>1024)throw Error('INVALID_REQUEST');
  return 'r2:'+common.hash(draft)+':'+common.hash(nonce);
 }
 function createService(storage,options={}){
  const clock=options.clock||(()=>new Date().toISOString()),repository=model.createRepository(storage);
  function prepare({operation,pair,fromPair=null}={}){
   try{
    if(!['confirmed','rejected','revoked','reassign'].includes(operation))stop('invalid-request');
    const s=snapshot(storage),target=binding(s,pair,operation!=='revoked');
    const from=operation==='reassign'?binding(s,fromPair,false):null;
    const draft={version,operation,target,from};if(!draftValid(draft))stop('invalid-request');
    return {status:'ready',requestId:requestIdFor(draft),draft:copy(draft)};
   }catch(error){return {status:error.status||'broken-reference'};}
  }
  function save({requestId,explicitUserDecision,draft}={}){
   let committing=false;
   try{
    if(explicitUserDecision!==true)stop('explicit-decision-required');
    if(typeof requestId!=='string'||!/^r2:[a-f0-9]{64}:[a-f0-9]{64}$/.test(requestId)||!draftValid(draft))stop('invalid-request');
    if(requestId.split(':')[1]!==common.hash(draft))stop('request-conflict');
    // Caller retains this ID and the original draft across retries/reloads. The ID
    // namespace encodes intent, while stable suffixes identify the atomic records.
    const requestBase='recon2_'+common.hash(requestId),base=requestBase+'_'+common.hash(draft).slice(0,48),s=snapshot(storage),at=clock();
    const planned=plannedRecords(draft,base,at),prior=rows(s.models,'transactionReconciliations').filter(r=>r.id.startsWith(requestBase+'_'));
    if(prior.length){
     if(prior.length!==planned.length||planned.some(r=>{const old=prior.find(o=>o.id===r.id);return !old||!same({...r,createdAt:old.createdAt},old);}))stop('request-conflict');
     return {status:'already-current',recordIds:prior.map(r=>r.id),replayed:true};
    }
    const target=binding(s,pairOf(draft.target),draft.operation!=='revoked');checkBinding(draft.target,target);
    const from=draft.from?binding(s,pairOf(draft.from),false):null;if(from)checkBinding(draft.from,from);
    if(draft.operation==='revoked'&&(!target.head||target.head.decision==='revoked'))return {status:'already-current',recordIds:[],replayed:false};
    if(['confirmed','rejected'].includes(draft.operation)&&target.head?.decision===draft.operation
     &&['manualFactsFingerprint','importedRowFingerprint','collectionFingerprint'].every(k=>target.head[k]===target[k]))
     return {status:'already-current',recordIds:[target.head.id],replayed:false};
    if(['confirmed','reassign'].includes(draft.operation)){
     if(occupied(s,target,from?.head.id))stop('occupied');
     if(!uniquePolicy(s,target))stop('invalid-candidate');
    }
    let envelope=s.models.transactionReconciliations;
    for(const r of planned)envelope=relation.append(envelope,r,at,{models:s.models,manual:s.manual});
    const expected={...s.models,transactionReconciliations:envelope};
    model.validateModels(expected);model.validateReconciliationReferences(expected,s.manual);
    // Fresh read immediately before the Repository guard. Metadata-only edits are
    // accepted, but the latest raw manual JSON is then guarded during the journal.
    const fresh=snapshot(storage);checkBinding(target,binding(fresh,pairOf(target),draft.operation!=='revoked'));
    if(from)checkBinding(from,binding(fresh,pairOf(from),false));
    if(!same(fresh.models,s.models))stop('conflict');
    if(['confirmed','reassign'].includes(draft.operation)){
     if(occupied(fresh,target,from?.head.id))stop('occupied');
     if(!uniquePolicy(fresh,target))stop('invalid-candidate');
    }
    committing=true;
    repository.commit({transactionReconciliations:envelope},{expectedModels:fresh.models,expectedManual:fresh.raw,verifyModels:verified=>{
     if(!same(verified,expected))return false;
     const manual=JSON.parse(storage.getItem(manualKey)??'[]'),read=relation.read(manual,verified);
     if(read.status!=='ok')return false;
     return planned.every(r=>{
      const head=read.results.find(h=>h.id===r.id);
      return head&&head.status===r.decision&&same(head.decision,r);
     });
    }});
    return {status:'saved',recordIds:planned.map(r=>r.id),replayed:false};
   }catch(error){return {status:error.status||(/変更されています/.test(error.message)?'conflict':committing?'failed':'broken-reference')};}
  }
  return Object.freeze({prepare,save});
 }
 const api=Object.freeze({version,requestIdFor,createService});
 if(node)module.exports=api;else root.TradeScopeReconciliationV2Save=api;
})(typeof globalThis!=='undefined'?globalThis:this);
