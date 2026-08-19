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
      #runnerLive .runnerHead{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:12px!important;align-items:start!important}
      #runnerLive .runnerHeadRight{display:block!important;width:auto!important;min-width:285px!important;max-width:470px!important}
      #runnerLive .runnerFresh{margin:0!important;padding:7px 9px!important;border:1px solid #2a6240!important;background:#020b07!important;display:flex!important;flex-wrap:wrap!important;justify-content:flex-end!important;align-items:center!important;gap:5px 10px!important;text-align:right!important;line-height:1.2!important}
      #runnerLive .runnerFresh .feedMeta{order:1!important;color:var(--green)!important}
      #runnerLive .runnerFresh .marketStateLabel{order:2!important;color:var(--green)!important}
      #runnerLive .sessionStrip{margin-top:9px!important;gap:6px!important}
      #runnerLive .sessionChip{min-height:44px!important;padding:8px 6px!important;font-size:11px!important}
      #runnerLive .runnerCounts{margin-top:9px!important;gap:7px!important}
      #runnerLive .runnerCount{min-height:104px!important;padding:10px 8px!important;display:grid!important;align-content:center!important}
      #runnerLive .runnerCount b{font-size:clamp(32px,4.6vw,48px)!important;margin-top:5px!important}
      #runnerLive .runnerCount .callName{font-size:13px!important}
      #runnerMarketIntel{margin-top:9px;border:1px solid #2a6240;background:#010a06;padding:8px;box-shadow:inset 0 0 18px rgba(0,255,120,.03)}
      .runnerMarketIntelTitle{margin:-1px 0 7px;color:var(--green);font-size:10px;font-weight:950;letter-spacing:.12em;text-transform:uppercase}
      .runnerMarketIntelGrid{display:grid;grid-template-columns:minmax(0,3fr) minmax(250px,1.15fr);gap:8px;align-items:stretch}
      #runnerMarketIntel .instrumentCluster{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:7px!important;width:100%!important;align-items:stretch!important}
      #runnerMarketIntel .instrument{min-height:116px!important;height:100%!important;padding:7px 6px 6px!important}
      #runnerMarketIntel .instrumentLabel{font-size:9px!important;letter-spacing:.055em!important}
      #runnerMarketIntel .instrument:last-child .instrumentLabel{font-size:8px!important}
      #runnerMarketIntel .instrument svg{height:60px!important;margin:-3px auto -6px!important}
      #runnerMarketIntel .instrumentRead{font-size:9px!important;min-height:17px!important}
      #runnerMarketIntel .instrumentRead b{font-size:17px!important}
      #runnerMarketIntel .instrumentScale{font-size:5.5px!important}
      #runnerMarketIntel .instrumentBand{margin-top:4px!important;height:9px!important}
      #runnerMarketIntel .instrumentBand span{font-size:0!important;height:3px!important}
      #runnerMarketIntel .instrumentConf{font-size:6px!important;margin-top:4px!important}
      #runnerVigScope{min-width:0;border:1px solid var(--green);background:#010604;display:grid;grid-template-rows:auto minmax(0,1fr) auto;padding:7px;box-shadow:inset 0 0 20px rgba(88,255,136,.05),0 0 8px rgba(88,255,136,.05)}
      .runnerVigScopeTitle{color:var(--green);font-size:10px;font-weight:950;letter-spacing:.12em;text-align:center;margin-bottom:5px}
      .runnerVigScopeFrame{position:relative;min-height:104px;overflow:hidden;background:#000;border:1px solid #1c4a2d;display:grid;place-items:center}
      .runnerVigScopeAsset{display:block;width:100%;height:100%;max-height:154px;object-fit:contain;background:#000}
      .runnerVigScopeFallback{display:none;color:var(--yellow);padding:12px;text-align:center;font-size:9px;font-weight:900;letter-spacing:.06em}
      #runnerVigScope.assetError .runnerVigScopeAsset{display:none}
      #runnerVigScope.assetError .runnerVigScopeFallback{display:block}
      .runnerVigScopeKey{margin-top:5px;color:#8eb49b;font-size:7px;font-weight:850;letter-spacing:.08em;text-align:center;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      #runnerLive .runnerSummary.edgeReadout{margin-top:9px!important;border:1px solid #2a6240!important;border-left:4px solid var(--cyan)!important;background:#03101b!important;padding:9px 10px!important}
      #runnerLive .runnerSummary.edgeReadout:before{content:'EDGE READOUT';display:block;margin-bottom:5px;color:var(--green);font-size:9px;font-weight:950;letter-spacing:.11em}
      @media(max-width:900px){
        #runnerLive .runnerHead{grid-template-columns:1fr!important}
        #runnerLive .runnerHeadRight{min-width:0!important;max-width:none!important;width:100%!important}
        #runnerLive .runnerFresh{justify-content:flex-start!important;text-align:left!important}
        .runnerMarketIntelGrid{grid-template-columns:1fr!important}
        #runnerVigScope{min-height:190px}
        .runnerVigScopeAsset{max-height:210px}
      }
      @media(max-width:720px){
        #runnerLive{padding:8px!important}
        #runnerLive .runnerCounts{grid-template-columns:repeat(2,minmax(0,1fr))!important}
        #runnerMarketIntel .instrumentCluster{grid-template-columns:1fr!important}
        #runnerMarketIntel .instrument{min-height:112px!important}
        #runnerLive .sessionStrip{overflow-x:auto!important;grid-template-columns:repeat(5,minmax(62px,1fr))!important}
      }
      @media(max-width:520px){
        #runnerLive .runnerFresh{display:grid!important;grid-template-columns:1fr!important}
        #runnerVigScope{min-height:170px}
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

  function ensureVigScope(d,cluster){
    let scope=d.getElementById('runnerVigScope');
    if(!scope){
      scope=d.createElement('section');
      scope.id='runnerVigScope';
      scope.setAttribute('aria-label','VIG Scope condition');

      const title=d.createElement('div');
      title.className='runnerVigScopeTitle';
      title.textContent='VIG SCOPE';

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

  function patchDashboard(d){
    if(!d||!d.head||!d.body)return;
    ensureStyle(d);

    const live=d.getElementById('runnerLive');
    if(!live)return;

    const head=live.querySelector(':scope > .runnerHead');
    const session=live.querySelector(':scope > .sessionStrip');
    const counts=live.querySelector(':scope > .runnerCounts');
    const summary=live.querySelector(':scope > .runnerSummary');
    const cluster=head?.querySelector('.instrumentCluster')||live.querySelector('.instrumentCluster');
    if(!head||!cluster||!counts)return;

    cluster.dataset.meterStyle='compact-dial';
    if(summary)summary.classList.add('edgeReadout');

    let intel=d.getElementById('runnerMarketIntel');
    if(!intel){
      intel=d.createElement('section');
      intel.id='runnerMarketIntel';
      intel.setAttribute('aria-label','Market intelligence');
      const title=d.createElement('div');
      title.className='runnerMarketIntelTitle';
      title.textContent='MARKET INTELLIGENCE';
      const grid=d.createElement('div');
      grid.className='runnerMarketIntelGrid';
      intel.append(title,grid);
    }

    const grid=intel.querySelector('.runnerMarketIntelGrid');
    if(cluster.parentElement!==grid)grid.appendChild(cluster);
    const scope=ensureVigScope(d,cluster);
    if(scope.parentElement!==grid)grid.appendChild(scope);

    if(session&&head.nextElementSibling!==session)head.insertAdjacentElement('afterend',session);
    if(session&&session.nextElementSibling!==counts)session.insertAdjacentElement('afterend',counts);
    if(!session&&head.nextElementSibling!==counts)head.insertAdjacentElement('afterend',counts);
    if(counts.nextElementSibling!==intel)counts.insertAdjacentElement('afterend',intel);
    if(summary&&intel.nextElementSibling!==summary)intel.insertAdjacentElement('afterend',summary);
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
