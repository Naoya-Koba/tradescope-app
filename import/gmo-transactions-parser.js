(function(root){
 'use strict';
 const node=typeof module!=='undefined'&&module.exports,csv=node?require('./csv-core.js'):root.TradeScopeCSV;
 function parse(document,targetMonth,official,helpers){
  const {lines,clean,decimal,equal}=helpers,rows=[],closeRows=[],errors=[],warnings=[];let sectionCount=0,closeSectionCount=0;
  const issue=code=>{if(!errors.includes(code))errors.push(code);};
  const names=['注文番号','約定日時','通貨ペア','取引','売買','約定数','約定単価','約定金額','通貨','手数料','受渡日'];
  const currency=value=>({'日本円':'JPY',JPY:'JPY','米ドル':'USD','米国ドル':'USD',USD:'USD'}[clean(value)]||null);
  function date(raw){const m=/^(\d{2})\/(\d{2})\/(\d{2})(?:\s+(\d{2}:\d{2}:\d{2}))?$/.exec(raw.trim());if(!m||!targetMonth||m[1]!==targetMonth.slice(2,4)||m[2]!==targetMonth.slice(5))return null;
   const tradeDate=targetMonth+'-'+m[3],day=new Date(Date.UTC(Number(targetMonth.slice(0,4)),Number(m[2])-1,Number(m[3])));
   if(day.getUTCMonth()+1!==Number(m[2])||day.getUTCDate()!==Number(m[3])||m[4]&&m[4].split(':').some((v,i)=>Number(v)>=(i?60:24)))return null;
   return {tradeDate,executedAt:m[4]?tradeDate+'T'+m[4]:null};}
  function values(row,anchors){return anchors.map((a,i)=>row.items.filter(item=>item.x>=(i?(anchors[i-1].x+a.x)/2:-Infinity)&&item.x<(i+1<anchors.length?(a.x+anchors[i+1].x)/2:Infinity)).map(i=>i.text).join('').trim());}
  for(const page of document.pages||[]){const all=lines(page);
   for(const header of all){
    const anchors=names.map(name=>header.items.find(i=>clean(i.text)===name));
    if(anchors.every(Boolean)){
     sectionCount++;const end=all.find(r=>r.y<header.y&&/<<|＜＜/.test(r.text));let rowNumber=0;
     for(const line of all.filter(r=>r.y<header.y-3&&r.y>25&&(!end||r.y>end.y))){
      const v=values(line,anchors);if(!/^\d+$/.test(clean(v[0]))&&!/^\d{2}\//.test(v[1]))continue;rowNumber++;
      const d=date(v[1]),symbol=/^[A-Z]{3}\/([A-Z]{3})$/.test(clean(v[2]))?clean(v[2]):null,side=({'買':'buy','売':'sell'})[clean(v[4])],qty=decimal(v[5]),price=decimal(v[6]),fee=decimal(v[9]),feeCurrency=null;
      if(!d||!symbol||!side||qty===null||qty.startsWith('-')||equal(qty,'0')||price===null||price.startsWith('-')||!['新規','決済'].includes(clean(v[3]))||fee===null||!equal(fee,'0')){issue('GMO_TRADE_ROW_INVALID');continue;}
      rows.push({sourcePage:page.number,sourceRow:rowNumber,...d,symbol,side,normalizedTransactionType:clean(v[3])==='新規'?'open':'close',rawTransactionType:clean(v[3]),quantity:qty,quantityUnit:'gmo-reported-count',price,
       realizedPnl:null,fee,feeCurrency,currency:'JPY',providerExecutionId:null,providerOrderId:/^\d{1,64}$/.test(clean(v[0]))?clean(v[0]):null});
     }
    }
   }
   // Close report has two-tier headers. Use the explicitly labelled JPY-converted trade P/L column, not swap.
   const headings=all.filter(r=>/<<決済取引明細>>/.test(clean(r.text)));
   for(const heading of headings){const header=all.find(r=>r.y<heading.y&&r.items.some(i=>clean(i.text)==='約定日時')&&r.items.some(i=>clean(i.text)==='約定数'));
    if(!header){issue('GMO_CLOSE_HEADER_UNSUPPORTED');continue;}closeSectionCount++;
    const prior=all.find(r=>r.y>header.y&&r.y-header.y<15&&r.items.some(i=>clean(i.text)==='取引損益'));
    const yen=header.items.find(i=>clean(i.text)==='円換算額'&&prior?.items.some(p=>clean(p.text)==='取引損益'&&Math.abs(p.x-i.x)<2));
    const anchors=['注文番号','約定日時'].map(n=>header.items.find(i=>clean(i.text)===n));
    anchors.push(header.items.find(i=>clean(i.text)==='通貨ペア取引売買'),header.items.find(i=>clean(i.text)==='約定数'),header.items.find(i=>clean(i.text)==='約定単価'),header.items.find(i=>clean(i.text)==='約定金額'));
    const received=header.items.find(i=>clean(i.text)==='受渡通貨'&&yen&&i.x<yen.x);
    if(anchors.some(a=>!a)||!yen||!received){issue('GMO_CLOSE_HEADER_UNSUPPORTED');continue;}
    const stop=all.find(r=>r.y<header.y&&/<<|＜＜/.test(r.text));
    for(const line of all.filter(r=>r.y<header.y-3&&r.y>25&&(!stop||r.y>stop.y))){const v=values(line,anchors);if(!/^\d+$/.test(clean(v[0]))&&!/^\d{2}\//.test(v[1]))continue;
     // Exactly the combined public pair/type/side cell. Other close-table columns contain currency conversion facts.
     const combined=/^([A-Z]{3}\/[A-Z]{3})(新規|決済)(買|売)$/.exec(clean(v[2]));
     if(!combined){issue('GMO_CLOSE_ROW_INVALID');continue;}if(combined[2]!=='決済')continue;
     const d=date(v[1]),qty=decimal(v[3]),price=decimal(v[4]);
     let amount=decimal(line.items.filter(i=>i.x>=yen.x-12&&i.x<yen.x+45).map(i=>i.text).join(''));
     const receivedCurrency=currency(line.items.filter(i=>i.x>=received.x-0.5&&i.x<yen.x-12).map(i=>i.text).join(''));
     const original=header.items.find(i=>clean(i.text)==='取引損益'&&i.x<received.x);
     const rawAmount=original&&line.items.filter(i=>i.x>=original.x-12&&i.x<received.x-1).map(i=>i.text).join(' ').trim();
     const sourceAmount=rawAmount&&/^([+-]?[\d,]+(?:\.\d+)?)\s+(JPY|USD)$/.exec(rawAmount);
     // A dash in conversion is not zero. Explicit original JPY needs no conversion.
     if(amount===null&&sourceAmount?.[2]==='JPY')amount=decimal(sourceAmount[1]);
     if(amount!==null&&sourceAmount?.[2]==='JPY'&&!equal(amount,decimal(sourceAmount[1]))){issue('GMO_CLOSE_PNL_MISMATCH');continue;}
     if(!d||qty===null||price===null){issue('GMO_CLOSE_ROW_INVALID');continue;}
     closeRows.push({providerOrderId:clean(v[0]),...d,symbol:combined[1],side:combined[3]==='買'?'buy':'sell',quantity:qty,price,realizedPnl:receivedCurrency==='JPY'?amount:null});
    }
   }
  }
  if(!sectionCount&&document.pages.some(p=>p.items.some(i=>clean(i.text)==='<<取引明細>>')))issue('GMO_TRADE_HEADER_UNSUPPORTED');
  const same=(a,b)=>['providerOrderId','tradeDate','executedAt','symbol','side'].every(k=>a[k]===b[k])&&equal(a.quantity,b.quantity)&&equal(a.price,b.price);
  for(const row of rows.filter(r=>r.normalizedTransactionType==='close')){const matches=closeRows.filter(r=>same(row,r)),siblings=rows.filter(r=>r.normalizedTransactionType==='close'&&same(row,r));if(matches.length===1&&siblings.length===1)row.realizedPnl=matches[0].realizedPnl;}
  const closing=rows.filter(r=>r.normalizedTransactionType==='close'),coverage=sectionCount&&errors.length===0?'complete':sectionCount?'partial':'unavailable';
  const pnlCoverage=coverage==='complete'&&closing.every(r=>r.realizedPnl!==null)&&closeRows.length===closing.length&&(!closing.length||closeSectionCount)?'complete':'incomplete';
  const audit=pnlCoverage==='complete'?(equal(closing.length?csv.sum(closing.map(r=>r.realizedPnl)):'0',official)?'matched':'mismatch'):'not-comparable';if(audit==='mismatch')warnings.push('GMO_TRADE_PNL_MISMATCH');
  return {rows,coverage,pnlCoverage,audit,errors,warnings};
 }
 const api=Object.freeze({parse});if(node)module.exports=api;else root.TradeScopeGmoTransactions=api;
})(typeof globalThis!=='undefined'?globalThis:this);
