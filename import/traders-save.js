(function(root){
 'use strict';
 const node=typeof module!=='undefined'&&module.exports;
 const model=node?require('../assets/data-model-storage.js'):root.TradeScopeDataStorage;
 const resolver=node?require('../assets/monthly-account-resolver.js'):root.TradeScopeMonthlyResolver;
 const parser=node?require('./traders-parser.js'):root.TradeScopeTradersParser;
 const tx=node?require('../assets/storage-transaction.js'):root.TradeScopeStorageTransaction;
 const csv=node?require('./csv-core.js'):root.TradeScopeCSV;
 const light=node?require('../assets/lightfx-scalar-adoption.js'):root.TradeScopeLightScalarAdoption;
 const sourceService=node?require('../assets/monthly-source-service.js'):root.TradeScopeMonthlySourceService;
 const sourceCore=node?require('../assets/monthly-source-contract.js'):root.TradeScopeMonthlySourceContract;
 const transactionPolicy=node?require('../assets/traders-source-policy.js'):root.TradeScopeTradersSourcePolicy;
 const copy=v=>JSON.parse(JSON.stringify(v)),rows=(m,e)=>m[e]?.records||[];
 const valueNames=['cashBalance','requiredMargin','orderRequiredMargin','reportedAccountEvaluationPnl','netAssetValue','transferableAmount','maintenanceRate','unsettledAmount','unrealizedPnl','monthEndUnsettledSwap','realizedPnl','reportedSettledSwapPnl','deposit','withdrawal','fee','other'];
 const only=(v,names)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>names.includes(k));
 function calendarValue(value){const s=String(value??'').trim();if(!s)return null;if(!/^[+-]?\d+$/.test(s))throw Error('スワップ付与の月間合計を円単位で入力してください');return csv.decimal(s);}
 function validateSource(source,broker){
  model.assertJson(source);const p=source?.preview;
  if(!only(source,['preview','fileHash','fileSize','calendarSwap'])||!only(p,['broker','importerVersion','targetMonth','snapshotAsOf','observationType','valuationCurrency','values','positions','errors','warnings','valid'])
   ||p.broker!==broker||!parser.products[broker]||p.importerVersion!==parser.version||p.valid!==true||p.errors?.length!==0||p.warnings?.length!==0
   ||!/^\d{4}-(0[1-9]|1[0-2])$/.test(p.targetMonth)||p.targetMonth<'2026-09'||p.observationType!=='officialMonthEnd'||p.valuationCurrency!=='JPY'
   ||!only(p.values,valueNames)||valueNames.some(k=>typeof p.values[k]!=='string'||parser.decimal(p.values[k])!==p.values[k])
   ||!Array.isArray(p.positions)||!/^[a-f0-9]{64}$/.test(source.fileHash)||!Number.isSafeInteger(source.fileSize)||source.fileSize<8||source.fileSize>20*1024*1024)throw Error('月次PDFの内容を確認してください');
  const end=new Date(Date.UTC(Number(p.targetMonth.slice(0,4)),Number(p.targetMonth.slice(5)),0)).toISOString().slice(0,10);
  if(p.snapshotAsOf!==end||['deposit','withdrawal','requiredMargin','orderRequiredMargin'].some(k=>p.values[k].startsWith('-'))
    ||['fee','other','unsettledAmount'].some(k=>!parser.equal(p.values[k],'0')))throw Error('月末情報・未対応の金額を確認してください');
  const orders=new Set();
  for(const row of p.positions){if(!only(row,['orderId','executedAt','symbol','side','quantity','quantityUnit','acquisitionPrice','marketPrice','unrealizedPnl','unsettledSwap','requiredMargin'])
   ||!/^\d{1,64}$/.test(row.orderId)||orders.has(row.orderId)||parser.pair(row.symbol)!==row.symbol||!['buy','sell'].includes(row.side)
   ||row.quantityUnit!=='reportedQuantity'||['quantity','acquisitionPrice','marketPrice','unrealizedPnl','unsettledSwap','requiredMargin'].some(k=>typeof row[k]!=='string'||parser.decimal(row[k])!==row[k])
   ||row.quantity.startsWith('-')||parser.equal(row.quantity,'0'))throw Error('建玉情報を確認してください');orders.add(row.orderId);}
  const sum=field=>p.positions.length?csv.sum(p.positions.map(row=>row[field])):'0';
  if(!parser.equal(sum('unrealizedPnl'),p.values.unrealizedPnl)||!parser.equal(sum('unsettledSwap'),p.values.monthEndUnsettledSwap)
    ||!parser.equal(csv.sum([p.values.unrealizedPnl,p.values.monthEndUnsettledSwap]),p.values.reportedAccountEvaluationPnl)
    ||!parser.equal(csv.sum([p.values.cashBalance,p.values.reportedAccountEvaluationPnl]),p.values.netAssetValue))throw Error('PDF内の照合が一致しません');
  return p;
 }
 function revision(state,snapshot){return {adoptedAccountSnapshotId:state.adoptedAccountSnapshotId,sourceValues:copy(state.sourceValues),adoptedValues:model.adoptedValues(state,snapshot),confirmedAt:state.confirmedAt};}
 const fieldSources=()=>Object.fromEntries(model.adoptionFields.map(f=>[f,f==='swapPnl'?'manual-income-calendar-swap-accrual':'imported-monthly-pdf']));
 const pdfValues=(snapshot,swap)=>({realizedPnl:snapshot.reportedMonthlyRealizedPnl,swapPnl:swap,unrealizedPnl:snapshot.unrealizedPnl,deposit:snapshot.accountSpecific.reportedDeposit,withdrawal:snapshot.accountSpecific.reportedWithdrawal});
 const differs=(a,b)=>a===null||b===null?a!==b:!model.equalDecimal(a,b);
 function inputRevision(input){return {adoptedAccountSnapshotId:input.adoptedAccountSnapshotId,sourceValues:copy(input.sourceValues),adoptedValues:copy(input.adoptedValues),overrideUpdatedAt:input.overrideUpdatedAt};}
 function createService(adapter,broker,options={}){
  if(!parser.products[broker])throw Error('未対応の口座です');
  const scalars=light.forBroker(broker),policy=resolver.policies[broker],accountId=policy.accountId,provider=policy.provider||broker,repo=model.createRepository(adapter),clock=options.clock||(()=>new Date().toISOString()),cryptoApi=options.cryptoApi||root.crypto;let busy=false;
  function prepare(input){
   if(adapter.getItem(tx.journalKey)!==null)throw Error('PENDING_TRANSACTION_JOURNAL');
   const source=copy(input),p=validateSource(source,broker),before=repo.read();
   let legacy;try{legacy=JSON.parse(adapter.getItem('tradingData')||'{}');}catch(_){throw Error('INVALID_LEGACY_SOURCE');}
   if(resolver.hasLegacyConflict(legacy,p.targetMonth,broker))return{status:'conflict',reason:'legacy'};
   const account=rows(before,'accounts').find(r=>r.id===accountId);
   if(account&&(!account.enabled||account.providerCode!==provider||account.accountType!=='fx'))return{status:'conflict',reason:'account'};
   if(p.positions.some(position=>rows(before,'instruments').filter(i=>i.assetType==='FX'&&parser.pair(i.symbol)===position.symbol).length>1))return{status:'conflict',reason:'instrument'};
   const state=rows(before,'monthlyAccountStates').find(r=>r.accountId===accountId&&r.targetMonth===p.targetMonth);
   const oldInput=rows(before,'monthlyAccountInputs').find(r=>r.accountId===accountId&&r.targetMonth===p.targetMonth);
   if(state&&oldInput&&state.adoptedAccountSnapshotId!==oldInput.adoptedAccountSnapshotId)throw Error('TRADERS_PROVENANCE_UNRESOLVED');
   const oldSnapshot=rows(before,'accountSnapshots').find(r=>r.id===(oldInput?.adoptedAccountSnapshotId??state?.adoptedAccountSnapshotId));
   const same=rows(before,'importBatches').filter(r=>r.accountId===accountId&&r.sourceType==='pdf'&&r.sourceProvider===provider&&r.sourceFileMetadata?.hash===source.fileHash);
   if(same.length>1)throw Error('AMBIGUOUS_PDF_BATCH');
   const existingBatch=same[0]??null;
   if(existingBatch&&!transactionPolicy.matches(existingBatch,source,p,transactionPolicy.get(broker),parser.version))throw Error('PDF_IDENTITY_MISMATCH');
   const snapshots=rows(before,'accountSnapshots').filter(r=>r.importBatchId===existingBatch?.id);
   if(snapshots.length>1)throw Error('AMBIGUOUS_PDF_SNAPSHOT');
   const existingSnapshot=snapshots[0]??null;
   if(existingBatch&&!existingSnapshot&&!transactionPolicy.isTransactionOnlyBatch(existingBatch))throw Error('PDF_CANONICAL_MISSING');
   if(existingSnapshot&&!sameCanonical(before,existingSnapshot,p))throw Error('PDF_CANONICAL_MISMATCH');
   const current=resolver.resolve(before,legacy,p.targetMonth,broker),balance=scalars.resolve(before,p.targetMonth);
   const unresolved=balance.metrics.some(v=>v.status==='unresolved'&&v.deferred);
   if(balance.scopeConflict||balance.metrics.some(v=>v.blocked&&!(v.status==='unresolved'&&v.deferred))
     ||current.source==='conflict'&&!unresolved)throw Error('TRADERS_PROVENANCE_UNRESOLVED');
   // Native values are explicitly PDF-bound corrections; independent sources are
   // identified by their own common records, never guessed from equal amounts.
   for(const native of [oldInput,state].filter(Boolean))for(const field of model.adoptionFields)
     if(native.fieldSources[field]!==fieldSources()[field])throw Error('TRADERS_PROVENANCE_UNRESOLVED');
   const heads=sourceCore.month(before,accountId,p.targetMonth).filter(v=>v.component==='account'&&v.currency==='JPY');
   if(heads.some(v=>['stale','conflict'].includes(v.status)||v.status==='unresolved'&&!v.deferred))throw Error('TRADERS_PROVENANCE_UNRESOLVED');
   const managed=['marketValue','unrealizedPnl','realizedPnl','deposit','withdrawal'];
   const independent=heads.filter(v=>managed.includes(v.metric)&&(!v.source||v.source.sourceType!=='pdf'
     ||v.source.reference?.sourceScope!==policy.sourceScope));
   const sameRevision=!!existingSnapshot&&oldSnapshot?.id===existingSnapshot.id;
   const changing=!!(oldInput||state||heads.some(v=>managed.includes(v.metric)))&&!sameRevision
     ||independent.length>0
     ||heads.some(v=>managed.includes(v.metric)&&v.source?.reference?.entity==='accountSnapshots'&&v.source.reference.id!==existingSnapshot?.id);
   const enteredSwap=calendarValue(source.calendarSwap);
   const calendarSource=oldInput?oldInput.sourceValues.swapPnl:state?state.sourceValues.swapPnl:enteredSwap;
   const swap=oldInput?oldInput.adoptedValues.swapPnl:state?state.swapPnl:enteredSwap;
   const effectiveCalendar=heads.find(v=>v.metric==='swapPnl');
   if(effectiveCalendar&&effectiveCalendar.source?.sourceType!=='manual')throw Error('TRADERS_CALENDAR_PROVENANCE_UNRESOLVED');
   const sourceGuard=sourceService.createService(adapter).inspect();
   return {status:changing?'review-required':'ready',reason:changing?(independent.length?'current-values':'different-report'):null,
     before,legacy,source,p,state,oldInput,oldSnapshot,existingBatch,existingSnapshot,account,sameRevision,independent,
     calendarSource,swap,effectiveSwap:effectiveCalendar?effectiveCalendar.value:swap,sourceGuard};
  }
  function sameCanonical(models,snapshot,p){
   if(snapshot.schemaVersion!==2||snapshot.accountId!==accountId||snapshot.sourceScope!==policy.sourceScope)return false;
   if(['cashBalance','netAssetValue','unrealizedPnl'].some(k=>differs(snapshot[k],p.values[k]))
     ||differs(snapshot.reportedMonthlyRealizedPnl,p.values.realizedPnl))return false;
   for(const field of ['requiredMargin','orderRequiredMargin','maintenanceRate','transferableAmount','unsettledAmount','reportedAccountEvaluationPnl','monthEndUnsettledSwap','reportedSettledSwapPnl'])
     if(differs(snapshot.accountSpecific[field],p.values[field]))return false;
   if(differs(snapshot.accountSpecific.reportedDeposit,p.values.deposit)||differs(snapshot.accountSpecific.reportedWithdrawal,p.values.withdrawal))return false;
   const actual=rows(models,'holdingSnapshots').filter(h=>h.accountSnapshotId===snapshot.id).map(h=>({
     orderId:h.fxPosition.orderId,executedAt:h.fxPosition.executedAt,symbol:parser.pair(rows(models,'instruments').find(i=>i.id===h.instrumentId)?.symbol),
     side:h.fxPosition.side,quantity:h.quantity,quantityUnit:h.fxPosition.quantityUnit,acquisitionPrice:h.acquisitionPrice,marketPrice:h.marketPrice,
     unrealizedPnl:h.unrealizedPnl,unsettledSwap:h.fxPosition.unsettledSwap,requiredMargin:h.fxPosition.requiredMargin}));
   const sort=a=>[...a].sort((x,y)=>x.orderId.localeCompare(y.orderId));
   return sourceCore.hash(sort(actual))===sourceCore.hash(sort(p.positions));
  }
  function build(prepared,now){
   const {before,p,source,state,oldInput,oldSnapshot,account,calendarSource,swap,sameRevision}=prepared;
   const changes={},envelope=records=>({schemaVersion:1,records,updatedAt:now}),combined=()=>({...before,...changes});
   if(!account)changes.accounts=envelope([...rows(before,'accounts'),model.initialAccounts().find(r=>r.id===accountId)]);
   let batch=prepared.existingBatch,snapshot=prepared.existingSnapshot;
   if(!batch){batch={id:model.newId('batch',cryptoApi),accountId,sourceType:'pdf',sourceProvider:provider,importedAt:now,targetMonth:p.targetMonth,snapshotAsOf:p.snapshotAsOf,importerId:'traders-monthly',importerVersion:parser.version,sourceFileMetadata:{hash:source.fileHash,size:source.fileSize}};
     changes.importBatches=envelope([...rows(before,'importBatches'),batch]);}
   if(!snapshot){
     const instruments=[],ids=new Map();
     for(const symbol of new Set(p.positions.map(r=>r.symbol))){
       const matches=rows(before,'instruments').filter(i=>i.assetType==='FX'&&parser.pair(i.symbol)===symbol);
       if(matches.length>1)throw Error('AMBIGUOUS_INSTRUMENT');
       if(matches.length)ids.set(symbol,matches[0].id);else{
         const id=model.newId('ins',cryptoApi);ids.set(symbol,id);instruments.push({id,assetType:'FX',symbol,displayName:symbol,baseCurrency:symbol.slice(0,3),quoteCurrency:symbol.slice(4),enabled:true});}
     }
     if(instruments.length)changes.instruments=envelope([...rows(before,'instruments'),...instruments]);
     const provenance={accountId,targetMonth:p.targetMonth,snapshotAsOf:p.snapshotAsOf,importedAt:batch.importedAt,importBatchId:batch.id,sourceMode:'imported',sourceScope:policy.sourceScope,observationType:'officialMonthEnd'};
     snapshot={schemaVersion:2,id:model.newId('as',cryptoApi),...provenance,valuationCurrency:'JPY',cashBalance:p.values.cashBalance,netAssetValue:p.values.netAssetValue,
       unrealizedPnl:p.values.unrealizedPnl,reportedMonthlyRealizedPnl:p.values.realizedPnl,
       accountSpecific:Object.fromEntries(['requiredMargin','orderRequiredMargin','maintenanceRate','transferableAmount','unsettledAmount','reportedAccountEvaluationPnl','monthEndUnsettledSwap','reportedSettledSwapPnl'].map(k=>[k,p.values[k]]))};
     snapshot.accountSpecific.reportedDeposit=p.values.deposit;snapshot.accountSpecific.reportedWithdrawal=p.values.withdrawal;
     const positions=p.positions.map(row=>({schemaVersion:2,id:model.newId('hs',cryptoApi),...provenance,accountSnapshotId:snapshot.id,instrumentId:ids.get(row.symbol),quantity:row.quantity,acquisitionPrice:row.acquisitionPrice,marketPrice:row.marketPrice,unrealizedPnl:row.unrealizedPnl,currency:'JPY',
       fxPosition:{orderId:row.orderId,executedAt:row.executedAt,side:row.side,quantityUnit:row.quantityUnit,unsettledSwap:row.unsettledSwap,requiredMargin:row.requiredMargin}}));
     changes.accountSnapshots=envelope([...rows(before,'accountSnapshots'),snapshot]);changes.holdingSnapshots=envelope([...rows(before,'holdingSnapshots'),...positions]);
   }
   const original=pdfValues(snapshot,calendarSource),adopted={...original,...(sameRevision&&oldInput?oldInput.adoptedValues:sameRevision&&state?model.adoptedValues(state,oldSnapshot):{}),swapPnl:swap};
   const inputChanged=!oldInput||oldInput.adoptedAccountSnapshotId!==snapshot.id
     ||model.adoptionFields.some(f=>differs(original[f],oldInput.sourceValues[f])||differs(adopted[f],oldInput.adoptedValues[f]));
   const monthlyInput=inputChanged?{schemaVersion:2,id:oldInput?.id??model.newId('mai',cryptoApi),accountId,targetMonth:p.targetMonth,adoptedAccountSnapshotId:snapshot.id,
     sourceValues:original,adoptedValues:adopted,fieldSources:fieldSources(),overrideFields:model.adoptionFields.filter(f=>differs(original[f],adopted[f])),overrideUpdatedAt:now,
     pdfObservations:{fee:p.values.fee,other:p.values.other},sourceHistory:oldInput?[...oldInput.sourceHistory,inputRevision(oldInput)]:[]}:oldInput;
   if(inputChanged)changes.monthlyAccountInputs=envelope([...rows(before,'monthlyAccountInputs').filter(r=>r.id!==monthlyInput.id),monthlyInput]);
   if(adopted.swapPnl!==null&&(inputChanged||!state)){
     const monthly=makeState(monthlyInput,state,oldSnapshot,now);changes.monthlyAccountStates=envelope([...rows(before,'monthlyAccountStates').filter(r=>r.id!==monthly.id),monthly]);}
   const operation={sources:[],adoptions:[],overrides:[]};
   const candidate=scalars.candidateOperation(combined(),p.targetMonth,snapshot.id,{required:false});
   operation.sources.push(...candidate.sources);
   const all=sourceCore.candidates(combined(),{accountId,targetMonth:p.targetMonth});
   const current=sourceCore.month(before,accountId,p.targetMonth);
   const reimport=!!(oldInput||state||prepared.existingSnapshot||current.length)
     &&(!sameRevision||current.some(v=>['marketValue','unrealizedPnl'].includes(v.metric)));
   const chosen=reimport?scalars.targets.map(t=>all.find(s=>s.metric===t.metric&&s.component==='account'&&s.reference?.entity==='accountSnapshots'&&s.reference.id===snapshot.id)):[];
   if(chosen.some(s=>!s))throw Error('TRADERS_BALANCE_REFERENCE_MISSING');
   for(const metric of ['realizedPnl','deposit','withdrawal']){
     // Native Input/State already owns these aggregate fields. Only replace an
     // explicit common flow head when one exists; do not create a second route.
     if(!current.some(v=>v.component==='account'&&v.currency==='JPY'&&v.metric===metric))continue;
     const id='pdf_flow_'+sourceCore.hash([snapshot.id,metric]).slice(0,40);
     let r=rows(before,'monthlySources').find(s=>s.id===id);
     if(!r){
       const sourceId='traders_flow_'+sourceCore.hash([accountId,policy.sourceScope,metric]).slice(0,32);
       const previous=rows(before,'monthlySources').filter(s=>s.kind==='source'&&s.sourceId===sourceId&&s.targetMonth===p.targetMonth).at(-1);
       r=sourceCore.descriptor({accountId,targetMonth:p.targetMonth,component:'account',asOf:p.snapshotAsOf},metric,null,
         {id,sourceId,sourceType:'pdf',revisionOf:previous?.id??null,createdAt:snapshot.importedAt,confirmedAt:null,
          reference:metric==='realizedPnl'?{entity:'accountSnapshots',id:snapshot.id,field:'reportedMonthlyRealizedPnl',sourceScope:policy.sourceScope}
            :{entity:'monthlyAccountInputs',id:monthlyInput.id,field:'sourceValues.'+metric,sourceScope:policy.sourceScope}});
       operation.sources.push(r);
     }
     chosen.push(r);
   }
   for(const r of chosen){
     const old=current.find(v=>v.component==='account'&&v.metric===r.metric&&v.currency==='JPY');
     if(old?.source?.id===r.id)continue; // Same revision's explicitly saved override stays active.
     let overrideId=null;
     const field=r.metric==='marketValue'?null:r.metric;
     if(sameRevision&&field&&differs(adopted[field],original[field])){
       overrideId=model.newId('ms',cryptoApi);operation.overrides.push({id:overrideId,revisionId:r.id,value:adopted[field]});}
     operation.adoptions.push({revisionId:r.id,overrideId});
   }
   const buildSources=options.buildSourceChanges??sourceService.buildChanges;
   if(operation.sources.length||operation.adoptions.length||operation.overrides.length)
     Object.assign(changes,buildSources(combined(),operation,{at:now,newId:()=>model.newId('ms',cryptoApi)}).changes);
   model.validateModels(combined());
   return {changes,models:combined(),snapshot,monthlyInput};
  }
  const result=p=>({status:p.status,reason:p.reason??null,stateId:p.state?.id??null,inputId:p.oldInput?.id??null,
    adoptedSnapshotId:p.oldSnapshot?.id??null,calendarSwap:p.effectiveSwap??null,replaceCurrent:p.independent?.length>0,
    ...(p.sourceGuard?{sourceFingerprint:p.sourceGuard.fingerprint}:{}),samePDF:!!p.existingSnapshot});
  async function inspect(input){
   const p=prepare(input);if(!p.sourceGuard)return result(p);
   if(p.status==='review-required')return result(p);
   const plan=build(p,clock());return {...result(p),status:Object.keys(plan.changes).length?'ready':'already-imported'};
  }
  async function save(input,confirmation={}){if(busy)return{status:'busy'};busy=true;try{
   const p=prepare(input);if(!p.sourceGuard)return result(p);
   if(confirmation.sourceFingerprint!==undefined&&confirmation.sourceFingerprint!==p.sourceGuard.fingerprint)throw Error('STALE_MONTHLY_SOURCE_DRAFT');
   const reviewed=p.status==='review-required'&&confirmation.stateId===(p.state?.id??null)&&confirmation.inputId===(p.oldInput?.id??null)
     &&confirmation.adoptedSnapshotId===(p.oldSnapshot?.id??null)&&confirmation.calendarSwap===(p.effectiveSwap??null)
     &&(!p.independent.length||confirmation.replaceCurrent===true);
   if(p.status==='review-required'&&!reviewed)return result(p);
   const plan=build(p,clock()),same=!Object.keys(plan.changes).length,legacy=JSON.parse(adapter.getItem('tradingData')||'{}');
   const expected=resolver.resolve(plan.models,legacy,p.p.targetMonth,broker),beforeTransactions=sourceCore.hash(['importedTransactions','transactionSources','transactionReconciliations','rawTransactions'].map(k=>p.before[k]));
   const verify=saved=>{
     const actual=resolver.resolve(saved,legacy,p.p.targetMonth,broker),balance=scalars.resolve(saved,p.p.targetMonth);
     return actual.source===expected.source&&['observedAsset','unrealizedPnl','realizedPnl','deposit','withdrawal'].every(k=>!differs(actual[k],expected[k]))
       &&!differs(actual.swapPnl,p.effectiveSwap)&&balance.metrics.every(r=>r.source?.reference?.id===plan.snapshot.id)
       &&sourceCore.hash(['importedTransactions','transactionSources','transactionReconciliations','rawTransactions'].map(k=>saved[k]))===beforeTransactions
       &&(options.verifySaved?options.verifySaved(saved)!==false:true);
   };
   if(same){const saved=repo.read();if(JSON.stringify(saved)!==JSON.stringify(p.before)||!verify(saved))throw Error('TRADERS_VERIFY_FAILED');}
   else repo.commit(plan.changes,{expectedModels:p.before,expectedLegacy:p.sourceGuard.legacy,
     expectedManual:adapter.getItem('tradeScopeTradeHistoryV1'),invalidateTopSummary:true,verifyModels:verify});
   return {status:same?'already-imported':'saved',verified:true,unchanged:same,corrected:reviewed,complete:expected.completeness.complete};
  }finally{busy=false;}}
  function makeState(input,state,snapshot,now){const values=input.adoptedValues;
    return {schemaVersion:4,id:state?.id||model.newId('mas',cryptoApi),accountId,targetMonth:input.targetMonth,confirmedAt:now,adoptedAccountSnapshotId:input.adoptedAccountSnapshotId,
      domesticImportBatchId:null,foreignAccountSnapshotId:null,cashAccountSnapshotId:null,realizedPnl:values.realizedPnl,swapPnl:values.swapPnl,deposit:values.deposit,withdrawal:values.withdrawal,
      adoptedUnrealizedPnl:values.unrealizedPnl,sourceValues:copy(input.sourceValues),overrideFields:[...input.overrideFields],overrideUpdatedAt:now,fieldSources:fieldSources(),
      sourceHistory:state?[...copy(state.sourceHistory),revision(state,snapshot)]:[]};}
  function monthlyInspect(targetMonth){const models=repo.read();let legacy;try{legacy=JSON.parse(adapter.getItem('tradingData')||'{}');}catch(_){throw Error('従来入力を確認できません');}
   const r=resolver.resolve(models,legacy,targetMonth,broker);if(r.source==='conflict'||targetMonth<policy.cutover)throw Error('保存データを確認してください');
   const input=rows(models,'monthlyAccountInputs').find(row=>row.accountId===accountId&&row.targetMonth===targetMonth&&row.schemaVersion===2);
   const adoptedView=values=>{
     const next={...values};if(r.tradersScalars?.metrics[1].hasCommon)next.unrealizedPnl=r.tradersScalars.unrealizedPnl;
     for(const head of sourceCore.month(models,accountId,targetMonth))
       if(['realizedPnl','deposit','withdrawal'].includes(head.metric)&&head.component==='account'&&head.currency==='JPY'
         &&head.source?.sourceType==='pdf'&&head.source.reference?.sourceScope===policy.sourceScope)next[head.metric]=head.value;
     return next;
   };
   if(input){const snapshot=rows(models,'accountSnapshots').find(row=>row.id===input.adoptedAccountSnapshotId);return{models,input,state:r.state,snapshot,source:copy(input.sourceValues),adopted:adoptedView(copy(input.adoptedValues)),commonUnrealized:r.tradersScalars?.metrics[1].hasCommon};}
   if(r.source!=='canonical'||!r.completeness.complete)throw Error('この月の月次PDFを取り込んでください');
   return{models,input:null,state:r.state,snapshot:r.snapshot,source:copy(r.state.sourceValues),adopted:adoptedView(model.adoptedValues(r.state,r.snapshot)),commonUnrealized:r.tradersScalars?.metrics[1].hasCommon};}
  function correct(draft,guard={}){
   const p=monthlyInspect(draft.targetMonth);if(guard.expectedModels&&JSON.stringify(guard.expectedModels)!==JSON.stringify(p.models))throw Error('保存データが変更されています');
   const values={};for(const field of model.adoptionFields){try{values[field]=field==='swapPnl'?calendarValue(draft[field]):csv.decimal(draft[field]);}catch(_){throw Error('入力値を確認してください');}if(values[field]===null)throw Error('空欄の項目を入力してください');}
   if(['deposit','withdrawal'].some(k=>values[k].startsWith('-')))throw Error('入金・出金は0以上を入力してください');
   {
     const balance=scalars.resolve(p.models,draft.targetMonth);
     if(balance.metrics[1].hasCommon&&differs(values.unrealizedPnl,balance.unrealizedPnl))throw Error('評価損益は入力元・採用の補正操作を使用してください');
     // Common overrides belong to their revision; native flow editing must not copy them into Input.
     if(balance.metrics[1].hasCommon)values.unrealizedPnl=p.input?.adoptedValues.unrealizedPnl??model.adoptedValues(p.state,p.snapshot).unrealizedPnl;
   }
   const baseline={...p.adopted};if(p.commonUnrealized)baseline.unrealizedPnl=p.input?.adoptedValues.unrealizedPnl??model.adoptedValues(p.state,p.snapshot).unrealizedPnl;
   if(model.adoptionFields.every(k=>!differs(values[k],baseline[k])))return{status:'unchanged'};
   const now=clock(),original={...p.source,swapPnl:p.source.swapPnl??values.swapPnl};
   const nextInput={schemaVersion:2,id:p.input?.id||model.newId('mai',cryptoApi),accountId,targetMonth:draft.targetMonth,adoptedAccountSnapshotId:p.snapshot.id,
     sourceValues:original,adoptedValues:values,fieldSources:fieldSources(),overrideFields:model.adoptionFields.filter(k=>differs(values[k],original[k])),overrideUpdatedAt:now,
     pdfObservations:p.input?.pdfObservations||{fee:'0',other:'0'},sourceHistory:p.input?[...copy(p.input.sourceHistory),inputRevision(p.input)]:[]};
   const next=makeState(nextInput,p.state,p.snapshot,now);
   const changes={monthlyAccountInputs:{schemaVersion:1,records:[...rows(p.models,'monthlyAccountInputs').filter(r=>r.id!==nextInput.id),nextInput],updatedAt:now},
     monthlyAccountStates:{schemaVersion:1,records:[...rows(p.models,'monthlyAccountStates').filter(r=>r.id!==next.id),next],updatedAt:now}};
   const operation={overrides:[],adoptions:[]};
   for(const head of sourceCore.month(p.models,accountId,draft.targetMonth)){
     if(!['realizedPnl','deposit','withdrawal'].includes(head.metric)||head.component!=='account'||head.currency!=='JPY'
       ||head.source?.sourceType!=='pdf'||head.source.reference?.sourceScope!==policy.sourceScope||!differs(values[head.metric],head.value))continue;
     const id=model.newId('ms',cryptoApi);operation.overrides.push({id,revisionId:head.source.id,value:values[head.metric]});
     operation.adoptions.push({revisionId:head.source.id,overrideId:id});
   }
   if(operation.overrides.length)Object.assign(changes,sourceService.buildChanges({...p.models,...changes},operation,{at:now,newId:()=>model.newId('ms',cryptoApi)}).changes);
   repo.commit(changes,
     {expectedModels:p.models,invalidateTopSummary:true});return{status:'saved'};
  }
  return Object.freeze({read:()=>repo.read(),inspect,save,monthlyInspect,correct});
 }
 const api=Object.freeze({createService,validateSource,calendarValue});if(node)module.exports=api;else root.TradeScopeTradersSave=api;
})(typeof globalThis!=='undefined'?globalThis:this);
