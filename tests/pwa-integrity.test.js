const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
test('precache has no missing/duplicate resources and all major local HTML script/style versions match', () => {
  const sw = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
  const urls = [...sw.match(/const CORE_ASSETS = \[([\s\S]*?)\];/)[1].matchAll(/"([^"]+)"/g)].map(m => m[1]);
  assert.equal(new Set(urls).size, urls.length);
  const paths = urls.map(u => u.split('?')[0]); assert.equal(new Set(paths).size, paths.length);
  for (const url of urls) assert.ok(fs.existsSync(path.join(root, url.split('?')[0])), url);
  for (const file of ['index.html', 'import.html', 'history.html', 'profit/soneki.html']) {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    for (const match of html.matchAll(/(?:src|href)="([^"#]+\.(?:js|mjs|css)(?:\?[^"#]*)?)"/g)) {
      if (/^https?:/.test(match[1])) continue;
      const [name, query] = match[1].split('?');
      const relative = './' + path.relative(root, path.resolve(root, path.dirname(file), name)).replace(/\\/g, '/');
      assert.ok(urls.includes(relative + (query ? '?' + query : '')), `${file}: ${match[1]}`);
    }
  }
  assert.match(sw, /caches\.match\(event\.request, \{ ignoreSearch: true \}\)/);
});
