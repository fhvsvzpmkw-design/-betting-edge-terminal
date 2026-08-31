(()=>{
  'use strict';

  if(window.__vigScopeCardViewPreferenceInstalled)return;
  window.__vigScopeCardViewPreferenceInstalled=true;

  const STORAGE_KEY='bettingEdge.preferences.cardView';
  const LINK_ID='vigScopeCardViewStylesheet';
  const SMOOTH_STYLE_ID='vigScopeScrollSmoothness';
  const STYLE_VERSION='1';
  const STYLES={
    normal:`./assets/card-normal.css?v=${STYLE_VERSION}`,
    excited:`./assets/card-excited.css?v=${STYLE_VERSION}`,
    neon:`./assets/card-neon.css?v=${STYLE_VERSION}`,
    vigscope:`./assets/card-vigscope.css?v=${STYLE_VERSION}`
  };
  const ALLOWED=new Set(Object.keys(STYLES));
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

  function ensureSmoothnessStyle(d){
    if(!d?.head)return false;
    if(d.getElementById(SMOOTH_STYLE_ID))return true;
    const style=d.createElement('style');
    style.id=SMOOTH_STYLE_ID;
    style.textContent='.term:after{display:none!important}';
    d.head.appendChild(style);
    return true
  }

  function ensureStylesheet(d,value){
    if(!d?.head)return false;
    const normalized=ALLOWED.has(value)?value:'normal';
    const href=STYLES[normalized];
    let link=d.getElementById(LINK_ID);
    if(!link){
      link=d.createElement('link');
      link.id=LINK_ID;
      link.rel='stylesheet';
      link.dataset.cardView='';
      d.head.appendChild(link)
    }
    if(link.dataset.cardView!==normalized||link.getAttribute('href')!==href){
      link.dataset.cardView=normalized;
      link.setAttribute('href',href)
    }
    return true
  }

  function apply(d,value=readValue()){
    if(!d?.documentElement)return false;
    const normalized=ALLOWED.has(value)?value:'normal';
    ensureSmoothnessStyle(d);
    ensureStylesheet(d,normalized);
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
        if(!ALLOWED.has(value))return;
        try{localStorage.setItem(STORAGE_KEY,value)}catch(e){}
        requestAnimationFrame(()=>apply(d,value))
      });
    }
    apply(d);
    return true
  }

  let bootTries=0;
  function boot(){
    const d=appDoc();
    if(d&&attach(d))return;
    bootTries+=1;
    if(bootTries<150)setTimeout(boot,40)
  }
  boot();
  window.addEventListener('pageshow',()=>{
    const d=appDoc();
    if(d)attach(d)
  });
  window.addEventListener('storage',event=>{
    if(event.key!==STORAGE_KEY)return;
    const d=appDoc();
    if(d)apply(d,readValue())
  });
  window.addEventListener('beforeunload',()=>{
    if(observer)observer.disconnect()
  },{once:true});
})();
