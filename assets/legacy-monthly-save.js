(function(root) {
  'use strict';
  const node=typeof module!=='undefined'&&module.exports;
  const tx=node?require('./storage-transaction.js'):root.TradeScopeStorageTransaction;
  const storage=node?require('./data-model-storage.js'):root.TradeScopeDataStorage;
  const keys=['gmo','lightfx','minano','sbi','sbivc','smbc'];
  function createService(adapter) {
    function save({year,month,accountKey,row,expectedRow}) {
      if(!Number.isInteger(year)||year<1000||!Number.isInteger(month)||month<1||month>12||!keys.includes(accountKey)
        ||(['sbi','gmo'].includes(accountKey)&&`${year}-${String(month).padStart(2,'0')}`>='2026-09')) throw Error('保存対象を確認してください');
      storage.assertJson(row);
      if(!row||Array.isArray(row)||typeof row!=='object')throw Error('入力値を確認してください');
      if(!['realizedPnL','swapPnL','unrealizedPnL','deposit','withdrawal','monthEndBalance','netAssets']
        .some(field=>row[field]!=null&&String(row[field]).trim()!==''&&Number.isFinite(Number(row[field]))))throw Error('入力されたデータがありません');
      let data;try{data=JSON.parse(adapter.getItem('tradingData')||'{}');storage.assertJson(data);}catch(_){throw Error('既存の月次データを読み取れません');}
      if(!data||Array.isArray(data)||typeof data!=='object')throw Error('既存の月次データを読み取れません');
      const previous=data[year]?.[month]?.[accountKey]||{};
      if(expectedRow&&JSON.stringify(previous)!==JSON.stringify(expectedRow))throw Error('保存データが変更されています。再確認してください');
      const next=JSON.parse(JSON.stringify(data));next[year]??={};next[year][month]??={};
      // Preserve the historic month-wide flag; new explicit zero evidence belongs to this account only.
      next[year][month][accountKey]={...row,__saved:true};
      const raw=JSON.stringify(next);
      tx.apply([{type:'set',storageKey:'tradingData',rawValue:raw},{type:'remove',storageKey:'tradeScopeTopSummarySnapshotV1'}],adapter,()=>{
        if(adapter.getItem('tradingData')!==raw)throw Error('保存内容を確認できません');
      });
      return {status:'saved',data:next,row:next[year][month][accountKey]};
    }
    return Object.freeze({save});
  }
  const api=Object.freeze({createService});if(node)module.exports=api;else root.TradeScopeLegacyMonthlySave=api;
})(typeof globalThis!=='undefined'?globalThis:this);
