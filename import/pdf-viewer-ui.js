(function (root) {
  'use strict';
  const sources = new Map(), $ = id => document.getElementById('pdf-viewer-' + id);
  let viewer, activeKey = null, opening = 0, previousFocus, scrollPosition = 0, resizeTimer;
  const messages = { PDF_INVALID_FILE: 'PDFファイルを確認してください', PDF_VIEWER_FILE_READ_FAILED: 'PDFファイルを読み取れませんでした',
    PDF_WORKER_INIT_FAILED: 'PDFの読み取り処理を開始できませんでした', PDF_DOCUMENT_LOAD_FAILED: 'PDFを開けませんでした。パスワード付きPDFは未対応です',
    PDF_VIEWER_ENGINE_FAILED: 'PDFの表示処理を開始できませんでした', PDF_VIEWER_RENDER_FAILED: 'このページを表示できませんでした' };
  function update(state) {
    $('page').value = state.page || ''; $('page').max = state.total; $('total').textContent = '/ ' + (state.total || '—');
    $('previous').disabled = !state.total || state.page <= 1; $('next').disabled = !state.total || state.page >= state.total;
    $('page').disabled = !state.total; $('zoom-out').disabled = !state.total || state.zoom <= 1; $('zoom-in').disabled = !state.total || state.zoom >= 2;
    $('zoom').textContent = Math.round(state.zoom * 100) + '%';
    $('status').textContent = state.errorCode ? messages[state.errorCode] : state.busy ? '表示中…' : '';
    $('status').dataset.errorCode = state.errorCode || ''; $('dialog').dataset.page = state.page; $('dialog').dataset.total = state.total;
    $('dialog').dataset.busy = String(state.busy);
  }
  function close() {
    ++opening; activeKey = null; clearTimeout(resizeTimer); void viewer?.close();
    if ($('dialog').open) $('dialog').close();
    document.body.classList.remove('pdf-viewer-open'); document.body.style.top = '';
    window.scrollTo(0, scrollPosition); previousFocus?.focus({ preventScroll: true }); previousFocus = null;
  }
  async function openPdfViewer({ source, initialPage = 1, key = null }) {
    if (!(source instanceof Blob)) return;
    if ($('dialog').open) close();
    const current = ++opening; activeKey = key; previousFocus = document.activeElement; scrollPosition = window.scrollY;
    document.body.style.top = '-' + scrollPosition + 'px'; document.body.classList.add('pdf-viewer-open');
    $('dialog').showModal(); $('close').focus(); update({ page: 0, total: 0, zoom: 1, busy: true });
    try {
      if (!viewer) {
        const module = await import('./pdf-viewer.mjs?v=20261012-10');
        if (current !== opening) return;
        viewer = module.createViewer({ createCanvas: () => document.createElement('canvas'), mount: canvas => $('pages').replaceChildren(canvas),
          measure: () => ({ width: Math.max(1, $('pages').clientWidth - 24), pixelRatio: window.devicePixelRatio }), onState: state => { if ($('dialog').open) update(state); } });
      }
      if (current === opening) await viewer.open({ source, initialPage });
    } catch (_) { if (current === opening) update({ page: 0, total: 0, zoom: 1, busy: false, errorCode: 'PDF_VIEWER_ENGINE_FAILED' }); }
  }
  function setSource(key, source) {
    if (activeKey === key) close();
    if (source instanceof Blob) sources.set(key, source); else sources.delete(key);
    const button = document.getElementById(key + '-view-pdf'); if (button) button.hidden = !sources.has(key);
  }
  for (const key of ['gmo', 'lightfx', 'minano']) document.getElementById(key + '-view-pdf').addEventListener('click', () => {
    const source = sources.get(key); if (source) void openPdfViewer({ source, key });
  });
  $('close').addEventListener('click', close);
  $('dialog').addEventListener('cancel', event => { event.preventDefault(); close(); });
  $('previous').addEventListener('click', () => void viewer?.showPage(viewer.getState().page - 1));
  $('next').addEventListener('click', () => void viewer?.showPage(viewer.getState().page + 1));
  $('page').addEventListener('change', () => void viewer?.showPage(Number($('page').value)));
  $('page').addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); void viewer?.showPage(Number($('page').value)); }
  });
  $('zoom-out').addEventListener('click', () => void viewer?.setZoom(viewer.getState().zoom - 0.25));
  $('zoom-in').addEventListener('click', () => void viewer?.setZoom(viewer.getState().zoom + 0.25));
  $('dialog').addEventListener('keydown', event => {
    if (event.target.tagName === 'INPUT') return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); void viewer?.showPage(viewer.getState().page + (event.key === 'ArrowLeft' ? -1 : 1)); }
  });
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); if ($('dialog').open) resizeTimer = setTimeout(() => void viewer?.resize(), 150); });
  window.addEventListener('pagehide', () => { close(); sources.clear(); for (const key of ['gmo', 'lightfx', 'minano']) setSource(key, null); });
  root.TradeScopePdfViewer = Object.freeze({ setSource, openPdfViewer, closePdfViewer: close });
})(typeof globalThis !== 'undefined' ? globalThis : this);
