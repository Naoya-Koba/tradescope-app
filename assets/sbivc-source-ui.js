(function(root){
  'use strict';
  const node=typeof module!=='undefined'&&module.exports;
  const selection=node?require('./sbivc-source-selection.js'):root.TradeScopeSBIVCSourceSelection;
  const labels={adopted:'採用済み',compatibility:'既存互換sourceを採用中',missing:'未取得',unresolved:'採用判断待ち',stale:'データ更新・再確認が必要',conflict:'競合',
    'candidate only':'候補（未採用）',invalid:'参照を確認できません',unsupported:'未対応の入力元'};
  const types={pdf:'PDF',csv:'CSV',manual:'手入力'},fields=[['quantity','数量'],['marketPrice','評価レート'],['marketValue','円換算額']];
  const amount=value=>{if(value===null||value===undefined)return'—';const [whole,fraction]=String(value).split('.');return whole.replace(/\B(?=(\d{3})+(?!\d))/g,',')+(fraction===undefined?'':'.'+fraction);};
  function create({document,adapter,targetMonth,onSaved=()=>{},onDraft=()=>{},onResize=()=>{},controller=selection.createController(adapter)}){
    const make=(tag,text='',cls='')=>{const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;return e;};
    const element=make('details','','sbivc-source-panel');let state=null,pending=null,busy=false;
    const info=make('p','','monthly-source-note');info.setAttribute('role','status');
    function value(parent,metric,data){
      if(metric==='cashBalance'){parent.append(make('p',data===null?'—（未取得）':amount(data)+'円'));return;}
      if(data===null){parent.append(make('p','—（保有集合は未取得）'));return;}
      if(!data.length||data.every(h=>h.quantity!==null&&/^-?0(?:\.0+)?$/.test(h.quantity)))parent.append(make('p','保有なしを確認済み'));
      for(const h of data){
        const name=state.models.instruments?.records.find(i=>i.id===h.instrumentId)?.symbol??'銘柄を確認できません';
        const row=make('div','','observation-holding');row.append(make('strong',name));
        for(const [field,label] of fields)row.append(make('p',`${label} ${amount(h[field])}${field==='quantity'?'':'円'}`));parent.append(row);
      }
    }
    function button(parent,label,handler,disabled=false){const b=make('button',label,'monthly-source-reset');b.type='button';b.disabled=disabled;b.addEventListener('click',handler);parent.append(b);return b;}
    function stage(action){pending=action;onDraft(true);draw();onResize();}
    function save(){
      if(busy||!pending)return;busy=true;
      try{state=controller.perform(state,pending);pending=null;info.textContent='採用・確認情報を保存しました';onDraft(false);draw();onSaved();}
      catch(error){info.textContent=error?.message==='STALE_MONTHLY_SOURCE_DRAFT'?'データが更新されています。表示・選択を保持しています。再確認してください':'採用情報を保存できません。競合・入力元を確認してください';}
      finally{busy=false;onResize();}
    }
    function draw(){
      element.replaceChildren(make('summary','入力元・採用を確認'),info);
      if(!state){element.append(make('p','採用情報を読み取れません。競合・保存データを確認してください'));return;}
      for(const item of state.components){
        const block=make('section','','sbivc-source-component'),current=item.current,title=item.metric==='holdings'?'現物保有集合':'JPY残高';block.append(make('h4',title));
        block.append(make('p',`対象月 ${state.targetMonth} / ${labels[current.status]??current.status}${current.deferred?'（判断保留・前の採用を維持）':''}`));
        block.append(make('p',`現在の入力元 ${current.source?types[current.source.sourceType]:'—'} / 基準日 ${current.asOf??'—'}`));
        if(current.source)block.append(make('p',`採用revision ${current.source.id}`,'sbivc-source-code'));
        value(block,item.metric,current.adoptedValue);
        if(current.hasOverride){const raw=make('details');raw.append(make('summary','補正あり・source原値を確認'));value(raw,item.metric,current.rawValue);block.append(raw);}
        const actions=make('div','','monthly-account-actions');
        button(actions,'現在の採用を継続',()=>stage({metric:item.metric,action:'keep'}),!current.source||['stale','conflict'].includes(current.status));
        button(actions,'今回は判断しない',()=>stage({metric:item.metric,action:'defer'}),state.conflict);block.append(actions);
        if(!item.candidates.length)block.append(make('p','入力元候補なし（未取得）'));
        for(const entry of item.candidates){
          const c=entry.source,detail=make('details','','sbivc-source-candidate');detail.append(make('summary',`${types[c.sourceType]} / ${c.asOf??'基準日未取得'} / ${c.id===current.source?.id?'現在の入力元':labels[entry.status]}`));
          detail.append(make('p',`対象月 ${c.targetMonth} / revision ${c.id}`,'sbivc-source-code'));
          if(c.revisionOf)detail.append(make('p',`訂正版・前revision ${c.revisionOf}`,'sbivc-source-code'));
          value(detail,item.metric,entry.value);
          const comparison=controller.comparison(state,item.metric,c.id),valid=entry.status==='candidate only';
          if(c.id!==current.source?.id){
            detail.append(make('p',`source原値の比較：${{equivalent:'同内容',different:'不一致',incomparable:'比較不能（範囲・基準日・不明値等）'}[comparison.result]}`));
            if(item.metric==='holdings')detail.append(make('p','保有集合は内訳・基準日・原値表記を保守的に比較します','monthly-source-note'));
            if(comparison.confirmation)detail.append(make('p',`比較記録：${comparison.confirmation.status==='stale'?'過去の確認・再確認が必要':{equivalent:'同内容を確認済み',different:'不一致を確認済み',incomparable:'比較不能を記録済み'}[comparison.confirmation.result]} / ${comparison.confirmation.confirmedAt}`));
            if(current.hasOverride)detail.append(make('p','補正後採用値との比較ではありません','monthly-source-note'));
            if(comparison.delta!==null)detail.append(make('p',`原値差（候補 − 現在source） ${amount(comparison.delta)}円`));
            for(const d of comparison.differences){
              const symbol=state.models.instruments?.records.find(i=>i.id===d.instrumentId)?.symbol??'銘柄';
              for(const [field,label] of fields)if(d.before?.[field]!==d.after?.[field])detail.append(make('p',`${symbol} ${label} ${amount(d.before?.[field])} → ${amount(d.after?.[field])}`));
            }
            button(detail,comparison.result==='equivalent'?'同内容を確認':comparison.result==='different'?'不一致を記録':'比較不能を記録',()=>stage({metric:item.metric,action:'compare',candidateId:c.id}),!valid||!current.source);
          }
          button(detail,c.id===current.source?.id&&current.hasOverride?'このsource原値を採用（補正解除）':'このsourceを採用',()=>stage({metric:item.metric,action:'adopt',candidateId:c.id}),!valid||state.conflict);
          detail.addEventListener('toggle',onResize);block.append(detail);
        }
        element.append(block);
      }
      if(pending){
        const review=make('div','','sbivc-source-review');review.append(make('p',`${pending.metric==='holdings'?'現物保有集合':'JPY残高'}：${{adopt:'選択したsource原値へ採用変更（旧revisionの補正は継承しません）',keep:'現在の採用値・同revisionの補正を継続',defer:'判断を保留（既存の有効な採用は維持）',compare:'原値の比較結果のみ記録（採用は変更しません）'}[pending.action]}`));
        button(review,'保存',save);button(review,'選択を取消',()=>{pending=null;onDraft(element.open);draw();onResize();});element.append(review);
      }
      button(element,'最新の入力元を再確認',()=>{
        try{state=controller.inspect(targetMonth);info.textContent='最新情報を再確認しました。選択は保持しています';draw();}catch(_){info.textContent='採用情報を読み取れません';}onResize();
      });
    }
    try{state=controller.inspect(targetMonth);}catch(_){}
    draw();element.addEventListener('toggle',()=>{onDraft(element.open||pending!==null);onResize();});
    return Object.freeze({element,hasData:state?.hasData??true,state:()=>state,pending:()=>pending});
  }
  const api=Object.freeze({create});if(node)module.exports=api;else root.TradeScopeSBIVCSourceUI=api;
})(typeof globalThis!=='undefined'?globalThis:this);
