(function(root){
  'use strict';
  if(typeof module!=='undefined'&&module.exports)module.exports=require('./traders-transactions-ui.js');
  else root.TradeScopeLightTransactionsUI=root.TradeScopeTradersTransactionsUI.lightfx;
})(typeof globalThis!=='undefined'?globalThis:this);
