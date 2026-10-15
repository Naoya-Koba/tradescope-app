(function(root){
 'use strict';
 const nodeModule=typeof module!=='undefined'&&module.exports;
 const candidates=nodeModule?require('../assets/fx-transaction-candidate-view.js'):root.TradeScopeFxTransactionCandidateView;
 const reader=nodeModule?require('../assets/transaction-reconciliation-v2.js'):root.TradeScopeReconciliationV2;
 const save=nodeModule?require('../assets/reconciliation-v2-save.js'):root.TradeScopeReconciliationV2Save;
 const common=nodeModule?require('../assets/monthly-source-contract.js'):root.TradeScopeMonthlySourceContract;
 const providers={lightfx:'acc_lightfx_fx',minna:'acc_minna_fx'};
 const updated='内容が更新されています。もう一度確認してください';
 function message(status){
  if(['stale-manual','collection-changed','occupied','conflict','invalid-candidate','request-conflict'].includes(status))return updated;
  if(status==='broken-reference')return '取引内容を確認できません。再読み込みしてください';
  return '保存できませんでした。もう一度お試しください';
 }
 function create({document,storage,onRefresh,service=save.createService(storage)}){
  let manual=[],models=null,projection=null,relations=null,busy=false;
  const controls=new Set();
  const node=(tag,text,className)=>{const e=document.createElement(tag);e.textContent=text;if(className)e.className=className;return e;};
  function update(entries,next){
   manual=entries;models=next;controls.clear();
   try{projection=candidates.project(manual,models);relations=reader.read(manual,models);}
   catch(_){projection=null;relations=null;}
  }
  function describe(row){
   if(row.transactionVersion!==3||relations?.status!=='ok'||!projection)return null;
   const anchors=row.sources.filter(s=>Object.hasOwn(providers,s.kind));if(anchors.length!==1)return null;
   const anchor=anchors[0];if(providers[anchor.kind]!==row.accountId)return null;
   const imported=projection.imported.find(t=>t.importedId===anchor.id&&t.collectionId===anchor.collectionId
    &&t.accountId===row.accountId&&t.provider===anchor.kind);
   if(!imported)return null;
   const effective=relations.results.filter(r=>r.effective&&r.importedTransactionId===anchor.id
    &&r.transactionCollectionId===anchor.collectionId&&r.decision.accountId===row.accountId&&r.decision.sourceProvider===anchor.kind);
   const m=imported.status==='unique-candidate'&&imported.manualIds.length===1
    ?projection.manual.find(m=>m.manualId===imported.manualIds[0]&&m.status==='unique-candidate'
     &&m.importedIds.length===1&&m.importedIds[0]===anchor.id):null;
   const judged=m?effective.find(r=>r.manualId===m.manualId):effective.length===1?effective[0]:null;
   if(!judged&&!m)return null;
   const pair={accountId:row.accountId,sourceProvider:anchor.kind,manualId:judged?.manualId??m.manualId,
    importedTransactionId:anchor.id,transactionCollectionId:anchor.collectionId};
   const head=relations.results.find(r=>r.decision&&reader.pairKey(r.decision)===reader.pairKey(pair));
   const raw=manual.find(r=>r.id===pair.manualId),tx=models.importedTransactions.records.find(r=>r.id===anchor.id);
   const collection=models.transactionSources.records.find(r=>r.id===anchor.collectionId);
   return {pair,state:judged?.status??null,binding:{...pair,manualFactsFingerprint:reader.manualFingerprint(raw,models),
    importedRowFingerprint:tx.rowFingerprint,collectionFingerprint:collection.fingerprint,head:head?.decision??null}};
  }
  function decorate(row,fragment,{onDismiss}={}){
   controls.clear(); // History has one expanded detail; do not retain detached controls.
   const info=describe(row);if(!info)return;
   const area=node('div','','transaction-confirmation'),status=node('p','','transaction-confirmation-status');
   const actions=node('div','','transaction-confirmation-actions');
   status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.tabIndex=-1;
   const addButton=(label,handler)=>{const b=node('button',label,'edit-btn');b.type='button';b.disabled=busy;
    b.addEventListener('click',event=>{if(event?.detail>1)return;return handler();});actions.append(b);controls.add(b);return b;};
   const plans=new Map(),operations=info.state?['revoked']:['confirmed','rejected'];
   for(const operation of operations){
    const prepared=service.prepare({operation,pair:info.pair});
    // Bind the draft to displayed facts/head, not to an unnoticed newer screen state.
    // Memo and strategy are deliberately outside this financial comparison.
    if(prepared.status!=='ready'||common.hash(prepared.draft.target)!==common.hash(info.binding)){
     status.textContent=message(prepared.status==='ready'?'conflict':prepared.status);
     addButton('再確認',()=>onRefresh());area.append(status,actions);fragment.append(area);return;
    }
    plans.set(operation,prepared);
   }
   status.textContent=info.state==='confirmed'?'同じ取引として確認済み':info.state==='rejected'?'別の取引として確認済み':'同じ日の手入力と同じ取引ですか？';
   const setBusy=value=>{busy=value;for(const b of controls)b.disabled=value;};let reviewButton=null;
   const failed=statusCode=>{status.textContent=message(statusCode);
    reviewButton??=addButton('再確認',()=>onRefresh({preserveDetail:true}));status.focus();};
   async function act(operation){
    if(busy)return;setBusy(true);area.setAttribute('aria-busy','true');status.textContent='保存中…';
    try{
     const prepared=plans.get(operation);
     const result=await service.save({draft:prepared.draft,requestId:prepared.requestId,explicitUserDecision:true});
     if(['saved','already-current'].includes(result.status)){
      if(onRefresh({preserveDetail:true})===false)failed('broken-reference');
     }else failed(result.status);
    }catch(_){failed('failed');}
    finally{setBusy(false);area.setAttribute('aria-busy','false');}
   }
   if(info.state)addButton('対応を解除',()=>act('revoked'));
   else{
    addButton('同じ取引',()=>act('confirmed'));addButton('別の取引',()=>act('rejected'));
    addButton('後で',()=>{if(!busy){area.hidden=true;onDismiss?.();}});
   }
   area.append(status,actions);fragment.append(area);
  }
  return Object.freeze({update,decorate});
 }
 const api=Object.freeze({create,message});if(nodeModule)module.exports=api;else root.TradeScopeReconciliationV2UI=api;
})(typeof globalThis!=='undefined'?globalThis:this);
