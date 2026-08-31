(()=>{
'use strict';

const DATA_URL='./data/preferences.json';
const SYNDICATES_URL='./data/syndicates.json';
const HOTLINE_SHELLS_URL='./data/hotline-shells.json';
const OVERVIEW_ID='runnerPreferenceModuleOverview';
const STYLE_ID='runnerPreferenceFrameworkStyle';

const LAST_VIEW_KEY='bettingEdge.preferences.lastView';
const LAST_HISTORY_KEY='bettingEdge.preferences.lastHistoryView';
const DETAIL_LAST_KEY='bettingEdge.preferences.recommendationDetailLastState';
const SYNDICATE_FALLBACK=['eddie-numbers','lou-vega',null,null];

let prefs=null,syndicates=null,hotlineShells=null,lastDoc=null,observer=null;

function appDoc(){
  try{
    const core=document.getElementById('core');
    const app=core?.contentDocument?.getElementById('app');
    return app?.contentDocument||null;
  }catch{return null}
}
function esc(v){
  return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function stateDef(id){return prefs?.states?.[id]||{label:String(id||'').toUpperCase(),meaning:''}}
function moduleById(id){return (prefs?.modules||[]).find(m=>m.id===id)||null}
function safeGet(key,fallback=''){
  try{const v=localStorage.getItem(key);return v===null?fallback:v}catch{return fallback}
}
function safeSet(key,value){
  try{localStorage.setItem(key,String(value));return true}catch{return false}
}
function validChoice(module,value){return Array.isArray(module?.options)&&module.options.some(o=>o.value===value)}
function readChoice(module){
  const raw=safeGet(module.storageKey,module.default||'');
  return validChoice(module,raw)?raw:(module.default||module.options?.[0]?.value||'');
}
function writeChoice(module,value){
  if(!validChoice(module,value))return false;
  return safeSet(module.storageKey,value);
}
function counts(){
  const out={active:0,display_only:0,reserved:0};
  for(const module of prefs?.modules||[]){if(Object.hasOwn(out,module.state))out[module.state]++}
  return out;
}
function defaultSyndicateAssignments(){
  const source=Array.isArray(syndicates?.defaults)&&syndicates.defaults.length===4?syndicates.defaults:SYNDICATE_FALLBACK;
  return source.map(v=>v==null?null:String(v));
}
function enabledSyndicateProfiles(){
  return (Array.isArray(syndicates?.profiles)?syndicates.profiles:[])
    .filter(p=>p&&p.enabled!==false&&p.url)
    .map(p=>({id:String(p.id),label:String(p.name||p.label||p.id)}));
}
function syndicateCharacterLabel(id){
  const p=(Array.isArray(syndicates?.profiles)?syndicates.profiles:[]).find(x=>String(x?.characterId||x?.id||'')===String(id||''));
  return String(p?.name||p?.label||id||'UNKNOWN CHARACTER');
}
function readSyndicateAssignments(){
  const module=moduleById('syndicate_load');
  const key=module?.storageKey||'bettingEdge.syndicateSlots.v4';
  try{
    const raw=JSON.parse(localStorage.getItem(key)||'null');
    if(Array.isArray(raw)&&raw.length===4)return raw.map(v=>v==null?null:String(v));
  }catch{}
  return defaultSyndicateAssignments();
}
function writeSyndicateAssignments(assignments){
  const module=moduleById('syndicate_load');
  const key=module?.storageKey||'bettingEdge.syndicateSlots.v4';
  try{localStorage.setItem(key,JSON.stringify(assignments));return true}catch{return false}
}
function choiceControl(module){
  const value=readChoice(module);
  const options=(module.options||[]).map(o=>`<option value="${esc(o.value)}"${o.value===value?' selected':''}>${esc(o.label)}</option>`).join('');
  return `<label class="prefControlLabel"><span>CURRENT</span><select class="prefSelect" data-pref-choice="${esc(module.id)}">${options}</select></label>`;
}
function syndicateControl(){
  const profiles=enabledSyndicateProfiles();
  const assignments=readSyndicateAssignments();
  return `<div class="prefSyndicateGrid">${assignments.map((current,index)=>{
    const opts=[
      `<option value=""${current==null?' selected':''}>EMPTY</option>`,
      ...profiles.map(p=>{
        const used=assignments.some((id,i)=>i!==index&&id===p.id);
        return `<option value="${esc(p.id)}"${p.id===current?' selected':''}${used?' disabled':''}>${esc(p.label)}</option>`;
      })
    ].join('');
    return `<label class="prefControlLabel prefSlotControl"><span>F${index+1}</span><select class="prefSelect" data-pref-syndicate-slot="${index}">${opts}</select></label>`;
  }).join('')}</div>`;
}
function hotlineShellDisplay(){
  const shells=Array.isArray(hotlineShells?.shells)?hotlineShells.shells:[];
  if(!shells.length)return '<div class="prefShellEmpty">SHELL REGISTRY UNAVAILABLE</div>';
  return `<div class="prefShellGrid">${shells.map(shell=>{
    const character=syndicateCharacterLabel(shell.characterId);
    const state=String(shell.status||'unknown').toUpperCase();
    return `<div class="prefShellRow">
      <div><b class="prefShellCharacter">${esc(character)}</b><span class="prefShellName">${esc(shell.name||shell.id)}</span></div>
      <div class="prefShellMeta"><span>v${esc(shell.version??'—')}</span><span class="prefShellState shell-${esc(String(shell.status||'unknown').toLowerCase())}">${esc(state)}</span></div>
    </div>`;
  }).join('')}</div>`;
}
function moduleControl(module){
  if(module.kind==='manifest'&&module.id==='hotline_shells')return hotlineShellDisplay();
  if(module.state!=='active'||module.editable===false)return '';
  if(module.kind==='choice')return choiceControl(module);
  if(module.kind==='syndicate')return syndicateControl();
  return '';
}
function moduleCard(module){
  const state=stateDef(module.state);
  const control=moduleControl(module);
  return `<article class="prefModuleCard state-${esc(module.state)}" data-preference-module="${esc(module.id)}">
    <div class="prefModuleHead"><b>${esc(module.title)}</b><span class="prefStateBadge">${esc(state.label)}</span></div>
    <p>${esc(module.summary)}</p>
    ${control?`<div class="prefModuleControl">${control}</div>`:''}
    <div class="prefModulePolicy">${esc(module.controlPolicy||state.meaning)}</div>
  </article>`;
}
function ensureStyle(d){
  if(d.getElementById(STYLE_ID))return;
  const s=d.createElement('style');
  s.id=STYLE_ID;
  s.textContent=`
    #${OVERVIEW_ID}{margin:12px 0;border:1px solid #2d566b;background:linear-gradient(180deg,#020b12,#01070b);padding:12px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
    .prefFrameworkHead{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:11px}
    .prefFrameworkHead b{color:#9feaff;font-size:14px;font-weight:900;letter-spacing:.08em}.prefFrameworkHead span{color:#8ba5b1;font-size:10.5px;line-height:1.5;max-width:680px;text-align:right}
    .prefStateCounts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:11px}
    .prefStateCount{border:1px solid #203b49;background:#02070b;padding:9px 10px}.prefStateCount small{display:block;color:#7f99a5;font-size:9.5px;font-weight:900;letter-spacing:.09em}.prefStateCount b{display:block;margin-top:3px;font-size:18px;color:#d9f5ff}.prefStateCount.active b{color:#8effaa}.prefStateCount.display b{color:#f5dd83}.prefStateCount.reserved b{color:#8ca2ae}
    .prefModuleGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
    .prefModuleCard{min-width:0;border:1px solid #284552;background:#02080c;padding:11px}.prefModuleCard.state-active{border-color:#347b4a}.prefModuleCard.state-display_only{border-color:#75652e}.prefModuleCard.state-reserved{border-color:#394b54;opacity:.86}
    .prefModuleHead{display:flex;justify-content:space-between;gap:9px;align-items:center}.prefModuleHead b{color:#dff6ff;font-size:12.5px;font-weight:900;letter-spacing:.06em}.prefStateBadge{flex:0 0 auto;border:1px solid #475b65;padding:4px 6px;color:#a1b6c0;background:#04090c;font-size:9px;font-weight:950;letter-spacing:.07em}.state-active .prefStateBadge{border-color:#438858;color:#8effaa}.state-display_only .prefStateBadge{border-color:#8b7631;color:#ffe07a}.state-reserved .prefStateBadge{color:#91a2aa}
    .prefModuleCard p{margin:8px 0 7px;color:#a1b6c0;font-size:11px;line-height:1.55}.prefModulePolicy{border-top:1px solid #1b313b;padding-top:7px;color:#78909b;font-size:10px;line-height:1.5}
    .prefModuleControl{margin:9px 0;padding:9px;border:1px solid #1f3d48;background:#010609}
    .prefControlLabel{display:grid;grid-template-columns:92px minmax(0,1fr);gap:9px;align-items:center;color:#8da4ae;font-size:10px;font-weight:900;letter-spacing:.06em}
    .prefSelect{width:100%;min-width:0;min-height:36px;border:1px solid #3a6475;background:#04111a;color:#d9f6ff;padding:8px 9px;font:900 12px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
    .prefSyndicateGrid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.prefSlotControl{grid-template-columns:28px minmax(0,1fr)}
    .prefShellGrid{display:grid;gap:7px}.prefShellRow{display:flex;align-items:center;justify-content:space-between;gap:9px;border:1px solid #403b22;background:#070903;padding:8px 9px}.prefShellCharacter{display:block;color:#f4e4a2;font-size:11px;letter-spacing:.05em}.prefShellName{display:block;margin-top:3px;color:#95aab4;font-size:9.5px}.prefShellMeta{display:flex;align-items:center;gap:6px;flex:0 0 auto;color:#aebdc4;font-size:9px;font-weight:900}.prefShellState{border:1px solid #71622f;padding:3px 5px;color:#f4d66f;letter-spacing:.06em}.prefShellState.shell-editable{border-color:#2f7486;color:#78dff3}.prefShellEmpty{color:#9eb1ba;font-size:10px;letter-spacing:.07em}
    .prefFrameworkRule{margin-top:11px;padding:9px 10px;border-left:3px solid #43c8ff;background:#031019;color:#93abb5;font-size:10.5px;line-height:1.5}.prefFrameworkRule b{color:#bceeff}
    @media(max-width:760px){.prefModuleGrid,.prefStateCounts{grid-template-columns:1fr}.prefFrameworkHead span{text-align:left}.prefSyndicateGrid{grid-template-columns:1fr}.prefControlLabel{grid-template-columns:78px minmax(0,1fr)}}
  `;
  d.head.appendChild(s);
}

function setMeterPresentation(d,value){
  const normalized=value==='rails'?'rails':'blocks';
  const module=moduleById('meter_presentation');
  if(module)writeChoice(module,normalized);
  try{
    const url=new URL(location.href);
    if(url.searchParams.get('meters')!==normalized){
      url.searchParams.set('meters',normalized);
      history.replaceState(null,'',url.pathname+url.search+url.hash);
    }
  }catch{}
  const intel=d?.getElementById('runnerMarketIntel');
  if(intel)intel.dataset.meterVariant=normalized;
  const cluster=d?.querySelector('#runnerVigContributors .instrumentCluster,.instrumentCluster');
  if(cluster)cluster.dataset.meterStyle=normalized==='blocks'?'segmented-led':'terminal-rail';
}
function reloadSyndicateFrames(d){
  d?.querySelectorAll('iframe[src*="slot-host.html?slot="]').forEach(frame=>{
    try{frame.contentWindow.location.reload()}catch{}
  });
}
function saveSyndicateFromControls(d){
  const selects=[...d.querySelectorAll('[data-pref-syndicate-slot]')].sort((a,b)=>Number(a.dataset.prefSyndicateSlot)-Number(b.dataset.prefSyndicateSlot));
  if(selects.length!==4)return;
  const assignments=selects.map(s=>s.value||null);
  const nonempty=assignments.filter(Boolean);
  if(new Set(nonempty).size!==nonempty.length){render(d,true);return}
  writeSyndicateAssignments(assignments);
  render(d,true);
  reloadSyndicateFrames(d);
}
function resolveStartupValue(){
  const module=moduleById('startup_screen');
  if(!module)return 'board';
  const value=readChoice(module);
  if(value!=='last_used')return value;
  const last=safeGet(LAST_VIEW_KEY,'board');
  return ['board','market','history','engine'].includes(last)?last:'board';
}
function resolveHistoryValue(){
  const module=moduleById('history_landing');
  if(!module)return 'summary';
  const value=readChoice(module);
  if(value!=='last_used')return value;
  const last=safeGet(LAST_HISTORY_KEY,'summary');
  const allowed=(module.options||[]).map(x=>x.value).filter(x=>x!=='last_used');
  return allowed.includes(last)?last:'summary';
}
function applyHistoryLanding(d){
  const value=resolveHistoryValue();
  const button=d.querySelector(`.subbtn[data-h="${CSS.escape(value)}"]`);
  if(button&&!button.classList.contains('active'))button.click();
}
function detailDesiredState(){
  const module=moduleById('recommendation_detail');
  if(!module)return false;
  const value=readChoice(module);
  if(value==='expanded')return true;
  if(value==='remember')return safeGet(DETAIL_LAST_KEY,'collapsed')==='expanded';
  return false;
}
function applyDetailDefaults(d,force=false){
  const open=detailDesiredState();
  d.querySelectorAll('.detail').forEach(detail=>{
    if(!force&&detail.dataset.prefDetailInit==='1')return;
    detail.dataset.prefDetailInit='1';
    detail.classList.toggle('open',open);
  });
}
function applyStartup(d){
  if(d.documentElement.dataset.prefStartupApplied==='1')return;
  d.documentElement.dataset.prefStartupApplied='1';
  const value=resolveStartupValue();
  const button=d.querySelector(`.btn[data-view="${CSS.escape(value)}"]`);
  if(button&&!button.classList.contains('active'))button.click();
  if(value==='history')setTimeout(()=>applyHistoryLanding(d),0);
}
function bindRuntime(d){
  if(d.documentElement.dataset.prefRuntimeBound==='1')return;
  d.documentElement.dataset.prefRuntimeBound='1';
  d.addEventListener('click',event=>{
    const view=event.target.closest?.('.btn[data-view]');
    if(view){
      const value=String(view.dataset.view||'');
      if(['board','market','history','engine'].includes(value))safeSet(LAST_VIEW_KEY,value);
      if(value==='history')setTimeout(()=>applyHistoryLanding(d),0);
    }
    const historyButton=event.target.closest?.('.subbtn[data-h]');
    if(historyButton)safeSet(LAST_HISTORY_KEY,String(historyButton.dataset.h||'summary'));
    const analysisButton=event.target.closest?.('.analysisBtn');
    if(analysisButton){
      setTimeout(()=>{
        const id=analysisButton.dataset.detail;
        const detail=id?d.getElementById(id):analysisButton.nextElementSibling;
        const isOpen=Boolean(detail?.classList?.contains('open'));
        safeSet(DETAIL_LAST_KEY,isOpen?'expanded':'collapsed');
      },0);
    }
  });
  applyStartup(d);
  applyDetailDefaults(d);
  const meter=moduleById('meter_presentation');
  if(meter)setMeterPresentation(d,readChoice(meter));
}

function bindControls(d){
  const box=d.getElementById(OVERVIEW_ID);
  if(!box||box.dataset.bound==='1')return;
  box.dataset.bound='1';
  box.addEventListener('change',event=>{
    const choice=event.target.closest?.('[data-pref-choice]');
    if(choice){
      const module=moduleById(choice.dataset.prefChoice);
      if(!module||module.state!=='active'||module.editable===false)return;
      const value=choice.value;
      if(!writeChoice(module,value))return;
      if(module.id==='meter_presentation')setMeterPresentation(d,value);
      if(module.id==='recommendation_detail')applyDetailDefaults(d,true);
      return;
    }
    const slot=event.target.closest?.('[data-pref-syndicate-slot]');
    if(slot)saveSyndicateFromControls(d);
  });
}
function render(d,force=false){
  if(!prefs||!d?.body)return false;
  const panel=d.getElementById('runnerSchedulePreferences');
  if(!panel)return false;
  ensureStyle(d);
  let box=d.getElementById(OVERVIEW_ID);
  if(!box){
    box=d.createElement('section');
    box.id=OVERVIEW_ID;
    const head=panel.querySelector('.sp-head');
    head?head.insertAdjacentElement('afterend',box):panel.prepend(box);
  }
  const c=counts();
  const settings=(prefs.modules||[]).map(m=>m.kind==='choice'?[m.id,readChoice(m)]:m.kind==='syndicate'?[m.id,readSyndicateAssignments()]:m.kind==='manifest'?[m.id,hotlineShells?.updatedAt||'',hotlineShells?.shells?.length||0]:[m.id,m.state]);
  const key=JSON.stringify([prefs.schema,prefs.modules,c,settings]);
  if(!force&&box.dataset.key===key&&box.innerHTML){bindControls(d);return true}
  box.dataset.key=key;
  box.dataset.bound='0';
  box.innerHTML=`
    <div class="prefFrameworkHead"><b>PREFERENCE MODULES</b><span>ACTIVE UI PREFERENCES ARE SAVED LOCALLY // OPERATING RULES AND ISSUED HISTORY REMAIN REPOSITORY-CONTROLLED</span></div>
    <div class="prefStateCounts">
      <div class="prefStateCount active"><small>ACTIVE</small><b>${c.active}</b></div>
      <div class="prefStateCount display"><small>DISPLAY ONLY</small><b>${c.display_only}</b></div>
      <div class="prefStateCount reserved"><small>RESERVED</small><b>${c.reserved}</b></div>
    </div>
    <div class="prefModuleGrid">${(prefs.modules||[]).map(moduleCard).join('')}</div>
    <div class="prefFrameworkRule"><b>F6 ARCHITECTURE RULE:</b> UI preferences may change presentation or landing behavior only. Pricing, identity, freshness, staking, the five-pull budget and the active daily schedule are not preference controls.</div>
  `;
  bindControls(d);
  return true;
}
function attach(){
  const d=appDoc();
  if(!d?.body)return false;
  if(d!==lastDoc){
    lastDoc=d;
    if(observer)observer.disconnect();
    bindRuntime(d);
    observer=new MutationObserver(()=>requestAnimationFrame(()=>{
      render(d);
      applyDetailDefaults(d);
    }));
    const panel=d.getElementById('runnerSchedulePreferences'),live=d.getElementById('runnerLive'),term=d.querySelector('main.term');
    if(panel)observer.observe(panel,{subtree:true,childList:true});
    if(live)observer.observe(live,{subtree:true,childList:true});
    if(term)observer.observe(term,{childList:true});
  }
  render(d);
  applyDetailDefaults(d);
  return true;
}

Promise.all([
  fetch(`${DATA_URL}?v=${Date.now()}`,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(`preferences ${r.status}`);return r.json()}),
  fetch(`${SYNDICATES_URL}?v=${Date.now()}`,{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null),
  fetch(`${HOTLINE_SHELLS_URL}?v=${Date.now()}`,{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null)
]).then(([data,syndicateData,shellData])=>{
  prefs=data;
  syndicates=syndicateData;
  hotlineShells=shellData;
  let tries=0;
  const timer=setInterval(()=>{tries++;if(attach()||tries>180)clearInterval(timer)},100);
  window.addEventListener('pageshow',()=>{const d=appDoc();if(d){render(d);applyDetailDefaults(d)}});
}).catch(e=>console.warn('Preferences framework unavailable',e));
})();