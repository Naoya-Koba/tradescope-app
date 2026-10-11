// Invented data only; usable by Node tests and the localhost-only browser harness.
(function (root) {
  const node = typeof module !== 'undefined' && module.exports;
  const model = node ? require('../assets/data-model-storage.js') : root.TradeScopeDataStorage;
  const accounts = [{ key:'gmo',name:'GMO',color:'#3B6DFF' },{ key:'sbi',name:'SBI',color:'#D95757' },
    {key:'lightfx',name:'Light FX',color:'#EFB344'},{key:'minano',name:'みんなのFX',color:'#89BC80'},
    {key:'sbivc',name:'SBI VC',color:'#EAF1FF'},{key:'smbc',name:'三井住友銀行',color:'#2F7A46',bankOnly:true}];
  function fixture() {
    const now = '2026-10-11T12:00:00.000Z', env = records => ({schemaVersion:1,records,updatedAt:now});
    const models = Object.fromEntries(Object.keys(model.keys).map(key => [key,null]));
    models.accounts = env(model.initialAccounts().filter(row => ['acc_gmo_fx','acc_sbi_sec'].includes(row.id)));
    models.instruments = env([{id:'ins_anonymous',assetType:'Stock',symbol:'ANON',displayName:'架空商品',enabled:true}]);
    models.importBatches = env([
      {id:'batch_gmo',accountId:'acc_gmo_fx',sourceType:'pdf',sourceProvider:'gmo',targetMonth:'2026-09',snapshotAsOf:'2026-09-30',importedAt:now},
      {id:'batch_sbi',accountId:'acc_sbi_sec',sourceType:'csv',sourceProvider:'sbi',targetMonth:'2026-09',snapshotAsOf:'2026-10-04',importedAt:now}]);
    models.accountSnapshots = env([{id:'as_gmo',accountId:'acc_gmo_fx',sourceMode:'imported',sourceScope:'gmo-fx-monthly-report',
      targetMonth:'2026-09',snapshotAsOf:'2026-09-30',importedAt:now,importBatchId:'batch_gmo',observationType:'officialMonthEnd',valuationCurrency:'JPY',
      cashBalance:'139',netAssetValue:'136',unrealizedPnl:'-3',reportedMonthlyRealizedPnl:'10',accountSpecific:{requiredMargin:'20'}}]);
    models.monthlyAccountStates = env([{schemaVersion:2,id:'mas_gmo',accountId:'acc_gmo_fx',targetMonth:'2026-09',confirmedAt:now,
      adoptedAccountSnapshotId:'as_gmo',domesticImportBatchId:null,foreignAccountSnapshotId:null,cashAccountSnapshotId:null,
      realizedPnl:'10',swapPnl:'5',deposit:'0',withdrawal:'0'}]);
    models.holdingSnapshots = env([{id:'hs_sbi',accountId:'acc_sbi_sec',instrumentId:'ins_anonymous',importBatchId:'batch_sbi',
      sourceMode:'imported',sourceScope:'sbi-domestic-holdings',targetMonth:'2026-09',snapshotAsOf:'2026-10-04',importedAt:now,
      marketValue:'200.25',unrealizedPnl:'20.125',currency:'JPY'}]);
    const tradingData = {2026:{}};
    for(let month=1;month<=8;month++) tradingData[2026][month] = {__saved:true,...Object.fromEntries(accounts.map(a=>[a.key,
      a.bankOnly ? {monthEndBalance:100,realizedPnL:0,swapPnL:0,unrealizedPnL:0,deposit:0,withdrawal:0}
        : {realizedPnL:1,swapPnL:2,unrealizedPnL:3,deposit:0,withdrawal:0}]))};
    return {models,tradingData,initialFunds:{2026:Object.fromEntries(accounts.map(a=>[a.key,100]))},initialUnrealized:{},accounts};
  }
  if(node) module.exports = {fixture,accounts}; else root.AnonymousMonthlyDisplay = {fixture,accounts};
})(typeof globalThis !== 'undefined' ? globalThis : this);
