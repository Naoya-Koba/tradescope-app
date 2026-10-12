// Entirely synthetic. Coordinates imitate the public table shape, not private values/IDs.
const {fixture}=require('./sbivc-pdf-fixture.js');
function tradesFixture({side='買',market='現物',fees=['11','11','11','3'],assets=['ZETA'],shift=0,noLegs=false}={}){
  const f=fixture({assets});
  const old=f.pages[1].items;let lo=old.find(i=>i.text==='■取引明細').y,hi=old.find(i=>i.text==='■貸出中一覧').y;
  f.pages[1].items=old.filter(i=>!(i.y<=lo&&i.y>hi));
  f.pages.push({number:3,items:[]},{number:4,items:[]},{number:5,items:[]});
  const row=(page,y,cells)=>f.pages.find(p=>p.number===page).items.push(...cells.map(([x,text])=>({x:x+shift,y,text:String(text),width:String(text).length*6})));
  row(3,780,[[19,'■取引明細']]);
  row(3,760,[[57,'約定日時'],[227,'取引区分'],[325,'数量']]);
  row(3,750,[[154,'注文先'],[465,'建玉損益'],[524,'決済損益']]);
  row(3,740,[[283,'売買']]);row(3,730,[[57,'取引番号'],[235,'銘柄'],[313,'約定レート'],[386,'取引手数料']]);
  const quantities=['2.50000','1.25000','0.75000','0.50000'];
  quantities.forEach((q,i)=>{
    const id='synthetic-fill-'+i,date='2031/02/10 12:34:'+String(i).padStart(2,'0'),y=710-i*40;
    row(3,y,[[20,date],[125,'自己'],[208,market],[287,side],[332,q],[447,'—'],[508,'—'],[566,'—']]);
    row(3,y-15,[[20,id],[208,assets[0]+'/JPY'],[332,'812.3400'],[441,fees[i]]]);
    if(!noLegs){
      const base=740-i*150;
      for(const [n,type,asset,quantity]of [[0,'現物取引','JPY',['-2030.85000','-1015.42500','-609.25500','-406.17000'][i]],[1,'現物取引',assets[0],q],[2,'取引手数料','JPY',fees[i]]]){
        row(4,base-n*45,[[19,date],[99,type],[253,asset],[345,quantity],[437,'812.3400'],[550,'1']]);
        row(4,base-n*45-15,[[19,'備考：現物取引番号('+id+')']]);
      }
    }
  });
  row(4,800,[[19,'■入出金明細']]);
  row(4,780,[[63,'日時'],[142,'入出金の種別'],[236,'暗号資産/通貨'],[327,'数量'],[408,'評価レート'],[492,'入出金額（円）']]);
  row(4,100,[[19,'2031/02/09 08:00:00'],[99,'入金・入庫'],[253,'JPY'],[345,'8888'],[437,'—'],[550,'8888']]);
  row(4,85,[[19,'備考：クイック入金']]);
  row(5,780,[[19,'■お客様が支払うこととなる金銭の額及び計算方法について']]);
  row(5,750,[[19,'受取り手数料をプラス、支払い手数料をマイナスで表示']]);
  return f;
}
module.exports={tradesFixture};
