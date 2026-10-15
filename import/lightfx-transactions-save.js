(function(root){
  'use strict';
  const node=typeof module!=='undefined'&&module.exports;
  const model=node?require('../assets/data-model-storage.js'):root.TradeScopeDataStorage;
  const contract=node?require('../assets/transaction-source-contract.js'):root.TradeScopeTransactionSourceContract;
  const reader=node?require('../assets/transaction-adoption-view.js'):root.TradeScopeTransactionAdoptionView;
  const history=node?require('../assets/transaction-view.js'):root.TradeScopeTransactionView;
  const common=node?require('../assets/monthly-source-contract.js'):root.TradeScopeMonthlySourceContract;
  const parser=node?require('./traders-parser.js'):root.TradeScopeTradersParser;
  const transaction=node?require('../assets/storage-transaction.js'):root.TradeScopeStorageTransaction;
  const accountId='acc_lightfx_fx',sourceScope='lightfx-fx-trades',importerId='lightfx-executions';
  const copy=v=>JSON.parse(JSON.stringify(v)),rows=(m,e)=>m?.[e]?.records||[];
  const fields=(v,n)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>n.includes(k));
  const fail=()=>{throw Error('LIGHT_TRANSACTION_IMPORT_INVALID');};
  function validateSource(source){
    model.assertJson(source);const p=source?.preview;
    if(!fields(source,['preview','fileHash','fileSize'])||!fields(p,['broker','importerVersion','targetMonth','snapshotAsOf','observationType','valuationCurrency','values','positions','errors','warnings','valid','normalizationVersion','executions','audit','maintenanceState'])||p.broker!=='lightfx'||p.importerVersion!==parser.version
      ||p.normalizationVersion!=='traders-executions-v1'||p.valid!==true||!Array.isArray(p.errors)||p.errors.length
      ||!Array.isArray(p.warnings)||p.warnings.some(w=>w!=='TRADERS_TRANSACTION_SWAP_MISMATCH')
      ||!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(p.targetMonth)||!Array.isArray(p.executions)
      ||!['matched','no-close','incomplete'].includes(p.audit?.realized?.status)
      ||!/^[a-f0-9]{64}$/.test(source.fileHash)||!Number.isSafeInteger(source.fileSize)||source.fileSize<8||source.fileSize>20*1024*1024)fail();
    const end=new Date(Date.UTC(Number(p.targetMonth.slice(0,4)),Number(p.targetMonth.slice(5)),0)).toISOString().slice(0,10);
    if(p.snapshotAsOf!==end||p.observationType!=='officialMonthEnd'||p.valuationCurrency!=='JPY')fail();
    return p;
  }
  // Field mapping only: no source text parsing, lots, monthly totals or position inference.
  function toRecord(execution,{id,collectionId,instrumentId,batch,targetMonth}){
    const r={schemaVersion:3,id,collectionId,accountId,instrumentId,importBatchId:batch.id,sourceProvider:'lightfx',sourceType:'pdf',sourceScope,targetMonth,
      action:execution.action,side:execution.side,quantity:execution.quantity,quantityUnit:execution.quantityUnit,price:execution.executionPrice,
      tradeDate:execution.executionAt?.slice(0,10),executedAt:execution.executionAt,settlementDate:execution.settlementDate,
      sourceOrderId:execution.sourceOrderId,sourceExecutionId:null,sourceOpenOrderRef:execution.sourceOpenOrderRef,
      realizedPnl:execution.realizedPnl,transactionSwap:execution.transactionSwap,fee:execution.fee,currency:'JPY',feeCurrency:'JPY',
      sourcePage:execution.sourcePage,sourceRow:execution.sourceRow,rowFingerprint:'',importedAt:batch.importedAt};
    r.rowFingerprint=contract.rowFingerprint(r);contract.validateRow(r);return r;
  }
  const query=targetMonth=>({accountId,sourceProvider:'lightfx',targetMonth,sourceScope});
  const fingerprint=(models,source)=>common.hash([models,source]);
  const financialFacts=models=>common.hash(Object.fromEntries(['accountSnapshots','holdingSnapshots','monthlyAccountInputs','monthlyAccountStates','monthlySources','rawTransactions','transactionReconciliations'].map(k=>[k,models[k]??null])));
  // Pure/composable plan. Pass prospective canonical changes as models to share one journal.
  // Merely building/committing a candidate plan does NOT change the current collection.
  function buildChanges(base,source,{at,newId,use=false,confirmUpdate=false}={}){
    const p=validateSource(source);model.validateModels(base);
    if(typeof at!=='string'||typeof newId!=='function')fail();
    const changes={},envelope=records=>({schemaVersion:1,records,updatedAt:at}),combined=()=>({...base,...changes});
    const account=rows(base,'accounts').find(a=>a.id===accountId);
    if(account&&(!account.enabled||account.providerCode!=='lightfx'||account.accountType!=='fx'))fail();
    if(!account)changes.accounts=envelope([...rows(base,'accounts'),model.initialAccounts().find(a=>a.id===accountId)]);
    const matches=rows(base,'importBatches').filter(b=>b.accountId===accountId&&b.sourceProvider==='lightfx'&&b.sourceType==='pdf'&&b.sourceFileMetadata?.hash===source.fileHash);
    if(matches.length>1)fail();
    let batch=matches[0];
    if(batch&&(batch.targetMonth!==p.targetMonth||batch.sourceFileMetadata.size!==source.fileSize||batch.snapshotAsOf!==p.snapshotAsOf))fail();
    if(!batch){batch={id:newId('batch'),accountId,sourceProvider:'lightfx',sourceType:'pdf',targetMonth:p.targetMonth,snapshotAsOf:p.snapshotAsOf,
      importedAt:at,importerId,importerVersion:parser.version,sourceFileMetadata:{hash:source.fileHash,size:source.fileSize}};
      changes.importBatches=envelope([...rows(base,'importBatches'),batch]);}
    const instruments=[],ids=new Map();
    for(const pair of new Set(p.executions.map(e=>e.pair))){
      if(parser.pair(pair)!==pair)fail();
      const found=rows(base,'instruments').filter(i=>i.assetType==='FX'&&parser.pair(i.symbol)===pair);
      if(found.length>1||found.some(i=>!i.enabled||i.baseCurrency&&i.baseCurrency!==pair.slice(0,3)||i.quoteCurrency&&i.quoteCurrency!==pair.slice(4)))fail();
      if(found.length)ids.set(pair,found[0].id);else {const id=newId('ins');ids.set(pair,id);instruments.push({id,assetType:'FX',symbol:pair,displayName:pair,baseCurrency:pair.slice(0,3),quoteCurrency:pair.slice(4),enabled:true});}
    }
    if(instruments.length)changes.instruments=envelope([...rows(base,'instruments'),...instruments]);
    const collectionId=newId('tc'),proposed=p.executions.map(e=>toRecord(e,{id:newId('it'),collectionId,instrumentId:ids.get(e.pair),batch,targetMonth:p.targetMonth}));
    const normalizerVersion=p.normalizationVersion+'/lightfx-v3-v1';
    const prior=rows(base,'transactionSources').filter(c=>c.kind==='collection'&&contract.targetKey(c)===contract.targetKey(query(p.targetMonth)));
    const rowFacts=r=>[r.sourcePage,r.sourceRow,r.rowFingerprint];
    const identical=prior.filter(c=>c.importBatchId===batch.id&&c.normalizerVersion===normalizerVersion&&c.coverage==='complete'
      &&common.hash(c.transactionIds.map(id=>rowFacts(rows(base,'importedTransactions').find(r=>r.id===id))))===common.hash(proposed.map(rowFacts)));
    if(identical.length>1)fail();
    const active=reader.resolve(base,query(p.targetMonth));
    if(['stale','conflict','broken-reference'].includes(active.status))fail();
    let collection=identical[0];
    const requiresConfirmation=!!(active.usable&&active.collection.id!==collection?.id||!collection&&prior.some(c=>c.importBatchId===batch.id));
    const existing=!!collection;
    if(!collection){
      collection={schemaVersion:1,id:collectionId,kind:'collection',...query(p.targetMonth),importBatchId:batch.id,normalizerVersion,
        transactionIds:proposed.map(r=>r.id),fingerprint:'',coverage:'complete',correctionOfCollectionId:active.collection?.id??prior.at(-1)?.id??null,createdAt:at};
      if(proposed.length)changes.importedTransactions=envelope([...rows(base,'importedTransactions'),...proposed]);
      collection.fingerprint=contract.collectionFingerprint(collection,combined());
      changes.transactionSources=envelope([...rows(base,'transactionSources'),collection]);
    }
    if(use&&(!requiresConfirmation||confirmUpdate)&&active.collection?.id!==collection.id){
      const all=rows(combined(),'transactionSources'),previous=all.filter(d=>d.kind==='decision'&&contract.targetKey(d)===contract.targetKey(collection)).at(-1);
      changes.transactionSources=envelope([...all,{schemaVersion:1,id:newId('td'),kind:'decision',...query(p.targetMonth),decision:'adopt',collectionId:collection.id,
        collectionFingerprint:collection.fingerprint,previousId:previous?.id??null,confirmedAt:at}]);
    }
    model.validateModels(combined());
    return {changes,models:combined(),collection,existing,requiresConfirmation,targetMonth:p.targetMonth,transactionCount:proposed.length,
      batchReused:matches.length===1,status:requiresConfirmation?'review-required':existing&&active.collection?.id===collection.id?'already-imported':'ready'};
  }
  function createService(adapter,{clock=()=>new Date().toISOString(),cryptoApi=root.crypto}={}){
    const repository=model.createRepository(adapter);let busy=false;
    const newId=prefix=>model.newId(prefix,cryptoApi);
    function read(){if(adapter.getItem(transaction.journalKey)!==null)throw Error('PENDING_TRANSACTION_JOURNAL');return repository.read();}
    function inspect(source){const before=read();let n=0;const plan=buildChanges(before,copy(source),{at:clock(),newId:prefix=>'preview_'+prefix+'_'+(++n)});
      return {status:plan.status,targetMonth:plan.targetMonth,transactionCount:plan.transactionCount,requiresConfirmation:plan.requiresConfirmation,
        existing:plan.existing,fingerprint:fingerprint(before,source)};}
    function save(source,confirmation={}){
      if(busy)return {status:'busy'};busy=true;
      try{
        const input=copy(source),before=read();if(confirmation.fingerprint!==fingerprint(before,input))return {status:'stale'};
        const plan=buildChanges(before,input,{at:clock(),newId,use:true,confirmUpdate:confirmation.confirmUpdate===true});
        if(plan.requiresConfirmation&&confirmation.confirmUpdate!==true)return {status:'review-required',requiresConfirmation:true};
        const expected=reader.resolve(plan.models,query(plan.targetMonth));
        if(!expected.usable||expected.collection.id!==plan.collection.id)fail();
        const unchanged=financialFacts(before);
        const verify=saved=>{const actual=reader.resolve(saved,query(plan.targetMonth)),projected=history.projectV3(saved).records.filter(r=>r.accountId===accountId&&r.targetMonth===plan.targetMonth);
          return actual.usable&&actual.collection.id===plan.collection.id&&actual.transactions.length===plan.transactionCount
            &&projected.length===plan.transactionCount&&financialFacts(saved)===unchanged;};
        if(Object.keys(plan.changes).length)repository.commit(plan.changes,{expectedModels:before,verifyModels:verify});
        else {const latest=read();if(JSON.stringify(latest)!==JSON.stringify(before)||!verify(latest))fail();}
        return {status:'saved',verified:true,unchanged:!Object.keys(plan.changes).length,transactionCount:plan.transactionCount};
      }finally{busy=false;}
    }
    return Object.freeze({inspect,save});
  }
  const api=Object.freeze({validateSource,toRecord,buildChanges,createService,importerId});if(node)module.exports=api;else root.TradeScopeLightTransactionsSave=api;
})(typeof globalThis!=='undefined'?globalThis:this);
