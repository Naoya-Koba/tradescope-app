(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  let preview = null, readToken = 0, visibleRows = 0;
  let sources = {}, planToken = 0, modelPlan = null, plannedRows = 0;
  let session = TradeScopeSBIModelPreview.createSession();
  function node(tag, text, className) {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  }
  function amount(value) {
    if (value === null || value === undefined) return '—';
    const [integer, fraction] = value.split('.');
    return integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fraction ? '.' + fraction : '');
  }
  function clearView() {
    readToken += 1; preview = null; visibleRows = 0;
    planToken += 1; modelPlan = null; plannedRows = 0;
    $('preview').hidden = true; $('read-status').textContent = '';
    $('planned').hidden = true;
    $('loaded-previews').hidden = true; $('loaded-previews').replaceChildren();
    ['summary', 'groups', 'issues', 'detail-head', 'detail-body', 'planned-summary', 'planned-issues', 'planned-rows'].forEach(id => $(id).replaceChildren());
    ['holdings-file', 'transactions-file', 'target-month', 'observed-date'].forEach(id => { $(id).value = ''; });
    $('details').open = false;
    $('planned-details').open = false;
  }
  function reset() {
    clearView(); sources = {}; session = TradeScopeSBIModelPreview.createSession();
  }
  function metric(label, value) { $('summary').append(node('dt', label), node('dd', value)); }
  function renderLoadedPreviews() {
    $('loaded-previews').replaceChildren();
    const kinds = ['holdings', 'transactions'].filter(kind => sources[kind]);
    $('loaded-previews').hidden = kinds.length < 2;
    if (kinds.length < 2) return;
    for (const kind of kinds) {
      const label = kind === 'holdings' ? '保有証券' : '約定履歴';
      const button = node('button', `${label} ${sources[kind].preview.rows.length}件`, 'secondary');
      button.type = 'button'; button.ariaPressed = String(preview?.kind === kind);
      button.addEventListener('click', async () => {
        clearView(); preview = sources[kind].preview;
        $('read-status').textContent = 'プレビューのみ・保存されません';
        render(); renderLoadedPreviews(); await updatePlanned();
      });
      $('loaded-previews').append(button);
    }
  }
  function renderPlannedRows() {
    if (!modelPlan || !preview) return;
    const file = modelPlan.files.find(item => item.kind === preview.kind);
    if (!file) return;
    const end = Math.min(plannedRows + 100, file.rows.length);
    file.rows.slice(plannedRows, end).forEach(row => {
      const element = node('div', undefined, 'planned-row');
      element.append(node('span', row.name || `${row.rowNumber}行目`), node('span', row.status === 'invalid'
        ? '変換不可' : row.status === 'needs-confirmation' ? '要確認' : '候補', 'muted'));
      $('planned-rows').append(element);
    });
    plannedRows = end; $('more-planned').hidden = end >= file.rows.length;
  }
  async function updatePlanned() {
    const token = ++planToken;
    modelPlan = null; plannedRows = 0;
    ['planned-summary', 'planned-issues', 'planned-rows'].forEach(id => $(id).replaceChildren());
    $('planned').hidden = false; $('more-planned').hidden = true;
    if (!preview) return;
    try {
      // All reads go through the Storage boundary, with a getItem-only adapter.
      const existing = TradeScopeSBIModelPreview.readExisting(window.localStorage);
      const converted = await TradeScopeSBIModelPreview.convert(Object.values(sources), existing, session);
      if (token !== planToken || !preview) return;
      modelPlan = converted;
      const file = converted.files.find(item => item.kind === preview.kind);
      if (!file) return;
      const metric = (label, value) => $('planned-summary').append(node('dt', label), node('dd', value));
      if (preview.kind === 'holdings') metric('保有記録', `${file.holdings.length}件`);
      else {
        metric('取引候補', `${file.counts.candidateCount}件`);
        if (file.counts.needsConfirmationCount) {
          metric('保存可能', `${file.counts.savableCount}件`);
          metric('要確認', `${file.counts.needsConfirmationCount}件`);
        }
      }
      const candidates = converted.instruments.filter(item => file.instrumentIds.includes(item.record.id));
      metric('新規銘柄候補', `${candidates.filter(item => item.status === 'new').length}件`);
      metric('既存銘柄再利用', `${candidates.filter(item => item.status === 'existing').length}件`);
      if (preview.kind === 'holdings') {
        metric('対象月', file.batch?.targetMonth ? file.batch.targetMonth.replace('-', '年') + '月分' : '—');
        metric('取得日', file.batch?.snapshotAsOf ? file.batch.snapshotAsOf.replace('T', ' ') : '—');
        metric('保有の観測', file.observation ? '1件' : '—');
      }
      const groupedIssues = new Map();
      [...file.issues, ...file.rows.flatMap(row => row.issues)].forEach(item => {
        const key = item.severity + ':' + item.code;
        if (!groupedIssues.has(key)) groupedIssues.set(key, { item, count: 0 });
        groupedIssues.get(key).count++;
      });
      [...groupedIssues.values()].slice(0, 30).forEach(({ item, count }) => {
        const text = `${count > 1 ? count + '件：' : item.rowNumber ? item.rowNumber + '行目：' : ''}${item.message}`;
        $('planned-issues').append(node('p', text, `issue ${item.severity}`));
      });
      renderPlannedRows();
    } catch (_) {
      if (token === planToken) $('planned-issues').append(node('p', '保存予定内容を確認できません。保存データやブラウザ環境を確認してください。', 'issue error'));
    }
  }
  function renderIssues() {
    $('issues').replaceChildren();
    if (!preview) return;
    const issues = [...preview.issues, ...preview.rows.flatMap(row => row.issues)];
    const errors = issues.filter(item => item.severity === 'error');
    const warnings = issues.filter(item => item.severity === 'warning');
    $('issues').append(node('p', `エラー ${errors.length} / 注意 ${warnings.length}`, 'muted'));
    const unique = new Set();
    issues.forEach(item => {
      const text = `${item.rowNumber ? item.rowNumber + '行目：' : ''}${item.message}`;
      if (!unique.has(text) && unique.size < 30) { unique.add(text); $('issues').append(node('p', text, `issue ${item.severity}`)); }
    });
    if (issues.length > 30) $('issues').append(node('p', 'ほかにも確認事項があります。明細を確認してください。', 'muted'));
  }
  const columns = {
    holdings: [['name', '銘柄'], ['code', 'コード'], ['product', '商品'], ['custody', '預り'], ['quantity', '数量'],
      ['acquisitionPrice', '取得単価'], ['marketPrice', '現在値 / 基準価額'], ['acquisitionAmount', '取得金額'], ['valuation', '評価額'], ['unrealizedPnl', '評価損益']],
    transactions: [['executedAt', '約定日'], ['name', '銘柄'], ['code', 'コード'], ['product', '商品'], ['market', '市場'],
      ['transactionType', '取引'], ['orderType', '注文'], ['custody', '預り'], ['quantity', '数量'], ['price', '単価'],
      ['settlementDate', '受渡日'], ['settlementOrPnl', '受渡金額 / 決済損益'], ['settlementAmount', '受渡金額'], ['reportedRealizedPnl', '決済損益'], ['fee', '手数料']]
  };
  function renderRows() {
    if (!preview) return;
    const end = Math.min(visibleRows + 100, preview.rows.length);
    preview.rows.slice(visibleRows, end).forEach(row => {
      const tr = node('tr');
      const cell = (label, value) => { const td = node('td', value); td.dataset.label = label; return td; };
      tr.append(cell('行', String(row.rowNumber)), cell('状態', row.status === 'invalid' ? '要確認' : row.issues.length ? '注意' : '正常'));
      columns[preview.kind].forEach(([field, label]) => tr.append(cell(label, row.data[field] ?? '—')));
      $('detail-body').append(tr);
    });
    visibleRows = end; $('more-rows').hidden = visibleRows >= preview.rows.length;
  }
  function render() {
    $('preview').hidden = false;
    $('preview-title').textContent = preview.kind === 'holdings' ? '保有証券の確認' : '約定履歴の確認';
    renderDateFields();
    const summary = preview.summary;
    if (summary) {
      metric(preview.kind === 'holdings' ? '明細数' : '取引件数', String(summary.validCount));
      if (summary.invalidCount) metric('要確認', `${summary.invalidCount}件`);
      if (preview.kind === 'holdings') {
        metric('評価額合計', amount(summary.valuation)); metric('評価損益合計', amount(summary.unrealizedPnl));
        summary.groups.forEach(group => {
          const row = node('div', undefined, 'group');
          row.append(node('span', `${group.product || '区分未取得'} / ${group.custody || '預り未取得'}`), node('span', `${group.count}件 / ${amount(group.valuation)}`));
          $('groups').append(row);
        });
      } else {
        if (summary.searchPeriod) metric('検索期間', summary.searchPeriod.join(' ～ '));
        metric('約定期間', summary.period ? summary.period.join(' ～ ') : '—');
      }
    }
    renderIssues();
    const tr = node('tr');
    ['行', '状態', ...columns[preview.kind].map(([, label]) => label)].forEach(label => tr.append(node('th', label)));
    $('detail-head').append(tr); renderRows();
  }
  function renderDateFields() {
    $('dates').hidden = preview.kind !== 'holdings';
    $('target-month').value = preview.targetMonth || '';
    $('observed-date').value = preview.snapshotAsOf ? preview.snapshotAsOf.slice(0, 10) : '';
    $('observed-date').readOnly = preview.snapshotAsOfSource === 'file';
    $('date-note').textContent = preview.snapshotAsOf
      ? `${preview.snapshotAsOfSource === 'file' ? 'CSVの基準日' : '指定した取得日'}：${preview.snapshotAsOf.replace('T', ' ')}`
      : 'CSVに基準日がないため、取得日を指定してください。';
  }
  async function readFile(input) {
    const file = input.files[0];
    if (!file) return;
    const previous = sources[input.dataset.kind];
    clearView(); delete sources[input.dataset.kind]; const token = readToken;
    $('read-status').textContent = '読み込み中…';
    // Bound memory/DOM use; source contents and file names never enter storage/logs.
    if (file.size > 10 * 1024 * 1024) { $('read-status').textContent = '10MB以下のCSVを選択してください。'; return; }
    try {
      const buffer = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('ファイルを読み込めません。'));
        reader.onabort = () => reject(new Error('読み込みを中止しました。'));
        reader.readAsArrayBuffer(file);
      });
      if (token !== readToken) return;
      const decoded = TradeScopeCSV.decodeCSV(buffer, $('encoding').value);
      const detectedKind = TradeScopeSBI.detectKind(decoded.text);
      if (!detectedKind) {
        $('read-status').textContent = '対応するSBI証券CSVを確認できませんでした'; return;
      }
      if (detectedKind !== input.dataset.kind) {
        $('read-status').textContent = detectedKind === 'transactions'
          ? '約定履歴CSVです。約定履歴から選択してください。'
          : '保有証券CSVです。保有証券から選択してください。';
        return;
      }
      preview = TradeScopeSBI.parse(decoded.text, input.dataset.kind);
      $('read-status').textContent = 'プレビューのみ・保存されません'; render();
      try {
        const metadata = await TradeScopeSBIModelPreview.fileMetadata(buffer);
        if (token !== readToken) return;
        // Only the exact same file may retain dates explicitly chosen by the user.
        if (previous?.metadata.hash === metadata.hash) {
          preview.targetMonth = previous.targetMonth;
          if (!preview.snapshotAsOf && previous.preview.snapshotAsOfSource === 'user') {
            preview.snapshotAsOf = previous.snapshotAsOf; preview.snapshotAsOfSource = 'user';
          }
          renderDateFields();
        }
        sources[preview.kind] = { preview, metadata, targetMonth: preview.targetMonth || null, snapshotAsOf: preview.snapshotAsOf };
        renderLoadedPreviews();
        await updatePlanned();
      } catch (_) {
        if (token === readToken) {
          $('planned').hidden = false;
          $('planned-issues').append(node('p', '保存予定内容を確認できません。ブラウザ環境を確認してください。', 'issue error'));
        }
      }
    } catch (_) {
      if (token === readToken) $('read-status').textContent = 'CSVを読み込めません。ファイルと文字コードを確認してください。';
    }
  }
  document.querySelectorAll('input[type=file]').forEach(input => input.addEventListener('change', () => readFile(input)));
  $('sbi-provider').addEventListener('toggle', () => { if (!$('sbi-provider').open) reset(); });
  $('close-preview').addEventListener('click', reset);
  $('more-rows').addEventListener('click', renderRows);
  $('more-planned').addEventListener('click', renderPlannedRows);
  $('encoding').addEventListener('change', reset);
  $('observed-date').addEventListener('change', () => {
    if (!preview || preview.snapshotAsOfSource === 'file') return;
    preview.snapshotAsOf = $('observed-date').value || null;
    preview.snapshotAsOfSource = preview.snapshotAsOf ? 'user' : null;
    if (sources[preview.kind]) sources[preview.kind].snapshotAsOf = preview.snapshotAsOf;
    renderDateFields();
    return updatePlanned();
  });
  $('target-month').addEventListener('change', () => {
    if (preview) {
      preview.targetMonth = $('target-month').value || null;
      if (sources[preview.kind]) sources[preview.kind].targetMonth = preview.targetMonth;
      return updatePlanned();
    }
  });
  const help = {
    holdings: { title: '保有証券CSVの取得方法', steps: ['SBI証券へログイン', '口座管理で国内の保有証券を開く', 'CSVをダウンロード'], url: 'https://search.sbisec.co.jp/v2/popwin/help/manage_03_01.html' },
    transactions: { title: '約定履歴CSVの取得方法', steps: ['SBI証券へログイン', '口座管理 → 取引履歴 → 約定履歴', '商品・期間を選びCSVをダウンロード'], url: 'https://search.sbisec.co.jp/v2/popwin/help/manage_10_01.html' }
  };
  document.querySelectorAll('[data-help]').forEach(button => button.addEventListener('click', () => {
    const info = help[button.dataset.help]; $('help-title').textContent = info.title;
    $('help-steps').replaceChildren(...info.steps.map(text => node('li', text)));
    $('official-help').href = info.url; $('help-dialog').showModal();
  }));
  $('close-help').addEventListener('click', () => $('help-dialog').close());
  $('help-dialog').addEventListener('click', event => { if (event.target === $('help-dialog')) {
    const rect = $('help-dialog').getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) $('help-dialog').close();
  } });
  window.addEventListener('pagehide', reset);
})();
