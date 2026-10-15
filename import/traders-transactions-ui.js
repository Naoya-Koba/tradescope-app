(function(root){
  'use strict';
  function createUI({document,service,broker='lightfx'}){
    const $=id=>document.getElementById(broker+'-transactions-'+id);
    let source=null,guard=null,busy=false,opening=false,sequence=0;
    const node=(tag,text)=>{const e=document.createElement(tag);e.textContent=text;return e;};
    function render(result){
      guard=result;$('save').hidden=!source||!result;$('save').disabled=busy;
      $('save').textContent=result?.existing?'取引を再取り込み':'取引を取り込む';
      $('status').textContent=!result?'':`${result.transactionCount}件の取引を確認できます`;
    }
    function clear(){if(busy)return false;sequence++;source=null;guard=null;$('summary').replaceChildren();$('status').textContent='';$('save').hidden=true;if($('dialog').open)$('dialog').close();return true;}
    async function setSource(next){
      if(!clear())return;const token=sequence;if(!next?.preview?.valid)return;
      source=next;try{const result=await service.inspect(next);if(sequence===token)render(result);}
      catch(_){if(sequence===token){guard=null;$('save').hidden=true;$('status').textContent='取引内容を確認できません。PDFと保存内容を確認してください';}}
    }
    $('save').hidden=true;
    $('save').addEventListener('click',async()=>{
      if(busy||opening||!source||!guard||$('dialog').open||document.getElementById(broker+'-file')?.disabled)return;
      opening=true;$('save').disabled=true;
      // Keep the original token: a fresh read must not silently authorize an old preview.
      const token=sequence,old=guard;try{
        const latest=await service.inspect(source);if(token!==sequence)return;
        if(latest.fingerprint!==old.fingerprint){$('status').textContent='保存内容が更新されています。PDFを選び直して確認してください';return;}
        guard=latest;$('summary').replaceChildren(node('dt','対象月'),node('dd',latest.targetMonth.replace('-','/')),node('dt','取引'),node('dd',latest.transactionCount+'件'));
        if(latest.requiresConfirmation)$('summary').append(node('p','同じ月の取引があります。今回のPDFで更新しますか？'));
        $('dialog').showModal();
      }catch(_){$('status').textContent='保存内容を確認できません。PDFを選び直してください';}
      finally{opening=false;$('save').disabled=busy;}
    });
    $('cancel').addEventListener('click',()=>{if(!busy)$('dialog').close();});
    $('dialog').addEventListener('cancel',event=>{if(busy)event.preventDefault();});
    $('confirm').addEventListener('click',async()=>{
      if(busy||!source||!guard||!$('dialog').open||document.getElementById(broker+'-file')?.disabled)return;busy=true;$('save').disabled=true;$('confirm').disabled=true;$('cancel').disabled=true;$('status').textContent='取り込み中…';
      const controls=['file','close','save','swap'].map(id=>document.getElementById(broker+'-'+id)).filter(Boolean).map(e=>({e,disabled:e.disabled}));for(const {e}of controls)e.disabled=true;
      try{const result=await service.save(source,{fingerprint:guard.fingerprint,...(guard.requiresConfirmation?{confirmUpdate:true}:{})});
        $('status').textContent=result.verified?result.unchanged?'保存内容を確認しました':'取引を取り込みました':result.status==='stale'?'保存内容が更新されています。PDFを選び直して確認してください':'現在の取引は変更していません。内容を再確認してください';
        if(result.verified)$('save').hidden=true;
      }catch(_){$('status').textContent='取引を保存できませんでした。保存内容・容量を確認してください';}
      finally{busy=false;for(const {e,disabled}of controls)e.disabled=disabled;$('save').disabled=false;$('confirm').disabled=false;$('cancel').disabled=false;$('dialog').close();}
    });
    return Object.freeze({setSource,clear,isBusy:()=>busy});
  }
  const api={createUI};if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.TradeScopeTradersTransactionsUI=Object.freeze(Object.fromEntries(Object.keys(root.TradeScopeTradersSourcePolicy.configs).map(broker=>[broker,
    createUI({document:root.document,broker,service:root.TradeScopeTradersTransactionsSave.forBroker(broker).createService(root.TradeScopeDataStorage.localStorageAdapter(root.localStorage))})])));
})(typeof globalThis!=='undefined'?globalThis:this);
