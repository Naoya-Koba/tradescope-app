(function(root){
  'use strict';
  // Contract/reader only. No Storage access, parser hook, History or P/L consumer.
  const hash=(typeof module!=='undefined'&&module.exports?require('./monthly-source-contract.js'):root.TradeScopeMonthlySourceContract).hash;
  const rows=(m,e)=>m?.[e]?.records||[],own=(v,k)=>Object.hasOwn(v,k);
  const fail=()=>{throw Error('INVALID_TRANSACTION_SOURCE');};
  const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  const id=v=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(v);
  const text=v=>typeof v==='string'&&v.length>0&&v.length<=128&&!/[\r\n\0]/.test(v);
  const decimal=v=>typeof v==='string'&&/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(v)&&v.length<=128;
  const positive=v=>decimal(v)&&!v.startsWith('-')&&/[1-9]/.test(v);
  const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
  const datetime=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})?$/.test(v)
    &&date(v.slice(0,10))&&Number(v.slice(11,13))<24&&Number(v.slice(14,16))<60&&Number(v.slice(17,19))<60&&!Number.isNaN(Date.parse(v));
  const timestamp=v=>datetime(v)&&/(?:Z|[+-]\d{2}:\d{2})$/.test(v);
  const fingerprint=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
  const sourceId=v=>v===null||id(v);
  const currency=v=>v===null||typeof v==='string'&&/^[A-Z]{3}$/.test(v);
  const policies=Object.freeze({gmo:{accountId:'acc_gmo_fx',scope:'gmo-fx-trades'},lightfx:{accountId:'acc_lightfx_fx',scope:'lightfx-fx-trades'},minna:{accountId:'acc_minna_fx',scope:'minna-fx-trades'}});
  const targetFields=['accountId','sourceProvider','targetMonth','sourceScope'];
  const nullableFields=['executedAt','settlementDate','sourceOrderId','sourceExecutionId','sourceOpenOrderRef','realizedPnl','transactionSwap','fee','currency','feeCurrency'];
  const rowFields=['schemaVersion','id','collectionId','accountId','instrumentId','importBatchId','sourceProvider','sourceType','sourceScope','targetMonth','action','side','quantity','quantityUnit','price','tradeDate','sourcePage','sourceRow','rowFingerprint','importedAt',...nullableFields];
  const collectionFields=['schemaVersion','id','kind',...targetFields,'importBatchId','normalizerVersion','transactionIds','fingerprint','coverage','correctionOfCollectionId','createdAt'];
  const decisionFields=['schemaVersion','id','kind',...targetFields,'decision','collectionId','collectionFingerprint','previousId','confirmedAt'];
  [rowFields,collectionFields,decisionFields].forEach(Object.freeze);
  function fields(v,names){if(!object(v)||Object.keys(v).length!==names.length||names.some(k=>!own(v,k)))fail();}
  function target(v){const p=policies[v.sourceProvider];if(!p||v.accountId!==p.accountId||v.sourceScope!==p.scope||!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(v.targetMonth))fail();}
  const targetKey=v=>JSON.stringify(targetFields.map(k=>v[k]));
  function rowFingerprint(row){return hash(Object.fromEntries(rowFields.filter(k=>!['id','collectionId','sourcePage','sourceRow','rowFingerprint','importedAt'].includes(k)).map(k=>[k,row[k]])));}
  function validateRow(r){
    fields(r,rowFields);target(r);
    if(r.schemaVersion!==3||!id(r.id)||!id(r.collectionId)||!id(r.instrumentId)||!id(r.importBatchId)||r.sourceType!=='pdf'
      ||!['open','close'].includes(r.action)||!['buy','sell'].includes(r.side)||!positive(r.quantity)||r.quantityUnit!=='baseCurrencyUnits'||!positive(r.price)
      ||!date(r.tradeDate)||r.tradeDate.slice(0,7)!==r.targetMonth||!Number.isSafeInteger(r.sourcePage)||r.sourcePage<1||!Number.isSafeInteger(r.sourceRow)||r.sourceRow<1
      ||!timestamp(r.importedAt)||!fingerprint(r.rowFingerprint)||r.rowFingerprint!==rowFingerprint(r))fail();
    if(r.executedAt!==null&&(!datetime(r.executedAt)||r.executedAt.slice(0,10)!==r.tradeDate)||r.settlementDate!==null&&!date(r.settlementDate)
      ||!['sourceOrderId','sourceExecutionId','sourceOpenOrderRef'].every(k=>sourceId(r[k]))||!['realizedPnl','transactionSwap','fee'].every(k=>r[k]===null||decimal(r[k]))
      ||!currency(r.currency)||!currency(r.feeCurrency)||r.action==='open'&&r.realizedPnl!==null)fail();
    if(r.sourceProvider!=='gmo'&&(r.executedAt===null||!/^\d{1,128}$/.test(r.sourceOrderId??'')
      ||r.sourceOpenOrderRef!==null&&!/^\d{1,128}$/.test(r.sourceOpenOrderRef)||r.action==='close'&&r.sourceOpenOrderRef===null))fail();
  }
  function validateRecord(r){
    if(r?.kind==='collection'){
      fields(r,collectionFields);target(r);
      if(r.schemaVersion!==1||!id(r.id)||!id(r.importBatchId)||!text(r.normalizerVersion)||!Array.isArray(r.transactionIds)||r.transactionIds.some(v=>!id(v))
        ||new Set(r.transactionIds).size!==r.transactionIds.length||!fingerprint(r.fingerprint)||!['complete','partial'].includes(r.coverage)
        ||!(r.correctionOfCollectionId===null||id(r.correctionOfCollectionId))||!timestamp(r.createdAt))fail();
    }else if(r?.kind==='decision'){
      fields(r,decisionFields);target(r);
      if(r.schemaVersion!==1||!id(r.id)||!['adopt','keep-current','defer'].includes(r.decision)||!(r.previousId===null||id(r.previousId))||!timestamp(r.confirmedAt))fail();
      if(r.decision==='defer'){if(r.collectionId!==null||r.collectionFingerprint!==null)fail();}
      else if(!id(r.collectionId)||!fingerprint(r.collectionFingerprint))fail();
    }else fail();
  }
  function validateEnvelope(value){
    if(value===null||value===undefined)return;
    fields(value,['schemaVersion','records','updatedAt']);
    if(value.schemaVersion!==1||!Array.isArray(value.records)||!timestamp(value.updatedAt))fail();
    value.records.forEach(validateRecord);
  }
  function collectionFingerprint(c,models){
    const batch=rows(models,'importBatches').find(r=>r.id===c.importBatchId);
    if(!batch)fail();
    return hash({collection:Object.fromEntries(collectionFields.filter(k=>k!=='fingerprint').map(k=>[k,c[k]])),batch,
      members:c.transactionIds.map(id=>{const r=rows(models,'importedTransactions').find(r=>r.id===id);if(!r)fail();return{id:r.id,rowFingerprint:r.rowFingerprint};})});
  }
  function stateMap(models){
    const states=new Map(),collections=new Map();
    // Append order is audit order. References must point backward, including equal-time events.
    for(const r of rows(models,'transactionSources')){
      if(r.kind==='collection'){collections.set(r.id,r);continue;}
      const key=targetKey(r),old=states.get(key),active=old?.collection||null;
      if(r.previousId!==(old?.decision.id??null)||old&&Date.parse(r.confirmedAt)<Date.parse(old.decision.confirmedAt))fail();
      if(r.decision==='defer'){states.set(key,{decision:r,collection:active});continue;}
      const c=collections.get(r.collectionId);
      if(!c||targetKey(c)!==key||c.fingerprint!==r.collectionFingerprint||Date.parse(c.createdAt)>Date.parse(r.confirmedAt)
        ||c.coverage!=='complete'||r.decision==='keep-current'&&active?.id!==c.id)fail();
      states.set(key,{decision:r,collection:c});
    }
    return states;
  }
  function validateSet(models){
    validateEnvelope(models?.transactionSources);
    const imported=models?.importedTransactions;
    if(imported!=null&&(imported.schemaVersion!==1||!Array.isArray(imported.records)||imported.records.some(r=>![1,2,3].includes(r?.schemaVersion))))fail();
    const records=rows(models,'transactionSources'),collections=new Map(),ids=new Set(),members=new Map(),locators=new Set();
    for(const r of records){validateRecord(r);if(ids.has(r.id))fail();ids.add(r.id);
      const account=rows(models,'accounts').find(a=>a.id===r.accountId);
      if(!account||account.accountType!=='fx'||account.providerCode!==r.sourceProvider)fail();
      if(r.kind==='collection'){
        const b=rows(models,'importBatches').find(b=>b.id===r.importBatchId);
        if(!b||b.accountId!==r.accountId||b.sourceProvider!==r.sourceProvider||b.sourceType!=='pdf'||b.targetMonth!==r.targetMonth||Date.parse(b.importedAt)>Date.parse(r.createdAt))fail();
        if(r.correctionOfCollectionId!==null){const previous=collections.get(r.correctionOfCollectionId);
          if(!previous||targetKey(previous)!==targetKey(r)||Date.parse(previous.createdAt)>Date.parse(r.createdAt))fail();}
        collections.set(r.id,r);
        for(const txid of r.transactionIds){if(members.has(txid))fail();members.set(txid,r);}
      }
    }
    for(const r of rows(models,'importedTransactions').filter(r=>r.schemaVersion===3)){
      validateRow(r);const c=members.get(r.id),b=rows(models,'importBatches').find(b=>b.id===r.importBatchId),ins=rows(models,'instruments').find(i=>i.id===r.instrumentId);
      if(!c||c.id!==r.collectionId||targetKey(c)!==targetKey(r)||c.importBatchId!==r.importBatchId||!b||b.importedAt!==r.importedAt||ins?.assetType!=='FX')fail();
      const key=JSON.stringify([r.collectionId,r.sourcePage,r.sourceRow]);if(locators.has(key))fail();locators.add(key);
    }
    for(const c of collections.values()){
      if(c.transactionIds.some(id=>!rows(models,'importedTransactions').some(r=>r.schemaVersion===3&&r.id===id))||c.fingerprint!==collectionFingerprint(c,models))fail();
    }
    stateMap(models);
  }
  function resolve(models,query){
    target(query);validateSet(models);const result=stateMap(models).get(targetKey(query));
    return {status:result?.collection?'adopted':'unknown',decision:result?.decision||null,collection:result?.collection||null,
      transactions:result?.collection?result.collection.transactionIds.map(id=>rows(models,'importedTransactions').find(r=>r.id===id)):null};
  }
  const api=Object.freeze({version:'transaction-source-v1',rowFields,collectionFields,decisionFields,rowFingerprint,collectionFingerprint,validateRow,validateRecord,validateEnvelope,validateSet,resolve,targetKey});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TradeScopeTransactionSourceContract=api;
})(typeof globalThis!=='undefined'?globalThis:this);
