(function(root){
 'use strict';
 const node=typeof module!=='undefined'&&module.exports;
 const legacy=node?require('./transaction-reconciliation.js'):root.TradeScopeTransactionReconciliation;
 const common=node?require('./monthly-source-contract.js'):root.TradeScopeMonthlySourceContract;
 const source=node?require('./transaction-source-contract.js'):root.TradeScopeTransactionSourceContract;
 const adoption=node?require('./transaction-adoption-view.js'):root.TradeScopeTransactionAdoptionView;
 const key='tradeScopeTransactionReconciliationsV1',manualKey='tradeScopeTradeHistoryV1',factsVersion='fx-manual-facts-v1';
 const fields=['schemaVersion','id','createdAt','previousId','accountId','sourceProvider','manualId','importedTransactionId','transactionCollectionId',
  'manualFactsFingerprint','importedRowFingerprint','collectionFingerprint','factsVersion','relationType','decision','decisionMethod'];
 const policies={lightfx:'acc_lightfx_fx',minna:'acc_minna_fx'},rows=(m,e)=>Array.isArray(m?.[e]?.records)?m[e].records:[];
 const fail=()=>{throw Error('取引の対応情報・参照が不正です');};
 const id=v=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(v);
 const manualId=v=>typeof v==='string'&&v.trim().length>0&&v.length<=1024;
 const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
 const stamp=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(v)
  &&!Number.isNaN(Date.parse(v))&&new Date(v.slice(0,10)).toISOString().slice(0,10)===v.slice(0,10)
  &&Number(v.slice(11,13))<24&&Number(v.slice(14,16))<60&&Number(v.slice(17,19))<60;
 const records=m=>rows(m,'transactionReconciliations').filter(r=>r?.schemaVersion===2);
 const pairKey=r=>JSON.stringify([r.accountId,r.sourceProvider,r.manualId,r.importedTransactionId,r.transactionCollectionId]);
 function validateRecord(r){
  if(!r||typeof r!=='object'||Object.keys(r).length!==fields.length||fields.some(f=>!Object.hasOwn(r,f)))fail();
  if(r.schemaVersion!==2||!id(r.id)||!stamp(r.createdAt)||r.previousId!==null&&!id(r.previousId)
   ||!Object.hasOwn(policies,r.sourceProvider)||r.accountId!==policies[r.sourceProvider]||!manualId(r.manualId)
   ||!id(r.importedTransactionId)||!id(r.transactionCollectionId)||!hash(r.manualFactsFingerprint)
   ||!hash(r.importedRowFingerprint)||!hash(r.collectionFingerprint)||r.factsVersion!==factsVersion
   ||r.relationType!=='one-to-one'||!['confirmed','rejected','revoked'].includes(r.decision)||r.decisionMethod!=='user')fail();
 }
 function heads(models){
  const result=new Map(),seen=new Set(),manual=new Map(),imported=new Map();
  for(const r of records(models)){
   validateRecord(r);const pair=pairKey(r),old=result.get(pair);
   if(seen.has(r.id)||r.previousId!==(old?.id??null)||r.previousId!==null&&!seen.has(r.previousId))fail();
   if(r.decision==='revoked'&&(!old||old.decision==='revoked'||['manualFactsFingerprint','importedRowFingerprint','collectionFingerprint','factsVersion'].some(f=>r[f]!==old[f])))fail();
   if(old?.decision==='confirmed'){manual.delete(old.manualId);imported.delete(old.importedTransactionId);}
   if(r.decision==='confirmed'){
    if(manual.has(r.manualId)||imported.has(r.importedTransactionId))fail();
    manual.set(r.manualId,r.id);imported.set(r.importedTransactionId,r.id);
   }
   seen.add(r.id);result.set(pair,r);
  }
  return [...result.values()];
 }
 function manualFingerprint(record,models,version=factsVersion){
  if(version!==factsVersion)return null;
  try{
   // The v1 helper resolves identity/decimal facts only. No imported v3 is passed to v1.
   const f=legacy.facts('manual',record,models),account=rows(models,'accounts').filter(a=>a.id===f?.accountId);
   if(!f||record.assetType!=='FX'||account.length!==1)return null;
   return common.hash({factsVersion,accountId:f.accountId,sourceProvider:account[0].providerCode,instrumentId:f.instrumentId,
    originalCategory:record.category,action:f.semantic,side:f.side,quantity:legacy.decimals(record.quantity),
    contractSize:legacy.decimals(record.contractSize),rate:legacy.decimals(record.rate),date:record.date});
  }catch(_){return null;}
 }
 function validateSet(models){
  const envelope=models?.transactionReconciliations;
  if(envelope!=null&&(envelope.schemaVersion!==1||!Array.isArray(envelope.records)||!stamp(envelope.updatedAt)
   ||Object.keys(envelope).length!==3||new Set(envelope.records.map(r=>r?.id)).size!==envelope.records.length))fail();
  const all=rows(models,'transactionReconciliations');
  if(all.some(r=>![1,2].includes(r?.schemaVersion)))fail();
  if(!records(models).length)return [];
  const result=heads(models);
  for(const r of records(models)){
   const tx=rows(models,'importedTransactions').filter(t=>t.id===r.importedTransactionId);
   const collections=rows(models,'transactionSources').filter(c=>c.id===r.transactionCollectionId&&c.kind==='collection');
   const accounts=rows(models,'accounts').filter(a=>a.id===r.accountId);
   if(tx.length!==1||collections.length!==1||accounts.length!==1||accounts[0].providerCode!==r.sourceProvider||accounts[0].accountType!=='fx')fail();
   const t=tx[0],c=collections[0];source.validateRow(t);source.validateRecord(c);
   if(t.schemaVersion!==3||t.collectionId!==c.id||t.accountId!==r.accountId||c.accountId!==r.accountId
    ||t.sourceProvider!==r.sourceProvider||c.sourceProvider!==r.sourceProvider||source.targetKey(t)!==source.targetKey(c)
    ||t.importBatchId!==c.importBatchId||c.transactionIds.filter(id=>id===t.id).length!==1
    ||t.rowFingerprint!==r.importedRowFingerprint||c.fingerprint!==r.collectionFingerprint
    ||source.collectionFingerprint(c,models)!==r.collectionFingerprint)fail();
  }
  return result;
 }
 function validateManualReferences(models,manual){
  if(!records(models).length)return;
  validateSet(models);if(!Array.isArray(manual))fail();
  for(const r of records(models))if(manual.filter(m=>m?.id===r.manualId).length!==1)fail();
 }
 function read(manual,models){
  const all=records(models),broken=()=>({status:'broken',results:all.map(r=>({id:r.id,manualId:r.manualId,importedTransactionId:r.importedTransactionId,status:'broken',effective:false}))});
  try{
   validateManualReferences(models,manual);const current=validateSet(models),adopted=adoption.readAll(models);
   return {status:'ok',results:current.map(r=>{
    const m=manual.find(m=>m.id===r.manualId),c=rows(models,'transactionSources').find(c=>c.id===r.transactionCollectionId);
    const active=adopted.results.find(s=>source.targetKey(s.target)===source.targetKey(c));
    let status=r.decision;
    if(r.decision!=='revoked'){
     if(active&&['broken-reference','conflict'].includes(active.status))status='broken';
     else if(!active?.usable||active.collection.id!==c.id||manualFingerprint(m,models,r.factsVersion)!==r.manualFactsFingerprint)status='stale';
    }
    return {id:r.id,manualId:r.manualId,importedTransactionId:r.importedTransactionId,transactionCollectionId:c.id,
     status,effective:['confirmed','rejected'].includes(status),decision:JSON.parse(JSON.stringify(r)),
     reason:status==='stale'?(manualFingerprint(m,models,r.factsVersion)!==r.manualFactsFingerprint?'MANUAL_FACTS_CHANGED':'COLLECTION_NOT_CURRENT'):null,
     history:all.filter(d=>pairKey(d)===pairKey(r)).map(d=>JSON.parse(JSON.stringify(d)))};
   })};
  }catch(_){return broken();}
 }
 function append(envelope,decision,at=decision.createdAt){
  validateRecord(decision);const existing=envelope?.records||[],old=existing.find(r=>r.id===decision.id);
  if(envelope&&(envelope.schemaVersion!==1||!Array.isArray(envelope.records))||existing.some(r=>![1,2].includes(r?.schemaVersion)))fail();
  if(old){if(common.hash(old)!==common.hash(decision))fail();return envelope;}
  const next={schemaVersion:1,records:[...existing,JSON.parse(JSON.stringify(decision))],updatedAt:at};
  heads({transactionReconciliations:next});return next;
 }
 function protectManualChange(adapter,next){
  const raw=adapter.getItem(key);if(raw===null)return;
  let value;try{value=JSON.parse(raw);}catch(_){fail();}
  if(value?.schemaVersion!==1||!Array.isArray(value.records)||value.records.some(r=>![1,2].includes(r.schemaVersion)))fail();
  const refs=value.records.filter(r=>r.schemaVersion===2);
  if(!refs.length)return;
  for(const r of refs){validateRecord(r);if(!Array.isArray(next)||next.filter(m=>m?.id===r.manualId).length!==1)
   throw Error('対応情報のある取引は削除・置き換えできません。');}
 }
 const api=Object.freeze({factsVersion,fields,records,pairKey,validateRecord,validateSet,validateManualReferences,manualFingerprint,read,append,protectManualChange});
 if(node)module.exports=api;else root.TradeScopeReconciliationV2=api;
})(typeof globalThis!=='undefined'?globalThis:this);
