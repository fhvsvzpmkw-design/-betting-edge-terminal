(()=>{
'use strict';

const DATA_URL='./data/preferences.json';
const SYNDICATES_URL='./data/syndicates.json';
const HOTLINE_SHELLS_URL='./data/hotline-shells.json';
const OVERVIEW_ID='runnerPreferenceModuleOverview';
const PANEL_ID='runnerPreferencesPanel';
const BUTTON_ID='runnerPreferencesF6';
const STYLE_ID='runnerPreferenceFrameworkStyle';

const LAST_VIEW_KEY='bettingEdge.preferences.lastView';
const LAST_HISTORY_KEY='bettingEdge.preferences.lastHistoryView';
const DETAIL_LAST_KEY='bettingEdge.preferences.recommendationDetailLastState';
const SYNDICATE_SLOT_COUNT=8;
const SYNDICATE_ORDER_KEY='bettingEdge.syndicateSlots.defaultOrderRevision';
const SYNDICATE_FALLBACK=['eddie-numbers','graham-mercer','vic-fremont','guy-laflame','lou-vega',null,null,null];

let prefs=null,syndicates=null,hotlineShells=null,lastDoc=null,observer=null;
const GROUPS=[
  {id:'appearance',title:'Appearance',icon:'🎨',modules:['meter_presentation','card_view'],reset:'Reset appearance'},
  {id:'navigation',title:'Navigation',icon:'🧭',modules:['startup_screen','history_landing','recommendation_detail']},
  {id:'syndicate',title:'Syndicate lineup',icon:'💵',modules:['syndicate_load','hotline_shells'],reset:'Restore default lineup'},
  {id:'research',title:'Research depth',icon:'🔎',modules:['meat_desk_analysis','crypto_specials_analysis']}
];
const feedback=new Map();

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
function normalizedSyndicateAssignments(source){
  return Array.from({length:SYNDICATE_SLOT_COUNT},(_,i)=>source[i]==null?null:String(source[i]));
}
function syndicateOrderRevision(){return window.VigwireSyndicateRoster.revision(syndicates)}
function migrateSyndicateOrder(source,defaults){
  return window.VigwireSyndicateRoster.migrate(source,defaults);
}
function defaultSyndicateAssignments(){
  const source=Array.isArray(syndicates?.defaults)&&[4,SYNDICATE_SLOT_COUNT].includes(syndicates.defaults.length)?syndicates.defaults:SYNDICATE_FALLBACK;
  return normalizedSyndicateAssignments(source);
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
  if(!syndicates?.profiles?.length)return defaultSyndicateAssignments();
  return window.VigwireSyndicateRoster.read(syndicates,window);
}
function writeSyndicateAssignments(assignments){
  if(!syndicates?.profiles?.length)return false;
  try{window.VigwireSyndicateRoster.write(assignments,syndicates,window);return true}catch{return false}
}
function choiceControl(module){
  const value=readChoice(module);
  const options=(module.options||[]).map(o=>`<option value="${esc(o.value)}"${o.value===value?' selected':''}>${esc(o.label)}</option>`).join('');
  return `<label class="prefControlLabel"><span>Selected</span><select class="prefSelect" aria-label="${esc(module.title)}" data-pref-choice="${esc(module.id)}">${options}</select></label>`;
}
function syndicateControl(){
  if(!syndicates?.profiles?.length)return '<div class="prefShellEmpty">CHARACTER LIBRARY UNAVAILABLE // RELOAD TO TRY AGAIN</div>';
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
    return `<label class="prefControlLabel prefSlotControl"><span>Slot ${index+1}</span><select class="prefSelect" aria-label="Syndicate slot ${index+1}" data-pref-syndicate-slot="${index}">${opts}</select></label>`;
  }).join('')}</div>`;
}
function currentHotlineShells(){
  const current=new Map();
  for(const shell of Array.isArray(hotlineShells?.shells)?hotlineShells.shells:[]){
    if(!shell.characterId||shell.defaultForCharacter!==true)continue;
    const previous=current.get(shell.characterId);
    if(!previous||Number(shell.version)>Number(previous.version))current.set(shell.characterId,shell);
  }
  const profiles=(syndicates?.profiles||[]).filter(profile=>profile.enabled!==false&&profile.url);
  const order=[...defaultSyndicateAssignments().filter(Boolean),...profiles.map(profile=>profile.id)];
  const rank=new Map();
  order.forEach(id=>{const profile=profiles.find(profile=>profile.id===id),character=profile?.characterId||id;if(!rank.has(character))rank.set(character,rank.size)});
  return [...current.values()].sort((a,b)=>(rank.get(a.characterId)??999)-(rank.get(b.characterId)??999));
}
function hotlineShellDisplay(){
  const shells=currentHotlineShells();
  if(!shells.length)return '<div class="prefShellEmpty">Hotline designs are unavailable. Reload to try again.</div>';
  return `<details class="prefShellDetails"><summary>View current hotline designs <span>${shells.length} members</span></summary><div class="prefShellGrid">${shells.map(shell=>{
    const character=syndicateCharacterLabel(shell.characterId);
    return `<div class="prefShellRow" data-pref-shell-character="${esc(shell.characterId)}">
      <div><b class="prefShellCharacter">${esc(character)}</b><span class="prefShellName">${esc(shell.name||shell.id)}</span></div>
    </div>`;
  }).join('')}</div></details>`;
}
function moduleControl(module){
  if(module.kind==='manifest'&&module.id==='hotline_shells')return hotlineShellDisplay();
  if(module.state!=='active'||module.editable===false)return '';
  if(module.kind==='choice')return choiceControl(module);
  if(module.kind==='syndicate')return syndicateControl();
  return '';
}
function effectLabel(id){
  return ({meter_presentation:'Applies now.',card_view:'Applies now.',startup_screen:'Applies next time you open VigScope.',history_landing:'Applies next time you open Bet History.',recommendation_detail:'Applies now.',syndicate_load:'Used on your next Syndicate visit.',meat_desk_analysis:'Used for your next manual Meat Desk review.',crypto_specials_analysis:'Used for your next manual Crypto Specials review.'})[id]||'';
}
function feedbackHtml(id){
  const state=feedback.get(id);
  return `<p class="prefSaveStatus${state?.error?' prefSaveError':''}" data-pref-status="${esc(id)}" role="status" aria-live="polite">${esc(state?.message||'')}</p>`;
}
function showFeedback(d,id,message,error=false){
  feedback.set(id,{message,error});
  const status=d.querySelector(`[data-pref-status="${CSS.escape(id)}"]`);
  if(status){status.classList.toggle('prefSaveError',error);status.textContent=message}
}
function moduleCard(module){
  const control=moduleControl(module);
  return `<article class="prefModuleCard" data-preference-module="${esc(module.id)}">
    <div class="prefModuleHead"><b>${esc(module.title)}</b></div>
    <p>${esc(module.summary)}</p>
    ${control?`<div class="prefModuleControl">${control}</div>`:''}
    ${effectLabel(module.id)?`<p class="prefEffect">${esc(effectLabel(module.id))}</p>`:''}
    ${feedbackHtml(module.id)}
  </article>`;
}
function groupedControls(){
  return GROUPS.map(group=>`<section class="prefGroup" data-pref-group="${group.id}" aria-labelledby="prefGroup-${group.id}">
    <div class="prefGroupHead"><h3 id="prefGroup-${group.id}"><span aria-hidden="true">${group.icon}</span> ${group.title}</h3>${group.reset?`<button type="button" class="prefReset" data-pref-reset="${group.id}">${group.reset}</button>`:''}</div>
    <div class="prefModuleGrid">${group.modules.map(moduleById).filter(module=>module&&module.state!=='reserved').map(moduleCard).join('')}</div>
    ${feedbackHtml(group.id)}
  </section>`).join('');
}
function ensureShell(d){
  const tabs=d.querySelector('.runnerNavPad .tabs')||d.querySelector('.tabs');
  if(!tabs)return false;
  let button=d.getElementById(BUTTON_ID);
  if(!button){
    button=d.createElement('button');
    button.type='button';
    button.className='btn';
    button.id=BUTTON_ID;
    button.innerHTML='<span class="canonicalMenuMain"><b>[TAB]</b>&nbsp; ⚙ PREFERENCES</span><span class="canonicalMenuMessage">OPERATIONS + DISPLAY&nbsp;&nbsp; // &nbsp;&nbsp;PRESS TO OPEN</span>';
    tabs.appendChild(button);
  }
  let panel=d.getElementById(PANEL_ID);
  // The tabs exist before the hierarchy patch assigns runnerNavPad.
  // Use their container so the Preferences panel never hides the whole terminal.
  const nav=d.querySelector('.runnerNavPad')||tabs.parentElement;
  if(!panel){
    panel=d.createElement('section');
    panel.id=PANEL_ID;
    nav?nav.insertAdjacentElement('afterend',panel):d.body.prepend(panel);
  }else if(nav&&panel.parentElement!==nav.parentElement){
    nav.insertAdjacentElement('afterend',panel);
  }
  if(button.dataset.preferencesBound!=='1'){
    button.dataset.preferencesBound='1';
    button.addEventListener('click',()=>{
      const open=!d.body.classList.contains('runnerPreferencesLoaded');
      d.body.classList.remove('runnerSyndicateLoaded');
      d.body.classList.toggle('runnerPreferencesLoaded',open);
      button.classList.toggle('active',open);
      if(open)render(d);
    });
  }
  if(tabs.dataset.preferencesCloseBound!=='1'){
    tabs.dataset.preferencesCloseBound='1';
    tabs.addEventListener('click',event=>{
      const selected=event.target.closest('.btn');
      const current=d.getElementById(BUTTON_ID);
      if(selected&&current&&selected!==current&&!selected.matches('#runnerSyndicateF5')){
        d.body.classList.remove('runnerPreferencesLoaded');
        current.classList.remove('active');
      }
    });
  }
  return true;
}
function ensureStyle(d){
  if(d.getElementById(STYLE_ID))return;
  const s=d.createElement('style');
  s.id=STYLE_ID;
  s.textContent=`
    #${PANEL_ID}{display:none;margin:0 12px 14px;padding:0;border:0;background:transparent}
    body.runnerPreferencesLoaded #${PANEL_ID}{display:block}
    #${OVERVIEW_ID}{margin:12px 0;padding:0;color:#d9f6ff;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
    .prefFrameworkHead{margin:0 0 16px;padding:4px 0}
    .prefFrameworkHead h2{margin:0;color:#c6f3ff;font-size:22px;line-height:1.3}
    .prefFrameworkHead p{margin:7px 0 0;color:#8da6b1;font-size:11.5px;line-height:1.5}
    .prefGroup{--pref-accent:#66d9ff;margin:12px 0;padding:12px;border:1px solid #254653;border-radius:12px;background:linear-gradient(160deg,#07131c,#02080d)}
    .prefGroup[data-pref-group="appearance"]{--pref-accent:#83eea7}
    .prefGroup[data-pref-group="syndicate"]{--pref-accent:#f0d47b}
    .prefGroup[data-pref-group="research"]{--pref-accent:#d4a2ff}
    .prefGroupHead{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px}
    .prefGroupHead h3{margin:0;color:var(--pref-accent);font-size:16px;line-height:1.35}
    .prefGroupHead h3 span{margin-right:3px}
    .prefReset{min-height:44px;max-width:100%;padding:9px 11px;border:1px solid #416273;border-radius:8px;background:#06141e;color:#bfe6f3;font:700 11px ui-monospace,SFMono-Regular,Menlo,monospace;cursor:pointer}
    .prefReset:hover{border-color:var(--pref-accent);color:var(--pref-accent)}
    .prefReset:focus-visible,.prefSelect:focus-visible,.prefShellDetails summary:focus-visible{outline:2px solid var(--pref-accent);outline-offset:3px}
    .prefModuleGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
    .prefModuleCard{min-width:0;border:1px solid #1e3743;border-radius:9px;background:#020a10;padding:12px}
    .prefModuleHead b{color:#d4eef7;font-size:13px;line-height:1.4}
    .prefModuleCard p{margin:8px 0;color:#8fa6b1;font-size:11px;line-height:1.5}
    .prefModuleControl{margin:11px 0 4px}
    .prefControlLabel{display:grid;grid-template-columns:64px minmax(0,1fr);gap:8px;align-items:center;color:#9bb3be;font-size:10.5px;font-weight:700}
    .prefSelect{width:100%;min-width:0;min-height:44px;border:1px solid #3a6475;border-radius:7px;background:#04111a;color:#d9f6ff;padding:9px 8px;font:700 12px ui-monospace,SFMono-Regular,Menlo,monospace}
    .prefSyndicateGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
    .prefSlotControl{grid-template-columns:44px minmax(0,1fr)}
    .prefEffect{border-top:1px solid #172f3c;padding-top:8px}
    .prefSaveStatus,.prefModuleCard .prefSaveStatus{margin:9px 0 0;color:#8effaa;font-size:11px;line-height:1.5}
    .prefSaveStatus:empty{display:none}
    .prefSaveError,.prefModuleCard .prefSaveError{color:#ffd48a}
    .prefShellDetails summary{min-height:44px;padding:11px 9px;border:1px solid #574d2c;border-radius:7px;background:#0b110f;color:#f1dda0;font-size:11px;line-height:1.5;cursor:pointer}
    .prefShellDetails summary span{display:inline-block;margin-left:8px;color:#9eaa9e;font-size:10px}
    .prefShellGrid{display:grid;gap:7px;margin-top:10px}
    .prefShellRow{display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0;border:1px solid #393822;border-radius:6px;background:#060b0c;padding:9px}
    .prefShellRow>div:first-child{min-width:0}
    .prefShellCharacter{display:block;color:#e9deac;font-size:11px;line-height:1.4;overflow-wrap:anywhere}
    .prefShellName{display:block;margin-top:4px;color:#94a8b0;font-size:9.5px;line-height:1.4;overflow-wrap:anywhere}
    .prefShellMeta{flex:0 0 auto;color:#9fb2ba;font-size:10px;white-space:nowrap}
    .prefShellEmpty{color:#9eb1ba;font-size:11px;line-height:1.5}
    @media(max-width:760px){.prefModuleGrid,.prefSyndicateGrid{grid-template-columns:1fr}.prefGroup{padding:10px}.prefModuleCard{padding:10px}.prefControlLabel{grid-template-columns:64px minmax(0,1fr)}.prefSlotControl{grid-template-columns:52px minmax(0,1fr)}}
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
  if(selects.length!==SYNDICATE_SLOT_COUNT)return;
  const assignments=selects.map(s=>s.value||null);
  const nonempty=assignments.filter(Boolean);
  if(new Set(nonempty).size!==nonempty.length){render(d,true);showFeedback(d,'syndicate_load','Each member can occupy one slot.',true);return}
  if(!writeSyndicateAssignments(assignments)){showFeedback(d,'syndicate_load','Could not save the lineup. Please try again.',true);return}
  render(d,true);
  reloadSyndicateFrames(d);
  showFeedback(d,'syndicate_load',lineupSaveMessage(assignments));
}
function lineupSaveMessage(assignments){
  return safeGet('bettingEdge.syndicateSlots.v4')===JSON.stringify(assignments)?'Saved on this device.':'Lineup applied for this visit; device storage is unavailable.';
}
function resetAppearance(d){
  const modules=['meter_presentation','card_view'].map(moduleById).filter(Boolean);
  if(modules.some(module=>!writeChoice(module,module.default))){showFeedback(d,'appearance','Could not save all appearance settings. Please try again.',true);return}
  const meter=moduleById('meter_presentation');
  if(meter)setMeterPresentation(d,meter.default);
  const card=moduleById('card_view'),control=d.querySelector('[data-pref-choice="card_view"]');
  if(card&&control){control.value=card.default;control.dispatchEvent(new d.defaultView.Event('change',{bubbles:true}))}
  render(d,true);
  showFeedback(d,'appearance','Default appearance restored. Saved on this device.');
}
function resetSyndicateLineup(d){
  const assignments=defaultSyndicateAssignments();
  if(!writeSyndicateAssignments(assignments)){showFeedback(d,'syndicate','Could not restore the lineup. Please try again.',true);return}
  render(d,true);reloadSyndicateFrames(d);
  showFeedback(d,'syndicate','Default lineup restored. '+lineupSaveMessage(assignments));
}
function resolveStartupValue(){
  const module=moduleById('startup_screen');
  if(!module)return 'menu';
  const value=readChoice(module);
  if(value!=='last_used')return value;
  const last=safeGet(LAST_VIEW_KEY,'menu');
  return ['menu','board','market','history','engine'].includes(last)?last:'menu';
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
  const value=resolveStartupValue();
  const state=d.documentElement.dataset;
  if(value==='menu'||state.primaryNavUserActivated==='1'||new URLSearchParams(location.hash.slice(1)).get('view')==='syndicate'){state.prefStartupApplied='1';return}
  // Intentional saved navigation runs after the shell's boot-time tab reset.
  if(!state.primaryNavShellBound){
    state.prefStartupAttempts=String(Number(state.prefStartupAttempts||0)+1);
    if(Number(state.prefStartupAttempts)<180)setTimeout(()=>applyStartup(d),50);
    return;
  }
  state.prefStartupApplied='1';
  const button=d.querySelector(`.btn[data-view="${CSS.escape(value)}"]`);
  if(button&&!button.classList.contains('active')){state.primaryNavUserActivated='1';button.click()}
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
      if(!writeChoice(module,value)){showFeedback(d,module.id,'Could not save on this device. Please try again.',true);return}
      if(module.id==='meter_presentation')setMeterPresentation(d,value);
      if(module.id==='recommendation_detail')applyDetailDefaults(d,true);
      // Update the cache before status text changes so focus remains on the
      // existing select instead of rebuilding the controls after every save.
      box.dataset.key=preferenceRenderKey();
      showFeedback(d,module.id,'Saved on this device.');
      return;
    }
    const slot=event.target.closest?.('[data-pref-syndicate-slot]');
    if(slot)saveSyndicateFromControls(d);
  });
  box.addEventListener('click',event=>{
    const button=event.target.closest?.('[data-pref-reset]');
    if(!button)return;
    if(button.dataset.prefReset==='appearance')resetAppearance(d);
    if(button.dataset.prefReset==='syndicate')resetSyndicateLineup(d);
  });
}
function preferenceRenderKey(){
  const settings=(prefs.modules||[]).map(m=>m.kind==='choice'?[m.id,readChoice(m)]:m.kind==='syndicate'?[m.id,readSyndicateAssignments()]:m.kind==='manifest'?[m.id,hotlineShells?.updatedAt||'',currentHotlineShells()]:[m.id,m.state]);
  return JSON.stringify([prefs.schema,prefs.modules,settings]);
}
function render(d,force=false){
  if(!prefs||!d?.body)return false;
  if(!ensureShell(d))return false;
  const panel=d.getElementById(PANEL_ID);
  if(!panel)return false;
  ensureStyle(d);
  let box=d.getElementById(OVERVIEW_ID);
  if(!box){
    box=d.createElement('section');
    box.id=OVERVIEW_ID;
    const head=panel.querySelector('.sp-head');
    head?head.insertAdjacentElement('afterend',box):panel.prepend(box);
  }
  const key=preferenceRenderKey();
  if(!force&&box.dataset.key===key&&box.innerHTML){bindControls(d);return true}
  const detailsOpen=box.querySelector('.prefShellDetails')?.open;
  const focused=d.activeElement;
  const focusAttribute=['data-pref-choice','data-pref-syndicate-slot','data-pref-reset'].find(attribute=>focused?.hasAttribute(attribute));
  const focusSelector=focusAttribute?`[${focusAttribute}="${CSS.escape(focused.getAttribute(focusAttribute))}"]`:null;
  box.dataset.key=key;
  box.innerHTML=`
    <header class="prefFrameworkHead"><h2>Preferences</h2><p>Your choices are saved automatically on this device.</p></header>
    ${groupedControls()}
  `;
  if(detailsOpen)box.querySelector('.prefShellDetails').open=true;
  if(focusSelector)box.querySelector(focusSelector)?.focus({preventScroll:true});
  bindControls(d);
  return true;
}
function attach(){
  const d=appDoc();
  if(!d?.body)return false;
  if(!ensureShell(d))return false;
  if(d!==lastDoc){
    lastDoc=d;
    if(observer)observer.disconnect();
    bindRuntime(d);
    observer=new MutationObserver(()=>requestAnimationFrame(()=>{
      render(d);
      applyDetailDefaults(d);
    }));
    const panel=d.getElementById(PANEL_ID),live=d.getElementById('runnerLive'),term=d.querySelector('main.term');
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

