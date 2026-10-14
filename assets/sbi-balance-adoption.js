(function(root){
  'use strict';
  const node=typeof module!=='undefined'&&module.exports;
  const model=node?require('./data-model-storage.js'):root.TradeScopeDataStorage;
  const core=node?require('./monthly-source-contract.js'):root.TradeScopeMonthlySourceContract;
  const csv=node?require('../import/csv-core.js'):root.TradeScopeCSV;
  const accountId='acc_sbi_sec',cutover='2026-09',rows=(m,e)=>m?.[e]?.records||[];
  const targets=Object.freeze([
    {component:'domestic',metric:'marketValue',label:'国内証券 評価額'},
    {component:'domestic',metric:'unrealizedPnl',label:'国内証券 評価損益'},
    {component:'foreign',metric:'marketValue',label:'外国証券 円評価額'},
    {component:'foreign',metric:'unrealizedPnl',label:'外国証券 円評価損益'},
    {component:'cash',metric:'cashBalance',label:'JPY現金残高'}
  ]);
  const strictSum=values=>values.length&&values.every(v=>typeof v==='string')?csv.sum(values):null;
  const matches=(a,b)=>a.component===b.component&&a.metric===b.metric&&a.currency==='JPY';
  function supportsSource(source,models){
    if(source.accountId!==accountId||!targets.some(t=>matches(source,t)))return false;
    if(!source.reference)return source.sourceType==='manual';
    const ref=source.reference;
    if(source.component==='domestic'){
      const batch=rows(models,'importBatches').find(b=>b.id===ref.id);
      return ref.entity==='importBatches'&&ref.sourceScope==='sbi-domestic-holdings'&&ref.field==='holdings.'+source.metric
        &&source.sourceType==='csv'&&batch?.sourceProvider==='sbi';
    }
    return ref.entity==='accountSnapshots'&&source.sourceType==='manual'
      &&ref.sourceScope===(source.component==='foreign'?'sbi-foreign-securities':'sbi-cash')
      &&ref.field===(source.component==='foreign'&&source.metric==='marketValue'?'assetValue':source.metric);
  }
  function domesticCandidates(models,targetMonth){
    const hs=rows(models,'holdingSnapshots').filter(h=>h.accountId===accountId&&h.targetMonth===targetMonth&&h.sourceMode==='imported'&&h.sourceScope==='sbi-domestic-holdings');
    return rows(models,'importBatches').filter(b=>b.accountId===accountId&&b.targetMonth===targetMonth&&b.sourceProvider==='sbi'&&b.sourceType==='csv'&&hs.some(h=>h.importBatchId===b.id)).map(batch=>{
      const holdings=hs.filter(h=>h.importBatchId===batch.id),jpy=holdings.every(h=>h.currency==null||h.currency==='JPY');
      return {batch,holdings,marketValue:jpy?strictSum(holdings.map(h=>h.marketValue??null)):null,unrealizedPnl:jpy?strictSum(holdings.map(h=>h.unrealizedPnl??null)):null};
    });
  }
  function resolve(models,targetMonth,{validate=true}={}){
    if(validate)model.validateModels(models);
    if(!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(targetMonth))throw Error('INVALID_SBI_BALANCE_MONTH');
    if(targetMonth<cutover)return null;
    const input=rows(models,'monthlyAccountInputs').find(r=>r.accountId===accountId&&r.targetMonth===targetMonth);
    const state=rows(models,'monthlyAccountStates').find(r=>r.accountId===accountId&&r.targetMonth===targetMonth);
    const domestic=domesticCandidates(models,targetMonth),selection=state??input;
    const chosenDomestic=selection?domestic.find(c=>c.batch.id===selection.domesticImportBatchId):domestic.length===1?domestic[0]:null;
    const all=core.candidates(models,{accountId,targetMonth}),heads=core.heads(rows(models,'monthlySources')).filter(r=>r.accountId===accountId&&r.targetMonth===targetMonth);
    function native(target){
      if(target.component==='domestic'){
        const candidate=chosenDomestic;
        const source=candidate?all.find(c=>matches(c,target)&&c.reference?.entity==='importBatches'&&c.reference.id===candidate.batch.id):null;
        const compatible=!!input&&!!candidate&&input.domesticImportBatchId===candidate.batch.id&&candidate.marketValue!==null&&candidate.unrealizedPnl!==null
          &&model.equalDecimal(input.sourceValues.marketValue,candidate.marketValue)&&model.equalDecimal(input.sourceValues.unrealizedPnl,candidate.unrealizedPnl);
        const value=candidate?(compatible?input.adoptedValues[target.metric]:candidate[target.metric]):null;
        return {source,value,status:!candidate&&domestic.length>1?'conflict':source?'compatibility':'missing'};
      }
      const cash=target.component==='cash',scope=cash?'sbi-cash':'sbi-foreign-securities',field=cash?'cashBalance':target.metric==='marketValue'?'assetValue':'unrealizedPnl';
      const candidates=rows(models,'accountSnapshots').filter(r=>r.accountId===accountId&&r.targetMonth===targetMonth&&r.sourceMode==='manual'&&r.sourceScope===scope&&r.valuationCurrency==='JPY');
      const id=selection?.[cash?'cashAccountSnapshotId':'foreignAccountSnapshotId'];
      const snapshot=selection?candidates.find(r=>r.id===id):candidates.length===1?candidates[0]:null;
      return {source:snapshot?all.find(c=>matches(c,target)&&c.reference?.entity==='accountSnapshots'&&c.reference.id===snapshot.id):null,
        value:snapshot?.[field]??null,status:!selection&&candidates.length>1?'conflict':snapshot?'compatibility':'missing'};
    }
    const metrics=targets.map(t=>{
      const query=core.descriptor({accountId,targetMonth,component:t.component,asOf:null},t.metric,null);
      const decisions=heads.filter(h=>matches(h,t));let resolved=decisions.length?core.resolve(models,query):native(t);
      if(resolved.source&&!supportsSource(resolved.source,models))resolved={...resolved,status:'conflict',value:null};
      const source=resolved.source??null,value=resolved.value??null;
      const rawValue=source?core.sourceValue(source,models):null;
      return {...t,currency:'JPY',query,...resolved,value,rawValue,source,hasCommon:decisions.length>0,
        hasOverride:!!source&&(rawValue===null||value===null?rawValue!==value:!model.equalDecimal(rawValue,value)),sourceMonth:source?.targetMonth??null,snapshotAsOf:source?.asOf??null,
        id:source?.reference?.id??source?.id??null,blocked:['stale','conflict','unresolved'].includes(resolved.status)};
    });
    // Whole-account observations are exclusive, including a missing/stale whole decision.
    const wholeHeads=heads.filter(h=>h.component==='account'&&h.metric==='marketValue'&&h.currency==='JPY');
    const whole=wholeHeads.length?core.resolve(models,wholeHeads[0]):null;
    for(const metric of metrics)metric.excludedByWhole=!!whole&&metric.metric!=='unrealizedPnl';
    const components=whole?[{key:'account',name:'口座観測',asset:whole.value??null,unrealized:null,id:whole.source?.id??null,
      snapshotAsOf:whole.source?.asOf??null,source:{revisionId:whole.source?.id??null,adoptionId:whole.adoption?.id??null,sourceType:whole.source?.sourceType??null},
      blocked:['stale','conflict','unresolved'].includes(whole.status)}]:['domestic','foreign','cash'].map(key=>{
      const asset=metrics.find(r=>r.component===key&&r.metric!=='unrealizedPnl'),pnl=metrics.find(r=>r.component===key&&r.metric==='unrealizedPnl');
      return {key,name:{domestic:'国内証券',foreign:'外国証券',cash:'現金・預り金'}[key],asset:asset.value,unrealized:pnl?.value??null,id:asset.id,
        snapshotAsOf:asset.snapshotAsOf,blocked:asset.blocked,status:asset.status,
        source:{recordId:asset.source?.reference?.entity==='accountSnapshots'?asset.id:null,importBatchId:asset.source?.reference?.entity==='importBatches'?asset.id:null,
          revisionId:asset.source?.id??null,adoptionId:asset.adoption?.id??null,sourceType:asset.source?.sourceType??null,sourceScope:asset.source?.reference?.sourceScope??null}};
    });
    const compatibilityConflict=!heads.length&&metrics.some(r=>r.blocked);
    return {accountId,targetMonth,metrics,components,whole,compatibilityConflict,nativeDomestic:chosenDomestic,hasCommon:metrics.some(r=>r.hasCommon)||!!whole,
      hasData:metrics.some(r=>r.source||r.hasCommon)||!!whole,blocked:components.some(r=>r.blocked),
      observedAsset:strictSum(components.map(r=>r.asset)),unrealizedPnl:strictSum(metrics.filter(r=>r.metric==='unrealizedPnl').map(r=>r.value))};
  }
  function candidates(models,targetMonth){return core.candidates(models,{accountId,targetMonth}).filter(c=>targets.some(t=>matches(c,t)));}
  function candidateOperation(models,targetMonth,{importBatchId,snapshotIds=[]}={}){
    const all=candidates(models,targetMonth).filter(c=>!c.registered&&(
      c.reference?.entity==='importBatches'&&c.reference.id===importBatchId||c.reference?.entity==='accountSnapshots'&&snapshotIds.includes(c.reference.id)));
    if(importBatchId&&all.filter(c=>c.component==='domestic').length!==2)throw Error('SBI_CANDIDATE_PLAN_INVALID');
    return {sources:all};
  }
  const api=Object.freeze({accountId,cutover,targets,resolve,domesticCandidates,candidates,candidateOperation,supportsSource});if(node)module.exports=api;else root.TradeScopeSbiBalanceAdoption=api;
})(typeof globalThis!=='undefined'?globalThis:this);
