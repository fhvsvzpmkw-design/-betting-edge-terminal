(()=>{
'use strict';

const LEGACY_STORAGE_KEY='bettingEdge.preferences.mainMenuOrder.v1';
const STYLE_ID='runnerMenuOrderControllerStyle';
const HINT_ID='runnerMenuOrderHint';
const PREF_BOX_ID='runnerMenuOrderPreference';
const MIDDLE=['market','history','syndicate','pizza','crypto','meat','engine'];
const ORDER=['board',...MIDDLE,'preferences'];
const WORKSPACE_CLASSES=['runnerSyndicateLoaded','runnerPizzaLoaded','runnerCryptoLoaded','runnerSeasonPreviewsLoaded','runnerPreferencesLoaded'];
const HTML_SHIELD_IDS=new Set(['pizza','crypto']);
const DEFINITIONS={
  board:{label:'VIGSCOPE',selector:'.btn[data-view="board"]'},
  market:{label:'MARKET',selector:'.btn[data-view="market"]'},
  history:{label:'BET HISTORY',selector:'.btn[data-view="history"]'},
  syndicate:{label:'SYNDICATE',selector:'#runnerSyndicateF5'},
  pizza:{label:'PIZZA PLAYS',selector:'#runnerPizzaF6'},
  crypto:{label:'CRYPTO SPECIALS',selector:'#runnerCryptoF7'},
  meat:{label:'MEAT DESK',selector:'#runnerSeasonPreviewF6'},
  engine:{label:'RESULTS',selector:'.btn[data-view="engine"]'},
  preferences:{label:'PREFERENCES',selector:'#runnerPreferencesF6'}
};

let lastDoc=null;
let observer=null;
let scheduled=false;

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
  if(!root||!def)return null;
  return root.querySelector(def.selector)||null;
}
function keyFor(id){
  if(id==='preferences')return 'TAB';
  const idx=ORDER.indexOf(id);
  return idx>=0&&idx<ORDER.length-1?`F${idx+1}`:'';
}
function shieldCanonicalHtml(b,id){
  if(!HTML_SHIELD_IDS.has(id)||b?.dataset?.menuHtmlShield==='1')return;
  try{
    const win=b.ownerDocument?.defaultView;
    const proto=win?.Element?.prototype;
    const desc=proto&&Object.getOwnPropertyDescriptor(proto,'innerHTML');
    if(!desc?.get||!desc?.set)return;
    let canonical=desc.get.call(b);
    Object.defineProperty(b,'innerHTML',{
      configurable:true,
      enumerable:false,
      get(){return canonical},
      set(value){canonical=String(value);desc.set.call(this,canonical)}
    });
    b.dataset.menuHtmlShield='1';
  }catch{}
}
function patchButtonKey(b,key,id){
  if(!b||!key)return;
  shieldCanonicalHtml(b,id);
  b.dataset.menuId=id;
  b.dataset.menuKey=key;
  delete b.dataset.menuReorderable;
  b.querySelectorAll?.('.menuOrderHandle').forEach(x=>x.remove());
  if(key.startsWith('F'))b.setAttribute('aria-keyshortcuts',key);else b.removeAttribute('aria-keyshortcuts');
  const showText=b.ownerDocument?.defaultView?.NodeFilter?.SHOW_TEXT||4;
  const walker=b.ownerDocument.createTreeWalker(b,showText);
  const rx=/\[(?:F(?:[1-9]|1[0-2])|TAB)\]/g;
  let node=null;
  while((node=walker.nextNode())){
    const value=node.nodeValue||'';
    const next=value.replace(rx,`[${key}]`);
    if(next!==value)node.nodeValue=next;
  }
}
function workspaceSafety(d){
  const syndicate=d.getElementById('runnerSyndicateF5');
  const connecting=syndicate?.dataset?.state==='connecting';
  d.body.classList.toggle('runnerSyndicateConnecting',Boolean(connecting));
  const active=connecting?'runnerSyndicateConnecting':WORKSPACE_CLASSES.find(c=>d.body.classList.contains(c));
  if(!active)return;
  d.body.classList.remove('runnerMenuHome','runnerPrimaryViewLoaded','runnerMenuReordering');
  delete d.body.dataset.primaryView;
  d.querySelectorAll('.primaryShellActive').forEach(x=>x.classList.remove('primaryShellActive'));
  const id=(active==='runnerSyndicateConnecting'||active==='runnerSyndicateLoaded')?'runnerSyndicateF5':active==='runnerPizzaLoaded'?'runnerPizzaF6':active==='runnerCryptoLoaded'?'runnerCryptoF7':active==='runnerSeasonPreviewsLoaded'?'runnerSeasonPreviewF6':'runnerPreferencesF6';
  const b=d.getElementById(id);
  if(b){b.style.setProperty('display','grid','important');b.style.setProperty('visibility','visible','important')}
}
function clearWorkspaceSafetyStyles(d){
  if(d.body.classList.contains('runnerSyndicateConnecting')||WORKSPACE_CLASSES.some(c=>d.body.classList.contains(c)))return;
  ['runnerSyndicateF5','runnerPizzaF6','runnerCryptoF7','runnerSeasonPreviewF6','runnerPreferencesF6'].forEach(id=>{
    const b=d.getElementById(id);if(!b)return;
    b.style.removeProperty('display');b.style.removeProperty('visibility');
  });
}
function applyVisual(d){
  const board=button(d,'board'),prefs=button(d,'preferences');
  if(board){board.style.order='0';patchButtonKey(board,'F1','board')}
  MIDDLE.forEach((id,index)=>{
    const b=button(d,id);if(!b)return;
    b.style.order=String(index+1);
    patchButtonKey(b,`F${index+2}`,id);
  });
  if(prefs){prefs.style.order='999';patchButtonKey(prefs,'TAB','preferences')}
}
function ensureStyle(d){
  let s=d.getElementById(STYLE_ID);
  if(!s){s=d.createElement('style');s.id=STYLE_ID;d.head.appendChild(s)}
  s.textContent=`
    body.runnerSyndicateConnecting main.term>header.top{display:flex!important;position:sticky!important;top:0!important;z-index:120!important;background:#030811!important;box-shadow:0 8px 18px rgba(0,0,0,.42)!important}
    body.runnerSyndicateConnecting .runnerNavPad{padding-top:8px!important;padding-bottom:0!important;margin-top:0!important}
    body.runnerSyndicateConnecting .runnerNavPad .tabs{grid-template-columns:1fr!important}
    body.runnerSyndicateConnecting .runnerNavPad .tabs>.btn:not(#runnerSyndicateF5){display:none!important}
    body.runnerSyndicateConnecting .runnerNavPad .tabs>#runnerSyndicateF5,
    body.runnerSyndicateLoaded .runnerNavPad .tabs>#runnerSyndicateF5,
    body.runnerPizzaLoaded .runnerNavPad .tabs>#runnerPizzaF6,
    body.runnerCryptoLoaded .runnerNavPad .tabs>#runnerCryptoF7,
    body.runnerSeasonPreviewsLoaded .runnerNavPad .tabs>#runnerSeasonPreviewF6,
    body.runnerPreferencesLoaded .runnerNavPad .tabs>#runnerPreferencesF6{display:grid!important;visibility:visible!important;grid-column:1/-1!important}
    body.runnerSyndicateConnecting .runnerNavPad~*{display:none!important}
  `;
}
function removeLegacyReorderUi(d){
  d.getElementById(HINT_ID)?.remove();
  d.getElementById(PREF_BOX_ID)?.remove();
  d.querySelectorAll('.menuOrderHandle').forEach(x=>x.remove());
  d.body.classList.remove('runnerMenuReordering');
}
function apply(d){
  if(!d?.body)return false;
  ensureStyle(d);
  removeLegacyReorderUi(d);
  workspaceSafety(d);
  clearWorkspaceSafetyStyles(d);
  applyVisual(d);
  d.documentElement.dataset.menuOrderAuthority='1-static';
  if(d.defaultView)d.defaultView.BettingEdgeMenuOrder=window.BettingEdgeMenuOrder;
  return true;
}
function schedule(d){
  if(scheduled)return;scheduled=true;
  const w=d?.defaultView||window;
  w.requestAnimationFrame(()=>{scheduled=false;apply(d)})
}
function reconcileMutation(d){
  if(!d?.body)return;
  workspaceSafety(d);
  clearWorkspaceSafetyStyles(d);
  applyVisual(d);
  schedule(d);
}
function bindKeys(d){
  const w=d.defaultView;if(!w||w.__bettingEdgeMenuOrderKeysV1)return;
  w.__bettingEdgeMenuOrderKeysV1=true;
  w.addEventListener('keydown',e=>{
    const target=e.target;if(target?.closest?.('input,select,textarea,[contenteditable="true"]'))return;
    const m=/^F([1-8])$/.exec(e.key);if(!m)return;
    const id=ORDER[Number(m[1])-1],b=id?button(d,id):null;if(!b)return;
    e.preventDefault();e.stopImmediatePropagation();b.click();
  },true);
}
function attach(){
  const d=appDoc();if(!d?.body)return false;
  if(d!==lastDoc){
    lastDoc=d;
    if(observer)observer.disconnect();
    bindKeys(d);
    observer=new MutationObserver(()=>reconcileMutation(d));
    observer.observe(d.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','data-state']});
  }
  bindKeys(d);apply(d);return true;
}

window.BettingEdgeMenuOrder={
  getOrder:()=>[...ORDER],
  getFunctionMap:()=>Object.fromEntries(ORDER.slice(0,-1).map((id,i)=>[`F${i+1}`,id])),
  keyFor,
  reset:()=>{const d=appDoc();return d?apply(d):false},
  refresh:()=>{const d=appDoc();return d?apply(d):false}
};

let tries=0;attach();
const timer=setInterval(()=>{tries++;if(attach()||tries>300)clearInterval(timer)},25);
setInterval(()=>{const d=appDoc();if(d)apply(d)},1000);
})();
