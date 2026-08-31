(()=>{
'use strict';

const LEDGER_URL='./data/bet-history-public.json';
let latestText=null;
let latestBankrollCad=null;
let observedDocument=null;
let observer=null;
let boundApp=null;
let retryTimer=null;
let refreshPromise=null;
let lastRefreshAt=0;

function formatCad(value){
  const n=Number(value);
  return Number.isFinite(n)?'$'+n.toFixed(2):null;
}

function innerDocument(){
  try{
    const core=document.getElementById('core');
    const app=core?.contentDocument?.getElementById('app')||null;
    return {app,d:app?.contentDocument||null};
  }catch(e){return {app:null,d:null}}
}

function pizzaCurrentUnitNode(d){
  for(const metric of d.querySelectorAll('#resultsPizzaValueBox .pizzaMetric')){
    const key=String(metric.querySelector('.key')?.textContent||'').trim().toUpperCase();
    if(key==='CURRENT UNIT')return metric.querySelector('b');
  }
  return null;
}

function applyLatest(d){
  if(!d?.body||!latestText)return false;
  const source=d.getElementById('masterBankroll');
  const visible=d.querySelector('#runnerBankrollCompact .runnerBankrollValue');
  const pizzaUnit=pizzaCurrentUnitNode(d);
  const pizzaUnitText=Number.isFinite(latestBankrollCad)?formatCad(latestBankrollCad*0.03):null;
  if(source&&source.textContent!==latestText)source.textContent=latestText;
  if(visible&&visible.textContent!==latestText)visible.textContent=latestText;
  if(pizzaUnit&&pizzaUnitText&&pizzaUnit.textContent!==pizzaUnitText)pizzaUnit.textContent=pizzaUnitText;
  return Boolean(source||visible||pizzaUnit);
}

function observeInner(){
  const {app,d}=innerDocument();
  if(!app||!d?.body)return scheduleRetry();

  if(boundApp!==app){
    boundApp=app;
    app.addEventListener('load',()=>{
      setTimeout(()=>{observeInner();refresh(true)},0);
      setTimeout(()=>applyCurrent(),120);
    });
  }

  if(observedDocument!==d){
    if(observer)observer.disconnect();
    observedDocument=d;
    observer=new MutationObserver(()=>applyLatest(d));
    const targets=[d.querySelector('.top'),d.getElementById('engine')].filter(Boolean);
    targets.forEach(target=>observer.observe(target,{subtree:true,childList:true}));
  }

  applyLatest(d);
}

function applyCurrent(){
  const {d}=innerDocument();
  if(d?.body)applyLatest(d);
}

function scheduleRetry(){
  if(retryTimer)return;
  retryTimer=setTimeout(()=>{
    retryTimer=null;
    observeInner();
  },80);
}

async function refresh(force=false){
  const now=Date.now();
  if(!force&&refreshPromise)return refreshPromise;
  if(!force&&now-lastRefreshAt<5000){applyCurrent();return null;}
  lastRefreshAt=now;

  refreshPromise=(async()=>{
    try{
      const response=await fetch(`${LEDGER_URL}?header_sync=${Date.now()}`,{cache:'no-store'});
      if(!response.ok)throw new Error(`ledger ${response.status}`);
      const payload=await response.json();
      const bankrollCad=Number(payload?.bankrollCad);
      const next=formatCad(bankrollCad);
      if(!next||!Number.isFinite(bankrollCad))throw new Error('invalid bankrollCad');
      latestText=next;
      latestBankrollCad=bankrollCad;
      observeInner();
      applyCurrent();
      setTimeout(applyCurrent,80);
      setTimeout(applyCurrent,300);
      return next;
    }catch(error){
      console.warn('Header bankroll sync failed',error);
      return null;
    }finally{
      refreshPromise=null;
    }
  })();
  return refreshPromise;
}

const core=document.getElementById('core');
if(core)core.addEventListener('load',()=>{
  setTimeout(observeInner,0);
  setTimeout(()=>refresh(true),0);
});
window.addEventListener('pageshow',()=>refresh(true));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh(true)});
window.addEventListener('focus',()=>refresh());

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',()=>{observeInner();refresh(true)},{once:true});
}else{
  observeInner();
  refresh(true);
}
})();
