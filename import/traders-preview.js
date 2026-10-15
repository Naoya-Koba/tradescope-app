(function(){
 'use strict';
 const parser=TradeScopeTradersParser;
 const amount=v=>v==null?'—':v.replace(/\B(?=(\d{3})+(?!\d))/g,',')+'円';
 const messages={TRADERS_WRONG_PRODUCT:'選択した口座と異なる月次PDFです',TRADERS_DOCUMENT_NOT_RECOGNIZED:'対応する月次報告書として認識できませんでした',TRADERS_PERIOD_INVALID:'作成基準月を読み取れませんでした',TRADERS_SECTION_MISSING:'必要な明細を確認できませんでした',TRADERS_POSITION_INVALID:'建玉の必要項目を読み取れませんでした',TRADERS_REQUIRED_VALUE_MISSING:'必要な月次項目を読み取れませんでした',TRADERS_UNSUPPORTED_FEE:'手数料がある報告書には未対応です',TRADERS_UNSUPPORTED_OTHER:'その他の金額がある報告書には未対応です',TRADERS_UNSUPPORTED_UNSETTLEDAMOUNT:'未受渡金額がある報告書には未対応です'};
 const node=(tag,text,cls)=>{const e=document.createElement(tag);e.textContent=text??'';if(cls)e.className=cls;return e;};
 for(const broker of Object.keys(parser.products)){
  const $=id=>document.getElementById(`${broker}-${id}`);let source=null,service=null,outcome=null,controller=null,token=0,busy=false,opening=false,confirmation=null;
  const api=()=>service??=TradeScopeTradersSave.createService(TradeScopeDataStorage.localStorageAdapter(localStorage),broker);
  function renderSave(){const correction=outcome?.status==='review-required'&&outcome.reason==='different-report';
   if(correction&&outcome.calendarSwap!==null)$('swap').value=outcome.calendarSwap;
   $('save').hidden=!source?.preview.valid||!(outcome?.status==='ready'||correction);$('save').disabled=busy||opening;$('save').textContent=correction?'訂正する':'保存';
   $('save-status').textContent=busy?'保存中…':['saved','already-imported'].includes(outcome?.status)?'保存済み':correction?'同じ月の報告書が保存されています':outcome?.status==='missing-swap'?'':outcome?.reason==='legacy'?'この月には従来入力が保存されています':outcome?.reason==='instrument'?'同じ通貨ペアの銘柄が複数あります':outcome?.status==='conflict'?'保存データを確認してください':'';
   for(const id of ['file','close','swap','confirm-save','cancel-save'])$(id).disabled=busy;
   $('swap').disabled=busy||['saved','already-imported'].includes(outcome?.status)||(correction&&outcome.calendarSwap!==null);
  }
  function clear(){if(busy||broker==='lightfx'&&globalThis.TradeScopeLightTransactionsUI?.isBusy())return;if(broker==='lightfx')globalThis.TradeScopeLightTransactionsUI?.clear();globalThis.TradeScopePdfViewer?.setSource(broker,null);token++;controller?.abort();controller=null;source=null;outcome=null;confirmation=null;if($('dialog').open)$('dialog').close();$('preview').hidden=true;$('summary').replaceChildren();$('issues').replaceChildren();$('file').value='';$('swap').value='';$('read-status').textContent='';$('cancel-read').hidden=true;delete $('read-status').dataset.stage;delete $('read-status').dataset.errorCode;renderSave();}
  async function inspect(){if(!source)return;source={...source,calendarSwap:$('swap').value};const selected=source;try{const next=await api().inspect(selected);if(source===selected){outcome=next;renderSave();}}catch(_){if(source===selected){outcome=null;$('issues').replaceChildren(node('p','入力値と保存データを確認してください','issue error'));renderSave();}}}
  $('swap').addEventListener('input',()=>{if(busy)return;confirmation=null;$('issues').replaceChildren();void inspect();});
  $('file').addEventListener('change',async event=>{
   const file=event.target.files[0];if(!file)return;clear();const current=token;controller=new AbortController();const signal=controller.signal;$('read-status').textContent='解析中…';$('cancel-read').hidden=false;let stage='file',code='PDF_FILE_READ_FAILED';
   try{if(file.size>20*1024*1024){code='PDF_INVALID_FILE';throw Error();}const bytes=new Uint8Array(await file.arrayBuffer());code='PDF_FILE_HASH_FAILED';const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
    stage='engine';code='PDF_ENGINE_LOAD_FAILED';const extractor=await import('./pdf-extractor.mjs?v=20261012-10');stage='document';code='PDF_DOCUMENT_LOAD_FAILED';
    const extracted=await extractor.extract(bytes,{signal,onProgress:(page,total)=>{if(token===current)$('read-status').textContent=`解析中… ${page}/${total}`;},onDiagnostic:d=>{if(token===current){$('read-status').dataset.stage=d.stage;$('read-status').dataset.errorCode=d.code;}}});
    if(current!==token)return;globalThis.TradeScopePdfViewer?.setSource(broker,file);stage='parser';code='TRADERS_PARSE_FAILED';const p=parser.parse(extracted,broker);$('preview').hidden=false;
    const metrics=[['対象月',p.targetMonth?.replace('-','/')??'—'],['月末日',p.snapshotAsOf?.replaceAll('-','/')??'—'],['決済損益',amount(p.values.realizedPnl)],['評価損益',amount(p.values.unrealizedPnl)],['入金',amount(p.values.deposit)],['出金',amount(p.values.withdrawal)],['預託証拠金残高',amount(p.values.cashBalance)],['純資産額',amount(p.values.netAssetValue)],['必要証拠金',amount(p.values.requiredMargin)]];
    for(const[label,value]of metrics)$('summary').append(node('dt',label),node('dd',value));
    for(const issue of p.errors){const product=issue==='TRADERS_WRONG_PRODUCT'?parser.products[p.broker]?.name:null;
      $('issues').append(node('p',`${product?`このPDFは${product}の月次報告書です。${parser.products[broker].name}としては取り込めません。`:messages[issue]||'PDF内の読取値・合計が一致しません'}（${issue}）`,'issue error'));}
    if(broker==='lightfx'&&globalThis.TradeScopeLightTransactionsUI)await globalThis.TradeScopeLightTransactionsUI.setSource({preview:parser.parseExecutions(extracted,'lightfx'),fileHash:hash,fileSize:file.size});
    if(current!==token)return;
    const transactionOnlyMonth=broker==='lightfx'&&p.targetMonth<'2026-09';
    $('swap-group').hidden=!p.valid||transactionOnlyMonth;
    if(!p.valid){$('read-status').dataset.stage='validation';$('read-status').dataset.errorCode=p.errors[0];return;}
    source={preview:p,fileHash:hash,fileSize:file.size,calendarSwap:''};if(transactionOnlyMonth){outcome=null;renderSave();}else await inspect();if(current===token){$('read-status').dataset.stage='preview';$('read-status').dataset.errorCode='TRADERS_PREVIEW_READY';}
   }catch(failure){if(current===token&&!signal.aborted){if(['PDF_INVALID_FILE','PDF_WORKER_INIT_FAILED','PDF_DOCUMENT_LOAD_FAILED','PDF_TEXT_EXTRACTION_FAILED'].includes(failure?.code)){code=failure.code;stage=failure.stage;}$('read-status').dataset.stage=stage;$('read-status').dataset.errorCode=code;source=null;outcome=null;$('preview').hidden=false;$('swap-group').hidden=true;$('issues').replaceChildren(node('p',`PDFを読み取れませんでした（${code}）`,'issue error'));renderSave();}}
   finally{if(current===token){controller=null;$('read-status').textContent='';$('cancel-read').hidden=true;}}
  });
  $('close').addEventListener('click',clear);$('cancel-read').addEventListener('click',clear);$('provider').addEventListener('toggle',()=>{if(!$('provider').open)clear();});
  window.addEventListener('pagehide',clear);
  $('save').addEventListener('click',async()=>{if(busy||opening||$('dialog').open||!source?.preview.valid)return;opening=true;renderSave();const selected=source;try{const next=await api().inspect(selected);if(selected!==source)return;outcome=next;renderSave();const correction=outcome.status==='review-required'&&outcome.reason==='different-report';if(outcome.status!=='ready'&&!correction)return;confirmation=correction?{stateId:outcome.stateId,inputId:outcome.inputId,adoptedSnapshotId:outcome.adoptedSnapshotId,calendarSwap:outcome.calendarSwap}:{};
    if(outcome.sourceFingerprint)confirmation.sourceFingerprint=outcome.sourceFingerprint;
    $('confirm-summary').replaceChildren();for(const[label,value]of [['対象月',source.preview.targetMonth.replace('-','/')],['スワップ損益',amount(correction?outcome.calendarSwap:TradeScopeTradersSave.calendarValue(source.calendarSwap))]])$('confirm-summary').append(node('dt',label),node('dd',value));
    if(correction&&['lightfx','minano'].includes(broker))$('confirm-summary').append(node('p','訂正版を候補として追加します。現在の採用・月次flowは維持し、残高sourceは月次Inputで選択できます。'));
    $('confirm-save').textContent=correction?'訂正して保存':'保存';$('dialog').showModal();
   }catch(_){$('issues').replaceChildren(node('p','保存データを確認できません','issue error'));}finally{opening=false;renderSave();}});
  $('cancel-save').addEventListener('click',()=>{if(!busy)$('dialog').close();});$('dialog').addEventListener('cancel',event=>{if(busy)event.preventDefault();});
  $('confirm-save').addEventListener('click',async()=>{if(busy||!$('dialog').open||!source||confirmation===null)return;busy=true;renderSave();try{outcome=await api().save(source,confirmation);}catch(_){outcome=null;$('issues').replaceChildren(node('p','保存できませんでした。入力値・容量・保存権限を確認してください','issue error'));}finally{busy=false;confirmation=null;$('dialog').close();renderSave();}});
 }
})();
