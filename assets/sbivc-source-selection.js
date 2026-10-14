(function(root){
  'use strict';
  const node=typeof module!=='undefined'&&module.exports;
  const core=node?require('./monthly-source-contract.js'):root.TradeScopeMonthlySourceContract;
  const sourceService=node?require('./monthly-source-service.js'):root.TradeScopeMonthlySourceService;
  const balance=node?require('./sbivc-balance-adoption.js'):root.TradeScopeSBIVCBalanceAdoption;
  const csv=node?require('../import/csv-core.js'):root.TradeScopeCSV;
  const accountId=balance.accountId,rows=(m,e)=>m?.[e]?.records||[];
  const targets=Object.freeze([{component:'spot',metric:'holdings'},{component:'cash',metric:'cashBalance'}]);
  const ordered=value=>Array.isArray(value)?[...value].sort((a,b)=>a.instrumentId.localeCompare(b.instrumentId)):value;
  const equal=(a,b)=>Array.isArray(a)?core.hash(ordered(a))===core.hash(ordered(b)):a===null||b===null?a===b:/^-?0(?:\.0+)?$/.test(csv.sum([a,b.startsWith('-')?b.slice(1):'-'+b]));
  function createController(adapter,options={}){
    const service=sourceService.createService(adapter,options);
    function inspect(targetMonth){
      if(!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(targetMonth))throw Error('INVALID_SOURCE_SELECTION_MONTH');
      const state=service.inspect(),models=state.models,all=core.candidates(models,{accountId,targetMonth});
      let view=null,conflict=false;try{view=balance.resolve(models,targetMonth);}catch(_){conflict=true;}
      const components=targets.map(({component,metric})=>{
        const candidates=all.filter(r=>r.component===component&&r.metric===metric&&r.currency==='JPY').map(source=>{
          let value=null,status='candidate only';
          try{value=core.sourceValue(source,models);if(source.fingerprint!==core.sourceFingerprint(source,models))status='stale';
            if(source.reference&&(source.reference.sourceScope!==balance.scope||metric==='holdings'&&source.reference.field!=='holdings'||metric==='cashBalance'&&source.reference.field!=='cashBalance'))status='unsupported';
            if(metric==='holdings'&&value.some(h=>!rows(models,'instruments').some(i=>i.id===h.instrumentId&&i.assetType==='Crypto')))status='unsupported';
          }catch(_){status='invalid';}
          return {source,value,status};
        });
        const query=core.descriptor({accountId,targetMonth,component,asOf:null},metric,null),chosen=core.resolve(models,query);
        const provenance=metric==='holdings'?view?.holdingSource:view?.cashSource;
        const compatibility=chosen.status==='compatibility';
        const source=chosen.source??(compatibility&&provenance?candidates.find(c=>c.source.reference?.id===(metric==='holdings'?provenance.importBatchId:provenance.recordId))?.source:null);
        const raw=source?candidates.find(c=>c.source.id===source.id)?.value??null:null;
        const adopted=conflict?null:metric==='holdings'?view?.holdingSetKnown?ordered(view.holdings.map(h=>({instrumentId:h.instrumentId,...h.adopted,currency:'JPY'}))):null:view?.adopted.cashBalance??null;
        const status=conflict?'conflict':compatibility?source?'compatibility':'missing':chosen.status;
        return {component,metric,query,candidates,current:{status,source,rawValue:raw,adoptedValue:adopted,
          hasOverride:source&&!equal(raw,adopted),overrideId:chosen.override?.id??null,compatibility,
          deferred:chosen.deferred===true,sourceMonth:targetMonth,asOf:provenance?.snapshotAsOf??source?.asOf??null}};
      });
      return {targetMonth,fingerprint:state.fingerprint,models,components,hasData:!!view||components.some(c=>c.candidates.length),conflict};
    }
    function comparison(state,metric,candidateId){
      const item=state.components.find(c=>c.metric===metric),other=item?.candidates.find(c=>c.source.id===candidateId),source=item?.current.source;
      if(!source||!other||['stale','invalid','unsupported'].includes(other.status))return {result:'incomparable',differences:[],delta:null};
      const result=core.comparison(source,other.source,state.models),before=item.current.rawValue,after=other.value;
      const differences=metric==='holdings'&&Array.isArray(before)&&Array.isArray(after)?[...new Set([...before,...after].map(h=>h.instrumentId))]
        .map(instrumentId=>({instrumentId,before:before.find(h=>h.instrumentId===instrumentId)??null,after:after.find(h=>h.instrumentId===instrumentId)??null}))
        .filter(d=>core.hash(d.before)!==core.hash(d.after)):[];
      const delta=metric==='cashBalance'&&result!=='incomparable'&&before!==null&&after!==null?csv.sum([after,before.startsWith('-')?before.slice(1):'-'+before]):null;
      const confirmation=(state.models.monthlySources?.records??[]).filter(r=>r.kind==='comparison'&&(
        r.leftId===source.id&&r.rightId===other.source.id||r.rightId===source.id&&r.leftId===other.source.id)).at(-1);
      const confirmationStatus=confirmation?core.audit(state.models).find(r=>r.id===confirmation.id)?.status:null;
      return {result,differences,delta,confirmation:confirmation?{result:confirmation.result,confirmedAt:confirmation.confirmedAt,status:confirmationStatus}:null};
    }
    function perform(snapshot,{metric,action,candidateId}={}){
      const state=inspect(snapshot.targetMonth);if(state.fingerprint!==snapshot.fingerprint)throw Error('STALE_MONTHLY_SOURCE_DRAFT');
      const item=state.components.find(c=>c.metric===metric);if(!item||state.conflict)throw Error('SOURCE_SELECTION_CONFLICT');
      const operation={sources:[],adoptions:[],overrides:[],comparisons:[]},added=new Set();
      const register=source=>{
        const entry=item.candidates.find(c=>c.source.id===source?.id);
        if(!entry||entry.status!=='candidate only')throw Error('SOURCE_SELECTION_UNAVAILABLE');
        if(!entry.source.registered&&!added.has(source.id)){operation.sources.push(entry.source);added.add(source.id);}return entry.source;
      };
      const preserveCurrent=()=>{
        const source=register(item.current.source);let overrideId=item.current.overrideId;
        if(item.current.compatibility&&item.current.hasOverride){
          // Explicit confirmation of the SAME physical revision only. No revision-to-revision inheritance.
          overrideId=options.newId?options.newId():'ms_'+globalThis.crypto.randomUUID();
          operation.overrides.push({id:overrideId,revisionId:source.id,value:item.current.adoptedValue});
        }
        operation.adoptions.push({revisionId:source.id,overrideId});return source;
      };
      if(action==='adopt'){
        const source=register(item.candidates.find(c=>c.source.id===candidateId)?.source);
        operation.adoptions.push({revisionId:source.id,overrideId:null});
      }else if(action==='keep')preserveCurrent();
      else if(action==='defer'){
        if(item.current.compatibility&&item.current.source)preserveCurrent();
        operation.adoptions.push({...item.query,decision:'defer'});
      }else if(action==='compare'){
        const left=register(item.current.source),right=register(item.candidates.find(c=>c.source.id===candidateId)?.source);
        if(left.id===right.id)throw Error('SOURCE_SELECTION_SAME_REVISION');
        operation.comparisons.push({leftId:left.id,rightId:right.id});
      }else throw Error('INVALID_SOURCE_SELECTION_ACTION');
      service.operate(operation,{expectedFingerprint:snapshot.fingerprint});
      return inspect(snapshot.targetMonth);
    }
    return Object.freeze({inspect,comparison,perform});
  }
  const api=Object.freeze({createController,targets});if(node)module.exports=api;else root.TradeScopeSBIVCSourceSelection=api;
})(typeof globalThis!=='undefined'?globalThis:this);
