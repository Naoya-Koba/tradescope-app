(function (root) {
  'use strict';

  // CSV grammar only. No DOM, storage, network, or broker-specific assumptions.
  function parseCSV(input) {
    const text = String(input).replace(/^\uFEFF/, '');
    const records = [];
    let cells = [], cell = '', quoted = false, closed = false, line = 1, start = 1;
    function finishCell() { cells.push(cell); cell = ''; closed = false; }
    function finishRow() {
      finishCell();
      if (cells.some(value => value.trim() !== '')) records.push({ line: start, cells });
      cells = []; start = line + 1;
    }
    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      if (quoted) {
        if (char === '"') {
          if (text[i + 1] === '"') { cell += '"'; i += 1; }
          else { quoted = false; closed = true; }
        } else {
          cell += char;
          if (char === '\n' || (char === '\r' && text[i + 1] !== '\n')) line += 1;
        }
      } else if (char === ',') finishCell();
      else if (char === '\n' || char === '\r') {
        finishRow();
        if (char === '\r' && text[i + 1] === '\n') i += 1;
        line += 1;
      } else if (char === '"' && cell === '' && !closed) quoted = true;
      else {
        if (closed || char === '"') throw new Error(`${line}行目：CSVの引用符が不正です。`);
        cell += char;
      }
    }
    if (quoted) throw new Error(`${start}行目：CSVの引用符が閉じられていません。`);
    if (cell !== '' || cells.length || closed) finishRow();
    return records;
  }

  function decodeCSV(buffer, encoding = 'auto') {
    const bytes = new Uint8Array(buffer);
    if (bytes[0] === 0xFF && bytes[1] === 0xFE || bytes[0] === 0xFE && bytes[1] === 0xFF) {
      throw new Error('UTF-16には未対応です。UTF-8またはShift_JISのCSVを選択してください。');
    }
    const choices = encoding === 'auto' ? ['utf-8', 'shift_jis'] : [encoding];
    for (const choice of choices) {
      if (!['utf-8', 'shift_jis'].includes(choice)) throw new Error('未対応の文字コードです。');
      try {
        return { text: new TextDecoder(choice, { fatal: true }).decode(bytes), encoding: choice };
      } catch (_) { /* Try only the next explicitly supported encoding. */ }
    }
    throw new Error('文字コードを読み取れません。文字コードの指定を確認してください。');
  }

  function decimal(value) {
    if (value === undefined || value === null || String(value).trim() === '') return null;
    const text = String(value).trim();
    if (!/^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(text) || text.length > 100) {
      throw new Error('数値を解釈できません。');
    }
    return text.replace(/,/g, '').replace(/^\+/, '');
  }

  // Exact decimal addition; never fill missing inputs with zero.
  function sum(values) {
    if (!values.length || values.some(value => value === null)) return null;
    const scale = values.reduce((max, value) => Math.max(max, (value.split('.')[1] || '').length), 0);
    let total = 0n;
    values.forEach(value => {
      const negative = value.startsWith('-');
      const [integer, fraction = ''] = value.replace(/^-/, '').split('.');
      const amount = BigInt(integer + fraction.padEnd(scale, '0'));
      total += negative ? -amount : amount;
    });
    const digits = (total < 0n ? -total : total).toString().padStart(scale + 1, '0');
    return (total < 0n ? '-' : '') + (scale ? digits.slice(0, -scale) + '.' + digits.slice(-scale) : digits);
  }

  function date(value) {
    if (!value || !String(value).trim()) return null;
    const match = /^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/.exec(String(value).trim());
    if (!match) throw new Error('年を含む日付が必要です。');
    const [, y, m, d] = match.map(Number);
    const check = new Date(Date.UTC(y, m - 1, d));
    if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) {
      throw new Error('日付が不正です。');
    }
    return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  function observation(value) {
    if (!value || !String(value).trim()) return null;
    const text = String(value).trim();
    const match = /^(\d{4}[\/-]\d{1,2}[\/-]\d{1,2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?(Z|[+-]\d{2}:\d{2})?)?$/.exec(text);
    if (!match) throw new Error('基準日時を解釈できません。');
    const day = date(match[1]);
    if (!match[2]) return day;
    if (+match[2] > 23 || +match[3] > 59 || +(match[4] || '0') > 59 ||
      (match[5] && match[5] !== 'Z' && (+match[5].slice(1, 3) > 23 || +match[5].slice(4) > 59))) {
      throw new Error('基準日時が不正です。');
    }
    return `${day}T${match[2]}:${match[3]}${match[4] ? ':' + match[4] : ''}${match[5] || ''}`;
  }

  const api = { parseCSV, decodeCSV, decimal, sum, date, observation };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TradeScopeCSV = Object.freeze(api);
})(typeof globalThis !== 'undefined' ? globalThis : this);
