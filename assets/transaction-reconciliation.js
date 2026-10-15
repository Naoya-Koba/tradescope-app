(function(root){
 'use strict';
 const rows=(m,e)=>m?.[e]?.records||[],manualKey='tradeScopeTradeHistoryV1';
 const aliases={gmo:'acc_gmo_fx',gmofxneo:'acc_gmo_fx',lightfx:'acc_lightfx_fx','みんなのfx':'acc_minna_fx',minna:'acc_minna_fx',minano:'acc_minna_fx',sbi:'acc_sbi_sec','sbi証券':'acc_sbi_sec',sbivc:'acc_sbivc_crypto','sbivcトレード':'acc_sbivc_crypto'};
 const decimals=v=>{if(v===null||v===undefined||v==='')return null;let s=String(v);if(typeof v==='number'&&Number.isFinite(v)&&/e/i.test(s)){const [c,e]=s.split(/e/i),[a,b='']=c.replace('-','').split('.'),p=a.length+Number(e),d=a+b;s=(v<0?'-':'')+(p<=0?'0.'+'0'.repeat(-p)+d:p>=d.length?d+'0'.repeat(p-d.length):d.slice(0,p)+'.'+d.slice(p));}return /^-?\d+(?:\.\d+)?$/.test(s)?s.replace(/(\.\d*?)0+$/,'$1').replace(/\.$/,'').replace(/^(-?)0+(?=\d)/,'$1').replace(/^-0$/,'0'):null;};
 function sum(values){const parts=values.map(v=>decimals(v));if(parts.some(v=>v===null))return null;const scale=Math.max(0,...parts.map(v=>(v.split('.')[1]||'').length));let n=0n;for(const v of parts){const [a,b='']=v.replace('-','').split('.');n+=(v.startsWith('-')?-1n:1n)*BigInt(a+b.padEnd(scale,'0'));}const sign=n<0n?'-':'',s=(n<0n?-n:n).toString().padStart(scale+1,'0');return decimals(sign+(scale?s.slice(0,-scale)+'.'+s.slice(-scale):s));}
 function multiply(a,b){a=decimals(a);b=decimals(b);if(a===null||b===null)return null;const scale=(a.split('.')[1]||'').length+(b.split('.')[1]||'').length,n=BigInt(a.replace('.',''))*BigInt(b.replace('.','')),s=(n<0n?-n:n).toString().padStart(scale+1,'0');return decimals((n<0n?'-':'')+(scale?s.slice(0,-scale)+'.'+s.slice(-scale):s));}
 function readManual(adapter){const raw=adapter.getItem(manualKey);let records;try{records=raw===null?[]:JSON.parse(raw);}catch(_){throw Error('手入力データを読み取れませんでした');}if(!Array.isArray(records))throw Error('手入力データを読み取れませんでした');return{raw,records};}
 const accountKey=v=>String(v||'').trim().replace(/\s/g,'').toLowerCase();
 const account=(v,m)=>{const direct=rows(m,'accounts').find(a=>a.id===v)?.id||aliases[accountKey(v)]||(accountKey(v)==='gmoクリック証券'?'acc_gmo_fx':null);if(direct)return direct;
  const matches=rows(m,'accounts').filter(a=>[a.displayName,...(a.legacyRefs||[])].some(name=>accountKey(name)===accountKey(v)));return matches.length===1?matches[0].id:null;};
 const pair=v=>{const match=/^([A-Za-z][A-Za-z0-9]{1,19})[-/]([A-Za-z]{3})$/.exec(String(v||''));return match?match[1].toUpperCase()+'/'+match[2].toUpperCase():null;};
 function facts(entity,r,m){
  if(!r||typeof r!=='object'||Array.isArray(r))return null;
  const isManual=entity==='manual',accountId=isManual?account(r.account,m):r.accountId;
  let ins=rows(m,'instruments').find(i=>i.id===r.instrumentId);
  if(isManual){const allowed=r.assetType==='FX'?['FX']:['暗号資産','Crypto'].includes(r.assetType)?['Crypto']:['証券','Stock','ETF','MutualFund','NISA'].includes(r.assetType)?['Stock','ETF','MutualFund']:[];
   const matches=rows(m,'instruments').filter(i=>i.enabled&&allowed.includes(i.assetType)&&([i.symbol,i.displayName,...(i.aliases||[])].includes(r.symbol)||['FX','Crypto'].includes(i.assetType)&&pair(i.symbol)&&pair(i.symbol)===pair(r.symbol)));if(matches.length!==1)return null;ins=matches[0];}
  if(!accountId||!ins)return null;
  const date=isManual?r.date:r.tradeDate||r.executedAt?.slice(0,10),side=r.side||({'現物買':'buy','現物売':'sell','投信金額買付':'buy'}[r.transactionType]);
  let semantic=isManual?({'new':'open',add:'open',partial_close:'close',full_close:'close'}[r.category]):r.normalizedTransactionType||({'現物買':'open','現物売':'close','投信金額買付':'open'}[r.transactionType]);
  if(ins.assetType==='Crypto'&&isManual){if(!['暗号資産','Crypto'].includes(r.assetType)||!semantic)return null;semantic=side==='buy'?'spot-buy':side==='sell'?'spot-sell':null;}
  // Matching-only source policy: the existing SBI domestic Stock/ETF CSV contract
  // reports shares at JPY prices. Do not extend this to funds or unknown products.
  const domesticShares=!isManual&&r.accountId==='acc_sbi_sec'&&r.sourceProvider==='sbi'&&r.sourceType==='csv'
    &&['Stock','ETF'].includes(ins.assetType)&&['国内株式','国内ETF'].includes(r.rawFields?.product);
  let quantity=decimals(r.quantity),price=decimals(isManual?r.rate:r.price),quantityUnit=null,currency=r.currency||ins.quoteCurrency||pair(ins.symbol)?.split('/')[1]||null;
  // FX record.currency is the individual P/L currency, not the execution quote.
  if(ins.assetType==='FX')currency=ins.quoteCurrency||pair(ins.symbol)?.split('/')[1]||null;
  if(!currency&&(domesticShares||isManual&&['Stock','ETF','証券','NISA'].includes(r.assetType)&&['株','shares'].includes(r.quantityUnit)))currency='JPY';
  if(ins.assetType==='Crypto')quantityUnit=isManual||r.quantityUnit==='baseAssetUnits'?'baseAssetUnits':null;
  else if(ins.assetType==='FX'){
   if(isManual&&r.assetType==='FX'&&decimals(r.contractSize)&&Number(r.contractSize)>0){quantity=multiply(quantity,r.contractSize);quantityUnit='currencyUnits';}
   else if(r.quantityUnit==='gmo-reported-count')quantityUnit='currencyUnits';
  }else if(['株','shares'].includes(r.quantityUnit)||!r.quantityUnit&&domesticShares)quantityUnit='shares';
  else if(['口','fundUnits'].includes(r.quantityUnit))quantityUnit='fundUnits';
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||!['buy','sell'].includes(side)||!['open','close','spot-buy','spot-sell'].includes(semantic)
    ||quantity===null||quantity.startsWith('-')||quantity==='0'||price===null||price.startsWith('-')||!quantityUnit||!currency)return null;
  return{accountId,instrumentId:ins.id,tradeDate:date,side,semantic,quantity,quantityUnit,price,currency};
 }
 const identity=f=>JSON.stringify(Object.fromEntries(Object.entries(f).filter(([k])=>k!=='quantity')));
 function grouped(sources,m){const groups=new Map();for(const source of sources){const f=facts(source.entity,source.record,m);if(!f)continue;const key=JSON.stringify([source.record.importBatchId,identity(f)]);if(!groups.has(key))groups.set(key,{facts:f,members:[],sourceType:source.record.sourceType});groups.get(key).members.push(source);}
  return [...groups.values()].map(g=>({...g,facts:{...g.facts,quantity:sum(g.members.map(s=>s.record.quantity))}}));}
 const ref=s=>({entity:s.entity,id:s.record.id});
 const evidence=s=>JSON.stringify([s.entity,s.record.sourceProvider,s.record.providerExecutionId||s.record.externalTransactionId||null,s.record.providerOrderId||null,
   s.record.executedAt||null,s.record.side||s.record.transactionType,decimals(s.record.quantity),decimals(s.record.price),decimals(s.record.fee),s.record.feeCurrency||null,s.record.feeSemantics||null,decimals(s.record.realizedPnl),s.record.currency||null]);
 const evidenceSet=sources=>JSON.stringify(sources.map(evidence).sort());
 function candidates(manual,m,sources){const known=new Set(rows(m,'transactionReconciliations').filter(r=>r.schemaVersion===1&&r.decision!=='defer').map(r=>r.manualId)),groups=grouped(sources,m),result=[];
  for(const r of manual){if(typeof r?.id!=='string'||!r.id||known.has(r.id))continue;const f=facts('manual',r,m);if(!f)continue;
   const matches=groups.filter(g=>JSON.stringify(g.facts)===JSON.stringify(f)
     &&(!r.executedAt||g.members.every(s=>s.record.executedAt===r.executedAt))
     &&(r.realizedPnl==null||g.members.every(s=>s.record.realizedPnl!=null)&&decimals(r.realizedPnl)===sum(g.members.map(s=>s.record.realizedPnl))));for(const g of matches){
    // Decision keys bind all source facts, not transient Preview IDs or array positions.
    const symbol=rows(m,'instruments').find(i=>i.id===f.instrumentId)?.symbol||r.symbol;
    result.push({key:JSON.stringify([r.id,{...f,instrumentId:symbol},evidenceSet(g.members)]),manualId:r.id,facts:f,members:g.members.map(ref),sourceType:g.sourceType,
      count:g.members.length,account:rows(m,'accounts').find(a=>a.id===f.accountId)?.displayName||r.account,symbol:rows(m,'instruments').find(i=>i.id===f.instrumentId)?.symbol||r.symbol,side:f.side,
      quantity:f.quantity,price:f.price,ambiguous:matches.length!==1||manual.filter(other=>other.id===r.id).length!==1||manual.filter(other=>JSON.stringify(facts('manual',other,m))===JSON.stringify(f)).length!==1});
   }
  }return result;
 }
 function validateRelation(r,m){
  const sources=r.members.map(s=>({entity:s.entity,record:rows(m,s.entity).find(v=>v.id===s.id)}));
  if(sources.some(s=>!s.record))return false;const groups=grouped(sources,m);
  const complete=grouped(['rawTransactions','importedTransactions'].flatMap(entity=>rows(m,entity).filter(row=>row.importBatchId===sources[0].record.importBatchId).map(record=>({entity,record}))),m)
    .filter(g=>JSON.stringify(g.facts)===JSON.stringify(r.facts));
  return groups.length===1&&complete.length===1&&complete[0].members.length===r.members.length&&JSON.stringify(groups[0].facts)===JSON.stringify(r.facts)&&groups[0].sourceType===r.sourceType;
 }
 function statuses(manual,m,activeSources){const groups=grouped(activeSources,m);return rows(m,'transactionReconciliations').filter(r=>r.schemaVersion===1).map(r=>{
  const original=manual.filter(x=>x.id===r.manualId),unchanged=original.length===1&&JSON.stringify(facts('manual',original[0],m))===JSON.stringify(r.facts);
  const originalSources=r.members.map(member=>({entity:member.entity,record:rows(m,member.entity).find(t=>t.id===member.id)}));
  const matches=groups.filter(g=>JSON.stringify(g.facts)===JSON.stringify(r.facts)&&originalSources.every(s=>s.record)&&evidenceSet(g.members)===evidenceSet(originalSources));
  return{relation:r,unchanged,resolved:matches.length===1,members:matches.length===1?matches[0].members.map(ref):[]};});}
 function inspect(adapter,m,sources,outcome){const list=candidates(readManual(adapter).records,m,sources);return{...outcome,...(list.length?{manualMatches:list,status:outcome.status==='already-imported'?'reconciliation-ready':outcome.status}:{})};}
 function addedSources(before,after){return ['rawTransactions','importedTransactions'].flatMap(entity=>rows(after,entity).filter(r=>!rows(before,entity).some(old=>old.id===r.id)).map(record=>({entity,record})));}
 function inspectChanges(adapter,before,changes,outcome){const after={...before,...changes};return inspect(adapter,after,addedSources(before,after),outcome);}
 function continuity(adapter,before,after,activeSources){const manual=readManual(adapter).records;
  const old=statuses(manual,before,activeSources(before)),next=statuses(manual,after,activeSources(after));
  if(old.some(d=>d.relation.decision==='replace'&&d.unchanged&&d.resolved&&!next.find(n=>n.relation.id===d.relation.id)?.resolved))
   throw Error('訂正内容と手入力の置き換えを照合できませんでした');
 }
 function finish(adapter,before,changes,confirmation,now,newId,activeSources){
  const manual=readManual(adapter),after={...before,...changes},sources=[];
  for(const entity of ['rawTransactions','importedTransactions'])for(const r of rows(after,entity))if(!rows(before,entity).some(old=>old.id===r.id))sources.push({entity,record:r});
  // Same-hash reconciliation can confirm relationships without touching imported records.
  if(!sources.length&&activeSources)sources.push(...activeSources);
  const list=candidates(manual.records,after,sources),decisions=confirmation?.transactionDecisions||[];
  if(list.length&&(decisions.length!==list.length||list.some(c=>!decisions.some(d=>d.key===c.key&&['replace','keep-both','defer'].includes(d.decision)&&!(c.ambiguous&&d.decision==='replace')))))
   return{status:'confirmation-required',manualMatches:list};
  if(decisions.length&&!list.length)throw Error('手入力データが変更されています。再確認してください');
  if(new Set(list.map(c=>c.manualId)).size!==list.length&&decisions.some(d=>d.decision==='replace'))throw Error('一致する取引を一意に確認できませんでした');
  const added=[];for(const c of list){if(added.some(r=>r.manualId===c.manualId))continue;
   const pending=rows(before,'transactionReconciliations').find(r=>r.schemaVersion===1&&r.manualId===c.manualId&&r.decision==='defer');
   added.push({schemaVersion:1,id:pending?.id||newId(),manualId:c.manualId,decision:decisions.find(d=>d.key===c.key).decision,sourceType:c.sourceType,facts:c.facts,members:c.members,confirmedAt:now});}
  if(added.length)changes.transactionReconciliations={schemaVersion:1,records:[...rows(before,'transactionReconciliations').filter(r=>!added.some(a=>a.id===r.id)),...added],updatedAt:now};
  return{status:'ready',expectedManual:manual.raw};
 }
 const api=Object.freeze({manualKey,decimals,sum,facts,grouped,candidates,validateRelation,statuses,readManual,inspect,inspectChanges,continuity,finish});
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TradeScopeTransactionReconciliation=api;
})(typeof globalThis!=='undefined'?globalThis:this);
