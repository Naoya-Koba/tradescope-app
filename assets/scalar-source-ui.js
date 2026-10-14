(function(root){
  'use strict';
  const node=typeof module!=='undefined'&&module.exports;
  const labels={adopted:'採用済み',compatibility:'既存互換sourceを採用中',missing:'未取得',unresolved:'採用判断待ち',stale:'更新されています・再確認が必要',conflict:'競合'};
  const types={pdf:'PDF',csv:'CSV',manual:'手入力'};
  const amount=v=>{if(v===null||v===undefined)return'—';const [i,f]=String(v).split('.');return i.replace(/\B(?=(\d{3})+(?!\d))/g,',')+(f===undefined?'':'.'+f)+'円';};
  function create({document,controller,targetMonth,onSaved=()=>{},onDraft=()=>{},onResize=()=>{}}){
    const make=(tag,text='',cls='')=>{const e=document.createElement(tag);e.textContent=text;e.className=cls;return e;};
    const element=make('details','','sbivc-source-panel scalar-source-panel'),status=make('p','','monthly-source-note');status.setAttribute('role','status');
    let state=null,pending=null,form=null;
    const button=(parent,label,run,disabled=false)=>{const b=make('button',label,'monthly-source-reset');b.type='button';b.disabled=disabled;b.addEventListener('click',run);parent.append(b);return b;};
    function stage(action){pending={...action};onDraft(true);draw();onResize();}
    function openForm(targetKey,{revisionOf=null,value='',asOf='',action='create'}={}){form={targetKey,revisionOf,value:value??'',asOf:asOf??'',action};pending=null;onDraft(true);draw();onResize();}
    function save(){
      if(!pending)return;
      try{state=controller.perform(state,pending);pending=null;form=null;status.textContent='入力元・採用情報を保存しました';onDraft(false);draw();onSaved();}
      catch(error){status.textContent=error?.message==='STALE_MONTHLY_SOURCE_DRAFT'?'データが更新されています。入力・選択を保持しています。再確認してください':'保存できません。入力・採用状態を確認してください';}
      onResize();
    }
    function draw(){
      element.replaceChildren(make('summary','入力元・採用を確認'),status);
      if(!state){element.append(make('p','採用情報を読み取れません。保存データを確認してください'));return;}
      if(state.view.whole)element.append(make('p','口座全体観測を採用中です。国内・外国・現金の評価額は追加加算しません。'));
      for(const t of state.components){
        const section=make('section','','sbivc-source-component'),current=t.current;section.append(make('h4',t.label));
        section.append(make('p',`対象月 ${targetMonth} / component ${t.component} / metric ${t.metric} / 通貨 JPY`));
        section.append(make('p',`${current.excludedByWhole?'口座全体観測により合成対象外':labels[current.status]??current.status}${current.deferred?'（判断保留）':''} / 採用値 ${current.excludedByWhole?'—':amount(current.value)}`));
        section.append(make('p',`入力元 ${types[current.source?.sourceType]??'—'} / 基準日 ${current.snapshotAsOf??'—'}`));
        if(current.source)section.append(make('p',`採用revision ${current.source.id} / 原値 ${amount(current.rawValue)}`,'sbivc-source-code'));
        if(current.hasOverride)section.append(make('p',`補正あり / 補正後採用値 ${amount(current.value)}`));
        const validCurrent=current.source&&!current.blocked&&!current.excludedByWhole;
        button(section,'現在の採用を継続',()=>stage({targetKey:t.key,action:'keep'}),!validCurrent);
        button(section,'今回は判断しない',()=>stage({targetKey:t.key,action:'defer'}),current.excludedByWhole);
        button(section,'採用値を補正',()=>openForm(t.key,{value:current.value,asOf:current.snapshotAsOf,action:'override'}),!validCurrent);
        if(controller.manualTargets.some(m=>m.component===t.component&&m.metric===t.metric))button(section,'手入力sourceを作成',()=>openForm(t.key));
        if(!t.candidates.length)section.append(make('p','入力元候補なし（未取得）'));
        for(const c of t.candidates){
          const detail=make('details','','sbivc-source-candidate');detail.append(make('summary',`${types[c.source.sourceType]} / ${c.source.asOf??'基準日未取得'} / ${c.source.id===current.source?.id?'現在の入力元':c.status==='candidate only'?'候補（未採用）':labels[c.status]??c.status}`));
          detail.append(make('p',`revision ${c.source.id} / 原値 ${amount(c.value)}`,'sbivc-source-code'));
          if(c.source.revisionOf)detail.append(make('p',`訂正版 / 前revision ${c.source.revisionOf}`,'sbivc-source-code'));
          const comparison=controller.comparison(state,t.key,c.source.id);
          if(c.source.id!==current.source?.id){
            detail.append(make('p',`原値比較：${{equivalent:'同内容',different:'不一致',incomparable:'比較不能（基準日・範囲・不明値等）'}[comparison.result]}`));
            if(comparison.delta!==null)detail.append(make('p',`差額（候補 − 現在source原値） ${amount(comparison.delta)}`));
            if(comparison.confirmation)detail.append(make('p',`比較記録 ${comparison.confirmation.status==='stale'?'再確認が必要':{equivalent:'同内容確認済み',different:'不一致確認済み',incomparable:'比較不能を記録済み'}[comparison.confirmation.result]} / ${comparison.confirmation.confirmedAt}`));
            button(detail,comparison.result==='equivalent'?'同内容を確認':comparison.result==='different'?'不一致を記録':'比較不能を記録',()=>stage({targetKey:t.key,action:'compare',candidateId:c.source.id}),!validCurrent||c.status!=='candidate only'||!controller.canCompare(current.source,c.source));
          }
          button(detail,current.hasOverride&&current.source?.id===c.source.id?'このsource原値を採用（補正解除）':'このsourceを採用',()=>stage({targetKey:t.key,action:'adopt',candidateId:c.source.id}),c.status!=='candidate only'||current.excludedByWhole);
          if(c.source.sourceType==='manual'&&controller.manualTargets.some(m=>m.component===t.component&&m.metric===t.metric))button(detail,'手入力の訂正版を作成',()=>openForm(t.key,{revisionOf:c.source.id,value:c.value,asOf:c.source.asOf}),c.status!=='candidate only');
          detail.addEventListener('toggle',onResize);section.append(detail);
        }
        element.append(section);
      }
      if(form){
        const t=state.components.find(t=>t.key===form.targetKey),box=make('section','','sbivc-source-review');
        box.append(make('h4',form.action==='override'?'同revisionの補正':'独立した手入力source'));
        box.append(make('p',`${t.label} / component ${t.component} / metric ${t.metric} / JPY / 対象月 ${targetMonth}`));
        if(form.revisionOf)box.append(make('p',`訂正版 / 前revision ${form.revisionOf}`,'sbivc-source-code'));
        for(const [field,label,type]of [['value','値（空欄＝未取得、0は明示0）','text'],['asOf','基準日','date']]){
          const l=make('label',label),control=make('input');control.type=type;control.value=form[field];control.dataset.scalarField=field;
          if(field==='value')control.inputMode='decimal';if(form.action==='override'&&field==='asOf')control.readOnly=true;
          control.addEventListener('input',()=>{form[field]=control.value;pending=null;onDraft(true);});l.append(control);box.append(l);
        }
        button(box,form.action==='override'?'補正内容を確認':'source作成内容を確認',()=>stage({...form}));
        if(form.action==='create'&&!t.current.source&&!t.current.hasCommon)button(box,'保存して採用する内容を確認',()=>stage({...form,action:'create-adopt'}));
        button(box,'手入力を取消',()=>{form=null;pending=null;onDraft(element.open);draw();onResize();});element.append(box);
      }
      if(pending){const review=make('section','','sbivc-source-review');review.append(make('p',`${state.components.find(t=>t.key===pending.targetKey).label}：${{create:'sourceを追加するだけ（採用は変更しません）','create-adopt':'新sourceを作成して明示採用',adopt:'採用sourceを変更（旧補正は継承しません）',keep:'現在の採用・同revisionの補正を継続',defer:'判断保留（有効な採用は維持）',compare:'原値比較の記録のみ（採用変更なし）',override:'同revisionへ補正を記録'}[pending.action]}`));button(review,'保存',save);button(review,'選択を取消',()=>{pending=null;onDraft(element.open||!!form);draw();onResize();});element.append(review);}
      button(element,'最新の入力元を再確認',()=>{try{state=controller.inspect(targetMonth);status.textContent='最新情報を再確認しました。入力・選択は保持しています';draw();}catch(_){status.textContent='採用情報を読み取れません';}onResize();});
    }
    try{state=controller.inspect(targetMonth);}catch(_){}
    draw();element.addEventListener('toggle',()=>{onDraft(element.open||!!form||!!pending);onResize();});
    return Object.freeze({element,state:()=>state,pending:()=>pending,form:()=>form});
  }
  const api=Object.freeze({create});if(node)module.exports=api;else root.TradeScopeScalarSourceUI=api;
})(typeof globalThis!=='undefined'?globalThis:this);
