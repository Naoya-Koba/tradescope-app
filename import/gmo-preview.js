(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  let controller = null, token = 0;
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
      // Only allowlisted preview facts and hash/size can reach the later save boundary.
      void fileHash;
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
})();
