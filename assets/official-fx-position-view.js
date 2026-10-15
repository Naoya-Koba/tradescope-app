(function(root){
  'use strict';
  const node=typeof module!=='undefined'&&module.exports;
  const storage=node?require('./data-model-storage.js'):root.TradeScopeDataStorage;
  const scalars=node?require('./lightfx-scalar-adoption.js'):root.TradeScopeLightScalarAdoption;
  const core=node?require('./monthly-source-contract.js'):root.TradeScopeMonthlySourceContract;
  const csv=node?require('../import/csv-core.js'):root.TradeScopeCSV;
  const display=node?require('./transaction-display.js'):root.TradeScopeTransactionDisplay;
  const configs=Object.freeze([
    {product:'lightfx',provider:'lightfx',accountId:'acc_lightfx_fx',scope:'lightfx-monthly-report'},
    {product:'minano',provider:'minna',accountId:'acc_minna_fx',scope:'minna-monthly-report'}
  ].map(Object.freeze));
  const rows=(m,key)=>m?.[key]?.records||[],copy=v=>JSON.parse(JSON.stringify(v));
  const pair=value=>/^\(?([A-Z]{3})\/?([A-Z]{3})\)?$/.exec(String(value??'').toUpperCase().replace(/\s+/g,''));
  const identity=v=>String(v??'').trim().toUpperCase().replace(/\s+/g,'');
  const aliases=c=>new Set([c.accountId,c.product,c.provider,...storage.initialAccounts().find(a=>a.id===c.accountId).legacyRefs,
    storage.initialAccounts().find(a=>a.id===c.accountId).displayName].map(identity));
  const belongs=(v,c)=>v.accountId===c.accountId;
  const balanceDecision=r=>r.kind==='adoption'&&r.currency==='JPY'&&['marketValue','unrealizedPnl','holdings','cashBalance'].includes(r.metric);
  function introduced(m,c){
    return ['accountSnapshots','holdingSnapshots','monthlyAccountInputs','monthlyAccountStates'].some(key=>rows(m,key).some(v=>belongs(v,c)))
      ||rows(m,'monthlySources').some(r=>belongs(r,c)&&(balanceDecision(r)||r.kind==='source'&&r.sourceType==='pdf'));
  }
  function usageMonths(m,c){
    return [...new Set(['monthlyAccountInputs','monthlyAccountStates'].flatMap(key=>rows(m,key).filter(v=>belongs(v,c)).map(v=>v.targetMonth))
      .concat(rows(m,'monthlySources').filter(r=>belongs(r,c)&&balanceDecision(r)).map(r=>r.targetMonth)))].sort();
  }
  // v317 keeps released native references immutable through their exact old fact
  // fingerprint. Resolve the corresponding Snapshot, never the mutable pointer alone.
  function snapshotFor(source,m){
    const ref=source?.reference;if(source?.sourceType!=='pdf'||!ref)return null;
    if(ref.entity==='accountSnapshots')return rows(m,'accountSnapshots').find(v=>v.id===ref.id)??null;
    if(!['monthlyAccountInputs','monthlyAccountStates'].includes(ref.entity))return null;
    const record=rows(m,ref.entity).find(v=>v.id===ref.id);if(!record)return null;
    const matches=new Set();
    for(const fact of [record,...record.sourceHistory]){
      const old={...record,adoptedAccountSnapshotId:fact.adoptedAccountSnapshotId,sourceValues:fact.sourceValues,sourceHistory:[]};
      const virtual={...m,[ref.entity]:{...m[ref.entity],records:rows(m,ref.entity).map(v=>v.id===record.id?old:v)}};
      if(core.sourceFingerprint({...source,fingerprint:'0'.repeat(64)},virtual)===source.fingerprint)matches.add(fact.adoptedAccountSnapshotId);
    }
    return matches.size===1?rows(m,'accountSnapshots').find(v=>v.id===[...matches][0])??null:null;
  }
  function resolve(models,product,{targetMonth}={}){
    const c=configs.find(v=>v.product===product);if(!c)throw Error('UNSUPPORTED_OFFICIAL_FX_ACCOUNT');
    if(targetMonth!==undefined&&!/^\d{4}-(0[1-9]|1[0-2])$/.test(targetMonth))throw Error('INVALID_OFFICIAL_POSITION_MONTH');
    const base={accountId:c.accountId,provider:c.provider,targetMonth:targetMonth??null,sourceMonth:null,snapshotAsOf:null,
      hasOfficialSource:true,status:'unknown',confirmedEmpty:false,holdings:[]};
    try{
      storage.validateModels(models);
      if(!introduced(models,c))return {...base,status:'legacy',hasOfficialSource:false};
      const month=targetMonth??usageMonths(models,c).at(-1);
      if(!month)return {...base,reason:'no-balance-selection'};
      base.targetMonth=month;
      const native=['monthlyAccountInputs','monthlyAccountStates'].flatMap(key=>rows(models,key).filter(v=>belongs(v,c)&&v.targetMonth===month));
      if(new Set(native.map(v=>v.adoptedAccountSnapshotId)).size>1)return {...base,reason:'conflict'};
      const balance=scalars.forBroker(product).resolve(models,month);
      if(!balance||balance.blocked)return {...base,reason:'unavailable-balance'};
      if(balance.metrics.some(v=>v.source&&core.sourceFingerprint(v.source,models)!==v.source.fingerprint))return {...base,reason:'stale-balance'};
      const selected=balance.metrics.map(v=>v.value===null?null:snapshotFor(v.source,models));
      if(selected.some(v=>!v)||new Set(selected.map(v=>v.id)).size!==1)return {...base,reason:'ambiguous-balance'};
      const snapshot=selected[0],batch=rows(models,'importBatches').find(v=>v.id===snapshot.importBatchId);
      const account=rows(models,'accounts').find(v=>v.id===c.accountId);
      const end=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),0)).toISOString().slice(0,10);
      // This released importer requires a recognised position section and saves
      // its whole set atomically. Unsupported lineage is not evidence of empty.
      if(account?.providerCode!==c.provider||account.accountType!=='fx'||!account.enabled
        ||snapshot.schemaVersion!==2||snapshot.accountId!==c.accountId||snapshot.sourceScope!==c.scope||snapshot.sourceMode!=='imported'
        ||snapshot.observationType!=='officialMonthEnd'||snapshot.targetMonth!==month||snapshot.snapshotAsOf!==end||snapshot.valuationCurrency!=='JPY'
        ||!batch||batch.accountId!==c.accountId||batch.sourceProvider!==c.provider||batch.sourceType!=='pdf'
        ||batch.targetMonth!==month||batch.snapshotAsOf!==end||batch.importerVersion!=='traders-monthly-v1'
        ||!['traders-monthly',c.provider+'-executions'].includes(batch.importerId)
        ||!/^[a-f0-9]{64}$/.test(batch.sourceFileMetadata?.hash??'')||!(batch.sourceFileMetadata.size>=8))return {...base,reason:'unsupported-lineage'};
      const holdings=rows(models,'holdingSnapshots').filter(v=>v.accountSnapshotId===snapshot.id);
      const orders=new Set();
      for(const h of holdings){
        const instrument=rows(models,'instruments').find(i=>i.id===h.instrumentId),symbol=pair(instrument?.symbol);
        if(h.schemaVersion!==2||h.accountId!==c.accountId||h.importBatchId!==batch.id||h.sourceScope!==c.scope
          ||h.targetMonth!==month||h.snapshotAsOf!==end||h.observationType!=='officialMonthEnd'||orders.has(h.fxPosition.orderId)
          ||['acquisitionPrice','marketPrice'].some(k=>h[k].startsWith('-')||storage.equalDecimal(h[k],'0'))
          ||h.fxPosition.executedAt.slice(0,10)>end||!symbol
          ||instrument.baseCurrency!==undefined&&instrument.baseCurrency!==symbol[1]
          ||instrument.quoteCurrency!==undefined&&instrument.quoteCurrency!==symbol[2])return {...base,reason:'invalid-holding'};
        orders.add(h.fxPosition.orderId);
      }
      if(!holdings.length&&!['requiredMargin','orderRequiredMargin','monthEndUnsettledSwap','reportedAccountEvaluationPnl'].every(k=>storage.equalDecimal(snapshot.accountSpecific[k],'0')))
        return {...base,reason:'empty-not-proven'};
      return {...base,status:'official',sourceMonth:month,snapshotAsOf:end,confirmedEmpty:holdings.length===0,
        accountSnapshotId:snapshot.id,importBatchId:batch.id,completenessBasis:'traders-monthly-v1/snapshot-v2',
        holdings:holdings.map(h=>{const instrument=rows(models,'instruments').find(i=>i.id===h.instrumentId),symbol=pair(instrument.symbol);return {
          holdingSnapshotId:h.id,accountSnapshotId:snapshot.id,importBatchId:batch.id,accountId:c.accountId,provider:c.provider,
          instrumentId:h.instrumentId,symbol:symbol[1]+'/'+symbol[2],baseCurrency:symbol[1],quoteCurrency:symbol[2],
          quantity:h.quantity,quantityUnit:h.fxPosition.quantityUnit,side:h.fxPosition.side,acquisitionPrice:h.acquisitionPrice,
          marketPrice:h.marketPrice,unrealizedPnl:h.unrealizedPnl,unsettledSwap:h.fxPosition.unsettledSwap,requiredMargin:h.fxPosition.requiredMargin,
          executedAt:h.fxPosition.executedAt,sourceOrderRef:h.fxPosition.orderId,targetMonth:month,snapshotAsOf:end};})};
    }catch(_){return {...base,reason:'invalid-reference'};}
  }
  const accounts=models=>configs.map(c=>resolve(models,c.product));
  function legacyEntries(entries,observations){
    const suppressed=configs.filter(c=>observations.some(v=>v.accountId===c.accountId&&v.status!=='legacy')).map(aliases);
    return (entries||[]).filter(e=>!suppressed.some(set=>set.has(identity(e.account))));
  }
  // Display-only exact decimal arithmetic. Non-terminating weighted means are
  // rounded half-up to 18 fractional places; no canonical number is changed.
  function parts(value){const [a,b='']=value.split('.');return {n:BigInt(a+b),scale:b.length};}
  function scaled(n,scale){const sign=n<0n?'-':'',digits=String(n<0n?-n:n).padStart(scale+1,'0');return display.number(sign+(scale?digits.slice(0,-scale)+'.'+digits.slice(-scale):digits)).replaceAll(',','');}
  function average(holdings,total){const value=csv.sum(holdings.map(h=>display.multiply(h.quantity,h.acquisitionPrice))),a=parts(value),b=parts(total),scale=18;
    const numerator=a.n*10n**BigInt(b.scale+scale),denominator=b.n*10n**BigInt(a.scale);return scaled((numerator+denominator/2n)/denominator,scale);}
  function project(observation){
    if(observation.status!=='official')return [];
    const groups=new Map();
    for(const holding of observation.holdings){const key=JSON.stringify([holding.accountId,holding.instrumentId,holding.side]);
      if(!groups.has(key))groups.set(key,[]);groups.get(key).push(holding);}
    return [...groups.values()].map(holdings=>{
      const first=holdings[0],quantity=csv.sum(holdings.map(h=>h.quantity)),lotSize=display.getFxLotSize({provider:first.provider,accountId:first.accountId,instrument:first.symbol});
      const q=parts(quantity),lots=lotSize?scaled(q.n,q.scale+(lotSize===100000?5:4)):null;
      const sameRate=holdings.every(h=>storage.equalDecimal(h.marketPrice,first.marketPrice));
      return {...copy(first),holdingType:'official-fx-observation',account:first.accountId,assetType:'FX',quantity,quantityUnit:'reportedQuantity',
        acquisitionPrice:holdings.every(h=>storage.equalDecimal(h.acquisitionPrice,first.acquisitionPrice))?first.acquisitionPrice:average(holdings,quantity),marketPrice:sameRate?first.marketPrice:null,marketPriceConflict:!sameRate,
        unrealizedPnl:csv.sum(holdings.map(h=>h.unrealizedPnl)),unsettledSwap:csv.sum(holdings.map(h=>h.unsettledSwap)),requiredMargin:csv.sum(holdings.map(h=>h.requiredMargin)),
        displayLots:lots,quantityLabel:lots!==null?display.number(lots)+' Lot':display.number(quantity)+' '+first.baseCurrency,
        sourceMonth:observation.sourceMonth,holdings:copy(holdings)};
    });
  }
  const api=Object.freeze({resolve,accounts,legacyEntries,project});
  if(node)module.exports=api;else root.TradeScopeOfficialFXPositionView=api;
})(typeof globalThis!=='undefined'?globalThis:this);
