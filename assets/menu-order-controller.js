(()=>{
'use strict';

// Fixed canonical-menu bootstrap.
// The reorder feature is retired. The current F1-F8 + TAB menu is the only
// menu the user should ever see. Module owners still create/bind their own
// live buttons; lightweight placeholders occupy their final positions until
// those live buttons are ready, then disappear permanently.

const LEGACY_STORAGE_KEY='bettingEdge.preferences.mainMenuOrder.v1';
const HINT_ID='runnerMenuOrderHint';
const PREF_BOX_ID='runnerMenuOrderPreference';
const STYLE_ID='runnerCanonicalMenuBootstrapStyle';
const ORDER=['board','market','history','syndicate','pizza','crypto','meat','engine','preferences'];
const DEFINITIONS={
  board:{selector:'.btn[data-view="board"]',key:'F1',html:'<span class="primaryMenuMain"><b>[F1]</b>&nbsp; 📺 VIG SCOPE 📺</span><span class="primaryMenuMessage">FULL VIG SCOPE + PICK CARDS&nbsp;&nbsp; // &nbsp;&nbsp;PRESS [F1] TO OPEN</span>'},
  market:{selector:'.btn[data-view="market"]',key:'F2',html:'<span class="primaryMenuMain"><b>[F2]</b>&nbsp; 📈 MARKET 📉</span><span class="primaryMenuMessage">MARKET VIEW&nbsp;&nbsp; // &nbsp;&nbsp;PRESS [F2] TO OPEN</span>'},
  history:{selector:'.btn[data-view="history"]',key:'F3',html:'<span class="primaryMenuMain"><b>[F3]</b>&nbsp; 🎟️ BET HISTORY 🎟️</span><span class="primaryMenuMessage">BET HISTORY&nbsp;&nbsp; // &nbsp;&nbsp;PRESS [F3] TO OPEN</span>'},
  syndicate:{selector:'#runnerSyndicateF5',key:'F4',html:'<span><b>[F4]</b>&nbsp; 💵 SYNDICATE 💵</span><span class="canonicalMenuPendingMessage">LOADING SYNDICATE MODULE</span>'},
  pizza:{selector:'#runnerPizzaF6',key:'F5',html:'<span><b>[F5]</b>&nbsp; 🍕 PIZZA PLAYS 🍕</span><span class="canonicalMenuPendingMessage">LOADING PIZZA PLAYS</span>'},
  crypto:{selector:'#runnerCryptoF7',key:'F6',html:'<span><b>[F6]</b>&nbsp; 🔒 CRYPTO SPECIALS 🔒</span><span class="canonicalMenuPendingMessage">LOADING CRYPTO SPECIALS</span>'},
  meat:{selector:'#runnerSeasonPreviewF6',key:'F7',html:'<span><b>[F7]</b>&nbsp; 🥩 MEAT DESK 🥩</span><span class="canonicalMenuPendingMessage">LOADING MEAT DESK</span>'},
  engine:{selector:'.btn[data-view="engine"]',key:'F8',html:'<span class="primaryMenuMain"><b>[F8]</b>&nbsp; ⚙️ ENGINE ⚙️</span><span class="primaryMenuMessage">ENGINE STATUS&nbsp;&nbsp; // &nbsp;&nbsp;PRESS [F8] TO OPEN</span>'},
  preferences:{selector:'#runnerPreferencesF6',key:'TAB',html:'<span><b>[TAB]</b>&nbsp; ⚙ PREFERENCES</span><span class="canonicalMenuPendingMessage">LOADING PREFERENCES</span>'}
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
  d.querySelectorAll('.menuOrderHandle').forEach(x=>x.remove());
  d.body?.classList.remove('runnerMenuReordering');
  d.getElementById('runnerMenuOrderControllerStyle')?.remove();
}
function ensureStyle(d){
  if(d.getElementById(STYLE_ID))return;
  const s=d.createElement('style');
  s.id=STYLE_ID;
  s.textContent=`
    .canonicalMenuPlaceholder{grid-column:1/-1!important;display:grid!important;place-items:center!important;gap:7px!important;min-height:58px!important;opacity:.82;cursor:progress!important;pointer-events:auto!important}
    .canonicalMenuPendingMessage{display:block;color:#748f9c;font-size:8px;font-weight:900;letter-spacing:.10em;line-height:1.35}
    html[data-menu-bootstrap="pending"] body.runnerMenuHome .runnerNavPad .tabs{grid-template-columns:1fr!important}
  `;
  d.head.appendChild(s);
}
function placeholder(d,id){
  const root=tabs(d),def=DEFINITIONS[id];if(!root||!def)return null;
  let p=root.querySelector(`[data-menu-placeholder="${id}"]`);
  if(p)return p;
  p=d.createElement('button');
  p.type='button';
  p.className='btn canonicalMenuPlaceholder';
  p.dataset.menuPlaceholder=id;
  p.dataset.menuId=id;
  p.dataset.menuKey=def.key;
  p.setAttribute('aria-busy','true');
  p.setAttribute('aria-label',`${id} loading`);
  p.innerHTML=def.html;
  p.addEventListener('click',()=>{p.dataset.pendingOpen='1'});
  return p;
}
function markButton(b,id){
  const key=DEFINITIONS[id].key;
  b.dataset.menuId=id;
  b.dataset.menuKey=key;
  delete b.dataset.menuReorderable;
  if(key.startsWith('F'))b.setAttribute('aria-keyshortcuts',key);else b.removeAttribute('aria-keyshortcuts');
}
function setPrimaryBootstrapLabel(b,id){
  if(!b||!['board','market','history','engine'].includes(id))return;
  const html=DEFINITIONS[id].html;
  if(!b.querySelector('.primaryMenuMain')&&html)b.innerHTML=html;
}
function setPreferenceLabel(b){
  if(!b)return;
  const first=b.querySelector('b');
  if(first&&first.textContent!=='[TAB]')first.textContent='[TAB]';
  const textNodes=[];
  const walker=b.ownerDocument.createTreeWalker(b,b.ownerDocument.defaultView?.NodeFilter?.SHOW_TEXT||4);
  let n=null;while((n=walker.nextNode()))textNodes.push(n);
  textNodes.forEach(node=>{if(node.nodeValue?.includes('[F6]'))node.nodeValue=node.nodeValue.replaceAll('[F6]','[TAB]')});
}
function reconcile(d){
  if(!d?.body)return false;
  const root=tabs(d);if(!root)return false;
  removeLegacyUi(d);ensureStyle(d);
  d.documentElement.dataset.menuBootstrap='pending';

  let allLive=true;
  const visible=[];
  for(const id of ORDER){
    const live=button(d,id);
    const pending=root.querySelector(`[data-menu-placeholder="${id}"]`);
    if(live){
      const queued=pending?.dataset?.pendingOpen==='1';
      pending?.remove();
      markButton(live,id);
      setPrimaryBootstrapLabel(live,id);
      if(id==='preferences')setPreferenceLabel(live);
      visible.push(live);
      if(queued)queueMicrotask(()=>live.click());
    }else{
      allLive=false;
      const p=pending||placeholder(d,id);
      if(p)visible.push(p);
    }
  }
  visible.forEach(node=>root.appendChild(node));

  if(allLive){
    d.documentElement.dataset.menuBootstrap='ready';
    d.documentElement.dataset.menuOrderAuthority='canonical-passive';
    if(d.defaultView)d.defaultView.BettingEdgeMenuOrder=window.BettingEdgeMenuOrder;
  }
  return allLive;
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
},60);
})();
