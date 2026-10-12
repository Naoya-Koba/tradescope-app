(function (root) {
  'use strict';
  const messages = Object.freeze({ PDF_FILE_READ_FAILED: 'PDFファイルを読み取れませんでした', PDF_INVALID_FILE: 'PDFファイルを確認してください',
    PDF_ENGINE_LOAD_FAILED: 'PDFの読み取り処理を開始できませんでした', PDF_WORKER_INIT_FAILED: 'PDFの読み取り処理を開始できませんでした',
    PDF_DOCUMENT_LOAD_FAILED: 'PDFを開けませんでした', PDF_TEXT_EXTRACTION_FAILED: 'PDFの文字を読み取れませんでした',
    SBIVC_DOCUMENT_NOT_RECOGNIZED: 'SBI VCの月次報告書として認識できませんでした', SBIVC_PARSE_FAILED: '必要な帳票項目を読み取れませんでした',
    SBIVC_PERIOD_INVALID: '対象期間・基準日を確認できませんでした', SBIVC_CASHFLOW_TYPE_UNVERIFIED: '入出庫の区分を確認できない行があります',
    SBIVC_TRADES_ROWS_UNVERIFIED: '売買明細のある帳票は未検証です', SBIVC_POSITIONS_ROWS_UNVERIFIED: '建玉明細のある帳票は未検証です',
    SBIVC_LENDING_ROWS_UNVERIFIED: '貸出明細のある帳票は未検証です' });
  function createUI({ document, parser, extract, viewer, window }) {
    const $ = id => document.getElementById('sbivc-' + id);
    let controller = null, sequence = 0;
    const node = (tag, text, className) => { const n = document.createElement(tag); n.textContent = text; if (className) n.className = className; return n; };
    const amount = (value, currency = false) => {
      if (value === null || value === undefined) return '—';
      const [integer, fraction] = String(value).split('.');
      return integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fraction === undefined ? '' : '.' + fraction) + (currency ? '円' : '');
    };
    const metric = (container, label, value) => container.append(node('dt', label), node('dd', value));
    function clear() {
      ++sequence; controller?.abort(); controller = null; viewer()?.setSource('sbivc', null);
      $('preview').hidden = true; $('cancel-read').hidden = true; $('file').value = '';
      for (const id of ['summary', 'holdings', 'leverage', 'events', 'issues']) $(id).replaceChildren();
      $('read-status').textContent = ''; delete $('read-status').dataset.errorCode; delete $('read-status').dataset.stage;
    }
    function render(result) {
      $('preview').hidden = false;
      if (result.valid) {
        metric($('summary'), '対象月', result.report.targetMonth.replace('-', '/'));
        metric($('summary'), '基準日', result.report.snapshotAsOf.replaceAll('-', '/'));
        metric($('summary'), 'JPY残高', amount(result.accountObservations.jpyCash, true));
        metric($('summary'), '帳票上の資産合計', amount(result.accountObservations.assetTotalObservation, true));
        const active = [], zero = [];
        for (const h of result.spotHoldings) (/^0(?:\.0+)?$/.test(h.quantity || '') ? zero : active).push(h);
        function holding(h, container) {
          const card = node('div', '', 'sbivc-holding'); card.append(node('strong', h.asset)); const dl = node('dl', '');
          metric(dl, '数量', amount(h.quantity)); metric(dl, '評価レート', amount(h.valuationRate, true));
          metric(dl, '円換算額', amount(h.officialJPYValue, true)); card.append(dl); container.append(card);
        }
        for (const h of active) holding(h, $('holdings'));
        if (zero.length) { const detail = node('details', ''); detail.append(node('summary', `残高0の銘柄（${zero.length}件）`));
          for (const h of zero) holding(h, detail); $('holdings').append(detail); }
        if (!result.spotHoldings.length) $('holdings').append(node('p', '現物暗号資産の記載なし', 'muted'));
        const labels = { cashBalance: '預託証拠金残高', positionEvaluationPnl: '建玉評価損益', netAssetObservation: '純資産額',
          positionMargin: 'ポジション必要証拠金', orderMargin: '注文必要証拠金', maintenanceRate: '証拠金維持率' };
        if (Object.keys(result.leverageSummary).length) {
          const detail = node('details', ''); detail.append(node('summary', 'レバレッジ口座')); const dl = node('dl', '');
          for (const [field, label] of Object.entries(labels)) if (Object.hasOwn(result.leverageSummary, field))
            metric(dl, label, amount(result.leverageSummary[field], field !== 'maintenanceRate') + (field === 'maintenanceRate' && result.leverageSummary[field] !== null ? '%' : ''));
          detail.append(dl); $('leverage').append(detail);
        }
        if (result.cashflows.length) {
          const detail = node('details', ''); detail.append(node('summary', `入出庫・報酬（${result.cashflows.length}件）`));
          const labels = { jpyDeposit: 'JPY入金', jpyWithdrawal: 'JPY出金', cryptoInbound: '暗号資産入庫', cryptoOutbound: '暗号資産出庫', stakingReward: 'ステーキング報酬', other: 'その他' };
          for (const flow of result.cashflows) {
            const card = node('div', '', 'sbivc-holding'); card.append(node('strong', labels[flow.kind])); const dl = node('dl', '');
            metric(dl, '記載日時', flow.recordedAt?.replace('T', ' ') || '—'); metric(dl, '暗号資産・通貨', flow.asset); metric(dl, '数量', amount(flow.quantity));
            const reward = result.rewards.find(r => r.sourcePage === flow.sourcePage && r.recordedAt === flow.recordedAt && r.asset === flow.asset);
            if (reward?.targetMonth) metric(dl, '報酬対象月', reward.targetMonth.replace('-', '/'));
            card.append(dl); detail.append(card);
          }
          $('events').append(detail);
        }
      }
      for (const code of result.errors) $('issues').append(node('p', messages[code] || '帳票の項目を確認できませんでした', 'issue error'));
      for (const code of result.warnings) $('issues').append(node('p', messages[code] || '未検証の項目があります', 'issue'));
    }
    async function select(file) {
      if (!file) return;
      clear(); const current = sequence; controller = new AbortController(); const signal = controller.signal;
      $('read-status').textContent = '解析中…'; $('cancel-read').hidden = false;
      let stage = 'file', code = 'PDF_FILE_READ_FAILED';
      try {
        if (file.size > 20 * 1024 * 1024) { code = 'PDF_INVALID_FILE'; throw new Error(); }
        const bytes = new Uint8Array(await file.arrayBuffer());
        if (signal.aborted) return;
        stage = 'engine'; code = 'PDF_ENGINE_LOAD_FAILED';
        const extracted = await extract(bytes, { signal, onProgress: (page, total) => { if (current === sequence) $('read-status').textContent = `解析中… ${page}/${total}`; } });
        if (current !== sequence) return;
        stage = 'detector'; code = 'SBIVC_DOCUMENT_NOT_RECOGNIZED'; if (!parser.detect(extracted)) throw new Error();
        stage = 'parser'; code = 'SBIVC_PARSE_FAILED'; const result = parser.parse(extracted);
        render(result); $('read-status').dataset.stage = result.valid ? 'preview' : 'validation';
        $('read-status').dataset.errorCode = result.valid ? '' : result.errors[0];
        // File is passed only to the existing in-memory Viewer, never to a repository or save service.
        viewer()?.setSource('sbivc', file);
      } catch (failure) {
        if (current !== sequence || signal.aborted) return;
        if (Object.hasOwn(messages, failure?.code)) code = failure.code;
        stage = ({ PDF_INVALID_FILE: 'file', PDF_WORKER_INIT_FAILED: 'worker', PDF_DOCUMENT_LOAD_FAILED: 'document', PDF_TEXT_EXTRACTION_FAILED: 'text' })[code] || stage;
        $('preview').hidden = false; $('read-status').dataset.stage = stage; $('read-status').dataset.errorCode = code;
        $('issues').replaceChildren(node('p', `${messages[code]}（${code}）`, 'issue error'));
      } finally {
        if (current === sequence) { controller = null; $('cancel-read').hidden = true; $('read-status').textContent = ''; }
      }
    }
    $('file').addEventListener('change', event => { void select(event.target.files[0]); });
    $('cancel-read').addEventListener('click', clear); $('close').addEventListener('click', clear);
    $('provider').addEventListener('toggle', () => { if (!$('provider').open) clear(); });
    window.addEventListener('pagehide', clear);
    return Object.freeze({ select, clear });
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { createUI };
  else createUI({ document, window, parser: root.TradeScopeSBIVCParser, viewer: () => root.TradeScopePdfViewer,
    extract: async (bytes, options) => (await import('./pdf-extractor.mjs?v=20261012-10')).extract(bytes, options) });
})(typeof globalThis !== 'undefined' ? globalThis : this);
