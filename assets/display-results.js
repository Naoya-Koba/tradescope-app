(function(root){
  'use strict';
  const node=typeof module!=='undefined'&&module.exports;
  const initialView=node?require('./year-initial-view.js'):root.TradeScopeYearInitial;
  const version='display-results-v5';
  const finite=v=>Number.isFinite(v);
  // Period comparison eligibility, not a return formula or a current-balance selector.
  function periodComparison(period,{initialKnown=true}={}){
    const reasons=[],sources=period.rows.map(row=>({accountKey:row.key,current:row.metrics.net,period:row.metrics.completeNet}));
    for(const row of period.rows){
      const n=row.metrics.net,p=row.metrics.completeNet;
      const complete=m=>['current complete','previous complete'].includes(m?.status);
      const basis=m=>m?.basis??(complete(m)?'period-ledger':'observation');
      if(row.conflict||!finite(n.value)||!finite(p?.value)||!complete(n)||!complete(p)
        ||basis(n)!==basis(p)||basis(n)!=='period-ledger'||!n.sourceMonth||n.sourceMonth!==p.sourceMonth
        ||!n.sourceMonth.startsWith(period.year+'-')||n.value!==p.value)reasons.push(row.key);
    }
    if(!initialKnown)reasons.push('initial-unknown');
    const comparable=sources.length>0&&!reasons.length&&finite(period.initialNet);
    return {comparable,reasons,sources,delta:comparable&&finite(period.netDelta)?period.netDelta:null,
      growth:comparable&&period.initialNet>0&&finite(period.netGrowth)?period.netGrowth:null};
  }
  function month(display,year,number,{readFailed=false}={}){
    readFailed=readFailed&&!display.readState?.states;
    const raw=display.month(year,number);
    const rows=raw.rows.map(row=>{
      const status=readFailed||row.readFailure?'read-failure':row.conflict||row.assetConflict?'conflict':!row.hasData?'missing':row.partial?'partial':'complete';
      if(row.assetConflict&&!row.conflict&&status==='conflict')return {...row,status,asset:null,components:[],total:row.coverage.total.value};
      if(!['missing','conflict','read-failure'].includes(status))return {...row,status,total:row.coverage.total.value};
      return {...row,status,total:null,asset:null,confirmed:null,realized:null,swap:null,unrealized:null,deposit:null,withdrawal:null,cashflow:null,components:[]};
    });
    return readFailed?{...raw,rows,hasData:false,provisional:false,total:null,realized:null,swap:null,unrealized:null,deposit:null,withdrawal:null}:{...raw,rows};
  }
  function create(display,year,{currentFactory,readFailed=false,initialSources}={}){
    const reportedFailure=readFailed||display.readState?.failed===true;
    readFailed=readFailed&&!display.readState?.states;
    let period=display.dashboard(year);
    if(readFailed)period={...period,hasData:false,rows:period.rows.map(r=>({...r,metrics:Object.fromEntries(Object.entries(r.metrics).map(([k,m])=>[k,{...m,value:null,status:'unavailable'}]))})),net:{value:null,sources:[]},confirmed:{value:null,sources:[]},netPnl:{value:null,sources:[]},confirmedPnl:{value:null,sources:[]},netDelta:null,netGrowth:null};
    const annual=readFailed?{realizedSum:null,swapSum:null,depositSum:null,withdrawSum:null}:display.yearlyTotals(year);
    const months=Array.from({length:12},(_,i)=>month(display,year,i+1,{readFailed}));
    const entered=months.map((m,i)=>finite(m.swap)?i+1:null).filter(m=>m!==null),last=entered.at(-1)??null;
    const breakdown=last?months[last-1].rows.filter(r=>finite(r.swap)).map(r=>({name:period.rows.find(a=>a.key===r.key).name,value:r.swap})):[];
    const cumulativeSwap=annual.swapSum,count=entered.length;
    const swap={prevMonth:last,prevMonthSwap:last?months[last-1].swap:null,prevMonthBreakdown:breakdown,
      cumulativeSwap,enteredMonthCount:count,estimatedYearSwap:count&&finite(cumulativeSwap)?cumulativeSwap+(cumulativeSwap/count)*Math.max(0,12-count):null};
    const initialKnownFor=(sourceYear,rows)=>initialSources?initialView.create(initialSources.funds,initialSources.unrealized,sourceYear,rows,{readState:display.readState}).net.complete
      :typeof display.initial==='function'?display.initial(sourceYear,rows).net.complete:true;
    const initialKnown=initialKnownFor(year,period.rows);
    let current=currentFactory?currentFactory(period,display):null;
    if(current&&!initialKnownFor(current.year??year,current.rows))current={...current,netPeriodComparison:{...current.netPeriodComparison,comparable:false,
      reasons:[...current.netPeriodComparison.reasons,{reason:'initial-unknown'}],delta:null,growth:null}};
    return {version,year,period,annual,swap,months,netComparison:periodComparison(period,{initialKnown}),current,
      initial:typeof display.initial==='function'?display.initial(year):null,
      fingerprint:version+'-'+display.fingerprint(year),basis:'period-dashboard',readFailed:reportedFailure};
  }
  const api=Object.freeze({create,month,periodComparison,version});if(node)module.exports=api;else root.TradeScopeDisplayResults=api;
})(typeof globalThis!=='undefined'?globalThis:this);
