(function(root){
  'use strict';
  const node=typeof module!=='undefined'&&module.exports;
  const policy=node?require('./monthly-required-policy.js'):root.TradeScopeMonthlyRequiredPolicy;
  const common=node?require('./monthly-source-contract.js'):root.TradeScopeMonthlySourceContract;
  const resolver=node?require('./monthly-account-resolver.js'):root.TradeScopeMonthlyResolver;
  const sbi=node?require('./sbi-balance-adoption.js'):root.TradeScopeSbiBalanceAdoption;
  const crypto=node?require('./sbivc-balance-adoption.js'):root.TradeScopeSBIVCBalanceAdoption;
  const version='monthly-progress-v1',rows=(m,e)=>m?.[e]?.records||[];
  const decimal=v=>v!==null&&v!==undefined&&(typeof v==='number'||typeof v==='string'&&v.trim()!=='')&&/^-?\d+(?:\.\d+)?$/.test(String(v));
  const zero=v=>decimal(v)&&/^-?0+(?:\.0+)?$/.test(String(v));
  const asOf=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(v)&&Number.isFinite(Date.parse(v))
    &&(v.length!==10||new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v);
  const bad=new Set(['conflict','stale','invalid-reference','unresolved']);
  const oldField={marketValue:'netAssets',cashBalance:'monthEndBalance',realizedPnl:'realizedPnL',swapPnl:'swapPnL',unrealizedPnl:'unrealizedPnL',deposit:'deposit',withdrawal:'withdrawal'};
  // Read-only diagnostics. Invalid facts never become an alternative source selection.
  function decision(models,accountId,targetMonth,t){
    const all=rows(models,'monthlySources'),heads=common.heads(all).filter(r=>r.accountId===accountId&&r.targetMonth===targetMonth&&r.component===t.component&&r.metric===t.metric&&r.currency==='JPY');
    if(!heads.length)return null;
    if(heads.length!==1)return {status:'conflict',value:null};
    const head=heads[0],visited=new Set();let chosen=head;
    try{common.validateRecord(head);}catch(_){return {status:'conflict',value:null};}
    while(chosen?.decision==='defer'&&chosen.previousId!==null){
      if(visited.has(chosen.id))return {status:'conflict',value:null};visited.add(chosen.id);
      chosen=all.find(r=>r.id===chosen.previousId);
      if(!chosen)return {status:'invalid-reference',value:null,deferred:true};
      if(chosen.kind!=='adoption'||common.targetKey(chosen)!==common.targetKey(head))return {status:'conflict',value:null};
      try{common.validateRecord(chosen);}catch(_){return {status:'conflict',value:null};}
    }
    if(chosen?.decision==='adopt'){
      const source=all.find(r=>r.id===chosen.revisionId&&r.kind==='source');
      if(!source||chosen.overrideId!==null&&!all.some(r=>r.kind==='override'&&r.id===chosen.overrideId))return {status:'invalid-reference',value:null};
      if(source.reference&&!rows(models,source.reference.entity).some(r=>r.id===source.reference.id))return {status:'invalid-reference',value:null};
      try{common.validateRecord(source);if(source.reference)common.sourceValue(source,models);}catch(_){return {status:'invalid-reference',value:null};}
      const override=all.find(r=>r.kind==='override'&&r.id===chosen.overrideId);
      if(override){
        try{common.validateRecord(override);}catch(_){return {status:'invalid-reference',value:null};}
        if(override.revisionId!==source.id||override.revisionFingerprint!==chosen.revisionFingerprint)return {status:'invalid-reference',value:null};
      }
    }
    try{return common.resolve(models,head);}catch(_){return {status:'conflict',value:null};}
  }
  function create({models={},tradingData={}}={}){
    function account(key,targetMonth,{scope='period',currentBalance=null}={}){
      if(!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(targetMonth))throw Error('INVALID_PROGRESS_MONTH');
      const p=policy.get(key,scope),[year,month]=targetMonth.split('-').map(Number),old=tradingData?.[year]?.[month]?.[key]||{};
      const inputs=rows(models,'monthlyAccountInputs').filter(r=>r.accountId===p.accountId&&r.targetMonth===targetMonth);
      const states=rows(models,'monthlyAccountStates').filter(r=>r.accountId===p.accountId&&r.targetMonth===targetMonth);
      const heads=common.heads(rows(models,'monthlySources')).filter(r=>r.accountId===p.accountId&&r.targetMonth===targetMonth);
      let candidates=[],candidateReadFailed=false;
      try{candidates=common.candidates(models,{accountId:p.accountId,targetMonth});}catch(_){candidateReadFailed=true;}
      const sourceRecords=rows(models,'monthlySources').filter(r=>r.kind==='source'&&r.accountId===p.accountId&&r.targetMonth===targetMonth);
      const physical=rows(models,'importBatches').filter(r=>r.accountId===p.accountId&&r.targetMonth===targetMonth);
      const legacy=key==='smbc'&&!heads.length||key==='sbivc'&&!heads.length&&!inputs.length||!!resolver.policies[key]&&targetMonth<resolver.policies[key].cutover;
      const legacyFields=key==='smbc'?['monthEndBalance']:key==='sbi'||key==='sbivc'?['realizedPnL','deposit','withdrawal']:['realizedPnL','swapPnL','unrealizedPnL','deposit','withdrawal'];
      const legacyDataAvailable=Object.values(old).some(v=>decimal(v))||old.__saved===true;
      const calculationCompatible=!!(legacy&&(old.__saved===true||legacyFields.some(f=>decimal(old[f])&&(Number(old[f])!==0||tradingData?.[year]?.[month]?.__saved===true))
        ||p.calendarSwap&&Array.isArray(old.unrealizedLegs)&&old.unrealizedLegs.some(v=>decimal(v)&&(Number(v)!==0||tradingData?.[year]?.[month]?.__saved===true))));
      let native=null,balance=null,nativeError=null;
      if(!legacy){
        try{native=resolver.resolve(models,tradingData,targetMonth,key);}catch(_){nativeError='conflict';}
        try{if(key==='sbi')balance=sbi.resolve(models,targetMonth,{validate:false});else if(key==='sbivc')balance=crypto.resolve(models,targetMonth);}catch(_){nativeError='invalid-reference';}
      }
      const input=inputs[0],state=states[0],snapshotId=state?.adoptedAccountSnapshotId??input?.adoptedAccountSnapshotId;
      const snapshot=rows(models,'accountSnapshots').find(r=>r.id===snapshotId),batch=rows(models,'importBatches').find(r=>r.id===snapshot?.importBatchId);
      const fxPolicy=resolver.policies[key]?.adapter==='official-account'?resolver.policies[key]:null;
      const monthEnd=new Date(Date.UTC(year,month,0)).toISOString().slice(0,10);
      const validFx=fxPolicy&&snapshot&&batch&&snapshot.accountId===p.accountId&&snapshot.targetMonth===targetMonth&&snapshot.sourceScope===fxPolicy.sourceScope
        &&snapshot.sourceMode===fxPolicy.sourceMode&&snapshot.observationType===fxPolicy.observationType&&snapshot.valuationCurrency==='JPY'
        &&snapshot.snapshotAsOf===monthEnd&&batch.snapshotAsOf===snapshot.snapshotAsOf&&snapshot.importedAt===batch.importedAt
        &&batch.sourceType==='pdf'&&batch.accountId===p.accountId&&batch.targetMonth===targetMonth&&batch.sourceProvider===(fxPolicy.provider??key);
      const nativeReference=inputs.length>1||states.length>1?'conflict':snapshotId&&!snapshot?'invalid-reference':snapshot&&!batch?'invalid-reference':fxPolicy&&snapshot&&!validFx?'conflict':null;
      function compatibility(t){
        if(legacy){
          const v=old[oldField[t.metric]],known=decimal(v)&&(!zero(v)||old.__saved===true);
          return {status:'legacy-compatibility',value:known?String(v):null,sourceType:'manual',asOf:null,legacy:true,zeroEvidence:zero(v)?old.__saved===true?'account-saved':'unknown':null};
        }
        if(nativeError||nativeReference||native?.source==='conflict')return {status:nativeReference??nativeError??'conflict',value:null};
        if(key==='sbi'&&t.component!=='account'){
          const ref=t.component==='domestic'?(state??input)?.domesticImportBatchId:(state??input)?.[t.component==='foreign'?'foreignAccountSnapshotId':'cashAccountSnapshotId'];
          if(ref&&!rows(models,t.component==='domestic'?'importBatches':'accountSnapshots').some(r=>r.id===ref))return {status:'invalid-reference',value:null};
          const m=balance?.metrics.find(r=>r.component===t.component&&r.metric===t.metric);
          return {...m,status:m?.status??'missing',value:m?.excludedByWhole?null:m?.value??null,asOf:m?.snapshotAsOf??null};
        }
        if(key==='sbivc'){
          const spot=t.metric==='holdings',prov=spot?balance?.holdingSource:balance?.cashSource;
          return {status:spot?balance?.spotStatus??'missing':balance?.cashStatus??'missing',sourceType:prov?.sourceType??null,asOf:prov?.snapshotAsOf??null,
            source:candidates.find(c=>c.component===t.component&&c.metric===t.metric&&c.reference?.id===(spot?prov?.importBatchId:prov?.recordId)),
            value:spot?balance?.holdingSetKnown?balance.holdings.map(h=>({instrumentId:h.instrumentId,...h.adopted})):null:balance?.adopted.cashBalance??null};
        }
        if(t.metric==='periodReference')return {status:native?.completeness?.monthly===true?'compatibility':'missing',value:native?.completeness?.monthly===true?true:null};
        if(key==='sbi')return {status:input||state?'compatibility':'missing',value:native?.[t.metric]??input?.[t.metric]??null,sourceType:'manual'};
        if(!validFx)return {status:'missing',value:null};
        const adopted=input?.adoptedValues;
        const value=t.metric==='marketValue'?snapshot.netAssetValue:t.metric==='unrealizedPnl'?adopted&&Object.hasOwn(adopted,t.metric)?adopted[t.metric]:native?.unrealizedPnl??snapshot.unrealizedPnl
          :adopted?.[t.metric]??state?.[t.metric]??null;
        const source=candidates.find(c=>c.component===t.component&&c.metric===t.metric&&[snapshot.id,input?.id,state?.id].includes(c.reference?.id));
        return {status:'compatibility',value,sourceType:t.metric==='swapPnl'&&p.calendarSwap?'manual':'pdf',asOf:snapshot.snapshotAsOf,
          source,
          calendarSwap:!p.calendarSwap||input?.fieldSources?.swapPnl==='manual-income-calendar-swap-accrual'||state?.fieldSources?.swapPnl==='manual-income-calendar-swap-accrual'};
      }
      function evaluate(t){
        const c=t.metric!=='periodReference'?decision(models,p.accountId,targetMonth,t):null,isLegacyMetric=legacy&&!c;
        let r=c??compatibility(t);
        // Common diagnostics refine invalid/stale reasons, but broker balance values
        // must still pass the SAME facade as the ordinary financial consumers.
        if(c&&!bad.has(c.status)&&!legacy&&(key==='sbivc'||key==='sbi'&&t.component!=='account')){
          const adopted=compatibility(t);
          r={...c,status:adopted.status,value:adopted.value??null};
        }
        let value=r.value??null,status=r.status??'missing';
        const date=r.source?.asOf??r.asOf??null,sourceType=r.source?.sourceType??r.sourceType??null;
        let known=t.metric==='periodReference'?value===true:t.metric==='holdings'?Array.isArray(value):decimal(value);
        let reason=null;
        if(t.metric==='holdings'&&known){
          known=value.every(h=>decimal(h.quantity)&&Number(h.quantity)>=0&&(zero(h.quantity)||decimal(h.marketValue)));
          if(!known)reason='unknown-holding-quantity-or-valuation';
        }
        if(!isLegacyMetric&&(p.balance.some(b=>b.id===t.id)||t.metric==='unrealizedPnl')&&known&&!asOf(date)){known=false;reason='missing-as-of';}
        if(!isLegacyMetric&&fxPolicy&&t.metric==='unrealizedPnl'&&known&&date.slice(0,10)!==monthEnd){known=false;reason='month-end-observation-required';}
        if(p.calendarSwap&&t.metric==='swapPnl'&&!isLegacyMetric&&known&&!(c?sourceType==='manual':r.calendarSwap)){known=false;reason='calendar-swap-required';}
        if(bad.has(status))known=false;
        if(isLegacyMetric&&t.component!=='account'&&key!=='smbc'){known=false;value=null;reason='legacy-components-not-decomposed';}
        const state=bad.has(status)?status:known?t.metric==='holdings'&&value.length===0?'explicit-empty':zero(value)?'explicit-zero':'known':reason?'unavailable':'missing';
        return {...t,value,state,satisfied:known,reason,sourceType,sourceMonth:known?targetMonth:r.sourceMonth??null,asOf:date,
          adoptionStatus:status,deferred:r.deferred===true,revisionId:r.source?.id??null,overrideId:r.override?.id??null,
          ...(r.zeroEvidence?{zeroEvidence:r.zeroEvidence}:{})};
      }
      const balanceMetrics=p.balance.map(evaluate),periodMetrics=p.period.map(evaluate);
      const balanceRequirementsSatisfied=balanceMetrics.every(m=>m.satisfied);
      const periodRequirementsSatisfied=p.periodSupported&&periodMetrics.length>0&&periodMetrics.every(m=>m.satisfied);
      const carriedComponents=scope==='current-balance'&&currentBalance?.targetMonth===targetMonth?(currentBalance.components||[])
        .filter(c=>c.carried&&c.sourceMonth?.slice(0,4)===targetMonth.slice(0,4)&&c.sourceMonth<targetMonth)
        .map(c=>({key:c.key,sourceMonth:c.sourceMonth,snapshotAsOf:c.snapshotAsOf??null})):[];
      const metrics=[...balanceMetrics,...periodMetrics],issues=metrics.filter(m=>bad.has(m.state));
      const acquired=candidates.length>0||sourceRecords.length>0||physical.length>0||legacyDataAvailable;
      const pendingCandidates=candidates.filter(c=>metrics.some(m=>m.component===c.component&&m.metric===c.metric)&&!metrics.some(m=>m.revisionId===c.id)&&!heads.some(h=>h.revisionId===c.id));
      const pendingReview=issues.length>0||pendingCandidates.length>0||metrics.some(m=>m.deferred||m.adoptionStatus==='unresolved');
      const selected=scope==='period'?periodMetrics:balanceMetrics,requirementsSatisfied=scope==='period'?periodRequirementsSatisfied:balanceRequirementsSatisfied;
      return {version,policyVersion:p.version,accountKey:key,accountId:p.accountId,targetMonth,scope,
        sourceStatus:!acquired?'none':metrics.some(m=>m.satisfied)?legacy&&!metrics.some(m=>m.adoptionStatus==='adopted')?'legacy-compatibility':'adopted':'candidate-only',sourceAcquired:acquired,
        candidates:candidates.map(c=>({revisionId:c.id,sourceType:c.sourceType,component:c.component,metric:c.metric,asOf:c.asOf})),candidateReadFailed,
        balanceMetrics,periodMetrics,balanceRequirementsSatisfied,periodRequirementsSatisfied,
        requirementsSatisfied,requirementsState:scope==='period'&&!p.periodSupported?'unsupported':requirementsSatisfied?'satisfied':issues.length?'needs-review':selected.some(m=>m.satisfied)?'partial':acquired?'source-acquired':'not-started',
        adoptionStates:metrics.map(m=>({id:m.id,status:m.adoptionStatus,deferred:m.deferred,sourceType:m.sourceType,revisionId:m.revisionId})),
        periodStatus:p.periodSupported?periodRequirementsSatisfied?'satisfied':'insufficient':p.periodReason??'unsupported-canonical-pnl',
        missingRequired:{balance:balanceMetrics.filter(m=>!m.satisfied).map(m=>m.id),period:periodMetrics.filter(m=>!m.satisfied).map(m=>m.id)},
        carriedComponents,carryStatus:scope!=='current-balance'?'not-applicable':currentBalance?'evaluated':'not-evaluated',
        currentDisplaySatisfied:scope==='current-balance'&&currentBalance?.targetMonth===targetMonth?currentBalance.complete===true:null,
        conflicts:issues.filter(m=>m.state==='conflict').map(m=>m.id),stale:issues.filter(m=>m.state==='stale').map(m=>m.id),invalidReferences:issues.filter(m=>m.state==='invalid-reference').map(m=>m.id),
        pendingReview,approvalStatus:'not-recorded',approvalSupported:false,legacyDataAvailable:legacy&&legacyDataAvailable,calculationCompatible,
        existingPeriodCalculationSatisfied:native?.completeness?.complete===true,legacyApprovalStatus:legacy?'unknown':null};
    }
    function month(targetMonth,{scope='period',currentBalances={}}={}){
      return {targetMonth,scope,version,accounts:policy.accountKeys.map(key=>account(key,targetMonth,{scope,currentBalance:currentBalances[key]??null}))};
    }
    return Object.freeze({account,month});
  }
  const api=Object.freeze({version,create});if(node)module.exports=api;else root.TradeScopeMonthlyProgress=api;
})(typeof globalThis!=='undefined'?globalThis:this);
