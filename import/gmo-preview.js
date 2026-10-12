(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  let controller = null, token = 0;
  let source = null, service = null, outcome = null, busy = false, opening = false, confirmation = null;
  const readErrors = Object.freeze({
    PDF_FILE_READ_FAILED: 'PDFファイルを読み取れませんでした',
    PDF_INVALID_FILE: 'PDFファイルを確認してください',
    PDF_FILE_HASH_FAILED: 'PDFファイルを確認できませんでした',
    PDF_ENGINE_LOAD_FAILED: 'PDFの読み取り処理を開始できませんでした',
    PDF_WORKER_INIT_FAILED: 'PDFの読み取り処理を開始できませんでした',
    PDF_DOCUMENT_LOAD_FAILED: 'PDFを開けませんでした',
    PDF_TEXT_EXTRACTION_FAILED: 'PDFの文字を読み取れませんでした',
    GMO_DOCUMENT_NOT_RECOGNIZED: 'GMO月次取引残高報告書として認識できませんでした',
    GMO_PARSE_FAILED: '必要な月次項目を読み取れませんでした',
    GMO_VALIDATION_FAILED: '月次項目を確認できませんでした',
    GMO_STORAGE_CHECK_FAILED: '保存データを確認できません。再読み込みしてください'
  });
  function diagnostic(stage, code) {
    // Only controlled stage/code values; no underlying exception, document text or URL.
    $('gmo-read-status').dataset.stage = stage;
    $('gmo-read-status').dataset.errorCode = code;
  }
  function saveService() {
    if (!service) service = TradeScopeGMOSave.createService(TradeScopeDataStorage.localStorageAdapter(localStorage));
    return service;
  }
  function renderSave() {
    const correction = outcome?.status === 'review-required' && outcome.reason === 'different-report';
    const enrichment = outcome?.status === 'backfill-ready';
    $('gmo-save').hidden = !source?.preview.valid || !(outcome?.status === 'ready' || enrichment || correction);
    $('gmo-save').disabled = busy || opening;
    $('gmo-save').textContent = enrichment ? '取引明細を追加' : correction ? '訂正する' : '保存';
    $('gmo-save-status').textContent = busy ? '保存中…' : outcome?.enriched ? '既存取込に取引明細を追加しました' : ['saved', 'already-imported'].includes(outcome?.status) ? '保存済み'
      : correction ? '同じ月の報告書が保存されています' : outcome?.reason === 'legacy' ? 'この月には従来のGMO入力が保存されています'
      : outcome?.reason === 'account' ? 'GMO口座の設定を確認してください' : outcome?.reason === 'instrument' ? '通貨ペアを一意に確認できません'
      : outcome?.reason === 'batch-identity' ? '既存取込との照合が一致しません' : outcome?.reason === 'source-values' ? '既存の報告書の値と一致しません'
      : outcome?.reason === 'trade-set' ? '保存済みの取引明細と一致しません。追加は停止しました'
      : outcome?.reason === 'trade-audit' ? '取引明細の損益照合が一致しません。追加は停止しました' : outcome?.reason === 'unadopted' ? '採用されていない月次データがあります' : '';
    for (const id of ['gmo-file', 'gmo-close', 'gmo-confirm-save', 'gmo-cancel-save']) $(id).disabled = busy;
  }
  function node(tag, text, className) {
    const element = document.createElement(tag); element.textContent = text;
    if (className) element.className = className; return element;
  }
  function amount(value) {
    if (value == null) return '—';
    const [integer, fraction] = value.split('.');
    return integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fraction ? '.' + fraction : '') + '円';
  }
  function clear() {
    if (busy) return;
    if ($('gmo-save-dialog').open) $('gmo-save-dialog').close();
    source = null; outcome = null; confirmation = null; renderSave();
    ++token; controller?.abort(); controller = null;
    $('gmo-preview').hidden = true; $('gmo-cancel-read').hidden = true;
    $('gmo-summary').replaceChildren(); $('gmo-issues').replaceChildren();
    $('gmo-read-status').textContent = ''; $('gmo-file').value = '';
    delete $('gmo-read-status').dataset.stage; delete $('gmo-read-status').dataset.errorCode;
  }
  function render(preview) {
    $('gmo-preview').hidden = false;
    const metrics = [['対象月', preview.targetMonth?.replace('-', '/') || '—'], ['月末日', preview.snapshotAsOf?.replaceAll('-', '/') || '—'],
      ['決済損益', amount(preview.values.realizedPnl)], ['スワップ', amount(preview.values.swapPnl)],
      ['入金', amount(preview.values.deposit)], ['出金', amount(preview.values.withdrawal)],
      ['評価損益', amount(preview.values.unrealizedPnl)], ['現金残高', amount(preview.values.cashBalance)],
      ['純資産', amount(preview.values.netAssetValue)], ['必要証拠金', amount(preview.values.requiredMargin)]];
    for (const [label, value] of metrics) $('gmo-summary').append(node('dt', label), node('dd', value));
    for (const message of preview.errors) $('gmo-issues').append(node('p', message, 'issue error'));
    for (const message of preview.warnings) $('gmo-issues').append(node('p', message, 'issue'));
    const detail=preview.tradeDetails;
    if(detail?.coverage==='complete')$('gmo-summary').append(node('dt','取引'),node('dd',`${detail.rows.length}件`));
    if(detail?.errors.length)$('gmo-issues').append(node('p','取引明細を読み取れませんでした。保存を停止しました', 'issue error'));
    if(detail?.audit==='mismatch')$('gmo-issues').append(node('p','個別決済損益と月間合計が一致しません（月間合計は帳票値を保持）','issue'));
  }
  $('gmo-file').addEventListener('change', async event => {
    const file = event.target.files[0]; if (!file) return;
    clear(); const current = token; controller = new AbortController();
    const signal = controller.signal; $('gmo-read-status').textContent = '解析中…'; $('gmo-cancel-read').hidden = false;
    let stage = 'file', code = 'PDF_FILE_READ_FAILED';
    try {
      if (file.size > 20 * 1024 * 1024) { code = 'PDF_INVALID_FILE'; throw new Error(); }
      const bytes = new Uint8Array(await file.arrayBuffer());
      code = 'PDF_FILE_HASH_FAILED';
      const fileHash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(byte => byte.toString(16).padStart(2, '0')).join('');
      stage = 'engine'; code = 'PDF_ENGINE_LOAD_FAILED';
      const extractor = await import('./pdf-extractor.mjs?v=20261012-1');
      stage = 'document'; code = 'PDF_DOCUMENT_LOAD_FAILED';
      const extracted = await extractor.extract(bytes, { signal, onDiagnostic: value => {
        if (current === token) diagnostic(value.stage, value.code);
      }, onProgress: (page, pages) => {
        if (current === token) $('gmo-read-status').textContent = `解析中… ${page}/${pages}`;
      } });
      if (current !== token) return;
      stage = 'detector'; code = 'GMO_DOCUMENT_NOT_RECOGNIZED';
      if (!TradeScopeGMOParser.detect(extracted)) throw new Error();
      stage = 'parser'; code = 'GMO_PARSE_FAILED';
      const preview = TradeScopeGMOParser.parse(extracted);
      stage = 'validation'; code = 'GMO_VALIDATION_FAILED';
      render(preview);
      if (!preview.valid || preview.tradeDetails?.errors.length) { diagnostic(stage, code); return; }
      source = { preview, fileHash, fileSize: file.size };
      stage = 'storage-check'; code = 'GMO_STORAGE_CHECK_FAILED';
      outcome = preview.valid ? await saveService().inspect(source) : null;
      if (current === token) { diagnostic('preview', 'GMO_PREVIEW_READY'); renderSave(); }
    } catch (failure) {
      if (current === token && !signal.aborted) {
        // Accept only extractor's known safe codes/stages, never the library's message/stack.
        if (['PDF_INVALID_FILE', 'PDF_WORKER_INIT_FAILED', 'PDF_DOCUMENT_LOAD_FAILED', 'PDF_TEXT_EXTRACTION_FAILED'].includes(failure?.code)) {
          code = failure.code; stage = ({ PDF_INVALID_FILE: 'file', PDF_WORKER_INIT_FAILED: 'worker',
            PDF_DOCUMENT_LOAD_FAILED: 'document', PDF_TEXT_EXTRACTION_FAILED: 'text' })[code];
        }
        diagnostic(stage, code);
        source = null; outcome = null; renderSave();
        $('gmo-preview').hidden = false;
        $('gmo-issues').replaceChildren(node('p', `${readErrors[code]}（${code}）`, 'issue error'));
      }
    } finally {
      if (current === token) { controller = null; $('gmo-read-status').textContent = ''; $('gmo-cancel-read').hidden = true; }
    }
  });
  $('gmo-cancel-read').addEventListener('click', clear);
  $('gmo-close').addEventListener('click', clear);
  $('gmo-provider').addEventListener('toggle', () => { if (!$('gmo-provider').open && !busy) clear(); });
  $('gmo-save').addEventListener('click', async () => {
    if (busy || opening || $('gmo-save-dialog').open || !source?.preview.valid) return;
    opening = true; renderSave(); const selected = source;
    try {
      outcome = await saveService().inspect(selected);
      if (selected !== source) return;
      renderSave();
      const correction = outcome.status === 'review-required' && outcome.reason === 'different-report';
      const enrichment = outcome.status === 'backfill-ready';
      if (outcome.status !== 'ready' && !enrichment && !correction) return;
      confirmation = correction ? { stateId: outcome.stateId, adoptedSnapshotId: outcome.adoptedSnapshotId } : {};
      $('gmo-save-summary').replaceChildren();
      for (const [label, value] of [['対象月', source.preview.targetMonth.replace('-', '/')], ['月末日', source.preview.snapshotAsOf.replaceAll('-', '/')]])
        $('gmo-save-summary').append(node('dt', label), node('dd', value));
      if (enrichment) $('gmo-save-summary').append(node('dt', '取引明細'), node('dd', `${source.preview.tradeDetails.rows.length}件`));
      $('gmo-confirm-save').textContent = enrichment ? '取引明細を追加' : correction ? '訂正して保存' : '保存';
      $('gmo-save-dialog').showModal();
    } catch (_) { $('gmo-issues').replaceChildren(node('p', '保存データを確認できません。再読み込みしてください', 'issue error')); }
    finally { opening = false; renderSave(); }
  });
  $('gmo-cancel-save').addEventListener('click', () => $('gmo-save-dialog').close());
  $('gmo-save-dialog').addEventListener('cancel', event => { if (busy) event.preventDefault(); });
  $('gmo-save-dialog').addEventListener('click', event => { if (!busy && event.target === $('gmo-save-dialog')) {
    const box = event.target.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) event.target.close();
  } });
  $('gmo-confirm-save').addEventListener('click', async () => {
    if (busy || !$('gmo-save-dialog').open || !source || confirmation === null) return;
    busy = true; renderSave();
    try { outcome = await saveService().save(source, confirmation); }
    catch (failure) { outcome = null; $('gmo-issues').replaceChildren(node('p', failure.message || '保存に失敗しました。容量・保存権限を確認してください', 'issue error')); }
    finally { busy = false; confirmation = null; $('gmo-save-dialog').close(); renderSave(); }
  });
})();
