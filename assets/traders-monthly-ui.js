(function(root){
 'use strict';
 function createController({adapter,onSaved}){
  const services=new Map(),drafts=new Map();const fields=[['realizedPnl','決済損益'],['swapPnl','スワップ損益'],['unrealizedPnl','評価損益'],['deposit','入金'],['withdrawal','出金']];
  function renderCard(account,targetMonth,label){
   const key=account.key,token=key+targetMonth;if(!services.has(key))services.set(key,root.TradeScopeTradersSave.createService(adapter,key));const service=services.get(key);
   const node=(tag,text,cls)=>{const e=document.createElement(tag);e.textContent=text??'';if(cls)e.className=cls;return e;};
   const card=node('div','','account-card'),toggle=node('button','','account-toggle');toggle.type='button';toggle.dataset.accountToggle=key;toggle.setAttribute('aria-expanded','false');
   const title=node('div','','account-title'),dot=node('div','','account-color-dot');dot.style.backgroundColor=account.color;title.append(dot,node('span',label));toggle.append(title,node('span','▼','account-toggle-icon'));card.append(toggle);
   const body=node('div','','account-body');body.dataset.accountBody=key;card.append(body);let prepared=null;try{prepared=service.monthlyInspect(targetMonth);}catch(_){}
   if(!drafts.has(token))drafts.set(token,{...(prepared?.adopted||{})});const draft=drafts.get(token),controls={};
   for(const[field,label]of fields){const group=node('div','','form-group'),caption=node('label',label),input=node('input');input.type='text';input.inputMode='decimal';input.className='input-traders-draft';input.id=`${key}-draft-${field}`;input.dataset.field=field;input.value=draft[field]??'';input.placeholder='—';input.disabled=!prepared;caption.htmlFor=input.id;group.append(caption,input,node('span','¥','suffix'));body.append(group);controls[field]=input;
    if(field==='swapPnl')body.append(node('p','収益カレンダー「スワップ付与」月間合計','monthly-source-note'));
   }
   const reset=node('button','元の入力値に戻す','monthly-source-reset');reset.type='button';const actions=node('div','','monthly-account-actions'),save=node('button','保存','btn btn-primary btn-block monthly-account-save');save.type='button';
   const error=node('p','','sbi-monthly-error');error.setAttribute('role','alert');let busy=false;
   function refresh(){save.disabled=busy||!prepared;save.textContent=busy?'保存中…':'保存';reset.hidden=!prepared||fields.every(([f])=>draft[f]===prepared.source[f]);error.hidden=!error.textContent;if(body.classList.contains('open'))body.style.maxHeight=`${body.scrollHeight}px`;}
   for(const[field]of fields)controls[field].addEventListener('input',()=>{draft[field]=controls[field].value;error.textContent='';refresh();});
   reset.addEventListener('click',()=>{if(busy||!prepared)return;Object.assign(draft,prepared.source);for(const[f]of fields)controls[f].value=draft[f]??'';error.textContent='';refresh();});
   save.addEventListener('click',()=>{if(busy||!prepared)return;busy=true;refresh();try{const result=service.correct({...draft,targetMonth},{expectedModels:prepared.models});if(['saved','unchanged'].includes(result.status)){drafts.delete(token);onSaved(key);}}catch(_){error.textContent='保存できませんでした。入力値と保存データを確認してください';}finally{busy=false;refresh();}});
   if(!prepared){error.textContent='この月の月次PDFを取り込んでください';const link=node('a','データ取込');link.href='../import.html';body.append(link);}
   actions.append(save);body.append(reset,actions,error);refresh();return card;
  }
  return Object.freeze({renderCard});
 }
 root.TradeScopeTradersMonthlyUI=Object.freeze({createController});
})(typeof globalThis!=='undefined'?globalThis:this);
