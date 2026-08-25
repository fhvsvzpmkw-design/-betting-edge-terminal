(()=>{
'use strict';

const CFG='./data/schedule-profiles.json';
const STATE='./data/schedule-state.json';
const PANEL_ID='runnerSchedulePreferences';
const BUTTON_ID='runnerPreferencesF6';
const STYLE_ID='runnerScheduleProfileUiStyle';
let cfg=null,state=null,lastDoc=null,observer=null;

function appDoc(){
  try{
    const core=document.getElementById('core');
    const app=core?.contentDocument?.getElementById('app');
    return app?.contentDocument||null;
  }catch{return null}
}
function vc(d=new Date()){
  const p=new Intl.DateTimeFormat('en-CA',{
    timeZone:'America/Vancouver',hour12:false,
    year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'
  }).formatToParts(d);
  const o=Object.fromEntries(p.map(x=>[x.type,x.value]));
  const h=Number(o.hour==='24'?'0':o.hour),m=Number(o.minute);
  return {date:`${o.year}-${o.month}-${o.day}`,minutes:h*60+m,time:`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`};
}
function plusDay(s,n=1){
  const d=new Date(`${s}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate()+n);
  return d.toISOString().slice(0,10);
}
function resolve(date){
  let id=state?.defaultProfileId||cfg?.legacyProfileId;
  [...(state?.selections||[])].sort((a,b)=>
    String(a.effectiveOperatingDate).localeCompare(String(b.effectiveOperatingDate))||
    String(a.selectedAt||'').localeCompare(String(b.selectedAt||''))
  ).forEach(s=>{
    if(s?.effectiveOperatingDate<=date&&cfg?.profiles?.[s.profileId])id=s.profileId;
  });
  return cfg?.profiles?.[id]||null;
}
function slot(profile,key){return profile?.slots?.find(x=>x.slot===key)||null}
function esc(v){
  return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function currentRun(){
  try{
    const core=document.getElementById('core');
    const h=core?.contentWindow?.location?.hash?.slice(1)||'';
    const p=new URLSearchParams(h),v=p.get('run');
    if(!v)return null;
    let b=v.replace(/-/g,'+').replace(/_/g,'/');
    while(b.length%4)b+='=';
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b),x=>x.charCodeAt(0))));
  }catch{return null}
}
async function load(){
  const q=`v=${Date.now()}`;
  [cfg,state]=await Promise.all([
    fetch(`${CFG}?${q}`,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(`profiles ${r.status}`);return r.json()}),
    fetch(`${STATE}?${q}`,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(`state ${r.status}`);return r.json()})
  ]);
}

function ensureStyle(d){
  if(d.getElementById(STYLE_ID))return;
  const s=d.createElement('style');
  s.id=STYLE_ID;
  s.textContent=`
    #${BUTTON_ID}{grid-column:1/-1!important;border-color:#4d6b7d!important;color:#b9dfff!important;background:#020a10!important}
    #${BUTTON_ID}.active,#${BUTTON_ID}:hover{border-color:#64d7ff!important;color:#e7f8ff!important;background:#04131d!important}
    #${PANEL_ID}{display:none;margin:0 12px 14px;padding:12px;border:1px solid #31566d;background:linear-gradient(180deg,#020b12,#01060a);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:#c9dce6}
    body.runnerPreferencesLoaded #${PANEL_ID}{display:block}
    body.runnerPreferencesLoaded #runnerLive,body.runnerPreferencesLoaded .view,body.runnerPreferencesLoaded #runnerSyndicateWorkspace{display:none!important}
    .sp-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;border-bottom:1px solid #23465a;padding-bottom:10px}
    .sp-head h2{margin:0;color:#7fe4ff;font-size:16px;letter-spacing:.11em}
    .sp-head p{margin:4px 0 0;color:#819aa8;font-size:8px;line-height:1.45}
    .sp-lock{border:1px solid #526a42;color:#d8f78c;background:#0b1104;padding:6px 9px;font-size:8px;font-weight:950;letter-spacing:.08em}
    .sp-status{display:grid;grid-template-columns:1.15fr .85fr .85fr;gap:8px;margin:10px 0}
    .sp-stat,.sp-section,.sp-card{border:1px solid #29495b;background:#02090e;padding:9px}
    .sp-stat small,.sp-kicker{display:block;color:#718c9a;font-size:7px;letter-spacing:.1em}
    .sp-stat b{display:block;color:#dff7ff;font-size:14px;margin-top:3px}
    .sp-stat span{display:block;color:#78909d;font-size:8px;margin-top:3px;line-height:1.4}
    .sp-section{margin-top:9px}
    .sp-section-title{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:7px}
    .sp-section-title b{color:#9feaff;font-size:10px;letter-spacing:.09em}
    .sp-section-title span{color:#738e9d;font-size:7px}
    .sp-day-table{display:grid;gap:0;border:1px solid #203a49}
    .sp-day-row{display:grid;grid-template-columns:38px 54px 16px 54px minmax(120px,1fr) 86px;gap:6px;align-items:center;padding:7px 8px;border-top:1px solid #172f3b;font-size:8px;color:#8ca5b4}
    .sp-day-row:first-child{border-top:0}
    .sp-day-row strong{color:#d7f4ff}.sp-day-row .sp-time{color:#c4e8f7}.sp-day-row .sp-vig{color:#ffd65b;font-weight:900}.sp-day-row .sp-standard{color:#617c89}
    .sp-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
    .sp-card.active{border-color:#58ff88;box-shadow:inset 0 0 14px rgba(88,255,136,.035)}
    .sp-card.queued{border-color:#ffd65b}
    .sp-title{display:flex;justify-content:space-between;gap:5px;align-items:center}
    .sp-title b{color:#f3fbff;font-size:11px}.sp-title em{font-style:normal;color:#77919e;font-size:7px}
    .sp-focus{color:#78909d;font-size:8px;margin:5px 0 7px;min-height:24px}
    .sp-row{display:grid;grid-template-columns:24px 42px 10px 42px minmax(0,1fr);gap:3px;padding:4px 2px;border-top:1px solid #172f3b;color:#8ca5b4;font-size:7px}
    .sp-row strong{color:#c8efff}.sp-star{color:#ffd65b}
    .sp-notegrid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .sp-note{border:1px solid #203a49;background:#02070b;padding:8px;color:#7d98a7;font-size:8px;line-height:1.5}
    .sp-note b{display:block;color:#a8d8e9;font-size:8px;letter-spacing:.08em;margin-bottom:4px}
    .sp-control-lock{margin-top:9px;border:1px solid #574f2c;background:#100e04;padding:8px;color:#b7a968;font-size:8px;line-height:1.45}
    .sp-control-lock strong{color:#ffe47a}
    .runbtn.scheduleFeatured{border-color:#8d7629!important}
    .scheduleStar{color:#ffd65b;margin-left:3px}
    #runnerScheduleTranslation{margin:6px 0;padding:5px 8px;border-left:3px solid #43c8ff;background:#031019;color:#87a9ba;font-size:7px;font-weight:800}
    .runnerVigScopeScheduleBadge{margin-top:4px;color:#ffd65b;font-size:7px;font-weight:950;letter-spacing:.08em;text-align:center;text-transform:uppercase}
    @media(max-width:900px){.sp-status{grid-template-columns:1fr 1fr}.sp-status .sp-stat:first-child{grid-column:1/-1}.sp-day-row{grid-template-columns:34px 48px 12px 48px minmax(100px,1fr) 76px}}
    @media(max-width:760px){.sp-status,.sp-cards,.sp-notegrid{grid-template-columns:1fr}.sp-status .sp-stat:first-child{grid-column:auto}.sp-focus{min-height:0}.sp-day-row{grid-template-columns:30px 44px 10px 44px minmax(90px,1fr)}.sp-day-row .sp-check{display:none}}
  `;
  d.head.appendChild(s);
}
function profileCard(p,currentId,nextId){
  const active=p.id===currentId;
  const queued=p.id===nextId&&nextId!==currentId;
  return `<section class="sp-card ${active?'active':''} ${queued?'queued':''}">
    <div class="sp-title"><b>${esc(p.name)}</b><em>${active?'ACTIVE TODAY':queued?'NEXT DAY':'REFERENCE'}</em></div>
    <div class="sp-focus">${esc(p.focus)}</div>
    ${p.slots.map(x=>`<div class="sp-row"><strong>S${x.canonicalSlot}</strong><span>${x.pulseTime}</span><span>→</span><span>${x.reportTime}</span><span>${x.featuredVigScope?'<b class="sp-star">★</b> ':''}${esc(x.label)}</span></div>`).join('')}
  </section>`;
}
function dayRows(p){
  return p.slots.map(x=>`<div class="sp-day-row">
    <strong>S${x.canonicalSlot}</strong>
    <span class="sp-time">${x.pulseTime}</span>
    <span>→</span>
    <span class="sp-time">${x.reportTime}</span>
    <span>${esc(x.label)}</span>
    <span class="sp-check ${x.featuredVigScope?'sp-vig':'sp-standard'}">${x.featuredVigScope?'★ VIG SCOPE':'STANDARD'}</span>
  </div>`).join('');
}
function renderPanel(d){
  if(!cfg||!state)return;
  let p=d.getElementById(PANEL_ID);
  if(!p){
    p=d.createElement('section');
    p.id=PANEL_ID;
    const nav=d.querySelector('.runnerNavPad');
    nav?nav.insertAdjacentElement('afterend',p):d.body.prepend(p);
  }
  const n=vc(),today=n.date,tomorrow=plusDay(today),cur=resolve(today),next=resolve(tomorrow);
  if(!cur||!next)return;
  const key=[today,cur.id,next.id,state.updatedAt||''].join('|');
  if(p.dataset.key===key&&p.innerHTML)return;
  p.dataset.key=key;
  const featured=cur.slots.filter(x=>x.featuredVigScope).map(x=>`S${x.canonicalSlot} ${x.reportTime}`).join(' · ');
  p.innerHTML=`
    <div class="sp-head">
      <div>
        <h2>PREFERENCES / OPERATIONS</h2>
        <p>SEASONAL SCHEDULE DISPLAY // ONE OPERATING DAY = ONE PROFILE // FIVE PRIMARY PULSES // THREE FEATURED VIG SCOPE CHECKPOINTS</p>
      </div>
      <div class="sp-lock">DISPLAY ONLY // DAILY PROFILE LOCKED</div>
    </div>

    <div class="sp-status">
      <div class="sp-stat"><small>ACTIVE OPERATING PROFILE // ${today}</small><b>${esc(cur.name)}</b><span>${esc(cur.focus)}</span></div>
      <div class="sp-stat"><small>DAILY ODDS BUDGET</small><b>5 PRIMARY PULSES</b><span>Inactive seasonal clocks do not spend the odds quota.</span></div>
      <div class="sp-stat"><small>FEATURED VIG SCOPE</small><b>3 CHECKPOINTS</b><span>${esc(featured)}</span></div>
    </div>

    <section class="sp-section">
      <div class="sp-section-title"><b>TODAY'S OPERATING SCHEDULE</b><span>AUTHORITATIVE FOR THE FULL DAY</span></div>
      <div class="sp-day-table">${dayRows(cur)}</div>
    </section>

    <section class="sp-section">
      <div class="sp-section-title"><b>SEASON PROFILE REFERENCE</b><span>INFORMATIONAL — NOT SELECTABLE HERE</span></div>
      <div class="sp-cards">${Object.values(cfg.profiles).map(x=>profileCard(x,cur.id,next.id)).join('')}</div>
    </section>

    <section class="sp-section">
      <div class="sp-section-title"><b>HISTORY / TRANSLATION</b><span>CANONICAL SLOT MODEL</span></div>
      <div class="sp-notegrid">
        <div class="sp-note"><b>S1–S5 ARE PERMANENT</b>History compares equivalent canonical slots across profiles. MLB S4 can compare with NFL S4 even when their wall-clock times differ.</div>
        <div class="sp-note"><b>ACTUAL TIMES NEVER MOVE</b>Archived report timestamps, odds snapshot timestamps and provenance remain exactly as issued. Translation changes navigation labels only.</div>
        <div class="sp-note"><b>VIG SCOPE IS MEASURED, NOT CHOSEN</b>The profile marks three readings as featured checkpoints. The actual Vig Scope condition still comes from Market Heat, Price Pressure and Market Agreement.</div>
        <div class="sp-note"><b>THE RUN IS THE RUN</b>Once the operating day starts, its schedule profile is treated as fixed. F6 observes that state; it does not change it.</div>
      </div>
    </section>

    <div class="sp-control-lock"><strong>SCHEDULE CONTROL RESERVED.</strong> The Preferences pane is fully built as the terminal's schedule authority display. Direct profile switching is intentionally inactive for now; the day's configured schedule remains the schedule for that entire operating day.</div>
  `;
}
function ensureButton(d){
  const tabs=d.querySelector('.runnerNavPad .tabs')||d.querySelector('.tabs');
  if(!tabs)return false;
  let b=d.getElementById(BUTTON_ID);
  if(!b){
    b=d.createElement('button');
    b.type='button';
    b.className='btn';
    b.id=BUTTON_ID;
    b.innerHTML='<b>[F6]</b>&nbsp; ⚙ PREFERENCES';
    tabs.appendChild(b);
  }
  if(b.dataset.schedulePreferencesBound!=='1'){
    b.dataset.schedulePreferencesBound='1';
    b.addEventListener('click',()=>{
      const open=!d.body.classList.contains('runnerPreferencesLoaded');
      d.body.classList.remove('runnerSyndicateLoaded');
      d.body.classList.toggle('runnerPreferencesLoaded',open);
      b.classList.toggle('active',open);
      if(open)renderPanel(d);
    });
  }
  if(tabs.dataset.schedulePreferencesCloseBound!=='1'){
    tabs.dataset.schedulePreferencesCloseBound='1';
    tabs.addEventListener('click',e=>{
      const x=e.target.closest('.btn');
      const current=d.getElementById(BUTTON_ID);
      if(x&&current&&x!==current&&!x.matches('#runnerSyndicateF5')){
        d.body.classList.remove('runnerPreferencesLoaded');
        current.classList.remove('active');
      }
    });
  }
  return true;
}
function historyDate(d){
  const s=d.getElementById('runDateSelect');
  if(s?.value&&s.value!=='latest')return s.value;
  return String(currentRun()?.ts||'').slice(0,10)||vc().date;
}
function patchHistory(d){
  if(!cfg||!state)return;
  const date=historyDate(d),p=resolve(date);
  if(!p)return;
  d.querySelectorAll('[data-run-slot]').forEach(b=>{
    const s=slot(p,b.dataset.runSlot);
    if(!s)return;
    const rt=b.querySelector('.rt'),rl=b.querySelector('.rl');
    if(rt&&rt.textContent!==s.reportTime)rt.textContent=s.reportTime;
    if(rl&&rl.textContent!==s.label)rl.textContent=s.label;
    b.dataset.canonicalSlot=String(s.canonicalSlot);
    b.classList.toggle('scheduleFeatured',!!s.featuredVigScope);
    b.title=`${p.name} // S${s.canonicalSlot} // PULSE ${s.pulseTime} // REPORT ${s.reportTime}`;
    let star=b.querySelector('.scheduleStar');
    if(s.featuredVigScope&&!star){
      star=d.createElement('span');star.className='scheduleStar';star.textContent='★';b.appendChild(star);
    }
    if(!s.featuredVigScope&&star)star.remove();
  });
  const bar=d.querySelector('.runArchiveBar');
  if(bar){
    let n=d.getElementById('runnerScheduleTranslation');
    if(!n){n=d.createElement('div');n.id='runnerScheduleTranslation';bar.insertAdjacentElement('afterend',n)}
    const text=`SCHEDULE TRANSLATION // ${date} // ${p.name} // CANONICAL SLOTS 1–5 // ACTUAL ISSUE TIMESTAMPS REMAIN IMMUTABLE`;
    if(n.textContent!==text)n.textContent=text;
  }
}
function patchVigScope(d){
  const r=currentRun();
  if(!r?.slot||!r?.ts||!cfg||!state)return;
  const p=resolve(String(r.ts).slice(0,10)),s=slot(p,r.slot),scope=d.getElementById('runnerVigScope');
  if(!s||!scope)return;
  let b=scope.querySelector('.runnerVigScopeScheduleBadge');
  if(!b){b=d.createElement('div');b.className='runnerVigScopeScheduleBadge';scope.appendChild(b)}
  const text=`${s.featuredVigScope?'★ FEATURED VIG SCOPE CHECKPOINT':'STANDARD VIG SCOPE SNAPSHOT'} // ${p.shortName} S${s.canonicalSlot} // PLANNED ${s.reportTime}`;
  if(b.textContent!==text)b.textContent=text;
}
function patch(d){
  if(!d?.body||!cfg||!state)return;
  ensureStyle(d);ensureButton(d);renderPanel(d);patchHistory(d);patchVigScope(d);
}
function attach(){
  const d=appDoc();
  if(!d?.body)return false;
  if(d!==lastDoc){
    lastDoc=d;
    if(observer)observer.disconnect();
    observer=new MutationObserver(()=>requestAnimationFrame(()=>patch(d)));
    observer.observe(d.body,{subtree:true,childList:true,characterData:true});
    d.addEventListener('change',e=>{if(e.target?.id==='runDateSelect')setTimeout(()=>patchHistory(d),0)});
  }
  patch(d);
  return true;
}
load().then(()=>{
  let n=0;
  const t=setInterval(()=>{n++;if(attach()||n>180)clearInterval(t)},100);
  setInterval(()=>{const d=appDoc();if(d)patch(d)},1200);
}).catch(e=>console.warn('Schedule profile UI unavailable',e));
})();