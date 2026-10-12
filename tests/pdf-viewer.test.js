// Invented PDFs/state only. No private files, production origin or persistent writes.
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
let modulePromise;
const viewerModule = () => {
  globalThis.DOMMatrix ||= class {}; globalThis.Path2D ||= class {}; globalThis.ImageData ||= class {};
  return modulePromise ||= import('../import/pdf-viewer.mjs');
};
function setup({ total = 39, delayed = false, failLoad = false, failRender = false } = {}) {
  const stats = { pages: [], canvases: [], closed: 0, cleaned: 0, cancelled: 0, completed: [], mounted: [], loads: [] }, tasks = [];
  const load = async (bytes, options) => {
    stats.loads.push({ bytes, options });
    if (failLoad) throw Object.assign(new Error('PRIVATE_NAME PRIVATE_PDF_TEXT'), { code: 'PDF_DOCUMENT_LOAD_FAILED' });
    return { close: async () => { stats.closed++; }, document: { numPages: total, getPage: async number => {
      stats.pages.push(number);
      return { getViewport: ({ scale }) => ({ width: 600 * scale, height: 840 * scale }), cleanup: () => { stats.cleaned++; }, render: () => {
        let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; });
        const task = { promise, finish: () => { stats.completed.push(number); resolve(); }, cancel: () => { stats.cancelled++; reject(new Error('PRIVATE_RENDER_CANCEL')); } }; tasks.push(task);
        if (failRender) reject(new Error('PRIVATE_SOURCE_FONT')); else if (!delayed) task.finish(); return task;
      } };
    } } };
  };
  const createCanvas = () => { const canvas = { width: 0, height: 0, style: {}, remove: () => { stats.mounted = stats.mounted.filter(c => c !== canvas); }, getContext: () => ({}) }; stats.canvases.push(canvas); return canvas; };
  return { stats, tasks, options: { load, createCanvas, mount: c => { stats.mounted = [c]; }, measure: () => ({ width: 342, pixelRatio: 3 }) } };
}
const source = () => new Blob(['%PDF-1.7 anonymous']);
const tick = () => new Promise(resolve => setImmediate(resolve));
test('Viewer valid source renders only physical page 1 of 39, not all pages', async () => {
  const h = setup(), viewer = (await viewerModule()).createViewer(h.options); await viewer.open({ source: source() });
  assert.deepEqual(h.stats.pages, [1]); assert.equal(viewer.getState().total, 39); assert.equal(viewer.getState().busy, false);
  assert.equal(h.stats.mounted.length, 1); assert.ok(h.stats.canvases[0].width >= 683 && h.stats.canvases[0].width <= 684); await viewer.close();
});
test('next/previous/jump and both boundaries stay one-based and lazy', async () => {
  const h = setup(), v = (await viewerModule()).createViewer(h.options); await v.open({ source: source() });
  for (const p of [2, 1, 20, 39, 99, 0]) await v.showPage(p);
  assert.deepEqual(h.stats.pages, [1, 2, 1, 20, 39, 39, 1]); assert.equal(h.stats.mounted.length, 1);
  assert.ok(h.stats.canvases.slice(0, -1).every(c => c.width === 0 && c.height === 0)); await v.close();
});
for (const [initialPage, expected] of [[undefined, 1], [5, 5], [-3, 1], [100, 39], ['bad', 1]]) test(`initialPage ${initialPage} safely selects ${expected}`, async () => {
  const h = setup(), v = (await viewerModule()).createViewer(h.options); await v.open({ source: source(), initialPage });
  assert.deepEqual(h.stats.pages, [expected]); await v.close();
});
test('close/reopen/source replacement destroys sessions and frees all former canvas backing stores', async () => {
  const h = setup(), v = (await viewerModule()).createViewer(h.options), a = source(), b = source();
  await v.open({ source: a }); await v.close(); assert.equal(h.stats.closed, 1); assert.equal(h.stats.mounted.length, 0);
  await v.open({ source: a, initialPage: 20 }); await v.open({ source: b, initialPage: 39 }); await v.close();
  assert.equal(h.stats.closed, 3); assert.ok(h.stats.canvases.every(c => c.width === 0 && c.height === 0)); assert.equal(v.getState().open, false);
});
test('rapid next/next/previous cancels stale render and mounts only the requested page', async () => {
  const h = setup({ delayed: true }), v = (await viewerModule()).createViewer(h.options), initial = v.open({ source: source() }); await tick();
  h.tasks[0].finish(); await initial;
  const next = v.showPage(2); await tick(); const nextAgain = v.showPage(3), previous = v.showPage(2); await tick();
  h.tasks.at(-1).finish(); await Promise.all([next, nextAgain, previous]);
  assert.equal(v.getState().page, 2); assert.equal(v.getState().busy, false); assert.equal(v.getState().errorCode, null);
  assert.ok(h.stats.cancelled >= 1); assert.equal(h.stats.mounted.length, 1); await v.close();
});
test('close while rendering cancels pending work and does not revive canvas/state', async () => {
  const h = setup({ delayed: true }), v = (await viewerModule()).createViewer(h.options), opening = v.open({ source: source() }); await tick();
  await v.close(); await opening; assert.equal(h.stats.mounted.length, 0); assert.equal(v.getState().open, false); assert.equal(h.stats.closed, 1);
});
test('close during File read prevents document creation and source replacement uses only the new file', async () => {
  const h = setup(), v = (await viewerModule()).createViewer(h.options), blob = source(); let done;
  blob.arrayBuffer = () => new Promise(resolve => { done = resolve; }); const old = v.open({ source: blob }); await tick();
  const closing = v.close(); done(new ArrayBuffer(20)); await closing; await old;
  assert.equal(h.stats.loads.length, 0); await v.open({ source: source() }); assert.equal(h.stats.loads.length, 1); await v.close();
});
test('load/render/file failures contain only controlled diagnostics and remain closable', async () => {
  for (const options of [{ failLoad: true }, { failRender: true }]) {
    const h = setup(options), v = (await viewerModule()).createViewer(h.options); await v.open({ source: source() });
    assert.equal(v.getState().errorCode, options.failLoad ? 'PDF_DOCUMENT_LOAD_FAILED' : 'PDF_VIEWER_RENDER_FAILED');
    assert.doesNotMatch(JSON.stringify(v.getState()), /PRIVATE|NAME|SOURCE/); await v.close(); assert.equal(h.stats.mounted.length, 0);
  }
  const h = setup(), v = (await viewerModule()).createViewer(h.options), blob = source(); blob.arrayBuffer = async () => { throw new Error('PRIVATE_PATH'); };
  await v.open({ source: blob }); assert.equal(v.getState().errorCode, 'PDF_VIEWER_FILE_READ_FAILED'); assert.equal(h.stats.loads.length, 0); await v.close();
  await v.open({ source: 'https://example.invalid/private.pdf' }); assert.equal(v.getState().errorCode, 'PDF_INVALID_FILE'); await v.close();
});
test('canvas pixel/side/DPR limits and 100%-200% fit-width zoom remain bounded', async () => {
  const module = await viewerModule(), size = module.canvasSize({ width: 600, height: 20000 }, 1280, 2, 3);
  assert.ok(size.width * size.height <= 4000000); assert.ok(size.width <= 4096 && size.height <= 4096);
  const h = setup(), v = module.createViewer(h.options); await v.open({ source: source() }); await v.setZoom(9);
  assert.equal(v.getState().zoom, 2); await v.setZoom(-1); assert.equal(v.getState().zoom, 1); await v.resize(); await v.close();
});
test('Viewer modules cannot persist/log/submit PDF data or embed provider parsers', () => {
  for (const file of ['pdf-viewer.mjs', 'pdf-viewer-ui.js']) {
    const code = fs.readFileSync(require.resolve('../import/' + file), 'utf8');
    assert.doesNotMatch(code, /localStorage|sessionStorage|indexedDB|caches\.|console\.|fetch\(|XMLHttpRequest|WebSocket|sendBeacon|createObjectURL|\.commit\(|TradeScopeGMOParser|TradeScopeTradersParser|innerHTML/);
  }
  const html = fs.readFileSync(require.resolve('../import.html'), 'utf8');
  for (const broker of ['gmo', 'lightfx', 'minano']) assert.match(html, new RegExp(`id="${broker}-view-pdf"[^>]*hidden>PDF原本を確認`));
  assert.match(html, /aria-labelledby="pdf-viewer-title"/); assert.match(html, /aria-label="ページ番号"/);
  assert.doesNotMatch(fs.readFileSync(require.resolve('../history.html'), 'utf8'), /pdf-viewer|view-pdf/);
  const css = fs.readFileSync(require.resolve('../import/pdf-viewer.css'), 'utf8'); assert.match(css, /safe-area-inset/); assert.match(css, /100dvh/);
});
module.exports = { setup, viewerModule };
