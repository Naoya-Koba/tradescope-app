// Anonymous localhost browser QA: ONLY reviewed public precache assets + this harness.
// Never serve arbitrary repository paths, real documents, Backups or hidden files.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),sw=fs.readFileSync(path.join(root,'service-worker.js'),'utf8');
const list=[...sw.match(/const CORE_ASSETS = \[([\s\S]*?)\];/)[1].matchAll(/"([^"]+)"/g)].map(m=>m[1].split('?')[0].replace(/^\.\//,''));
const allowed=new Set([...list.filter(p=>/\.(?:html|js|mjs|css|png|webmanifest|bcmap)$/.test(p)),'tests/cashflow-browser.html','tests/cashflow-browser.js']);
http.createServer((req,res)=>{
 let name;try{name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1)||'index.html';}catch(_){res.writeHead(400);res.end();return;}
 if(!allowed.has(name)||name.includes('..')||name.includes('\\')){res.writeHead(404);res.end();return;}
 const file=path.resolve(root,name);if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 fs.readFile(file,(err,bytes)=>{if(err){res.writeHead(404);res.end();return;}const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.webmanifest':'application/manifest+json'};
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);});
}).listen(58643,'127.0.0.1',()=>console.log('Anonymous allowlisted browser QA on 127.0.0.1:58643'));
