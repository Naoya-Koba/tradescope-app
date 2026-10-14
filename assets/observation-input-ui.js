(function(root){
  'use strict';
  const node=typeof module!=='undefined'&&module.exports;
  const storage=node?require('./data-model-storage.js'):root.TradeScopeDataStorage;
  const adoption=node?require('./observation-adoption.js'):root.TradeScopeObservationAdoption;
  const save=node?require('./observation-override-save.js'):root.TradeScopeObservationOverrideSave;
  const sourceUI=node?require('./sbivc-source-ui.js'):root.TradeScopeSBIVCSourceUI;
  const selection=node?require('./sbivc-source-selection.js'):root.TradeScopeSBIVCSourceSelection;
  function render({document,adapter,accountId,targetMonth,displayName,accountKey='sbivc',color,onSaved=()=>{},onCancel=()=>{},onSourceDraft=()=>{}}){
    let models;try{models=storage.createRepository(adapter).read();}catch(_){
      const error=document.createElement('div');error.className='account-card';error.textContent='保存された資産・保有情報を確認できませんでした';return error;
    }
    let view=adoption.resolve(models,accountId,targetMonth);
    const controller=selection.createController(adapter);
    if(!view&&!controller.inspect(targetMonth).hasData)return null;
    const service=save.createService(adapter);let editing=false,busy=false;
    try{if(view)view=service.inspect(accountId,targetMonth);}catch(_){view=null;}
    const make=(tag,text,cls)=>{const el=document.createElement(tag);el.textContent=text;if(cls)el.className=cls;return el;};
    const amount=value=>{if(value==null)return'—';const [integer,fraction]=value.split('.');return integer.replace(/\B(?=(\d{3})+(?!\d))/g,',')+(fraction===undefined?'':'.'+fraction);};
    const card=make('div','','account-card');
    const toggle=make('button','','account-toggle'),title=make('div','','account-title'),dot=make('div','','account-color-dot');
    const body=make('div','','account-body');
    toggle.type='button';toggle.dataset.accountToggle=accountKey;toggle.setAttribute('aria-expanded','false');
    body.id=`account-body-${accountKey}`;body.dataset.accountBody=accountKey;toggle.setAttribute('aria-controls',body.id);
    if(color)dot.style.backgroundColor=color;
    title.append(dot,make('span',displayName));toggle.append(title,make('span','▼','account-toggle-icon'));
    const resize=()=>{if(body.classList.contains('open'))body.style.maxHeight=`${body.scrollHeight}px`;};
    const sourcePanel=sourceUI.create({document,adapter,targetMonth,controller,onSaved,onDraft:onSourceDraft,onResize:resize});
    const yen=value=>value===null?'—':amount(value)+'円';
    function draw(){
      body.replaceChildren();
      if(!view){body.append(sourcePanel.element);resize();return;}
      body.append(make('p','資産・保有情報を保存済み','muted'));
      const dl=make('dl','','observation-values');
      for(const[label,value]of[['対象月',targetMonth.replace('-','/')],['基準日',view.snapshot.snapshotAsOf.replaceAll('-','/')]])dl.append(make('dt',label),make('dd',value));
      const controls=[],actions=make('div','','monthly-account-actions'),error=make('p','','sbi-monthly-error');error.setAttribute('role','alert');error.hidden=true;
      function editor(parent,label,value,identity){
        const group=make('div','','form-group'),caption=make('label',label),input=make('input','');
        input.type='text';input.inputMode='decimal';input.className='observation-edit-input';input.id=identity;input.value=value??'';input.placeholder='—';caption.htmlFor=input.id;
        group.append(caption,input);parent.append(group);controls.push(input);return input;
      }
      const accountControls={};
      body.append(dl);
      for(const[field,label]of[['cashBalance','JPY残高'],['assetValue','帳票上の資産合計']]){
        if(editing)accountControls[field]=editor(body,label,view.adopted[field],`observation-${accountKey}-${field}`);
        else dl.append(make('dt',label),make('dd',yen(view.adopted[field])));
      }
      // Metadata stays read-only in either mode.
      const details=make('details',''),active=editing?view.holdings:view.holdings.filter(h=>!/^0(?:\.0+)?$/.test(h.adopted.quantity));
      details.append(make('summary',`現物保有（${active.length}銘柄）`));details.open=editing;
      const holdingControls=[];
      for(const h of active){
        const instrument=models.instruments.records.find(i=>i.id===h.instrumentId),row=make('div','','observation-holding');row.append(make('strong',instrument.displayName));
        if(editing){const values={};for(const[field,label]of[['quantity','数量'],['marketPrice','評価レート'],['marketValue','円換算額']])values[field]=editor(row,label,h.adopted[field],`observation-${h.holdingSnapshotId}-${field}`);
          holdingControls.push({holdingSnapshotId:h.holdingSnapshotId,instrumentId:h.instrumentId,values});}
        else row.append(make('p',`数量 ${amount(h.adopted.quantity)}`),make('p',`円換算額 ${yen(h.adopted.marketValue)}`));
        details.append(row);
      }
      details.addEventListener('toggle',resize);body.append(details);
      if(view.hasOverrides)body.append(make('p','手動補正あり','muted'));
      if(!editing&&view.editable){
        const edit=make('button','修正','monthly-source-reset');edit.type='button';edit.addEventListener('click',()=>{if(sourcePanel.pending())return;editing=true;draw();});actions.append(edit);
      }else if(editing){
        const reset=make('button','PDF値に戻す','monthly-source-reset'),cancel=make('button','キャンセル','monthly-source-reset'),submit=make('button','保存','btn btn-primary monthly-account-save');
        for(const b of[reset,cancel,submit])b.type='button';
        reset.addEventListener('click',()=>{if(busy)return;for(const f of adoption.accountFields)accountControls[f].value=view.source[f]??'';
          for(const h of holdingControls){const original=view.holdings.find(r=>r.holdingSnapshotId===h.holdingSnapshotId);for(const f of adoption.holdingFields)h.values[f].value=original.source[f]??'';}error.hidden=true;resize();});
        cancel.addEventListener('click',()=>{if(busy)return;editing=false;draw();onCancel();});
        submit.addEventListener('click',()=>{
          if(busy)return;busy=true;for(const c of[...controls,reset,cancel,submit])c.disabled=true;
          try{
            const draft={accountId,targetMonth,account:Object.fromEntries(adoption.accountFields.map(f=>[f,accountControls[f].value])),
              holdings:holdingControls.map(h=>({holdingSnapshotId:h.holdingSnapshotId,instrumentId:h.instrumentId,values:Object.fromEntries(adoption.holdingFields.map(f=>[f,h.values[f].value]))}))};
            const result=service.save(draft,{expectedModels:models});
            if(['saved','unchanged'].includes(result.status)){models=result.models;view=service.inspect(accountId,targetMonth);editing=false;draw();onSaved();}
          }catch(_){error.textContent='保存できませんでした。入力値と保存情報を確認してください';error.hidden=false;}
          finally{busy=false;for(const c of[...controls,reset,cancel,submit])c.disabled=false;resize();}
        });
        actions.append(reset,cancel,submit);
      }
      body.append(actions,error);if(!editing)body.append(sourcePanel.element);resize();
    }
    draw();card.append(toggle,body);return card;
  }
  const api=Object.freeze({render});if(node)module.exports=api;else root.TradeScopeObservationInputUI=api;
})(typeof globalThis!=='undefined'?globalThis:this);
