(function(){
 'use strict';
 if(!['localhost','127.0.0.1','[::1]'].includes(location.hostname))throw Error('Local anonymous QA only');
 // Deliberately no real browser Storage, Service Worker, PDF, or production Backup.
 class MemoryStorage{constructor(){this.data=new Map();}getItem(k){return this.data.get(k)??null;}setItem(k,v){this.data.set(k,v);}removeItem(k){this.data.delete(k);}}
 const f=window.TradeScopeFxHistoryFixture,model=window.TradeScopeDataStorage,key='tradeScopeTradeHistoryV1';
 let memory=new MemoryStorage(),provider='lightfx';
 const storage={getItem:k=>memory.getItem(k),setItem:(k,v)=>memory.setItem(k,v),removeItem:k=>memory.removeItem(k)};
 const confirmation=window.TradeScopeReconciliationV2UI.create({document,storage,onRefresh:reload});
 const editor=window.TradeScopeManualMetadataUI.create({document,storage,onRefresh:reload});
 const ui=window.TradeScopeTransactionUI.create(document,{decorateDetail:confirmation.decorate,decorateMetadata:editor.decorate});
 function reload(options){const entries=JSON.parse(memory.getItem(key)),models=model.readModels(storage);confirmation.update(entries,models);ui.refresh(entries,models,options);return true;}
 function load(p=provider,count=1){
  provider=p;memory=new MemoryStorage();const m=f.fixture(provider,{quantity:'200000',price:'4.1234'});
  for(let i=1;i<count;i++){const r={...m.importedTransactions.records[0],id:'extra_'+i,sourceRow:i+1,quantity:'10000'};m.importedTransactions.records.push(r);m.transactionSources.records[0].transactionIds.push(r.id);}
  f.seal(m);f.decision(m);
  memory.setItem(key,JSON.stringify([{id:'anonymous_manual',account:provider==='minna'?'みんなのFX':'LIGHT FX',assetType:'FX',symbol:'TRY/JPY',category:'partial_close',side:'sell',date:'2034-04-20',quantity:20,contractSize:10000,rate:4.1234,memo:'匿名メモ',strategy:'キャリー',createdAt:123}]));
  model.createRepository(storage).commit(Object.fromEntries(Object.entries(m).filter(([,v])=>v!==null)));
  for(const id of ['filterAccount','filterSource','filterStrategy','filterSymbol','filterCategory'])document.getElementById(id).value='';reload();
 }
 document.getElementById('light').onclick=()=>load('lightfx');document.getElementById('minna').onclick=()=>load('minna');document.getElementById('pagination').onclick=()=>load(provider,51);
 for(const id of ['filterMonth','filterAccount','filterSymbol','filterCategory','filterSource','filterStrategy','sortOrder'])document.getElementById(id).addEventListener('change',()=>ui.render());
 window.historyListQA={inspect:()=>({provider,viewport:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,count:document.getElementById('historyCount').textContent,
  displayed:document.querySelectorAll('.transaction-row').length,manual:JSON.parse(memory.getItem(key)),relations:model.readModels(storage).transactionReconciliations?.records||[],
  projected:window.TradeScopeHistoryListView.resolve(JSON.parse(memory.getItem(key)),model.readModels(storage)).length})};
 load();
})();
