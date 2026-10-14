(function(root){
  'use strict';
  const node=typeof module!=='undefined'&&module.exports;
  const model=node?require('../assets/data-model-storage.js'):root.TradeScopeDataStorage;
  const parser=node?require('./sbivc-parser.js'):root.TradeScopeSBIVCParser;
  const tx=node?require('../assets/storage-transaction.js'):root.TradeScopeStorageTransaction;
  const adoption=node?require('../assets/observation-adoption.js'):root.TradeScopeObservationAdoption;
  const reconciliation=node?require('../assets/transaction-reconciliation.js'):root.TradeScopeTransactionReconciliation;
  const transactionView=node?require('../assets/transaction-view.js'):root.TradeScopeTransactionView;
  const sourceContract=node?require('../assets/monthly-source-contract.js'):root.TradeScopeMonthlySourceContract;
  const sourceService=node?require('../assets/monthly-source-service.js'):root.TradeScopeMonthlySourceService;
  const copy=v=>JSON.parse(JSON.stringify(v)),rows=(m,e)=>m[e]?.records||[];
  const accountId='acc_sbivc_crypto',scope='sbivc-monthly-assets',importerId='sbivc-monthly';
  const decimal=v=>typeof v==='string'&&/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(v)&&v.length<=128;
  const tradeFields=['marketType','side','normalizedTransactionType','rawTransactionType','executedAt','tradeDate','providerExecutionId','providerOrderId','quantity','quantityUnit','price','fee','feeCurrency','feeSemantics','currency','realizedPnl','sourcePage','sourceRow'];
  function tradeRecord(t,{id,instrumentId,importBatchId,importedAt,targetMonth}){
    return{schemaVersion:2,id,accountId,instrumentId,importBatchId,importedAt,targetMonth,sourceProvider:'sbivc',sourceType:'pdf',sourceScope:'sbivc-spot-trades',
      ...Object.fromEntries(tradeFields.map(k=>[k,t[k]]))};
  }
  function invalid(){throw Error('SBI VCの資産・保有情報を確認してください');}
  function validate(source){
    model.assertJson(source);const p=source?.preview,r=p?.report,a=p?.accountObservations;
    if(!source||Object.keys(source).some(k=>!['preview','fileHash','fileSize'].includes(k))||p?.valid!==true||p.version!==parser.version
      ||!Array.isArray(p.errors)||p.errors.length||r?.provider!=='sbivc'||r.reportType!=='monthly'
      ||!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(r.targetMonth)||r.periodStart!==r.targetMonth+'-01'
      ||!decimal(a?.jpyCash)||!decimal(a.assetTotalObservation)||a.valuationCurrency!=='JPY'
      ||!Array.isArray(p.spotHoldings)||!/^[a-f0-9]{64}$/.test(source.fileHash)||!Number.isSafeInteger(source.fileSize)
      ||source.fileSize<8||source.fileSize>20*1024*1024)invalid();
    const end=new Date(Date.UTC(+r.targetMonth.slice(0,4),+r.targetMonth.slice(5),0)).toISOString().slice(0,10);
    if(r.periodEnd!==end||r.snapshotAsOf!==end)invalid();
    const symbols=new Set();
    for(const h of p.spotHoldings){
      const candidate=parser.instrument(h.asset);
      if(!candidate||candidate.symbol!==h.symbol||symbols.has(h.symbol)||h.valuationCurrency!=='JPY'||!decimal(h.quantity)||!decimal(h.officialJPYValue)
        ||h.valuationRate!==null&&!decimal(h.valuationRate))invalid();
      symbols.add(h.symbol);
    }
    if(!Array.isArray(p.transactions)||!['empty','verified'].includes(p.sections?.trades?.status)
      ||(p.sections.trades.status==='empty')!==(p.transactions.length===0))invalid();
    const executions=new Set();
    for(const t of p.transactions){
      if(Object.keys(t).some(k=>!['symbol',...tradeFields].includes(k))||!parser.instrument(t.symbol?.split('/')[0])
        ||! /^[A-Z][A-Z0-9]{1,19}\/JPY$/.test(t.symbol)||t.marketType!=='spot'||t.side!=='buy'
        ||t.normalizedTransactionType!=='spot-buy'||t.rawTransactionType!=='現物 買'||t.realizedPnl!==null
        ||t.feeCurrency!=='JPY'||t.providerExecutionId===null||executions.has(t.providerExecutionId)
        ||!decimal(t.quantity)||/^0(?:\.0+)?$/.test(t.quantity)||!decimal(t.price)
        ||! /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(t.executedAt)||t.tradeDate!==t.executedAt.slice(0,10)
        ||t.tradeDate.slice(0,7)!==r.targetMonth)invalid();
      model.validateRecord('importedTransactions',tradeRecord(t,{id:'draft_trade',instrumentId:'draft_ins',importBatchId:'draft_batch',importedAt:'2030-01-01T00:00:00.000Z',targetMonth:r.targetMonth}));
      executions.add(t.providerExecutionId);
    }
    // Only verified observations and explicit spot buys map. Cashflow legs/rewards/collateral never persist.
    return p;
  }
  function resolve(models,targetMonth){
    const input=rows(models,'monthlyAccountInputs').find(r=>[3,4].includes(r.schemaVersion)&&r.accountId===accountId&&r.targetMonth===targetMonth);
    if(!input)return null;
    const snapshot=rows(models,'accountSnapshots').find(r=>r.id===input.adoptedAccountSnapshotId);
    if(!snapshot)return null;
    return {input,snapshot,holdings:rows(models,'holdingSnapshots').filter(r=>r.accountSnapshotId===snapshot.id),
      realizedPnl:null,unrealizedPnl:null,complete:false};
  }
  function persistableHoldings(models,preview,savedSnapshot=null){
    const positiveSymbols=new Set(),instruments=new Map(rows(models,'instruments').map(i=>[i.id,i]));
    for(const input of rows(models,'monthlyAccountInputs')){
      if(![3,4].includes(input.schemaVersion)||input.accountId!==accountId||input.targetMonth>preview.report.targetMonth)continue;
      const refs=[...input.sourceHistory,{adoptedAccountSnapshotId:input.adoptedAccountSnapshotId,adoptedAt:input.adoptedAt}];
      let ref=refs.at(-1);
      if(savedSnapshot){
        // Reconstruct the evidence before this source was adopted, including positive -> zero corrections.
        // The current source cannot prove its own zero relevance. Later corrections cannot change a no-op.
        if(input.targetMonth===preview.report.targetMonth){
          const index=refs.findIndex(r=>r.adoptedAccountSnapshotId===savedSnapshot.id);ref=index>0?refs[index-1]:null;
        }else ref=refs.filter(r=>r.adoptedAt<=savedSnapshot.importedAt).at(-1);
      }
      if(!ref)continue;
      const snapshot=rows(models,'accountSnapshots').find(s=>s.id===ref.adoptedAccountSnapshotId);
      if(!snapshot||snapshot.accountId!==accountId||snapshot.sourceScope!==scope||snapshot.sourceMode!=='imported')continue;
      for(const h of rows(models,'holdingSnapshots')){
        const instrument=instruments.get(h.instrumentId);
        if(h.accountSnapshotId===snapshot.id&&h.accountId===accountId&&h.importBatchId===snapshot.importBatchId
          &&h.sourceScope===scope&&decimal(h.quantity)&&!/^0(?:\.0+)?$/.test(h.quantity)&&instrument?.assetType==='Crypto')positiveSymbols.add(instrument.symbol);
      }
    }
    return preview.spotHoldings.filter(h=>!/^0(?:\.0+)?$/.test(h.quantity)||positiveSymbols.has(h.symbol));
  }
  function createService(adapter,options={}){
    const repo=model.createRepository(adapter),clock=options.clock||(()=>new Date().toISOString()),cryptoApi=options.cryptoApi||root.crypto;
    let busy=false;
    function prepare(source){
      if(adapter.getItem(tx.journalKey)!==null)throw Error('未完了のジャーナルがあります。保存を停止しました');
      const p=validate(source),before=repo.read(),account=rows(before,'accounts').find(r=>r.id===accountId);
      sourceContract.validateSet(before,{strictStale:true});
      if(account&&(!account.enabled||account.providerCode!=='sbivc'||account.accountType!=='crypto'))return{status:'conflict'};
      const existing=rows(before,'importBatches').filter(b=>b.accountId===accountId&&b.sourceType==='pdf'&&b.sourceProvider==='sbivc'
        &&b.importerId===importerId&&[p.version,'sbivc-monthly-preview-v1'].includes(b.importerVersion)&&b.targetMonth===p.report.targetMonth&&b.snapshotAsOf===p.report.snapshotAsOf
        &&b.sourceFileMetadata?.hash===source.fileHash);
      if(existing.length){
        const batch=existing[0],snapshots=rows(before,'accountSnapshots').filter(s=>s.importBatchId===batch.id&&s.sourceScope===scope);
        if(existing.length!==1||batch.sourceFileMetadata.size!==source.fileSize||snapshots.length!==1)return{status:'conflict'};
        const s=snapshots[0],holdings=rows(before,'holdingSnapshots').filter(h=>h.importBatchId===batch.id);
        const selected=persistableHoldings(before,p,s);
        const adopted=resolve(before,p.report.targetMonth);
        const referenced=adopted&&(adopted.input.adoptedAccountSnapshotId===s.id||adopted.input.sourceHistory.some(r=>r.adoptedAccountSnapshotId===s.id));
        const imported=rows(before,'importedTransactions').filter(t=>t.importBatchId===batch.id);
        const tradesMatch=imported.length===p.transactions.length&&p.transactions.every(t=>{
          const matches=imported.filter(r=>r.providerExecutionId===t.providerExecutionId);
          const saved=matches[0];return matches.length===1&&saved.schemaVersion===2&&saved.sourceProvider==='sbivc'&&saved.sourceScope==='sbivc-spot-trades'
            &&rows(before,'instruments').find(i=>i.id===saved.instrumentId)?.symbol===t.symbol&&tradeFields.every(k=>saved[k]===t[k]);
        });
        const saved=tradesMatch&&referenced&&holdings.length===selected.length&&s.cashBalance===p.accountObservations.jpyCash&&s.assetValue===p.accountObservations.assetTotalObservation
          &&selected.every(h=>{const matches=holdings.filter(row=>rows(before,'instruments').find(i=>i.id===row.instrumentId)?.symbol===h.symbol);
            return matches.length===1&&matches[0].accountSnapshotId===s.id&&matches[0].quantity===h.quantity&&matches[0].marketPrice===h.valuationRate&&matches[0].marketValue===h.officialJPYValue;});
        return{status:saved?'already-imported':'conflict',before,existingBatchId:batch.id,holdingCount:selected.length,transactionCount:p.transactions.length};
      }
      const view=resolve(before,p.report.targetMonth);
      if(!view&&rows(before,'accountSnapshots').some(s=>s.accountId===accountId&&s.targetMonth===p.report.targetMonth))return{status:'conflict'};
      const selected=persistableHoldings(before,p),ids=new Map(),newSymbols=[];
      const dependencies=[...new Map([...selected,...p.transactions].map(h=>[h.symbol,h])).values()];
      for(const h of dependencies){
        const matches=rows(before,'instruments').filter(i=>i.assetType==='Crypto'&&i.symbol===h.symbol);
        if(matches.length>1||matches.some(i=>!i.enabled||i.quoteCurrency!=null&&i.quoteCurrency!=='JPY'))return{status:'conflict'};
        if(matches.length)ids.set(h.symbol,matches[0].id);else newSymbols.push(h.symbol);
      }
      return{status:view?'review-required':'ready',before,p,account,view,ids,newSymbols,selected,holdingCount:selected.length,transactionCount:p.transactions.length};
    }
    const result=p=>({status:p.status,...(p.before?{sourceFingerprint:sourceContract.draftFingerprint(p.before)}:{}),...(p.holdingCount!==undefined?{holdingCount:p.holdingCount}:{}),...(p.transactionCount!==undefined?{transactionCount:p.transactionCount}:{}),...(p.view?{inputId:p.view.input.id,adoptedSnapshotId:p.view.snapshot.id,adoptedAt:p.view.input.adoptedAt,...(p.view.input.schemaVersion===4?{overrideUpdatedAt:p.view.input.overrideUpdatedAt,overrideRevision:p.view.input.overrideHistory.length}:{})}:{})});
    async function inspect(source){const p=prepare(copy(source)),out=result(p);
      if(p.status==='already-imported')return reconciliation.inspect(adapter,p.before,transactionView.activeSources(p.before).filter(s=>s.record.importBatchId===p.existingBatchId),out);
      if(!['ready','review-required'].includes(p.status))return out;
      const instruments=p.newSymbols.map((symbol,n)=>({id:'preview_ins_'+n,assetType:'Crypto',symbol,displayName:symbol,quoteCurrency:'JPY',enabled:true}));
      const models={...p.before,instruments:{records:[...rows(p.before,'instruments'),...instruments]}};
      const sources=p.p.transactions.map((t,n)=>({entity:'importedTransactions',record:tradeRecord(t,{id:'preview_trade_'+n,
        instrumentId:p.ids.get(t.symbol)||instruments.find(i=>i.symbol===t.symbol).id,importBatchId:'preview_batch',importedAt:clock(),targetMonth:p.p.report.targetMonth})}));
      return reconciliation.inspect(adapter,models,sources,out);
    }
    async function save(source,confirmation={}){
      if(busy)return{status:'busy'};busy=true;
      try{
        const input=copy(source),prepared=prepare(input),guard=result(prepared);
        if(confirmation.sourceFingerprint!==undefined&&confirmation.sourceFingerprint!==guard.sourceFingerprint)return prepared.status==='review-required'?{...guard,stale:true}:{status:'stale'};
        if(prepared.status==='already-imported'){
          const changes={},checked=reconciliation.finish(adapter,prepared.before,changes,confirmation,clock(),()=>model.newId('tr',cryptoApi),transactionView.activeSources(prepared.before).filter(s=>s.record.importBatchId===prepared.existingBatchId));
          if(checked.status!=='ready')return checked;
          if(Object.keys(changes).length){repo.commit(changes,{expectedModels:prepared.before,expectedManual:checked.expectedManual});return{status:'saved',reconciled:true};}
          return guard;
        }
        const correction=prepared.status==='review-required'&&confirmation.inputId===guard.inputId&&confirmation.adoptedSnapshotId===guard.adoptedSnapshotId&&confirmation.adoptedAt===guard.adoptedAt&&confirmation.overrideUpdatedAt===guard.overrideUpdatedAt&&confirmation.overrideRevision===guard.overrideRevision;
        if(prepared.status!=='ready'&&!correction)return guard;
        const {before,p,account,view,ids,newSymbols,selected}=prepared,now=clock(),changes={},envelope=records=>({schemaVersion:1,records,updatedAt:now});
        if(!account)changes.accounts=envelope([...rows(before,'accounts'),model.initialAccounts().find(a=>a.id===accountId)]);
        const instruments=newSymbols.map(symbol=>{const id=model.newId('ins',cryptoApi);ids.set(symbol,id);return{id,assetType:'Crypto',symbol,displayName:symbol,quoteCurrency:'JPY',enabled:true};});
        if(instruments.length)changes.instruments=envelope([...rows(before,'instruments'),...instruments]);
        const batchId=model.newId('batch',cryptoApi),snapshotId=model.newId('as',cryptoApi);
        const batch={id:batchId,accountId,sourceType:'pdf',sourceProvider:'sbivc',importerId,importerVersion:p.version,
          targetMonth:p.report.targetMonth,snapshotAsOf:p.report.snapshotAsOf,importedAt:now,sourceFileMetadata:{hash:input.fileHash,size:input.fileSize}};
        const provenance={schemaVersion:1,accountId,importBatchId:batchId,sourceMode:'imported',sourceScope:scope,targetMonth:p.report.targetMonth,
          snapshotAsOf:p.report.snapshotAsOf,importedAt:now,observationType:'officialMonthEnd'};
        const snapshot={id:snapshotId,...provenance,valuationCurrency:'JPY',cashBalance:p.accountObservations.jpyCash,assetValue:p.accountObservations.assetTotalObservation,
          netAssetValue:null,unrealizedPnl:null,reportedMonthlyRealizedPnl:null};
        const holdings=selected.map(h=>({id:model.newId('hs',cryptoApi),...provenance,accountSnapshotId:snapshotId,instrumentId:ids.get(h.symbol),
          quantity:h.quantity,marketPrice:h.valuationRate,marketValue:h.officialJPYValue,acquisitionPrice:null,unrealizedPnl:null,currency:'JPY'}));
        const monthly={schemaVersion:3,id:view?.input.id||model.newId('mai',cryptoApi),accountId,targetMonth:p.report.targetMonth,adoptedAccountSnapshotId:snapshotId,adoptedAt:now,
          sourceHistory:view?[...view.input.sourceHistory,{adoptedAccountSnapshotId:view.snapshot.id,adoptedAt:view.input.adoptedAt}]:[]};
        if(view?.input.schemaVersion===4)Object.assign(monthly,{schemaVersion:4,observationOverrides:adoption.empty(),overrideUpdatedAt:now,
          overrideHistory:[...view.input.overrideHistory,adoption.revision(view.input)]});
        changes.importBatches=envelope([...rows(before,'importBatches'),batch]);changes.accountSnapshots=envelope([...rows(before,'accountSnapshots'),snapshot]);
        changes.holdingSnapshots=envelope([...rows(before,'holdingSnapshots'),...holdings]);
        changes.monthlyAccountInputs=envelope([...rows(before,'monthlyAccountInputs').filter(r=>r.id!==monthly.id),monthly]);
        if(p.transactions.length)changes.importedTransactions=envelope([...rows(before,'importedTransactions'),...p.transactions.map(t=>tradeRecord(t,
          {id:model.newId('it',cryptoApi),instrumentId:ids.get(t.symbol),importBatchId:batchId,importedAt:now,targetMonth:p.report.targetMonth}))]);
        // Candidate acquisition is NOT a command to replace an independent manual/common adoption.
        // Empty collections use the existing Batch + AccountSnapshot scope, not invented Holding rows.
        const combined={...before,...changes};
        const candidates=sourceContract.candidates(combined,{accountId,targetMonth:p.report.targetMonth}).filter(r=>!r.registered&&(
          r.metric==='holdings'&&r.reference?.id===batchId||['cashBalance','reportedAssetTotal'].includes(r.metric)&&r.reference?.id===snapshotId));
        if(candidates.length!==3)throw Error('SBIVC_SOURCE_CANDIDATES_INVALID');
        Object.assign(changes,sourceService.buildChanges(combined,{sources:candidates},{at:now,newId:()=>model.newId('ms',cryptoApi)}).changes);
        const checked=reconciliation.finish(adapter,before,changes,confirmation,now,()=>model.newId('tr',cryptoApi));
        if(checked.status!=='ready')return checked;
        reconciliation.continuity(adapter,before,{...before,...changes},transactionView.activeSources);
        repo.commit(changes,{expectedModels:before,expectedManual:checked.expectedManual});return{status:'saved',corrected:correction};
      }finally{busy=false;}
    }
    return Object.freeze({inspect,save,read:targetMonth=>resolve(repo.read(),targetMonth)});
  }
  const api=Object.freeze({createService,resolve,validate,persistableHoldings});
  if(node)module.exports=api;else root.TradeScopeSBIVCSave=api;
})(typeof globalThis!=='undefined'?globalThis:this);
