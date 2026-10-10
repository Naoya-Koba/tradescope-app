// UI-only regression tests, with invented data and in-memory DOM/Chart doubles.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const ui = require('../assets/account-ui.js');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const display = ui.displayAccountName;
const copy = value => JSON.parse(JSON.stringify(value));
function section(source, from, to) { return source.slice(source.indexOf(from), source.indexOf(to, source.indexOf(from))); }
test('Exact UI aliases share labels without changing identities or unknown/custom names', () => {
  for (const id of ['gmo', 'GMO', 'acc_gmo_fx', 'GMOクリック証券']) assert.equal(display(id), 'GMO FXneo');
  for (const id of ['sbi', 'SBI', 'acc_sbi_sec', 'SBI証券']) assert.equal(display(id), 'SBI証券');
  for (const [id, label] of [['Light FX', 'LIGHT FX'], ['LIGHT FX', 'LIGHT FX'], ['みんなのFX', 'みんなのFX'],
    ['SBI VC', 'SBI VC'], ['SBI VCトレード', 'SBI VC'], ['三井住友銀行', '三井住友銀行']]) assert.equal(display(id), label);
  for (const id of ['custom', 'GMO別口座', 'SBI VC別口座', 'constructor', '__proto__']) assert.equal(display(id), id);
});
test('Static label initialization changes text only and exposes no storage or network capability', () => {
  let ready; const nodes = ['gmo', 'sbi', 'sbivc'].map(accountLabel => ({ dataset: { accountLabel }, textContent: '' }));
  const context = vm.createContext({ document: { addEventListener: (_, fn) => { ready = fn; }, querySelectorAll: () => nodes } });
  vm.runInContext(read('assets/account-ui.js'), context); ready();
  assert.deepEqual(nodes.map(node => node.textContent), ['GMO FXneo', 'SBI証券', 'SBI VC']);
  assert.match(read('profit/soneki.css'), /\[data-account-label\]\s*\{\s*text-transform: none;/);
  assert.doesNotMatch(read('assets/account-ui.js'), /localStorage|sessionStorage|\.commit\(|fetch\(|console\./);
});
test('Legacy/new Input renderers use the same mapping but old calculation names remain', () => {
  const source = read('profit/soneki.js');
  assert.match(source, /name: 'GMO', key: 'gmo'/); assert.match(source, /name: 'SBI', key: 'sbi'/);
  const legacy = section(source, 'function renderAccountInputs(', 'function renderSbiDraftCard(');
  const draft = section(source, 'function renderSbiDraftCard(', 'function handleAccountInputBlur(');
  assert.ok(legacy.includes('${displayAccountName(account.key)}'));
  assert.ok(draft.includes('${displayAccountName(account.key)}'));
  assert.match(source, /return ACCOUNTS.find\(\(account\) => account.key === accountKey\)\?\.name/);
  assert.match(source, /label: account.name/); // Snapshot serialization retains old labels.
});
test('History selects retain original values for create/edit/filter/close operations', () => {
  const source = read('history/history.js'), elements = {};
  const context = vm.createContext({ displayAccountName: display, escapeHtml: value => String(value),
    ACCOUNTS: ['GMO', 'SBI'], ASSET_TYPES: [], CATEGORIES: [], CATEGORY_LABELS: {}, STRATEGIES: [], STRATEGY_LABELS: {},
    document: { getElementById: id => elements[id] ||= { value: '', innerHTML: '' } } });
  vm.runInContext(section(source, 'function toOptionHtml(', 'function normalizeOpenPositionsView('), context);
  vm.runInContext(section(source, 'function buildBaseSelectOptions(', 'function readFilters('), context);
  context.buildBaseSelectOptions();
  assert.match(elements.entryAccount.innerHTML, /value="GMO" selected>GMO FXneo/);
  assert.match(elements.entryAccount.innerHTML, /value="SBI">SBI証券/);
  context.buildFilters([{ account: 'GMO' }, { account: 'SBI' }]);
  assert.match(elements.filterAccount.innerHTML, /value="GMO">GMO FXneo/);
  assert.match(elements.filterAccount.innerHTML, /value="SBI">SBI証券/);
  assert.match(source, /accountSel.innerHTML = ACCOUNTS.map\(\(v\) => toOptionHtml\(v, displayAccountName\(v\)\)\)/);
  assert.match(source, /accountList.map\(\(a\) => toOptionHtml\(a, displayAccountName\(a\)\)\)/);
  assert.match(source, /const account = document.getElementById\('entryAccount'\).value/);
  assert.match(source, /set\('editEntryAccount', entry.account\)/);
});
test('Old Snapshot account labels render in list/donut without mutation or allocation changes', () => {
  const source = read('top/script.js');
  const accountData = [{ label: 'GMO', amount: 10, color: '#3B6DFF' }, { label: 'SBI', amount: 20, color: '#D95757' },
    { label: 'Light FX', amount: 5, color: '#74D2F5' }, { label: 'SBI VC', amount: 3, color: '#EAF1FF' }];
  const before = copy(accountData), nodes = {}, charts = [];
  const context = vm.createContext({ accountData, portfolioChart: null, accountChart: null, displayAccountName: display,
    fmtJPY: value => String(value), DONUT_REVEAL_ANIMATION: {},
    document: { getElementById: id => nodes[id] ||= { innerHTML: '', getContext: () => ({}) } },
    Chart: function (_, config) { this.config = config; charts.push(config); },
    bindDoughnutTooltipInteractions() {}, bindSectionDonutReveal() {}, isElementInViewport: () => false });
  vm.runInContext(section(source, 'function buildPortfolioAllocationFromAccounts(', 'let portfolioData ='), context);
  context.portfolioData = context.buildPortfolioAllocationFromAccounts(accountData);
  assert.deepEqual(copy(context.portfolioData).map(item => [item.label, item.amount]), [['FX', 15], ['証券', 20], ['暗号資産', 3]]);
  vm.runInContext(section(source, 'function renderPortfolio()', '\nrenderPortfolio();'), context);
  context.renderPortfolio();
  assert.deepEqual(copy(charts[1].data.labels), ['SBI証券', 'GMO FXneo', 'LIGHT FX', 'SBI VC']);
  assert.deepEqual(copy(charts[1].data.datasets[0].data), [20, 10, 5, 3]);
  assert.match(nodes.accountItems.innerHTML, /GMO FXneo/); assert.match(nodes.accountItems.innerHTML, /SBI証券/);
  assert.deepEqual(accountData, before);
});
test('All major pages load the display module; precache and HTML versions are aligned', () => {
  const context = vm.createContext({ self: { addEventListener() {} } });
  const urls = vm.runInContext(read('service-worker.js') + '\nCORE_ASSETS', context);
  assert.equal(urls.length, new Set(urls).size);
  for (const url of urls) assert.ok(fs.existsSync(path.join(root, url.split('?')[0])));
  for (const file of ['index.html', 'history.html', 'import.html', 'profit/soneki.html']) {
    const html = read(file); assert.match(html, /account-ui.js\?v=20261011-1/);
    for (const [, url] of html.matchAll(/(?:src|href)="([^" ]+\.(?:js|css)(?:\?[^" ]+)?)"/g)) {
      if (/^https?:/.test(url)) continue;
      const relative = path.posix.normalize(path.posix.dirname(file) + '/' + url);
      assert.ok(urls.includes('./' + relative), relative);
    }
  }
  assert.match(read('index.html'), /topScriptVersion = '20261011-1'/);
  assert.ok(urls.includes('./top/script.js?v=20261011-1'));
});
