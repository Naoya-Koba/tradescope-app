// Entirely invented observations. No private files or production Storage access.
const {seed,storage}=require('./observation-override-fixture.js');
const {fixture}=require('./monthly-display-fixture.js');
async function currentFixture(options={}){
  const store=await seed({period:'2026/09/01 ～ 2026/09/30',basis:'2026/09/30',assets:['ETH'],...options});
  const f=fixture();f.models=storage.readModels(store);
  f.initialUnrealized={2026:Object.fromEntries(f.accounts.map(a=>[a.key,0]))};
  // A genuine older selectable year and a newer empty placeholder must not select current assets.
  f.tradingData[2025]={1:structuredClone(f.tradingData[2026][1])};
  f.initialFunds[2025]=Object.fromEntries(f.accounts.map(a=>[a.key,50]));
  f.initialUnrealized[2025]=Object.fromEntries(f.accounts.map(a=>[a.key,0]));
  f.tradingData[2028]={};f.initialFunds[2028]={gmo:999999};
  for(const [key,value]of Object.entries({tradingData:f.tradingData,yearInitialFunds:f.initialFunds,yearInitialUnrealized:f.initialUnrealized}))store.setItem(key,JSON.stringify(value));
  return {...f,store};
}
module.exports={currentFixture};
