(()=>{
'use strict';

// Fixed-menu compatibility shim.
// The reorder feature is retired. Module owners keep their own click/state
// handlers and keyboard shortcuts; this file only performs one startup
// reconciliation after every menu button exists, then stops permanently.

const LEGACY_STORAGE_KEY='bettingEdge.preferences.mainMenuOrder.v1';
const HINT_ID='runnerMenuOrderHint';
const PREF_BOX_ID='runnerMenuOrderPreference';
const ORDER=['board','market','history','syndicate','pizza','crypto','meat','engine','preferences'];
const DEFINITIONS={
  board:{selector:'.btn[data-view="board"]',key:'F1'},
  market:{selector:'.btn[data-view="market"]',key:'F2'},
  history:{selector:'.btn[data-view="history"]',key:'F3'},
  syndicate:{selector:'#runnerSyndicateF5',key:'F4'},
  pizza:{selector:'#runnerPizzaF6',key:'F5'},
  crypto:{selector:'#runnerCryptoF7',key:'F6'},
  meat:{selector:'#runnerSeasonPreviewF6',key:'F7'},
  engine:{selector:'.btn[data-view="engine"]',key:'F8'},
  preferences:{selector:'#runnerPreferencesF6',key:'TAB'}
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
  const oldStyle=d.getElementById('runnerMenuOrderControllerStyle');
  if(oldStyle)oldStyle.remove();
}
function setPreferenceLabel(b){
  if(!b)return;
  const desired='<b>[TAB]</b>&nbsp; ⚙ PREFERENCES';
  if(b.innerHTML!==desired)b.innerHTML=desired;
}
function applyOnce(d){
  if(!d?.body)return false;
  const root=tabs(d);if(!root)return false;
  const buttons=ORDER.map(id=>button(d,id));
  if(buttons.some(x=>!x))return false;

  removeLegacyUi(d);

  // One canonical DOM order. This is the same order already used by the
  // module-local navigation code, so no recurring DOM contest is created.
  buttons.forEach(b=>root.appendChild(b));

  buttons.forEach((b,index)=>{
    const id=ORDER[index],key=DEFINITIONS[id].key;
    b.dataset.menuId=id;
    b.dataset.menuKey=key;
    delete b.dataset.menuReorderable;
    if(key.startsWith('F'))b.setAttribute('aria-keyshortcuts',key);
    else b.removeAttribute('aria-keyshortcuts');
  });
  setPreferenceLabel(button(d,'preferences'));

  d.documentElement.dataset.menuOrderAuthority='fixed-passive';
  if(d.defaultView)d.defaultView.BettingEdgeMenuOrder=window.BettingEdgeMenuOrder;
  return true;
}

window.BettingEdgeMenuOrder={
  getOrder:()=>[...ORDER],
  getFunctionMap:()=>Object.fromEntries(ORDER.slice(0,8).map((id,i)=>[`F${i+1}`,id])),
  keyFor:id=>DEFINITIONS[id]?.key||'',
  reset:()=>{const d=appDoc();return d?applyOnce(d):false},
  refresh:()=>{const d=appDoc();return d?applyOnce(d):false}
};

let tries=0;
const timer=setInterval(()=>{
  tries++;
  const d=appDoc();
  if((d&&applyOnce(d))||tries>=150)clearInterval(timer);
},100);
})();
