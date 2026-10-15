(function(root){
  'use strict';
  // v315 public entry point retained; record/normalizer identities are unchanged.
  const node=typeof module!=='undefined'&&module.exports;
  const shared=node?require('./traders-transactions-save.js'):root.TradeScopeTradersTransactionsSave;
  const api=shared.forBroker('lightfx');if(node)module.exports=api;else root.TradeScopeLightTransactionsSave=api;
})(typeof globalThis!=='undefined'?globalThis:this);
