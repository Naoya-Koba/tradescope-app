// Server/unit-test scenarios use invented data and disposable Memory only.
const {currentFixture}=require('./current-net-assets-fixture.js'),model=require('../assets/data-model-storage.js');
async function integrityFixture(scenario='normal'){
 if(!['normal','future','year','partial','confirmed'].includes(scenario))throw Error('unknown anonymous scenario');
 const f=await currentFixture();f.initialFunds[2026].gmo='100';f.initialFunds[2026].lightfx='200';
 if(scenario==='future')f.models.importBatches.records.push({...f.models.importBatches.records[0],id:'unadopted_2027',targetMonth:'2027-01',snapshotAsOf:'2027-01-31'});
 if(scenario==='year'){f.tradingData[2027]={1:{smbc:{__saved:true,monthEndBalance:500}}};f.initialFunds[2027]={};}
 if(scenario==='partial')f.tradingData[2026][1].gmo={realizedPnL:0,swapPnL:null,deposit:null,withdrawal:null,unrealizedPnL:null};
 if(scenario==='confirmed'){
  f.tradingData={2026:{1:{gmo:{__saved:true,realizedPnL:10,swapPnL:0,deposit:0,withdrawal:0,unrealizedPnL:null}}}};
  f.initialFunds={2026:{gmo:100}};f.initialUnrealized={2026:{gmo:0}};
  f.models=Object.fromEntries(Object.keys(model.keys).map(k=>[k,null]));
 }
 for(const [k,v]of Object.entries({tradingData:f.tradingData,yearInitialFunds:f.initialFunds,yearInitialUnrealized:f.initialUnrealized}))f.store.setItem(k,JSON.stringify(v));
 for(const [k,v]of Object.entries(f.models))if(v)f.store.setItem(model.keys[k],JSON.stringify(v));else f.store.removeItem(model.keys[k]);
 if(scenario==='partial'){
  const core=require('../assets/monthly-source-contract.js');let n=0;
  const api=require('../assets/monthly-source-service.js').createService(f.store,{clock:()=> '2026-10-16T00:00:00.000Z',newId:()=> 'integrity_'+(++n)});
  const source=core.descriptor({accountId:'acc_gmo_fx',targetMonth:'2026-01',component:'account',asOf:null},'realizedPnl','10',{id:'integrity_realized',sourceId:'manual_integrity',sourceType:'manual',reference:null});
  api.operate({sources:[source],adoptions:[{revisionId:source.id}]},{expectedFingerprint:api.inspect().fingerprint});f.models=model.readModels(f.store);
 }
 return f;
}
module.exports={integrityFixture};
