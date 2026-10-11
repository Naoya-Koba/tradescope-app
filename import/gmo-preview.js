(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  let controller = null, token = 0;
  let source = null, service = null, outcome = null, busy = false, opening = false, confirmation = null;
  function saveService() {
    if (!service) service = TradeScopeGMOSave.createService(TradeScopeDataStorage.localStorageAdapter(localStorage));
    return service;
  }
  function renderSave() {
    const correction = outcome?.status === 'review-required' && outcome.reason === 'different-report';
    $('gmo-save').hidden = !source?.preview.valid || !(outcome?.status === 'ready' || correction);
    $('gmo-save').disabled = busy || opening;
    $('gmo-save').textContent = correction ? '訂正する' : '保存';
    $('gmo-save-status').textContent = busy ? '保存中…' : ['saved', 'already-imported'].includes(outcome?.status) ? '保存済み'
      : correction ? '同じ月の報告書が保存されています' : outcome?.reason === 'legacy' ? 'この月には従来のGMO入力が保存されています'
      : outcome?.reason === 'account' ? 'GMO口座の設定を確認してください' : outcome?.reason === 'unadopted' ? '採用されていない月次データがあります' : '';
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
  }
  $('gmo-file').addEventListener('change', async event => {
    const file = event.target.files[0]; if (!file) return;
    clear(); const current = token; controller = new AbortController();
    const signal = controller.signal; $('gmo-read-status').textContent = '解析中…'; $('gmo-cancel-read').hidden = false;
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('PDFファイルを確認してください');
      const bytes = new Uint8Array(await file.arrayBuffer());
      const fileHash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(byte => byte.toString(16).padStart(2, '0')).join('');
      const extractor = await import('./pdf-extractor.mjs?v=20261011-1');
      const extracted = await extractor.extract(bytes, { signal, onProgress: (page, pages) => {
        if (current === token) $('gmo-read-status').textContent = `解析中… ${page}/${pages}`;
      } });
      if (current !== token) return;
      const preview = TradeScopeGMOParser.parse(extracted);
      render(preview);
      source = { preview, fileHash, fileSize: file.size };
      outcome = preview.valid ? await saveService().inspect(source) : null;
      if (current === token) renderSave();
    } catch (_) {
      if (current === token && !signal.aborted) {
        $('gmo-preview').hidden = false;
        $('gmo-issues').append(node('p', 'PDFを解析できません。対応する月次報告書を確認してください', 'issue error'));
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
      if (outcome.status !== 'ready' && !correction) return;
      confirmation = correction ? { stateId: outcome.stateId, adoptedSnapshotId: outcome.adoptedSnapshotId } : {};
      $('gmo-save-summary').replaceChildren();
      for (const [label, value] of [['対象月', source.preview.targetMonth.replace('-', '/')], ['月末日', source.preview.snapshotAsOf.replaceAll('-', '/')]])
        $('gmo-save-summary').append(node('dt', label), node('dd', value));
      $('gmo-confirm-save').textContent = correction ? '訂正して保存' : '保存';
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
