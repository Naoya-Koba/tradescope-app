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

test('Safari without ReadableStream async iterator still extracts identical Japanese text', async () => {
  const e = await extractor(), expected = await e.extract(samplePdf());
  const descriptor = Object.getOwnPropertyDescriptor(ReadableStream.prototype, Symbol.asyncIterator);
  try {
    delete ReadableStream.prototype[Symbol.asyncIterator];
    const actual = await e.extract(samplePdf());
    assert.deepEqual(actual, expected);
  } finally { if (descriptor) Object.defineProperty(ReadableStream.prototype, Symbol.asyncIterator, descriptor); }
});

function fakeEngine(failingStage) {
  let workerDestroyed = 0, taskDestroyed = 0, cleaned = 0;
  const failure = () => Promise.reject(new Error('PRIVATE_NAME PRIVATE_ACCOUNT PDF_TEXT PRIVATE_AMOUNT'));
  const page = { cleanup: () => { cleaned++; }, streamTextContent: () => new ReadableStream({ start(c) {
    if (failingStage === 'text') c.error(new Error('PRIVATE_PDF_TEXT'));
    else { c.enqueue({ items: [{ str: '匿名', transform: [1,0,0,1,1,2], width: 3, height: 4 }] }); c.close(); }
  } }) };
  return { engine: {
    PDFWorker: class { constructor() { this.promise = failingStage === 'worker' ? failure() : Promise.resolve(); }
      destroy() { workerDestroyed++; } },
    getDocument: () => ({ promise: failingStage === 'document' ? failure() : Promise.resolve({ numPages: 1, getPage: async () => page }),
      destroy: async () => { taskDestroyed++; } })
  }, counts: () => ({ workerDestroyed, taskDestroyed, cleaned }) };
}

test('public worker readiness precedes document/text and worker/task/page cleanup completes', async () => {
  const e = await extractor(), fake = fakeEngine(), diagnostics = [];
  await e.createExtractor(fake.engine)(samplePdf(), { onDiagnostic: value => diagnostics.push(value) });
  assert.deepEqual(diagnostics, [{ stage:'worker',code:'PDF_WORKER_READY' },{ stage:'document',code:'PDF_DOCUMENT_READY' },{ stage:'text',code:'PDF_TEXT_READY' }]);
  assert.deepEqual(fake.counts(), { workerDestroyed:1,taskDestroyed:1,cleaned:1 });
});

test('rotated report pages use reading-direction coordinates without changing unrotated pages',async()=>{
 const e=await extractor(),fake=fakeEngine();const get=fake.engine.getDocument;
 fake.engine.getDocument=()=>{const task=get();task.promise=task.promise.then(doc=>({...doc,getPage:async()=>{
  const page=await doc.getPage();return {...page,rotate:90,getViewport:()=>({height:100,convertToViewportPoint:(x,y)=>[y,100-x]})};
 }}));return task;};
 const result=await e.createExtractor(fake.engine)(samplePdf());assert.equal(result.pages[0].items[0].x,2);assert.equal(result.pages[0].items[0].y,1);
});

for (const stage of ['worker', 'document', 'text']) test(`${stage} failure exposes only safe stage/code, never library/source fragments`, async () => {
  const e = await extractor(), fake = fakeEngine(stage);
  await assert.rejects(e.createExtractor(fake.engine)(samplePdf()), error => {
    assert.equal(error.stage, stage);
    assert.equal(error.code, { worker:'PDF_WORKER_INIT_FAILED',document:'PDF_DOCUMENT_LOAD_FAILED',text:'PDF_TEXT_EXTRACTION_FAILED' }[stage]);
    assert.doesNotMatch(JSON.stringify(error) + error.stack, /PRIVATE|ACCOUNT|AMOUNT/); assert.equal(error.cause, undefined); return true;
  });
  assert.equal(fake.counts().workerDestroyed, 1);
});

test('text reader releases lock and enforces item limit without source output', async () => {
  const e = await extractor(), fake = fakeEngine();
  const doc = await fake.engine.getDocument().promise, page = await doc.getPage(1);
  await assert.rejects(e.readTextItems(page, { limit:0 }), /PDF_TEXT_LIMIT/);
});

test('worker and CMap URLs resolve within the GitHub Pages subpath; no Blob/CDN/CSP expansion', () => {
  const source = new URL('https://example.invalid/tradescope-app/import/pdf-extractor.mjs');
  const root = new URL('../vendor/pdfjs-6.4.299/',source);
  assert.equal(new URL('pdf.worker.mjs',root).pathname,'/tradescope-app/vendor/pdfjs-6.4.299/pdf.worker.mjs');
  assert.equal(new URL('cmaps/',root).pathname,'/tradescope-app/vendor/pdfjs-6.4.299/cmaps/');
  const code=fs.readFileSync(require.resolve('../import/pdf-extractor.mjs'),'utf8');
  const html=fs.readFileSync(require.resolve('../import.html'),'utf8');
  assert.doesNotMatch(code,/createObjectURL|userAgent|standardFontDataUrl|wasmUrl/);
  assert.match(html,/worker-src 'self'/);assert.doesNotMatch(html,/unsafe-eval|blob:/);
});

test('worker-init cancellation destroys worker and never starts document processing', async () => {
  const e=await extractor(),c=new AbortController();let destroyed=0,started=0;
  const engine={PDFWorker:class {constructor(){this.promise=new Promise(()=>{});}destroy(){destroyed++;}},getDocument:()=>{started++;}};
  const pending=e.createExtractor(engine)(samplePdf(),{signal:c.signal});c.abort();
  await assert.rejects(pending,{name:'AbortError'});assert.ok(destroyed>=1);assert.equal(started,0);
});
test('document abort and repeated close share one teardown; worker outlives destroy acknowledgement', async () => {
 const e=await extractor(),c=new AbortController();let acknowledge,taskDestroyed=0,workerDestroyed=0;
 const engine={PDFWorker:class {constructor(){this.promise=Promise.resolve();}destroy(){workerDestroyed++;}},
  getDocument:()=>({promise:Promise.resolve({numPages:39}),destroy:()=>{taskDestroyed++;return new Promise(resolve=>{acknowledge=resolve;});}})};
 const session=await e.createDocumentLoader(engine)(samplePdf(),{signal:c.signal});c.abort();const close=session.close();
 assert.equal(taskDestroyed,1);assert.equal(workerDestroyed,0);acknowledge();await close;await session.close();
 assert.equal(taskDestroyed,1);assert.equal(workerDestroyed,1);
});
