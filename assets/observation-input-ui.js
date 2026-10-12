(function(root){
  'use strict';
  const node=typeof module!=='undefined'&&module.exports;
  const storage=node?require('./data-model-storage.js'):root.TradeScopeDataStorage;
  function render({document,adapter,accountId,targetMonth,displayName}){
    let models;try{models=storage.createRepository(adapter).read();}catch(_){
      const error=document.createElement('div');error.className='account-card';error.textContent='保存された資産・保有情報を確認できませんでした';return error;
    }
    const input=models.monthlyAccountInputs?.records.find(i=>i.schemaVersion===3&&i.accountId===accountId&&i.targetMonth===targetMonth);
    if(!input)return null;
    const snapshot=models.accountSnapshots.records.find(s=>s.id===input.adoptedAccountSnapshotId);
    const holdings=models.holdingSnapshots?.records.filter(h=>h.accountSnapshotId===snapshot.id)||[];
    const make=(tag,text,cls)=>{const el=document.createElement(tag);el.textContent=text;if(cls)el.className=cls;return el;};
    const amount=value=>{if(value==null)return'—';const [integer,fraction]=value.split('.');return integer.replace(/\B(?=(\d{3})+(?!\d))/g,',')+(fraction===undefined?'':'.'+fraction);};
    const card=make('div','','account-card'),dl=make('dl','','observation-values');
    card.append(make('h3',displayName),make('p','資産・保有情報を保存済み','muted'));
    for(const [label,value]of[['対象月',targetMonth.replace('-','/')],['基準日',snapshot.snapshotAsOf.replaceAll('-','/')],['JPY残高',amount(snapshot.cashBalance)+'円'],['帳票上の資産合計',amount(snapshot.assetValue)+'円']])dl.append(make('dt',label),make('dd',value));
    card.append(dl);
    const details=make('details',''),active=holdings.filter(h=>!/^0(?:\.0+)?$/.test(h.quantity));
    details.append(make('summary',`現物保有（${active.length}銘柄）`));
    for(const h of active){const instrument=models.instruments.records.find(i=>i.id===h.instrumentId),row=make('div','','observation-holding');
      row.append(make('strong',instrument.displayName),make('p',`数量 ${amount(h.quantity)}`),make('p',`円換算額 ${amount(h.marketValue)}円`));details.append(row);}
    card.append(details);return card;
  }
  const api=Object.freeze({render});if(node)module.exports=api;else root.TradeScopeObservationInputUI=api;
})(typeof globalThis!=='undefined'?globalThis:this);
