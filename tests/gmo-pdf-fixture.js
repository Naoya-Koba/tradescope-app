// Invented report structure and numbers. Never read a user PDF here.
const text = (value, x, y) => ({ text: String(value), x, y, width: 8 * String(value).length, height: 8 });
function report() {
  const pages = [{ number: 1, items: [text('GMOクリック証券株式会社', 20, 560), text('取引残高報告書', 20, 540), text('2026/09', 20, 520)] }];
  const table = (heading, names, xs, rows, y = 440) => {
    const items = [text(heading, 20, y + 22), ...names.map((name, i) => text(name, xs[i], y))];
    rows.forEach((row, r) => row.forEach((value, c) => { if (value !== '') items.push(text(value, xs[c], y - 20 * (r + 1))); }));
    return items;
  };
  pages.push({ number: 2, items: table('<<入出金明細>>', ['入出金日付', '通貨', '内訳', '金額', '両替レート', '摘要'], [27, 82, 114, 217, 307, 370], [
    ['26/09/01', '日本円', '取引損益(AAA/JPY)', '10', '0', ''],
    ['26/09/02', '日本円', 'スワップ損益(AAA/JPY)', '5', '0', ''],
    ['', '日本円', '取引損益(AAA/JPY)', '10', '', ''],
    ['', '日本円', 'スワップ損益(AAA/JPY)', '5', '', '']]) });
  pages.push({ number: 3, items: table('<<残高明細>>', ['通貨', '前月末現金残高', '振替入出金合計', '取引損益合計', 'スワップ合計', '手数料合計', '当月現金残高'], [26, 62, 142, 230, 314, 402, 482], [
    ['日本円', '100', '0', '10', '5', '0', '115'], ['米ドル', '0', '0', '0', '0', '0', '0']]) });
  pages.push({ number: 4, items: table('証拠金状況', ['通貨', '時価評価総額', '締後振替額', '建玉評価損益', '建玉必要証拠金額'], [26, 62, 151, 230, 473], [
    ['日本円', '112', '0', '-3', '20'], ['米ドル', '-', '0', '-', '-']]) });
  pages.push({ number: 5, items: table('<<建玉必要証拠金明細>>', ['通貨ペア', '売建玉数', '買建玉数', '売必要証拠金額', '買必要証拠金額', '適用必要証拠金額'], [30, 121, 215, 296, 390, 479], [
    ['AAA/JPY', '0', '1', '0', '20', '20']]) });
  return { pages };
}
// Generate a text-only anonymous PDF at runtime; no PDF binary or user information in Git.
function pdfBytes(document = report()) {
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', ''];
  const chars = [...new Set(document.pages.flatMap(p => p.items.flatMap(i => [...i.text])))];
  const ids = new Map(chars.map((char, i) => [char, i + 1]));
  const hex = char => ids.get(char).toString(16).padStart(4, '0');
  const fontId = 3 + document.pages.length * 2;
  const kids = [];
  document.pages.forEach(page => {
    const pageId = objects.length + 1, streamId = pageId + 1; kids.push(`${pageId} 0 R`);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${streamId} 0 R >>`);
    const content = page.items.map(i => `BT /F1 8 Tf 1 0 0 1 ${i.x} ${i.y} Tm <${[...i.text].map(hex).join('')}> Tj ET`).join('\n');
    objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  });
  objects[1] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${kids.length} >>`;
  objects.push(`<< /Type /Font /Subtype /Type0 /BaseFont /Anonymous /Encoding /Identity-H /DescendantFonts [${fontId + 1} 0 R] /ToUnicode ${fontId + 2} 0 R >>`,
    `<< /Type /Font /Subtype /CIDFontType2 /BaseFont /Anonymous /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /DW 1000 /W [${chars.map(c => `${ids.get(c)} [${c.codePointAt(0) < 128 ? 500 : 1000}]`).join(' ')}] >>`);
  const map = '/CIDInit /ProcSet findresource begin 12 dict begin begincmap /CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def /CMapName /Anonymous def /CMapType 2 def 1 begincodespacerange <0000> <FFFF> endcodespacerange ' + chars.length + ' beginbfchar\n'
    + chars.map(c => `<${hex(c)}> <${c.codePointAt(0).toString(16).padStart(4, '0')}>`).join('\n') + '\nendbfchar endcmap CMapName currentdict /CMap defineresource pop end end';
  objects.push(`<< /Length ${map.length} >>\nstream\n${map}\nendstream`);
  let pdf = '%PDF-1.7\n'; const offsets = [];
  objects.forEach((object, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${object}\nendobj\n`; });
  const start = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` + offsets.map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('')
    + `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}
if (typeof module !== 'undefined' && module.exports) module.exports = { report, pdfBytes, text };
else window.AnonymousGMOFixture = { report, pdfBytes, text };
