(function(root){
 'use strict';
 const view=typeof module!=='undefined'&&module.exports?require('../assets/transaction-view.js'):root.TradeScopeTransactionView;
 const labels=['日時','口座','資産','銘柄','売買','区分','数量','約定価格','個別損益','取得元','戦略 / メモ',''];
 function create(document){const $=id=>document.getElementById(id);let records=[],limit=50,failed=false;
  const node=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
  function options(id,values){const select=$(id),old=select.value;select.replaceChildren(...values.map(([value,label])=>{const o=node('option',label);o.value=value;return o;}));select.value=values.some(([v])=>v===old)?old:'';}
  function selection(){return {month:$('filterMonth').value,account:$('filterAccount').value,symbol:$('filterSymbol').value,type:$('filterCategory').value,source:$('filterSource').value,strategy:$('filterStrategy').value,order:$('sortOrder').value==='oldest'?'asc':'desc'};}
  const number=value=>{if(value==null)return '—';const [integer,fraction]=String(value).split('.');return integer.replace(/\B(?=(\d{3})+(?!\d))/g,',')+(fraction?'.'+fraction:'');};
  const unit=value=>({'shares':'株','fundUnits':'口'}[value]||value||'');
  const asset=value=>({Stock:'証券',MutualFund:'投資信託',Crypto:'暗号資産'}[value]||value);
  const category=r=>({new:'新規',add:'追加',partial_close:'一部決済',full_close:'全決済'}[r.category]||(r.type==='open'?'新規':r.type==='close'?'決済':r.category||'その他'));
  function row(r){const tr=node('tr',''),values=[(r.executedAt||r.date).replace('T',' '),r.account,asset(r.assetType),r.symbol,r.side==='buy'?'買い':r.side==='sell'?'売り':'—',category(r),
    number(r.quantity)+(r.quantityUnit?' '+unit(r.quantityUnit):''),number(r.price),r.realizedPnl===null?'—':number(r.realizedPnl)+(r.currency==='JPY'?'円':r.currency?' '+r.currency:''),r.sourceLabel,[r.strategy,r.memo].filter(Boolean).join(' / ')||'—',''];
   values.forEach((v,i)=>{const td=node('td',v);td.dataset.label=labels[i];if(i===9)td.title=r.sources.map(s=>({manual:'手入力',sbi:'SBI CSV',gmo:'GMO PDF'}[s.kind]||s.kind)+(s.page?` · ${s.page}ページ`:'' )).join(' / ');tr.append(td);});
   if(r.manualId){const b=node('button','✎');b.type='button';b.className='edit-btn memo-edit-btn';b.dataset.entryId=r.manualId;b.setAttribute('aria-label','手入力を編集');tr.lastChild.append(b);}return tr;}
  function render(reset=true){if(reset)limit=50;const filtered=view.filter(records,selection()),visible=filtered.slice(0,limit),body=$('historyBody');
   body.replaceChildren(...visible.map(row));if(!visible.length){const tr=node('tr',''),td=node('td','履歴がありません');td.colSpan=12;tr.append(td);body.append(tr);}
   if(failed)body.firstChild.firstChild.textContent='取引データを確認できません。再読み込みしてください';
   $('historyCount').textContent=failed?'':filtered.length?`${filtered.length}件 · ${visible.length}件表示`:'0件';$('historyMore').hidden=visible.length>=filtered.length;
   return {total:filtered.length,visible:visible.length};}
  function refresh(manual,models){failed=false;records=view.resolve(manual,models);const pairs=key=>[...new Map(records.map(r=>[r[key],r[key]])).entries()].filter(([v])=>v).sort((a,b)=>a[1].localeCompare(b[1],'ja'));
   if(!$('filterMonth').value)$('filterMonth').value=records[0]?.date.slice(0,7)||new Date().toISOString().slice(0,7);
   options('filterAccount',[['','すべて'],...[...new Map(records.filter(r=>r.accountId).map(r=>[r.accountId,r.account])).entries()]]);
   options('filterSymbol',[['','すべて'],...[...new Map(records.map(r=>[r.instrumentKey||r.symbol,r.symbol])).entries()]]);
   options('filterStrategy',[['','すべて'],...pairs('strategy')]);options('filterCategory',[['','すべて'],['open','新規'],['close','決済'],['other','その他']]);
   options('filterSource',[['','すべて'],['manual','手入力'],['sbi','SBI CSV'],['gmo','GMO PDF']]);return render();}
  function fail(){failed=true;records=[];render();}
  $('historyMore').addEventListener('click',()=>{limit+=50;render(false);});return Object.freeze({refresh,render,fail});
 }
 const api=Object.freeze({create});if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TradeScopeTransactionUI=api;
})(typeof globalThis!=='undefined'?globalThis:this);
