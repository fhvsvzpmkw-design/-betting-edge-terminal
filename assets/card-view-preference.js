(()=>{
  'use strict';

  if(window.__vigScopeCardViewPreferenceInstalled)return;
  window.__vigScopeCardViewPreferenceInstalled=true;

  const STORAGE_KEY='bettingEdge.preferences.cardView';
  const STYLE_ID='vigScopeCardViewStyles';
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

  function ensureStyle(d){
    if(!d?.head||d.getElementById(STYLE_ID))return;
    const style=d.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      /* Card-view framework. These rules are intentionally scoped to .runnerCard only.
         The master VigScope instrument above the cards is never themed here. */
      .runnerCard{transition:background 160ms ease,box-shadow 160ms ease,outline-color 160ms ease}
      .runnerCard .callBadge,.runnerCard .bigExec,.runnerCard .decisionFact,.runnerCard .runnerFact,.runnerCard .analysisBtn,.runnerCard .gameWindowState{transition:color 160ms ease,background 160ms ease,border-color 160ms ease,box-shadow 160ms ease,text-shadow 160ms ease}

      /* NORMAL / STANDARD — approved product baseline. No visual overrides. */
      .runnerCard[data-card-view="normal"]{outline:0 solid transparent}

      /* EXCITED — same geometry, stronger energy and hierarchy. */
      .runnerCard[data-card-view="excited"]{
        --cyan:#54efff;--yellow:#fff07a;--mag:#ff61dd;
        background:linear-gradient(180deg,#081a2d 0%,#061421 52%,#05101a 100%);
        box-shadow:0 0 0 1px rgba(84,239,255,.18),0 0 18px rgba(47,132,255,.22),inset 0 0 24px rgba(84,239,255,.035);
      }
      .runnerCard[data-card-view="excited"] .callBadge{text-shadow:0 0 8px currentColor,0 0 18px rgba(84,239,255,.34)}
      .runnerCard[data-card-view="excited"] .bigExec{text-shadow:0 0 9px rgba(84,239,255,.72);transform:scale(1.035);transform-origin:right center}
      .runnerCard[data-card-view="excited"] .decisionFact,.runnerCard[data-card-view="excited"] .runnerFact{background:linear-gradient(180deg,#031421,#020b12);box-shadow:inset 0 0 12px rgba(84,239,255,.035)}
      .runnerCard[data-card-view="excited"] .stakeFact .value{text-shadow:0 0 8px rgba(84,239,255,.45)}
      .runnerCard[data-card-view="excited"] .analysisBtn{box-shadow:0 0 10px rgba(255,233,107,.18),inset 0 0 12px rgba(255,233,107,.045)}
      .runnerCard[data-card-view="excited"] .gameWindowState{box-shadow:0 0 8px rgba(255,97,120,.12)}

      /* NEON — brighter Vegas/night-sign presentation, same information layout. */
      .runnerCard[data-card-view="neon"]{
        --cyan:#4df6ff;--yellow:#ffe65a;--mag:#ff4fd8;--muted:#9bb9c5;
        background:linear-gradient(135deg,rgba(7,13,32,.98),rgba(3,7,19,.99) 55%,rgba(16,4,28,.96));
        outline:1px solid rgba(255,79,216,.52);outline-offset:-5px;
        box-shadow:0 0 18px rgba(77,246,255,.27),0 0 30px rgba(255,79,216,.10),inset 0 0 28px rgba(255,79,216,.035);
      }
      .runnerCard[data-card-view="neon"] .callBadge{text-shadow:0 0 6px currentColor,0 0 16px currentColor}
      .runnerCard[data-card-view="neon"] .bigExec{color:#64f7ff;text-shadow:0 0 7px #4df6ff,0 0 18px rgba(255,79,216,.35)}
      .runnerCard[data-card-view="neon"] .decisionFact,.runnerCard[data-card-view="neon"] .runnerFact{border-color:#28566a;background:linear-gradient(180deg,rgba(4,14,28,.96),rgba(6,8,22,.98));box-shadow:inset 0 0 10px rgba(77,246,255,.03)}
      .runnerCard[data-card-view="neon"] .decisionFact:nth-child(even){border-color:#60305f}
      .runnerCard[data-card-view="neon"] .analysisBtn{border-color:#ffe65a;color:#ffe65a;background:linear-gradient(90deg,#251e02,#171106,#251e02);text-shadow:0 0 7px rgba(255,230,90,.5);box-shadow:0 0 10px rgba(255,230,90,.22)}
      .runnerCard[data-card-view="neon"] .priceState{box-shadow:0 0 7px rgba(77,246,255,.10)}
      .runnerCard[data-card-view="neon"] .gameWindowState{text-shadow:0 0 5px currentColor;box-shadow:0 0 8px currentColor}

      /* VIG SCOPE — per-card instrument shell. This is intentionally a first-pass
         visual foundation; probe/trace treatment can be refined independently later. */
      .runnerCard[data-card-view="vigscope"]{
        --cyan:#78ffc0;--green:#78ffc0;--yellow:#f3e875;--mag:#6de8ff;--muted:#82aa9a;--line:#245a48;
        background-color:#020b09;
        background-image:
          linear-gradient(rgba(120,255,192,.035) 1px,transparent 1px),
          linear-gradient(90deg,rgba(120,255,192,.035) 1px,transparent 1px),
          radial-gradient(circle at 50% 0%,rgba(54,255,169,.065),transparent 48%);
        background-size:18px 18px,18px 18px,100% 100%;
        outline:1px solid rgba(120,255,192,.24);outline-offset:-5px;
        box-shadow:0 0 16px rgba(120,255,192,.12),inset 0 0 30px rgba(41,255,160,.035);
      }
      .runnerCard[data-card-view="vigscope"] .callBadge{letter-spacing:.11em;text-shadow:0 0 8px currentColor}
      .runnerCard[data-card-view="vigscope"] .bigExec{color:#8affca;text-shadow:0 0 8px rgba(120,255,192,.52)}
      .runnerCard[data-card-view="vigscope"] .decisionFact,.runnerCard[data-card-view="vigscope"] .runnerFact{border-color:#245a48;background:rgba(1,12,9,.86);box-shadow:inset 0 0 12px rgba(120,255,192,.025)}
      .runnerCard[data-card-view="vigscope"] .decisionFact .key,.runnerCard[data-card-view="vigscope"] .runnerFact .key{color:#8deec0}
      .runnerCard[data-card-view="vigscope"] .analysisBtn{border-color:#91d8b4;color:#b7ffd9;background:#07150f;box-shadow:inset 0 0 12px rgba(120,255,192,.04)}
      .runnerCard[data-card-view="vigscope"] .priceState{border-color:#356b57;color:#91bbaa;background:#03100c}
      .runnerCard[data-card-view="vigscope"] .gameWindowState{box-shadow:0 0 7px rgba(120,255,192,.12)}

      @media(max-width:520px){
        .runnerCard[data-card-view="excited"] .bigExec{transform:none}
        .runnerCard[data-card-view="neon"],.runnerCard[data-card-view="vigscope"]{outline-offset:-3px}
      }
    `;
    d.head.appendChild(style)
  }

  function apply(d,value=readValue()){
    if(!d?.documentElement)return false;
    ensureStyle(d);
    const normalized=ALLOWED.has(value)?value:'normal';
    d.documentElement.dataset.cardView=normalized;
    if(d.body)d.body.dataset.cardView=normalized;
    d.querySelectorAll('.runnerCard').forEach(card=>card.dataset.cardView=normalized);
    lastValue=normalized;
    return true
  }

  function attach(d){
    if(!d?.body)return false;
    ensureStyle(d);
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
