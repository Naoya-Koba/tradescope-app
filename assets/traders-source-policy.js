(function(root){
  'use strict';
  // Non-persistent source identity. Batch origin does not imply balance observations exist.
  const configs=Object.freeze(Object.fromEntries([
    ['lightfx','lightfx','acc_lightfx_fx'],['minano','minna','acc_minna_fx']
  ].map(([product,provider,accountId])=>[product,Object.freeze({product,provider,accountId,
    sourceScope:provider+'-fx-trades',importerId:provider+'-executions',normalizerSuffix:provider+'-v3-v1',
    realizedAuditStates:Object.freeze(product==='lightfx'?['matched','no-close','incomplete']:['matched','no-close'])})])));
  const get=product=>{const c=configs[product];if(!c)throw Error('TRADERS_PRODUCT_INVALID');return c;};
  const isTransactionOnlyBatch=b=>!!b&&Object.values(configs).some(c=>b.importerId===c.importerId
    &&b.accountId===c.accountId&&b.sourceProvider===c.provider&&b.sourceType==='pdf');
  const matches=(b,source,p,c,version)=>b.accountId===c.accountId&&b.sourceProvider===c.provider&&b.sourceType==='pdf'
    &&[c.importerId,'traders-monthly'].includes(b.importerId)&&b.importerVersion===version
    &&b.targetMonth===p.targetMonth&&b.snapshotAsOf===p.snapshotAsOf
    &&b.sourceFileMetadata?.hash===source.fileHash&&b.sourceFileMetadata.size===source.fileSize;
  const api=Object.freeze({configs,get,isTransactionOnlyBatch,matches});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TradeScopeTradersSourcePolicy=api;
})(typeof globalThis!=='undefined'?globalThis:this);
