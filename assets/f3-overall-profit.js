(()=>{
'use strict';

let observedDocument=null;
let observer=null;
let boundApp=null;
let retryTimer=null;

function parseMoney(value){
  const raw=String(value||'').replace(/−/g,'-').replace(/[$,\s]/g,'');
  if(!raw||raw==='—')return null;
  const n=Number(raw);
  return Number.isFinite(n)?n:null;
}

function formatMoney(value){
  const n=Number(value);
  if(!Number.isFinite(n))return '—';
  const amount=Math.abs(n).toFixed(2);
  return n<0?'-$'+amount:n>0?'+$'+amount:'$0.00';
}

function ensureOverallProfit(d){
  if(!d?.body)return false;
  const grid=d.querySelector('#history .premiumFourGrid');
  const cash=d.getElementById('summaryCashProfit');
  const promo=d.getElementById('summaryPromoProfit');
  if(!grid||!cash||!promo)return false;

  let metric=d.getElementById('summaryOverallProfitMetric');
  if(!metric){
    metric=d.createElement('div');
    metric.className='premiummetric';
    metric.id='summaryOverallProfitMetric';

    const key=d.createElement('div');
    key.className='key';
    key.textContent='OVERALL PROFIT';

    const value=d.createElement('div');
    value.className='bigprice';
    value.id='summaryOverallProfit';
    value.textContent='—';

    const hint=d.createElement('div');
    hint.className='premiumhint';
    hint.textContent='CASH + PROMO PROFIT';

    metric.append(key,value,hint);
    grid.insertBefore(metric,grid.firstChild||null);
  }

  const cashValue=parseMoney(cash.textContent);
  const promoValue=parseMoney(promo.textContent);
  const valueNode=d.getElementById('summaryOverallProfit');
  if(cashValue!==null&&promoValue!==null&&valueNode){
    const next=formatMoney(cashValue+promoValue);
    if(valueNode.textContent!==next)valueNode.textContent=next;
  }
  return true;
}

function observeDocument(d){
  if(observedDocument===d&&observer){
    ensureOverallProfit(d);
    return;
  }
  if(observer)observer.disconnect();
  observedDocument=d;
  ensureOverallProfit(d);
  observer=new MutationObserver(()=>ensureOverallProfit(d));
  observer.observe(d.body,{subtree:true,childList:true,characterData:true});
}

function scheduleRetry(){
  if(retryTimer)return;
  retryTimer=setTimeout(()=>{
    retryTimer=null;
    attach();
  },100);
}

function attach(){
  let core=null,app=null,d=null;
  try{
    core=document.getElementById('core');
    app=core?.contentDocument?.getElementById('app')||null;
  }catch(e){return scheduleRetry()}
  if(!app)return scheduleRetry();

  if(boundApp!==app){
    boundApp=app;
    app.addEventListener('load',()=>setTimeout(attach,0));
  }

  try{d=app.contentDocument}catch(e){return scheduleRetry()}
  if(!d?.body)return scheduleRetry();
  observeDocument(d);
}

const core=document.getElementById('core');
if(core)core.addEventListener('load',()=>setTimeout(attach,0));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attach,{once:true});
else attach();
})();
