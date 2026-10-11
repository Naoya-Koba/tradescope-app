(function(root){
  'use strict';
  function createController({adapter,onSaved}){
    const service=root.TradeScopeGmoMonthlySave.createService(adapter),drafts=new Map();
    const uiFields=[['realizedPnl','決済損益'],['swapPnl','スワップ損益'],['unrealizedPnl','評価損益'],['deposit','入金'],['withdrawal','出金']];
    function renderCard(account,targetMonth,label){
      const card=document.createElement('div');card.className='account-card';
      card.innerHTML='<button type="button" class="account-toggle" data-account-toggle="gmo" aria-expanded="false"><div class="account-title"><div class="account-color-dot"></div><span class="monthly-account-label"></span></div><span class="account-toggle-icon">▼</span></button><div class="account-body" data-account-body="gmo"></div>';
      card.querySelector('.monthly-account-label').textContent=label;card.querySelector('.account-color-dot').style.backgroundColor=account.color;
      const body=card.querySelector('.account-body');let prepared=null;
      try{prepared=service.inspect(targetMonth);}catch(_){}
      if(!drafts.has(targetMonth))drafts.set(targetMonth,{...(prepared?.adopted||{})});
      const draft=drafts.get(targetMonth),controls={};
      for(const[field,title]of uiFields){
        const group=document.createElement('div');group.className='form-group';
        const caption=document.createElement('label'),input=document.createElement('input'),suffix=document.createElement('span');
        input.id=`gmo-draft-${field}`;input.type='text';input.inputMode='decimal';input.className='input-gmo-draft';input.dataset.field=field;
        input.value=draft[field]??'';input.placeholder='—';input.disabled=!prepared;
        caption.htmlFor=input.id;caption.textContent=title;suffix.className='suffix';suffix.textContent='¥';
        group.append(caption,input,suffix);body.appendChild(group);controls[field]=input;
      }
      const reset=document.createElement('button');reset.type='button';reset.className='monthly-source-reset';reset.textContent='取込値に戻す';
      const actions=document.createElement('div');actions.className='monthly-account-actions';
      const button=document.createElement('button');button.type='button';button.className='btn btn-primary btn-block monthly-account-save';button.textContent='保存';
      const status=document.createElement('span');status.className='sbi-monthly-status';status.setAttribute('role','status');
      const error=document.createElement('p');error.className='sbi-monthly-error';error.setAttribute('role','alert');
      let busy=false,failed=false;
      function refresh(){
        const unchanged=prepared&&uiFields.every(([field])=>draft[field]===prepared.adopted[field]);
        button.disabled=busy||!prepared;button.hidden=Boolean(unchanged&&!failed);
        status.textContent=busy?'保存中…':unchanged&&!failed?'保存済み':'';
        reset.hidden=!prepared||uiFields.every(([field])=>draft[field]===prepared.source[field]);
        error.hidden=!error.textContent;if(body.classList.contains('open'))body.style.maxHeight=`${body.scrollHeight}px`;
      }
      for(const[field]of uiFields)controls[field].addEventListener('input',()=>{draft[field]=controls[field].value;failed=false;error.textContent='';refresh();});
      reset.addEventListener('click',()=>{if(busy||!prepared)return;Object.assign(draft,prepared.source);for(const[field]of uiFields)controls[field].value=draft[field];failed=false;error.textContent='';refresh();});
      button.addEventListener('click',()=>{
        if(busy||!prepared||button.hidden)return;busy=true;refresh();
        try{const result=service.save({...draft,targetMonth},{expectedModels:prepared.models});
          if(['saved','unchanged'].includes(result.status)){drafts.delete(targetMonth);onSaved('gmo');}}
        catch(_){failed=true;error.textContent='保存できませんでした。入力値と保存データを確認してください';}
        finally{busy=false;refresh();}
      });
      if(!prepared){error.textContent='この月のGMO月次報告書を取り込んでください';const link=document.createElement('a');link.href='../import.html';link.textContent='データ取込';body.appendChild(link);}
      actions.append(button,status);body.append(reset,actions,error);refresh();return card;
    }
    return Object.freeze({renderCard});
  }
  root.TradeScopeGmoMonthlyUI=Object.freeze({createController});
})(typeof globalThis!=='undefined'?globalThis:this);
