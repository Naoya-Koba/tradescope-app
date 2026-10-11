const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
// Anonymous in-memory PDF with a Japanese ToUnicode map, no personal/financial information.
function samplePdf() {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 600] /Resources << /Font << /F1 5 0 R >> >> /Contents 8 0 R >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 600] /Resources << /Font << /F1 5 0 R >> >> /Contents 8 0 R >>',
    '<< /Type /Font /Subtype /Type0 /BaseFont /Anonymous /Encoding /Identity-H /DescendantFonts [6 0 R] /ToUnicode 7 0 R >>',
    '<< /Type /Font /Subtype /CIDFontType2 /BaseFont /Anonymous /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /DW 1000 >>'
  ];
  const map = '/CIDInit /ProcSet findresource begin 12 dict begin begincmap /CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def /CMapName /Anonymous def /CMapType 2 def 1 begincodespacerange <0000> <FFFF> endcodespacerange 3 beginbfchar <0001> <65E5> <0002> <672C> <0003> <8A9E> endbfchar endcmap CMapName currentdict /CMap defineresource pop end end';
  const content = 'BT /F1 12 Tf 30 500 Td <000100020003> Tj ET';
  objects.push(`<< /Length ${map.length} >>\nstream\n${map}\nendstream`, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  let pdf = '%PDF-1.7\n', offsets = [0];
  objects.forEach((object, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${object}\nendobj\n`; });
  const start = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` + offsets.slice(1).map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
  return new Uint8Array(Buffer.from(pdf, 'ascii'));
}
async function extractor() {
  globalThis.DOMMatrix ||= class {};
  globalThis.Path2D ||= class {};
  globalThis.ImageData ||= class {};
  return import(pathToFileURL(require.resolve('../import/pdf-extractor.mjs')).href);
}
test('fixed local PDF library extracts Japanese text and multiple pages without rendering/persistence', async () => {
  const e = await extractor(), progress = [];
  const value = await e.extract(samplePdf(), { onProgress: n => progress.push(n) });
  assert.equal(value.pages.length, 2); assert.deepEqual(progress, [1, 2]);
  for (const page of value.pages) { assert.ok(page.items.some(i => i.text === '日本語')); assert.equal(typeof page.items[0].x, 'number'); }
});
test('extractor rejects non-PDF/malformed input and honors cancellation', async () => {
  const e = await extractor(); await assert.rejects(e.extract(new TextEncoder().encode('not a PDF')));
  await assert.rejects(e.extract(new TextEncoder().encode('%PDF-1.7 invalid')));
  const c = new AbortController(); c.abort(); await assert.rejects(e.extract(samplePdf(), { signal: c.signal }), { name: 'AbortError' });
  const active = new AbortController(); await assert.rejects(e.extract(samplePdf(), { signal: active.signal, onProgress: () => active.abort() }), { name: 'AbortError' });
});
test('extractor uses fixed local worker/data/CMap only, no storage/log/remote URLs', () => {
  const code = fs.readFileSync(require.resolve('../import/pdf-extractor.mjs'), 'utf8');
  assert.match(code, /pdf\.worker\.mjs/); assert.match(code, /import\.meta\.url/);
  assert.doesNotMatch(code, /https?:|localStorage|sessionStorage|indexedDB|console\.|XMLHttpRequest|sendBeacon/);
  assert.match(code, /data: bytes/); assert.match(code, /task\.destroy/);
});
module.exports = { samplePdf };
