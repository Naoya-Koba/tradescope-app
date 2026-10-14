(function(root){
  'use strict';
  const node=typeof module!=='undefined'&&module.exports;
  const contract=node?require('./transaction-source-contract.js'):root.TradeScopeTransactionSourceContract;
  const hash=(node?require('./monthly-source-contract.js'):root.TradeScopeMonthlySourceContract).hash;
  const rows=(m,e)=>m?.[e]?.records||[],keys=['accountId','sourceProvider','targetMonth','sourceScope'];
  const clone=v=>JSON.parse(JSON.stringify(v)),target=r=>Object.fromEntries(keys.map(k=>[k,r[k]]));
  const key=r=>contract.targetKey(r),usable=s=>['adopted','deferred-with-current'].includes(s);
  // Deliberately never access balance State/Input/Snapshot/monthlySources or manual history.
  function snapshot(models){return clone({transactionSources:models?.transactionSources??null,
    importedTransactions:models?.importedTransactions??null,accounts:models?.accounts??null,
    instruments:models?.instruments??null,importBatches:models?.importBatches??null});}
  function fingerprint(models){try{return hash(snapshot(models));}catch(_){return null;}}
  function scoped(models,query){
    const all=rows(models,'transactionSources'),selected=new Set(all.filter(r=>key(r)===key(query)).map(r=>r.id));
    // Include referenced anchors even when their target is wrong: never filter a conflict away.
    let changed=true;while(changed){changed=false;for(const r of all){
      const refs=[r.previousId,r.collectionId,r.correctionOfCollectionId].filter(Boolean);
      // A damaged successor must not disappear into another target and revive the old head.
      if(!selected.has(r.id)&&refs.some(id=>selected.has(id))){selected.add(r.id);changed=true;}
      if(selected.has(r.id))for(const id of refs)if(!selected.has(id)&&all.some(v=>v.id===id)){selected.add(id);changed=true;}
    }}
    const sources=all.filter(r=>selected.has(r.id)),memberIds=new Set(sources.flatMap(r=>r.transactionIds||[]));
    const imported=rows(models,'importedTransactions').filter(r=>r.schemaVersion===3&&key(r)===key(query)||selected.has(r.collectionId)||memberIds.has(r.id));
    return {...models,transactionSources:models.transactionSources===null?null:{...models.transactionSources,records:sources},
      importedTransactions:models.importedTransactions===null?null:{...models.importedTransactions,records:imported}};
  }
  function diagnose(models){
    try{
      contract.validateEnvelope(models.transactionSources);
      const sources=rows(models,'transactionSources'),tx=rows(models,'importedTransactions');
      const unique=list=>new Set(list.map(r=>r.id)).size===list.length;
      if(![sources,tx,rows(models,'accounts'),rows(models,'instruments'),rows(models,'importBatches')].every(unique))return 'conflict';
      const bySource=new Map(sources.map(r=>[r.id,r])),byTx=new Map(tx.map(r=>[r.id,r]));
      for(const r of sources){
        if(r.kind==='decision'){
          if(r.previousId!==null&&!bySource.has(r.previousId))return 'broken-reference';
          if(r.decision!=='defer'){
            const c=bySource.get(r.collectionId);if(!c)return 'broken-reference';
            if(c.kind!=='collection'||key(c)!==key(r))return 'conflict';
            if(c.fingerprint!==r.collectionFingerprint)return 'stale';
          }
          continue;
        }
        if(!rows(models,'accounts').some(a=>a.id===r.accountId)||!rows(models,'importBatches').some(b=>b.id===r.importBatchId)
          ||r.correctionOfCollectionId!==null&&!bySource.has(r.correctionOfCollectionId))return 'broken-reference';
        for(const id of r.transactionIds){const member=byTx.get(id);if(!member)return 'broken-reference';
          if(member.schemaVersion!==3||member.collectionId!==r.id||key(member)!==key(r)||member.importBatchId!==r.importBatchId)return 'conflict';}
      }
      for(const r of tx){
        if(!bySource.has(r.collectionId)||!rows(models,'instruments').some(i=>i.id===r.instrumentId))return 'broken-reference';
        if(typeof r.rowFingerprint==='string'&&/^[a-f0-9]{64}$/.test(r.rowFingerprint)&&contract.rowFingerprint(r)!==r.rowFingerprint)return 'stale';
        contract.validateRow(r);
      }
      for(const c of sources.filter(r=>r.kind==='collection'))if(contract.collectionFingerprint(c,models)!==c.fingerprint)return 'stale';
      contract.validateSet(models);return null;
    }catch(_){return 'conflict';}
  }
  function result(query,status,token,details={}){return {target:target(query),status,usable:usable(status),fingerprint:token,
    decision:null,collection:null,transactions:null,confirmedEmpty:false,candidateCount:0,partialCandidateCount:0,...details};}
  function resolveSnapshot(snapshot,query,token,{expectedFingerprint=null}={}){
    if(keys.some(k=>typeof query?.[k]!=='string'))return result(query||{},'conflict',token);
    if(expectedFingerprint!==null&&token!==expectedFingerprint)return result(query,'stale',token);
    try{
      const facts=scoped(snapshot,query),problem=diagnose(facts);
      if(problem)return result(query,problem,token);
      const candidates=rows(facts,'transactionSources').filter(r=>r.kind==='collection'&&key(r)===key(query));
      const adopted=contract.resolve(facts,query),deferred=adopted.decision?.decision==='defer';
      const status=adopted.collection?deferred?'deferred-with-current':'adopted':deferred?'deferred-without-current':'unknown';
      return result(query,status,token,{decision:adopted.decision,collection:adopted.collection,transactions:adopted.transactions,
        confirmedEmpty:!!adopted.collection&&adopted.transactions.length===0,candidateCount:candidates.length,
        partialCandidateCount:candidates.filter(c=>c.coverage==='partial').length});
    }catch(_){return result(query,'conflict',token);}
  }
  function resolve(models,query,options={}){
    try{const facts=snapshot(models);return resolveSnapshot(facts,query,hash(facts),options);}
    catch(_){return result(query||{},'conflict',null);}
  }
  function readAll(models,options={}){
    const queries=new Map();let facts,token;
    try{facts=snapshot(models);token=hash(facts);for(const r of [...rows(facts,'transactionSources'),...rows(facts,'importedTransactions').filter(r=>r.schemaVersion===3)]){
      if(keys.every(k=>typeof r[k]==='string'))queries.set(key(r),target(r));
    }}catch(_){return {fingerprint:fingerprint(models),results:[],transactions:[]};}
    const results=[...queries.values()].map(q=>resolveSnapshot(facts,q,token,options));
    return {fingerprint:token,results,transactions:results.filter(r=>r.usable).flatMap(r=>r.transactions)};
  }
  const api=Object.freeze({version:'transaction-adoption-view-v1',fingerprint,resolve,readAll,usable});
  if(node)module.exports=api;else root.TradeScopeTransactionAdoptionView=api;
})(typeof globalThis!=='undefined'?globalThis:this);
