(function(){
 'use strict';
 document.getElementById('prepare').onclick=async()=>{
  const result=document.getElementById('result');
  try{
   if(location.hostname!=='127.0.0.1'||!location.port||localStorage.length)throw Error('fresh localhost origin required');
   const response=await fetch('current-net-assets-fixture.json');if(!response.ok)throw Error('anonymous fixture unavailable');
   const data=await response.json();for(const [key,value]of Object.entries(data))localStorage.setItem(key,value);
   result.textContent='準備完了：9月SBI VC観測／期間計算8月／2025年の過去月／2028年の空年。全て架空値。';
  }catch(error){result.textContent=error.message;}
 };
})();
