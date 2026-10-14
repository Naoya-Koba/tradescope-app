(function(root){
  'use strict';
  const node=typeof module!=='undefined'&&module.exports;
  const core=node?require('./monthly-source-contract.js'):root.TradeScopeMonthlySourceContract;
  const serviceAPI=node?require('./monthly-source-service.js'):root.TradeScopeMonthlySourceService;
  const csv=node?require('../import/csv-core.js'):root.TradeScopeCSV;
  const equal=(a,b)=>a===null||b===null?a===b:/^-?0(?:\.0+)?$/.test(csv.sum([a,b.startsWith('-')?b.slice(1):'-'+b]));
  const key=t=>t.component+':'+t.metric;
  function createController(adapter,{accountId,targets,resolveBalance,manualTargets=targets,validateSource=()=>true,cutover,clock,newId}={}){
    const service=serviceAPI.createService(adapter,{clock,newId}),id=()=>newId?newId():'ms_'+root.crypto.randomUUID();
    function inspect(targetMonth){
      if(!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(targetMonth)||cutover&&targetMonth<cutover)throw Error('INVALID_SCALAR_MONTH');
      const base=service.inspect(),view=resolveBalance(base.models,targetMonth),all=core.candidates(base.models,{accountId,targetMonth});
      const components=targets.map(t=>{
        const current=view.metrics.find(r=>key(r)===key(t));
        const candidates=all.filter(r=>key(r)===key(t)&&r.currency==='JPY').map(source=>{
          let value=null,status='candidate only';try{value=core.sourceValue(source,base.models);if(source.fingerprint!==core.sourceFingerprint(source,base.models))status='stale';}
          catch(_){status='invalid';}if(!validateSource(source,base.models))status='unsupported';return {source,value,status};
        });
        return {...t,key:key(t),candidates,current:{...current,adoptedValue:current.value,compatibility:current.status==='compatibility',overrideId:current.override?.id??null}};
      });
      return {targetMonth,...base,components,view};
    }
    function comparison(state,targetKey,candidateId){
      const t=state.components.find(t=>t.key===targetKey),other=t?.candidates.find(c=>c.source.id===candidateId),left=t?.current.source;
      if(!left||!other||other.status!=='candidate only')return {result:'incomparable',delta:null};
      const result=left.asOf&&other.source.asOf?core.comparison(left,other.source,state.models):'incomparable';
      const delta=result!=='incomparable'?csv.sum([other.value,t.current.rawValue.startsWith('-')?t.current.rawValue.slice(1):'-'+t.current.rawValue]):null;
      const confirmation=(state.models.monthlySources?.records??[]).filter(r=>r.kind==='comparison'&&(r.leftId===left.id&&r.rightId===candidateId||r.rightId===left.id&&r.leftId===candidateId)).at(-1);
      return {result,delta,confirmation:confirmation?{result:confirmation.result,confirmedAt:confirmation.confirmedAt,status:core.audit(state.models).find(r=>r.id===confirmation.id)?.status}:null};
    }
    function perform(snapshot,{targetKey,action,candidateId,value,asOf,revisionOf}={}){
      const state=inspect(snapshot.targetMonth);if(state.fingerprint!==snapshot.fingerprint)throw Error('STALE_MONTHLY_SOURCE_DRAFT');
      const t=state.components.find(t=>t.key===targetKey);if(!t)throw Error('INVALID_SCALAR_TARGET');
      const operation={sources:[],adoptions:[],overrides:[],comparisons:[]},registered=new Set();
      const register=source=>{
        const c=t.candidates.find(c=>c.source.id===source?.id);if(!c||c.status!=='candidate only')throw Error('SCALAR_SOURCE_UNAVAILABLE');
        if(!c.source.registered&&!registered.has(c.source.id)){operation.sources.push(c.source);registered.add(c.source.id);}return c.source;
      };
      const preserve=()=>{
        const source=register(t.current.source);let overrideId=t.current.overrideId;
        if(t.current.compatibility&&t.current.hasOverride){overrideId=id();operation.overrides.push({id:overrideId,revisionId:source.id,value:t.current.value});}
        operation.adoptions.push({revisionId:source.id,overrideId});return source;
      };
      if(action==='create'||action==='create-adopt'){
        if(!manualTargets.some(m=>key(m)===t.key))throw Error('MANUAL_TARGET_UNSUPPORTED');
        if(action==='create-adopt'&&(t.current.source||t.current.hasCommon))throw Error('SCALAR_ADOPTION_ALREADY_EXISTS');
        const date=csv.date(asOf??null);if(!date)throw Error('SCALAR_ASOF_REQUIRED');
        const parsed=csv.decimal(value??null),number=parsed===null?null:parsed.replace(/^(-?)0+(?=\d)/,'$1');
        const parent=revisionOf?register(t.candidates.find(c=>c.source.id===revisionOf)?.source):null;
        if(parent&&parent.sourceType!=='manual')throw Error('MANUAL_REVISION_REQUIRED');
        const sourceId=id(),r=core.descriptor({accountId,targetMonth:state.targetMonth,component:t.component,currency:'JPY',asOf:date},t.metric,number,
          {id:sourceId,sourceId:parent?.sourceId??sourceId,sourceType:'manual',revisionOf:parent?.id??null});
        operation.sources.push(r);if(action==='create-adopt')operation.adoptions.push({revisionId:r.id});
      }else if(action==='adopt')operation.adoptions.push({revisionId:register(t.candidates.find(c=>c.source.id===candidateId)?.source).id,overrideId:null});
      else if(action==='keep')preserve();
      else if(action==='defer'){
        if(t.current.compatibility&&t.current.source)preserve();operation.adoptions.push({...t.current.query,decision:'defer'});
      }else if(action==='compare'){
        const left=register(t.current.source),right=register(t.candidates.find(c=>c.source.id===candidateId)?.source);
        if(left.id===right.id||!left.asOf||!right.asOf)throw Error('SCALAR_COMPARISON_UNAVAILABLE');
        operation.comparisons.push({leftId:left.id,rightId:right.id});
      }else if(action==='override'){
        const source=register(t.current.source),overrideId=id(),parsed=csv.decimal(value??null);
        operation.overrides.push({id:overrideId,revisionId:source.id,value:parsed===null?null:parsed.replace(/^(-?)0+(?=\d)/,'$1')});
        operation.adoptions.push({revisionId:source.id,overrideId});
      }else throw Error('INVALID_SCALAR_ACTION');
      service.operate(operation,{expectedFingerprint:snapshot.fingerprint});return inspect(state.targetMonth);
    }
    return Object.freeze({inspect,comparison,perform,manualTargets,canCompare:(left,right)=>!!left?.asOf&&!!right?.asOf});
  }
  const api=Object.freeze({createController,key,equal});if(node)module.exports=api;else root.TradeScopeScalarSourceSelection=api;
})(typeof globalThis!=='undefined'?globalThis:this);
