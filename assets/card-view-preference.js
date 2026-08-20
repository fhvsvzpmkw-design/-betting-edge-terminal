(()=>{
  'use strict';

  if(window.__vigScopeCardViewPreferenceInstalled)return;
  window.__vigScopeCardViewPreferenceInstalled=true;

  const STORAGE_KEY='bettingEdge.preferences.cardView';
  const ALLOWED=new Set(['normal','excited','neon','vigscope']);
  let lastDoc=null,observer=null,lastValue='';

  function appDoc(){
    try{
      const core=document.getElementById('core');
      const app=core?.contentDocument?.getElementById('app');
      return app?.contentDocument||null;
    }catch(e){return null}
  }

  function readValue(){
    try{
      const raw=String(localStorage.getItem(STORAGE_KEY)||'normal').toLowerCase();
      return ALLOWED.has(raw)?raw:'normal'
    }catch(e){return 'normal'}
  }

  function apply(d,value=readValue()){
    if(!d?.documentElement)return false;
    const normalized=ALLOWED.has(value)?value:'normal';
    d.documentElement.dataset.cardView=normalized;
    if(d.body)d.body.dataset.cardView=normalized;
    d.querySelectorAll('.runnerCard').forEach(card=>card.dataset.cardView=normalized);
    lastValue=normalized;
    return true
  }

  function attach(d){
    if(!d?.body)return false;
    if(d!==lastDoc){
      lastDoc=d;
      if(observer)observer.disconnect();
      observer=new MutationObserver(()=>requestAnimationFrame(()=>apply(d)));
      observer.observe(d.body,{subtree:true,childList:true});
      d.addEventListener('change',event=>{
        const control=event.target?.closest?.('[data-pref-choice="card_view"]');
        if(!control)return;
        const value=String(control.value||'normal').toLowerCase();
        if(ALLOWED.has(value)){
          try{localStorage.setItem(STORAGE_KEY,value)}catch(e){}
          requestAnimationFrame(()=>apply(d,value))
        }
      });
    }
    apply(d);
    return true
  }

  const timer=setInterval(()=>{
    const d=appDoc();
    if(d)attach(d);
    const current=readValue();
    if(d&&current!==lastValue)apply(d,current)
  },150);

  window.addEventListener('beforeunload',()=>{
    clearInterval(timer);
    if(observer)observer.disconnect()
  },{once:true});
})();
