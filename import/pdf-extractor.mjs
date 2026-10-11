// Local, text-only extraction. Never accepts a remote URL, renders pages or persists source data.
import * as pdfjs from '../vendor/pdfjs-6.4.299/pdf.mjs';
const assetRoot = new URL('../vendor/pdfjs-6.4.299/', import.meta.url);
pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdf.worker.mjs', assetRoot).href;
export const version = 'pdfjs-6.4.299-legacy';
const abort = () => new DOMException('解析を中止しました', 'AbortError');
export async function extract(bytes, { signal, onProgress } = {}) {
  if (signal?.aborted) throw abort();
  if (!(bytes instanceof Uint8Array) || bytes.length > 20 * 1024 * 1024 || bytes.length < 8
    || !new TextDecoder('ascii').decode(bytes.subarray(0, 5)).startsWith('%PDF-')) throw new Error('PDFファイルを確認してください');
  let task;
  const cancel = () => { if (task) void task.destroy().catch(() => {}); };
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    task = pdfjs.getDocument({ data: bytes, verbosity: 0, stopAtErrors: true, useWasm: false,
      disableFontFace: true, useSystemFonts: false, cMapUrl: new URL('cmaps/', assetRoot).href, cMapPacked: true });
    const document = await task.promise;
    if (document.numPages > 100) throw new Error('ページ数が多すぎます');
    const pages = []; let itemCount = 0;
    for (let number = 1; number <= document.numPages; number++) {
      if (signal?.aborted) throw abort();
      const page = await document.getPage(number);
      const content = await page.getTextContent();
      itemCount += content.items.length;
      if (itemCount > 150000) throw new Error('PDFの内容が多すぎます');
      pages.push({ number, items: content.items.filter(item => typeof item.str === 'string').map(item => ({
        text: item.str, x: item.transform[4], y: item.transform[5], width: item.width, height: item.height })) });
      page.cleanup(); onProgress?.(number, document.numPages);
    }
    if (signal?.aborted) throw abort();
    return { pages, extractorVersion: version };
  } catch (_) {
    if (signal?.aborted) throw abort();
    // Library errors can contain source fragments/URLs. Do not expose them or log them.
    throw new Error('PDFを解析できません。対応する月次報告書を確認してください');
  } finally {
    signal?.removeEventListener('abort', cancel);
    if (task) await task.destroy().catch(() => {});
  }
}
