(()=>{
  'use strict';

  // Apply the saved meter-presentation preference before the known-good
  // VigScope renderer boots so its existing query-parameter switch remains
  // the single rendering path.
  try{
    const saved=localStorage.getItem('bettingEdge.preferences.meterPresentation');
    const meter=saved==='rails'?'rails':saved==='blocks'?'blocks':null;
    if(meter){
      const url=new URL(location.href);
      if(url.searchParams.get('meters')!==meter){
        url.searchParams.set('meters',meter);
        history.replaceState(null,'',url.pathname+url.search+url.hash);
      }
    }
  }catch(e){}

  // New Meat Desk and Crypto Specials sources start with a lightweight review
  // unless the user has explicitly selected a deeper mode in Preferences.
  try{
    const defaults=[
      'bettingEdge.preferences.meatDeskAnalysisMode',
      'bettingEdge.preferences.cryptoSpecialsAnalysisMode'
    ];
    defaults.forEach(key=>{
      if(localStorage.getItem(key)===null)localStorage.setItem(key,'basic_readthrough');
    });
  }catch(e){}

  // Keep the full known-good VigScope implementation in the adjacent rollback
  // file, then apply these small presentation/intelligence overlays on top.
  const legacy=document.createElement('script');
  legacy.src='./assets/report-dashboard-vigscope.js.old';
  legacy.async=false;
  document.head.appendChild(legacy);

  // The schedule module owns the detailed schedule/history/VigScope display.
  const schedule=document.createElement('script');
  schedule.id='scheduleProfileUiLoader';
  schedule.src='./assets/schedule-profile-ui.js?v=3';
  schedule.async=false;
  document.head.appendChild(schedule);

  // The framework adds the permanent Preferences module registry and safe local
  // UI controls above the detailed schedule module.
  const preferences=document.createElement('script');
  preferences.id='preferencesFrameworkLoader';
  preferences.src='./assets/preferences-framework.js?v=3';
  preferences.async=false;
  document.head.appendChild(preferences);

  // Card appearance is a separate terminal-only presentation preference.
  // Each card view is loaded from its own isolated stylesheet.
  const cardView=document.createElement('script');
  cardView.id='cardViewPreferenceLoader';
  cardView.src='./assets/card-view-preference.js?v=3';
  cardView.async=false;
  document.head.appendChild(cardView);

  // F1-F4 share the menu-first/full-page navigation shell. In menu view they
  // use the same full-width, two-line bar geometry as the other desk buttons.
  const primaryNav=document.createElement('script');
  primaryNav.id='primaryNavShellLoader';
  primaryNav.src='./assets/primary-nav-shell.js?v=6';
  primaryNav.async=false;
  document.head.appendChild(primaryNav);

  // Install the permanent F6/F7/F8 desk navigation before Meat Desk binds its
  // legacy F6 shortcut. The desk overlay owns F6 Pizza, F7 Crypto and F8 Meat.
  const specialDesks=document.createElement('script');
  specialDesks.id='specialDesksUiLoader';
  specialDesks.src='./assets/special-desks-ui.js?v=3';
  specialDesks.async=false;
  document.head.appendChild(specialDesks);

  // Meat Desk source library. Preferences remains re-keyed to TAB and stays
  // the permanent lowest navigation selection.
  const seasonPreviews=document.createElement('script');
  seasonPreviews.id='seasonPreviewsUiLoader';
  seasonPreviews.src='./assets/season-previews-ui.js?v=5';
  seasonPreviews.async=false;
  document.head.appendChild(seasonPreviews);

  const STYLE_ID='vigScopeCompactPresentationFix';
  const INTEL_SCRIPT_ID='vigScopeGameWindowIntelligenceLoader';

  function pinInnerTop(d){
    try{
      if(d.documentElement)d.documentElement.scrollTop=0;
      if(d.body)d.body.scrollTop=0;
      if(d.scrollingElement)d.scrollingElement.scrollTop=0;
      d.defaultView?.scrollTo({top:0,left:0,behavior:'auto'});
    }catch(e){}
  }

  function bindPreferencesPage(d){
    if(d.documentElement.dataset.vigScopePreferencesPageBound==='1')return;
    d.documentElement.dataset.vigScopePreferencesPageBound='1';
    d.addEventListener('click',event=>{
      const button=event.target.closest?.('#runnerPreferencesF6');
      if(!button)return;
      requestAnimationFrame(()=>pinInnerTop(d));
      setTimeout(()=>pinInnerTop(d),80);
      setTimeout(()=>pinInnerTop(d),220);
    });
  }

  function applyFix(){
    let d=null;
    try{
      const core=document.getElementById('core');
      const app=core?.contentDocument?.getElementById('app');
      d=app?.contentDocument||null;
    }catch(e){return false}
    if(!d?.head)return false;
    bindPreferencesPage(d);
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

      /* Preferences uses the same isolated full-page shell as Load Syndicate. */
      body.runnerPreferencesLoaded .top{display:none!important}
      body.runnerPreferencesLoaded .runnerNavPad{padding-top:8px!important;padding-bottom:0!important;margin-top:0!important}
      body.runnerPreferencesLoaded .runnerNavPad .tabs>.btn:not(#runnerPreferencesF6){display:none!important}
      body.runnerPreferencesLoaded #runnerPreferencesF6{grid-column:1/-1!important;display:grid!important;place-items:center!important}
      body.runnerPreferencesLoaded #runnerSchedulePreferences{display:block!important;margin-top:0!important}
      body.runnerPreferencesLoaded #runnerSchedulePreferences~*{display:none!important}
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
      script.src='./assets/game-window-intelligence.js?v=4';
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
