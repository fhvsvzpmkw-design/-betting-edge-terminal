(()=>{
  'use strict';

  const CONFIG_URL='./data/schedule-profiles.json';
  const STATE_URL='./data/schedule-state.json';
  const HISTORY_URL='./run-history.json';
  const ACTION_URL='https://github.com/fhvsvzpmkw-design/-betting-edge-terminal/actions/workflows/set-schedule-profile.yml';
  const STYLE_ID='runnerScheduleProfileUiStyle';
  const PANEL_ID='runnerSchedulePreferences';
  const BUTTON_ID='runnerPreferencesF6';
  let config=null,state=null,history=null,observer=null,lastDoc=null;

  function appDocument(){
    try{
      const core=document.getElementById('core');
      const app=core?.contentDocument?.getElementById('app');
      return app?.contentDocument||null;
    }catch(e){return null}
  }
  function vancouverParts(date=new Date()){
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Vancouver',hour12:false,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).formatToParts(date);
    const o=Object.fromEntries(parts.map(p=>[p.type,p.value]));
    const hour=Number(o.hour==='24'?'0':o.hour),minute=Number(o.minute);
    return {date:`${o.year}-${o.month}-${o.day}`,hour,minute,minutes:hour*60+minute,time:`${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`};
  }
  function addDays(dateText,days){const d=new Date(`${dateText}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)}
  function resolveProfile(dateText){
    if(!config||!state)return null;
    let id=state.defaultProfileId||config.legacyProfileId;
    const selections=(state.selections||[]).slice().sort((a,b)=>String(a.effectiveOperatingDate).localeCompare(String(b.effectiveOperatingDate))||String(a.selectedAt||'').localeCompare(String(b.selectedAt||'')));
    selections.forEach(s=>{if(s?.effectiveOperatingDate<=dateText&&config.profiles[s.profileId])id=s.profileId});
    return config.profiles[id]||config.profiles[config.legacyProfileId];
  }
  function profileSlot(profile,slot){return profile?.slots?.find(x=>x.slot===slot)||null}
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function b64u(v){try{v=v.replace(/-/g,'+').replace(/_/g,'/');while(v.length%4)v+='=';const bin=atob(v);const bytes=Uint8Array.from(bin,c=>c.charCodeAt(0));return new TextDecoder().decode(bytes)}catch(e){return null}}
  function currentRun(){
    try{
      const core=document.getElementById('core');
      const hash=core?.contentWindow?.location?.hash?.slice(1)||'';
      const p=new URLSearchParams(hash);const raw=p.has('run')?b64u(p.get('run')):null;
      return raw?JSON.parse(raw):null;
    }catch(e){return null}
  }
  async function loadData(){
    const bust=`v=${Date.now()}`;
    const [c,s,h]=await Promise.all([
      fetch(`${CONFIG_URL}?${bust}`,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(`profiles ${r.status}`);return r.json()}),
      fetch(`${STATE_URL}?${bust}`,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(`state ${r.status}`);return r.json()}),
      fetch(`${HISTORY_URL}?${bust}`,{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null)
    ]);
    config=c;state=s;history=h;
  }
  function ensureStyle(d){
    if(d.getElementById(STYLE_ID))return;
    const style=d.createElement('style');style.id=STYLE_ID;style.textContent=`
      #${BUTTON_ID}{border-color:#4d6b7d!important;color:#b9dfff!important;background:#020a10!important}
      #${BUTTON_ID}:hover,#${BUTTON_ID}.active{border-color:#64d7ff!important;color:#e7f8ff!important;background:#04131d!important;box-shadow:inset 0 0 12px rgba(80,205,255,.06),0 0 8px rgba(80,205,255,.08)!important}
      #${PANEL_ID}{display:none;margin:0 12px 14px;padding:12px;border:1px solid #31566d;background:linear-gradient(180deg,#020b12,#01060a);color:var(--text);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;box-shadow:inset 0 0 24px rgba(67,200,255,.025)}
      body.runnerPreferencesLoaded #${PANEL_ID}{display:block}
      body.runnerPreferencesLoaded #runnerLive,body.runnerPreferencesLoaded .view,body.runnerPreferencesLoaded #runnerSyndicateWorkspace{display:none!important}
      .schedulePrefHead{display:flex;justify-content:space-between;gap:12px;align-items:start;flex-wrap:wrap;border-bottom:1px solid #23465a;padding-bottom:10px}
      .schedulePrefHead h2{margin:0;color:#7fe4ff;font-size:16px;letter-spacing:.12em}.schedulePrefHead p{margin:4px 0 0;color:#819aa8;font-size:9px;line-height:1.5}
      .scheduleLock{border:1px solid #466d55;background:#04110a;color:#8effaa;padding:6px 9px;font-size:9px;font-weight:900;letter-spacing:.08em}
      .scheduleStatusGrid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0}.scheduleStatus{border:1px solid #29495b;background:#020a0f;padding:9px}.scheduleStatus small{display:block;color:#6f8b9a;font-size:7px;letter-spacing:.11em}.scheduleStatus b{display:block;margin-top:4px;color:#d9f6ff;font-size:15px}.scheduleStatus span{display:block;margin-top:3px;color:#7e98a7;font-size:8px}
      .scheduleProfiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.scheduleProfileCard{border:1px solid #29495b;background:#02090e;padding:9px;min-width:0}.scheduleProfileCard.current{border-color:#58ff88;box-shadow:inset 0 0 14px rgba(88,255,136,.035)}.scheduleProfileCard.queued{border-color:#ffd65b}.scheduleProfileName{display:flex;justify-content:space-between;gap:6px;align-items:center}.scheduleProfileName b{color:#f3fbff;font-size:12px}.scheduleProfileName em{color:#6f8c9d;font-style:normal;font-size:7px}.scheduleFocus{margin:5px 0 7px;color:#7d98a7;font-size:8px;min-height:24px}.scheduleRows{display:grid;gap:3px}.scheduleRow{display:grid;grid-template-columns:28px 46px 12px 46px minmax(0,1fr);gap:4px;align-items:center;padding:4px 5px;border-top:1px solid #172f3b;font-size:7px;color:#8da6b5}.scheduleRow:first-child{border-top:0}.scheduleRow .vigStar{color:#ffd65b;font-size:9px}.scheduleRow strong{color:#c9efff}.scheduleAction{display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;margin-top:10px;padding-top:10px;border-top:1px solid #23465a}.scheduleAction a{display:inline-block;border:1px solid #4a7f96;padding:7px 10px;color:#bceeff;text-decoration:none;font-size:9px;font-weight:900;letter-spacing:.08em}.scheduleAction a:hover{background:#06202c}.scheduleAction span{color:#78909d;font-size:8px;max-width:670px;line-height:1.45}
      #runnerScheduleTranslation{margin:7px 0 0;padding:5px 8px;border-left:3px solid #43c8ff;background:#031019;color:#87a9ba;font-size:7px;font-weight:800;letter-spacing:.06em}
      .runbtn.scheduleFeatured{border-color:#8d7629!important;box-shadow:inset 0 0 8px rgba(255,214,91,.04)}.runbtn .scheduleStar{color:#ffd65b;margin-left:3px}
      .runnerVigScopeScheduleBadge{margin-top:4px;color:#ffd65b;font-size:7px;font-weight:950;letter-spacing:.09em;text-align:center;text-transform:uppercase}
      @media(max-width:760px){.scheduleStatusGrid,.scheduleProfiles{grid-template-columns:1fr}.scheduleFocus{min-height:0}.scheduleRow{grid-template-columns:28px 43px 10px 43px minmax(0,1fr)}}
    `;d.head.appendChild(style);
  }
  function profileHtml(profile,currentId,nextId){
    const current=profile.id===currentId,queued=profile.id===nextId&&nextId!==currentId;
    const rows=profile.slots.map(s=>`<div class="scheduleRow"><strong>S${s.canonicalSlot}</strong><span>${esc(s.pulseTime)}</span><span>→</span><span>${esc(s.reportTime)}</span><span>${s.featuredVigScope?'<b class="vigStar">★</b> ':''}${esc(s.label)}</span></div>`).join('');
    return `<section class="scheduleProfileCard ${current?'current':''} ${queued?'queued':''}"><div class="scheduleProfileName"><b>${esc(profile.name)}</b><em>${current?'CURRENT':queued?'QUEUED':'AVAILABLE'}</em></div><div class="scheduleFocus">${esc(profile.focus)}</div><div class="scheduleRows">${rows}</div></section>`;
  }
  function renderPanel(d){
    if(!config||!state)return;
    let panel=d.getElementById(PANEL_ID);if(!panel){panel=d.createElement('section');panel.id=PANEL_ID;panel.setAttribute('aria-label','Schedule preferences');const nav=d.querySelector('.runnerNavPad');if(nav)nav.insertAdjacentElement('afterend',panel);else d.body.prepend(panel)}
    const now=vancouverParts(),today=now.date,tomorrow=addDays(today,1),current=resolveProfile(today),next=resolveProfile(tomorrow);
    const locked=now.minutes>=360;
    panel.innerHTML=`<div class="schedulePrefHead"><div><h2>PREFERENCES / OPERATIONS</h2><p>ONE VANCOUVER OPERATING DAY = ONE SCHEDULE PROFILE // FIVE PRIMARY ODDS PULSES // THREE FEATURED VIG SCOPE CHECKPOINTS</p></div><div class="scheduleLock">${locked?'TODAY LOCKED':'NEXT 06:00 PROFILE'}</div></div><div class="scheduleStatusGrid"><div class="scheduleStatus"><small>CURRENT OPERATING PROFILE // ${today}</small><b>${esc(current.name)}</b><span>Five-pull schedule remains fixed for this operating day.</span></div><div class="scheduleStatus"><small>NEXT 06:00 // ${tomorrow}</small><b>${esc(next.name)}</b><span>${next.id===current.id?'NO CHANGE QUEUED':'PROFILE CHANGE QUEUED'}</span></div></div><div class="scheduleProfiles">${Object.values(config.profiles).map(p=>profileHtml(p,current.id,next.id)).join('')}</div><div class="scheduleAction"><span>Profile changes are repository-controlled so a static terminal cannot silently spend quota or rewrite the day. One change per local day; after the 05:30 cutoff it takes effect on the next operating day.</span><a href="${ACTION_URL}" target="_blank" rel="noopener">QUEUE NEXT PROFILE ↗</a></div>`;
  }
  function ensureButton(d){
    const tabs=d.querySelector('.runnerNavPad .tabs')||d.querySelector('.tabs');if(!tabs)return false;
    let b=d.getElementById(BUTTON_ID);if(!b){b=d.createElement('button');b.type='button';b.className='btn';b.id=BUTTON_ID;b.innerHTML='<b>[F6]</b>&nbsp; ⚙ PREFERENCES';tabs.appendChild(b);b.addEventListener('click',()=>{const opening=!d.body.classList.contains('runnerPreferencesLoaded');d.body.classList.remove('runnerSyndicateLoaded');d.body.classList.toggle('runnerPreferencesLoaded',opening);b.classList.toggle('active',opening);if(opening)renderPanel(d)});tabs.addEventListener('click',e=>{const target=e.target.closest('.btn');if(target&&target!==b&&!target.matches('#runnerSyndicateF5')){d.body.classList.remove('runnerPreferencesLoaded');b.classList.remove('active')}})}
    return true;
  }
  function historyDate(d){const sel=d.getElementById('runDateSelect');if(sel&&sel.value&&sel.value!=='latest')return sel.value;const run=currentRun();return String(run?.ts||'').slice(0,10)||vancouverParts().date}
  function patchHistory(d){
    if(!config||!state)return;
    const date=historyDate(d),profile=resolveProfile(date);if(!profile)return;
    d.querySelectorAll('[data-run-slot]').forEach(btn=>{
      const slot=profileSlot(profile,btn.dataset.runSlot);if(!slot)return;
      const rt=btn.querySelector('.rt'),rl=btn.querySelector('.rl');if(rt&&rt.textContent!==slot.reportTime)rt.textContent=slot.reportTime;if(rl){const label=slot.label;if(rl.textContent!==label)rl.textContent=label}
      btn.classList.toggle('scheduleFeatured',slot.featuredVigScope===true);btn.dataset.canonicalSlot=String(slot.canonicalSlot);btn.title=`${profile.name} // CANONICAL SLOT ${slot.canonicalSlot} // PULSE ${slot.pulseTime} // REPORT ${slot.reportTime}${slot.featuredVigScope?' // FEATURED VIG SCOPE':''}`;
      let star=btn.querySelector('.scheduleStar');if(slot.featuredVigScope&&!star){star=d.createElement('span');star.className='scheduleStar';star.textContent='★';btn.appendChild(star)}else if(!slot.featuredVigScope&&star)star.remove();
    });
    const bar=d.querySelector('.runArchiveBar');if(bar){let note=d.getElementById('runnerScheduleTranslation');if(!note){note=d.createElement('div');note.id='runnerScheduleTranslation';bar.insertAdjacentElement('afterend',note)}note.textContent=`SCHEDULE TRANSLATION // ${date} // ${profile.name} // HISTORY NAVIGATES CANONICAL SLOTS 1–5; ACTUAL ISSUE TIMESTAMPS REMAIN IMMUTABLE`;}
    const meta=d.getElementById('runArchiveMeta');if(meta&&meta.textContent){const active=d.querySelector('[data-run-slot].active');const slot=active?profileSlot(profile,active.dataset.runSlot):null;if(slot){const marker='// GENERATED';const i=meta.textContent.indexOf(marker);const suffix=i>=0?' '+meta.textContent.slice(i):'';const desired=`${date} // ${slot.reportTime} ${slot.label} // ${profile.shortName} // S${slot.canonicalSlot}${suffix}`;if(meta.textContent!==desired)meta.textContent=desired;}}
  }
  function patchVigScope(d){
    if(!config||!state)return;
    const run=currentRun();if(!run?.slot||!run?.ts)return;
    const date=String(run.ts).slice(0,10),profile=resolveProfile(date),slot=profileSlot(profile,run.slot);if(!slot)return;
    const scope=d.getElementById('runnerVigScope');if(!scope)return;
    let badge=scope.querySelector('.runnerVigScopeScheduleBadge');if(!badge){badge=d.createElement('div');badge.className='runnerVigScopeScheduleBadge';scope.appendChild(badge)}
    badge.textContent=`${slot.featuredVigScope?'★ FEATURED VIG SCOPE CHECKPOINT':'STANDARD VIG SCOPE SNAPSHOT'} // ${profile.shortName} S${slot.canonicalSlot} // PLANNED ${slot.reportTime}`;
  }
  function patch(d){if(!d?.body)return;ensureStyle(d);ensureButton(d);renderPanel(d);patchHistory(d);patchVigScope(d)}
  function attach(){
    const d=appDocument();if(!d?.body)return false;if(d!==lastDoc){lastDoc=d;if(observer)observer.disconnect();observer=new MutationObserver(()=>requestAnimationFrame(()=>patch(d)));observer.observe(d.body,{subtree:true,childList:true,characterData:true});d.addEventListener('change',e=>{if(e.target?.id==='runDateSelect')setTimeout(()=>patchHistory(d),0)});}
    patch(d);return true;
  }
  async function start(){try{await loadData()}catch(e){console.warn('Schedule profile UI data unavailable',e);return}let tries=0;const timer=setInterval(()=>{tries++;if(attach()||tries>180)clearInterval(timer)},100);setInterval(()=>{const d=appDocument();if(d)patch(d)},1500)}
  start();
})();
