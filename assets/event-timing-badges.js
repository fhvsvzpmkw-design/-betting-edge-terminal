(()=>{
  'use strict';

  if(window.__vigScopeEventTimingBadgesInstalled)return;
  window.__vigScopeEventTimingBadgesInstalled=true;

  const TIME_ZONE='America/Vancouver';
  const STYLE_ID='vigScopeEventTimingBadgeStyle';
  const REFRESH_MS=60000;
  let refreshTimer=null;

  function decodeRun(){
    try{
      const hash=location.hash.slice(1);
      if(!hash)return null;
      const params=new URLSearchParams(hash);
      let raw=null;
      if(params.has('run')){
        let value=params.get('run').replace(/-/g,'+').replace(/_/g,'/');
        while(value.length%4)value+='=';
        const bin=atob(value);
        const bytes=Uint8Array.from(bin,c=>c.charCodeAt(0));
        raw=new TextDecoder().decode(bytes);
      }else if(params.has('json')) raw=params.get('json');
      return raw?JSON.parse(raw):null;
    }catch(e){return null}
  }

  function vancouverDay(value){
    const d=value instanceof Date?value:new Date(value);
    if(!Number.isFinite(d.getTime()))return '';
    try{
      const parts=new Intl.DateTimeFormat('en-CA',{timeZone:TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
      const get=t=>parts.find(p=>p.type===t)?.value||'';
      return `${get('year')}-${get('month')}-${get('day')}`
    }catch(e){return ''}
  }

  function dayDistance(a,b){
    if(!a||!b)return null;
    const aa=Date.parse(`${a}T12:00:00Z`),bb=Date.parse(`${b}T12:00:00Z`);
    if(!Number.isFinite(aa)||!Number.isFinite(bb))return null;
    return Math.round((aa-bb)/86400000)
  }

  function dayMarker(eventTime,referenceTime){
    const eventDay=vancouverDay(eventTime),refDay=vancouverDay(referenceTime),distance=dayDistance(eventDay,refDay);
    if(distance===0)return 'TODAY';
    if(distance===1)return 'TOMORROW';
    if(distance===-1)return 'YESTERDAY';
    try{
      return new Intl.DateTimeFormat('en-CA',{timeZone:TIME_ZONE,weekday:'short',month:'short',day:'numeric'}).format(new Date(eventTime)).toUpperCase()
    }catch(e){return 'SCHEDULED'}
  }

  function clockLabel(eventTime){
    try{
      return new Intl.DateTimeFormat('en-CA',{timeZone:TIME_ZONE,hour:'numeric',minute:'2-digit',hour12:true}).format(new Date(eventTime)).replace(/\s+/g,' ').toUpperCase()+' PT'
    }catch(e){return ''}
  }

  function durationLabel(milliseconds){
    const totalMinutes=Math.max(0,Math.round(Math.abs(milliseconds)/60000));
    if(totalMinutes<60)return `${totalMinutes}M`;
    const hours=Math.floor(totalMinutes/60),minutes=totalMinutes%60;
    if(hours>=24){const days=Math.floor(hours/24),remHours=hours%24;return remHours?`${days}D ${remHours}H`:`${days}D`}
    return minutes?`${hours}H ${minutes}M`:`${hours}H`
  }

  function relativeLabel(eventTime,referenceTime){
    const delta=eventTime-referenceTime;
    if(Math.abs(delta)<60000)return {state:'soon',text:'STARTING NOW'};
    if(delta>0)return {state:delta<=3600000?'soon':'upcoming',text:`STARTS IN ${durationLabel(delta)}`};
    return {state:'started',text:`STARTED ${durationLabel(delta)} AGO`}
  }

  function referenceFor(run){
    const now=Date.now(),runTime=Date.parse(run?.ts||'');
    const currentDay=vancouverDay(now),issuedDay=vancouverDay(runTime);
    if(Number.isFinite(runTime)&&issuedDay&&currentDay&&issuedDay!==currentDay)return {time:runTime,historical:true};
    return {time:now,historical:false}
  }

  function ensureStyle(d){
    if(!d?.head||d.getElementById(STYLE_ID))return;
    const style=d.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      .eventTimingBadge{display:inline-block;max-width:100%;margin-top:6px;padding:4px 7px;border:1px solid var(--line);background:#020912;color:var(--cyan);font-size:9px;font-weight:950;letter-spacing:.055em;line-height:1.25;white-space:normal;overflow-wrap:anywhere}
      .eventTimingBadge[data-state="soon"]{border-color:var(--yellow);color:var(--yellow)}
      .eventTimingBadge[data-state="started"]{border-color:var(--red);color:var(--red)}
      .eventTimingBadge[data-historical="true"]{color:var(--muted);border-color:var(--line)}
      @media(max-width:520px){.eventTimingBadge{font-size:8px;padding:3px 6px;margin-top:5px;letter-spacing:.045em}}
    `;
    d.head.appendChild(style)
  }

  function currentFrameDocument(){
    const frame=document.getElementById('app');
    try{return frame?.contentDocument||null}catch(e){return null}
  }

  function enhance(){
    const d=currentFrameDocument();
    if(!d)return;
    const live=d.getElementById('runnerLive');
    if(!live)return;
    ensureStyle(d);

    const run=decodeRun();
    const recs=Array.isArray(run?.recs)?run.recs:[];
    const byTitle=new Map();
    recs.forEach(rec=>{
      const title=String(rec?.title||'').trim();
      if(!title)return;
      if(!byTitle.has(title))byTitle.set(title,[]);
      byTitle.get(title).push(rec)
    });

    const reference=referenceFor(run);
    [...live.querySelectorAll('.runnerCard')].forEach(card=>{
      card.querySelectorAll('.gameWindowIntel,.eventTimingBadge').forEach(node=>node.remove());
      const title=String(card.querySelector('h3')?.textContent||'').trim();
      const queue=byTitle.get(title);
      const rec=queue?.shift();
      const eventTime=Date.parse(rec?.feed?.eventDate||'');
      if(!Number.isFinite(eventTime))return;
      const meta=card.querySelector('.runnerMeta');
      if(!meta)return;
      const relative=relativeLabel(eventTime,reference.time);
      const badge=d.createElement('div');
      badge.className='eventTimingBadge';
      badge.dataset.eventTime=String(eventTime);
      badge.dataset.state=relative.state;
      badge.dataset.historical=String(reference.historical);
      const prefix=reference.historical?'AT ISSUE · ':'';
      badge.textContent=`${prefix}${dayMarker(eventTime,reference.time)} · ${clockLabel(eventTime)} · ${relative.text}`;
      meta.insertAdjacentElement('afterend',badge)
    })
  }

  function start(){
    enhance();
    if(refreshTimer)clearInterval(refreshTimer);
    refreshTimer=setInterval(enhance,REFRESH_MS)
  }

  const frame=document.getElementById('app');
  if(frame)frame.addEventListener('load',()=>setTimeout(start,0));
  document.addEventListener('vigscope-app-ready',()=>setTimeout(start,0));
  document.addEventListener('click',event=>{
    const target=event.target;
    if(!(target instanceof Element))return;
    if(target.closest('.filterBtn,.sessionChip,.runnerRefreshBtn,.runnerRestoreBtn')){
      setTimeout(enhance,0);
      setTimeout(enhance,750)
    }
  },true);
})();
