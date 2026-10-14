(function(){
  'use strict';
  // Disposable, in-memory only. No localStorage/sessionStorage/SW/Backup writes.
  const problems=[];window.addEventListener('error',e=>problems.push(e.message));window.addEventListener('unhandledrejection',e=>problems.push(String(e.reason)));
  const f=window.TradeScopeFxHistoryFixture,ui=window.TradeScopeTransactionUI.create(document);let models,manual,provider='lightfx';
  const $=id=>document.getElementById(id);
  function refresh(){window.TradeScopeDataStorage.validateModels(models);ui.refresh(manual,models);$('qaStatus').textContent=window.TradeScopeTransactionAdoptionView.readAll(models).results.map(r=>r.status).join(' / ');}
  function load(p){provider=p;models=f.fixture(provider);manual=f.legacy(models);f.decision(models);refresh();}
  $('light').onclick=()=>load('lightfx');$('minna').onclick=()=>load('minna');
  $('candidate').onclick=()=>{if(!models.transactionSources.records.some(r=>r.id==='collection_b'))f.revision(models);refresh();};
  $('adopt').onclick=()=>{if(!models.transactionSources.records.some(r=>r.id==='collection_b'))f.revision(models);f.decision(models,'adopt','collection_b');refresh();};
  $('defer').onclick=()=>{const active=window.TradeScopeTransactionAdoptionView.readAll(models).results.find(r=>r.usable);f.decision(models,'defer',active?.collection.id||'collection_a');refresh();};
  $('stale').onclick=()=>{models.transactionSources.records.filter(r=>r.kind==='decision').at(-1).collectionFingerprint='f'.repeat(64);ui.refresh(manual,models);$('qaStatus').textContent='stale';};
  $('empty').onclick=()=>{models=f.fixture(provider);manual=f.legacy(models);models.importedTransactions.records=models.importedTransactions.records.filter(r=>r.schemaVersion!==3);models.transactionSources.records[0].transactionIds=[];f.seal(models);f.decision(models);refresh();};
  $('cleanup').onclick=()=>{models=null;manual=[];ui.refresh([],{});$('qaStatus').textContent='cleaned';};
  for(const id of ['filterMonth','filterAccount','filterSymbol','filterCategory','filterSource','filterStrategy','sortOrder'])$(id).addEventListener('change',()=>ui.render());
  window.fxHistoryQA={inspect:()=>({problems:[...problems],overflow:document.documentElement.scrollWidth>innerWidth,viewport:innerWidth,
    rows:[...document.querySelectorAll('.transaction-summary')].map(e=>e.textContent),fingerprint:models?window.TradeScopeTransactionAdoptionView.fingerprint(models):null,
    states:models?window.TradeScopeTransactionAdoptionView.readAll(models).results.map(r=>({status:r.status,confirmedEmpty:r.confirmedEmpty})):[]})};
  load(provider);
})();
