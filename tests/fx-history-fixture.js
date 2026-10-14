(function(root){
  'use strict';
  // Anonymous invented facts, shared by Node/VM and the disposable browser harness.
  const node=typeof module!=='undefined'&&module.exports;
  const model=node?require('../assets/data-model-storage.js'):root.TradeScopeDataStorage;
  const contract=node?require('../assets/transaction-source-contract.js'):root.TradeScopeTransactionSourceContract;
  const now='2034-04-30T12:00:00.000Z',copy=v=>JSON.parse(JSON.stringify(v));
  const envelope=records=>({schemaVersion:1,records,updatedAt:now});
  const policies={lightfx:['acc_lightfx_fx','lightfx-fx-trades'],minna:['acc_minna_fx','minna-fx-trades'],gmo:['acc_gmo_fx','gmo-fx-trades']};
  function seal(m){for(const r of m.importedTransactions.records)if(r.schemaVersion===3)r.rowFingerprint=contract.rowFingerprint(r);
    for(const c of m.transactionSources.records)if(c.kind==='collection')c.fingerprint=contract.collectionFingerprint(c,m);return m;}
  function fixture(provider='lightfx',overrides={}){
    const m=Object.fromEntries(Object.keys(model.keys).map(k=>[k,null])),[accountId,sourceScope]=policies[provider];
    m.accounts=envelope(model.initialAccounts());m.instruments=envelope([{id:'fx_synthetic',assetType:'FX',symbol:'TRY/JPY',displayName:'TRY/JPY',quoteCurrency:'JPY',enabled:true}]);
    m.importBatches=envelope([{id:'batch_a',accountId,sourceProvider:provider,sourceType:'pdf',targetMonth:'2034-04',importedAt:now,sourceFileMetadata:{hash:'a'.repeat(64),size:123}}]);
    m.importedTransactions=envelope([{schemaVersion:3,id:'tx_a',collectionId:'collection_a',accountId,instrumentId:'fx_synthetic',importBatchId:'batch_a',sourceProvider:provider,sourceType:'pdf',sourceScope,targetMonth:'2034-04',action:'close',side:'sell',quantity:'200000.000000000001',quantityUnit:'baseCurrencyUnits',price:'4.12345678',tradeDate:'2034-04-20',executedAt:'2034-04-20T11:22:33',settlementDate:'2034-05-02',sourceOrderId:'000888888888888888888888888888888888888',sourceExecutionId:null,sourceOpenOrderRef:'000333333333333333333333333333333333333',realizedPnl:'-17.25',transactionSwap:'0',fee:null,currency:'JPY',feeCurrency:'JPY',sourcePage:3,sourceRow:1,rowFingerprint:'',importedAt:now,...overrides}]);
    m.transactionSources=envelope([{schemaVersion:1,id:'collection_a',kind:'collection',accountId,sourceProvider:provider,targetMonth:'2034-04',sourceScope,importBatchId:'batch_a',normalizerVersion:'anonymous-v1',transactionIds:['tx_a'],fingerprint:'',coverage:'complete',correctionOfCollectionId:null,createdAt:now}]);
    return seal(m);
  }
  function decision(m,kind='adopt',collectionId='collection_a'){
    const c=m.transactionSources.records.find(r=>r.id===collectionId),previous=m.transactionSources.records.filter(r=>r.kind==='decision'&&contract.targetKey(r)===contract.targetKey(c)).at(-1);
    const d={schemaVersion:1,id:'decision_'+m.transactionSources.records.length,kind:'decision',accountId:c.accountId,sourceProvider:c.sourceProvider,targetMonth:c.targetMonth,sourceScope:c.sourceScope,decision:kind,
      collectionId:kind==='defer'?null:c.id,collectionFingerprint:kind==='defer'?null:c.fingerprint,previousId:previous?.id??null,confirmedAt:now};m.transactionSources.records.push(d);return d;
  }
  function revision(m,overrides={}){
    const a=m.transactionSources.records.find(r=>r.kind==='collection'),b={...copy(m.importBatches.records.find(r=>r.id===a.importBatchId)),id:'batch_b',sourceFileMetadata:{hash:'b'.repeat(64),size:124}};
    m.importBatches.records.push(b);m.importedTransactions.records.push({...m.importedTransactions.records.find(r=>r.id===a.transactionIds[0]),id:'tx_b',collectionId:'collection_b',importBatchId:b.id,quantity:'10000',sourceOrderId:'000777777777777777777777777777777777777',...overrides});
    m.transactionSources.records.push({...a,id:'collection_b',importBatchId:b.id,transactionIds:['tx_b'],correctionOfCollectionId:a.id});seal(m);
  }
  function legacy(m){
    const batch={id:'legacy_gmo_batch',accountId:'acc_gmo_fx',sourceProvider:'gmo',sourceType:'pdf',targetMonth:'2034-04',snapshotAsOf:'2034-04-30',importedAt:now};
    m.importBatches.records.push(batch);m.accountSnapshots=envelope([{id:'legacy_gmo_snapshot',accountId:batch.accountId,sourceMode:'imported',sourceScope:'gmo-fx-monthly-report',targetMonth:batch.targetMonth,snapshotAsOf:batch.snapshotAsOf,observationType:'officialMonthEnd',valuationCurrency:'JPY',importBatchId:batch.id,importedAt:now,cashBalance:'100',netAssetValue:'100',unrealizedPnl:'0',reportedMonthlyRealizedPnl:'0',accountSpecific:{requiredMargin:'0'}}]);
    m.monthlyAccountStates=envelope([{schemaVersion:2,id:'legacy_gmo_state',accountId:batch.accountId,targetMonth:batch.targetMonth,confirmedAt:now,adoptedAccountSnapshotId:'legacy_gmo_snapshot',domesticImportBatchId:null,foreignAccountSnapshotId:null,cashAccountSnapshotId:null,realizedPnl:'0',swapPnl:'0',deposit:'0',withdrawal:'0'}]);
    const row={schemaVersion:1,id:'legacy_gmo_trade',accountId:batch.accountId,instrumentId:'fx_synthetic',importBatchId:batch.id,sourceProvider:'gmo',sourceType:'pdf',sourceScope:'gmo-fx-trades',targetMonth:batch.targetMonth,tradeDate:'2034-04-19',executedAt:'2034-04-19T12:00:00',side:'buy',normalizedTransactionType:'open',rawTransactionType:'新規',quantity:'10000',quantityUnit:'gmo-reported-count',price:'5.1234',realizedPnl:null,fee:'0',feeCurrency:null,currency:'JPY',providerExecutionId:null,providerOrderId:'00022222222222222222222222222222222',sourcePage:2,sourceRow:1,importedAt:now};m.importedTransactions.records.push(row);
    m.instruments.records.push({id:'crypto_synthetic',assetType:'Crypto',symbol:'BTC/JPY',displayName:'BTC/JPY',quoteCurrency:'JPY',enabled:true});
    m.importBatches.records.push({...batch,id:'legacy_crypto_batch',accountId:'acc_sbivc_crypto',sourceProvider:'sbivc',importerId:'sbivc-monthly',importerVersion:'anonymous-v1',sourceFileMetadata:{hash:'c'.repeat(64),size:125}});
    m.accountSnapshots.records.push({schemaVersion:1,id:'legacy_crypto_snapshot',accountId:'acc_sbivc_crypto',sourceMode:'imported',sourceScope:'sbivc-monthly-assets',targetMonth:batch.targetMonth,snapshotAsOf:batch.snapshotAsOf,observationType:'officialMonthEnd',valuationCurrency:'JPY',importBatchId:'legacy_crypto_batch',importedAt:now,cashBalance:'1',assetValue:'1',netAssetValue:null,unrealizedPnl:null});
    m.monthlyAccountInputs=envelope([{schemaVersion:3,id:'legacy_crypto_input',accountId:'acc_sbivc_crypto',targetMonth:batch.targetMonth,adoptedAccountSnapshotId:'legacy_crypto_snapshot',adoptedAt:now,sourceHistory:[]}]);
    m.importedTransactions.records.push({...row,schemaVersion:2,id:'legacy_crypto_trade',accountId:'acc_sbivc_crypto',instrumentId:'crypto_synthetic',importBatchId:'legacy_crypto_batch',sourceProvider:'sbivc',sourceScope:'sbivc-spot-trades',normalizedTransactionType:'spot-buy',marketType:'spot',feeSemantics:'receipt-positive-payment-negative',quantity:'0.02',quantityUnit:'baseAssetUnits',price:'123456',fee:'3',feeCurrency:'JPY',providerExecutionId:'synthetic-crypto-id'});
    return [{id:'manual_synthetic',account:'LIGHT FX',assetType:'FX',symbol:'TRY/JPY',date:'2034-04-18',category:'new',side:'buy',quantity:1,contractSize:10000,rate:4.5678}];
  }
  const api={now,copy,envelope,fixture,seal,decision,revision,legacy};if(node)module.exports=api;else root.TradeScopeFxHistoryFixture=api;
})(typeof globalThis!=='undefined'?globalThis:this);
