(function(root){
  'use strict';
  const csv=typeof module!=='undefined'&&module.exports?require('./csv-core.js'):root.TradeScopeCSV;
  const clean=v=>String(v??'').replace(/\s+/g,' ').trim(),compact=v=>clean(v).replace(/\s/g,'');
  const absent=v=>['','-','--','—','ー','―'].includes(compact(v));
  function product(a,b){
    const part=v=>{const [whole,fraction='']=v.split('.');return{n:BigInt(whole+fraction),scale:fraction.length};};
    const x=part(a),y=part(b),scale=x.scale+y.scale,digits=String(x.n*y.n).padStart(scale+1,'0');
    return scale?digits.slice(0,-scale)+'.'+digits.slice(-scale):digits;
  }
  function parse(pages,targetMonth){
    const transactions=[],errors=[],warnings=[];let active=false,empty=false,seen=false,header={},pending=null,sourceRow=0;
    const issue=code=>{if(!errors.includes(code))errors.push(code);};
    const cell=(row,a,b)=>clean(row.items.filter(i=>i.x>=a&&i.x<b).map(i=>i.text).join(''));
    const decimal=v=>{try{return csv.decimal(v);}catch(_){return null;}};
    for(const page of pages)for(const row of page.rows){
      const text=compact(row.text);
      if(text.startsWith('■')){
        if(pending){issue('SBIVC_TRADE_ROW_INVALID');pending=null;}
        active=text==='■取引明細';if(active){seen=true;header={};}continue;
      }
      if(!active||/^\d+\/\d+$/.test(text)||row.y<40&&/^\d+$/.test(text))continue;
      if(text.startsWith('該当する')&&text.endsWith('がございません')){if(transactions.length||pending)issue('SBIVC_TRADE_ROW_INVALID');empty=true;continue;}
      for(const label of ['約定日時','注文先','取引区分','売買','数量','銘柄','約定レート','取引番号','取引手数料','建玉損益','決済損益']){
        const item=row.items.find(i=>compact(i.text)===label);if(item)header[label]=item.x;
      }
      const date=/^\d{4}\//.test(text);
      if(!date&&!pending){if(/^\d{5,}/.test(text)||row.items.some(i=>decimal(clean(i.text))!==null))issue('SBIVC_TRADE_ROW_INVALID');continue;}
      const labels=['約定日時','注文先','取引区分','売買','数量','銘柄','約定レート','取引番号','取引手数料','建玉損益','決済損益'];
      if(labels.some(l=>!Object.hasOwn(header,l))){issue('SBIVC_TRADE_HEADER_INVALID');continue;}
      // Known official two-line table; offsets describe alignment within labelled columns, not page numbers.
      const bounds=[header['注文先']-35,header['取引区分']-20,header['売買']-10,header['数量']-15,header['取引手数料']-25,header['建玉損益']-10,header['決済損益']-10];
      if(bounds.some((b,i)=>i&&b<=bounds[i-1])){issue('SBIVC_TRADE_HEADER_INVALID');continue;}
      const [order,mode,side,quantity,fee,pnl,realized]=bounds;
      if(date){
        if(pending)issue('SBIVC_TRADE_ROW_INVALID');
        let executedAt=null;try{executedAt=csv.observation(cell(row,-Infinity,order));}catch(_){}
        const sourceMode=compact(cell(row,mode,side)),direction=compact(cell(row,side,quantity));
        pending={executedAt,marketType:sourceMode,side:direction,quantity:decimal(cell(row,quantity,fee)),sourcePage:page.number,sourceRow:++sourceRow};
        if(![cell(row,fee,pnl),cell(row,pnl,realized),cell(row,realized,Infinity)].every(absent))issue('SBIVC_TRADE_SEMANTICS_UNVERIFIED');
        continue;
      }
      const t=pending;pending=null;
      const id=cell(row,-Infinity,order),symbol=compact(cell(row,mode,side)),price=decimal(cell(row,quantity,fee)),signedFee=decimal(cell(row,fee,pnl));
      if(empty||t.sourcePage!==page.number||!t.executedAt||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(t.executedAt)
        ||t.executedAt.slice(0,7)!==targetMonth||! /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(id)
        ||! /^[A-Z][A-Z0-9]{1,19}\/JPY$/.test(symbol)||t.quantity===null||/^(-|0(?:\.0+)?$)/.test(t.quantity)
        ||price===null||price.startsWith('-')||signedFee===null){issue('SBIVC_TRADE_ROW_INVALID');continue;}
      if(t.marketType!=='現物'||t.side!=='買'){issue('SBIVC_TRADE_SEMANTICS_UNVERIFIED');continue;}
      if(transactions.some(r=>r.providerExecutionId===id)){issue('SBIVC_TRADE_ID_DUPLICATE');continue;}
      transactions.push({marketType:'spot',side:'buy',normalizedTransactionType:'spot-buy',rawTransactionType:'現物 買',
        executedAt:t.executedAt,tradeDate:t.executedAt.slice(0,10),providerExecutionId:id,providerOrderId:null,
        symbol,quantity:t.quantity,quantityUnit:'baseAssetUnits',price,fee:signedFee,feeCurrency:'JPY',
        feeSemantics:'receipt-positive-payment-negative',currency:'JPY',realizedPnl:null,sourcePage:t.sourcePage,sourceRow:t.sourceRow});
    }
    if(pending)issue('SBIVC_TRADE_ROW_INVALID');
    if(!seen||!empty&&!transactions.length)warnings.push('SBIVC_TRADES_ROWS_UNVERIFIED');
    return{transactions,status:errors.length?'unverified':empty?'empty':transactions.length?'verified':'unverified',errors,warnings};
  }
  const api=Object.freeze({parse,product});if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TradeScopeSBIVCTransactionsParser=api;
})(typeof globalThis!=='undefined'?globalThis:this);
