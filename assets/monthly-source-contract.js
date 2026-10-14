(function(root){
  'use strict';
  const node=typeof module!=='undefined'&&module.exports;
  const csv={sum:values=>(node?require('../import/csv-core.js'):root.TradeScopeCSV).sum(values)};
  const version='monthly-source-v1';
  const rows=(m,e)=>m?.[e]?.records||[];
  const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  const id=v=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(v);
  const decimal=v=>typeof v==='string'&&/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(v)&&v.length<=128;
  const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
  const timestamp=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(v)&&date(v.slice(0,10))
    &&Number(v.slice(11,13))<24&&Number(v.slice(14,16))<60&&Number(v.slice(17,19))<60&&!Number.isNaN(Date.parse(v));
  const fail=()=>{throw Error('INVALID_MONTHLY_SOURCE');};
  function fields(v,names){if(!plain(v)||Object.keys(v).length!==names.length||names.some(k=>!Object.hasOwn(v,k)))fail();}
  const canonical=v=>Array.isArray(v)?v.map(canonical):plain(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
  // Synchronous SHA-256 allows Repository/Restore validators to verify facts without network or async writes.
  function hash(value){
    const bytes=new TextEncoder().encode(typeof value==='string'?value:JSON.stringify(canonical(value))),length=bytes.length;
    const data=new Uint8Array(Math.ceil((length+9)/64)*64);data.set(bytes);data[length]=128;
    const dv=new DataView(data.buffer);dv.setUint32(data.length-8,Math.floor(length/0x20000000));dv.setUint32(data.length-4,length*8);
    const k=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
    const h=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19],r=(n,b)=>(n>>>b)|(n<<(32-b)),w=new Uint32Array(64);
    for(let offset=0;offset<data.length;offset+=64){
      for(let i=0;i<16;i++)w[i]=dv.getUint32(offset+i*4);
      for(let i=16;i<64;i++)w[i]=(w[i-16]+(r(w[i-15],7)^r(w[i-15],18)^(w[i-15]>>>3))+w[i-7]+(r(w[i-2],17)^r(w[i-2],19)^(w[i-2]>>>10)))>>>0;
      let [a,b,c,d,e,f,g,q]=h;
      for(let i=0;i<64;i++){const t1=(q+(r(e,6)^r(e,11)^r(e,25))+((e&f)^(~e&g))+k[i]+w[i])>>>0,t2=((r(a,2)^r(a,13)^r(a,22))+((a&b)^(a&c)^(b&c)))>>>0;q=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;}
      [a,b,c,d,e,f,g,q].forEach((v,i)=>h[i]=(h[i]+v)>>>0);
    }
    return h.map(v=>v.toString(16).padStart(8,'0')).join('');
  }
  const targets=['accountId','targetMonth','component','metric','temporalType','currency','unit','scope','asOf'];
  const flowMetrics=['realizedPnl','swapPnl','deposit','withdrawal','fee'];
  const balanceMetrics=['marketValue','cashBalance','unrealizedPnl','reportedAssetTotal'];
  const refFields={accountSnapshots:{cashBalance:'cashBalance',netAssetValue:'marketValue',assetValue:'marketValue',unrealizedPnl:'unrealizedPnl',reportedMonthlyRealizedPnl:'realizedPnl'},
    monthlyAccountInputs:{'sourceValues.realizedPnl':'realizedPnl','sourceValues.swapPnl':'swapPnl','sourceValues.unrealizedPnl':'unrealizedPnl','sourceValues.deposit':'deposit','sourceValues.withdrawal':'withdrawal'},
    monthlyAccountStates:{'sourceValues.realizedPnl':'realizedPnl','sourceValues.swapPnl':'swapPnl','sourceValues.unrealizedPnl':'unrealizedPnl','sourceValues.deposit':'deposit','sourceValues.withdrawal':'withdrawal'},
    importBatches:{holdings:'holdings','holdings.marketValue':'marketValue','holdings.unrealizedPnl':'unrealizedPnl'}};
  const targetKey=v=>JSON.stringify([v.accountId,v.targetMonth,v.component,v.metric,v.currency,v.unit]);
  const target=v=>Object.fromEntries(targets.map(k=>[k,v[k]]));
  function validateTarget(v){
    if(!id(v.accountId)||!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(v.targetMonth)||!['account','domestic','foreign','cash','spot'].includes(v.component)
      ||!['balance','flow','holdings'].includes(v.temporalType)||!/^[A-Z]{3}$/.test(v.currency)
      ||!['currency','holding-set'].includes(v.unit)||!['account-net-assets','securities-value','cash','price-unrealized','monthly-flow','spot-holdings','reported-assets'].includes(v.scope)
      ||!(v.asOf===null||date(v.asOf)||timestamp(v.asOf)))fail();
    if(v.metric==='holdings'?v.temporalType!=='holdings'||v.unit!=='holding-set':v.unit!=='currency'||!([...flowMetrics,...balanceMetrics].includes(v.metric)))fail();
    if(flowMetrics.includes(v.metric)&&v.temporalType!=='flow'||balanceMetrics.includes(v.metric)&&v.temporalType!=='balance')fail();
    const scope=v.metric==='holdings'?'spot-holdings':v.metric==='cashBalance'?'cash':v.metric==='unrealizedPnl'?'price-unrealized':v.metric==='reportedAssetTotal'?'reported-assets':flowMetrics.includes(v.metric)?'monthly-flow':v.component==='account'?'account-net-assets':'securities-value';
    if(v.scope!==scope)fail();
  }
  function validateHoldings(value){
    if(!Array.isArray(value))fail();const ids=new Set();
    for(const h of value){fields(h,['instrumentId','quantity','marketPrice','marketValue','currency']);
      if(!id(h.instrumentId)||ids.has(h.instrumentId)||h.currency!=='JPY'||['quantity','marketPrice','marketValue'].some(k=>h[k]!==null&&!decimal(h[k]))
        ||['quantity','marketPrice'].some(k=>h[k]?.startsWith('-')))fail();ids.add(h.instrumentId);}
  }
  function validateRecord(r){
    if(!plain(r)||r.schemaVersion!==1||!id(r.id))fail();
    if(r.kind==='source'){
      fields(r,['schemaVersion','id','kind',...targets,'sourceId','sourceType','revisionOf','createdAt','confirmedAt','value','reference','fingerprint']);validateTarget(r);
      if(!id(r.sourceId)||!['pdf','csv','manual'].includes(r.sourceType)||!(r.revisionOf===null||id(r.revisionOf))||!(r.createdAt===null||timestamp(r.createdAt))
        ||!(r.confirmedAt===null||timestamp(r.confirmedAt))||!/^[a-f0-9]{64}$/.test(r.fingerprint))fail();
      if(r.reference===null){if(r.sourceType!=='manual')fail();if(r.metric==='holdings')validateHoldings(r.value);else if(r.value!==null&&!decimal(r.value))fail();}
      else{fields(r.reference,['entity','id','field','sourceScope']);if(!refFields[r.reference.entity]?.[r.reference.field]||!id(r.reference.id)||!id(r.reference.sourceScope)||r.value!==null)fail();
        const expected=refFields[r.reference.entity][r.reference.field];if(expected!==r.metric&&!(r.metric==='reportedAssetTotal'&&r.reference.field==='assetValue'))fail();}
    }else if(r.kind==='override'){
      fields(r,['schemaVersion','id','kind','revisionId','revisionFingerprint','previousId','value','confirmedAt']);
      if(!id(r.revisionId)||!/^[a-f0-9]{64}$/.test(r.revisionFingerprint)||!(r.previousId===null||id(r.previousId))||!timestamp(r.confirmedAt))fail();
      if(Array.isArray(r.value))validateHoldings(r.value);else if(r.value!==null&&!decimal(r.value))fail();
    }else if(r.kind==='adoption'){
      fields(r,['schemaVersion','id','kind',...targets,'decision','revisionId','revisionFingerprint','overrideId','previousId','confirmedAt']);validateTarget(r);
      if(!['adopt','defer'].includes(r.decision)||!timestamp(r.confirmedAt)||!(r.previousId===null||id(r.previousId)))fail();
      if(r.decision==='defer'){if(r.revisionId!==null||r.revisionFingerprint!==null||r.overrideId!==null)fail();}
      else if(!id(r.revisionId)||!/^[a-f0-9]{64}$/.test(r.revisionFingerprint)||!(r.overrideId===null||id(r.overrideId)))fail();
    }else if(r.kind==='comparison'){
      fields(r,['schemaVersion','id','kind','leftId','rightId','leftFingerprint','rightFingerprint','result','confirmedAt']);
      if(!id(r.leftId)||!id(r.rightId)||r.leftId===r.rightId||![r.leftFingerprint,r.rightFingerprint].every(v=>/^[a-f0-9]{64}$/.test(v))
        ||!['equivalent','different','incomparable'].includes(r.result)||!timestamp(r.confirmedAt))fail();
    }else fail();
  }
  function envelope(records,updatedAt){return {schemaVersion:1,records,updatedAt,recordCount:records.length,recordsFingerprint:hash(records)};}
  function validateEnvelope(value){
    if(value===null)return;
    fields(value,['schemaVersion','records','updatedAt','recordCount','recordsFingerprint']);
    if(value.schemaVersion!==1||!Array.isArray(value.records)||!timestamp(value.updatedAt)||value.recordCount!==value.records.length||value.recordsFingerprint!==hash(value.records))fail();
    const ids=new Set();for(const r of value.records){validateRecord(r);if(ids.has(r.id))fail();ids.add(r.id);}
  }
  function sourceValue(r,models){
    if(!r.reference)return r.value;
    const ref=r.reference,record=rows(models,ref.entity).find(v=>v.id===ref.id);
    if(!record||record.accountId!==r.accountId||record.targetMonth!==r.targetMonth)fail();
    const snapshot=rows(models,'accountSnapshots').find(v=>v.id===record.adoptedAccountSnapshotId);
    const batch=ref.entity==='importBatches'?record:rows(models,'importBatches').find(v=>v.id===(record.importBatchId??snapshot?.importBatchId));
    const sourceType=ref.field==='sourceValues.swapPnl'&&record.fieldSources?.swapPnl==='manual-income-calendar-swap-accrual'?'manual':record.sourceMode==='manual'?'manual':batch?.sourceType;
    const sourceScope=ref.entity==='importBatches'?ref.sourceScope:record.sourceScope||rows(models,'accountSnapshots').find(s=>s.id===record.adoptedAccountSnapshotId)?.sourceScope;
    if(sourceType!==r.sourceType||sourceScope!==ref.sourceScope||r.asOf!==(record.snapshotAsOf??snapshot?.snapshotAsOf??batch?.snapshotAsOf??null))fail();
    if(ref.entity==='importBatches'){
      const holdings=rows(models,'holdingSnapshots').filter(h=>h.importBatchId===record.id&&h.accountId===r.accountId&&h.targetMonth===r.targetMonth&&h.sourceScope===ref.sourceScope);
      const emptyRoster=ref.sourceScope==='sbivc-monthly-assets'&&rows(models,'accountSnapshots').some(s=>s.importBatchId===record.id&&s.accountId===r.accountId&&s.targetMonth===r.targetMonth&&s.sourceScope===ref.sourceScope);
      if(!holdings.length&&!emptyRoster)fail();
      if(holdings.some(h=>(h.currency??'JPY')!==r.currency))fail();
      if(ref.field==='holdings'){
        if(holdings.some(h=>rows(models,'instruments').find(i=>i.id===h.instrumentId)?.assetType==='FX'))fail();
        return holdings.map(h=>({instrumentId:h.instrumentId,quantity:h.quantity??null,marketPrice:h.marketPrice??null,marketValue:h.marketValue??null,currency:h.currency??'JPY'})).sort((a,b)=>a.instrumentId.localeCompare(b.instrumentId));
      }
      const field=ref.field.split('.')[1],values=holdings.map(h=>h[field]??null);
      if(emptyRoster&&field==='unrealizedPnl')return null;
      return values.every(decimal)?values.length?csv.sum(values):'0':null;
    }
    if((record.valuationCurrency??'JPY')!==r.currency)fail();
    if(r.accountId==='acc_sbivc_crypto'&&ref.field==='assetValue'&&r.metric!=='reportedAssetTotal')fail();
    if(ref.field==='assetValue'&&r.metric==='marketValue'&&record.sourceScope!=='sbi-foreign-securities')fail();
    const component=ref.entity==='importBatches'?null:ref.field==='cashBalance'?'cash':record.sourceScope==='sbi-foreign-securities'?'foreign':'account';
    if(component!==null&&r.component!==component)fail();
    return ref.field.split('.').reduce((value,k)=>value?.[k],record)??null;
  }
  function facts(r,models){
    const record=r.reference?rows(models,r.reference.entity).find(v=>v.id===r.reference.id):null;
    const snapshot=rows(models,'accountSnapshots').find(v=>v.id===record?.adoptedAccountSnapshotId);
    const batch=rows(models,'importBatches').find(v=>v.id===(r.reference?.entity==='importBatches'?record?.id:record?.importBatchId??snapshot?.importBatchId));
    const observationFields=['id','accountId','targetMonth','snapshotAsOf','sourceMode','sourceScope','observationType','valuationCurrency','importBatchId',
      'cashBalance','assetValue','netAssetValue','unrealizedPnl','reportedMonthlyRealizedPnl','accountSpecific','sourceValues','fieldSources'];
    const anchor=record?Object.fromEntries(observationFields.filter(k=>Object.hasOwn(record,k)).map(k=>[k,record[k]])):null;
    const holdings=r.reference?.entity==='importBatches'?rows(models,'holdingSnapshots').filter(h=>h.importBatchId===record.id&&h.sourceScope===r.reference.sourceScope)
      .map(h=>Object.fromEntries(['id','accountSnapshotId','instrumentId','quantity','marketPrice','marketValue','unrealizedPnl','currency'].map(k=>[k,h[k]??null]))).sort((a,b)=>a.id.localeCompare(b.id)):null;
    return {...target(r),sourceId:r.sourceId,sourceType:r.sourceType,reference:r.reference,value:sourceValue(r,models),
      anchor,holdings,metadata:batch?{id:batch.id,provider:batch.sourceProvider,sourceType:batch.sourceType,targetMonth:batch.targetMonth??null,
        snapshotAsOf:batch.snapshotAsOf??null,importedAt:batch.importedAt,importerId:batch.importerId??null,importerVersion:batch.importerVersion??null,
        hash:batch.sourceFileMetadata?.hash??null,size:batch.sourceFileMetadata?.size??null}:null};
  }
  const sourceFingerprint=(r,models)=>hash(facts(r,models));
  function effective(decision,all){while(decision?.decision==='defer')decision=all.find(r=>r.id===decision.previousId);return decision??null;}
  function heads(all){const used=new Set(all.map(r=>r.previousId));return all.filter(r=>r.kind==='adoption'&&!used.has(r.id));}
  function comparison(a,b,models){
    if(JSON.stringify(canonical(target(a)))!==JSON.stringify(canonical(target(b))))return 'incomparable';
    const x=sourceValue(a,models),y=sourceValue(b,models);if(x===null||y===null)return 'incomparable';
    if(decimal(x)&&decimal(y))return /^\-?0(?:\.0+)?$/.test(csv.sum([x,y.startsWith('-')?y.slice(1):'-'+y]))?'equivalent':'different';
    return hash(x)===hash(y)?'equivalent':'different';
  }
  function validateSet(models,{strictStale=false}={}){
    if(models.monthlySources!==undefined)validateEnvelope(models.monthlySources);
    const all=rows(models,'monthlySources'),byId=new Map(all.map(r=>[r.id,r])),accounts=new Set(rows(models,'accounts').map(r=>r.id));
    for(const r of all){validateRecord(r);
      if(r.kind==='source'){
        if(!accounts.has(r.accountId))fail();const v=sourceValue(r,models);if(r.metric==='holdings')validateHoldings(v);else if(v!==null&&!decimal(v))fail();
        if(Array.isArray(v)&&v.some(h=>!rows(models,'instruments').some(i=>i.id===h.instrumentId&&i.assetType!=='FX')))fail();
        if(['deposit','withdrawal'].includes(r.metric)&&v!==null&&v.startsWith('-')&&!/^\-0(?:\.0+)?$/.test(v))fail();
        if(!r.reference&&sourceFingerprint(r,models)!==r.fingerprint)fail();
        const old=byId.get(r.revisionOf);if(r.revisionOf!==null&&(!old||old.kind!=='source'||old.sourceId!==r.sourceId||targetKey(old)!==targetKey(r)||old.id===r.id))fail();
        if(old&&old.sourceType!==r.sourceType)fail();
      }else if(r.kind==='override'){
        const source=byId.get(r.revisionId),previous=byId.get(r.previousId);
        if(source?.kind!=='source'||source.fingerprint!==r.revisionFingerprint||Array.isArray(r.value)!==(source.metric==='holdings')
          ||r.previousId!==null&&(previous?.kind!=='override'||previous.revisionId!==r.revisionId))fail();
        if(Array.isArray(r.value)&&r.value.some(h=>!rows(models,'instruments').some(i=>i.id===h.instrumentId)))fail();
        if(['deposit','withdrawal'].includes(source.metric)&&r.value!==null&&r.value.startsWith('-')&&!/^\-0(?:\.0+)?$/.test(r.value))fail();
        if(source.metric==='holdings'){
          const original=sourceValue(source,models);if(hash(original.map(h=>h.instrumentId).sort())!==hash(r.value.map(h=>h.instrumentId).sort()))fail();
        }
      }else if(r.kind==='adoption'){
        const previous=byId.get(r.previousId);if(!accounts.has(r.accountId)||r.previousId!==null&&(previous?.kind!=='adoption'||targetKey(previous)!==targetKey(r)))fail();
        if(r.decision==='adopt'){
          const source=byId.get(r.revisionId),override=byId.get(r.overrideId);
          if(source?.kind!=='source'||source.fingerprint!==r.revisionFingerprint||JSON.stringify(canonical(target(source)))!==JSON.stringify(canonical(target(r)))
            ||r.overrideId!==null&&(override?.kind!=='override'||override.revisionId!==source.id||override.revisionFingerprint!==source.fingerprint))fail();
        }
      }else{
        const a=byId.get(r.leftId),b=byId.get(r.rightId);
        if(a?.kind!=='source'||b?.kind!=='source'||r.leftFingerprint!==a.fingerprint||r.rightFingerprint!==b.fingerprint)fail();
        if(sourceFingerprint(a,models)===a.fingerprint&&sourceFingerprint(b,models)===b.fingerprint&&comparison(a,b,models)!==r.result)fail();
      }
      const seen=new Set([r.id]);let old=byId.get(r.previousId??r.revisionOf);while(old){if(seen.has(old.id))fail();seen.add(old.id);old=byId.get(old.previousId??old.revisionOf);}
    }
    for(const kind of ['adoption','override','source']){
      const used=new Set();for(const r of all.filter(r=>r.kind===kind)){const parent=r.previousId??r.revisionOf;if(parent!==null&&parent!==undefined){if(used.has(parent))fail();used.add(parent);}}
    }
    const sourceRoots=new Set();for(const r of all.filter(r=>r.kind==='source'&&r.revisionOf===null)){
      const key=r.sourceId+':'+targetKey(r);if(sourceRoots.has(key))fail();sourceRoots.add(key);
    }
    const active=heads(all),keys=new Set();for(const r of active){const key=targetKey(r);if(keys.has(key))fail();keys.add(key);}
    for(const r of active){const chosen=effective(r,all);if(!chosen)continue;
      if(strictStale&&sourceFingerprint(byId.get(chosen.revisionId),models)!==chosen.revisionFingerprint)fail();
      if(chosen.component==='account'&&chosen.metric==='marketValue'&&active.some(other=>{const e=effective(other,all);return e&&e.accountId===r.accountId&&e.targetMonth===r.targetMonth&&e.currency===r.currency&&e.component!=='account'&&['marketValue','cashBalance','holdings'].includes(e.metric);} ))fail();
    }
    return true;
  }
  function resolve(models,query){
    const all=rows(models,'monthlySources'),decisions=heads(all).filter(r=>targetKey(r)===targetKey(query));
    if(decisions.length>1)return {status:'conflict',value:null};
    const head=decisions[0],adopted=effective(head,all);if(!head)return {status:'compatibility',value:null};if(!adopted)return {status:'unresolved',value:null,deferred:true};
    const source=all.find(r=>r.id===adopted.revisionId),override=all.find(r=>r.id===adopted.overrideId);
    try{if(!source||sourceFingerprint(source,models)!==adopted.revisionFingerprint)return {status:'stale',value:null};
      const value=override?override.value:sourceValue(source,models);return {status:value===null?'missing':'adopted',value,source,adoption:adopted,override:override??null,deferred:head.decision==='defer',explicitZero:decimal(value)&&/^\-?0(?:\.0+)?$/.test(value),sourceMonth:source.targetMonth};
    }catch(_){return {status:'stale',value:null};}
  }
  function month(models,accountId,targetMonth){
    const decisions=heads(rows(models,'monthlySources')).filter(r=>r.accountId===accountId&&r.targetMonth===targetMonth);
    return decisions.map(r=>{const resolved=resolve(models,r);return {...target(resolved.source??r),...resolved};});
  }
  function assetComponents(values){
    const relevant=values.filter(v=>['marketValue','cashBalance','holdings'].includes(v.metric)),whole=relevant.find(v=>v.component==='account'&&v.metric==='marketValue');
    const selected=whole?[whole]:[...new Set(relevant.map(v=>v.component+':'+v.currency))].map(key=>{const group=relevant.filter(v=>v.component+':'+v.currency===key);return group.find(v=>v.metric==='marketValue')||group.find(v=>v.metric==='cashBalance')||group[0];});
    return selected.map(v=>{let value=v.value;if(Array.isArray(value)){const positive=value.filter(h=>h.quantity!==null&&!/^0(?:\.0+)?$/.test(h.quantity)&&!h.quantity.startsWith('-'));value=positive.every(h=>decimal(h.marketValue))?positive.length?csv.sum(positive.map(h=>h.marketValue)):'0':null;if(v.value.some(h=>h.quantity===null))value=null;}
      return {key:v.component,value,status:v.status,sourceMonth:v.sourceMonth??v.targetMonth,snapshotAsOf:v.asOf,basis:'current-asset-observation',
        preventCarry:Array.isArray(v.value)&&value===null,blocked:['stale','conflict','unresolved'].includes(v.status),source:{revisionId:v.source?.id??null,adoptionId:v.adoption?.id??null,sourceType:v.source?.sourceType??null}};});
  }
  function draftFingerprint(models,legacy={}){return hash([version,models,legacy]);}
  function descriptor(context,metric,value,extra={}){
    const temporalType=metric==='holdings'?'holdings':flowMetrics.includes(metric)?'flow':'balance',component=context.component??'account';
    return {...context,component,metric,temporalType,currency:context.currency??'JPY',unit:metric==='holdings'?'holding-set':'currency',
      scope:metric==='holdings'?'spot-holdings':metric==='cashBalance'?'cash':metric==='unrealizedPnl'?'price-unrealized':metric==='reportedAssetTotal'?'reported-assets':temporalType==='flow'?'monthly-flow':component==='account'?'account-net-assets':'securities-value',asOf:context.asOf??null,value,...extra};
  }
  // Candidate adapters never persist or rank sources. Existing adoption is resolved by the compatibility resolver.
  function candidates(models,{accountId,targetMonth}){
    const result=rows(models,'monthlySources').filter(r=>r.kind==='source'&&r.accountId===accountId&&r.targetMonth===targetMonth).map(r=>({...r,registered:true}));
    const batchId=r=>{
      const ref=r.reference;if(!ref)return null;const record=rows(models,ref.entity).find(v=>v.id===ref.id);
      return ref.entity==='importBatches'?record?.id:record?.importBatchId??rows(models,'accountSnapshots').find(s=>s.id===record?.adoptedAccountSnapshotId)?.importBatchId??null;
    };
    function add(context,metric,reference,sourceType,createdAt){
      const base=descriptor(context,metric,null,{reference,sourceType,sourceId:'ref_'+hash([accountId,targetMonth,context.component,metric,sourceType,reference.sourceScope]).slice(0,32),revisionOf:null,createdAt:createdAt??null,confirmedAt:null});
      const r={schemaVersion:1,id:'candidate_'+hash([reference,contractTarget(base)]).slice(0,40),kind:'source',...base,fingerprint:'0'.repeat(64)};
      try{r.fingerprint=sourceFingerprint(r,models);validateRecord(r);if(r.metric==='holdings')validateHoldings(sourceValue(r,models));
        const sameReference=v=>hash(v.reference)===hash(r.reference)&&targetKey(v)===targetKey(r);
        if(result.some(v=>v.id===r.id||v.registered&&sameReference(v)||v.sourceId===r.sourceId&&v.reference?.entity!==r.reference.entity&&batchId(v)!==null&&batchId(v)===batchId(r)&&comparison(v,r,models)==='equivalent'))return;
        const registered=result.filter(v=>v.registered&&v.sourceId===r.sourceId&&targetKey(v)===targetKey(r)),parents=new Set(registered.map(v=>v.revisionOf));
        r.revisionOf=registered.find(v=>!parents.has(v.id))?.id??null;result.push(r);
      }catch(_){/* unsupported semantic is not a candidate */}
    }
    const contractTarget=target;
    for(const s of rows(models,'accountSnapshots').filter(r=>r.accountId===accountId&&r.targetMonth===targetMonth)){
      const batch=rows(models,'importBatches').find(b=>b.id===s.importBatchId),sourceType=s.sourceMode==='manual'?'manual':batch?.sourceType;
      if(!['pdf','csv','manual'].includes(sourceType))continue;
      for(const [field,metric]of Object.entries(refFields.accountSnapshots)){
        if(!Object.hasOwn(s,field))continue;const component=field==='cashBalance'?'cash':s.sourceScope==='sbi-foreign-securities'?'foreign':'account';
        add({accountId,targetMonth,component,currency:s.valuationCurrency??'JPY',asOf:s.snapshotAsOf??null},accountId==='acc_sbivc_crypto'&&field==='assetValue'?'reportedAssetTotal':metric,
          {entity:'accountSnapshots',id:s.id,field,sourceScope:s.sourceScope},sourceType,s.importedAt);
      }
    }
    for(const b of rows(models,'importBatches').filter(r=>r.accountId===accountId&&r.targetMonth===targetMonth)){
      // LIGHT's FX position P/L is already the account price-unrealized observation.
      // It is not a spot component/holding set. Keep old records for audit only.
      if(b.accountId==='acc_lightfx_fx'&&b.sourceProvider==='lightfx')continue;
      const scopes=[...new Set([...rows(models,'holdingSnapshots').filter(h=>h.importBatchId===b.id).map(h=>h.sourceScope),
        ...rows(models,'accountSnapshots').filter(s=>s.importBatchId===b.id&&s.sourceScope==='sbivc-monthly-assets').map(s=>s.sourceScope)])];
      for(const sourceScope of scopes)for(const [field,metric]of Object.entries(refFields.importBatches)){
        add({accountId,targetMonth,component:sourceScope==='sbi-domestic-holdings'?'domestic':'spot',asOf:b.snapshotAsOf??null},metric,{entity:'importBatches',id:b.id,field,sourceScope},b.sourceType,b.importedAt);
      }
    }
    for(const entity of ['monthlyAccountStates','monthlyAccountInputs'])for(const r of rows(models,entity).filter(r=>r.accountId===accountId&&r.targetMonth===targetMonth&&r.sourceValues)){
      const s=rows(models,'accountSnapshots').find(s=>s.id===r.adoptedAccountSnapshotId),batch=rows(models,'importBatches').find(b=>b.id===s?.importBatchId);if(!s||!batch)continue;
      for(const [field,metric]of Object.entries(refFields[entity]))if(Object.hasOwn(r.sourceValues,metric)&&!(r.fieldSources?.[metric]==='manual-income-calendar-swap-accrual'&&r.sourceValues[metric]===null))add({accountId,targetMonth,component:'account',asOf:s.snapshotAsOf??null},metric,
        {entity,id:r.id,field,sourceScope:s.sourceScope},r.fieldSources?.[metric]==='manual-income-calendar-swap-accrual'?'manual':batch.sourceType,r.overrideUpdatedAt??r.confirmedAt);
    }
    return result;
  }
  function legacyCandidates(tradingData,{accountId,targetMonth,accountKey}){
    const [year,number]=targetMonth.split('-').map(Number),row=tradingData?.[year]?.[number]?.[accountKey]??{};
    return Object.entries({realizedPnL:'realizedPnl',swapPnL:'swapPnl',unrealizedPnL:'unrealizedPnl',deposit:'deposit',withdrawal:'withdrawal',monthEndBalance:'cashBalance'})
      .filter(([field])=>Object.hasOwn(row,field)&&row[field]!==null&&row[field]!==''&&Number.isFinite(Number(row[field])))
      .map(([field,metric])=>{const value=String(row[field]),d=descriptor({accountId,targetMonth,component:metric==='cashBalance'?'cash':'account',asOf:null},metric,value);
        return {...d,id:'legacy_'+hash([accountId,targetMonth,field]).slice(0,32),sourceType:'manual',sourceId:'legacy_'+hash([accountId,field]).slice(0,32),createdAt:null,confirmedAt:null,
          compatibility:true,zeroEvidence:Number(value)!==0?'not-zero':row.__saved===true?'account-confirmed':'unknown',fingerprint:hash([d,accountKey])};});
  }
  function progress(models,accountId,targetMonth,required=[]){
    const values=month(models,accountId,targetMonth);
    return {sourceAcquired:candidates(models,{accountId,targetMonth}).length>0,adoptionStates:values.map(v=>({component:v.component,metric:v.metric,status:v.status,deferred:v.deferred===true})),
      missingRequired:required.filter(q=>resolve(models,{...q,accountId,targetMonth}).status!=='adopted'),carryState:null,userCompletionApproval:null};
  }
  function audit(models){
    const all=rows(models,'monthlySources'),byId=new Map(all.map(r=>[r.id,r]));
    const current=id=>{const r=byId.get(id);try{return r?.kind==='source'&&sourceFingerprint(r,models)===r.fingerprint;}catch(_){return false;}};
    return all.map(r=>({id:r.id,kind:r.kind,status:r.kind==='source'?current(r.id)?'current':'stale':r.kind==='comparison'?current(r.leftId)&&current(r.rightId)?r.result:'stale':r.kind==='override'?current(r.revisionId)?'current':'stale':r.decision==='defer'?'deferred':current(r.revisionId)?'confirmed':'stale'}));
  }
  const api=Object.freeze({version,targets,target,targetKey,hash,descriptor,candidates,legacyCandidates,progress,audit,envelope,validateEnvelope,validateRecord,validateSet,sourceValue,sourceFingerprint,comparison,resolve,month,heads,assetComponents,draftFingerprint,flowMetrics});
  if(node)module.exports=api;else root.TradeScopeMonthlySourceContract=api;
})(typeof globalThis!=='undefined'?globalThis:this);
