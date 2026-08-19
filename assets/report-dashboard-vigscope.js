(()=>{
  'use strict';

  const STYLE_ID='runnerDashboardReorgVigScope';
  const ASSET_BASE='./assets/vig-scope';
  let observer=null;
  let observedDocument=null;
  let frameHandle=0;

  function selectedMeterVariant(){
    try{
      const own=new URLSearchParams(location.search);
      const topParams=window.top&&window.top!==window?new URLSearchParams(window.top.location.search):null;
      const raw=(topParams&&topParams.get('meters'))||own.get('meters')||'';
      return String(raw).toLowerCase()==='blocks'?'blocks':'rails';
    }catch(e){return 'rails'}
  }

  function schedulePatch(d){
    if(frameHandle)return;
    frameHandle=requestAnimationFrame(()=>{
      frameHandle=0;
      patchDashboard(d);
    });
  }

  function ensureStyle(d){
    if(d.getElementById(STYLE_ID))return;
    const style=d.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      #runnerLive{padding:10px!important}
      #runnerLive .runnerHead{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:14px!important;align-items:start!important}
      #runnerLive .runnerHeadRight{display:block!important;width:auto!important;min-width:285px!important;max-width:470px!important}
      #runnerLive .runnerFresh{margin:0!important;padding:7px 9px!important;border:1px solid #2a6240!important;background:#020b07!important;display:flex!important;flex-wrap:wrap!important;justify-content:flex-end!important;align-items:center!important;gap:5px 10px!important;text-align:right!important;line-height:1.2!important}
      #runnerLive .runnerFresh .feedMeta{order:1!important;color:var(--green)!important}
      #runnerLive .runnerFresh .marketStateLabel{order:2!important;color:#9cc8aa!important;font-size:8px!important;opacity:.72}
      #runnerLive .sessionStrip{margin-top:10px!important;gap:7px!important}
      #runnerLive .sessionChip{min-height:44px!important;padding:8px 6px!important;font-size:11px!important}

      /* VIG SCOPE = PICKS + INPUTS + VIG METER */
      #runnerMarketIntel{margin-top:10px;border:2px solid #36a35c;background:linear-gradient(180deg,#010b07 0%,#010604 100%);padding:10px;box-shadow:inset 0 0 26px rgba(0,255,120,.04),0 0 8px rgba(0,255,120,.035)}
      .runnerMarketIntelTitle{margin:0 0 9px;color:var(--green);font-size:14px;font-weight:1000;letter-spacing:.18em;text-transform:uppercase;text-shadow:0 0 7px rgba(88,255,136,.18)}
      .runnerVigScopeRow{display:grid;grid-template-columns:minmax(280px,.9fr) minmax(300px,1fr) minmax(330px,1.08fr);gap:10px;align-items:stretch;min-height:228px}
      .runnerVigSection{min-width:0;border:1px solid #31583b;background:linear-gradient(180deg,#020b08,#010604);padding:8px;display:grid;grid-template-rows:auto minmax(0,1fr)}
      .runnerVigSectionTitle{color:#86ad91;font-size:7px;font-weight:950;letter-spacing:.14em;text-transform:uppercase;margin:0 0 7px;text-align:left}

      /* SECTION 1 — PICKS */
      #runnerVigPicks{background:linear-gradient(180deg,#020b13,#010810);border-color:#285368}
      #runnerVigPicks .runnerVigSectionTitle{color:#78b6c7}
      #runnerVigPicks .runnerCounts{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;grid-template-rows:repeat(2,minmax(0,1fr))!important;gap:0!important;margin:0!important;padding:0!important;border:1px solid #285368!important;background:#010911!important;overflow:hidden!important;height:100%!important}
      #runnerVigPicks .runnerCount{min-height:88px!important;margin:0!important;padding:8px 7px!important;border:0!important;border-left:1px solid #24475b!important;border-top:1px solid #24475b!important;background:linear-gradient(180deg,#020b14,#010811)!important;display:grid!important;align-content:center!important;text-align:center!important}
      #runnerVigPicks .runnerCount:nth-child(odd){border-left:0!important}
      #runnerVigPicks .runnerCount:nth-child(-n+2){border-top:0!important}
      #runnerVigPicks .runnerCount b{font-size:clamp(34px,4vw,48px)!important;margin-top:4px!important;line-height:.95!important}
      #runnerVigPicks .runnerCount .callName{font-size:11px!important;letter-spacing:.13em!important}
      #runnerVigPicks .runnerRiskMini{margin-top:5px!important;padding-top:4px!important;border-top:1px dotted #204555!important;font-size:6.5px!important;gap:5px!important}
      #runnerVigPicks .runnerRiskMini .runnerRiskValue{font-size:8.5px!important}

      /* SECTION 2 — INPUT METERS */
      #runnerVigContributors{padding:8px;display:grid;grid-template-rows:auto minmax(0,1fr)}
      #runnerVigContributors .runnerContributorTitle{display:none!important}
      #runnerVigContributors .instrumentCluster{display:grid!important;grid-template-columns:1fr!important;grid-template-rows:repeat(3,minmax(0,1fr))!important;gap:0!important;width:100%!important;height:100%!important;border:1px solid #31583b!important;background:#010604!important;overflow:hidden!important}
      #runnerVigContributors .instrument{min-height:64px!important;height:auto!important;padding:8px 9px 7px!important;display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;grid-template-areas:'label read' 'rail rail' 'conf conf'!important;align-content:center!important;align-items:center!important;gap:4px 9px!important;border:0!important;border-top:1px solid #23482f!important;background:repeating-linear-gradient(0deg,rgba(0,255,135,.013) 0,rgba(0,255,135,.013) 1px,transparent 1px,transparent 3px),linear-gradient(180deg,#020b08,#010604)!important;box-shadow:none!important}
      #runnerVigContributors .instrument:first-child{border-top:0!important}
      #runnerVigContributors .instrumentLabel{grid-area:label!important;font-size:9px!important;letter-spacing:.055em!important;margin:0!important;text-align:left!important;white-space:nowrap!important}
      #runnerVigContributors .instrument:last-child .instrumentLabel{font-size:8.4px!important}
      #runnerVigContributors .instrumentScale,#runnerVigContributors .instrument svg,#runnerVigContributors .instrumentBand{display:none!important}
      #runnerVigContributors .instrumentRead{grid-area:read!important;display:flex!important;justify-content:flex-end!important;align-items:baseline!important;gap:5px!important;min-height:0!important;margin:0!important;padding:0!important;font-size:9px!important;white-space:nowrap!important;text-align:right!important}
      #runnerVigContributors .instrumentRead b{font-size:27px!important;line-height:.95!important;color:var(--cyan)!important}
      #runnerVigContributors .instrumentConf{grid-area:conf!important;font-size:6px!important;margin:0!important;text-align:right!important;color:#789487!important}
      .runnerMiniRail{grid-area:rail;position:relative;height:8px;margin-top:3px;border:1px solid #274b33;background:#061109;overflow:visible}
      .runnerMiniRailTrack{position:absolute;inset:0;opacity:.95}
      .instrument[data-meter-kind='heat'] .runnerMiniRailTrack{background:linear-gradient(90deg,#00ff78 0%,#a9d92e 28%,#ffd43b 50%,#ff7a2f 72%,#ff334f 100%)}
      .instrument[data-meter-kind='pressure'] .runnerMiniRailTrack,.instrument[data-meter-kind='agreement'] .runnerMiniRailTrack{background:linear-gradient(90deg,#ff334f 0%,#ff7a2f 27%,#ffd43b 50%,#a9d92e 72%,#00ff78 100%)}
      .runnerMiniRailMarker{position:absolute;top:-3px;left:calc(var(--meter-value,50) * 1%);width:2px;height:12px;background:#effff3;box-shadow:0 0 5px rgba(235,255,240,.65);transform:translateX(-1px)}
      .runnerLedBlocks{display:none}

      /* SECTION 3 — VIG METER */
      #runnerVigScope{padding:8px;display:grid;grid-template-rows:auto minmax(0,1fr) auto;background:#010503;border-color:#3d7b4d}
      #runnerVigScope .runnerVigScopeTitle{display:none!important}
      .runnerVigScopeFrame{position:relative;min-height:0;height:100%;overflow:hidden;background:#000;border:1px solid #245e39;display:grid;place-items:center;padding:5px;box-shadow:inset 0 0 20px rgba(0,0,0,.64)}
      .runnerVigScopeAsset{display:block;width:100%;height:100%;max-width:100%;max-height:100%;object-fit:contain;object-position:center;background:#000}
      .runnerVigScopeFallback{display:none;color:var(--yellow);padding:12px;text-align:center;font-size:9px;font-weight:900;letter-spacing:.06em}
      #runnerVigScope.assetError .runnerVigScopeAsset{display:none}
      #runnerVigScope.assetError .runnerVigScopeFallback{display:block}
      .runnerVigScopeKey{margin-top:6px;color:#b1d8bc;font-size:8px;font-weight:900;letter-spacing:.11em;text-align:center;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

      /* Optional comparison style: segmented LEDs. */
      #runnerMarketIntel[data-meter-variant='blocks'] #runnerVigContributors .instrument{grid-template-columns:minmax(86px,.7fr) minmax(110px,1fr) auto!important;grid-template-areas:'label blocks read' 'conf conf conf'!important;gap:5px 9px!important}
      #runnerMarketIntel[data-meter-variant='blocks'] .runnerMiniRail{display:none!important}
      #runnerMarketIntel[data-meter-variant='blocks'] .runnerLedBlocks{grid-area:blocks;display:grid;grid-template-columns:repeat(10,minmax(4px,1fr));gap:3px;height:14px;align-self:center}
      #runnerMarketIntel[data-meter-variant='blocks'] .runnerLedBlocks span{display:block;border:1px solid #24442f;background:#071109;box-shadow:inset 0 0 5px rgba(0,0,0,.65)}
      #runnerMarketIntel[data-meter-variant='blocks'] .runnerLedBlocks span.on{box-shadow:0 0 5px currentColor,inset 0 0 4px rgba(255,255,255,.12)}
      #runnerMarketIntel[data-meter-variant='blocks'] .instrument[data-meter-kind='heat'] .runnerLedBlocks span.on:nth-child(-n+3){background:#00d96d;color:#00d96d}
      #runnerMarketIntel[data-meter-variant='blocks'] .instrument[data-meter-kind='heat'] .runnerLedBlocks span.on:nth-child(n+4):nth-child(-n+6){background:#d6c934;color:#d6c934}
      #runnerMarketIntel[data-meter-variant='blocks'] .instrument[data-meter-kind='heat'] .runnerLedBlocks span.on:nth-child(n+7):nth-child(-n+8){background:#e6782f;color:#e6782f}
      #runnerMarketIntel[data-meter-variant='blocks'] .instrument[data-meter-kind='heat'] .runnerLedBlocks span.on:nth-child(n+9){background:#e83b50;color:#e83b50}
      #runnerMarketIntel[data-meter-variant='blocks'] .instrument[data-meter-kind='pressure'] .runnerLedBlocks span.on:nth-child(-n+3),#runnerMarketIntel[data-meter-variant='blocks'] .instrument[data-meter-kind='agreement'] .runnerLedBlocks span.on:nth-child(-n+3){background:#e83b50;color:#e83b50}
      #runnerMarketIntel[data-meter-variant='blocks'] .instrument[data-meter-kind='pressure'] .runnerLedBlocks span.on:nth-child(n+4):nth-child(-n+5),#runnerMarketIntel[data-meter-variant='blocks'] .instrument[data-meter-kind='agreement'] .runnerLedBlocks span.on:nth-child(n+4):nth-child(-n+5){background:#e6782f;color:#e6782f}
      #runnerMarketIntel[data-meter-variant='blocks'] .instrument[data-meter-kind='pressure'] .runnerLedBlocks span.on:nth-child(n+6):nth-child(-n+7),#runnerMarketIntel[data-meter-variant='blocks'] .instrument[data-meter-kind='agreement'] .runnerLedBlocks span.on:nth-child(n+6):nth-child(-n+7){background:#d6c934;color:#d6c934}
      #runnerMarketIntel[data-meter-variant='blocks'] .instrument[data-meter-kind='pressure'] .runnerLedBlocks span.on:nth-child(n+8),#runnerMarketIntel[data-meter-variant='blocks'] .instrument[data-meter-kind='agreement'] .runnerLedBlocks span.on:nth-child(n+8){background:#00d96d;color:#00d96d}

      /* Readout remains the footer of the complete VigScope instrument. */
      #runnerMarketIntel>.runnerSummary.edgeReadout{margin:10px 0 0!important;border:0!important;border-top:1px solid #2a6240!important;border-left:3px solid var(--cyan)!important;background:#03101b!important;padding:9px 11px!important;font-size:11px!important;line-height:1.42!important}
      #runnerMarketIntel>.runnerSummary.edgeReadout:before{content:'EDGE READOUT';display:block;margin-bottom:5px;color:var(--green);font-size:8px;font-weight:950;letter-spacing:.11em}

      /* iPad portrait still keeps all three VigScope sections on one row. */
      @media(max-width:1100px){
        .runnerVigScopeRow{grid-template-columns:minmax(220px,.86fr) minmax(245px,1fr) minmax(275px,1.08fr);gap:8px;min-height:218px}
        .runnerVigSection{padding:7px}
        #runnerVigPicks .runnerCount{min-height:82px!important;padding:6px!important}
        #runnerVigPicks .runnerCount b{font-size:clamp(31px,3.8vw,42px)!important}
        #runnerVigContributors .instrument{min-height:60px!important;padding:7px 8px 6px!important}
        #runnerVigContributors .instrumentRead b{font-size:24px!important}
      }

      @media(max-width:900px){
        #runnerLive .runnerHead{grid-template-columns:1fr!important}
        #runnerLive .runnerHeadRight{min-width:0!important;max-width:none!important;width:100%!important}
        #runnerLive .runnerFresh{justify-content:flex-start!important;text-align:left!important}
        .runnerVigScopeRow{grid-template-columns:minmax(205px,.84fr) minmax(225px,1fr) minmax(250px,1.06fr);gap:7px;min-height:210px}
        .runnerVigSectionTitle{font-size:6.5px;margin-bottom:6px}
        #runnerVigPicks .runnerCount{min-height:77px!important}
        #runnerVigPicks .runnerCount b{font-size:32px!important}
        #runnerVigContributors .instrumentRead b{font-size:22px!important}
        #runnerVigContributors .instrumentLabel{font-size:8px!important}
        .runnerVigScopeKey{font-size:7px}
      }

      /* Phone fallback only: stack the three sections. */
      @media(max-width:720px){
        #runnerLive{padding:8px!important}
        #runnerLive .sessionStrip{overflow-x:auto!important;grid-template-columns:repeat(5,minmax(62px,1fr))!important}
        .runnerVigScopeRow{grid-template-columns:1fr;gap:8px;min-height:0}
        #runnerVigPicks .runnerCounts{grid-template-columns:repeat(4,minmax(0,1fr))!important;grid-template-rows:1fr!important}
        #runnerVigPicks .runnerCount{min-height:74px!important;border-top:0!important;border-left:1px solid #24475b!important}
        #runnerVigPicks .runnerCount:first-child{border-left:0!important}
        #runnerVigPicks .runnerCount b{font-size:32px!important}
        #runnerVigContributors .instrumentCluster{grid-template-columns:repeat(3,minmax(0,1fr))!important;grid-template-rows:1fr!important}
        #runnerVigContributors .instrument{min-height:70px!important;grid-template-columns:1fr!important;grid-template-areas:'label' 'read' 'rail' 'conf'!important;gap:2px!important;border-top:0!important;border-left:1px solid #23482f!important;text-align:center!important}
        #runnerVigContributors .instrument:first-child{border-left:0!important}
        #runnerVigContributors .instrumentLabel,#runnerVigContributors .instrumentConf{text-align:center!important}
        #runnerVigContributors .instrumentRead{justify-content:center!important}
        #runnerMarketIntel[data-meter-variant='blocks'] #runnerVigContributors .instrument{grid-template-columns:1fr!important;grid-template-areas:'label' 'read' 'blocks' 'conf'!important}
        .runnerVigScopeFrame{min-height:200px;height:200px}
      }
    `;
    d.head.appendChild(style);
  }

  function numberFromInstrument(instrument){
    const raw=instrument&&instrument.querySelector('.instrumentRead b')?.textContent;
    const n=Number(raw);
    return Number.isFinite(n)?n:0;
  }

  function stateFromCluster(cluster){
    const instruments=[...cluster.querySelectorAll('.instrument')];
    const heatValue=numberFromInstrument(instruments[0]);
    const pressureValue=numberFromInstrument(instruments[1]);
    const agreementValue=numberFromInstrument(instruments[2]);
    const heat=heatValue<40?'low':heatValue<55?'medium':'high';
    const pressure=pressureValue<45?'adverse':pressureValue<56?'neutral':'favorable';
    const agreement=agreementValue<45?'low':'high';
    return {heat,pressure,agreement,file:`vig-${heat}-${pressure}-${agreement}.jpg`,key:`${heat} • ${pressure} • ${agreement}`};
  }

  function updateContributorMeters(d,cluster){
    const kinds=['heat','pressure','agreement'];
    [...cluster.querySelectorAll('.instrument')].forEach((instrument,index)=>{
      const value=Math.max(0,Math.min(100,numberFromInstrument(instrument)));
      instrument.dataset.meterKind=kinds[index]||'agreement';
      instrument.style.setProperty('--meter-value',String(value));

      let rail=instrument.querySelector('.runnerMiniRail');
      if(!rail){
        rail=d.createElement('div');rail.className='runnerMiniRail';rail.setAttribute('aria-hidden','true');
        const track=d.createElement('span');track.className='runnerMiniRailTrack';
        const marker=d.createElement('span');marker.className='runnerMiniRailMarker';
        rail.append(track,marker);
        const conf=instrument.querySelector('.instrumentConf');
        if(conf)instrument.insertBefore(rail,conf);else instrument.appendChild(rail);
      }

      let blocks=instrument.querySelector('.runnerLedBlocks');
      if(!blocks){
        blocks=d.createElement('div');blocks.className='runnerLedBlocks';blocks.setAttribute('aria-hidden','true');
        for(let i=0;i<10;i++)blocks.appendChild(d.createElement('span'));
        const conf=instrument.querySelector('.instrumentConf');
        if(conf)instrument.insertBefore(blocks,conf);else instrument.appendChild(blocks);
      }
      const lit=Math.max(1,Math.ceil(value/10));
      [...blocks.children].forEach((seg,i)=>seg.classList.toggle('on',i<lit));
    });
  }

  function ensureVigScope(d,cluster){
    let scope=d.getElementById('runnerVigScope');
    if(!scope){
      scope=d.createElement('section');scope.id='runnerVigScope';scope.className='runnerVigSection';scope.setAttribute('aria-label','VIG meter condition');
      const sectionTitle=d.createElement('div');sectionTitle.className='runnerVigSectionTitle';sectionTitle.textContent='VIG METER';
      const legacyTitle=d.createElement('div');legacyTitle.className='runnerVigScopeTitle';legacyTitle.textContent='CURRENT CONDITION';
      const frame=d.createElement('div');frame.className='runnerVigScopeFrame';
      const img=d.createElement('img');img.className='runnerVigScopeAsset';img.decoding='async';img.loading='eager';
      const fallback=d.createElement('div');fallback.className='runnerVigScopeFallback';fallback.textContent='VIG SCOPE CONDITION ASSET UNAVAILABLE';
      frame.append(img,fallback);
      const key=d.createElement('div');key.className='runnerVigScopeKey';
      scope.append(sectionTitle,legacyTitle,frame,key);
    }else{
      scope.classList.add('runnerVigSection');
      let sectionTitle=scope.querySelector(':scope > .runnerVigSectionTitle');
      if(!sectionTitle){sectionTitle=d.createElement('div');sectionTitle.className='runnerVigSectionTitle';sectionTitle.textContent='VIG METER';scope.insertBefore(sectionTitle,scope.firstChild)}
      else sectionTitle.textContent='VIG METER';
    }

    const state=stateFromCluster(cluster);
    const img=scope.querySelector('.runnerVigScopeAsset');
    const key=scope.querySelector('.runnerVigScopeKey');
    const src=`${ASSET_BASE}/${state.file}`;
    if(img&&img.getAttribute('src')!==src){
      scope.classList.remove('assetError');
      img.onload=()=>scope.classList.remove('assetError');
      img.onerror=()=>scope.classList.add('assetError');
      img.setAttribute('src',src);
    }
    if(img)img.alt=`VIG meter condition ${state.heat}, ${state.pressure}, ${state.agreement}`;
    if(key&&key.textContent!==state.key)key.textContent=state.key;
    scope.dataset.vigScopeState=state.file.replace(/^vig-|\.jpg$/g,'');
    return scope;
  }

  function ensureContributorWrap(d,cluster){
    let wrap=d.getElementById('runnerVigContributors');
    if(!wrap){
      wrap=d.createElement('section');wrap.id='runnerVigContributors';wrap.className='runnerVigSection';wrap.setAttribute('aria-label','VIG Scope input meters');
      const title=d.createElement('div');title.className='runnerVigSectionTitle';title.textContent='INPUT METERS';
      const legacy=d.createElement('div');legacy.className='runnerContributorTitle';legacy.textContent='INPUT METERS';
      wrap.append(title,legacy);
    }else{
      wrap.classList.add('runnerVigSection');
      let title=wrap.querySelector(':scope > .runnerVigSectionTitle');
      if(!title){title=d.createElement('div');title.className='runnerVigSectionTitle';title.textContent='INPUT METERS';wrap.insertBefore(title,wrap.firstChild)}
      else title.textContent='INPUT METERS';
    }
    if(cluster.parentElement!==wrap)wrap.appendChild(cluster);
    updateContributorMeters(d,cluster);
    return wrap;
  }

  function ensurePickWrap(d,counts){
    let wrap=d.getElementById('runnerVigPicks');
    if(!wrap){
      wrap=d.createElement('section');wrap.id='runnerVigPicks';wrap.className='runnerVigSection';wrap.setAttribute('aria-label','VIG Scope picks');
      const title=d.createElement('div');title.className='runnerVigSectionTitle';title.textContent='PICKS';wrap.appendChild(title);
    }else wrap.classList.add('runnerVigSection');
    if(counts.parentElement!==wrap)wrap.appendChild(counts);
    return wrap;
  }

  function patchDashboard(d){
    if(!d||!d.head||!d.body)return;
    ensureStyle(d);

    const live=d.getElementById('runnerLive');
    if(!live)return;
    const head=live.querySelector(':scope > .runnerHead');
    const session=live.querySelector(':scope > .sessionStrip');
    const counts=live.querySelector('.runnerCounts');
    const cluster=live.querySelector('.instrumentCluster');
    const summary=live.querySelector('.runnerSummary.edgeReadout')||live.querySelector(':scope > .runnerSummary');
    if(!head||!cluster||!counts)return;

    const meterVariant=selectedMeterVariant();
    cluster.dataset.meterStyle=meterVariant==='blocks'?'segmented-led':'terminal-rail';
    if(summary)summary.classList.add('edgeReadout');

    let intel=d.getElementById('runnerMarketIntel');
    if(!intel){
      intel=d.createElement('section');intel.id='runnerMarketIntel';intel.setAttribute('aria-label','VIG Scope instrument');
      const title=d.createElement('div');title.className='runnerMarketIntelTitle';title.textContent='VIG SCOPE';
      const row=d.createElement('div');row.className='runnerVigScopeRow';
      intel.append(title,row);
    }
    intel.dataset.meterVariant=meterVariant;

    const title=intel.querySelector('.runnerMarketIntelTitle');
    if(title&&title.textContent!=='VIG SCOPE')title.textContent='VIG SCOPE';
    let row=intel.querySelector('.runnerVigScopeRow');
    if(!row){
      row=intel.querySelector('.runnerMarketIntelGrid');
      if(row)row.className='runnerVigScopeRow';
      else{row=d.createElement('div');row.className='runnerVigScopeRow';intel.appendChild(row)}
    }

    const picks=ensurePickWrap(d,counts);
    const contributors=ensureContributorWrap(d,cluster);
    const scope=ensureVigScope(d,cluster);
    [picks,contributors,scope].forEach(section=>{if(section.parentElement!==row)row.appendChild(section)});
    if(row.children[0]!==picks)row.insertBefore(picks,row.children[0]||null);
    if(row.children[1]!==contributors)row.insertBefore(contributors,row.children[1]||null);
    if(row.children[2]!==scope)row.insertBefore(scope,row.children[2]||null);

    if(summary&&summary.parentElement!==intel)intel.appendChild(summary);
    if(summary&&row.nextElementSibling!==summary)row.insertAdjacentElement('afterend',summary);

    if(session){
      if(head.nextElementSibling!==session)head.insertAdjacentElement('afterend',session);
      if(session.nextElementSibling!==intel)session.insertAdjacentElement('afterend',intel);
    }else if(head.nextElementSibling!==intel){
      head.insertAdjacentElement('afterend',intel);
    }
  }

  function attachToApp(){
    const core=document.getElementById('core');
    let app=null;
    try{app=core?.contentDocument?.getElementById('app')}catch(e){return scheduleRetry()}
    if(!app)return scheduleRetry();

    const attachDocument=()=>{
      let d=null;
      try{d=app.contentDocument}catch(e){return scheduleRetry()}
      if(!d||!d.body)return scheduleRetry();
      if(observedDocument===d&&observer){schedulePatch(d);return;}
      if(observer)observer.disconnect();
      observedDocument=d;
      patchDashboard(d);
      observer=new MutationObserver(()=>schedulePatch(d));
      observer.observe(d.body,{subtree:true,childList:true,characterData:true});
    };

    app.addEventListener('load',attachDocument,{once:false});
    attachDocument();
  }

  let retryTimer=null;
  function scheduleRetry(){
    if(retryTimer)return;
    retryTimer=setTimeout(()=>{retryTimer=null;attachToApp()},80);
  }

  const core=document.getElementById('core');
  if(core)core.addEventListener('load',()=>setTimeout(attachToApp,0));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attachToApp,{once:true});
  else attachToApp();
})();