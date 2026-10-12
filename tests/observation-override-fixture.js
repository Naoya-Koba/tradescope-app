// Synthetic only. Never read production storage, private PDFs or real backups.
const fs=require('fs'),vm=require('vm'),crypto=require('crypto').webcrypto;
const storage=require('../assets/data-model-storage.js'),tx=require('../assets/storage-transaction.js');
const parser=require('../import/sbivc-parser.js'),pdf=require('../import/sbivc-save.js'),{fixture}=require('./sbivc-pdf-fixture.js');
const override=require('../assets/observation-override-save.js');
const now='2031-03-01T12:34:56.000Z',accountId='acc_sbivc_crypto',month='2031-02',copy=x=>JSON.parse(JSON.stringify(x));
class Memory{
 constructor(){this.data=new Map([['tradingData','{"2031":{}}'],['tradeScopeTradeHistoryV1','[{"id":"anonymous_manual","symbol":"ETH/JPY"}]']]);this.failKey=null;this.permanent=false;this.mismatch=false;}
 getItem(k){return this.data.get(k)??null;}
 setItem(k,v){if(this.failKey===k){if(!this.permanent)this.failKey=null;throw Error('quota');}this.data.set(k,v);if(this.mismatch&&k===storage.keys.monthlyAccountInputs){this.mismatch=false;this.data.set(k,'{}');}}
 removeItem(k){if(this.permanent&&this.failKey===k)throw Error('quota');this.data.delete(k);}
 snapshot(){return JSON.stringify([...this.data].sort(([a],[b])=>a.localeCompare(b)));}
}
const source=(hash='a',options={})=>({preview:parser.parse(fixture(options)),fileHash:hash.repeat(64),fileSize:128});
const pdfService=s=>pdf.createService(s,{cryptoApi:crypto,clock:()=>now});
const service=s=>override.createService(s,{clock:()=>now});
async function seed(options={}){const s=new Memory();await pdfService(s).save(source('a',options));return s;}
function draft(view){return{accountId,targetMonth:month,account:copy(view.adopted),holdings:view.holdings.map(h=>({holdingSnapshotId:h.holdingSnapshotId,instrumentId:h.instrumentId,values:Object.fromEntries(Object.entries(h.adopted).map(([k,v])=>[k,v??'']))}))};}
function backup(s){const code=fs.readFileSync('top/script.js','utf8'),context=vm.createContext({window:{location:{origin:'http://127.0.0.1:58911'},TradeScopeDataStorage:storage,TradeScopeStorageTransaction:tx},localStorage:s,
 document:{getElementById:()=>null,addEventListener(){}},isEmptyPlainRecord:v=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===0,
 PROFIT_STORAGE_KEY_TRADING:'tradingData',PROFIT_STORAGE_KEY_INITIAL:'yearInitialFunds',PROFIT_STORAGE_KEY_INITIAL_UNREALIZED:'yearInitialUnrealized',PROFIT_STORAGE_KEY_TOP_SUMMARY_SNAPSHOT:'tradeScopeTopSummarySnapshotV1',console:{log(){throw Error('logging forbidden');},error(){throw Error('logging forbidden');}}});
 vm.runInContext(code.slice(code.indexOf('// ===== Backup Format Core'),code.indexOf('function exportAllData()')),context);
 return{build:()=>context.window.TradeScopeBackupExport.buildPayload(s,'http://127.0.0.1:58911',now),format:context.window.TradeScopeBackupFormat,restore:context.window.TradeScopeBackupRestore};}
module.exports={storage,tx,now,accountId,month,copy,Memory,source,pdfService,service,seed,draft,backup};
