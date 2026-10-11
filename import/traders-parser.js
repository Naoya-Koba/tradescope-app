(function(root) {
  'use strict';
  const csv = typeof module !== 'undefined' && module.exports ? require('./csv-core.js') : root.TradeScopeCSV;
  const version = 'traders-monthly-v1';
  const products = Object.freeze({lightfx:{name:'LIGHT FX',accountId:'acc_lightfx_fx',scope:'lightfx-monthly-report',labels:['LIGHT FX']},
    minano:{name:'みんなのFX',accountId:'acc_minna_fx',provider:'minna',scope:'minna-monthly-report',labels:['みんなのＦＸ','みんなのFX']}});
  const clean = value => String(value ?? '').replace(/\s+/g,' ').trim();
  function decimal(value) { const text=clean(value).replace(/\(円\)|\(％\)|\(%\)|[,円%％\s]/g,''); if(!/^[+-]?\d+(?:\.\d+)?$/.test(text)) return null; try{return csv.decimal(text);}catch(_){return null;} }
  // Empty is zero only within a fully recognised report section, never for a missing field/section.
  const sum = values => values.every(v=>v!=null) ? values.length ? csv.sum(values) : '0' : null;
  const equal = (a,b) => a!=null && b!=null && decimal(csv.sum([a, b.startsWith('-')?b.slice(1):'-'+b]))==='0';
  function lines(page) { const result=[]; for(const item of page.items||[]) {if(!clean(item.text))continue;let row=result.find(r=>Math.abs(r.y-item.y)<2);if(!row)result.push(row={y:item.y,items:[]});row.items.push(item);}return result.sort((a,b)=>b.y-a.y).map(row=>({...row,items:row.items.sort((a,b)=>a.x-b.x),text:clean(row.items.map(i=>i.text).join(' '))})); }
  function detect(extracted) {
    const text=(extracted?.pages||[]).flatMap(p=>lines(p).map(r=>r.text)).join('\n');
    if(!text.includes('トレイダーズ証券')||!text.includes('取引報告書兼残高報告書(月次)')||!text.includes('預託証拠金残高'))return null;
    // Only the product label in the report header is evidence, not a LIGHT product label in position rows.
    const headers=(extracted.pages||[]).flatMap(p=>lines(p).filter(r=>r.text.includes('店頭外国為替証拠金取引')).map(r=>r.text));
    const matches=Object.entries(products).filter(([,p])=>headers.some(t=>p.labels.some(label=>t.includes(label))));
    return matches.length===1?matches[0][0]:null;
  }
  function pair(value) {const m=/^\(?([A-Za-z]{3})\/?([A-Za-z]{3})\)?$/.exec(clean(value));return m?`${m[1].toUpperCase()}/${m[2].toUpperCase()}`:null;}
  function parse(extracted, expected) {
    const broker=detect(extracted), errors=[],warnings=[], values={}, positions=[];
    const issue=code=>{if(!errors.includes(code))errors.push(code);};
    if(!broker)issue('TRADERS_DOCUMENT_NOT_RECOGNIZED');else if(expected&&broker!==expected)issue('TRADERS_WRONG_PRODUCT');
    const pages=(extracted?.pages||[]).map(p=>({number:p.number,rows:lines(p)}));
    let targetMonth=null,snapshotAsOf=null,accountSeen=0,ledgerSeen=0,positionSeen=0,tradeSeen=0;
    const ledger=[],trades=[];
    for(const page of pages) {
      const rows=page.rows;
      const basis=rows.findIndex(r=>r.text.includes('作成基準日'));
      if(basis>=0){
        const anchor=rows[basis].items.find(i=>i.text.includes('作成基準日'));
        const text=clean(rows[basis].items.filter(i=>i.x>anchor.x+40).map(i=>i.text).join(''));
        if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(text))issue('TRADERS_PERIOD_INVALID');
        else{targetMonth=text;snapshotAsOf=new Date(Date.UTC(Number(text.slice(0,4)),Number(text.slice(5)),0)).toISOString().slice(0,10);}
      }
      for(let i=0;i<rows.length;i++) {
        const header=rows[i];
        if(header.text.includes('預託証拠金残高')&&header.text.includes('純資産額')){
          accountSeen++;
          const names=['預託証拠金残高','建玉必要証拠金','注文必要証拠金','評価損益','純資産額','振替可能額','証拠金維持率','未受渡金額'];
          const fields=['cashBalance','requiredMargin','orderRequiredMargin','reportedAccountEvaluationPnl','netAssetValue','transferableAmount','maintenanceRate','unsettledAmount'];
          const anchors=names.map(name=>header.items.find(item=>clean(item.text)===name)?.x);
          if(anchors.some(x=>x==null)){issue('TRADERS_ACCOUNT_HEADER_INVALID');continue;}
          const cells=rows[i+1]?.items||[];
          fields.forEach((field,n)=>{values[field]=decimal(cells.filter(c=>c.x>=anchors[n]-3&&c.x<(anchors[n+1]??Infinity)-3).map(c=>c.text).join(''));});
        }
        if(header.text.includes('注文番号')&&header.text.includes('未決済スワップ')&&header.text.includes('建玉評価損益')) {
          positionSeen++;
          const end=rows.slice(i+1).findIndex(r=>r.text.includes('＜')||r.text.includes('のうち、高い方')||r.text.startsWith('■'));
          const block=rows.slice(i+1,end<0?undefined:i+1+end);
          const scale=(header.items.find(v=>v.text==='約定価格')?.x||324)/324;
          const cell=(r,a,b)=>clean(r.items.filter(c=>c.x>=a*scale&&c.x<b*scale).map(c=>c.text).join(''));
          for(let n=0;n<block.length;n++) {
            const r=block[n],order=cell(r,0,100); if(!/^\d+$/.test(order))continue;
            const nearby=block.filter(v=>Math.abs(v.y-r.y)<17).flatMap(v=>v.items.filter(c=>c.x>=195*scale&&c.x<250*scale));
            const symbols=[...new Set(nearby.map(v=>pair(v.text)).filter(Boolean))];
            const datetime=cell(r,100,195).replace(/\s+/g,'');
            const date=/^(\d{4})\/(\d{2})\/(\d{2})(\d{2}):(\d{2}):(\d{2})$/.exec(datetime);
            const row={orderId:order,executedAt:date?`${date[1]}-${date[2]}-${date[3]}T${date[4]}:${date[5]}:${date[6]}`:null,
              symbol:symbols.length===1?symbols[0]:null,side:cell(r,250,275)==='買'?'buy':cell(r,250,275)==='売'?'sell':null,
              quantity:decimal(cell(r,275,320)),quantityUnit:'reportedQuantity',acquisitionPrice:decimal(cell(r,320,358)),
              unsettledSwap:decimal(cell(r,358,422)),marketPrice:decimal(cell(r,422,465)),unrealizedPnl:decimal(cell(r,465,515)),requiredMargin:decimal(cell(r,515,Infinity))};
            if(Object.values(row).some(v=>v===null))issue('TRADERS_POSITION_INVALID');positions.push(row);
          }
        }
        if(header.text.includes('受渡日')&&header.text.includes('口座残高')&&header.text.includes('入出金')){
          ledgerSeen++;
          const end=rows.slice(i+1).findIndex(r=>r.text.startsWith('■')||r.text.includes('＜')||r.text.includes('【'));
          const block=rows.slice(i+1,end<0?undefined:i+1+end);
          const bounds=[0,100,180,265,335,405,475,Infinity];
          for(const r of block){
            const cells=bounds.slice(0,-1).map((a,n)=>clean(r.items.filter(c=>c.x>=a&&c.x<bounds[n+1]).map(c=>c.text).join('')));
            if(!/^\d{4}-\d{2}-\d{2}$/.test(cells[0])){if(r.items.some(v=>/^[-+]?\d[\d,.]*$/.test(v.text)))issue('TRADERS_LEDGER_ROW_INVALID');continue;}
            ledger.push({date:cells[0],realizedPnl:decimal(cells[1]),settledSwap:decimal(cells[2]),fee:decimal(cells[3]),movement:decimal(cells[4]),other:decimal(cells[5]),balance:decimal(cells[6])});
          }
        }
        if(header.text.includes('注文番号')&&header.text.includes('対象新規注文番号')){
          tradeSeen++;
          const end=rows.slice(i+1).findIndex(r=>r.text.includes('＜'));
          const block=rows.slice(i+1,end<0?undefined:i+1+end);
          for(const r of block){if(!r.items.some(c=>c.x<100&&/^\d+$/.test(c.text)))continue;
            const value=r.items.filter(c=>c.x>=320&&c.x<375).map(c=>c.text).join('');
            const next=block.find(v=>v.y<r.y&&r.y-v.y<16);
            trades.push({realizedPnl:decimal(value),swap:next?decimal(next.items.filter(c=>c.x>=320&&c.x<375).map(c=>c.text).join('')):null});
          }
        }
      }
    }
    if(!targetMonth||!snapshotAsOf||snapshotAsOf!==new Date(Date.UTC(Number(targetMonth?.slice(0,4)),Number(targetMonth?.slice(5)),0)).toISOString().slice(0,10))issue('TRADERS_PERIOD_INVALID');
    if(accountSeen!==1||!positionSeen||!ledgerSeen||!tradeSeen||!ledger.length)issue('TRADERS_SECTION_MISSING');
    if(ledger.some(r=>Object.values(r).some(v=>v===null)||r.date.slice(0,7)!==targetMonth))issue('TRADERS_LEDGER_ROW_INVALID');
    values.unrealizedPnl=sum(positions.map(r=>r.unrealizedPnl));values.monthEndUnsettledSwap=sum(positions.map(r=>r.unsettledSwap));
    values.realizedPnl=sum(ledger.map(r=>r.realizedPnl));values.reportedSettledSwapPnl=sum(ledger.map(r=>r.settledSwap));
    values.deposit=sum(ledger.filter(r=>r.movement!==null&&!r.movement.startsWith('-')).map(r=>r.movement));
    values.withdrawal=sum(ledger.filter(r=>r.movement?.startsWith('-')).map(r=>r.movement.slice(1)));
    values.fee=sum(ledger.map(r=>r.fee));values.other=sum(ledger.map(r=>r.other));
    if(['cashBalance','netAssetValue','requiredMargin','orderRequiredMargin','reportedAccountEvaluationPnl','transferableAmount','maintenanceRate','unsettledAmount',
      'unrealizedPnl','monthEndUnsettledSwap','realizedPnl','reportedSettledSwapPnl','deposit','withdrawal','fee','other'].some(k=>values[k]==null))issue('TRADERS_REQUIRED_VALUE_MISSING');
    for(const field of ['fee','other','unsettledAmount'])if(values[field]!==null&&!equal(values[field],'0'))issue(`TRADERS_UNSUPPORTED_${field.toUpperCase()}`);
    if(!equal(values.reportedAccountEvaluationPnl,sum([values.unrealizedPnl??null,values.monthEndUnsettledSwap??null])))issue('TRADERS_EVALUATION_MISMATCH');
    if(!equal(values.netAssetValue,sum([values.cashBalance??null,values.reportedAccountEvaluationPnl??null])))issue('TRADERS_NET_ASSET_MISMATCH');
    if(!equal(values.cashBalance,ledger.at(-1)?.balance??null))issue('TRADERS_CASH_MISMATCH');
    for(let n=1;n<ledger.length;n++){const r=ledger[n];if(!equal(r.balance,sum([ledger[n-1].balance,r.realizedPnl,r.settledSwap,r.fee,r.movement,r.other])))issue('TRADERS_LEDGER_BALANCE_MISMATCH');}
    if(!equal(values.realizedPnl,sum(trades.map(r=>r.realizedPnl))))issue('TRADERS_REALIZED_MISMATCH');
    return {broker,importerVersion:version,targetMonth,snapshotAsOf,observationType:'officialMonthEnd',valuationCurrency:'JPY',values,positions,errors,warnings,valid:errors.length===0};
  }
  const api=Object.freeze({version,products,detect,parse,decimal,equal,pair,lines});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TradeScopeTradersParser=api;
})(typeof globalThis!=='undefined'?globalThis:this);
