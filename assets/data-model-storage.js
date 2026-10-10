(function (root) {
  'use strict';
  const transaction = typeof module !== 'undefined' && module.exports
    ? require('./storage-transaction.js') : root.TradeScopeStorageTransaction;
  const keys = transaction.modelKeys;
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
  const common = { schemaVersion: value => value === 1, id };
  const provenance = { accountId: id, targetMonth: month, snapshotAsOf: observed, importedAt: timestamp,
    sourceMode, sourceScope: text, importBatchId: id, observationType };
  const definitions = {
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
        cashBalance: decimal, unrealizedPnl: decimal, reportedMonthlyRealizedPnl: decimal, accountSpecific: specific } }
  };
  function validateRecord(entity, record) {
    const definition = definitions[entity]; if (!definition) fail();
    assertJson(record); fields(record, Object.keys(definition.types), definition.required);
    for (const [field, value] of Object.entries(record)) {
      // Required identity/source fields cannot be null; unknown financial/date observations can.
      const nullable = field !== 'schemaVersion' && (!definition.required.includes(field) || field === 'snapshotAsOf');
      if (value === null && nullable) continue;
      if (!definition.types[field](value)) fail();
    }
  }
  function validateEnvelope(entity, value) {
    if (value === null) return;
    assertJson(value); fields(value, ['schemaVersion', 'records', 'updatedAt'], ['schemaVersion', 'records', 'updatedAt']);
    if (value.schemaVersion !== 1 || !Array.isArray(value.records) || !timestamp(value.updatedAt)) fail();
    const ids = new Set();
    for (const record of value.records) {
      validateRecord(entity, record);
      if (ids.has(record.id)) fail(); ids.add(record.id);
    }
  }
  function validateModels(models) {
    fields(models, Object.keys(keys), Object.keys(keys)); assertJson(models);
    for (const entity of Object.keys(keys)) validateEnvelope(entity, models[entity]);
    const records = entity => models[entity]?.records || [];
    const accounts = new Map(records('accounts').map(item => [item.id, item]));
    const instruments = new Set(records('instruments').map(item => item.id));
    const batches = new Map(records('importBatches').map(item => [item.id, item]));
    const snapshots = new Map(records('accountSnapshots').map(item => [item.id, item]));
    const externalIds = new Set(), sourceRows = new Set();
    for (const entity of ['importBatches', 'rawTransactions', 'holdingSnapshots', 'accountSnapshots']) {
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
          const allowed = type === 'fx' ? ['requiredMargin', 'maintenanceRate'] : type === 'securities' ? ['buyingPower', 'depositBalance'] : [];
          if (Object.keys(record.accountSpecific).some(field => !allowed.includes(field))) fail();
        }
      }
    }
    return true;
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
        if (entity === 'accounts' && (models.accounts?.records || []).some(record => !value.records.some(item => item.id === record.id))) fail();
        models[entity] = value;
      }
      validateModels(models);
      const actions = Object.entries(changes).map(([entity, value]) => ({ type: 'set', storageKey: keys[entity], rawValue: JSON.stringify(value) }));
      let verified;
      transaction.apply(actions, adapter, () => {
        verified = readModels(adapter);
        if (JSON.stringify(verified) !== JSON.stringify(models)) fail();
      });
      return clone(verified);
    }
    function save(entity, records) {
      if (!own(keys, entity)) fail();
      return commit({ [entity]: { schemaVersion: 1, records, updatedAt: clock() } });
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
  const api = Object.freeze({ keys, assertJson, validateRecord, validateEnvelope, validateModels,
    readModels, createRepository, localStorageAdapter, initialAccounts, newId, hashBytes, dedupeCandidate });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TradeScopeDataStorage = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
