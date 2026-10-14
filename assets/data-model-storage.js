(function (root) {
  'use strict';
  const transaction = typeof module !== 'undefined' && module.exports
    ? require('./storage-transaction.js') : root.TradeScopeStorageTransaction;
  const keys = transaction.modelKeys;
  const monthlySources = typeof module !== 'undefined' && module.exports
    ? require('./monthly-source-contract.js') : root.TradeScopeMonthlySourceContract;
  const reconciliation = typeof module !== 'undefined' && module.exports
    ? require('./transaction-reconciliation.js') : root.TradeScopeTransactionReconciliation;
  // Released Backup schemas are fixed lists, not derived from current Repository keys.
  const backupModelEntities = Object.freeze({
    2: Object.freeze(['accounts', 'instruments', 'importBatches', 'rawTransactions', 'holdingSnapshots', 'accountSnapshots']),
    3: Object.freeze(['accounts', 'instruments', 'importBatches', 'rawTransactions', 'holdingSnapshots', 'accountSnapshots', 'monthlyAccountStates']),
    4: Object.freeze(['accounts', 'instruments', 'importBatches', 'rawTransactions', 'holdingSnapshots', 'accountSnapshots', 'monthlyAccountStates']),
    5: Object.freeze(['accounts', 'instruments', 'importBatches', 'rawTransactions', 'holdingSnapshots', 'accountSnapshots', 'monthlyAccountStates']),
    6: Object.freeze(['accounts', 'instruments', 'importBatches', 'rawTransactions', 'holdingSnapshots', 'accountSnapshots', 'monthlyAccountStates', 'monthlyAccountInputs']),
    7: Object.freeze(['accounts', 'instruments', 'importBatches', 'rawTransactions', 'holdingSnapshots', 'accountSnapshots', 'monthlyAccountStates', 'monthlyAccountInputs']),
    8: Object.freeze(['accounts', 'instruments', 'importBatches', 'rawTransactions', 'holdingSnapshots', 'accountSnapshots', 'monthlyAccountStates', 'monthlyAccountInputs']),
    9: Object.freeze(['accounts', 'instruments', 'importBatches', 'rawTransactions', 'holdingSnapshots', 'accountSnapshots', 'monthlyAccountStates', 'monthlyAccountInputs', 'importedTransactions']),
    10: Object.freeze(['accounts', 'instruments', 'importBatches', 'rawTransactions', 'holdingSnapshots', 'accountSnapshots', 'monthlyAccountStates', 'monthlyAccountInputs', 'importedTransactions']),
    11: Object.freeze(['accounts', 'instruments', 'importBatches', 'rawTransactions', 'holdingSnapshots', 'accountSnapshots', 'monthlyAccountStates', 'monthlyAccountInputs', 'importedTransactions']),
    12: Object.freeze(['accounts', 'instruments', 'importBatches', 'rawTransactions', 'holdingSnapshots', 'accountSnapshots', 'monthlyAccountStates', 'monthlyAccountInputs', 'importedTransactions']),
    13: Object.freeze(['accounts', 'instruments', 'importBatches', 'rawTransactions', 'holdingSnapshots', 'accountSnapshots', 'monthlyAccountStates', 'monthlyAccountInputs', 'importedTransactions', 'transactionReconciliations']),
    14: Object.freeze([...Object.keys(keys)])
  });
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === null || Object.getPrototypeOf(Object.getPrototypeOf(value)) === null);
  function fail() { throw new Error('新モデルの形式・参照・バージョンが不正です'); }
  function assertJson(value, depth = 0) {
    if (depth > 32) fail();
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
    if (typeof value === 'number' && Number.isFinite(value)) return;
    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index++) {
        if (!own(value, index)) fail();
        assertJson(value[index], depth + 1);
      }
      return;
    }
    if (!plain(value)) fail();
    for (const [key, item] of Object.entries(value)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) fail();
      assertJson(item, depth + 1);
    }
  }
  function fields(value, allowed, required = []) {
    if (!plain(value) || Object.keys(value).some(key => !allowed.includes(key)) || required.some(key => !own(value, key))) fail();
  }
  const text = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 512 && !/[\r\n\0]/.test(value);
  const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(value);
  const decimal = value => typeof value === 'string' && /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value) && value.length <= 128;
  const currency = value => typeof value === 'string' && /^[A-Z]{3}$/.test(value);
  function observed(value) {
    if (typeof value !== 'string') return false;
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?)?$/.exec(value);
    if (!m || Number(m[1]) < 1000) return false;
    const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    return date.getUTCFullYear() === Number(m[1]) && date.getUTCMonth() + 1 === Number(m[2])
      && date.getUTCDate() === Number(m[3]) && (!m[4] || (Number(m[4]) < 24 && Number(m[5]) < 60 && (!m[6] || Number(m[6]) < 60)))
      && (!m[7] || m[7] === 'Z' || (Number(m[7].slice(1, 3)) < 24 && Number(m[7].slice(4)) < 60));
  }
  const timestamp = value => observed(value) && /T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value);
  const month = value => typeof value === 'string' && /^\d{4}-(?:0[1-9]|1[0-2])$/.test(value);
  const sourceType = value => ['csv', 'pdf', 'api', 'manual'].includes(value);
  const sourceMode = value => ['imported', 'manual'].includes(value);
  const observationType = value => ['officialMonthEnd', 'approximateForMonth', 'pointInTime'].includes(value);
  const boolean = value => typeof value === 'boolean';
  const positiveInteger = value => Number.isSafeInteger(value) && value > 0;
  const locator = value => text(value) && !/^(?:[\\/]|[A-Za-z]:|[A-Za-z][A-Za-z0-9+.-]*:\/\/|file:)/i.test(value);
  const fileMetadata = value => {
    fields(value, ['hash', 'size']);
    if (own(value, 'hash') && (typeof value.hash !== 'string' || !/^[a-f0-9]{64}$/.test(value.hash))) fail();
    if (own(value, 'size') && (!Number.isSafeInteger(value.size) || value.size < 0)) fail();
    return true;
  };
  // Financial fact columns only: no complete row, file name, identifiers of people or account numbers.
  const rawFieldNames = ['name', 'code', 'product', 'custody', 'quantity', 'quantityUnit', 'acquisitionPrice',
    'marketPrice', 'acquisitionAmount', 'valuation', 'unrealizedPnl', 'sellOrderQuantity', 'distributionMethod',
    'executedAt', 'market', 'orderType', 'transactionType', 'price', 'settlementDate', 'settlementOrPnl',
    'settlementAmount', 'reportedRealizedPnl', 'fee', 'tax', 'maturity', 'taxation'];
  const rawFields = value => {
    fields(value, rawFieldNames);
    if (Object.values(value).some(item => item !== null
      && (typeof item !== 'string' || item.length > 512 || /[\r\n\0]/.test(item)))) fail();
    return true;
  };
  const stringList = value => Array.isArray(value) && value.every(text);
  const specific = value => {
    fields(value, ['requiredMargin', 'maintenanceRate', 'buyingPower', 'depositBalance']);
    if (Object.values(value).some(item => item !== null && !decimal(item))) fail();
    return true;
  };
  const tradersSpecificFields = Object.freeze(['requiredMargin','orderRequiredMargin','maintenanceRate','transferableAmount','unsettledAmount',
    'reportedAccountEvaluationPnl','monthEndUnsettledSwap','reportedSettledSwapPnl','reportedDeposit','reportedWithdrawal']);
  function tradersSpecific(value) {
    fields(value,tradersSpecificFields,tradersSpecificFields);
    return Object.values(value).every(decimal) && ['unsettledAmount'].every(field=>equalDecimal(value[field],'0'));
  }
  function fieldSources(value) {
    fields(value,adoptionFields,adoptionFields);
    return adoptionFields.every(field=>value[field]===(field==='swapPnl'?'manual-income-calendar-swap-accrual':'imported-monthly-pdf'));
  }
  function sourceHistory(value) {
    if(!Array.isArray(value))return false;
    return value.every(row=>{fields(row,['adoptedAccountSnapshotId','sourceValues','adoptedValues','confirmedAt'],['adoptedAccountSnapshotId','sourceValues','adoptedValues','confirmedAt']);
      return id(row.adoptedAccountSnapshotId)&&sourceValues(row.sourceValues)&&sourceValues(row.adoptedValues)&&timestamp(row.confirmedAt);});
  }
  function fxPosition(value) {
    fields(value,['orderId','executedAt','side','quantityUnit','unsettledSwap','requiredMargin'],['orderId','executedAt','side','quantityUnit','unsettledSwap','requiredMargin']);
    return typeof value.orderId==='string'&&/^\d{1,64}$/.test(value.orderId)&&observed(value.executedAt)&&['buy','sell'].includes(value.side)
      &&value.quantityUnit==='reportedQuantity'&&decimal(value.unsettledSwap)&&decimal(value.requiredMargin)&&!value.requiredMargin.startsWith('-');
  }
  const common = { schemaVersion: value => value === 1, id };
  const adoptionFields = Object.freeze(['realizedPnl', 'swapPnl', 'unrealizedPnl', 'deposit', 'withdrawal']);
  function sourceValues(value) {
    fields(value, adoptionFields, adoptionFields);
    if (adoptionFields.some(field => !decimal(value[field]))) fail();
    return true;
  }
  const provenance = { accountId: id, targetMonth: month, snapshotAsOf: observed, importedAt: timestamp,
    sourceMode, sourceScope: text, importBatchId: id, observationType };
  const definitions = {
    transactionReconciliations: {
      required:['schemaVersion','id','manualId','decision','sourceType','facts','members','confirmedAt'],
      types:{...common,manualId:text,decision:v=>['replace','keep-both','defer'].includes(v),sourceType:v=>['pdf','csv'].includes(v),confirmedAt:timestamp,
        facts:v=>{const names=['accountId','instrumentId','tradeDate','side','semantic','quantity','quantityUnit','price','currency'];fields(v,names,names);
          return id(v.accountId)&&id(v.instrumentId)&&observed(v.tradeDate)&&v.tradeDate.length===10&&['buy','sell'].includes(v.side)
            &&['open','close','spot-buy','spot-sell'].includes(v.semantic)&&decimal(v.quantity)&&!v.quantity.startsWith('-')&&!equalDecimal(v.quantity,'0')
            &&decimal(v.price)&&!v.price.startsWith('-')&&['currencyUnits','baseAssetUnits','shares','fundUnits'].includes(v.quantityUnit)&&currency(v.currency);},
        members:v=>Array.isArray(v)&&v.length>0&&v.every(r=>{fields(r,['entity','id'],['entity','id']);return ['rawTransactions','importedTransactions'].includes(r.entity)&&id(r.id);})
      }
    },
    importedTransactions: {
      required:['schemaVersion','id','accountId','instrumentId','importBatchId','sourceProvider','sourceType','sourceScope','targetMonth','tradeDate','executedAt','side','normalizedTransactionType','rawTransactionType','quantity','quantityUnit','price','realizedPnl','fee','feeCurrency','currency','providerExecutionId','providerOrderId','sourcePage','sourceRow','importedAt'],
      nullable:['executedAt','realizedPnl','fee','feeCurrency','providerExecutionId','providerOrderId'],
      types:{...common,accountId:id,instrumentId:id,importBatchId:id,sourceProvider:v=>v==='gmo',sourceType:v=>v==='pdf',sourceScope:v=>v==='gmo-fx-trades',targetMonth:month,
        tradeDate:v=>observed(v)&&v.length===10,executedAt:observed,side:v=>['buy','sell'].includes(v),normalizedTransactionType:v=>['open','close','other'].includes(v),rawTransactionType:text,
        quantity:decimal,quantityUnit:v=>v==='gmo-reported-count',price:decimal,realizedPnl:decimal,fee:decimal,feeCurrency:currency,currency:v=>v==='JPY',
        providerExecutionId:v=>typeof v==='string'&&/^\d{1,64}$/.test(v),providerOrderId:v=>typeof v==='string'&&/^\d{1,64}$/.test(v),sourcePage:positiveInteger,sourceRow:positiveInteger,importedAt:timestamp}
    },
    monthlyAccountInputs: {
      required: ['schemaVersion', 'id', 'accountId', 'targetMonth', 'domesticImportBatchId', 'sourceValues', 'adoptedValues',
        'overrideFields', 'overrideUpdatedAt', 'foreignAccountSnapshotId', 'cashAccountSnapshotId', 'realizedPnl', 'deposit', 'withdrawal'],
      nullable: ['foreignAccountSnapshotId', 'cashAccountSnapshotId', 'realizedPnl', 'deposit', 'withdrawal'],
      types: { ...common, accountId: id, targetMonth: month, domesticImportBatchId: id,
        sourceValues: domesticValues, adoptedValues: domesticValues, overrideUpdatedAt: timestamp,
        overrideFields: value => Array.isArray(value) && new Set(value).size === value.length && value.every(field => ['marketValue', 'unrealizedPnl'].includes(field)),
        foreignAccountSnapshotId: id, cashAccountSnapshotId: id, realizedPnl: decimal, deposit: decimal, withdrawal: decimal }
    },
    accounts: { required: ['id', 'displayName', 'providerCode', 'accountType', 'enabled'],
      types: { ...common, displayName: text, providerCode: text, providerName: text,
        accountType: value => ['fx', 'securities', 'crypto', 'bank', 'other'].includes(value), enabled: boolean,
        legacyRefs: stringList, createdAt: timestamp, updatedAt: timestamp } },
    instruments: { required: ['id', 'assetType', 'symbol', 'displayName', 'enabled'],
      types: { ...common, assetType: value => ['FX', 'Stock', 'ETF', 'MutualFund', 'Crypto', 'Cash', 'Other'].includes(value),
        symbol: text, displayName: text, baseCurrency: currency, quoteCurrency: currency, enabled: boolean,
        aliases: stringList, userAdded: boolean, createdAt: timestamp, updatedAt: timestamp } },
    importBatches: { required: ['id', 'accountId', 'sourceType', 'sourceProvider', 'importedAt'],
      types: { ...common, accountId: id, sourceType, sourceProvider: text, sourceFileMetadata: fileMetadata,
        importedAt: timestamp, targetMonth: month, snapshotAsOf: observed, importerId: id, importerVersion: text } },
    rawTransactions: { required: ['id', 'accountId', 'instrumentId', 'sourceType', 'sourceProvider', 'importedAt', 'transactionType'],
      types: { ...common, accountId: id, instrumentId: id, sourceType, sourceProvider: text, importedAt: timestamp,
        importBatchId: id, sourceRowNumber: positiveInteger, sourceLocator: locator, externalTransactionId: text,
        brokerRawSymbol: text, executedAt: observed, executedAtRaw: text, side: text, quantity: decimal,
        quantityUnit: text, price: decimal, fee: decimal, swap: decimal, realizedPnl: decimal, currency,
        transactionType: text, rawFields } },
    holdingSnapshots: { required: ['id', 'accountId', 'instrumentId', 'sourceMode', 'sourceScope', 'importedAt', 'snapshotAsOf'],
      types: { ...common, ...provenance, accountSnapshotId: id, instrumentId: id, quantity: decimal,
        acquisitionPrice: decimal, marketPrice: decimal, marketValue: decimal, unrealizedPnl: decimal, currency, rawFields } },
    accountSnapshots: { required: ['id', 'accountId', 'sourceMode', 'sourceScope', 'importedAt', 'snapshotAsOf'],
      types: { ...common, ...provenance, valuationCurrency: currency, assetValue: decimal, netAssetValue: decimal,
        cashBalance: decimal, unrealizedPnl: decimal, reportedMonthlyRealizedPnl: decimal, accountSpecific: specific } },
    monthlyAccountStates: {
      required: ['id', 'accountId', 'targetMonth', 'confirmedAt', 'domesticImportBatchId',
        'foreignAccountSnapshotId', 'cashAccountSnapshotId', 'realizedPnl', 'swapPnl', 'deposit', 'withdrawal'],
      nullable: ['domesticImportBatchId', 'foreignAccountSnapshotId', 'cashAccountSnapshotId',
        'realizedPnl', 'swapPnl', 'deposit', 'withdrawal'],
      types: { ...common, accountId: id, targetMonth: month, confirmedAt: timestamp,
        domesticImportBatchId: id, foreignAccountSnapshotId: id, cashAccountSnapshotId: id,
        realizedPnl: decimal, swapPnl: decimal, deposit: decimal, withdrawal: decimal }
    }
  };
  function validateRecord(entity, record) {
    if(entity==='monthlySources'){assertJson(record);monthlySources.validateRecord(record);return;}
    let definition = definitions[entity]; if (!definition) fail();
    if(entity==='importedTransactions'&&record?.schemaVersion===2)definition={...definition,
      required:[...definition.required,'marketType','feeSemantics'],
      types:{...definition.types,schemaVersion:v=>v===2,sourceProvider:text,sourceScope:text,
        marketType:v=>v==='spot',normalizedTransactionType:v=>['spot-buy','spot-sell'].includes(v),
        quantityUnit:v=>v==='baseAssetUnits',providerExecutionId:text,providerOrderId:text,
        feeSemantics:v=>v==='receipt-positive-payment-negative'}};
    if(entity==='monthlyAccountInputs'&&[3,4].includes(record?.schemaVersion))definition={
      required:['schemaVersion','id','accountId','targetMonth','adoptedAccountSnapshotId','adoptedAt','sourceHistory'],
      types:{schemaVersion:v=>[3,4].includes(v),id,accountId:id,targetMonth:month,adoptedAccountSnapshotId:id,adoptedAt:timestamp,
        sourceHistory:v=>Array.isArray(v)&&v.every(r=>{fields(r,['adoptedAccountSnapshotId','adoptedAt'],['adoptedAccountSnapshotId','adoptedAt']);return id(r.adoptedAccountSnapshotId)&&timestamp(r.adoptedAt);})}};
    if(entity==='monthlyAccountInputs'&&record?.schemaVersion===4)definition={
      required:[...definition.required,'observationOverrides','overrideUpdatedAt','overrideHistory'],
      types:{...definition.types,schemaVersion:v=>v===4,observationOverrides:observationOverrides,overrideUpdatedAt:timestamp,
        overrideHistory:v=>Array.isArray(v)&&v.every(r=>{fields(r,['adoptedAccountSnapshotId','observationOverrides','overrideUpdatedAt'],['adoptedAccountSnapshotId','observationOverrides','overrideUpdatedAt']);return id(r.adoptedAccountSnapshotId)&&observationOverrides(r.observationOverrides)&&timestamp(r.overrideUpdatedAt);})}};
    if(entity==='monthlyAccountInputs'&&record?.schemaVersion===2)definition={
      required:['schemaVersion','id','accountId','targetMonth','adoptedAccountSnapshotId','sourceValues','adoptedValues','fieldSources','overrideFields','overrideUpdatedAt','sourceHistory','pdfObservations'],
      types:{schemaVersion:v=>v===2,id,accountId:id,targetMonth:month,adoptedAccountSnapshotId:id,
        sourceValues:partialValues,adoptedValues:partialValues,fieldSources,overrideUpdatedAt:timestamp,
        overrideFields:v=>Array.isArray(v)&&new Set(v).size===v.length&&v.every(f=>adoptionFields.includes(f)),
        sourceHistory:partialHistory,pdfObservations:v=>{fields(v,['fee','other'],['fee','other']);return ['fee','other'].every(f=>decimal(v[f])&&equalDecimal(v[f],'0'));}}};
    if(entity==='accountSnapshots'&&record?.schemaVersion===2)definition={...definition,
      required:[...definition.required,'schemaVersion','accountSpecific','reportedMonthlyRealizedPnl','cashBalance','netAssetValue','unrealizedPnl','importBatchId','targetMonth','observationType','valuationCurrency'],
      types:{...definition.types,schemaVersion:v=>v===2,accountSpecific:tradersSpecific}};
    if(entity==='holdingSnapshots'&&record?.schemaVersion===2)definition={...definition,
      required:[...definition.required,'schemaVersion','accountSnapshotId','fxPosition','quantity','acquisitionPrice','marketPrice','unrealizedPnl','currency','targetMonth','importBatchId','observationType'],
      types:{...definition.types,schemaVersion:v=>v===2,fxPosition}};
    if (entity === 'monthlyAccountStates' && [2, 3, 4].includes(record?.schemaVersion)) {
      definition = { ...definition, required: [...definition.required, 'schemaVersion', 'adoptedAccountSnapshotId'],
        types: { ...definition.types, schemaVersion: value => [2, 3, 4].includes(value), adoptedAccountSnapshotId: id } };
      if ([3,4].includes(record.schemaVersion)) definition = { ...definition,
        required: [...definition.required, 'sourceValues', 'adoptedUnrealizedPnl', 'overrideFields', 'overrideUpdatedAt'],
        types: {...definition.types, sourceValues, adoptedUnrealizedPnl: decimal, overrideUpdatedAt: timestamp,
          overrideFields: value => Array.isArray(value) && new Set(value).size === value.length && value.every(field => adoptionFields.includes(field))} };
      if(record.schemaVersion===4)definition={...definition,required:[...definition.required,'fieldSources','sourceHistory'],types:{...definition.types,fieldSources,sourceHistory}};
    }
    assertJson(record); fields(record, Object.keys(definition.types), definition.required);
    for (const [field, value] of Object.entries(record)) {
      // Required identity/source fields cannot be null; unknown financial/date observations can.
      const nullable = field !== 'schemaVersion' && (!definition.required.includes(field) || field === 'snapshotAsOf'
        || definition.nullable?.includes(field));
      if (value === null && nullable) continue;
      if (!definition.types[field](value)) fail();
    }
  }
  function validateEnvelope(entity, value) {
    if (value === null) return;
    if(entity==='monthlySources'){assertJson(value);monthlySources.validateEnvelope(value);return;}
    assertJson(value); fields(value, ['schemaVersion', 'records', 'updatedAt'], ['schemaVersion', 'records', 'updatedAt']);
    if (value.schemaVersion !== 1 || !Array.isArray(value.records) || !timestamp(value.updatedAt)) fail();
    const ids = new Set();
    for (const record of value.records) {
      validateRecord(entity, record);
      if (ids.has(record.id)) fail(); ids.add(record.id);
    }
  }
  function validateModelSet(models, entities) {
    fields(models, entities, entities); assertJson(models);
    for (const entity of entities) validateEnvelope(entity, models[entity]);
    monthlySources.validateSet(models);
    const records = entity => models[entity]?.records || [];
    const manualIds=new Set(),replacedMembers=new Set();
    for(const r of records('transactionReconciliations')){
      if(manualIds.has(r.manualId)||!reconciliation.validateRelation(r,models))fail();manualIds.add(r.manualId);
      const seen=new Set();for(const member of r.members){const key=member.entity+':'+member.id;if(seen.has(key)||r.decision==='replace'&&replacedMembers.has(key))fail();seen.add(key);if(r.decision==='replace')replacedMembers.add(key);}
    }
    const accounts = new Map(records('accounts').map(item => [item.id, item]));
    const instruments = new Set(records('instruments').map(item => item.id));
    const batches = new Map(records('importBatches').map(item => [item.id, item]));
    const snapshots = new Map(records('accountSnapshots').map(item => [item.id, item]));
    const externalIds = new Set(), sourceRows = new Set();
    for (const entity of ['importBatches', 'rawTransactions', 'holdingSnapshots', 'accountSnapshots', 'importedTransactions']) {
      for (const record of records(entity)) {
        if (!accounts.has(record.accountId) || (record.instrumentId && !instruments.has(record.instrumentId))) fail();
        if (record.importBatchId) {
          const batch = batches.get(record.importBatchId);
          if (!batch || batch.accountId !== record.accountId || batch.importedAt !== record.importedAt) fail();
          if (entity === 'rawTransactions' && (batch.sourceType !== record.sourceType || batch.sourceProvider !== record.sourceProvider)) fail();
          if (entity.endsWith('Snapshots') && (record.sourceMode !== 'imported' || batch.sourceType === 'manual'
            || batch.snapshotAsOf !== record.snapshotAsOf || (record.targetMonth && batch.targetMonth !== record.targetMonth))) fail();
        } else if ((entity === 'rawTransactions' && record.sourceType !== 'manual')
          || (entity.endsWith('Snapshots') && record.sourceMode === 'imported')) fail();
        if (record.accountSnapshotId) {
          const snapshot = snapshots.get(record.accountSnapshotId);
          if (!snapshot || ['accountId', 'snapshotAsOf', 'importedAt', 'sourceMode', 'sourceScope', 'importBatchId', 'targetMonth']
            .some(field => (snapshot[field] ?? null) !== (record[field] ?? null))) fail();
        }
        if(entity==='importedTransactions'){
          const batch=batches.get(record.importBatchId),account=accounts.get(record.accountId),instrument=records('instruments').find(i=>i.id===record.instrumentId);
          if(batch.sourceType!=='pdf'||batch.sourceProvider!==record.sourceProvider||batch.targetMonth!==record.targetMonth
            ||record.tradeDate.slice(0,7)!==record.targetMonth||record.executedAt!==null&&record.executedAt.slice(0,10)!==record.tradeDate
            ||record.quantity.startsWith('-')||equalDecimal(record.quantity,'0')||record.price.startsWith('-'))fail();
          if(record.schemaVersion===1){
            if(account.id!=='acc_gmo_fx'||account.providerCode!=='gmo'||account.accountType!=='fx'||instrument?.assetType!=='FX'
              ||record.fee!==null&&(record.fee.startsWith('-')||record.feeCurrency===null&&!/^(?:0)(?:\.0+)?$/.test(record.fee)))fail();
          }else validateSpotTransaction(record,account,instrument,batch);
          const rowKey=JSON.stringify([record.importBatchId,record.sourcePage,record.sourceRow]);if(sourceRows.has(rowKey))fail();sourceRows.add(rowKey);
          if(record.providerExecutionId!==null){const key=JSON.stringify(['imported',record.importBatchId,record.providerExecutionId]);if(externalIds.has(key))fail();externalIds.add(key);}
        }
        if (entity === 'rawTransactions') {
          if (record.externalTransactionId) {
            const key = JSON.stringify([record.accountId, record.externalTransactionId]);
            if (externalIds.has(key)) fail(); externalIds.add(key);
          }
          if (record.importBatchId && record.sourceRowNumber) {
            const key = JSON.stringify([record.importBatchId, record.sourceRowNumber]);
            if (sourceRows.has(key)) fail(); sourceRows.add(key);
          }
        }
        if (entity === 'accountSnapshots' && record.accountSpecific) {
          const type = accounts.get(record.accountId).accountType;
          const allowed = type === 'fx' ? record.schemaVersion===2 ? tradersSpecificFields : ['requiredMargin', 'maintenanceRate'] : type === 'securities' ? ['buyingPower', 'depositBalance'] : [];
          if (Object.keys(record.accountSpecific).some(field => !allowed.includes(field))) fail();
        }
        if(entity==='holdingSnapshots'&&record.schemaVersion===2){
          const snapshot=snapshots.get(record.accountSnapshotId),instrument=records('instruments').find(row=>row.id===record.instrumentId);
          if(snapshot?.schemaVersion!==2||!['acc_lightfx_fx','acc_minna_fx'].includes(record.accountId)||instrument?.assetType!=='FX'
            ||record.currency!=='JPY'||record.marketValue!=null||record.quantity.startsWith('-')||equalDecimal(record.quantity,'0'))fail();
        }
        if(entity==='accountSnapshots'&&record.schemaVersion===2){
          const policy=adoptionPolicies[accounts.get(record.accountId).providerCode];
          if(!policy?.calendarSwap||record.accountId!==policy.accountId||record.sourceScope!==policy.sourceScope||record.sourceMode!=='imported'
            ||record.observationType!=='officialMonthEnd'||record.valuationCurrency!=='JPY'||record.assetValue!=null)fail();
          const csv=typeof module!=='undefined'&&module.exports?require('../import/csv-core.js'):root.TradeScopeCSV;
          const positions=records('holdingSnapshots').filter(row=>row.accountSnapshotId===record.id);
          const aggregate=field=>positions.length?csv.sum(positions.map(row=>field==='swap'?row.fxPosition?.unsettledSwap:row.unrealizedPnl)):'0';
          if(positions.some(row=>row.schemaVersion!==2)||!equalDecimal(aggregate('pnl')||'',record.unrealizedPnl)
            ||!equalDecimal(aggregate('swap')||'',record.accountSpecific.monthEndUnsettledSwap)
            ||!equalDecimal(csv.sum([record.unrealizedPnl,record.accountSpecific.monthEndUnsettledSwap]),record.accountSpecific.reportedAccountEvaluationPnl)
            ||!equalDecimal(csv.sum([record.cashBalance,record.accountSpecific.reportedAccountEvaluationPnl]),record.netAssetValue))fail();
        }
      }
    }
    const accountMonths = new Set();
    for (const state of records('monthlyAccountStates')) {
      const account = accounts.get(state.accountId);
      const pair = JSON.stringify([state.accountId, state.targetMonth]);
      if (!account || accountMonths.has(pair)) fail();
      accountMonths.add(pair);
      const sameMonth = record => record && record.accountId === state.accountId && record.targetMonth === state.targetMonth;
      const hasSbiReferences = ['domesticImportBatchId', 'foreignAccountSnapshotId', 'cashAccountSnapshotId']
        .some(field => state[field] !== null);
      if ([2, 3, 4].includes(state.schemaVersion)) {
        if (hasSbiReferences) fail();
        validateAdoptedSnapshot(state, account, snapshots, batches);
        if(state.schemaVersion===4)for(const revision of state.sourceHistory){
          const previous=snapshots.get(revision.adoptedAccountSnapshotId);
          if(!sameMonth(previous)||previous.schemaVersion!==2||previous.sourceScope!==snapshots.get(state.adoptedAccountSnapshotId)?.sourceScope)fail();
          validateCalendarSources(revision.sourceValues,previous);
          if(['deposit','withdrawal'].some(field=>revision.adoptedValues[field].startsWith('-')))fail();
        }
      }
      if (hasSbiReferences && (account.providerCode !== 'sbi' || account.accountType !== 'securities')) fail();
      if (state.domesticImportBatchId !== null) {
        const batch = batches.get(state.domesticImportBatchId);
        const holdings = records('holdingSnapshots').filter(item => item.importBatchId === state.domesticImportBatchId);
        if (!sameMonth(batch) || batch.sourceType !== 'csv' || batch.sourceProvider !== 'sbi'
          || !holdings.length || holdings.some(item => !sameMonth(item) || item.sourceMode !== 'imported'
            || item.sourceScope !== 'sbi-domestic-holdings')) fail();
      }
      for (const [field, scope] of [['foreignAccountSnapshotId', 'sbi-foreign-securities'], ['cashAccountSnapshotId', 'sbi-cash']]) {
        if (state[field] === null) continue;
        const snapshot = snapshots.get(state[field]);
        if (!sameMonth(snapshot) || snapshot.sourceMode !== 'manual' || snapshot.sourceScope !== scope
          || snapshot.valuationCurrency !== 'JPY' || snapshot.importBatchId) fail();
      }
    }
    const inputMonths = new Set();
    for (const input of records('monthlyAccountInputs')) {
      if([3,4].includes(input.schemaVersion)){
        const pair=JSON.stringify([input.accountId,input.targetMonth]);if(inputMonths.has(pair))fail();inputMonths.add(pair);
        validateObservationInput(input, accounts, snapshots, batches, records('holdingSnapshots'), records('instruments'));
        if(records('monthlyAccountStates').some(r=>r.accountId===input.accountId&&r.targetMonth===input.targetMonth))fail();
        continue;
      }
      if(input.schemaVersion===2){
        const pair=JSON.stringify([input.accountId,input.targetMonth]);if(inputMonths.has(pair))fail();inputMonths.add(pair);
        const account=accounts.get(input.accountId),snapshot=snapshots.get(input.adoptedAccountSnapshotId);
        validateTradersInput(input,account,snapshot);
        for(const revision of input.sourceHistory){const previous=snapshots.get(revision.adoptedAccountSnapshotId);
          if(revision.sourceValues.swapPnl!==null&&!equalNullable(revision.sourceValues.swapPnl,input.sourceValues.swapPnl))fail();
          validateTradersInput({...input,...revision,overrideFields:adoptionFields.filter(f=>!equalNullable(revision.sourceValues[f],revision.adoptedValues[f]))},account,previous);}
        const state=records('monthlyAccountStates').find(r=>r.accountId===input.accountId&&r.targetMonth===input.targetMonth);
        if(state&&(state.schemaVersion!==4||state.adoptedAccountSnapshotId!==input.adoptedAccountSnapshotId
          ||adoptionFields.some(f=>!equalNullable(state.sourceValues[f],input.sourceValues[f])||!equalNullable(adoptedValues(state,snapshot)[f],input.adoptedValues[f]))))fail();
        if(!state&&input.adoptedValues.swapPnl!==null)fail();
        continue;
      }
      const account = accounts.get(input.accountId), batch = batches.get(input.domesticImportBatchId);
      const pair = JSON.stringify([input.accountId, input.targetMonth]);
      if (inputMonths.has(pair) || input.accountId !== 'acc_sbi_sec' || account?.providerCode !== 'sbi'
        || account.accountType !== 'securities' || input.targetMonth < '2026-09'
        || !batch || batch.accountId !== input.accountId || batch.targetMonth !== input.targetMonth
        || batch.sourceType !== 'csv' || batch.sourceProvider !== 'sbi' || !batch.snapshotAsOf) fail();
      inputMonths.add(pair);
      const holdings = records('holdingSnapshots').filter(row => row.importBatchId === batch.id);
      if (!holdings.length || holdings.some(row => row.accountId !== input.accountId || row.targetMonth !== input.targetMonth
        || row.sourceMode !== 'imported' || row.sourceScope !== 'sbi-domestic-holdings'
        || (row.currency != null && row.currency !== 'JPY'))) fail();
      const csv = typeof module !== 'undefined' && module.exports ? require('../import/csv-core.js') : root.TradeScopeCSV;
      for (const field of ['marketValue', 'unrealizedPnl']) {
        const sum = csv.sum(holdings.map(row => row[field] ?? null));
        if (sum === null || !equalDecimal(sum, input.sourceValues[field])) fail();
      }
      const changed = ['marketValue', 'unrealizedPnl'].filter(field => !equalDecimal(input.sourceValues[field], input.adoptedValues[field]));
      if (changed.length !== input.overrideFields.length || changed.some(field => !input.overrideFields.includes(field))) fail();
      for (const [field, scope] of [['foreignAccountSnapshotId', 'sbi-foreign-securities'], ['cashAccountSnapshotId', 'sbi-cash']]) {
        if (input[field] === null) continue;
        const row = snapshots.get(input[field]);
        if (!row || row.accountId !== input.accountId || row.targetMonth !== input.targetMonth || row.sourceMode !== 'manual'
          || row.sourceScope !== scope || row.valuationCurrency !== 'JPY' || row.importBatchId) fail();
      }
      const state = records('monthlyAccountStates').find(row => row.accountId === input.accountId && row.targetMonth === input.targetMonth);
      if (state && ['domesticImportBatchId', 'foreignAccountSnapshotId', 'cashAccountSnapshotId', 'realizedPnl', 'deposit', 'withdrawal']
        .some(field => state[field] !== input[field])) fail();
    }
    return true;
  }
  function domesticValues(value) {
    fields(value, ['marketValue', 'unrealizedPnl'], ['marketValue', 'unrealizedPnl']);
    if (!decimal(value.marketValue) || !decimal(value.unrealizedPnl)) fail();
    return true;
  }
  // Observation-only adoption: no ledger inputs, invented P/L or broker-specific cashflow.
  const observationPolicies=Object.freeze({sbivc:Object.freeze({accountId:'acc_sbivc_crypto',accountType:'crypto',sourceScope:'sbivc-monthly-assets',importerId:'sbivc-monthly'})});
  function observationOverrides(value){
    fields(value,['account','holdings'],['account','holdings']);
    fields(value.account,['cashBalance','assetValue']);
    const values=v=>Object.values(v).every(x=>x===null||decimal(x)&&!x.startsWith('-'));
    if(!values(value.account)||!Array.isArray(value.holdings))fail();
    const ids=new Set();
    for(const row of value.holdings){
      fields(row,['holdingSnapshotId','instrumentId','values'],['holdingSnapshotId','instrumentId','values']);
      fields(row.values,['quantity','marketPrice','marketValue']);
      if(!id(row.holdingSnapshotId)||!id(row.instrumentId)||ids.has(row.holdingSnapshotId)||!Object.keys(row.values).length||!values(row.values))fail();
      ids.add(row.holdingSnapshotId);
    }
    return true;
  }
  function validateObservationOverrides(value,snapshot,holdings){
    if(!snapshot)fail();
    for(const [field,adopted] of Object.entries(value.account))if(equalNullable(snapshot[field]??null,adopted))fail();
    for(const row of value.holdings){
      const source=holdings.find(h=>h.id===row.holdingSnapshotId&&h.accountSnapshotId===snapshot.id&&h.instrumentId===row.instrumentId);
      if(!source||Object.entries(row.values).some(([field,adopted])=>equalNullable(source[field]??null,adopted)))fail();
    }
  }
  function validateObservationInput(input,accounts,snapshots,batches,holdings,instruments){
    const account=accounts.get(input.accountId),policy=observationPolicies[account?.providerCode];
    if(!policy||account.id!==policy.accountId||account.accountType!==policy.accountType)fail();
    if(input.schemaVersion===4){
      validateObservationOverrides(input.observationOverrides,snapshots.get(input.adoptedAccountSnapshotId),holdings);
      const refs=new Set([...input.sourceHistory.map(r=>r.adoptedAccountSnapshotId),input.adoptedAccountSnapshotId]);
      for(const revision of input.overrideHistory){
        if(!refs.has(revision.adoptedAccountSnapshotId))fail();
        validateObservationOverrides(revision.observationOverrides,snapshots.get(revision.adoptedAccountSnapshotId),holdings);
      }
    }
    for(const ref of [...input.sourceHistory,{adoptedAccountSnapshotId:input.adoptedAccountSnapshotId,adoptedAt:input.adoptedAt}]){
      const snapshot=snapshots.get(ref.adoptedAccountSnapshotId),batch=batches.get(snapshot?.importBatchId);
      if(!snapshot||snapshot.accountId!==input.accountId||snapshot.targetMonth!==input.targetMonth||snapshot.sourceScope!==policy.sourceScope
        ||snapshot.sourceMode!=='imported'||snapshot.observationType!=='officialMonthEnd'||snapshot.valuationCurrency!=='JPY'
        ||snapshot.schemaVersion!==1||!decimal(snapshot.cashBalance)||!decimal(snapshot.assetValue)||snapshot.cashBalance.startsWith('-')||snapshot.assetValue.startsWith('-')
        ||snapshot.netAssetValue!=null||snapshot.unrealizedPnl!=null||snapshot.reportedMonthlyRealizedPnl!=null||snapshot.accountSpecific!=null
        ||batch?.sourceType!=='pdf'||batch.sourceProvider!==account.providerCode||batch.importerId!==policy.importerId
        ||!batch.importerVersion||!batch.sourceFileMetadata?.hash)fail();
      const end=new Date(Date.UTC(+input.targetMonth.slice(0,4),+input.targetMonth.slice(5),0)).toISOString().slice(0,10);
      if(snapshot.snapshotAsOf!==end)fail();
      const seen=new Set();
      for(const row of holdings.filter(h=>h.accountSnapshotId===snapshot.id)){
        const instrument=instruments.find(i=>i.id===row.instrumentId);
        if(row.schemaVersion!==1||instrument?.assetType!=='Crypto'||!/^[A-Z][A-Z0-9]{1,19}\/JPY$/.test(instrument.symbol)||instrument.quoteCurrency!=null&&instrument.quoteCurrency!=='JPY'
          ||seen.has(row.instrumentId)||row.currency!=='JPY'||!decimal(row.quantity)||!decimal(row.marketValue)||row.quantity.startsWith('-')||row.marketValue.startsWith('-')
          ||row.acquisitionPrice!=null||row.unrealizedPnl!=null||row.rawFields!=null||row.marketPrice!=null&&(!decimal(row.marketPrice)||row.marketPrice.startsWith('-')))fail();
        seen.add(row.instrumentId);
      }
    }
  }
  function equalNullable(a,b){return a===null||b===null?a===b:decimal(a)&&decimal(b)&&equalDecimal(a,b);}
  function partialValues(value){fields(value,adoptionFields,adoptionFields);return adoptionFields.every(f=>f==='swapPnl'&&value[f]===null||decimal(value[f])&&(f!=='swapPnl'||/^-?(?:0|[1-9]\d*)$/.test(value[f])));}
  function partialHistory(value){return Array.isArray(value)&&value.every(row=>{
    fields(row,['adoptedAccountSnapshotId','sourceValues','adoptedValues','overrideUpdatedAt'],['adoptedAccountSnapshotId','sourceValues','adoptedValues','overrideUpdatedAt']);
    return id(row.adoptedAccountSnapshotId)&&partialValues(row.sourceValues)&&partialValues(row.adoptedValues)&&timestamp(row.overrideUpdatedAt);});}
  function validateTradersInput(input,account,snapshot){
    const policy=adoptionPolicies[account?.providerCode];
    if(!policy?.calendarSwap||account.id!==policy.accountId||account.accountType!=='fx'||snapshot?.schemaVersion!==2
      ||snapshot.accountId!==input.accountId||snapshot.targetMonth!==input.targetMonth||input.targetMonth<'2026-09'
      ||['sourceScope','sourceMode','observationType','valuationCurrency'].some(f=>snapshot[f]!==policy[f]))fail();
    const expected={realizedPnl:snapshot.reportedMonthlyRealizedPnl,unrealizedPnl:snapshot.unrealizedPnl,
      deposit:snapshot.accountSpecific.reportedDeposit,withdrawal:snapshot.accountSpecific.reportedWithdrawal};
    if(Object.keys(expected).some(f=>!equalNullable(expected[f],input.sourceValues[f]))
      ||['sourceValues','adoptedValues'].some(v=>['deposit','withdrawal'].some(f=>input[v][f].startsWith('-')))
      ||(input.sourceValues.swapPnl===null)!==(input.adoptedValues.swapPnl===null))fail();
    const changed=adoptionFields.filter(f=>!equalNullable(input.sourceValues[f],input.adoptedValues[f]));
    if(changed.length!==input.overrideFields.length||changed.some(f=>!input.overrideFields.includes(f)))fail();
  }
  function validateModels(models) { return validateModelSet({monthlyAccountInputs: null, importedTransactions:null, transactionReconciliations:null, monthlySources:null, ...models}, Object.keys(keys)); }
  // Source policy is separate from the common v2 record shape; unimplemented providers fail closed.
  function validateSpotTransaction(record,account,instrument,batch){
    if(account.id!=='acc_sbivc_crypto'||account.providerCode!=='sbivc'||account.accountType!=='crypto'
      ||record.sourceProvider!=='sbivc'||record.sourceScope!=='sbivc-spot-trades'||batch.importerId!=='sbivc-monthly'
      ||instrument?.assetType!=='Crypto'||!/^[A-Z][A-Z0-9]{1,19}\/JPY$/.test(instrument.symbol)
      ||instrument.quoteCurrency!=null&&instrument.quoteCurrency!=='JPY'||record.marketType!=='spot'
      ||record.normalizedTransactionType!==(record.side==='buy'?'spot-buy':'spot-sell')
      ||record.executedAt===null||record.providerExecutionId===null||record.realizedPnl!==null
      ||record.feeCurrency!=='JPY'||record.currency!=='JPY')fail();
  }
  // Only implemented policies can adopt a whole-account observation. Future brokers are not implicitly enabled.
  const adoptionPolicies = Object.freeze({ gmo: Object.freeze({ accountType: 'fx', sourceScope: 'gmo-fx-monthly-report',
    sourceMode: 'imported', observationType: 'officialMonthEnd', valuationCurrency: 'JPY', sourceType: 'pdf' }),
    lightfx:Object.freeze({accountId:'acc_lightfx_fx',accountType:'fx',sourceScope:'lightfx-monthly-report',sourceMode:'imported',observationType:'officialMonthEnd',valuationCurrency:'JPY',sourceType:'pdf',calendarSwap:true}),
    minna:Object.freeze({accountId:'acc_minna_fx',accountType:'fx',sourceScope:'minna-monthly-report',sourceMode:'imported',observationType:'officialMonthEnd',valuationCurrency:'JPY',sourceType:'pdf',calendarSwap:true}) });
  function validateAdoptedSnapshot(state, account, snapshots, batches) {
    const policy = adoptionPolicies[account.providerCode], snapshot = snapshots.get(state.adoptedAccountSnapshotId);
    if (!policy || account.accountType !== policy.accountType || !snapshot
      || snapshot.accountId !== state.accountId || snapshot.targetMonth !== state.targetMonth) fail();
    for (const field of ['sourceScope', 'sourceMode', 'observationType', 'valuationCurrency']) if (snapshot[field] !== policy[field]) fail();
    const batch = batches.get(snapshot.importBatchId);
    if(policy.calendarSwap&&(account.id!==policy.accountId||state.schemaVersion!==4||snapshot.schemaVersion!==2))fail();
    if(!policy.calendarSwap&&state.schemaVersion===4)fail();
    const [year, month] = state.targetMonth.split('-').map(Number);
    const lastDay = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
    if (!batch || batch.sourceProvider !== account.providerCode || batch.sourceType !== policy.sourceType
      || snapshot.snapshotAsOf !== lastDay || state.targetMonth < '2026-09'
      || ['realizedPnl', 'swapPnl', 'deposit', 'withdrawal'].some(field => !decimal(state[field]))
      || ['deposit', 'withdrawal'].some(field => state[field].startsWith('-'))
      || ['cashBalance', 'netAssetValue', 'unrealizedPnl'].some(field => !decimal(snapshot[field]))
      || !decimal(snapshot.accountSpecific?.requiredMargin)
      || !decimal(snapshot.reportedMonthlyRealizedPnl) || !decimal(state.realizedPnl)) fail();
    adoptedValues(state, snapshot);
  }
  // The immutable v2 adoption is the baseline for swap/flows (not retained in the original Snapshot).
  // Only an explicit, exact difference list permits adopted values to differ from that baseline.
  function adoptedValues(state, snapshot) {
    validateRecord('monthlyAccountStates', state);
    if (!snapshot || !decimal(snapshot.reportedMonthlyRealizedPnl) || !decimal(snapshot.unrealizedPnl)) fail();
    const values = {realizedPnl: state.realizedPnl, swapPnl: state.swapPnl,
      unrealizedPnl: [3,4].includes(state.schemaVersion) ? state.adoptedUnrealizedPnl : snapshot.unrealizedPnl,
      deposit: state.deposit, withdrawal: state.withdrawal};
    if (adoptionFields.some(field => !decimal(values[field]))) fail();
    if ([3,4].includes(state.schemaVersion)) {
      if (!equalDecimal(state.sourceValues.realizedPnl, snapshot.reportedMonthlyRealizedPnl)
        || !equalDecimal(state.sourceValues.unrealizedPnl, snapshot.unrealizedPnl)
        || ['deposit', 'withdrawal'].some(field => state.sourceValues[field].startsWith('-'))) fail();
      const changed = adoptionFields.filter(field => !equalDecimal(values[field], state.sourceValues[field]));
      if (changed.length !== state.overrideFields.length || changed.some(field => !state.overrideFields.includes(field))) fail();
      if(state.schemaVersion===4)validateCalendarSources(state.sourceValues,snapshot);
      if(state.schemaVersion===4&&!/^\-?(?:0|[1-9]\d*)$/.test(values.swapPnl))fail();
    } else if (state.schemaVersion !== 2 || !equalDecimal(values.realizedPnl, snapshot.reportedMonthlyRealizedPnl)) fail();
    return values;
  }
  function validateCalendarSources(values,snapshot) {
    if(snapshot.schemaVersion!==2
      ||!equalDecimal(values.realizedPnl,snapshot.reportedMonthlyRealizedPnl)||!equalDecimal(values.unrealizedPnl,snapshot.unrealizedPnl)
      ||!equalDecimal(values.deposit,snapshot.accountSpecific.reportedDeposit)||!equalDecimal(values.withdrawal,snapshot.accountSpecific.reportedWithdrawal)
      ||!/^\-?(?:0|[1-9]\d*)$/.test(values.swapPnl))fail();
  }
  function equalDecimal(a, b) {
    const canonical = value => value.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '').replace(/^-0$/, '0');
    return canonical(a) === canonical(b);
  }
  function validateBackupModels(version, models) {
    const entities = backupModelEntities[version];
    if (!entities) fail();
    // Released v3 permits only the original State fields, even after Repository evolution.
    if (version < 4) for (const record of models?.monthlyAccountStates?.records || []) {
      fields(record, Object.keys(definitions.monthlyAccountStates.types), definitions.monthlyAccountStates.required);
      if (own(record, 'schemaVersion') && record.schemaVersion !== 1) fail();
    }
    if (version === 4 && (models?.monthlyAccountStates?.records || []).some(record => record.schemaVersion === 3)) fail();
    if(version<7&&(['accountSnapshots','holdingSnapshots'].some(entity=>(models?.[entity]?.records||[]).some(record=>record.schemaVersion===2))
      ||(models?.monthlyAccountStates?.records||[]).some(record=>record.schemaVersion===4)))fail();
    if(version<8&&(models?.monthlyAccountInputs?.records||[]).some(r=>r.schemaVersion===2))fail();
    if(version<10&&(models?.monthlyAccountInputs?.records||[]).some(r=>r.schemaVersion===3))fail();
    if(version<11&&(models?.monthlyAccountInputs?.records||[]).some(r=>r.schemaVersion===4))fail();
    if(version<12&&(models?.importedTransactions?.records||[]).some(r=>r.schemaVersion===2))fail();
    if(version===14)monthlySources.validateSet(models,{strictStale:true});
    return validateModelSet(models, entities);
  }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function localStorageAdapter(storage) {
    // Explicit injection only: loading this module never reads/seeds real browser data.
    return Object.freeze({ getItem: key => storage.getItem(key), setItem: (key, value) => storage.setItem(key, value),
      removeItem: key => storage.removeItem(key) });
  }
  function readModels(adapter) {
    const result = {};
    for (const [entity, key] of Object.entries(keys)) {
      const raw = adapter.getItem(key);
      try { result[entity] = raw === null ? null : JSON.parse(raw); } catch (_) { fail(); }
    }
    validateModels(result); return result;
  }
  function createRepository(adapter, options = {}) {
    const clock = options.clock || (() => new Date().toISOString());
    function commit(changes, guard = {}) {
      fields(changes, Object.keys(keys));
      if (!Object.keys(changes).length) fail();
      const models = readModels(adapter);
      const registeredSourceFacts=(models.monthlySources?.records||[]).filter(r=>r.kind==='source'&&r.reference)
        .map(source=>({source,fingerprint:monthlySources.sourceFingerprint(source,models)}));
      const verifyLegacy=()=>{
        if(!own(guard,'expectedLegacy'))return;
        fields(guard.expectedLegacy,['tradingData','yearInitialFunds','yearInitialUnrealized'],['tradingData','yearInitialFunds','yearInitialUnrealized']);
        if(Object.entries(guard.expectedLegacy).some(([k,v])=>adapter.getItem(k)!==v))throw Error('STALE_MONTHLY_SOURCE_DRAFT');
      };
      verifyLegacy();
      if (own(guard,'expectedManual') && adapter.getItem(reconciliation.manualKey)!==guard.expectedManual) {
        throw new Error('手入力データが変更されています。再確認してください');
      }
      if (own(guard, 'expectedModels')) {
        validateModels(guard.expectedModels);
        if (JSON.stringify(models) !== JSON.stringify(guard.expectedModels)) {
          throw new Error('保存データが変更されています。再確認してください');
        }
      }
      for (const [entity, value] of Object.entries(changes)) {
        // No physical-delete Repository API: retain historical entities and disable Accounts.
        if (value === null) fail();
        validateEnvelope(entity, value);
        if(entity==='monthlySources'){
          for(const old of models[entity]?.records||[]){if(JSON.stringify(value.records.find(r=>r.id===old.id))!==JSON.stringify(old))fail();}
          for(const next of value.records.filter(r=>!models[entity]?.records.some(old=>old.id===r.id)))if(next.kind==='source'&&monthlySources.sourceFingerprint(next,{...models,...changes})!==next.fingerprint)fail();
        }
        if(entity==='transactionReconciliations')for(const old of models[entity]?.records||[]){
          const next=value.records.find(r=>r.id===old.id);
          if(!next||next.manualId!==old.manualId||old.decision!=='defer'&&JSON.stringify(next)!==JSON.stringify(old))fail();
        }
        if (entity === 'accounts' && (models.accounts?.records || []).some(record => !value.records.some(item => item.id === record.id))) fail();
        if (['monthlyAccountStates', 'monthlyAccountInputs'].includes(entity) && (models[entity]?.records || []).some(record => value.records.some(item =>
          (item.accountId === record.accountId && item.targetMonth === record.targetMonth && item.id !== record.id)
          || (item.id === record.id && (item.accountId !== record.accountId || item.targetMonth !== record.targetMonth))))) fail();
        if (entity === 'monthlyAccountInputs') for (const old of models[entity]?.records || []) {
          const next = value.records.find(item => item.id === old.id);
          if([3,4].includes(old.schemaVersion)){
            if(!next||![3,4].includes(next.schemaVersion)||old.schemaVersion===4&&next.schemaVersion!==4||JSON.stringify(next.sourceHistory.slice(0,old.sourceHistory.length))!==JSON.stringify(old.sourceHistory))fail();
            const changed=next.adoptedAccountSnapshotId!==old.adoptedAccountSnapshotId;
            if(changed&&(next.sourceHistory.length!==old.sourceHistory.length+1||JSON.stringify(next.sourceHistory.at(-1))!==JSON.stringify({adoptedAccountSnapshotId:old.adoptedAccountSnapshotId,adoptedAt:old.adoptedAt})))fail();
            if(!changed&&(next.adoptedAt!==old.adoptedAt||next.sourceHistory.length!==old.sourceHistory.length))fail();
            if(old.schemaVersion===4){
              if(JSON.stringify(next.overrideHistory.slice(0,old.overrideHistory.length))!==JSON.stringify(old.overrideHistory))fail();
              const edited=changed||JSON.stringify(next.observationOverrides)!==JSON.stringify(old.observationOverrides);
              if(edited){const revision={adoptedAccountSnapshotId:old.adoptedAccountSnapshotId,observationOverrides:old.observationOverrides,overrideUpdatedAt:old.overrideUpdatedAt};
                if(next.overrideHistory.length!==old.overrideHistory.length+1||JSON.stringify(next.overrideHistory.at(-1))!==JSON.stringify(revision))fail();
              }else if(next.overrideHistory.length!==old.overrideHistory.length||next.overrideUpdatedAt!==old.overrideUpdatedAt)fail();
              if(changed&&(Object.keys(next.observationOverrides.account).length||next.observationOverrides.holdings.length))fail();
            }else if(next.schemaVersion===4&&next.overrideHistory.length)fail();
            continue;
          }
          if(old.schemaVersion===2){
            if(!next||next.schemaVersion!==2||JSON.stringify(next.sourceHistory.slice(0,old.sourceHistory.length))!==JSON.stringify(old.sourceHistory))fail();
            if(old.sourceValues.swapPnl!==null&&!equalNullable(old.sourceValues.swapPnl,next.sourceValues.swapPnl))fail();
            if(old.adoptedAccountSnapshotId===next.adoptedAccountSnapshotId&&adoptionFields.some(f=>
              !(f==='swapPnl'&&old.sourceValues[f]===null)&&!equalNullable(old.sourceValues[f],next.sourceValues[f])))fail();
            if(old.adoptedAccountSnapshotId!==next.adoptedAccountSnapshotId||JSON.stringify(old.sourceValues)!==JSON.stringify(next.sourceValues)||JSON.stringify(old.adoptedValues)!==JSON.stringify(next.adoptedValues)){
              const revision={adoptedAccountSnapshotId:old.adoptedAccountSnapshotId,sourceValues:old.sourceValues,adoptedValues:old.adoptedValues,overrideUpdatedAt:old.overrideUpdatedAt};
              if(next.sourceHistory.length!==old.sourceHistory.length+1||JSON.stringify(next.sourceHistory.at(-1))!==JSON.stringify(revision))fail();
            }else if(next.sourceHistory.length!==old.sourceHistory.length)fail();
            continue;
          }
          if (!next || next.domesticImportBatchId === old.domesticImportBatchId && ['marketValue', 'unrealizedPnl']
            .some(field => !equalDecimal(next.sourceValues[field], old.sourceValues[field]))) fail();
        }
        if (entity === 'monthlyAccountStates') for (const old of models[entity]?.records || []) {
          const next = value.records.find(item => item.id === old.id);
          if(old.schemaVersion===4){
            if(!next||next.schemaVersion!==4||next.sourceHistory.length<old.sourceHistory.length
              ||JSON.stringify(next.sourceHistory.slice(0,old.sourceHistory.length))!==JSON.stringify(old.sourceHistory))fail();
            if(old.adoptedAccountSnapshotId===next.adoptedAccountSnapshotId&&JSON.stringify(old.sourceValues)!==JSON.stringify(next.sourceValues))fail();
            const oldSnapshot=models.accountSnapshots?.records.find(row=>row.id===old.adoptedAccountSnapshotId);
            const oldValues=adoptedValues(old,oldSnapshot);
            if(old.adoptedAccountSnapshotId!==next.adoptedAccountSnapshotId||adoptionFields.some(field=>!equalDecimal(oldValues[field],field==='unrealizedPnl'?next.adoptedUnrealizedPnl:next[field]))){
              const revision={adoptedAccountSnapshotId:old.adoptedAccountSnapshotId,sourceValues:old.sourceValues,adoptedValues:oldValues,confirmedAt:old.confirmedAt};
              if(next.sourceHistory.length!==old.sourceHistory.length+1||JSON.stringify(next.sourceHistory.at(-1))!==JSON.stringify(revision))fail();
            }
          }
          if (next && old.adoptedAccountSnapshotId === next.adoptedAccountSnapshotId) {
            if (old.schemaVersion === 3 && next.schemaVersion !== 3) fail();
            if ([2, 3].includes(old.schemaVersion) && next.schemaVersion === 3) {
              const original = old.schemaVersion === 3 ? old.sourceValues
                : adoptedValues(old, models.accountSnapshots?.records.find(row => row.id === old.adoptedAccountSnapshotId));
              if (adoptionFields.some(field => !equalDecimal(original[field], next.sourceValues[field]))) fail();
            }
          }
        }
        if(['accountSnapshots','holdingSnapshots'].includes(entity))for(const old of models[entity]?.records||[]){
          if(old.sourceScope==='sbivc-monthly-assets'&&JSON.stringify(value.records.find(r=>r.id===old.id))!==JSON.stringify(old))fail();
        }
        models[entity] = value;
      }
      // Registered source facts are immutable. Corrections add a new physical source/revision,
      // rather than destroying an anchor referenced by the audit log.
      for(const {source,fingerprint} of registeredSourceFacts)if(monthlySources.sourceFingerprint(source,models)!==fingerprint)fail();
      validateModels(models);
      const actions = Object.entries(changes).map(([entity, value]) => ({ type: 'set', storageKey: keys[entity], rawValue: JSON.stringify(value) }));
      if (guard.invalidateTopSummary === true) actions.push({ type: 'remove', storageKey: 'tradeScopeTopSummarySnapshotV1' });
      let verified;
      transaction.apply(actions, adapter, () => {
        verified = readModels(adapter);
        if (JSON.stringify(verified) !== JSON.stringify(models)) fail();
        if (own(guard,'expectedManual') && adapter.getItem(reconciliation.manualKey)!==guard.expectedManual) fail();
        verifyLegacy();
      });
      return clone(verified);
    }
    function save(entity, records) {
      if (!own(keys, entity)) fail();
      return commit({ [entity]: entity==='monthlySources'?monthlySources.envelope(records,clock()):{ schemaVersion: 1, records, updatedAt: clock() } });
    }
    function upsert(entity, record) {
      validateRecord(entity, record);
      const current = readModels(adapter)[entity]?.records || [];
      const index = current.findIndex(item => item.id === record.id);
      if (index >= 0) current[index] = record; else current.push(record);
      return save(entity, current);
    }
    return Object.freeze({ read: () => clone(readModels(adapter)), list: entity => {
      if (!own(keys, entity)) fail(); return clone(readModels(adapter)[entity]?.records || []);
    }, commit, save, upsert });
  }
  function initialAccounts() {
    return [
      ['acc_gmo_fx', 'GMOクリック証券', 'gmo', 'fx', ['gmo', 'GMO']],
      ['acc_lightfx_fx', 'LIGHT FX', 'lightfx', 'fx', ['lightfx', 'Light FX']],
      ['acc_minna_fx', 'みんなのFX', 'minna', 'fx', ['minano', 'みんなのFX']],
      ['acc_sbi_sec', 'SBI証券', 'sbi', 'securities', ['sbi', 'SBI']],
      ['acc_sbivc_crypto', 'SBI VCトレード', 'sbivc', 'crypto', ['sbivc', 'SBI VC']],
      ['acc_smbc_bank', '三井住友銀行', 'smbc', 'bank', ['smbc', '三井住友銀行']]
    ].map(([id, displayName, providerCode, accountType, legacyRefs]) => ({ id, displayName, providerCode, accountType, enabled: true, legacyRefs }));
  }
  function newId(prefix, cryptoApi = root.crypto) {
    if (!/^[a-z]+$/.test(prefix) || !cryptoApi?.randomUUID) fail();
    return `${prefix}_${cryptoApi.randomUUID()}`;
  }
  async function hashBytes(bytes, cryptoApi = root.crypto) {
    if (!cryptoApi?.subtle) fail();
    const digest = await cryptoApi.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  }
  async function dedupeCandidate(record, cryptoApi = root.crypto) {
    validateRecord('rawTransactions', record);
    if (record.externalTransactionId) return { version: 1, kind: 'external-id',
      key: JSON.stringify([record.accountId, record.externalTransactionId]), automaticMerge: false };
    const names = ['accountId', 'instrumentId', 'executedAt', 'side', 'transactionType', 'quantity', 'quantityUnit', 'price', 'currency'];
    const facts = names.map(name => own(record, name) ? record[name] : null);
    return { version: 1, kind: 'facts-candidate', key: await hashBytes(new TextEncoder().encode(JSON.stringify(facts)), cryptoApi),
      automaticMerge: false };
  }
  const api = Object.freeze({ keys, backupModelEntities, adoptionFields, adoptedValues, equalDecimal, assertJson, validateRecord, validateEnvelope, validateModels, validateBackupModels,
    readModels, createRepository, localStorageAdapter, initialAccounts, newId, hashBytes, dedupeCandidate });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TradeScopeDataStorage = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
