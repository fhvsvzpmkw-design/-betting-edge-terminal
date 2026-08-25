(()=>{
'use strict';

// Canonical fixed-menu bootstrap.
// Reordering is retired. The v1.5 UI owns one permanent F1-F8 + TAB menu.
// Specialty modules bind to these existing buttons; they only create a button
// themselves as a fallback if this bootstrap is unavailable.

const LEGACY_STORAGE_KEY='bettingEdge.preferences.mainMenuOrder.v1';
const HINT_ID='runnerMenuOrderHint';
const PREF_BOX_ID='runnerMenuOrderPreference';
const STYLE_ID='runnerCanonicalMenuBootstrapStyle';
const ORDER=['board','market','history','syndicate','pizza','crypto','meat','engine','preferences'];
const DEFINITIONS={
  board:{selector:'.btn[data-view="board"]',key:'F1',html:'<span class="primaryMenuMain"><b>[F1]</b>&nbsp; 📺 VIG SCOPE 📺</span><span class="primaryMenuMessage">FULL VIG SCOPE + PICK CARDS&nbsp;&nbsp; // &nbsp;&nbsp;PRESS [F1] TO OPEN</span>'},
  market:{selector:'.btn[data-view="market"]',key:'F2',html:'<span class="primaryMenuMain"><b>[F2]</b>&nbsp; 📈 MARKET 📉</span><span class="primaryMenuMessage">MARKET VIEW&nbsp;&nbsp; // &nbsp;&nbsp;PRESS [F2] TO OPEN</span>'},
  history:{selector:'.btn[data-view="history"]',key:'F3',html:'<span class="primaryMenuMain"><b>[F3]</b>&nbsp; 🎟️ BET HISTORY 🎟️</span><span class="primaryMenuMessage">BET HISTORY&nbsp;&nbsp; // &nbsp;&nbsp;PRESS [F3] TO OPEN</span>'},
  syndicate:{selector:'#runnerSyndicateF5',id:'runnerSyndicateF5',key:'F4',html:'<span class="canonicalMenuMain"><b>[F4]</b>&nbsp; 💵 SYNDICATE 💵</span><span class="canonicalMenuMessage">DISCONNECTED&nbsp;&nbsp; // &nbsp;&nbsp;PRESS [F4] TO LOAD SYNDICATE</span>'},
  pizza:{selector:'#runnerPizzaF6',id:'runnerPizzaF6',key:'F5',html:'<span class="canonicalMenuMain"><b>[F5]</b>&nbsp; 🍕 PIZZA PLAYS 🍕</span><span class="canonicalMenuMessage">LOU TWO SLICE&nbsp;&nbsp; // &nbsp;&nbsp;PRESS [F5] TO OPEN</span>'},
  crypto:{selector:'#runnerCryptoF7',id:'runnerCryptoF7',key:'F6',html:'<span class="canonicalMenuMain"><b>[F6]</b>&nbsp; 🔒 CRYPTO SPECIALS 🔒</span><span class="canonicalMenuMessage">DAILY WEB INTELLIGENCE&nbsp;&nbsp; // &nbsp;&nbsp;PRESS [F6] TO OPEN</span>'},
  meat:{selector:'#runnerSeasonPreviewF6',id:'runnerSeasonPreviewF6',key:'F7',html:'<span class="canonicalMenuMain"><b>[F7]</b>&nbsp; 🥩 MEAT DESK 🥩</span><span class="canonicalMenuMessage">PRIVATE RESEARCH DESK&nbsp;&nbsp; // &nbsp;&nbsp;PRESS [F7] TO OPEN</span>'},
  engine:{selector:'.btn[data-view="engine"]',key:'F8',html:'<span class="primaryMenuMain"><b>[F8]</b>&nbsp; ⚙️ ENGINE ⚙️</span><span class="primaryMenuMessage">ENGINE STATUS&nbsp;&nbsp; // &nbsp;&nbsp;PRESS [F8] TO OPEN</span>'},
  preferences:{selector:'#runnerPreferencesF6',id:'runnerPreferencesF6',key:'TAB',html:'<span class="canonicalMenuMain"><b>[TAB]</b>&nbsp; ⚙ PREFERENCES</span><span class="canonicalMenuMessage">OPERATIONS + DISPLAY&nbsp;&nbsp; // &nbsp;&nbsp;PRESS TO OPEN</span>'}
};

try{localStorage.removeItem(LEGACY_STORAGE_KEY)}catch{}

function appDoc(){
  try{
    const core=document.getElementById('core');
    const app=core?.contentDocument?.getElementById('app');
    return app?.contentDocument||null;
  }catch{return null}
}
function tabs(d){return d.querySelector('.runnerNavPad .tabs')||d.querySelector('.tabs')}
function button(d,id){
  const root=tabs(d),def=DEFINITIONS[id];
  return root&&def?root.querySelector(def.selector):null;
}
function removeLegacyUi(d){
  d.getElementById(HINT_ID)?.remove();
  d.getElementById(PREF_BOX_ID)?.remove();
  d.querySelectorAll('.menuOrderHandle,.canonicalMenuPlaceholder').forEach(x=>x.remove());
  d.body?.classList.remove('runnerMenuReordering');
  d.getElementById('runnerMenuOrderControllerStyle')?.remove();
}
function ensureStyle(d){
  if(d.getElementById(STYLE_ID))return;
  const s=d.createElement('style');
  s.id=STYLE_ID;
  s.textContent=`
    /* This is the neutral menu presentation when no page/shell state owns it. */
    .term .tabs,.term .runnerNavPad .tabs{grid-template-columns:1fr!important;gap:9px!important}
    .term .tabs>.btn[data-menu-id]{grid-column:1/-1!important;display:grid;place-items:center;gap:7px;min-height:58px;padding:10px 8px}
    .canonicalMenuMain{display:block;font-size:inherit;font-weight:900}
    .canonicalMenuMessage{display:block;color:#748f9c;font-size:8px;font-weight:900;letter-spacing:.10em;line-height:1.35}
    .term .tabs>.btn[data-menu-id="board"]{border-color:var(--green)!important;color:var(--green)!important;background:#03140b!important}
    .term .tabs>.btn[data-menu-id="market"]{border-color:var(--cyan)!important;color:var(--cyan)!important;background:#03101b!important}
    .term .tabs>.btn[data-menu-id="history"]{border-color:var(--blue)!important;color:var(--blue)!important;background:#061126!important}
    .term .tabs>.btn[data-menu-id="syndicate"]{border-color:#c9a43b!important;color:#ffe17b!important;background:#070903!important}
    .term .tabs>.btn[data-menu-id="pizza"]{border-color:#c97035!important;color:#ffd7a3!important;background:#100704!important}
    .term .tabs>.btn[data-menu-id="crypto"]{border-color:#6552a8!important;color:#cfc4ff!important;background:#070611!important}
    .term .tabs>.btn[data-menu-id="meat"]{border-color:#9b5b50!important;color:#ffd0bb!important;background:#0a0505!important}
    .term .tabs>.btn[data-menu-id="engine"]{border-color:var(--mag)!important;color:var(--mag)!important;background:#16091a!important}
    .term .tabs>.btn[data-menu-id="preferences"]{border-color:#4d6b7d!important;color:#b9dfff!important;background:#020a10!important}
    .term .tabs>.btn[data-menu-id].active{color:inherit!important}
  `;
  d.head.appendChild(s);
}
function createSpecialtyButton(d,id){
  const root=tabs(d),def=DEFINITIONS[id];
  if(!root||!def?.id)return null;
  let b=d.getElementById(def.id);
  if(b)return b;
  b=d.createElement('button');
  b.type='button';
  b.id=def.id;
  b.className='btn';
  b.innerHTML=def.html;
  if(id==='syndicate')b.setAttribute('aria-pressed','false');
  root.appendChild(b);
  return b;
}
function markButton(b,id){
  const key=DEFINITIONS[id].key;
  b.dataset.menuId=id;
  b.dataset.menuKey=key;
  delete b.dataset.menuReorderable;
  if(key.startsWith('F'))b.setAttribute('aria-keyshortcuts',key);else b.removeAttribute('aria-keyshortcuts');
}
function setPrimaryLabel(b,id){
  if(!b||!['board','market','history','engine'].includes(id))return;
  const html=DEFINITIONS[id].html;
  if(!b.querySelector('.primaryMenuMain')&&html)b.innerHTML=html;
}
function setPreferenceLabel(b){
  if(!b)return;
  const first=b.querySelector('b');
  if(first&&first.textContent!=='[TAB]')first.textContent='[TAB]';
  const walker=b.ownerDocument.createTreeWalker(b,b.ownerDocument.defaultView?.NodeFilter?.SHOW_TEXT||4);
  let n=null;while((n=walker.nextNode())){if(n.nodeValue?.includes('[F6]'))n.nodeValue=n.nodeValue.replaceAll('[F6]','[TAB]')}
}
function reconcile(d){
  if(!d?.body)return false;
  const root=tabs(d);if(!root)return false;
  removeLegacyUi(d);ensureStyle(d);

  // The four core view buttons must already exist because their v1.3 view
  // handlers are attached by the core. Specialty buttons are safe to create
  // here because their modules now adopt and bind existing buttons.
  for(const id of ['syndicate','pizza','crypto','meat','preferences']){
    if(!button(d,id))createSpecialtyButton(d,id);
  }

  const buttons=ORDER.map(id=>button(d,id));
  if(buttons.some(x=>!x))return false;

  buttons.forEach((b,index)=>{
    const id=ORDER[index];
    markButton(b,id);
    setPrimaryLabel(b,id);
    if(id==='preferences')setPreferenceLabel(b);
  });
  buttons.forEach(b=>root.appendChild(b));

  d.documentElement.dataset.menuBootstrap='ready';
  d.documentElement.dataset.menuOrderAuthority='canonical-static';
  if(d.defaultView)d.defaultView.BettingEdgeMenuOrder=window.BettingEdgeMenuOrder;
  return true;
}

window.BettingEdgeMenuOrder={
  getOrder:()=>[...ORDER],
  getFunctionMap:()=>Object.fromEntries(ORDER.slice(0,8).map((id,i)=>[`F${i+1}`,id])),
  keyFor:id=>DEFINITIONS[id]?.key||'',
  reset:()=>{const d=appDoc();return d?reconcile(d):false},
  refresh:()=>{const d=appDoc();return d?reconcile(d):false}
};

let tries=0;
const timer=setInterval(()=>{
  tries++;
  const d=appDoc();
  if((d&&reconcile(d))||tries>=150)clearInterval(timer);
},40);
})();
