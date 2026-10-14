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
  const policy=resolver.policies[broker],accountId=policy.accountId,provider=policy.provider||broker,repo=model.createRepository(adapter),clock=options.clock||(()=>new Date().toISOString()),cryptoApi=options.cryptoApi||root.crypto;let busy=false;
  function prepare(input){
   if(adapter.getItem(tx.journalKey)!==null)throw Error('未完了のジャーナルがあります。保存を停止しました');
   const source=copy(input),p=validateSource(source,broker),before=repo.read();let legacy;try{legacy=JSON.parse(adapter.getItem('tradingData')||'{}');}catch(_){throw Error('従来入力を確認できません');}
   if(resolver.hasLegacyConflict(legacy,p.targetMonth,broker))return {status:'conflict',reason:'legacy'};
   const account=rows(before,'accounts').find(r=>r.id===accountId);
   if(account&&(!account.enabled||account.providerCode!==provider||account.accountType!=='fx'))return{status:'conflict',reason:'account'};
   if(rows(before,'importBatches').some(r=>r.accountId===accountId&&r.sourceType==='pdf'&&r.sourceProvider===provider&&r.sourceFileMetadata?.hash===source.fileHash))return{status:'already-imported'};
   const state=rows(before,'monthlyAccountStates').find(r=>r.accountId===accountId&&r.targetMonth===p.targetMonth);
   const monthlyInput=rows(before,'monthlyAccountInputs').find(r=>r.accountId===accountId&&r.targetMonth===p.targetMonth);
   if(!state&&!monthlyInput&&rows(before,'accountSnapshots').some(r=>r.accountId===accountId&&r.targetMonth===p.targetMonth))return{status:'conflict',reason:'unadopted'};
   const swap=calendarValue(source.calendarSwap);
   const instruments=[],ids=new Map();
   for(const symbol of new Set(p.positions.map(r=>r.symbol))){const matches=rows(before,'instruments').filter(r=>r.assetType==='FX'&&parser.pair(r.symbol)===symbol);
    if(matches.length>1)return {status:'conflict',reason:'instrument'};
    if(matches.length)ids.set(symbol,matches[0].id);else instruments.push(symbol);}
   const sourceGuard=broker==='lightfx'?sourceService.createService(adapter).inspect():null;
   return {status:state||monthlyInput?'review-required':'ready',reason:state||monthlyInput?'different-report':null,before,source,p,state,input:monthlyInput,account,swap,instruments,ids,sourceGuard};
  }
  const result=p=>({status:p.status,reason:p.reason||null,...(p.sourceGuard?{sourceFingerprint:p.sourceGuard.fingerprint}:{}),...(p.state||p.input?{stateId:p.state?.id||null,inputId:p.input?.id||null,adoptedSnapshotId:p.state?.adoptedAccountSnapshotId||p.input.adoptedAccountSnapshotId,
    calendarSwap:p.input?.adoptedValues.swapPnl??p.state?.swapPnl??p.swap}:{})});
  async function inspect(input){return result(prepare(input));}
  async function save(input,confirmation={}){if(busy)return{status:'busy'};busy=true;try{
   const prepared=prepare(input),correction=prepared.status==='review-required'&&confirmation.stateId===(prepared.state?.id||null)
     &&confirmation.adoptedSnapshotId===(prepared.state?.adoptedAccountSnapshotId||prepared.input?.adoptedAccountSnapshotId)
     &&(!prepared.input||confirmation.inputId===prepared.input.id)&&confirmation.calendarSwap===result(prepared).calendarSwap;
   if(prepared.status!=='ready'&&!correction)return result(prepared);
   if(broker==='lightfx'&&confirmation.sourceFingerprint!==undefined&&confirmation.sourceFingerprint!==prepared.sourceGuard.fingerprint)throw Error('STALE_MONTHLY_SOURCE_DRAFT');
   const {before,source,p,state,input:oldInput,account,swap,ids}=prepared,now=clock(),batchId=model.newId('batch',cryptoApi),snapshotId=model.newId('as',cryptoApi),changes={};
   const envelope=records=>({schemaVersion:1,records,updatedAt:now});
   if(!account)changes.accounts=envelope([...copy(rows(before,'accounts')),model.initialAccounts().find(r=>r.id===accountId)]);
   const newInstruments=prepared.instruments.map(symbol=>{const id=model.newId('ins',cryptoApi);ids.set(symbol,id);return{id,assetType:'FX',symbol,displayName:symbol,baseCurrency:symbol.slice(0,3),quoteCurrency:symbol.slice(4),enabled:true};});
   if(newInstruments.length)changes.instruments=envelope([...copy(rows(before,'instruments')), ...newInstruments]);
   const batch={id:batchId,accountId,sourceType:'pdf',sourceProvider:provider,importedAt:now,targetMonth:p.targetMonth,snapshotAsOf:p.snapshotAsOf,importerId:'traders-monthly',importerVersion:parser.version,sourceFileMetadata:{hash:source.fileHash,size:source.fileSize}};
   const provenance={accountId,targetMonth:p.targetMonth,snapshotAsOf:p.snapshotAsOf,importedAt:now,importBatchId:batchId,sourceMode:'imported',sourceScope:policy.sourceScope,observationType:'officialMonthEnd'};
   const snapshot={schemaVersion:2,id:snapshotId,...provenance,valuationCurrency:'JPY',cashBalance:p.values.cashBalance,netAssetValue:p.values.netAssetValue,unrealizedPnl:p.values.unrealizedPnl,reportedMonthlyRealizedPnl:p.values.realizedPnl,
    accountSpecific:Object.fromEntries(['requiredMargin','orderRequiredMargin','maintenanceRate','transferableAmount','unsettledAmount','reportedAccountEvaluationPnl','monthEndUnsettledSwap','reportedSettledSwapPnl'].map(k=>[k,p.values[k]]))};
   snapshot.accountSpecific.reportedDeposit=p.values.deposit;snapshot.accountSpecific.reportedWithdrawal=p.values.withdrawal;
   const positions=p.positions.map(row=>({schemaVersion:2,id:model.newId('hs',cryptoApi),...provenance,accountSnapshotId:snapshotId,instrumentId:ids.get(row.symbol),quantity:row.quantity,acquisitionPrice:row.acquisitionPrice,marketPrice:row.marketPrice,unrealizedPnl:row.unrealizedPnl,currency:'JPY',
    fxPosition:{orderId:row.orderId,executedAt:row.executedAt,side:row.side,quantityUnit:row.quantityUnit,unsettledSwap:row.unsettledSwap,requiredMargin:row.requiredMargin}}));
   // A corrected PDF changes only PDF source values; calendar source/adoption is independent.
   const oldSnapshot=rows(before,'accountSnapshots').find(r=>r.id===state?.adoptedAccountSnapshotId);
   const calendarSource=oldInput?.sourceValues.swapPnl??state?.sourceValues.swapPnl??swap;
   const original=pdfValues(snapshot,calendarSource),adopted={...original,swapPnl:oldInput?.adoptedValues.swapPnl??(state?model.adoptedValues(state,oldSnapshot).swapPnl:swap)};
   const monthlyInput={schemaVersion:2,id:oldInput?.id||model.newId('mai',cryptoApi),accountId,targetMonth:p.targetMonth,adoptedAccountSnapshotId:snapshotId,
     sourceValues:original,adoptedValues:adopted,fieldSources:fieldSources(),overrideFields:model.adoptionFields.filter(f=>differs(original[f],adopted[f])),overrideUpdatedAt:now,
     pdfObservations:{fee:p.values.fee,other:p.values.other},sourceHistory:oldInput?[...copy(oldInput.sourceHistory),inputRevision(oldInput)]:[]};
   changes.importBatches=envelope([...copy(rows(before,'importBatches')),batch]);changes.accountSnapshots=envelope([...copy(rows(before,'accountSnapshots')),snapshot]);
   changes.holdingSnapshots=envelope([...copy(rows(before,'holdingSnapshots')), ...positions]);
   changes.monthlyAccountInputs=envelope([...copy(rows(before,'monthlyAccountInputs')).filter(r=>r.id!==monthlyInput.id),monthlyInput]);
   if(adopted.swapPnl!==null){const monthly=makeState(monthlyInput,state,oldSnapshot,now);
     changes.monthlyAccountStates=envelope([...copy(rows(before,'monthlyAccountStates')).filter(r=>r.id!==monthly.id),monthly]);}
   if(broker==='lightfx'){
     // A new PDF revision acquires observations only. Native flows/calendar and
     // the existing compatibility adoption remain unchanged until explicit selection.
     if(correction){delete changes.monthlyAccountInputs;delete changes.monthlyAccountStates;}
     let combined={...before,...changes};
     const oldId=oldInput?.adoptedAccountSnapshotId??state?.adoptedAccountSnapshotId;
     const build=options.buildSourceChanges??sourceService.buildChanges;
     for(const id of [oldId,snapshotId].filter(Boolean)){
       const operation=light.candidateOperation(combined,p.targetMonth,id,{required:id===snapshotId});
       if(!operation.sources.length)continue;
       Object.assign(changes,build(combined,operation,{at:now,newId:()=>model.newId('ms',cryptoApi)}).changes);
       combined={...before,...changes};
     }
   }
   repo.commit(changes,{expectedModels:before,...(prepared.sourceGuard?{expectedLegacy:prepared.sourceGuard.legacy}:{}),invalidateTopSummary:true});return{status:'saved',corrected:correction,complete:adopted.swapPnl!==null};
  }finally{busy=false;}}
  function makeState(input,state,snapshot,now){const values=input.adoptedValues;
    return {schemaVersion:4,id:state?.id||model.newId('mas',cryptoApi),accountId,targetMonth:input.targetMonth,confirmedAt:now,adoptedAccountSnapshotId:input.adoptedAccountSnapshotId,
      domesticImportBatchId:null,foreignAccountSnapshotId:null,cashAccountSnapshotId:null,realizedPnl:values.realizedPnl,swapPnl:values.swapPnl,deposit:values.deposit,withdrawal:values.withdrawal,
      adoptedUnrealizedPnl:values.unrealizedPnl,sourceValues:copy(input.sourceValues),overrideFields:[...input.overrideFields],overrideUpdatedAt:now,fieldSources:fieldSources(),
      sourceHistory:state?[...copy(state.sourceHistory),revision(state,snapshot)]:[]};}
  function monthlyInspect(targetMonth){const models=repo.read();let legacy;try{legacy=JSON.parse(adapter.getItem('tradingData')||'{}');}catch(_){throw Error('従来入力を確認できません');}
   const r=resolver.resolve(models,legacy,targetMonth,broker);if(r.source==='conflict'||targetMonth<policy.cutover)throw Error('保存データを確認してください');
   const input=rows(models,'monthlyAccountInputs').find(row=>row.accountId===accountId&&row.targetMonth===targetMonth&&row.schemaVersion===2);
   const adoptedView=values=>broker==='lightfx'&&r.lightScalars?.metrics[1].hasCommon?{...values,unrealizedPnl:r.lightScalars.unrealizedPnl}:values;
   if(input){const snapshot=rows(models,'accountSnapshots').find(row=>row.id===input.adoptedAccountSnapshotId);return{models,input,state:r.state,snapshot,source:copy(input.sourceValues),adopted:adoptedView(copy(input.adoptedValues)),commonUnrealized:broker==='lightfx'&&r.lightScalars?.metrics[1].hasCommon};}
   if(r.source!=='canonical'||!r.completeness.complete)throw Error('この月の月次PDFを取り込んでください');
   return{models,input:null,state:r.state,snapshot:r.snapshot,source:copy(r.state.sourceValues),adopted:adoptedView(model.adoptedValues(r.state,r.snapshot)),commonUnrealized:broker==='lightfx'&&r.lightScalars?.metrics[1].hasCommon};}
  function correct(draft,guard={}){
   const p=monthlyInspect(draft.targetMonth);if(guard.expectedModels&&JSON.stringify(guard.expectedModels)!==JSON.stringify(p.models))throw Error('保存データが変更されています');
   const values={};for(const field of model.adoptionFields){try{values[field]=field==='swapPnl'?calendarValue(draft[field]):csv.decimal(draft[field]);}catch(_){throw Error('入力値を確認してください');}if(values[field]===null)throw Error('空欄の項目を入力してください');}
   if(['deposit','withdrawal'].some(k=>values[k].startsWith('-')))throw Error('入金・出金は0以上を入力してください');
   if(broker==='lightfx'){
     const balance=light.resolve(p.models,draft.targetMonth);
     if(balance.metrics[1].hasCommon&&differs(values.unrealizedPnl,balance.unrealizedPnl))throw Error('評価損益は入力元・採用の補正操作を使用してください');
     // Common overrides belong to their revision; native flow editing must not copy them into Input.
     if(balance.metrics[1].hasCommon)values.unrealizedPnl=p.input?.adoptedValues.unrealizedPnl??model.adoptedValues(p.state,p.snapshot).unrealizedPnl;
   }
   const baseline=broker==='lightfx'&&p.commonUnrealized?(p.input?.adoptedValues??model.adoptedValues(p.state,p.snapshot)):p.adopted;
   if(model.adoptionFields.every(k=>!differs(values[k],baseline[k])))return{status:'unchanged'};
   const now=clock(),original={...p.source,swapPnl:p.source.swapPnl??values.swapPnl};
   const nextInput={schemaVersion:2,id:p.input?.id||model.newId('mai',cryptoApi),accountId,targetMonth:draft.targetMonth,adoptedAccountSnapshotId:p.snapshot.id,
     sourceValues:original,adoptedValues:values,fieldSources:fieldSources(),overrideFields:model.adoptionFields.filter(k=>differs(values[k],original[k])),overrideUpdatedAt:now,
     pdfObservations:p.input?.pdfObservations||{fee:'0',other:'0'},sourceHistory:p.input?[...copy(p.input.sourceHistory),inputRevision(p.input)]:[]};
   const next=makeState(nextInput,p.state,p.snapshot,now);
   repo.commit({monthlyAccountInputs:{schemaVersion:1,records:[...rows(p.models,'monthlyAccountInputs').filter(r=>r.id!==nextInput.id),nextInput],updatedAt:now},
     monthlyAccountStates:{schemaVersion:1,records:[...rows(p.models,'monthlyAccountStates').filter(r=>r.id!==next.id),next],updatedAt:now}},
     {expectedModels:p.models,invalidateTopSummary:true});return{status:'saved'};
  }
  return Object.freeze({read:()=>repo.read(),inspect,save,monthlyInspect,correct});
 }
 const api=Object.freeze({createService,validateSource,calendarValue});if(node)module.exports=api;else root.TradeScopeTradersSave=api;
})(typeof globalThis!=='undefined'?globalThis:this);
