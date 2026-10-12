const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
class Element {
 constructor(tag='DIV'){this.tagName=tag;this.listeners={};this.hidden=true;this.disabled=false;this.open=false;this.style={};this.dataset={};this.value='';this.children=[];this.focused=0;}
 addEventListener(k,f){(this.listeners[k]||=[]).push(f);}async fire(k,e={}){for(const f of this.listeners[k]||[])await f({target:this,preventDefault(){},...e});}
 focus(){this.focused++;}showModal(){this.open=true;}close(){this.open=false;}replaceChildren(...c){this.children=c;}
}
function harness({loadError=false}={}){
 const elements={},classes=new Set(),focus=new Element('BUTTON'),body={style:{},classList:{add:c=>classes.add(c),remove:c=>classes.delete(c)}};
 const doc={body,activeElement:focus,getElementById:id=>elements[id]||=new Element(id==='pdf-viewer-page'?'INPUT':'DIV'),createElement:tag=>new Element(tag.toUpperCase())};
 const calls=[],scrolls=[],events={},file=new Blob(['%PDF-1.7 anonymous']);let state={page:1,total:39,zoom:1,busy:false},onState;
 const controller={getState:()=>state,close:async()=>calls.push(['close']),open:async options=>{calls.push(['open',options]);onState(state);},showPage:async p=>{calls.push(['page',p]);state={...state,page:p};onState(state);},setZoom:async z=>{calls.push(['zoom',z]);state={...state,zoom:z};onState(state);},resize:async()=>calls.push(['resize'])};
 const module={createViewer:options=>{onState=options.onState;return controller;}};
 const context={document:doc,window:{scrollY:150,devicePixelRatio:2,scrollTo:(...p)=>scrolls.push(p),addEventListener:(k,f)=>events[k]=f},Blob,setTimeout,clearTimeout,fakeModule:module};
 let code=fs.readFileSync(require.resolve('../import/pdf-viewer-ui.js'),'utf8').replace("await import('./pdf-viewer.mjs?v=20261012-10')",loadError?"await Promise.reject(new Error('PRIVATE_PATH'))":"fakeModule");
 vm.runInNewContext(code,context);const ui=context.TradeScopePdfViewer;
 return {ui,e:doc.getElementById,calls,classes,body,focus,scrolls,events,file};
}
const tick=()=>new Promise(r=>setImmediate(r));
test('shared source links exist only in memory; open/close restores focus and scroll without changing inputs',async()=>{
 const h=harness();h.e('lightfx-swap').value='';h.ui.setSource('lightfx',h.file);assert.equal(h.e('lightfx-view-pdf').hidden,false);
 await h.e('lightfx-view-pdf').fire('click');await tick();assert.equal(h.e('pdf-viewer-dialog').open,true);assert.ok(h.classes.has('pdf-viewer-open'));
 assert.equal(h.calls.find(c=>c[0]==='open')[1].source,h.file);assert.equal(h.e('lightfx-swap').value,'');await h.e('pdf-viewer-close').fire('click');
 assert.equal(h.e('pdf-viewer-dialog').open,false);assert.equal(h.classes.size,0);assert.equal(h.focus.focused,1);assert.deepEqual(h.scrolls,[[0,150]]);assert.equal(h.e('lightfx-view-pdf').hidden,false);
});
test('Viewer controls/page jump/arrows/zoom operate on shared controller; input arrows remain native',async()=>{
 const h=harness();await h.ui.openPdfViewer({source:h.file,initialPage:5});assert.equal(h.calls.find(c=>c[0]==='open')[1].initialPage,5);
 await h.e('pdf-viewer-next').fire('click');await h.e('pdf-viewer-previous').fire('click');h.e('pdf-viewer-page').value='20';await h.e('pdf-viewer-page').fire('change');
 await h.e('pdf-viewer-zoom-in').fire('click');await h.e('pdf-viewer-zoom-out').fire('click');
 await h.e('pdf-viewer-dialog').fire('keydown',{key:'ArrowRight'});const before=h.calls.length;await h.e('pdf-viewer-dialog').fire('keydown',{target:h.e('pdf-viewer-page'),key:'ArrowLeft'});assert.equal(h.calls.length,before);
 assert.ok(h.calls.some(c=>c[0]==='page'&&c[1]===20));assert.ok(h.calls.some(c=>c[0]==='zoom'));h.ui.closePdfViewer();
});
test('page number can be committed with Enter without losing the import form',async()=>{
 const h=harness();await h.ui.openPdfViewer({source:h.file});h.e('pdf-viewer-page').value='39';
 await h.e('pdf-viewer-page').fire('keydown',{key:'Enter'});assert.deepEqual(h.calls.at(-1),['page',39]);h.ui.closePdfViewer();
});
test('replacing active source closes old Viewer and reopening uses only replacement; pagehide drops sources',async()=>{
 const h=harness();h.ui.setSource('gmo',h.file);await h.e('gmo-view-pdf').fire('click');await tick();const other=new Blob(['%PDF-1.7 other anonymous']);h.ui.setSource('gmo',other);
 assert.equal(h.e('pdf-viewer-dialog').open,false);await h.e('gmo-view-pdf').fire('click');await tick();assert.equal(h.calls.filter(c=>c[0]==='open').at(-1)[1].source,other);
 h.events.pagehide();assert.equal(h.e('gmo-view-pdf').hidden,true);assert.equal(h.e('pdf-viewer-dialog').open,false);
});
test('ESC/cancel closes Viewer only; engine failure exposes no source exception and remains closable',async()=>{
 const h=harness({loadError:true});await h.ui.openPdfViewer({source:h.file});assert.equal(h.e('pdf-viewer-status').dataset.errorCode,'PDF_VIEWER_ENGINE_FAILED');assert.doesNotMatch(h.e('pdf-viewer-status').textContent,/PRIVATE|PATH/);
 await h.e('pdf-viewer-dialog').fire('cancel');assert.equal(h.e('pdf-viewer-dialog').open,false);
});
