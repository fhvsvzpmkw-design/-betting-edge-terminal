(()=>{
  'use strict';

  // Keep the full known-good VigScope implementation in the adjacent rollback
  // file, then apply these small presentation/intelligence overlays on top.
  const legacy=document.createElement('script');
  legacy.src='./assets/report-dashboard-vigscope.js.old';
  legacy.async=false;
  document.head.appendChild(legacy);

  const STYLE_ID='vigScopeCompactPresentationFix';
  const INTEL_SCRIPT_ID='vigScopeGameWindowIntelligenceLoader';

  function applyFix(){
    let d=null;
    try{
      const core=document.getElementById('core');
      const app=core?.contentDocument?.getElementById('app');
      d=app?.contentDocument||null;
    }catch(e){return false}
    if(!d?.head)return false;
    if(d.getElementById(STYLE_ID))return true;
    const style=d.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      /* Presentation-only: remove decorative status bullet. */
      #runnerVigPicks .runnerCount .callName:before{content:none!important;display:none!important}

      /* Presentation-only: reduce the F5/navigation-to-report gap. */
      .runnerNavPad{padding-bottom:4px!important}
      .runnerNavPad+.runnerLive,#runnerLive{margin-top:0!important}
      @media(max-width:1100px){.runnerNavPad{padding-bottom:3px!important}}
      @media(max-width:720px){.runnerNavPad{padding-bottom:2px!important}}
    `;
    d.head.appendChild(style);
    return true;
  }

  function injectGameWindowIntelligence(){
    try{
      const core=document.getElementById('core');
      const d=core?.contentDocument||null;
      if(!d?.head||d.readyState!=='complete')return false;
      if(d.getElementById(INTEL_SCRIPT_ID))return true;
      const script=d.createElement('script');
      script.id=INTEL_SCRIPT_ID;
      script.src='./assets/game-window-intelligence.js?v=1';
      script.async=false;
      d.head.appendChild(script);
      return true
    }catch(e){return false}
  }

  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    const fixed=applyFix();
    const intel=injectGameWindowIntelligence();
    if((fixed&&intel)||tries>150)clearInterval(timer);
  },80);
  legacy.addEventListener('load',()=>{
    applyFix();
    injectGameWindowIntelligence();
    setTimeout(()=>{applyFix();injectGameWindowIntelligence()},100);
    setTimeout(()=>{applyFix();injectGameWindowIntelligence()},350)
  });
})();