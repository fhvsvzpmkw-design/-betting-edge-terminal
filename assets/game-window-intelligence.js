(()=>{
  'use strict';

  if(window.__vigScopeGameWindowIntelligenceInstalled)return;
  window.__vigScopeGameWindowIntelligenceInstalled=true;

  const STYLE_ID='vigScopeGameWindowIntelligenceStyle';
  const LIVE_TIMER_MS=30000;
  const CFG_URL='./data/schedule-profiles.json';
  const STATE_URL='./data/schedule-state.json';
  const FALLBACK_CFG={
    legacyProfileId:'mlb',
    profiles:{
      mlb:{id:'mlb',slots:[
        {slot:'open',pulseTime:'05:45'},
        {slot:'main',pulseTime:'07:45'},
        {slot:'final_morning',pulseTime:'09:15'},
        {slot:'evening',pulseTime:'14:55'},
        {slot:'late',pulseTime:'17:55'}
      ]},
      nfl:{id:'nfl',slots:[
        {slot:'open',pulseTime:'05:45'},
        {slot:'main',pulseTime:'07:45'},
        {slot:'final_morning',pulseTime:'08:45'},
        {slot:'evening',pulseTime:'12:00'},
        {slot:'late',pulseTime:'16:45'}
      ]},
      nba_nhl:{id:'nba_nhl',slots:[
        {slot:'open',pulseTime:'05:45'},
        {slot:'main',pulseTime:'10:45'},
        {slot:'final_morning',pulseTime:'13:45'},
        {slot:'evening',pulseTime:'15:45'},
        {slot:'late',pulseTime:'17:45'}
      ]}
    }
  };
  let scheduleCfg=FALLBACK_CFG;
  let scheduleState={defaultProfileId:'mlb',selections:[]};

  function currentVancouverDay(now=new Date()){
    try{
      const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Vancouver',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
      const get=t=>parts.find(p=>p.type===t)?.value||'';
      return `${get('year')}-${get('month')}-${get('day')}`
    }catch(e){return ''}
  }

  function runDay(run){
    try{if(typeof localDateKey==='function'){const day=localDateKey(run?.ts);if(day)return day}}catch(e){}
    return String(run?.ts||'').slice(0,10)
  }

  function eventTimeFor(rec,run){
    const structured=Date.parse(rec?.feed?.eventDate||'');
    if(Number.isFinite(structured))return structured;
    try{
      if(typeof expectedEventTime==='function'){
        const fallback=expectedEventTime(rec,run);
        if(Number.isFinite(fallback))return fallback
      }
    }catch(e){}
    return null
  }

  function referenceFor(run){
    let runDayKey='',latest=true;
    try{if(typeof localDateKey==='function')runDayKey=localDateKey(run?.ts)}catch(e){}
    try{if(typeof isLatestSessionRun==='function')latest=isLatestSessionRun(run)}catch(e){}
    const currentDay=currentVancouverDay();
    if(!latest||(runDayKey&&currentDay&&runDayKey!==currentDay)){
      const issued=Date.parse(run?.ts||'');
      if(Number.isFinite(issued))return {time:issued,mode:'ISSUE'}
    }
    return {time:Date.now(),mode:'LIVE'}
  }

  function durationLabel(minutes){
    const m=Math.max(0,Math.round(Math.abs(minutes)));
    if(m<60)return `${m}m`;
    const h=Math.floor(m/60),rem=m%60;
    return rem?`${h}h ${rem}m`:`${h}h`
  }

  function classify(deltaMinutes){
    if(deltaMinutes>180)return {key:'upcoming'};
    if(deltaMinutes>60)return {key:'approaching'};
    if(deltaMinutes>15)return {key:'closing'};
    if(deltaMinutes>=-15)return {key:'start'};
    return {key:'passed'}
  }

  function statusLabel(deltaMinutes,mode){
    const prefix=mode==='ISSUE'?'AT ISSUE • ':'';
    if(Math.abs(deltaMinutes)<0.75)return `${prefix}STARTING NOW`;
    if(deltaMinutes>0)return `${prefix}STARTS IN ${durationLabel(deltaMinutes)}`;
    return `${prefix}STARTED ${durationLabel(deltaMinutes)} AGO`
  }

  function resolveProfile(run){
    const day=runDay(run);
    let id=String(run?.scheduleProfileId||scheduleState?.defaultProfileId||scheduleCfg?.legacyProfileId||'mlb');
    const selections=[...(scheduleState?.selections||[])].sort((a,b)=>
      String(a?.effectiveOperatingDate||'').localeCompare(String(b?.effectiveOperatingDate||''))||
      String(a?.selectedAt||'').localeCompare(String(b?.selectedAt||''))
    );
    selections.forEach(s=>{
      if(day&&s?.effectiveOperatingDate<=day&&scheduleCfg?.profiles?.[s.profileId])id=s.profileId
    });
    return scheduleCfg?.profiles?.[id]||FALLBACK_CFG.profiles.mlb
  }

  function nextPullFor(run){
    const profile=resolveProfile(run),slots=Array.isArray(profile?.slots)?profile.slots:[];
    const currentSlot=String(run?.slot||'');
    const i=slots.findIndex(x=>String(x?.slot||'')===currentSlot);
    if(i<0||i>=slots.length-1)return null;
    const next=slots[i+1],day=runDay(run),pulse=String(next?.pulseTime||'');
    if(!day||!/^[0-2]\d:[0-5]\d$/.test(pulse))return null;
    const offset=String(run?.ts||'').match(/([+-]\d{2}:\d{2}|Z)$/)?.[1]||'-07:00';
    const time=Date.parse(`${day}T${pulse}:00${offset}`);
    if(!Number.isFinite(time))return null;
    return {time,pulseTime:pulse,slot:String(next?.slot||''),profileId:String(profile?.id||'')}
  }

  function watchTerms(rec){
    const raw=String(rec?.playTo||rec?.betAt||'').trim();
    if(!raw)return {target:'SEE BET AT / PLAY TO',conditions:''};
    const match=raw.match(/^(.+?\bOR BETTER)(?:\s+(?:AFTER|WITH)\s+(.+))?$/i);
    if(!match)return {target:raw,conditions:''};
    return {
      target:match[1].trim(),
      conditions:String(match[2]||'').trim().replace(/\s+AND\s+/gi,' + ')
    }
  }

  function currentPrice(rec){
    try{if(typeof displayPrice==='function')return displayPrice(rec?.price)}catch(e){}
    const m=String(rec?.price||'').replace(/−/g,'-').match(/([+-]\d{2,4})/);
    return m?m[1]:'—'
  }

  function manualWatchMeta(rec,run,eventTime,ref){
    if(ref?.mode!=='LIVE')return null;
    if(String(rec?.status||'').toUpperCase()!=='WAIT')return null;
    if(!Number.isFinite(eventTime)||!Number.isFinite(ref?.time)||eventTime<=ref.time)return null;
    const next=nextPullFor(run);
    if(!next||eventTime>next.time)return null;
    const terms=watchTerms(rec);
    return {...next,...terms,current:currentPrice(rec),eventTime}
  }

  function ensureStyle(d){
    if(!d?.head||d.getElementById(STYLE_ID))return;
    const style=d.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      .gameWindowIntel{display:inline-flex;align-items:center;max-width:100%;margin:6px 0 0;padding:0;border:0;background:transparent;font-size:9px;font-weight:900;letter-spacing:.055em;line-height:1.25}
      .gameWindowState{display:inline-flex;align-items:center;justify-content:center;max-width:100%;padding:4px 8px;border:1px solid var(--line);background:#020912;color:var(--muted);white-space:nowrap;font-size:9px;font-weight:950;letter-spacing:.065em}
      .gameWindowIntel[data-window="upcoming"] .gameWindowState{border-color:#315469;color:#8fb8c8;background:#020b12}
      .gameWindowIntel[data-window="approaching"] .gameWindowState{border-color:var(--cyan);color:var(--cyan);background:#021016}
      .gameWindowIntel[data-window="closing"] .gameWindowState{border-color:var(--yellow);color:var(--yellow);background:#171403}
      .gameWindowIntel[data-window="start"] .gameWindowState{border-color:#ff9d45;color:#ffb56f;background:#1a0d03}
      .gameWindowIntel[data-window="passed"] .gameWindowState{border-color:var(--red);color:var(--red);background:#19070b}
      .watchMarketBadge{display:inline-block;padding:4px 7px;border:1px solid var(--yellow);background:#171403;color:var(--yellow);font-size:10px;font-weight:950;letter-spacing:.08em;line-height:1.2}
      .watchMarketIntel{margin-top:8px;border:1px solid var(--yellow);border-left:4px solid var(--yellow);background:#100e04;padding:8px 9px;color:#d8ca85;font-size:10px;line-height:1.4}
      .watchMarketTitle{color:#ffe570;font-size:11px;font-weight:1000;letter-spacing:.075em}
      .watchMarketWhy{margin-top:3px;color:#b8a966;font-size:9px;font-weight:850;letter-spacing:.035em}
      .watchMarketFacts{display:flex;gap:12px;flex-wrap:wrap;margin-top:6px}
      .watchMarketFact{color:#d6c983;font-size:9px}.watchMarketFact b{color:#fff0a2;font-size:10px}
      .watchMarketConditions{margin-top:5px;color:#d6c983;font-size:9px}.watchMarketConditions b{color:#fff0a2}

      /* Compact Reprice at the top; run times dock below the VIG SCOPE instrument. */
      .runnerHeadRight>.runnerRefresh{margin:0!important;padding:3px 0 0!important;border:0!important;background:transparent!important;box-shadow:none!important;display:grid!important;grid-template-columns:auto minmax(0,1fr)!important;gap:4px 6px!important;align-items:center!important}
      .runnerHeadRight>.runnerRefresh .runnerRefreshActions{display:block!important;margin:0!important;padding:0!important}
      .runnerHeadRight>.runnerRefresh .runnerRefreshBtn{min-height:22px!important;padding:3px 5px!important;font-size:8px!important;line-height:1!important;white-space:nowrap!important}
      .runnerHeadRight>.runnerRefresh .runnerRefreshStatus{margin:0!important;padding:0!important;border:0!important;background:transparent!important;font-size:8px!important;line-height:1.3!important;color:var(--muted)!important;text-align:left!important}
      .runnerHeadRight>.runnerRefresh .deltaStrip{grid-column:1/-1!important;margin:2px 0 0!important}
      #runnerLive>.runnerSessionDock{margin:10px 0 8px!important}
      #runnerLive>.runnerSessionDock>.sessionStrip{margin:0!important;gap:7px!important}
      #runnerLive>.runnerSessionDock>.sessionStrip .sessionChip{font-size:12px!important;font-weight:950!important;letter-spacing:.045em!important;min-height:40px!important;padding:9px 8px!important}

      /* iPad portrait keeps the report title left and odds/Reprice anchored right. */
      @media(min-width:721px) and (max-width:900px){
        #runnerLive .runnerHead{grid-template-columns:minmax(240px,1fr) minmax(390px,1.35fr)!important;gap:14px!important;align-items:start!important}
        #runnerLive .runnerHeadRight{min-width:0!important;max-width:470px!important;width:min(100%,470px)!important;justify-self:end!important}
        #runnerLive .runnerFresh{justify-content:flex-end!important;text-align:right!important}
        .runnerHeadRight>.runnerRefresh{justify-content:end!important}
        .runnerHeadRight>.runnerRefresh .runnerRefreshBtn{min-height:21px!important;padding:3px 5px!important;font-size:7.5px!important}
      }

      @media(max-width:520px){
        .gameWindowIntel{margin-top:5px}.gameWindowState{padding:3px 6px;font-size:8px;letter-spacing:.055em}.watchMarketIntel{padding:7px 8px}.watchMarketFacts{gap:7px}.watchMarketTitle{font-size:10px}.watchMarketBadge{font-size:9px}
        .runnerHeadRight>.runnerRefresh{grid-template-columns:auto minmax(0,1fr)!important;gap:4px 5px!important}
        .runnerHeadRight>.runnerRefresh .runnerRefreshBtn{font-size:8px!important;padding:3px 5px!important;min-height:22px!important}
        .runnerHeadRight>.runnerRefresh .runnerRefreshStatus{font-size:7.5px!important}
        #runnerLive>.runnerSessionDock>.sessionStrip{gap:5px!important;overflow-x:auto!important}
        #runnerLive>.runnerSessionDock>.sessionStrip .sessionChip{font-size:11px!important;min-width:64px!important;min-height:38px!important;padding:8px 6px!important}
      }
    `;
    d.head.appendChild(style)
  }

  function updateChip(chip,nowOverride=null){
    const eventTime=Number(chip?.dataset?.eventTime);
    if(!Number.isFinite(eventTime))return;
    const mode=chip.dataset.referenceMode||'LIVE';
    const fixedReference=Number(chip.dataset.referenceTime);
    const reference=mode==='ISSUE'&&Number.isFinite(fixedReference)?fixedReference:(Number.isFinite(nowOverride)?nowOverride:Date.now());
    const delta=(eventTime-reference)/60000;
    const state=classify(delta);
    chip.dataset.window=state.key;
    const stateEl=chip.querySelector('.gameWindowState');
    if(stateEl)stateEl.textContent=statusLabel(delta,mode)
  }

  function addWatchPanel(d,left,rec,watch){
    const badges=left.querySelector('.runnerBadgeRow');
    if(badges&&!badges.querySelector('.watchMarketBadge')){
      const badge=d.createElement('span');badge.className='watchMarketBadge';badge.textContent='WATCH THIS MARKET';badges.appendChild(badge)
    }
    const panel=d.createElement('div');panel.className='watchMarketIntel';panel.dataset.eventTime=String(watch.eventTime);
    const title=d.createElement('div');title.className='watchMarketTitle';title.textContent='WAIT — WATCH THIS MARKET';
    const why=d.createElement('div');why.className='watchMarketWhy';why.textContent=`STARTS BEFORE NEXT VIGSCOPE ODDS PULL • NEXT PULL ${watch.pulseTime} PT • MONITOR MANUALLY`;
    const facts=d.createElement('div');facts.className='watchMarketFacts';
    const target=d.createElement('span');target.className='watchMarketFact';target.innerHTML=`TARGET <b>${watch.target}</b>`;
    const current=d.createElement('span');current.className='watchMarketFact';current.innerHTML=`CURRENT <b>${watch.current}</b>`;
    facts.append(target,current);panel.append(title,why,facts);
    if(watch.conditions){const conditions=d.createElement('div');conditions.className='watchMarketConditions';conditions.innerHTML=`ALSO REQUIRE <b>${watch.conditions}</b>`;panel.appendChild(conditions)}
    left.appendChild(panel)
  }

  function enhanceCard(d,r,run,baseCard){
    const cardEl=baseCard(d,r);
    try{
      const eventTime=eventTimeFor(r,run);
      if(!Number.isFinite(eventTime))return cardEl;
      ensureStyle(d);
      const top=cardEl.querySelector('.runnerTop');
      if(!top)return cardEl;
      const left=top.firstElementChild;
      if(!left)return cardEl;
      const ref=referenceFor(run);
      const chip=d.createElement('div');
      chip.className='gameWindowIntel';
      chip.dataset.eventTime=String(eventTime);
      chip.dataset.referenceMode=ref.mode;
      chip.dataset.referenceTime=String(ref.time);
      const state=d.createElement('span');state.className='gameWindowState';
      chip.appendChild(state);
      const meta=[...left.querySelectorAll('.runnerMeta')].find(x=>!x.classList.contains('priceWatchTarget'));
      if(meta)meta.insertAdjacentElement('afterend',chip);else left.appendChild(chip);
      updateChip(chip,ref.time);
      const watch=manualWatchMeta(r,run,eventTime,ref);
      if(watch)addWatchPanel(d,left,r,watch)
    }catch(e){console.warn('VigScope game-window intelligence card error',e)}
    return cardEl
  }

  function refreshLiveChips(){
    try{
      const app=document.getElementById('app');
      const d=app?.contentDocument;
      if(!d)return;
      const now=Date.now();
      d.querySelectorAll('.gameWindowIntel[data-reference-mode="LIVE"]').forEach(chip=>{
        updateChip(chip,now);
        const eventTime=Number(chip.dataset.eventTime);
        if(Number.isFinite(eventTime)&&eventTime<=now){
          const left=chip.parentElement;
          left?.querySelector('.watchMarketIntel')?.remove();
          left?.querySelector('.watchMarketBadge')?.remove()
        }
      })
    }catch(e){}
  }

  function rerender(){
    try{
      let run=null;
      try{run=typeof activeRun!=='undefined'?activeRun:null}catch(e){}
      if(run&&typeof apply==='function')apply(run)
    }catch(e){}
  }

  function compactRunnerUtilityLayout(){
    try{
      const app=document.getElementById('app');
      const d=app?.contentDocument;
      if(!d)return false;
      ensureStyle(d);
      const live=d.getElementById('runnerLive');
      if(!live)return false;
      const headRight=live.querySelector('.runnerHeadRight');
      const refresh=live.querySelector('.runnerRefresh');
      const session=live.querySelector('.sessionStrip');
      const intel=live.querySelector(':scope > #runnerMarketIntel');
      if(refresh&&headRight&&refresh.parentElement!==headRight)headRight.appendChild(refresh);
      if(refresh){
        const status=refresh.querySelector('.runnerRefreshStatus');
        if(status&&!status.dataset.compactDefault){
          const text=String(status.textContent||'');
          const compared=text.match(/^Current prices checked\s+([^.]*)\./i);
          if(/^Checks the latest published/i.test(text))status.textContent='Manual price check // issued report unchanged.';
          else if(compared)status.textContent=`Compared ${compared[1]} // issued report unchanged.`;
          else if(/^HISTORICAL REPORT/i.test(text))status.textContent='Historical snapshot // Reprice unavailable.';
          status.dataset.compactDefault='1'
        }
      }
      if(session&&intel){
        let dock=live.querySelector(':scope > .runnerSessionDock');
        if(!dock){dock=d.createElement('div');dock.className='runnerSessionDock'}
        if(session.parentElement!==dock)dock.appendChild(session);
        if(intel.nextElementSibling!==dock)intel.insertAdjacentElement('afterend',dock)
      }
      return true
    }catch(e){return false}
  }

  function bindRunnerUtilityLayout(){
    try{
      const app=document.getElementById('app');
      const d=app?.contentDocument;
      if(!d?.body)return false;
      compactRunnerUtilityLayout();
      if(d.documentElement.dataset.runnerUtilityLayoutBound==='1')return true;
      d.documentElement.dataset.runnerUtilityLayoutBound='1';
      let frame=null;
      const observer=new MutationObserver(()=>{
        if(frame)return;
        frame=d.defaultView.requestAnimationFrame(()=>{frame=null;compactRunnerUtilityLayout()})
      });
      observer.observe(d.body,{subtree:true,childList:true});
      return true
    }catch(e){return false}
  }

  async function loadScheduleAuthority(){
    try{
      const bust=`v=${Date.now()}`;
      const [cfg,state]=await Promise.all([
        fetch(`${CFG_URL}?${bust}`,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(`profiles ${r.status}`);return r.json()}),
        fetch(`${STATE_URL}?${bust}`,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(`state ${r.status}`);return r.json()})
      ]);
      if(cfg?.profiles)scheduleCfg=cfg;
      if(state?.defaultProfileId)scheduleState=state;
      rerender()
    }catch(e){console.warn('VigScope watch-market schedule authority fallback active',e)}
  }

  function install(){
    try{
      if(typeof card!=='function')return false;
      const baseCard=card;
      card=function(d,r){
        let run=null;
        try{run=typeof activeRun!=='undefined'?activeRun:null}catch(e){}
        return enhanceCard(d,r,run,baseCard)
      };
      let run=null;
      try{run=typeof activeRun!=='undefined'?activeRun:null}catch(e){}
      if(run&&typeof apply==='function')setTimeout(()=>{try{apply(run);bindRunnerUtilityLayout()}catch(e){}},0);
      else setTimeout(bindRunnerUtilityLayout,0);
      setInterval(refreshLiveChips,LIVE_TIMER_MS);
      loadScheduleAuthority();
      return true
    }catch(e){console.warn('VigScope game-window intelligence install error',e);return false}
  }

  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    if(install()||tries>100)clearInterval(timer)
  },50)
})();