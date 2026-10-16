(function(){
 'use strict';
 if(location.hostname!=='127.0.0.1'||!location.port)return;
 const marker='anonymousCalculationFoundationQA',result=document.getElementById('result');
 async function seed(fresh){
  if(fresh?localStorage.length:localStorage.getItem(marker)!=='synthetic-only')throw Error('fresh QA origin required');
  const response=await fetch('current-net-assets-fixture.json');if(!response.ok)throw Error('anonymous fixture unavailable');
  const data=await response.json();for(const [key,value]of Object.entries(data))localStorage.setItem(key,value);
  localStorage.setItem(marker,'synthetic-only');result.textContent='準備完了：年初GMO文字列100、LIGHT文字列200。他口座・全観測は架空値。';
 }
 document.getElementById('prepare').onclick=()=>seed(true).catch(e=>result.textContent=e.message);
 document.getElementById('restore').onclick=()=>seed(false).catch(e=>result.textContent=e.message);
 for(const button of document.querySelectorAll('[data-scenario]'))button.onclick=async()=>{
  if(localStorage.getItem(marker)!=='synthetic-only')return;
  const response=await fetch('calculation-integrity-fixture.json?scenario='+button.dataset.scenario);if(!response.ok)return;
  const data=await response.json();for(const [key,value]of Object.entries(data))if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);
  result.textContent='架空シナリオ：'+button.textContent;
 };
 document.getElementById('corrupt').onclick=()=>{
  if(localStorage.getItem(marker)!=='synthetic-only')return;
  localStorage.setItem('yearInitialFunds','broken');result.textContent='架空の年初資金JSONだけを破損しました。';
 };
 document.getElementById('inspect').onclick=()=>{
  if(localStorage.getItem(marker)!=='synthetic-only')return;
  result.textContent=localStorage.getItem('yearInitialFunds')==='broken'?'破損JSON保持：上書き・修復なし':'架空データは正常状態';
 };
 document.getElementById('cleanup').onclick=async()=>{
  if(localStorage.getItem(marker)!=='synthetic-only')return;
  const response=await fetch('current-net-assets-fixture.json');if(!response.ok)return;
  const data=await response.json();
  for(const key of [...Object.keys(data),marker,'tradeScopeTopSummarySnapshotV1','tradeScopeTopSplashSeen','tradeScopeSelectedYear','tradeScopeSelectedMonth','profitSelectedYear','profitSelectedMonth',
   'tradeScopeTopAssetTrendView','profitAssetTrendView','profitMonthlyPnlView','tradeScopePortfolioTab'])localStorage.removeItem(key);
  for(const registration of await navigator.serviceWorker.getRegistrations())await registration.unregister();
  for(const key of await caches.keys())if(key.startsWith('tradescope-static-'))await caches.delete(key);
  result.textContent='架空fixtureと検証用cache／Service Workerを清掃しました。';
 };
})();
