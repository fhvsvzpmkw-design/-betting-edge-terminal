(()=>{
  'use strict';

  const STYLE_ID='runnerDashboardReorgVigScope';
  const ASSET_BASE='./assets/vig-scope';
  let observer=null;
  let observedDocument=null;
  let frameHandle=0;

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

      /* ONE VIG SCOPE INSTRUMENT */
      #runnerMarketIntel{margin-top:10px;border:2px solid #36a35c;background:linear-gradient(180deg,#010b07 0%,#010604 100%);padding:9px;box-shadow:inset 0 0 26px rgba(0,255,120,.04),0 0 8px rgba(0,255,120,.035)}
      .runnerMarketIntelTitle{margin:0 0 8px;color:var(--green);font-size:13px;font-weight:1000;letter-spacing:.17em;text-transform:uppercase;text-shadow:0 0 7px rgba(88,255,136,.18)}

      /* Decision strip is part of VIG SCOPE, not four floating boxes. */
      #runnerMarketIntel>.runnerCounts{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:0!important;margin:0 0 9px!important;padding:0!important;border:1px solid #285368;background:#010911;overflow:hidden}
      #runnerMarketIntel>.runnerCounts .runnerCount{min-height:84px!important;margin:0!important;padding:8px 7px!important;border:0!important;border-left:1px solid #24475b!important;background:linear-gradient(180deg,#020b14,#010811)!important;display:grid!important;align-content:center!important;text-align:center!important}
      #runnerMarketIntel>.runnerCounts .runnerCount:first-child{border-left:0!important}
      #runnerMarketIntel>.runnerCounts .runnerCount b{font-size:clamp(28px,3.8vw,40px)!important;margin-top:3px!important;line-height:1!important}
      #runnerMarketIntel>.runnerCounts .runnerCount .callName{font-size:11px!important;letter-spacing:.12em!important}
      #runnerMarketIntel>.runnerCounts .runnerRiskMini{margin-top:4px!important;padding-top:4px!important;border-top:1px dotted #204555!important;font-size:6.5px!important;gap:5px!important}
      #runnerMarketIntel>.runnerCounts .runnerRiskMini .runnerRiskValue{font-size:8.5px!important}

      /* Main condition + its three inputs live inside the same instrument. */
      .runnerMarketIntelGrid{display:grid;grid-template-columns:minmax(360px,1.5fr) minmax(250px,.5fr);gap:9px;align-items:stretch}
      #runnerVigScope{min-width:0;border:0;background:transparent;display:grid;grid-template-rows:minmax(0,1fr) auto;padding:0;box-shadow:none}
      .runnerVigScopeTitle{display:none!important}
      .runnerVigScopeFrame{position:relative;min-height:218px;overflow:hidden;background:#000;border:1px solid #245e39;display:grid;place-items:center;box-shadow:inset 0 0 20px rgba(0,0,0,.64)}
      .runnerVigScopeAsset{display:block;width:100%;height:100%;max-height:234px;object-fit:contain;background:#000}
      .runnerVigScopeFallback{display:none;color:var(--yellow);padding:12px;text-align:center;font-size:9px;font-weight:900;letter-spacing:.06em}
      #runnerVigScope.assetError .runnerVigScopeAsset{display:none}
      #runnerVigScope.assetError .runnerVigScopeFallback{display:block}
      .runnerVigScopeKey{margin-top:5px;color:#a9cfb5;font-size:7px;font-weight:900;letter-spacing:.105em;text-align:center;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

      /* Inputs are one compact terminal bank, not three miniature gauges. */
      .runnerContributors{min-width:0;border-left:1px dotted #3a6647;background:transparent;padding:0 0 0 10px;display:grid;grid-template-rows:auto minmax(0,1fr)}
      .runnerContributorTitle{color:#86ad91;font-size:6.5px;font-weight:950;letter-spacing:.14em;text-align:left;margin:1px 0 6px;text-transform:uppercase}
      .runnerContributors .instrumentCluster{display:grid!important;grid-template-columns:1fr!important;grid-template-rows:repeat(3,minmax(0,1fr))!important;gap:0!important;width:100%!important;align-items:stretch!important;border:1px solid #31583b!important;background:#010604!important;overflow:hidden}
      .runnerContributors .instrument{min-height:62px!important;height:auto!important;padding:7px 8px 6px!important;display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;grid-template-areas:'label read' 'rail rail' 'conf conf'!important;align-content:center!important;align-items:center!important;gap:4px 8px!important;border:0!important;border-top:1px solid #23482f!important;background:repeating-linear-gradient(0deg,rgba(0,255,135,.013) 0,rgba(0,255,135,.013) 1px,transparent 1px,transparent 3px),linear-gradient(180deg,#020b08,#010604)!important;box-shadow:none!important}
      .runnerContributors .instrument:first-child{border-top:0!important}
      .runnerContributors .instrumentLabel{grid-area:label!important;font-size:8px!important;letter-spacing:.055em!important;margin:0!important;text-align:left!important;white-space:nowrap!important}
      .runnerContributors .instrument:last-child .instrumentLabel{font-size:7.4px!important}
      .runnerContributors .instrumentScale,.runnerContributors .instrument svg,.runnerContributors .instrumentBand{display:none!important}
      .runnerContributors .instrumentRead{grid-area:read!important;display:flex!important;justify-content:flex-end!important;align-items:baseline!important;gap:4px!important;min-height:0!important;margin:0!important;padding:0!important;font-size:8px!important;white-space:nowrap!important;text-align:right!important}
      .runnerContributors .instrumentRead b{font-size:18px!important;line-height:1!important}
      .runnerMiniRail{grid-area:rail;position:relative;height:7px;margin-top:2px;border:1px solid #274b33;background:#061109;overflow:visible}
      .runnerMiniRailTrack{position:absolute;inset:0;opacity:.95}
      .instrument[data-meter-kind='heat'] .runnerMiniRailTrack{background:linear-gradient(90deg,#00ff78 0%,#a9d92e 28%,#ffd43b 50%,#ff7a2f 72%,#ff334f 100%)}
      .instrument[data-meter-kind='pressure'] .runnerMiniRailTrack,.instrument[data-meter-kind='agreement'] .runnerMiniRailTrack{background:linear-gradient(90deg,#ff334f 0%,#ff7a2f 27%,#ffd43b 50%,#a9d92e 72%,#00ff78 100%)}
      .runnerMiniRailMarker{position:absolute;top:-3px;left:calc(var(--meter-value,50) * 1%);width:2px;height:11px;background:#effff3;box-shadow:0 0 5px rgba(235,255,240,.65);transform:translateX(-1px)}
      .runnerContributors .instrumentConf{grid-area:conf!important;font-size:5.5px!important;margin:0!important;text-align:right!important;color:#789487!important}

      /* Edge readout is the footer of the same VIG SCOPE instrument. */
      #runnerMarketIntel>.runnerSummary.edgeReadout{margin:9px 0 0!important;border:0!important;border-top:1px solid #2a6240!important;border-left:3px solid var(--cyan)!important;background:#03101b!important;padding:8px 10px!important;font-size:11px!important;line-height:1.42!important}
      #runnerMarketIntel>.runnerSummary.edgeReadout:before{content:'EDGE READOUT';display:block;margin-bottom:5px;color:var(--green);font-size:8px;font-weight:950;letter-spacing:.11em}

      @media(orientation:portrait){
        #runnerLive .runnerHead{grid-template-columns:1fr!important}
        #runnerLive .runnerHeadRight{min-width:0!important;max-width:none!important;width:100%!important}
        #runnerLive .runnerFresh{justify-content:flex-start!important;text-align:left!important}
        .runnerMarketIntelGrid{grid-template-columns:1fr!important;gap:9px!important}
        #runnerVigScope{order:1}
        .runnerContributors{order:2;border-left:0;border-top:1px dotted #3a6647;padding:9px 0 0}
        .runnerContributorTitle{text-align:center;margin:0 0 6px}
        .runnerVigScopeFrame{min-height:212px}
        .runnerVigScopeAsset{max-height:228px}
        .runnerContributors .instrumentCluster{grid-template-columns:repeat(3,minmax(0,1fr))!important;grid-template-rows:1fr!important}
        .runnerContributors .instrument{min-height:70px!important;padding:6px 7px 5px!important;grid-template-columns:1fr!important;grid-template-areas:'label' 'read' 'rail' 'conf'!important;gap:2px!important;border-top:0!important;border-left:1px solid #23482f!important}
        .runnerContributors .instrument:first-child{border-left:0!important}
        .runnerContributors .instrumentLabel{text-align:center!important;font-size:7.5px!important}
        .runnerContributors .instrumentRead{justify-content:center!important;text-align:center!important;font-size:7px!important}
        .runnerContributors .instrumentRead b{font-size:17px!important}
        .runnerContributors .instrumentConf{text-align:center!important;font-size:5px!important}
        .runnerMiniRail{height:6px;margin-top:1px}
      }

      @media(max-width:900px) and (orientation:landscape){
        .runnerMarketIntelGrid{grid-template-columns:minmax(300px,1.34fr) minmax(220px,.66fr)}
        .runnerVigScopeFrame{min-height:198px}
        .runnerVigScopeAsset{max-height:214px}
        .runnerContributors .instrument{min-height:57px!important;padding:6px 7px 5px!important}
        .runnerContributors .instrumentRead b{font-size:16px!important}
      }

      @media(max-width:720px){
        #runnerLive{padding:8px!important}
        #runnerLive .sessionStrip{overflow-x:auto!important;grid-template-columns:repeat(5,minmax(62px,1fr))!important}
        #runnerMarketIntel>.runnerCounts{grid-template-columns:repeat(2,minmax(0,1fr))!important}
        #runnerMarketIntel>.runnerCounts .runnerCount{border-left:0!important;border-top:1px solid #24475b!important}
        #runnerMarketIntel>.runnerCounts .runnerCount:nth-child(-n+2){border-top:0!important}
        #runnerMarketIntel>.runnerCounts .runnerCount:nth-child(even){border-left:1px solid #24475b!important}
        .runnerMarketIntelGrid{grid-template-columns:1fr!important}
        #runnerVigScope{order:1}
        .runnerContributors{order:2;border-left:0;border-top:1px dotted #3a6647;padding:8px 0 0}
        .runnerContributors .instrumentCluster{grid-template-columns:1fr!important;grid-template-rows:repeat(3,minmax(0,1fr))!important}
        .runnerContributors .instrument{min-height:57px!important;grid-template-columns:minmax(0,1fr) auto!important;grid-template-areas:'label read' 'rail rail' 'conf conf'!important;border-left:0!important;border-top:1px solid #23482f!important}
        .runnerContributors .instrument:first-child{border-top:0!important}
        .runnerVigScopeFrame{min-height:188px}
        .runnerVigScopeAsset{max-height:202px}
      }

      @media(max-width:520px){
        #runnerLive .runnerFresh{display:grid!important;grid-template-columns:1fr!important}
        .runnerVigScopeFrame{min-height:174px}
        .runnerVigScopeAsset{max-height:188px}
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
    return {
      heat,pressure,agreement,
      file:`vig-${heat}-${pressure}-${agreement}.jpg`,
      key:`${heat} • ${pressure} • ${agreement}`
    };
  }

  function updateContributorMeters(d,cluster){
    const kinds=['heat','pressure','agreement'];
    [...cluster.querySelectorAll('.instrument')].forEach((instrument,index)=>{
      const value=Math.max(0,Math.min(100,numberFromInstrument(instrument)));
      instrument.dataset.meterKind=kinds[index]||'agreement';
      instrument.style.setProperty('--meter-value',String(value));
      let rail=instrument.querySelector('.runnerMiniRail');
      if(!rail){
        rail=d.createElement('div');
        rail.className='runnerMiniRail';
        rail.setAttribute('aria-hidden','true');
        const track=d.createElement('span');
        track.className='runnerMiniRailTrack';
        const marker=d.createElement('span');
        marker.className='runnerMiniRailMarker';
        rail.append(track,marker);
        const conf=instrument.querySelector('.instrumentConf');
        if(conf)instrument.insertBefore(rail,conf);else instrument.appendChild(rail);
      }
    });
  }

  function ensureVigScope(d,cluster){
    let scope=d.getElementById('runnerVigScope');
    if(!scope){
      scope=d.createElement('section');
      scope.id='runnerVigScope';
      scope.setAttribute('aria-label','VIG Scope condition');

      const title=d.createElement('div');
      title.className='runnerVigScopeTitle';
      title.textContent='CURRENT CONDITION';

      const frame=d.createElement('div');
      frame.className='runnerVigScopeFrame';
      const img=d.createElement('img');
      img.className='runnerVigScopeAsset';
      img.decoding='async';
      img.loading='eager';
      const fallback=d.createElement('div');
      fallback.className='runnerVigScopeFallback';
      fallback.textContent='VIG SCOPE CONDITION ASSET UNAVAILABLE';
      frame.append(img,fallback);

      const key=d.createElement('div');
      key.className='runnerVigScopeKey';
      scope.append(title,frame,key);
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
    if(img)img.alt=`VIG Scope condition ${state.heat}, ${state.pressure}, ${state.agreement}`;
    if(key&&key.textContent!==state.key)key.textContent=state.key;
    scope.dataset.vigScopeState=state.file.replace(/^vig-|\.jpg$/g,'');
    return scope;
  }

  function ensureContributorWrap(d,cluster){
    let wrap=d.getElementById('runnerVigContributors');
    if(!wrap){
      wrap=d.createElement('section');
      wrap.id='runnerVigContributors';
      wrap.className='runnerContributors';
      wrap.setAttribute('aria-label','VIG Scope input market meters');
      const title=d.createElement('div');
      title.className='runnerContributorTitle';
      title.textContent='INPUT METERS';
      wrap.appendChild(title);
    }
    if(cluster.parentElement!==wrap)wrap.appendChild(cluster);
    updateContributorMeters(d,cluster);
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

    cluster.dataset.meterStyle='terminal-rail';
    if(summary)summary.classList.add('edgeReadout');

    let intel=d.getElementById('runnerMarketIntel');
    if(!intel){
      intel=d.createElement('section');
      intel.id='runnerMarketIntel';
      intel.setAttribute('aria-label','VIG Scope instrument');
      const title=d.createElement('div');
      title.className='runnerMarketIntelTitle';
      title.textContent='VIG SCOPE';
      const grid=d.createElement('div');
      grid.className='runnerMarketIntelGrid';
      intel.append(title,grid);
    }

    const title=intel.querySelector('.runnerMarketIntelTitle');
    if(title&&title.textContent!=='VIG SCOPE')title.textContent='VIG SCOPE';
    const grid=intel.querySelector('.runnerMarketIntelGrid');
    const scope=ensureVigScope(d,cluster);
    const contributors=ensureContributorWrap(d,cluster);

    if(scope.parentElement!==grid)grid.appendChild(scope);
    if(contributors.parentElement!==grid)grid.appendChild(contributors);
    if(grid.firstElementChild!==scope)grid.insertBefore(scope,grid.firstElementChild);

    /* Make the decision strip, condition, inputs, and readout one VIG SCOPE box. */
    if(counts.parentElement!==intel)intel.insertBefore(counts,grid);
    if(title&&title.nextElementSibling!==counts)title.insertAdjacentElement('afterend',counts);
    if(counts.nextElementSibling!==grid)counts.insertAdjacentElement('afterend',grid);
    if(summary&&summary.parentElement!==intel)intel.appendChild(summary);
    if(summary&&grid.nextElementSibling!==summary)grid.insertAdjacentElement('afterend',summary);

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