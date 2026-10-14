// Invented financial rows and identifiers. No private report data.
const {report,text}=require('./traders-pdf-fixture.js'),csv=require('../import/csv-core.js');
const date='2026-09-02',huge='9007199254740993123456789';
const open=extra=>({sourceOrderId:huge,sourceOpenOrderRef:null,executionAt:'2026/09/02 10:00:00',settlementDate:null,
  pair:'AAAJPY',action:'新規',side:'買',quantity:'1',executionPrice:'1.23456789',realizedPnl:null,transactionSwap:null,fee:null,note:null,...extra});
const close=extra=>({...open(),sourceOrderId:huge+'1',sourceOpenOrderRef:huge,action:'決済',side:'売',
  settlementDate:date,executionPrice:'1.98765432',realizedPnl:'9',transactionSwap:'4',fee:'0',...extra});
function setAccount(doc,field,value){const names=['cashBalance','requiredMargin','orderRequiredMargin','reportedAccountEvaluationPnl','netAssetValue','transferableAmount','maintenanceRate','unsettledAmount'];
  const x=[36,105,174,255,324,389,454,528][names.indexOf(field)],item=doc.pages[0].items.find(i=>i.x===x&&i.y===617);item.text=value;}
function executions(rows=[open()],{broker='lightfx',ledgerSwap,ledgerRealized}={}){
 const doc=report(broker),page=doc.pages[0],shift=31*(rows.length-1);
 page.items=page.items.filter(i=>i.y>535||i.y<523);for(const i of page.items)if(i.y<=505)i.y-=shift;
 const put=(value,x,y)=>{if(value!==null&&value!==undefined&&value!=='')page.items.push(text(value,x,y));};
 rows.forEach((r,n)=>{const y=535-31*n;
   [[r.sourceOrderId,28],[r.executionAt,112],[r.pair,212],[r.action,253],[r.quantity,285],[r.realizedPnl,332],[r.fee,380],[r.sourceOpenOrderRef,433]].forEach(([v,x])=>put(v,x,y));
   [[r.settlementDate,145],[r.side,257],[r.executionPrice,293],[r.transactionSwap,321],[r.note,433]].forEach(([v,x])=>put(v,x,y-16));
 });
 const closed=rows.filter(r=>r.action==='決済'),known=(field,fallback)=>!closed.length?'0':closed.some(r=>typeof r[field]!=='string'||!/^[-+]?\d+(?:\.\d+)?$/.test(r[field]))?fallback:csv.sum(closed.map(r=>r[field]));
 const pnl=ledgerRealized??known('realizedPnl','14'),swap=ledgerSwap??known('transactionSwap','6');
 const first=csv.sum(['1000',pnl,swap,'20']),cash=csv.sum([first,'-7']);
 for(const [x,v]of [[139,pnl],[212,swap],[485,first]])page.items.find(i=>i.x===x&&i.y===320-shift).text=v;
 page.items.find(i=>i.x===485&&i.y===304-shift).text=cash;
 setAccount(doc,'cashBalance',cash);setAccount(doc,'netAssetValue',csv.sum([cash,'-22']));
 return doc;
}
function withoutPositions(doc,ratio='—'){
 const page=doc.pages[0],header=page.items.find(i=>i.text==='未決済スワップ').y,stop=page.items.find(i=>i.text.startsWith('のうち、高い方')).y;
 page.items=page.items.filter(i=>!(i.y<header&&i.y>stop));
 for(const [field,value]of [['requiredMargin','0'],['reportedAccountEvaluationPnl','0'],['maintenanceRate',ratio]])setAccount(doc,field,value);
 const cash=page.items.find(i=>i.x===36&&i.y===617).text;setAccount(doc,'netAssetValue',cash);return doc;
}
module.exports={date,huge,open,close,executions,setAccount,withoutPositions};
