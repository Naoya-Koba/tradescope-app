(function(root){
  'use strict';
  const node=typeof module!=='undefined'&&module.exports;
  const observation=node?require('./open-positions-view.js'):root.TradeScopeOpenPositionsView;
  const adoption=node?require('./sbivc-balance-adoption.js'):root.TradeScopeSBIVCBalanceAdoption;
  const balances=node?require('./balance-view.js'):root.TradeScopeBalanceView;
  const csv=node?require('../import/csv-core.js'):root.TradeScopeCSV;
  const version='current-assets-v4';
  const knownSum=values=>values.length?csv.sum(values.map(String)):null;
  const number=value=>value==null||value===''?null:Number.isFinite(Number(value))?Number(value):null;
  function sbivc(models,year){
    try{
      const source=observation.latestObservation(models,{year});
      const cashKnown=source.hasSource&&source.cashBalance!==null;
      const unknownValuation=source.holdings.some(h=>h.marketValue===null);
      const unknownQuantity=source.hasUnknownQuantity===true;
      const unknownComponents=source.hasSource&&(!cashKnown||unknownValuation||unknownQuantity);
      const values=source.holdings.map(h=>h.marketValue).filter(v=>v!==null);
      if(source.emptyHoldingSet)values.push('0');
      if(cashKnown)values.push(source.cashBalance);
      return {...source,sourceMonth:source.targetMonth,cashKnown,unknownValuation,unknownQuantity,unknownComponents,
        complete:source.hasSource&&!unknownComponents,monthlyComplete:false,knownAssetTotal:knownSum(values),error:false};
    }catch(_){
      return {hasSource:false,sourceMonth:null,targetMonth:null,holdings:[],cashBalance:null,cashKnown:false,
        unknownComponents:true,unknownQuantity:false,unknownValuation:false,complete:false,monthlyComplete:false,
        knownAssetTotal:null,error:true};
    }
  }
  function cryptoBalance(models,source,targetMonth){
    const rows=(entity)=>models?.[entity]?.records||[];
    const months=adoption.months(models,{year:Number(targetMonth.slice(0,4))}).filter(m=>m<=source.sourceMonth);
    const latest=adoption.latest(models,{year:Number(targetMonth.slice(0,4))});
    const unknown=latest.holdings.filter(h=>h.adopted.quantity===null);
    // The latest complete holding roster is authoritative: removed/zero holdings never reappear.
    const componentKeys=['cash',...source.holdings.map(h=>'holding:'+h.instrumentId),...unknown.map(h=>'holding:'+h.instrumentId),
      ...(source.emptyHoldingSet&&source.cashBalance===null?['spot-empty']:[]),...(!latest.holdingSetKnown?['spot-unknown']:[])];
    const observations=[];
    const holdingFields=[];
    for(const month of months){
      const view=adoption.resolve(models,month);
      const provenance=view.holdingSource;
      observations.push({key:'cash',label:'JPY現金',value:view.adopted.cashBalance,sourceMonth:month,snapshotAsOf:view.cashSource?.snapshotAsOf??null,
        basis:'current-asset-observation',source:view.cashSource,blocked:['stale','conflict','unresolved'].includes(view.cashStatus)});
      for(const key of componentKeys.filter(k=>k!=='cash')){
        if(key==='spot-empty'||key==='spot-unknown'){
          observations.push({key,value:key==='spot-empty'&&view.emptyHoldingSet?'0':null,sourceMonth:month,preventCarry:true,
            basis:'current-asset-observation',source:provenance});continue;
        }
        if(view.spotStatus==='missing')continue;
        const h=view.holdings.find(h=>'holding:'+h.instrumentId===key);
        const label=rows('instruments').find(i=>'holding:'+i.id===key)?.symbol??'現物保有';
        if(!h){observations.push({key,label,value:null,sourceMonth:month,preventCarry:true});continue;}
        if(h.adopted.quantity===null){
          observations.push({key,label,value:null,sourceMonth:month,preventCarry:true});
          continue;
        }
        const zero=/^0+(?:\.0+)?$/.test(h.adopted.quantity);
        observations.push({key,label,
          value:zero?'0':h.adopted.marketValue,sourceMonth:month,snapshotAsOf:provenance?.snapshotAsOf??null,
          basis:'current-asset-observation',source:{...provenance,holdingSnapshotId:h.holdingSnapshotId}});
      }
    }
    // Quantity/rate statuses are available to future balance UI, but do not change
    // Open Positions/Portfolio's authoritative latest-source holdings.
    for(const h of source.holdings){
      const fieldObservations=[];
      for(const month of months){
        const view=adoption.resolve(models,month),old=view.holdings.find(row=>row.instrumentId===h.instrumentId);
        for(const field of ['quantity','marketPrice'])fieldObservations.push({key:field,value:old?.adopted[field]??null,sourceMonth:month,
          preventCarry:!old||old.adopted.quantity===null||/^0+(?:\.0+)?$/.test(old.adopted.quantity),
          source:{recordId:old?.holdingSnapshotId??null,importBatchId:view.holdingSource?.importBatchId??null},snapshotAsOf:view.holdingSource?.snapshotAsOf??null});
      }
      holdingFields.push({instrumentId:h.instrumentId,fields:balances.resolve(fieldObservations,{targetMonth,componentKeys:['quantity','marketPrice']}).components});
    }
    return {...balances.resolve(observations,{targetMonth,componentKeys}),holdingFields,monthlyComplete:false};
  }
  // Display eligibility, not a new return calculation. Compare each account's
  // basis/month/completeness before exposing the unchanged period metrics.
  function netPeriodComparison(dashboard,rows,year){
    const complete=metric=>['current complete','previous complete'].includes(metric?.status);
    const sources=rows.map(row=>({accountKey:row.key,current:row.metrics.net,period:row.metrics.completeNet}));
    const reasons=[];
    if(dashboard.year!==year)reasons.push({reason:'year-mismatch'});
    if(!rows.length)reasons.push({reason:'missing-accounts'});
    for(const row of rows){
      const current=row.metrics.net,period=row.metrics.completeNet;
      let reason=null;
      if(row.conflict)reason='conflict';
      else if(row.balance?.hasCarried)reason='carried-balance';
      else if(row.balance?.unknownComponents)reason='unknown';
      else if(current.basis==='current-asset-observation')reason='observation-vs-period';
      else if(!Number.isFinite(current.value)||!Number.isFinite(period?.value))reason='unknown';
      else if(!complete(current)||!complete(period))reason='partial';
      else if(!current.sourceMonth||current.sourceMonth!==period.sourceMonth
        ||!current.sourceMonth.startsWith(`${year}-`))reason='source-month-mismatch';
      else if(current.value!==period.value)reason='value-mismatch';
      if(reason)reasons.push({accountKey:row.key,reason});
    }
    const comparable=reasons.length===0;
    return {comparable,reasons,sources,
      delta:comparable&&Number.isFinite(dashboard.netDelta)?dashboard.netDelta:null,
      growth:comparable&&Number.isFinite(dashboard.netGrowth)?dashboard.netGrowth:null};
  }
  // Asset-display overlay only: never mutates dashboard, period metrics or canonical models.
  function create(dashboard,models,year,{balanceHistory}={}){
    let crypto=sbivc(models,year);
    const targetMonth=[dashboard.month?`${year}-${String(dashboard.month).padStart(2,'0')}`:null,crypto.sourceMonth]
      .filter(Boolean).sort().at(-1)??null;
    const rows=dashboard.rows.map(row=>{
      if(row.key==='sbivc'){
        const balance=crypto.hasSource?cryptoBalance(models,crypto,targetMonth):balances.resolve([{key:'cash',label:'JPY現金',value:null,sourceMonth:targetMonth??`${year}-01`}],{targetMonth:targetMonth??`${year}-01`,componentKeys:['cash']});
        crypto={...crypto,balance,knownAssetTotal:balance.knownTotal,hasCarried:balance.hasCarried,
          unknownComponents:balance.unknownComponents,complete:balance.complete};
        return {...row,balance,metrics:{...row.metrics,net:{value:number(balance.knownTotal),sourceMonth:crypto.sourceMonth,
          status:balance.knownTotal===null?'unavailable':'current partial',basis:'current-asset-observation'}},assetObservation:crypto};
      }
      if(!balanceHistory||!targetMonth)return row;
      const history=balanceHistory(year,row,Number(targetMonth.slice(5)));
      const balance={...balances.resolve(history.observations,{targetMonth,componentKeys:history.componentKeys}),monthlyComplete:history.monthlyComplete};
      if(row.key==='sbivc')crypto={...crypto,balance,knownAssetTotal:balance.knownTotal,hasCarried:balance.hasCarried,unknownComponents:balance.unknownComponents,complete:balance.complete};
      const sourceMonth=balance.sourceMonths.at(-1)??null;
      const ledger=balance.components.every(c=>c.basis==='period-ledger');
      return {...row,balance,conflict:row.conflict||balance.blocked,metrics:{...row.metrics,net:{value:number(balance.knownTotal),sourceMonth,
        status:balance.knownTotal===null?'unavailable':balance.currentComplete&&ledger?'current complete':balance.hasCarried&&balance.complete?'previous complete':'current partial',
        basis:ledger?'period-ledger':'current-asset-observation'}}};
    });
    const netValues=rows.map(row=>row.balance?row.balance.knownTotal:row.metrics.net.value).filter(v=>v!==null);
    const net={value:number(knownSum(netValues)),sources:rows.map(row=>row.metrics.net)};
    const accountData=rows.filter(row=>Number.isFinite(row.metrics.net.value)&&row.metrics.net.value>0)
      .map(row=>({label:row.name,color:row.color,amount:row.metrics.net.value,sourceMonth:row.metrics.net.sourceMonth,
        status:row.metrics.net.status,...(row.balance?{balance:row.balance,unknownComponents:row.balance.unknownComponents}: {}),
        ...(row.key==='sbivc'?{unknownComponents:crypto.unknownComponents}: {})}));
    const source=JSON.stringify([version,balances.version,year,dashboard.sourceFingerprint,crypto,rows.map(r=>r.balance)]);
    let hash=2166136261;
    for(let i=0;i<source.length;i++){hash^=source.charCodeAt(i);hash=Math.imul(hash,16777619);}
    return {year,targetMonth,rows,crypto,net,accountData,netPeriodComparison:netPeriodComparison(dashboard,rows,year),hasData:net.value!==null,
      hasCarried:rows.some(row=>row.balance?.hasCarried),
      provisional:rows.some(row=>row.balance?!row.balance.currentComplete||row.metrics.net.basis==='current-asset-observation':row.metrics.net.status!=='current complete'),
      unknownComponents:rows.some(row=>row.balance?.unknownComponents||row.metrics.net.value===null),
      sourceFingerprint:`${version}-${(hash>>>0).toString(16)}`};
  }
  const api=Object.freeze({create,sbivc,version});
  if(node)module.exports=api;else root.TradeScopeCurrentAssets=api;
})(typeof globalThis!=='undefined'?globalThis:this);
