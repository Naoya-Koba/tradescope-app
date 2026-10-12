// In-session rendering only. Source bytes are owned by this document/worker, never stored.
import { loadDocument } from './pdf-extractor.mjs?v=20261012-10';
const safeCodes = new Set(['PDF_INVALID_FILE', 'PDF_WORKER_INIT_FAILED', 'PDF_DOCUMENT_LOAD_FAILED']);
export function canvasSize(viewport, width, zoom, pixelRatio) {
  const scale = Math.max(1, width) / viewport.width * zoom;
  const cssWidth = viewport.width * scale, cssHeight = viewport.height * scale;
  // Retina without unbounded iPhone canvas allocation: <=2 DPR, 4M pixels, 4096 per side.
  const ratio = Math.min(Math.max(1, pixelRatio || 1), 2, 4096 / cssWidth, 4096 / cssHeight,
    Math.sqrt(4000000 / (cssWidth * cssHeight)));
  return { scale, cssWidth, cssHeight, ratio, width: Math.max(1, Math.floor(cssWidth * ratio)), height: Math.max(1, Math.floor(cssHeight * ratio)) };
}
export function createViewer({ load = loadDocument, createCanvas, mount, measure, onState = () => {} }) {
  let state = { open: false, page: 0, total: 0, zoom: 1, busy: false, errorCode: null };
  let generation = 0, sequence = 0, controller, session, canvas, activePage, renderTask;
  let pending = Promise.resolve(), loading = Promise.resolve(), disposal = Promise.resolve();
  const emit = update => { state = { ...state, ...update }; onState({ ...state }); };
  const releaseCanvas = () => { if (canvas) { canvas.remove(); canvas.width = 0; canvas.height = 0; canvas = null; } };
  function close() {
    ++generation; ++sequence; controller?.abort(); controller = null; renderTask?.cancel(); releaseCanvas();
    const oldSession = session; session = null;
    const oldPending = pending, oldLoading = loading, oldDisposal = disposal;
    emit({ open: false, busy: false, page: 0, total: 0, errorCode: null });
    disposal = (async () => {
      await Promise.all([oldPending.catch(() => {}), oldLoading.catch(() => {}), oldDisposal]);
      if (oldSession) await oldSession.close();
    })();
    return disposal;
  }
  function showPage(value = state.page) {
    if (!session || !state.open) return Promise.resolve(false);
    const pageNumber = Math.min(state.total, Math.max(1, Number.isInteger(Number(value)) ? Number(value) : 1));
    const request = ++sequence, epoch = generation, currentSession = session;
    renderTask?.cancel();
    emit({ page: pageNumber, busy: true, errorCode: null });
    pending = pending.catch(() => {}).then(async () => {
      if (request !== sequence || epoch !== generation) return false;
      releaseCanvas(); activePage?.cleanup(); activePage = null;
      try {
        const page = await currentSession.document.getPage(pageNumber);
        if (request !== sequence || epoch !== generation) { page.cleanup(); return false; }
        activePage = page;
        const size = canvasSize(page.getViewport({ scale: 1 }), measure().width, state.zoom, measure().pixelRatio);
        const currentCanvas = createCanvas(); canvas = currentCanvas;
        canvas.width = size.width; canvas.height = size.height;
        canvas.style.width = size.cssWidth + 'px'; canvas.style.height = size.cssHeight + 'px';
        mount(canvas);
        const task = page.render({ canvasContext: canvas.getContext('2d'), viewport: page.getViewport({ scale: size.scale }),
          transform: size.ratio === 1 ? null : [size.ratio, 0, 0, size.ratio, 0, 0] });
        renderTask = task;
        await task.promise;
        if (request !== sequence || epoch !== generation) return false;
        emit({ busy: false }); return true;
      } catch (_) {
        if (request === sequence && epoch === generation) { releaseCanvas(); emit({ busy: false, errorCode: 'PDF_VIEWER_RENDER_FAILED' }); }
        return false;
      } finally {
        renderTask = null;
        activePage?.cleanup(); activePage = null;
      }
    });
    return pending;
  }
  async function open({ source, initialPage = 1 }) {
    await close();
    const epoch = ++generation; controller = new AbortController();
    const signal = controller.signal;
    emit({ open: true, page: 0, total: 0, zoom: 1, busy: true, errorCode: null });
    loading = (async () => {
      try {
        // A File/Blob reference avoids keeping a second full-file buffer after parser transfer.
        if (!(source instanceof Blob) || source.size > 20 * 1024 * 1024) throw Object.assign(new Error(), { code: 'PDF_INVALID_FILE' });
        let bytes;
        try { bytes = new Uint8Array(await source.arrayBuffer()); }
        catch (_) { throw Object.assign(new Error(), { code: 'PDF_VIEWER_FILE_READ_FAILED' }); }
        if (signal.aborted || epoch !== generation) return false;
        const ready = await load(bytes, { signal });
        if (signal.aborted || epoch !== generation) { await ready.close(); return false; }
        session = ready; emit({ total: session.document.numPages });
        return true;
      } catch (error) {
        if (epoch === generation && !signal.aborted) emit({ busy: false, errorCode: safeCodes.has(error?.code) || error?.code === 'PDF_VIEWER_FILE_READ_FAILED' ? error.code : 'PDF_DOCUMENT_LOAD_FAILED' });
        return false;
      }
    })();
    const success = await loading;
    return success && epoch === generation ? showPage(initialPage) : false;
  }
  function setZoom(value) {
    if (!Number.isFinite(value)) return Promise.resolve(false);
    emit({ zoom: Math.min(2, Math.max(1, value)) }); return showPage();
  }
  return Object.freeze({ open, close, showPage, setZoom, resize: () => showPage(), getState: () => ({ ...state }) });
}
