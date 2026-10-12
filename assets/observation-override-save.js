(function(root){
  'use strict';
  const node=typeof module!=='undefined'&&module.exports;
  const storage=node?require('./data-model-storage.js'):root.TradeScopeDataStorage;
  const adoption=node?require('./observation-adoption.js'):root.TradeScopeObservationAdoption;
  const csv=node?require('../import/csv-core.js'):root.TradeScopeCSV;
  const copy=v=>JSON.parse(JSON.stringify(v));
  function invalid(){throw Error('数値と保存された資産・保有情報を確認してください');}
  function exact(value,keys){if(!value||Array.isArray(value)||typeof value!=='object'||Object.keys(value).length!==keys.length||keys.some(k=>!Object.hasOwn(value,k)))invalid();}
  function parse(value){if(typeof value!=='string')invalid();const result=csv.decimal(value);if(result!==null&&!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(result))invalid();return result;}
  function createService(adapter,options={}){
    const repo=storage.createRepository(adapter),clock=options.clock||(()=>new Date().toISOString());let busy=false;
    function inspect(accountId,targetMonth){const models=repo.read(),view=adoption.resolve(models,accountId,targetMonth);if(!view)invalid();return{models,...view};}
    function save(draft,guard={}){
      if(busy)return{status:'busy'};busy=true;
      try{
        storage.assertJson(draft);exact(draft,['accountId','targetMonth','account','holdings']);
        const view=inspect(draft.accountId,draft.targetMonth);
        if(!guard.expectedModels||JSON.stringify(view.models)!==JSON.stringify(guard.expectedModels))throw Error('保存情報が変更されています。再読込してください');
        exact(draft.account,adoption.accountFields);if(!Array.isArray(draft.holdings)||draft.holdings.length!==view.holdings.length)invalid();
        const overrides=adoption.empty();let unchanged=true;
        for(const field of adoption.accountFields){const value=parse(draft.account[field]);unchanged=unchanged&&adoption.same(view.adopted[field],value);if(!adoption.same(view.source[field],value))overrides.account[field]=value;}
        const seen=new Set();
        for(const row of draft.holdings){
          exact(row,['holdingSnapshotId','instrumentId','values']);exact(row.values,adoption.holdingFields);
          const source=view.holdings.find(h=>h.holdingSnapshotId===row.holdingSnapshotId&&h.instrumentId===row.instrumentId);
          if(!source||seen.has(row.holdingSnapshotId))invalid();seen.add(row.holdingSnapshotId);
          const values={};for(const field of adoption.holdingFields){const value=parse(row.values[field]);unchanged=unchanged&&adoption.same(source.adopted[field],value);if(!adoption.same(source.source[field],value))values[field]=value;}
          if(Object.keys(values).length)overrides.holdings.push({holdingSnapshotId:row.holdingSnapshotId,instrumentId:row.instrumentId,values});
        }
        overrides.holdings.sort((a,b)=>a.holdingSnapshotId.localeCompare(b.holdingSnapshotId));
        const previous=view.input.schemaVersion===4?view.input.observationOverrides:adoption.empty();
        if(unchanged||JSON.stringify(overrides)===JSON.stringify(previous))return{status:'unchanged',models:view.models};
        const now=clock(),next={...copy(view.input),schemaVersion:4,observationOverrides:overrides,overrideUpdatedAt:now,
          overrideHistory:view.input.schemaVersion===4?[...view.input.overrideHistory,adoption.revision(view.input)]:[]};
        const verified=repo.commit({monthlyAccountInputs:{schemaVersion:1,records:view.models.monthlyAccountInputs.records.map(r=>r.id===next.id?next:r),updatedAt:now}},{expectedModels:view.models});
        return{status:'saved',models:verified};
      }finally{busy=false;}
    }
    return Object.freeze({inspect,save});
  }
  const api=Object.freeze({createService});if(node)module.exports=api;else root.TradeScopeObservationOverrideSave=api;
})(typeof globalThis!=='undefined'?globalThis:this);
