(function(root){
 'use strict';
 const nodeModule=typeof module!=='undefined'&&module.exports;
 const save=nodeModule?require('../assets/manual-metadata-save.js'):root.TradeScopeManualMetadataSave;
 function create({document,storage,onRefresh,strategies=['','キャリー','キャピタルゲイン'],service=save.createService(storage)}){
  let busy=false;
  const node=(tag,text,className)=>{const e=document.createElement(tag);e.textContent=text;if(className)e.className=className;return e;};
  function decorate(row,fragment){
   if(!row.manualMetadata)return;
   const area=node('div','','transaction-metadata'),edit=node('button','メモ・戦略を編集','edit-btn');
   edit.type='button';area.append(edit);fragment.append(area);
   edit.addEventListener('click',()=>{
    if(busy||edit.disabled)return;
    const prepared=service.prepare(row.manualMetadata),status=node('p','','transaction-confirmation-status');
    status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.tabIndex=-1;
    if(prepared.status!=='ready'){
     status.textContent='内容が更新されています。もう一度確認してください';area.replaceChildren(status);
     const review=node('button','再確認','edit-btn');review.type='button';review.addEventListener('click',()=>onRefresh({preserveDetail:true}));area.append(review);return;
    }
    edit.disabled=true;
    const form=node('form','','transaction-metadata-form'),strategy=node('select'),memo=node('textarea');memo.rows=3;
    for(const value of [...new Set([...strategies,prepared.metadata.strategy])]){const option=node('option',value||'なし');option.value=value;strategy.append(option);}
    strategy.value=prepared.metadata.strategy;memo.value=prepared.metadata.memo;
    const strategyLabel=node('label','戦略'),memoLabel=node('label','メモ');strategyLabel.append(strategy);memoLabel.append(memo);
    const actions=node('div','','transaction-confirmation-actions'),submit=node('button','保存','edit-btn'),cancel=node('button','キャンセル','edit-btn');
    submit.type='submit';cancel.type='button';actions.append(submit,cancel);form.append(strategyLabel,memoLabel,status,actions);area.append(form);strategy.focus();
    cancel.addEventListener('click',()=>{if(!busy){area.replaceChildren(edit);edit.disabled=false;edit.focus();}});
    form.addEventListener('submit',async event=>{
     event.preventDefault();if(busy)return;busy=true;submit.disabled=true;cancel.disabled=true;strategy.disabled=true;memo.disabled=true;form.setAttribute('aria-busy','true');status.textContent='保存中…';
     try{
      const result=await service.save({draft:prepared.draft,metadata:{memo:memo.value,strategy:strategy.value}});
      if(['saved','already-current'].includes(result.status)){
       if(onRefresh({preserveDetail:true})!==false)return;
      }
      status.textContent=['changed','broken-reference'].includes(result.status)?'内容が更新されています。もう一度確認してください':'保存できませんでした。もう一度お試しください';
     }catch(_){status.textContent='保存できませんでした。もう一度お試しください';}
     finally{busy=false;submit.disabled=false;cancel.disabled=false;strategy.disabled=false;memo.disabled=false;form.setAttribute('aria-busy','false');}
     const review=node('button','再確認','edit-btn');review.type='button';review.addEventListener('click',()=>onRefresh({preserveDetail:true}));actions.append(review);status.focus();
    });
   });
  }
  return Object.freeze({decorate});
 }
 const api=Object.freeze({create});if(nodeModule)module.exports=api;else root.TradeScopeManualMetadataUI=api;
})(typeof globalThis!=='undefined'?globalThis:this);
