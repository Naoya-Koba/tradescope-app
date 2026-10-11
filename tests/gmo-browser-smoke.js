// Test harness only: intentionally excluded from application navigation and PWA precache.
(function () {
  'use strict';
  if (location.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(location.hostname) || !location.port) return;
  const model = TradeScopeDataStorage, repo = model.createRepository(model.localStorageAdapter(localStorage));
  const legacyKeys = ['tradingData', 'yearInitialFunds', 'yearInitialUnrealized', 'tradeScopeTradeHistoryV1', 'tradeScopeMemos', 'tradeScopeSymbolListV1'];
  const keys = [...legacyKeys, ...Object.values(model.keys), 'tradeScopeTopSummarySnapshotV1', 'profitSkipDemoSeed', 'tradeScopeRestoreJournalV1'];
  const original = new Map(keys.map(key => [key, localStorage.getItem(key)]));
  let prepared = false, legacyBefore = null;
  const show = value => { document.getElementById('result').textContent = JSON.stringify(value, null, 2); };
  function inspect() {
    const models = repo.read();
    const c = TradeScopeMonthlyResolver.createCalculator(TradeScopeProfitMetrics, JSON.parse(localStorage.getItem('tradingData') || '{}'), JSON.parse(localStorage.getItem('yearInitialFunds') || '{}'), {}, models);
    show({ counts: Object.fromEntries(Object.entries(models).map(([name, envelope]) => [name, envelope?.records.length ?? null])),
      legacyUnchanged: legacyBefore === null || legacyBefore === JSON.stringify(legacyKeys.map(key => localStorage.getItem(key))),
      journalAbsent: localStorage.getItem('tradeScopeRestoreJournalV1') === null,
      gmo: c.resolve(2026, 9, 'gmo').source, confirmed: c.confirmed(2026, 9, 'gmo'), net: c.net(2026, 9, 'gmo'),
      currentCache: localStorage.getItem('tradeScopeTopSummarySnapshotV1') === null ? 'absent' : 'present' });
  }
  document.getElementById('prepare').onclick = () => {
    if (prepared || [...original.values()].some(value => value !== null)) { show({ refused: 'fresh anonymous origin required' }); return; }
    const now = '2026-10-11T12:00:00.000Z', envelope = records => ({ schemaVersion: 1, records, updatedAt: now });
    const values = { realizedPnL: 0, swapPnL: 0, unrealizedPnL: 0, deposit: 0, withdrawal: 0 };
    localStorage.setItem('tradingData', JSON.stringify({ 2026: { 8: { __saved: true, ...Object.fromEntries(['gmo','lightfx','minano','sbi','sbivc','smbc'].map(k => [k, values])) },
      9: { __saved: true, ...Object.fromEntries(['lightfx','minano','sbivc','smbc'].map(k => [k, values])) } } }));
    localStorage.setItem('yearInitialFunds', JSON.stringify({ 2026: { gmo: 100, lightfx: 0, minano: 0, sbi: 0, sbivc: 0, smbc: 0 } }));
    localStorage.setItem('yearInitialUnrealized', '{}');
    // Complete anonymous SBI fixture prevents unrelated missing-SBI data from masking the aggregate GMO UI test.
    repo.commit({ accounts: envelope(model.initialAccounts().filter(r => r.id === 'acc_sbi_sec')),
      instruments: envelope([{ id:'anonymous_stock', assetType:'Stock', symbol:'ANON', displayName:'架空商品', enabled:true }]),
      importBatches: envelope([{ id:'anonymous_sbi_batch', accountId:'acc_sbi_sec', sourceType:'csv', sourceProvider:'sbi', importedAt:now, targetMonth:'2026-09', snapshotAsOf:'2026-10-04' }]),
      holdingSnapshots: envelope([{ id:'anonymous_hs', accountId:'acc_sbi_sec', instrumentId:'anonymous_stock', sourceMode:'imported', sourceScope:'sbi-domestic-holdings', importBatchId:'anonymous_sbi_batch', importedAt:now, targetMonth:'2026-09', snapshotAsOf:'2026-10-04', marketValue:'0', unrealizedPnl:'0', currency:'JPY' }]),
      accountSnapshots: envelope([{ id:'anonymous_foreign', accountId:'acc_sbi_sec', sourceMode:'manual', sourceScope:'sbi-foreign-securities', importedAt:now, targetMonth:'2026-09', snapshotAsOf:'2026-10-04', valuationCurrency:'JPY', assetValue:'0', unrealizedPnl:'0' },
        { id:'anonymous_cash', accountId:'acc_sbi_sec', sourceMode:'manual', sourceScope:'sbi-cash', importedAt:now, targetMonth:'2026-09', snapshotAsOf:'2026-10-04', valuationCurrency:'JPY', cashBalance:'0' }]),
      monthlyAccountStates: envelope([{ id:'anonymous_sbi_state', accountId:'acc_sbi_sec', targetMonth:'2026-09', confirmedAt:now, domesticImportBatchId:'anonymous_sbi_batch', foreignAccountSnapshotId:'anonymous_foreign', cashAccountSnapshotId:'anonymous_cash', realizedPnl:'0', swapPnl:'0', deposit:'0', withdrawal:'0' }]) });
    prepared = true; legacyBefore = JSON.stringify(legacyKeys.map(key => localStorage.getItem(key))); inspect();
  };
  document.getElementById('inspect').onclick = inspect;
  document.getElementById('offline').onclick = async () => {
    const names = (await caches.keys()).filter(name => name.startsWith('tradescope-static-'));
    const cache = names.length === 1 ? await caches.open(names[0]) : null;
    const requests = cache ? await cache.keys() : [];
    show({ names, entries: requests.length, controller: Boolean(navigator.serviceWorker.controller),
      pdfWorker: requests.some(r => r.url.endsWith('/pdf.worker.mjs')), importOffline: Boolean(cache && await cache.match('../import.html', { ignoreSearch: true })),
      duplicatePaths: requests.map(r => new URL(r.url).pathname).filter((p,i,a) => a.indexOf(p) !== i && !p.endsWith('/')) });
  };
  document.getElementById('extract').onclick = async () => {
    try {
      const extractor = await import('../import/pdf-extractor.mjs?v=20261011-1');
      const extracted = await extractor.extract(AnonymousGMOFixture.pdfBytes());
      const preview = TradeScopeGMOParser.parse(extracted);
      show({ pages: extracted.pages.length, valid: preview.valid, errors: preview.errors.length, warnings: preview.warnings.length });
    } catch (_) { show({ extractionFailed: true }); }
  };
  document.getElementById('cleanup').onclick = () => {
    if (!prepared) { show({ refused: 'not prepared in this session' }); return; }
    for (const [key, value] of original) { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); }
    prepared = false; legacyBefore = null; show({ cleaned: true, allOriginalKeysRestored: keys.every(key => localStorage.getItem(key) === original.get(key)) });
  };
  inspect();
})();
