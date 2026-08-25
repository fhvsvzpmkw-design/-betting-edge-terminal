(()=>{
  'use strict';

  const UI_CACHE_BUST=Date.now();

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
  legacy.src=`./assets/report-dashboard-vigscope.js.old?b=${UI_CACHE_BUST}`;
  legacy.async=false;
  document.head.appendChild(legacy);

  // The schedule module owns the detailed schedule/history/VigScope display.
  const schedule=document.createElement('script');
  schedule.id='scheduleProfileUiLoader';
  schedule.src=`./assets/schedule-profile-ui.js?v=3&b=${UI_CACHE_BUST}`;
  schedule.async=false;
  document.head.appendChild(schedule);

  // The framework adds the permanent Preferences module registry and safe local
  // UI controls above the detailed schedule module.
  const preferences=document.createElement('script');
  preferences.id='preferencesFrameworkLoader';
  preferences.src=`./assets/preferences-framework.js?v=3&b=${UI_CACHE_BUST}`;
  preferences.async=false;
  document.head.appendChild(preferences);

  // Card appearance is a separate terminal-only presentation preference.
  // Each card view is loaded from its own isolated stylesheet.
  const cardView=document.createElement('script');
  cardView.id='cardViewPreferenceLoader';
  cardView.src=`./assets/card-view-preference.js?v=3&b=${UI_CACHE_BUST}`;
  cardView.async=false;
  document.head.appendChild(cardView);

  // One local authority owns the visible main-menu order and function-key map.
  // It keeps F1 VigScope and TAB Preferences fixed while allowing the middle
  // items to be press-held and reordered without mutating the canonical DOM.
  const menuOrder=document.createElement('script');
  menuOrder.id='menuOrderControllerLoader';
  menuOrder.src=`./assets/menu-order-controller.js?v=1&b=${UI_CACHE_BUST}`;
  menuOrder.async=false;
  document.head.appendChild(menuOrder);

  // VigScope, Market, Bet History and Results share the menu-first/full-page
  // navigation shell. Results reuses the internal engine route at F8 so the
  // public navigation contract does not need a disruptive route migration.
  const primaryNav=document.createElement('script');
  primaryNav.id='primaryNavShellLoader';
  primaryNav.src=`./assets/primary-nav-shell.js?v=8&b=${UI_CACHE_BUST}`;
  primaryNav.async=false;
  document.head.appendChild(primaryNav);

  // F8 Results replaces the old visible Engine panel while keeping the route
  // hook stable. It is read-only and consumes the rebuildable results index.
  const resultsDesk=document.createElement('script');
  resultsDesk.id='resultsDeskUiLoader';
  resultsDesk.src=`./assets/results-desk-ui.js?v=2&b=${UI_CACHE_BUST}`;
  resultsDesk.async=false;
  document.head.appendChild(resultsDesk);

  // Player/decision/model value overlay. The $100 player view is actual BET
  // performance only; non-BET decisions and flat-card calibration stay separate.
  const resultsPlayerScale=document.createElement('script');
  resultsPlayerScale.id='resultsPlayerScaleLoader';
  resultsPlayerScale.src=`./assets/results-player-scale.js?v=3&b=${UI_CACHE_BUST}`;
  resultsPlayerScale.async=false;
  document.head.appendChild(resultsPlayerScale);

  // Keep the issued-card and unique-selection logs compact as history grows.
  // Filters apply first; the user then chooses 10 / 25 / 50 / 100 / ALL rows.
  const resultsCardLogPagination=document.createElement('script');
  resultsCardLogPagination.id='resultsCardLogPaginationLoader';
  resultsCardLogPagination.src=`./assets/results-card-log-pagination.js?v=1&b=${UI_CACHE_BUST}`;
  resultsCardLogPagination.async=false;
  document.head.appendChild(resultsCardLogPagination);

  // Install Pizza and Crypto navigation before Meat Desk binds F7. The final
  // menu order is F4 Syndicate, F5 Pizza, F6 Crypto, F7 Meat, F8 Results.
  const specialDesks=document.createElement('script');
  specialDesks.id='specialDesksUiLoader';
  specialDesks.src=`./assets/special-desks-ui.js?v=4&b=${UI_CACHE_BUST}`;
  specialDesks.async=false;
  document.head.appendChild(specialDesks);

  // Meat Desk source library. Preferences remains re-keyed to TAB and stays
  // the permanent lowest navigation selection.
  const seasonPreviews=document.createElement('script');
  seasonPreviews.id='seasonPreviewsUiLoader';
  seasonPreviews.src=`./assets/season-previews-ui.js?v=6&b=${UI_CACHE_BUST}`;
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

      /* Presentation-only: reduce the navigation-to-report gap. */
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
      script.src=`./assets/game-window-intelligence.js?v=5&b=${UI_CACHE_BUST}`;
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