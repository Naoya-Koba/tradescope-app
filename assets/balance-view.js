(function(root){
  'use strict';
  const node=typeof module!=='undefined'&&module.exports;
  const csv=node?require('../import/csv-core.js'):root.TradeScopeCSV;
  const version='balance-view-v1';
  const month=v=>typeof v==='string'&&/^\d{4}-(?:0[1-9]|1[0-2])$/.test(v);
  function decimal(value){
    if(value==null||typeof value==='string'&&value.trim()==='')return null;
    if(typeof value!=='number'&&typeof value!=='string')throw Error('INVALID_BALANCE_VALUE');
    let text=String(value).trim();
    // Legacy calculators expose Numbers; expand exponent notation without rounding.
    if(typeof value==='number'&&Number.isFinite(value)&&/[eE]/.test(text)){
      const [mantissa,exponent]=text.toLowerCase().split('e'),negative=mantissa.startsWith('-');
      const parts=mantissa.replace(/^-/,'').split('.'),digits=parts.join(''),point=parts[0].length+Number(exponent);
      text=(negative?'-':'')+(point<=0?'0.'+'0'.repeat(-point)+digits:point>=digits.length?digits+'0'.repeat(point-digits.length):digits.slice(0,point)+'.'+digits.slice(point));
    }
    if(!/^-?\d+(?:\.\d+)?$/.test(text))throw Error('INVALID_BALANCE_VALUE');
    return text;
  }
  // Inputs are already adopted observations. Source provenance does not rank inputs.
  // This projection neither writes carried values nor supplies a monthly ledger.
  function resolve(observations,{targetMonth,componentKeys,crossYear=false}){
    if(!month(targetMonth)||!Array.isArray(componentKeys)||new Set(componentKeys).size!==componentKeys.length)throw Error('INVALID_BALANCE_REQUEST');
    const eligible=observations.filter(o=>month(o.sourceMonth)&&(crossYear||o.sourceMonth.startsWith(targetMonth.slice(0,4)+'-'))&&o.sourceMonth<=targetMonth);
    const components=componentKeys.map(key=>{
      const rows=eligible.filter(o=>o.key===key).sort((a,b)=>b.sourceMonth.localeCompare(a.sourceMonth));
      let chosen=null,blocked=false;
      for(let i=0;i<rows.length;i++){
        const row=rows[i];
        // Ambiguity or an explicit stop must not silently revive an older source.
        if(row.blocked||rows[i+1]?.sourceMonth===row.sourceMonth){blocked=true;break;}
        const value=decimal(row.value);
        if(value!==null){chosen={...row,value};break;}
        if(row.preventCarry){blocked=true;break;}
      }
      const value=chosen?.value??null,sourceMonth=chosen?.sourceMonth??null;
      const currentConfirmed=chosen!==null&&sourceMonth===targetMonth;
      const carried=chosen!==null&&!currentConfirmed;
      return {key,label:rows.find(row=>row.label)?.label??key,value,sourceMonth,snapshotAsOf:chosen?.snapshotAsOf??null,source:chosen?.source??null,
        basis:chosen?.basis??null,currentConfirmed,carried,missing:value===null,explicitZero:value!==null&&/^-?0+(?:\.0+)?$/.test(value),blocked,
        status:value===null?'unavailable':carried?'carried':'current confirmed'};
    });
    const values=components.filter(c=>!c.missing).map(c=>c.value);
    const unknownComponents=components.some(c=>c.missing),hasCarried=components.some(c=>c.carried);
    const complete=components.length>0&&!unknownComponents;
    return {targetMonth,components,knownTotal:values.length?csv.sum(values):null,complete,
      partial:values.length>0&&!complete,unknownComponents,hasCarried,
      currentComplete:complete&&!hasCarried,blocked:components.some(c=>c.blocked),
      sourceMonths:[...new Set(components.map(c=>c.sourceMonth).filter(Boolean))].sort(),version};
  }
  const api=Object.freeze({resolve,decimal,version});
  if(node)module.exports=api;else root.TradeScopeBalanceView=api;
})(typeof globalThis!=='undefined'?globalThis:this);
