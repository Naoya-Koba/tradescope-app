(function(root){
  'use strict';
  const node=typeof module!=='undefined'&&module.exports;
  const csv=node?require('../import/csv-core.js'):root.TradeScopeCSV;
  const version='sbi-period-input-v1';
  const decimal=v=>typeof v==='string'&&/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(v);
  const dated=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(v)&&Number.isFinite(Date.parse(v))
    &&(v.length!==10||new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v);
  const blocked=v=>['stale','conflict','unresolved','invalid-reference'].includes(v.status);
  const rows=(m,e)=>m?.[e]?.records||[];
  // Financial INPUT projection only. No State, source, flow or carry is generated.
  // Balance selection has already been performed by sbi-balance-adoption.
  function build({models,targetMonth,balance,base,sourceAdoptions}){
    const inputs=rows(models,'monthlyAccountInputs').filter(r=>r.accountId===balance.accountId&&r.targetMonth===targetMonth);
    const states=rows(models,'monthlyAccountStates').filter(r=>r.accountId===balance.accountId&&r.targetMonth===targetMonth);
    const native=states[0]??inputs[0],conflict=base.source==='conflict'||inputs.length>1||states.length>1;
    const flows={};
    for(const name of ['realizedPnl','deposit','withdrawal']){
      const common=sourceAdoptions.some(r=>r.component==='account'&&r.metric===name&&r.currency==='JPY');
      const value=common?base[name]:native?native[name]:base[name];
      flows[name]=!conflict&&decimal(value)?value:null;
    }
    const swap=sourceAdoptions.find(r=>r.component==='account'&&r.metric==='swapPnl'&&r.currency==='JPY');
    const swapValid=!swap||swap.status==='adopted'&&swap.value==='0';
    const monthly=!conflict&&Object.values(flows).every(decimal)&&swapValid;
    const metrics=balance.metrics.map(r=>({...r,eligible:['adopted','compatibility'].includes(r.status)&&!blocked(r)&&decimal(r.value)&&dated(r.snapshotAsOf)&&r.sourceMonth===targetMonth}));
    const pnl=metrics.filter(r=>r.metric==='unrealizedPnl');
    const accountPnl=sourceAdoptions.some(r=>r.component==='account'&&r.metric==='unrealizedPnl'&&r.currency==='JPY');
    // Existing account-scope P/L decisions are outside the five-target bridge.
    // Preserve that released exclusive basis; never add it to component P/L.
    const unrealizedPnl=conflict?null:accountPnl?decimal(base.unrealizedPnl)?base.unrealizedPnl:null
      :pnl.every(r=>r.eligible)?csv.sum(pnl.map(r=>r.value)):null;
    const whole=balance.whole;
    const assetReferences=whole?[{id:'account:marketValue',eligible:whole.status==='adopted'&&decimal(whole.value)&&dated(whole.source?.asOf)&&whole.source?.targetMonth===targetMonth}]
      :metrics.filter(r=>r.metric!=='unrealizedPnl').map(r=>({id:r.component+':'+r.metric,eligible:r.eligible}));
    const references=[...assetReferences,...pnl.map(r=>({id:r.component+':'+r.metric,eligible:r.eligible}))];
    const referenceSatisfied=!conflict&&references.every(r=>r.eligible);
    const observation=referenceSatisfied&&unrealizedPnl!==null;
    return {version,targetMonth,derived:true,metrics,flowSource:native?{entity:states.length?'monthlyAccountStates':'monthlyAccountInputs',id:native.id}:null,
      ...flows,fixedSwap:'0',swapPnl:swapValid?monthly?'0':base.swapPnl??null:null,unrealizedPnl,observedUnrealized:unrealizedPnl,
      observedAsset:balance.observedAsset,referenceSatisfied,monthly,observation,complete:monthly&&observation,
      missingReferences:references.filter(r=>!r.eligible).map(r=>r.id),missingFlows:Object.entries(flows).filter(([,v])=>v===null).map(([k])=>k),conflict};
  }
  const api=Object.freeze({version,build});if(node)module.exports=api;else root.TradeScopeSbiPeriodInput=api;
})(typeof globalThis!=='undefined'?globalThis:this);
