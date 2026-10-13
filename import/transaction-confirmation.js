(function(root){
 'use strict';
 const accountUI=typeof module!=='undefined'&&module.exports?require('../assets/account-ui.js'):root.TradeScopeAccountUI;
 function create(document,container){
  let choices=[];
  const node=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
  const number=v=>{const [integer,fraction]=String(v).split('.');return integer.replace(/\B(?=(\d{3})+(?!\d))/g,',')+(fraction===undefined?'':'.'+fraction);};
  function show(candidates=[]){container.replaceChildren();choices=[];
   for(const c of candidates){
    const card=node('div','');card.className='transaction-comparison';
    card.append(node('p',c.ambiguous?'手入力のデータと一致する可能性があります':'手入力のデータと一致します'));
    card.append(node('strong',`${accountUI?.displayAccountName(c.account)||c.account}　${c.symbol}　${c.side==='buy'?'買':'売'}`));
    const unit=c.facts.quantityUnit==='baseAssetUnits'?c.symbol.split('/')[0]:c.facts.quantityUnit==='shares'?'株':c.facts.quantityUnit==='fundUnits'?'口':'通貨';
    const values=`${number(c.quantity)} ${unit}　${number(c.price)} ${c.facts.currency==='JPY'?'円':c.facts.currency}`;
    const kind=c.sourceType==='csv'?'CSV':'PDF';
    card.append(node('p',`手入力：${values}`),node('p',`${kind}：${c.count}件　合計 ${values}`));
    const label=node('label',''),select=node('select','');select.setAttribute('aria-label','手入力データの扱い');
    for(const [value,text]of [['replace',`${kind}データに置き換える`],['keep-both','両方残す'],['defer','今回は判断しない']]){
     const option=node('option',text);option.value=value;option.disabled=value==='replace'&&c.ambiguous;select.append(option);
    }select.value=c.ambiguous?'defer':'replace';label.append(select);card.append(label);container.append(card);choices.push({key:c.key,select});
   }
  }
  return Object.freeze({show,decisions:()=>choices.map(c=>({key:c.key,decision:c.select.value}))});
 }
 const api={create};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TradeScopeTransactionConfirmation=api;
})(typeof globalThis!=='undefined'?globalThis:this);
