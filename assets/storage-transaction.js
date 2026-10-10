(function (root) {
  'use strict';
  const JOURNAL_KEY = 'tradeScopeRestoreJournalV1';
  const MODEL_KEYS = Object.freeze({
    accounts: 'tradeScopeAccountsV1', instruments: 'tradeScopeInstrumentsV1',
    importBatches: 'tradeScopeImportBatchesV1', rawTransactions: 'tradeScopeRawTransactionsV1',
    holdingSnapshots: 'tradeScopeHoldingSnapshotsV1', accountSnapshots: 'tradeScopeAccountSnapshotsV1'
  });
  const PRIMARY_KEYS = Object.freeze(['tradingData', 'yearInitialFunds', 'yearInitialUnrealized',
    'tradeScopeTradeHistoryV1', 'tradeScopeMemos', 'tradeScopeSymbolListV1', 'tradeInfo', ...Object.values(MODEL_KEYS)]);
  const allowedKeys = new Set([...PRIMARY_KEYS, 'profitSkipDemoSeed', 'tradeScopeTopSummarySnapshotV1']);
  function fail(message) { throw new Error(message); }
  function validateJournal(journal) {
    if (!journal || journal.product !== 'TradeScope' || journal.journalVersion !== 1
      || !Array.isArray(journal.entries) || journal.entries.length === 0) fail('復元ジャーナルの形式が不正です');
    const keys = new Set();
    for (const entry of journal.entries) {
      if (!entry || !allowedKeys.has(entry.storageKey) || keys.has(entry.storageKey)
        || typeof entry.existed !== 'boolean'
        || (entry.existed ? typeof entry.previousRawValue !== 'string' : entry.previousRawValue !== null)) {
        fail('復元ジャーナルの対象が不正です');
      }
      keys.add(entry.storageKey);
    }
  }
  function validateActions(actions) {
    if (!Array.isArray(actions) || !actions.length) fail('保存対象がありません');
    const keys = new Set();
    for (const action of actions) {
      if (!action || !allowedKeys.has(action.storageKey) || keys.has(action.storageKey)
        || !['set', 'remove'].includes(action.type)
        || (action.type === 'set' && typeof action.rawValue !== 'string')) fail('保存対象が不正です');
      keys.add(action.storageKey);
    }
  }
  function createJournal(actions, storage) {
    validateActions(actions);
    if (storage.getItem(JOURNAL_KEY) !== null) fail('未完了の復元ジャーナルが残っています');
    const journal = { product: 'TradeScope', journalVersion: 1, createdAt: new Date().toISOString(),
      entries: actions.map(action => {
        const previousRawValue = storage.getItem(action.storageKey);
        return { storageKey: action.storageKey, existed: previousRawValue !== null, previousRawValue };
      }) };
    validateJournal(journal);
    const raw = JSON.stringify(journal);
    try {
      storage.setItem(JOURNAL_KEY, raw);
      if (storage.getItem(JOURNAL_KEY) !== raw) fail('ジャーナルの再読込に失敗しました');
    } catch (_) {
      try { storage.removeItem(JOURNAL_KEY); } catch (_) { /* No primary writes have begun. */ }
      fail('復元ジャーナルを保存できません。容量・保存権限を確認してください');
    }
    return journal;
  }
  function rollback(journal, storage) {
    validateJournal(journal);
    let failed = false;
    for (const entry of [...journal.entries].reverse()) {
      try {
        if (entry.existed) storage.setItem(entry.storageKey, entry.previousRawValue);
        else storage.removeItem(entry.storageKey);
      } catch (_) { failed = true; }
    }
    for (const entry of journal.entries) {
      try { if (storage.getItem(entry.storageKey) !== entry.previousRawValue) failed = true; }
      catch (_) { failed = true; }
    }
    if (failed) {
      // Keep/re-create the journal for explicit recovery; never silently start another write.
      try { if (storage.getItem(JOURNAL_KEY) === null) storage.setItem(JOURNAL_KEY, JSON.stringify(journal)); } catch (_) { /* Storage may be unavailable. */ }
      fail('元の状態へ戻せませんでした。保存操作を中止し、復元ジャーナルを保護してください');
    }
    storage.removeItem(JOURNAL_KEY);
    if (storage.getItem(JOURNAL_KEY) !== null) fail('復元ジャーナルを削除できません');
  }
  function recover(storage) {
    const raw = storage.getItem(JOURNAL_KEY);
    if (raw === null) return false;
    let journal;
    try { journal = JSON.parse(raw); } catch (_) { fail('未完了の復元ジャーナルが壊れています'); }
    rollback(journal, storage); return true;
  }
  function apply(actions, storage, verify) {
    if (verify !== undefined && typeof verify !== 'function') fail('保存検証が不正です');
    const journal = createJournal(actions, storage);
    try {
      for (const action of actions) {
        if (action.type === 'set') storage.setItem(action.storageKey, action.rawValue);
        else storage.removeItem(action.storageKey);
      }
      for (const action of actions) {
        if (storage.getItem(action.storageKey) !== (action.type === 'set' ? action.rawValue : null)) {
          fail('書き込み後の再読込検証に失敗しました');
        }
      }
      // Semantic/reference verification must finish while rollback is still protected.
      if (verify && verify() === false) fail('保存後の検証に失敗しました');
      storage.removeItem(JOURNAL_KEY);
      if (storage.getItem(JOURNAL_KEY) !== null) fail('復元ジャーナルを削除できません');
    } catch (_) {
      rollback(journal, storage);
      fail('保存に失敗したため元の状態へ戻しました。容量・保存権限を確認してください');
    }
  }
  const api = Object.freeze({ journalKey: JOURNAL_KEY, modelKeys: MODEL_KEYS, primaryKeys: PRIMARY_KEYS,
    createJournal, validateJournal, rollback, recover, apply });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TradeScopeStorageTransaction = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
