(()=>{
'use strict';

const DATA_URL='./data/preferences.json';
const OVERVIEW_ID='runnerPreferenceModuleOverview';
const STYLE_ID='runnerPreferenceFrameworkStyle';
let prefs=null,lastDoc=null,observer=null;

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
function moduleCard(module){
  const state=stateDef(module.state);
  return `<article class="prefModuleCard state-${esc(module.state)}" data-preference-module="${esc(module.id)}">
    <div class="prefModuleHead"><b>${esc(module.title)}</b><span class="prefStateBadge">${esc(state.label)}</span></div>
    <p>${esc(module.summary)}</p>
    <div class="prefModulePolicy">${esc(module.controlPolicy||state.meaning)}</div>
  </article>`;
}
function counts(){
  const out={active:0,display_only:0,reserved:0};
  for(const module of prefs?.modules||[]){if(Object.hasOwn(out,module.state))out[module.state]++;}
  return out;
}
function ensureStyle(d){
  if(d.getElementById(STYLE_ID))return;
  const s=d.createElement('style');
  s.id=STYLE_ID;
  s.textContent=`
    #${OVERVIEW_ID}{margin:10px 0;border:1px solid #2d566b;background:linear-gradient(180deg,#020b12,#01070b);padding:9px}
    .prefFrameworkHead{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;margin-bottom:8px}
    .prefFrameworkHead b{color:#9feaff;font-size:10px;letter-spacing:.1em}.prefFrameworkHead span{color:#718c9a;font-size:7px;line-height:1.45;max-width:620px;text-align:right}
    .prefStateCounts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-bottom:8px}
    .prefStateCount{border:1px solid #203b49;background:#02070b;padding:6px 7px}.prefStateCount small{display:block;color:#6e8997;font-size:6.5px;letter-spacing:.1em}.prefStateCount b{display:block;margin-top:2px;font-size:14px;color:#d9f5ff}.prefStateCount.active b{color:#8effaa}.prefStateCount.display b{color:#f5dd83}.prefStateCount.reserved b{color:#8ca2ae}
    .prefModuleGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}
    .prefModuleCard{min-width:0;border:1px solid #284552;background:#02080c;padding:8px}.prefModuleCard.state-active{border-color:#347b4a}.prefModuleCard.state-display_only{border-color:#75652e}.prefModuleCard.state-reserved{border-color:#394b54;opacity:.82}
    .prefModuleHead{display:flex;justify-content:space-between;gap:8px;align-items:center}.prefModuleHead b{color:#dff6ff;font-size:9px;letter-spacing:.08em}.prefStateBadge{flex:0 0 auto;border:1px solid #475b65;padding:3px 5px;color:#91a8b4;background:#04090c;font-size:6.5px;font-weight:950;letter-spacing:.08em}.state-active .prefStateBadge{border-color:#438858;color:#8effaa}.state-display_only .prefStateBadge{border-color:#8b7631;color:#ffe07a}.state-reserved .prefStateBadge{color:#82949e}
    .prefModuleCard p{margin:6px 0 5px;color:#8ba2af;font-size:7.5px;line-height:1.45}.prefModulePolicy{border-top:1px solid #1b313b;padding-top:5px;color:#617985;font-size:7px;line-height:1.4}
    .prefFrameworkRule{margin-top:8px;padding:7px 8px;border-left:3px solid #43c8ff;background:#031019;color:#7f9dab;font-size:7.5px;line-height:1.45}.prefFrameworkRule b{color:#bceeff}
    @media(max-width:760px){.prefModuleGrid,.prefStateCounts{grid-template-columns:1fr}.prefFrameworkHead span{text-align:left}}
  `;
  d.head.appendChild(s);
}
function render(d){
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
  const key=JSON.stringify([prefs.schema,prefs.modules,c]);
  if(box.dataset.key===key&&box.innerHTML)return true;
  box.dataset.key=key;
  box.innerHTML=`
    <div class="prefFrameworkHead"><b>PREFERENCE MODULES</b><span>ONE PERMANENT F6 PANE // EACH MODULE CAN BE OPERATIONAL, DISPLAY-ONLY OR RESERVED INDEPENDENTLY</span></div>
    <div class="prefStateCounts">
      <div class="prefStateCount active"><small>ACTIVE</small><b>${c.active}</b></div>
      <div class="prefStateCount display"><small>DISPLAY ONLY</small><b>${c.display_only}</b></div>
      <div class="prefStateCount reserved"><small>RESERVED</small><b>${c.reserved}</b></div>
    </div>
    <div class="prefModuleGrid">${(prefs.modules||[]).map(moduleCard).join('')}</div>
    <div class="prefFrameworkRule"><b>F6 ARCHITECTURE RULE:</b> adding another terminal preference should add or promote a module in this registry; it should not require rebuilding the Preferences pane or scattering controls through the runner.</div>
  `;
  return true;
}
function attach(){
  const d=appDoc();
  if(!d?.body)return false;
  if(d!==lastDoc){
    lastDoc=d;
    if(observer)observer.disconnect();
    observer=new MutationObserver(()=>requestAnimationFrame(()=>render(d)));
    observer.observe(d.body,{subtree:true,childList:true});
  }
  return render(d);
}
fetch(`${DATA_URL}?v=${Date.now()}`,{cache:'no-store'})
  .then(r=>{if(!r.ok)throw new Error(`preferences ${r.status}`);return r.json()})
  .then(data=>{prefs=data;let tries=0;const timer=setInterval(()=>{tries++;if(attach()||tries>180)clearInterval(timer)},100);setInterval(()=>{const d=appDoc();if(d)render(d)},1500)})
  .catch(e=>console.warn('Preferences framework unavailable',e));
})();
