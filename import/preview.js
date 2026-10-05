(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  let preview = null, readToken = 0, visibleRows = 0;
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
  function reset() {
    readToken += 1; preview = null; visibleRows = 0;
    $('preview').hidden = true; $('read-status').textContent = '';
    ['summary', 'groups', 'issues', 'detail-head', 'detail-body'].forEach(id => $(id).replaceChildren());
    ['holdings-file', 'transactions-file', 'target-month', 'observed-date'].forEach(id => { $(id).value = ''; });
    $('details').open = false;
  }
  function metric(label, value) { $('summary').append(node('dt', label), node('dd', value)); }
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
      const tr = node('tr'); tr.append(node('td', String(row.rowNumber)), node('td', row.status === 'invalid' ? '要確認' : row.issues.length ? '注意' : '正常'));
      columns[preview.kind].forEach(([field]) => tr.append(node('td', row.data[field] ?? '—')));
      $('detail-body').append(tr);
    });
    visibleRows = end; $('more-rows').hidden = visibleRows >= preview.rows.length;
  }
  function render() {
    $('preview').hidden = false;
    $('preview-title').textContent = preview.kind === 'holdings' ? '保有証券の確認' : '約定履歴の確認';
    $('dates').hidden = preview.kind !== 'holdings';
    $('observed-date').value = preview.snapshotAsOf ? preview.snapshotAsOf.slice(0, 10) : '';
    $('observed-date').readOnly = preview.snapshotAsOfSource === 'file';
    $('date-note').textContent = preview.snapshotAsOf ? `CSVの基準日：${preview.snapshotAsOf.replace('T', ' ')}` : 'CSVに基準日がないため、取得日を指定してください。';
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
  async function readFile(input) {
    const file = input.files[0];
    if (!file) return;
    reset(); const token = readToken;
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
      preview = TradeScopeSBI.parse(decoded.text, input.dataset.kind);
      $('read-status').textContent = 'プレビューのみ・保存されません'; render();
    } catch (_) {
      if (token === readToken) $('read-status').textContent = 'CSVを読み込めません。ファイルと文字コードを確認してください。';
    }
  }
  document.querySelectorAll('input[type=file]').forEach(input => input.addEventListener('change', () => readFile(input)));
  $('close-preview').addEventListener('click', reset);
  $('more-rows').addEventListener('click', renderRows);
  $('encoding').addEventListener('change', reset);
  $('observed-date').addEventListener('change', () => {
    if (!preview || preview.snapshotAsOfSource === 'file') return;
    preview.snapshotAsOf = $('observed-date').value || null;
    preview.snapshotAsOfSource = preview.snapshotAsOf ? 'user' : null;
  });
  $('target-month').addEventListener('change', () => {
    if (preview) preview.targetMonth = $('target-month').value || null;
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
