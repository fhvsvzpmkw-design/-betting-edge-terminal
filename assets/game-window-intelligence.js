(()=>{
  'use strict';

  if(window.__vigScopeGameWindowIntelligenceInstalled)return;
  window.__vigScopeGameWindowIntelligenceInstalled=true;

  const STYLE_ID='vigScopeGameWindowIntelligenceStyle';
  const LIVE_TIMER_MS=30000;

  function currentVancouverDay(now=new Date()){
    try{
      const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Vancouver',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
      const get=t=>parts.find(p=>p.type===t)?.value||'';
      return `${get('year')}-${get('month')}-${get('day')}`
    }catch(e){return ''}
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
    let runDay='',latest=true;
    try{if(typeof localDateKey==='function')runDay=localDateKey(run?.ts)}catch(e){}
    try{if(typeof isLatestSessionRun==='function')latest=isLatestSessionRun(run)}catch(e){}
    const currentDay=currentVancouverDay();
    if(!latest||(runDay&&currentDay&&runDay!==currentDay)){
      const issued=Date.parse(run?.ts||'');
      if(Number.isFinite(issued))return {time:issued,mode:'ISSUE'}
    }
    return {time:Date.now(),mode:'LIVE'}
  }

  function startClock(ts){
    try{
      return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Vancouver',hour:'numeric',minute:'2-digit',hour12:true,timeZoneName:'short'}).format(new Date(ts))
    }catch(e){return 'START TIME'}
  }

  function durationLabel(minutes){
    const m=Math.max(0,Math.round(Math.abs(minutes)));
    if(m<60)return `${m}m`;
    const h=Math.floor(m/60),rem=m%60;
    return rem?`${h}h ${rem}m`:`${h}h`
  }

  function classify(deltaMinutes){
    if(deltaMinutes>180)return {key:'upcoming',label:'UPCOMING'};
    if(deltaMinutes>60)return {key:'approaching',label:'APPROACHING'};
    if(deltaMinutes>15)return {key:'closing',label:'CLOSING WINDOW'};
    if(deltaMinutes>=-15)return {key:'start',label:'START WINDOW'};
    return {key:'passed',label:'SCHEDULED START PASSED'}
  }

  function ensureStyle(d){
    if(!d?.head||d.getElementById(STYLE_ID))return;
    const style=d.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      .gameWindowIntel{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:8px;width:100%;margin:10px 0 0;padding:6px 8px;border:1px solid var(--line);background:#020912;font-size:9px;font-weight:900;letter-spacing:.055em;line-height:1.25;text-align:center}
      .gameWindowState{display:inline-flex;align-items:center;padding:3px 7px;border:1px solid var(--line);background:#020912;color:var(--muted);white-space:nowrap}
      .gameWindowClock{color:#93aeba;letter-spacing:.025em}
      .gameWindowIntel[data-window="upcoming"]{border-color:#315469;background:#020b12}.gameWindowIntel[data-window="upcoming"] .gameWindowState{border-color:#315469;color:#8fb8c8}
      .gameWindowIntel[data-window="approaching"]{border-color:#257a91;background:#021016}.gameWindowIntel[data-window="approaching"] .gameWindowState{border-color:var(--cyan);color:var(--cyan)}
      .gameWindowIntel[data-window="closing"]{border-color:#8a7828;background:#100e03}.gameWindowIntel[data-window="closing"] .gameWindowState{border-color:var(--yellow);color:var(--yellow);background:#171403}
      .gameWindowIntel[data-window="start"]{border-color:#b86928;background:#130902}.gameWindowIntel[data-window="start"] .gameWindowState{border-color:#ff9d45;color:#ffb56f;background:#1a0d03}
      .gameWindowIntel[data-window="passed"]{border-color:#8f3040;background:#120509}.gameWindowIntel[data-window="passed"] .gameWindowState{border-color:var(--red);color:var(--red);background:#19070b}
      @media(max-width:520px){.gameWindowIntel{gap:5px;margin-top:8px;padding:6px;font-size:8px}.gameWindowState{padding:3px 5px}.gameWindowClock{flex-basis:100%;text-align:center}}
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
    const stateEl=chip.querySelector('.gameWindowState'),clockEl=chip.querySelector('.gameWindowClock');
    if(stateEl)stateEl.textContent=state.label;
    if(clockEl){
      const prefix=mode==='ISSUE'?'AT ISSUE • ':'';
      let relative='';
      if(Math.abs(delta)<0.75)relative='SCHEDULED NOW';
      else if(delta>0)relative=`${durationLabel(delta)} TO START`;
      else relative=`${durationLabel(delta)} PAST SCHEDULED`;
      clockEl.textContent=`${prefix}${startClock(eventTime)} • ${relative}`
    }
  }

  function enhanceCard(d,r,run,baseCard){
    const cardEl=baseCard(d,r);
    try{
      const eventTime=eventTimeFor(r,run);
      if(!Number.isFinite(eventTime))return cardEl;
      ensureStyle(d);
      const top=cardEl.querySelector('.runnerTop');
      if(!top)return cardEl;
      const ref=referenceFor(run);
      const chip=d.createElement('div');
      chip.className='gameWindowIntel';
      chip.dataset.eventTime=String(eventTime);
      chip.dataset.referenceMode=ref.mode;
      chip.dataset.referenceTime=String(ref.time);
      const state=d.createElement('span');state.className='gameWindowState';
      const clock=d.createElement('span');clock.className='gameWindowClock';
      chip.append(state,clock);
      top.insertAdjacentElement('afterend',chip);
      updateChip(chip,ref.time)
    }catch(e){console.warn('VigScope game-window intelligence card error',e)}
    return cardEl
  }

  function refreshLiveChips(){
    try{
      const app=document.getElementById('app');
      const d=app?.contentDocument;
      if(!d)return;
      const now=Date.now();
      d.querySelectorAll('.gameWindowIntel[data-reference-mode="LIVE"]').forEach(chip=>updateChip(chip,now))
    }catch(e){}
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
      if(run&&typeof apply==='function')setTimeout(()=>{try{apply(run)}catch(e){}},0);
      setInterval(refreshLiveChips,LIVE_TIMER_MS);
      return true
    }catch(e){console.warn('VigScope game-window intelligence install error',e);return false}
  }

  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    if(install()||tries>100)clearInterval(timer)
  },50)
})();