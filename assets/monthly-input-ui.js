(function (root) {
  'use strict';
  const fields = Object.freeze([
    ['realizedPnL', '決済損益'], ['swapPnL', 'スワップ損益'], ['unrealizedPnL', '評価損益'], ['deposit', '入金'], ['withdrawal', '出金']
  ].map(([field, label]) => Object.freeze({ field, label })));
  function readOnlyField(document, field, label, value, prefix) {
    const group = document.createElement('div'); group.className = 'form-group';
    const caption = document.createElement('label'), input = document.createElement('input');
    input.id = `${prefix}-${field}`; input.type = 'number'; input.step = 'any'; input.readOnly = true;
    input.className = 'input-monthly-readonly input-auto-calculated'; input.dataset.monthlyField = field;
    // These controls intentionally have no .input-account or Draft fields: legacy save cannot collect them.
    input.value = value == null ? '' : String(value); input.placeholder = '—';
    caption.htmlFor = input.id; caption.textContent = label;
    const suffix = document.createElement('span'); suffix.className = 'suffix suffix-auto'; suffix.textContent = '¥';
    group.append(caption, input, suffix); return group;
  }
  function renderReadOnly(document, container, values, prefix) {
    for (const {field,label} of fields) container.appendChild(readOnlyField(document,field,label,values[field],prefix));
  }
  const api = Object.freeze({fields,readOnlyField,renderReadOnly});
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TradeScopeMonthlyInputUI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
