// Explicitly confirmed zero flows for NORMAL anonymous ledger scenarios.
// Never used in production or in tests of missing periods/fields.
function completeLegacy(data={},keys=['gmo'],through=8){
 const copy=structuredClone(data);copy[2026]??={};
 for(let month=1;month<=through;month++){
  copy[2026][month]??={};
  for(const key of keys)copy[2026][month][key]={__saved:true,realizedPnL:0,swapPnL:0,deposit:0,withdrawal:0,unrealizedPnL:0,...copy[2026][month][key]};
 }
 return copy;
}
module.exports={completeLegacy};
