// Local PDF loading/extraction. Never accepts a remote URL or persists source data.
import * as pdfjs from '../vendor/pdfjs-6.4.299/pdf.mjs';
const assetRoot = new URL('../vendor/pdfjs-6.4.299/', import.meta.url);
pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdf.worker.mjs', assetRoot).href;
export const version = 'pdfjs-6.4.299-legacy';
const abort = () => new DOMException('解析を中止しました', 'AbortError');
// getTextContent() uses ReadableStream async iteration, absent in some Safari releases.
// Use the same public text stream with its broadly supported reader, without a global polyfill.
export async function readTextItems(page, { signal, limit = 150000 } = {}) {
  const reader = page.streamTextContent().getReader(), items = [];
  try {
    while (true) {
      if (signal?.aborted) throw abort();
      const { value, done } = await reader.read();
      if (done) return items;
      if (items.length + value.items.length > limit) throw new Error('PDF_TEXT_LIMIT');
      for (const item of value.items) items.push(item);
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
const safeFailure = stage => Object.assign(new Error('PDFの読み取り処理に失敗しました'), {
  stage, code: ({ file: 'PDF_INVALID_FILE', worker: 'PDF_WORKER_INIT_FAILED',
    document: 'PDF_DOCUMENT_LOAD_FAILED', text: 'PDF_TEXT_EXTRACTION_FAILED' })[stage]
});
export function createDocumentLoader(engine) {
 return async function loadDocument(bytes, { signal, onDiagnostic } = {}) {
  if (signal?.aborted) throw abort();
  if (!(bytes instanceof Uint8Array) || bytes.length > 20 * 1024 * 1024 || bytes.length < 8
    || !new TextDecoder('ascii').decode(bytes.subarray(0, 5)).startsWith('%PDF-')) throw safeFailure('file');
  let task, worker, disposing, stage = 'worker', rejectAbort;
  const aborted = new Promise((_, reject) => { rejectAbort = reject; });
  const wait = promise => Promise.race([promise, aborted]);
  const diagnostic = (stage, code) => { onDiagnostic?.({ stage, code }); };
  // Keep the worker alive for the document destroy acknowledgement, and dispose once.
  const dispose = () => disposing ||= (async () => {
    if (task) await task.destroy().catch(() => {});
    worker?.destroy();
  })();
  const cancel = () => { rejectAbort(abort()); void dispose(); };
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    // PDF.js itself provides its official fake-worker fallback if local worker startup fails.
    worker = new engine.PDFWorker({ verbosity: 0 });
    await wait(worker.promise);
    diagnostic('worker', 'PDF_WORKER_READY');
    stage = 'document';
    task = engine.getDocument({ data: bytes, worker, verbosity: 0, stopAtErrors: true, useWasm: false,
      disableFontFace: true, useSystemFonts: false, cMapUrl: new URL('cmaps/', assetRoot).href, cMapPacked: true });
    const document = await wait(task.promise);
    diagnostic('document', 'PDF_DOCUMENT_READY');
    if (document.numPages > 100) throw new Error();
    let closed = false;
    const close = async () => {
      if (closed) return;
      closed = true; signal?.removeEventListener('abort', cancel);
      await dispose();
    };
    return { document, close };
  } catch (_) {
    signal?.removeEventListener('abort', cancel);
    await dispose();
    if (signal?.aborted) throw abort();
    throw safeFailure(stage);
  }
 };
}
export const loadDocument = createDocumentLoader(pdfjs);
export function createExtractor(engine) {
 const load = createDocumentLoader(engine);
 return async function extract(bytes, { signal, onProgress, onDiagnostic } = {}) {
  let session, stage = 'document';
  // The loader owns worker/document cancellation; page operations race the same signal.
  let rejectAbort;
  const pageAbort = new Promise((_, reject) => { rejectAbort = reject; });
  pageAbort.catch(() => {});
  const cancel = () => rejectAbort(abort());
  signal?.addEventListener('abort', cancel, { once: true });
  const wait = promise => Promise.race([promise, pageAbort]);
  try {
    // Loader validates bytes and preserves its safe stage/code.
    session = await load(bytes, { signal, onDiagnostic });
    const document = session.document;
    const pages = []; let itemCount = 0;
    for (let number = 1; number <= document.numPages; number++) {
      if (signal?.aborted) throw abort();
      stage = 'document';
      const page = await wait(document.getPage(number));
      stage = 'text';
      try {
        const items = await wait(readTextItems(page, { signal, limit: 150000 - itemCount }));
        itemCount += items.length;
        const viewport = page.rotate ? page.getViewport({ scale: 1 }) : null;
        pages.push({ number, items: items.filter(item => typeof item.str === 'string').map(item => {
          const point = viewport?.convertToViewportPoint(item.transform[4], item.transform[5]);
          return { text: item.str, x: point ? point[0] : item.transform[4],
            y: point ? viewport.height - point[1] : item.transform[5], width: item.width, height: item.height };
        }) });
      } finally { page.cleanup(); }
      onProgress?.(number, document.numPages);
    }
    if (signal?.aborted) throw abort();
    onDiagnostic?.({ stage: 'text', code: 'PDF_TEXT_READY' });
    return { pages, extractorVersion: version };
  } catch (failure) {
    if (signal?.aborted) throw abort();
    // Library errors can contain source fragments/URLs. Do not expose them or log them.
    throw session ? safeFailure(stage) : failure;
  } finally {
    signal?.removeEventListener('abort', cancel);
    if (session) await session.close();
  }
 };
}
export const extract = createExtractor(pdfjs);
