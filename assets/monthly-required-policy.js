(function(root){
  'use strict';
  const node=typeof module!=='undefined'&&module.exports;
  const version='monthly-required-policy-v1';
  const scopes=Object.freeze(['current-balance','fixed-balance','period']);
  const metric=(component,name)=>Object.freeze({id:component+':'+name,component,metric:name,currency:'JPY'});
  const flow=['realizedPnl','swapPnl','deposit','withdrawal'].map(m=>metric('account',m));
  const fx={balance:[metric('account','marketValue')],period:[...flow,metric('account','unrealizedPnl'),metric('account','periodReference')]};
  const policies={
    gmo:{accountId:'acc_gmo_fx',...fx},
    lightfx:{accountId:'acc_lightfx_fx',...fx,calendarSwap:true},
    minano:{accountId:'acc_minna_fx',...fx,calendarSwap:true},
    sbi:{accountId:'acc_sbi_sec',balance:[metric('domestic','marketValue'),metric('foreign','marketValue'),metric('cash','cashBalance')],
      period:[metric('domestic','unrealizedPnl'),metric('foreign','unrealizedPnl'),...flow.filter(m=>m.metric!=='swapPnl'),metric('account','periodReference')],fixedSwap:'0'},
    sbivc:{accountId:'acc_sbivc_crypto',balance:[metric('spot','holdings'),metric('cash','cashBalance')],period:[],periodSupported:false},
    smbc:{accountId:'acc_smbc_bank',balance:[metric('cash','cashBalance')],period:[],periodSupported:false,periodReason:'bank-balance-only'}
  };
  for(const p of Object.values(policies)){Object.freeze(p.balance);Object.freeze(p.period);Object.freeze(p);}
  Object.freeze(policies);
  function get(key,scope='period'){
    if(!policies[key]||!scopes.includes(scope))throw Error('INVALID_PROGRESS_POLICY');
    return {...policies[key],key,scope,version,periodSupported:policies[key].periodSupported!==false};
  }
  const api=Object.freeze({version,scopes,policies,get,accountKeys:Object.freeze(Object.keys(policies))});
  if(node)module.exports=api;else root.TradeScopeMonthlyRequiredPolicy=api;
})(typeof globalThis!=='undefined'?globalThis:this);
