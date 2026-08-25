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

  function bindCryptoAnalysisButtons(d){
    if(!d?.body)return;
    d.querySelectorAll('#runnerCryptoWorkspace [data-crypto-detail]').forEach(button=>{
      if(button.dataset.cryptoDirectBound==='1')return;
      button.dataset.cryptoDirectBound='1';
      button.onclick=event=>{
        event.preventDefault();
        event.stopPropagation();
        const id=button.dataset.cryptoDetail;
        const detail=id?d.getElementById(id):null;
        if(!detail)return;
        const open=!detail.classList.contains('open');
        detail.classList.toggle('open',open);
        button.textContent=open?'▼ HIDE ANALYSIS':'▶ VIEW ANALYSIS';
      };
    });
    if(d.documentElement.dataset.cryptoAnalysisObserverBound==='1')return;
    d.documentElement.dataset.cryptoAnalysisObserverBound='1';
    const observer=new MutationObserver(()=>requestAnimationFrame(()=>bindCryptoAnalysisButtons(d)));
    observer.observe(d.body,{subtree:true,childList:true});
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
    bindCryptoAnalysisButtons(d);
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

      /* Pizza Plays is a ticket view, not a second analysis dashboard. */
      body.runnerPizzaLoaded #runnerPizzaWorkspace .deskSectionBar{display:none!important}
      body.runnerPizzaLoaded #runnerPizzaWorkspace .pizzaBoard{margin-top:10px!important;gap:0!important}
      body.runnerPizzaLoaded #runnerPizzaWorkspace .pizzaPick{
        border:1px solid #a85d2b!important;
        border-left:4px solid #ff9a49!important;
        background:linear-gradient(180deg,#100703,#060301)!important;
        padding:13px 14px!important;
        box-shadow:inset 0 0 0 1px rgba(255,174,98,.025),0 0 14px rgba(203,88,28,.08)!important;
        font-size:15px!important;
      }
      body.runnerPizzaLoaded #runnerPizzaWorkspace .pizzaPickHead{align-items:center!important;gap:12px!important}
      body.runnerPizzaLoaded #runnerPizzaWorkspace .pizzaLouTag{
        border:1px solid #ff9346!important;
        padding:5px 9px!important;
        font-size:11px!important;
        box-shadow:none!important;
      }
      body.runnerPizzaLoaded #runnerPizzaWorkspace .pizzaPick h3{
        margin-top:8px!important;
        font-size:clamp(22px,3vw,28px)!important;
        line-height:1.12!important;
      }
      body.runnerPizzaLoaded #runnerPizzaWorkspace .pizzaSourceState{min-width:150px!important}
      body.runnerPizzaLoaded #runnerPizzaWorkspace .pizzaSourceState small{font-size:9px!important;margin-bottom:3px!important}
      body.runnerPizzaLoaded #runnerPizzaWorkspace .pizzaSourceState strong{font-size:16px!important}
      body.runnerPizzaLoaded #runnerPizzaWorkspace .pizzaSourceState span{font-size:8px!important;margin-top:3px!important}
      body.runnerPizzaLoaded #runnerPizzaWorkspace .pizzaMarketStrip{
        margin-top:11px!important;
        border:1px dashed #84451f!important;
        border-left:0!important;
        border-right:0!important;
        background:#080402!important;
        padding:10px 3px!important;
        grid-template-columns:repeat(4,minmax(0,1fr))!important;
        gap:8px!important;
        box-shadow:none!important;
      }
      body.runnerPizzaLoaded #runnerPizzaWorkspace .pizzaMarketCell{padding:0 8px!important;border-left:1px solid #4a2817!important}
      body.runnerPizzaLoaded #runnerPizzaWorkspace .pizzaMarketCell:first-child{border-left:0!important}
      body.runnerPizzaLoaded #runnerPizzaWorkspace .pizzaMarketCell small{font-size:9px!important;margin-bottom:4px!important}
      body.runnerPizzaLoaded #runnerPizzaWorkspace .pizzaMarketCell strong{font-size:16px!important;line-height:1.28!important}
      body.runnerPizzaLoaded #runnerPizzaWorkspace .pizzaEventMeta{
        margin-top:7px!important;
        padding:7px 1px 0!important;
        border:0!important;
        border-top:1px solid #442414!important;
        background:transparent!important;
        font-size:11px!important;
        gap:4px 12px!important;
        box-shadow:none!important;
      }
      body.runnerPizzaLoaded #runnerPizzaWorkspace .pizzaEventMeta b{font-size:8px!important}
      body.runnerPizzaLoaded #runnerPizzaWorkspace .pizzaExplainGrid{
        display:grid!important;
        grid-template-columns:1fr 1fr!important;
        gap:7px!important;
        margin-top:9px!important;
      }
      body.runnerPizzaLoaded #runnerPizzaWorkspace .pizzaExplainGrid .pizzaExplain:nth-child(1),
      body.runnerPizzaLoaded #runnerPizzaWorkspace .pizzaExplainGrid .pizzaExplain:nth-child(2){display:none!important}
      body.runnerPizzaLoaded #runnerPizzaWorkspace .pizzaExplain{
        min-height:0!important;
        padding:9px 10px!important;
        background:#090402!important;
        border:1px solid #4f2a18!important;
        box-shadow:none!important;
      }
      body.runnerPizzaLoaded #runnerPizzaWorkspace .pizzaExplain small{font-size:9px!important;margin-bottom:5px!important}
      body.runnerPizzaLoaded #runnerPizzaWorkspace .pizzaExplain strong{font-size:12px!important;line-height:1.42!important}
      body.runnerPizzaLoaded #runnerPizzaWorkspace .pizzaExplain.lou{border-left:3px solid #ff9a49!important}
      body.runnerPizzaLoaded #runnerPizzaWorkspace .pizzaExplain.watch{border-left:3px solid #c86a3b!important}
      body.runnerPizzaLoaded #runnerPizzaWorkspace .pizzaSourceNote{
        margin-top:8px!important;
        padding-top:7px!important;
        border-top:1px dashed #4a2817!important;
        color:#80604e!important;
        font-size:9px!important;
        line-height:1.45!important;
      }
      body.runnerPizzaLoaded #runnerPizzaWorkspace .pizzaSourceNote b{color:#a97859!important}
      body.runnerPizzaLoaded #runnerPizzaWorkspace .pizzaTimestamp{margin-top:7px!important;font-size:8px!important}
      @media(max-width:720px){
        body.runnerPizzaLoaded #runnerPizzaWorkspace .pizzaPick{padding:11px!important}
        body.runnerPizzaLoaded #runnerPizzaWorkspace .pizzaMarketStrip{grid-template-columns:repeat(2,minmax(0,1fr))!important;row-gap:10px!important}
        body.runnerPizzaLoaded #runnerPizzaWorkspace .pizzaMarketCell:nth-child(3){border-left:0!important}
        body.runnerPizzaLoaded #runnerPizzaWorkspace .pizzaExplainGrid{grid-template-columns:1fr!important}
      }
      @media(max-width:560px){
        body.runnerPizzaLoaded #runnerPizzaWorkspace .pizzaPickHead{display:block!important}
        body.runnerPizzaLoaded #runnerPizzaWorkspace .pizzaSourceState{text-align:left!important;min-width:0!important;margin-top:8px!important}
        body.runnerPizzaLoaded #runnerPizzaWorkspace .pizzaMarketStrip{grid-template-columns:1fr 1fr!important}
        body.runnerPizzaLoaded #runnerPizzaWorkspace .pizzaMarketCell strong{font-size:15px!important}
      }
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