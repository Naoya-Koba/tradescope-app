(function(root){
  'use strict';
  const node=typeof module!=='undefined'&&module.exports;
  const observation=node?require('./open-positions-view.js'):root.TradeScopeOpenPositionsView;
  const csv=node?require('../import/csv-core.js'):root.TradeScopeCSV;
  const version='current-assets-v1';
  const knownSum=values=>values.length?csv.sum(values.map(String)):null;
  const number=value=>value===null?null:Number.isFinite(Number(value))?Number(value):null;
  function sbivc(models,year){
    try{
      const source=observation.latestObservation(models,{year});
      const cashKnown=source.hasSource&&source.cashBalance!==null;
      const unknownValuation=source.holdings.some(h=>h.marketValue===null);
      const unknownQuantity=source.hasUnknownQuantity===true;
      const unknownComponents=source.hasSource&&(!cashKnown||unknownValuation||unknownQuantity);
      const values=source.holdings.map(h=>h.marketValue).filter(v=>v!==null);
      if(cashKnown)values.push(source.cashBalance);
      return {...source,sourceMonth:source.targetMonth,cashKnown,unknownValuation,unknownQuantity,unknownComponents,
        complete:source.hasSource&&!unknownComponents,monthlyComplete:false,knownAssetTotal:knownSum(values),error:false};
    }catch(_){
      return {hasSource:false,sourceMonth:null,targetMonth:null,holdings:[],cashBalance:null,cashKnown:false,
        unknownComponents:true,unknownQuantity:false,unknownValuation:false,complete:false,monthlyComplete:false,
        knownAssetTotal:null,error:true};
    }
  }
  // Asset-display overlay only: never mutates dashboard, period metrics or canonical models.
  function create(dashboard,models,year){
    const crypto=sbivc(models,year);
    const rows=dashboard.rows.map(row=>row.key!=='sbivc'?row:{...row,metrics:{...row.metrics,
      net:{value:number(crypto.knownAssetTotal),sourceMonth:crypto.sourceMonth,
        status:crypto.knownAssetTotal===null?'unavailable':'current partial'}},assetObservation:crypto});
    const netValues=rows.map(row=>row.key==='sbivc'?crypto.knownAssetTotal:row.metrics.net.value).filter(v=>v!==null);
    const net={value:number(knownSum(netValues)),sources:rows.map(row=>row.metrics.net)};
    const accountData=rows.filter(row=>Number.isFinite(row.metrics.net.value)&&row.metrics.net.value>0)
      .map(row=>({label:row.name,color:row.color,amount:row.metrics.net.value,sourceMonth:row.metrics.net.sourceMonth,
        status:row.metrics.net.status,...(row.key==='sbivc'?{unknownComponents:crypto.unknownComponents}: {})}));
    const source=JSON.stringify([version,year,dashboard.sourceFingerprint,crypto]);
    let hash=2166136261;
    for(let i=0;i<source.length;i++){hash^=source.charCodeAt(i);hash=Math.imul(hash,16777619);}
    return {year,rows,crypto,net,accountData,hasData:net.value!==null,
      provisional:rows.some(row=>row.metrics.net.status!=='current complete'),
      unknownComponents:crypto.unknownComponents||rows.some(row=>row.metrics.net.value===null),
      sourceFingerprint:`${version}-${(hash>>>0).toString(16)}`};
  }
  const api=Object.freeze({create,sbivc,version});
  if(node)module.exports=api;else root.TradeScopeCurrentAssets=api;
})(typeof globalThis!=='undefined'?globalThis:this);
