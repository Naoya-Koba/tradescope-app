(function(root){
 'use strict';
 const node=typeof module!=='undefined'&&module.exports,reconciliation=node?require('./transaction-reconciliation.js'):root.TradeScopeTransactionReconciliation;
 const version='transactions-view-v3',rows=(m,e)=>m?.[e]?.records||[];
 const aliases=Object.freeze({gmo:'acc_gmo_fx','gmofxneo':'acc_gmo_fx','gmoクリック証券':'acc_gmo_fx',lightfx:'acc_lightfx_fx','みんなのfx':'acc_minna_fx',minna:'acc_minna_fx',minano:'acc_minna_fx',sbi:'acc_sbi_sec','sbi証券':'acc_sbi_sec','sbivc':'acc_sbivc_crypto','sbivcトレード':'acc_sbivc_crypto','三井住友銀行':'acc_smbc_bank'});
 const labels=Object.freeze({acc_gmo_fx:'GMO FXneo',acc_lightfx_fx:'LIGHT FX',acc_minna_fx:'みんなのFX',acc_sbi_sec:'SBI証券',acc_sbivc_crypto:'SBI VC',acc_smbc_bank:'三井住友銀行'});
 const accountKey=v=>String(v??'').trim().replace(/\s/g,'').toLowerCase();
 function accountId(value,models){if(labels[value])return value;const match=aliases[accountKey(value)];if(match)return match;
  const candidates=rows(models,'accounts').filter(a=>[a.displayName,...(a.legacyRefs||[])].some(n=>accountKey(n)===accountKey(value)));return candidates.length===1?candidates[0].id:null;}
 function fxPair(value){const m=/^([A-Za-z]{3})[-/]?([A-Za-z]{3})$/.exec(String(value??'').trim());return m?`${m[1].toUpperCase()}/${m[2].toUpperCase()}`:null;}
 function decimal(v){if(v===null||v===undefined||v==='')return null;let text=String(v);
  // Preserve finite legacy Number facts, including tiny crypto quantities. No rounding or unit conversion.
  if(typeof v==='number'&&Number.isFinite(v)&&/e/i.test(text)){const [coefficient,exponent]=text.toLowerCase().split('e'),sign=coefficient.startsWith('-')?'-':'',parts=coefficient.replace('-','').split('.'),digits=parts.join(''),point=parts[0].length+Number(exponent);
   text=sign+(point<=0?'0.'+'0'.repeat(-point)+digits:point>=digits.length?digits+'0'.repeat(point-digits.length):digits.slice(0,point)+'.'+digits.slice(point));}
  return /^-?\d+(?:\.\d+)?$/.test(text)?text.replace(/(\.\d*?)0+$/,'$1').replace(/\.$/,'').replace(/^-0$/,'0'):null;}
 const types=Object.freeze({new:'open',add:'open',partial_close:'close',full_close:'close','新規':'open','決済':'close','投信金額買付':'open','現物買':'open','現物売':'close'});
 // Only explicit unit labels are comparable. GMO's printed 約定数 has no verified lot size.
 function unit(value,assetType,contractSize){if(['株','shares'].includes(value))return 'shares';if(['口','fundUnits'].includes(value))return 'fundUnits';
  const size=decimal(contractSize);if(['lot','lots'].includes(value)&&size!==null&&!/^(?:-|0$)/.test(size))return `lots:${size}`;return null;}
 function instrument(symbol,assetType,id,models){const master=rows(models,'instruments').find(r=>r.id===id),type=master?.assetType||assetType;
  const pair=type==='FX'?fxPair(symbol)||fxPair(master?.symbol):null;
  if(pair)return{instrumentId:id||null,instrumentKey:'FX:'+pair,symbol:pair,assetType:'FX'};
  const exact=rows(models,'instruments').filter(r=>r.symbol===symbol||r.displayName===symbol);
  const chosen=master||(!id&&exact.length===1?exact[0]:null);return{instrumentId:chosen?.id||null,instrumentKey:chosen?'ID:'+chosen.id:null,symbol:symbol||chosen?.symbol||'—',assetType:type||'その他'};}
 function activeBatches(models){const ids=new Set();for(const state of rows(models,'monthlyAccountStates')){const snap=rows(models,'accountSnapshots').find(s=>s.id===state.adoptedAccountSnapshotId);if(snap)ids.add(snap.importBatchId);}
  for(const input of rows(models,'monthlyAccountInputs')){
   if(input.accountId!=='acc_sbivc_crypto'||![3,4].includes(input.schemaVersion))continue;
   const matches=rows(models,'monthlyAccountInputs').filter(i=>i.accountId===input.accountId&&i.targetMonth===input.targetMonth);
   const snap=rows(models,'accountSnapshots').find(s=>s.id===input.adoptedAccountSnapshotId),batch=rows(models,'importBatches').find(b=>b.id===snap?.importBatchId);
   if(matches.length===1&&snap?.accountId===input.accountId&&snap.targetMonth===input.targetMonth&&snap.sourceScope==='sbivc-monthly-assets'
     &&snap.sourceMode==='imported'&&batch?.accountId===input.accountId&&batch.targetMonth===input.targetMonth&&batch.sourceProvider==='sbivc'&&batch.sourceType==='pdf'&&batch.importerId==='sbivc-monthly')ids.add(batch.id);
  }return ids;}
 function normalize(manual,models){
  const normalized=[];
  for(const e of manual||[]){if(!e||typeof e!=='object')continue;const account=accountId(e.account,models),date=String(e.date||''),quantity=decimal(e.quantity),price=decimal(e.rate);
   if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||quantity===null||price===null)continue;
   normalized.push({id:'manual:'+e.id,manualId:e.id,date,executedAt:null,accountId:account,account:labels[account]||String(e.account||''),...instrument(e.symbol,e.assetType||'FX',null,models),
    side:['buy','sell'].includes(e.side)?e.side:null,type:types[e.category]||'other',category:e.category||'other',quantity,quantityUnit:e.assetType==='FX'?'Lot':e.quantityUnit||null,unitKey:unit(e.quantityUnit,e.assetType,e.contractSize),price,realizedPnl:decimal(e.realizedPnl),currency:e.currency||null,
    strategy:e.strategy||'',memo:e.memo||'',sources:[{kind:'manual',id:e.id}],sourceLabel:'手入力',sourceProvider:null,executionId:null,orderId:null});
  }
  for(const r of rows(models,'rawTransactions')){if(r.sourceProvider!=='sbi'||r.sourceType!=='csv')continue;const ins=rows(models,'instruments').find(i=>i.id===r.instrumentId),date=r.executedAt?.slice(0,10)||'';if(!date)continue;
   normalized.push({id:'raw:'+r.id,manualId:null,date,executedAt:r.executedAt.length>10?r.executedAt:null,accountId:r.accountId,account:labels[r.accountId]||r.accountId,
    ...instrument(r.rawFields?.name||r.brokerRawSymbol||ins?.symbol,ins?.assetType,r.instrumentId,models),side:['buy','sell'].includes(r.side)?r.side:({'現物買':'buy','現物売':'sell','投信金額買付':'buy'}[r.transactionType]||null),type:types[r.transactionType]||'other',category:r.transactionType,
    quantity:decimal(r.quantity),quantityUnit:r.quantityUnit||null,unitKey:unit(r.quantityUnit,ins?.assetType,null),price:decimal(r.price),realizedPnl:decimal(r.realizedPnl),currency:r.currency||null,strategy:'',memo:'',
    sources:[{kind:'sbi',id:r.id,importBatchId:r.importBatchId}],sourceLabel:'SBI CSV',sourceProvider:'sbi',executionId:r.externalTransactionId||null,orderId:null});
  }
  const active=activeBatches(models);
  for(const r of rows(models,'importedTransactions')){if(!active.has(r.importBatchId))continue;const ins=rows(models,'instruments').find(i=>i.id===r.instrumentId);
   normalized.push({id:'imported:'+r.id,manualId:null,date:r.tradeDate,executedAt:r.executedAt,accountId:r.accountId,account:labels[r.accountId]||r.accountId,...instrument(ins?.symbol,ins?.assetType,r.instrumentId,models),
    side:r.side,type:r.normalizedTransactionType,category:r.rawTransactionType,marketType:r.marketType||null,quantity:r.quantity,quantityUnit:r.schemaVersion===2?r.quantityUnit:'約定数',unitKey:null,price:r.price,realizedPnl:r.realizedPnl,fee:r.fee,feeSemantics:r.feeSemantics||null,currency:r.currency,strategy:'',memo:'',
    sources:[{kind:r.schemaVersion===2?'sbivc':'gmo',id:r.id,importBatchId:r.importBatchId,page:r.sourcePage,row:r.sourceRow}],sourceLabel:r.schemaVersion===2?'SBI VC PDF':'GMO PDF',sourceProvider:r.sourceProvider,executionId:r.providerExecutionId,orderId:r.providerOrderId});
  }
  return normalized;
 }
 const signature=r=>r.accountId&&r.instrumentKey&&r.side&&r.quantity!==null&&r.price!==null&&r.type!=='other'
  ?JSON.stringify([r.accountId,r.instrumentKey,r.side,r.date,r.type,r.unitKey,decimal(r.quantity),decimal(r.price)]):null;
 const compatible=(a,b)=>['realizedPnl','currency'].every(k=>a[k]===null||b[k]===null||a[k]===b[k])
  &&(!(a.sourceProvider==='sbivc'||b.sourceProvider==='sbivc')||a.fee===b.fee&&a.feeSemantics===b.feeSemantics);
 function activeSources(models){const active=activeBatches(models);return [...rows(models,'rawTransactions').filter(r=>r.sourceType==='csv'&&r.sourceProvider==='sbi').map(record=>({entity:'rawTransactions',record})),
   ...rows(models,'importedTransactions').filter(r=>active.has(r.importBatchId)).map(record=>({entity:'importedTransactions',record}))];}
 function resolve(manual,models){const records=normalize(manual,models),hidden=new Set(),groups=new Map();
  const sources=activeSources(models);
  const decisions=reconciliation.statuses(manual,models,sources),decided=new Set(decisions.map(d=>d.relation.manualId));
  for(const d of decisions)if(d.relation.decision==='replace'&&d.unchanged&&d.resolved)hidden.add('manual:'+d.relation.manualId);
  for(const r of records.filter(r=>r.sources[0].kind!=='manual')){let key;
   if(r.executionId||r.orderId&&r.executedAt)key=JSON.stringify([r.accountId,r.sourceProvider,r.executionId?'execution':'order',r.executionId||r.orderId]);
   else if(!r.orderId&&r.executedAt&&r.quantityUnit&&signature(r))key=JSON.stringify([r.sourceProvider,'exact-facts',r.executedAt,r.quantityUnit,signature(r)]);
   if(!key)continue;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);}
  for(const group of groups.values()){if(group.length<2||new Set(group.map(r=>r.sources[0].importBatchId)).size!==group.length)continue;
   const first=group[0];if(signature(first)&&group.every(r=>signature(r)===signature(first)&&r.quantityUnit===first.quantityUnit&&r.executedAt===first.executedAt&&compatible(r,first))){for(const r of group.slice(1)){first.sources.push(...r.sources);hidden.add(r.id);}}}
  const official=new Map(),manuals=new Map();for(const r of records.filter(r=>!hidden.has(r.id))){const key=r.unitKey?signature(r):null;if(!key)continue;const map=r.manualId?manuals:official;if(!map.has(key))map.set(key,[]);map.get(key).push(r);}
  for(const [key,m]of manuals){const i=official.get(key);if(m.length!==1||decided.has(m[0].manualId)||i?.length!==1||!compatible(m[0],i[0]))continue;const target=i[0],source=m[0];target.sources.push(...source.sources);target.manualId=source.manualId;target.strategy=source.strategy;target.memo=source.memo;target.sourceLabel+='＋手入力';hidden.add(source.id);}
  return records.filter(r=>!hidden.has(r.id)).sort((a,b)=>(b.executedAt||b.date).localeCompare(a.executedAt||a.date)||a.id.localeCompare(b.id));
 }
 function filter(records,{month,account='',symbol='',type='',source='',strategy='',order='desc'}={}){return records.filter(r=>r.date.slice(0,7)===month&&(!account||r.accountId===account)&&(!symbol||r.instrumentKey===symbol||r.symbol===symbol)
   &&(!type||r.type===type)&&(!source||r.sources.some(s=>s.kind===source))&&(!strategy||r.strategy===strategy)).sort((a,b)=>order==='asc'?(a.executedAt||a.date).localeCompare(b.executedAt||b.date):(b.executedAt||b.date).localeCompare(a.executedAt||a.date));}
 const api=Object.freeze({version,accountId,fxPair,normalize,resolve,filter,activeBatches,activeSources,labels});if(node)module.exports=api;else root.TradeScopeTransactionView=api;
})(typeof globalThis!=='undefined'?globalThis:this);
