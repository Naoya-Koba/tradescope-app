(function(root){
 'use strict';
 const node=typeof module!=='undefined'&&module.exports;
 const view=node?require('./transaction-view.js'):root.TradeScopeTransactionView;
 const reader=node?require('./transaction-reconciliation-v2.js'):root.TradeScopeReconciliationV2;
 const common=node?require('./monthly-source-contract.js'):root.TradeScopeMonthlySourceContract;
 const providers={lightfx:'acc_lightfx_fx',minna:'acc_minna_fx'};
 const copy=v=>JSON.parse(JSON.stringify(v));
 // Display-only: the legacy resolver and every financial/position consumer stay unchanged.
 function resolve(manual,models){
  const records=view.resolve(manual,models),relations=reader.read(manual,models);
  if(relations.status!=='ok')return records;
  const hidden=new Set(),merged=new Map();
  for(const r of relations.results.filter(reader.occupies)){
   const d=r.decision;if(providers[d.sourceProvider]!==d.accountId)continue;
   const pdf=records.filter(t=>t.transactionVersion===3&&t.accountId===d.accountId&&t.sourceProvider===d.sourceProvider
    &&t.sources.some(s=>s.kind===d.sourceProvider&&s.id===d.importedTransactionId&&s.collectionId===d.transactionCollectionId));
   const entry=records.filter(t=>t.id==='manual:'+d.manualId&&t.sources.length===1&&t.sources[0].kind==='manual');
   const raw=manual.filter(t=>t?.id===d.manualId);
   if(pdf.length!==1||entry.length!==1||raw.length!==1)continue;
   const target=copy(pdf[0]);
   target.memo=typeof raw[0].memo==='string'?raw[0].memo:'';
   target.strategy=typeof raw[0].strategy==='string'?raw[0].strategy:'';
   target.manualMetadata={manualId:d.manualId,relationId:r.id,importedTransactionId:d.importedTransactionId,transactionCollectionId:d.transactionCollectionId};
   target.sources.push({kind:'manual',id:d.manualId});target.sourceLabel+='＋手入力';
   merged.set(target.id,target);hidden.add(entry[0].id);
  }
  return records.filter(r=>!hidden.has(r.id)).map(r=>merged.get(r.id)||r);
 }
 // Relations and raw manual metadata/facts must invalidate the display, not just adoption.
 const fingerprint=(manual,models)=>common.hash({manual,models});
 const api=Object.freeze({resolve,fingerprint});if(node)module.exports=api;else root.TradeScopeHistoryListView=api;
})(typeof globalThis!=='undefined'?globalThis:this);
