(()=>{
'use strict';

const STORAGE_KEY='bettingEdge.preferences.mainMenuOrder.v1';
const STYLE_ID='runnerMenuOrderControllerStyle';
const HINT_ID='runnerMenuOrderHint';
const PREF_BOX_ID='runnerMenuOrderPreference';
const HOLD_MS=300;
const MOVE_CANCEL_PX=10;
const FLIP_MS=165;
const DROP_MS=180;
const DEFAULT_MIDDLE=['market','history','syndicate','pizza','crypto','meat','engine'];
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

let middle=readMiddle();
let lastDoc=null;
let observer=null;
let scheduled=false;
let drag=null;
let suppressClickUntil=0;
let suppressButton=null;

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
function normalizeMiddle(value){
  const src=Array.isArray(value)?value:[];
  const out=[];
  for(const id of src){if(DEFAULT_MIDDLE.includes(id)&&!out.includes(id))out.push(id)}
  for(const id of DEFAULT_MIDDLE){if(!out.includes(id))out.push(id)}
  return out;
}
function readMiddle(){
  try{return normalizeMiddle(JSON.parse(localStorage.getItem(STORAGE_KEY)||'null'))}catch{return [...DEFAULT_MIDDLE]}
}
function saveMiddle(value){
  middle=normalizeMiddle(value);
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(middle))}catch{}
  return middle;
}
function resetOrder(){
  middle=[...DEFAULT_MIDDLE];
  try{localStorage.removeItem(STORAGE_KEY)}catch{}
  const d=appDoc();if(d)apply(d,true);
  return [...middle];
}
function keyFor(id,order=middle){
  if(id==='preferences')return 'TAB';
  const idx=['board',...normalizeMiddle(order)].indexOf(id);
  return idx>=0?`F${idx+1}`:'';
}
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function patchButtonKey(b,key,id){
  if(!b||!key)return;
  b.dataset.menuId=id;
  b.dataset.menuKey=key;
  b.dataset.menuReorderable=String(DEFAULT_MIDDLE.includes(id));
  if(key.startsWith('F'))b.setAttribute('aria-keyshortcuts',key);else b.removeAttribute('aria-keyshortcuts');
  const next=b.innerHTML.replace(/\[(?:F(?:[1-9]|1[0-2])|TAB)\]/g,`[${key}]`);
  if(next!==b.innerHTML)b.innerHTML=next;
}
function applyVisual(d,order=middle){
  const normalized=normalizeMiddle(order);
  const board=button(d,'board'),prefs=button(d,'preferences');
  if(board){board.style.order='0';patchButtonKey(board,'F1','board')}
  normalized.forEach((id,index)=>{
    const b=button(d,id);if(!b)return;
    b.style.order=String(index+1);
    patchButtonKey(b,`F${index+2}`,id);
  });
  if(prefs){prefs.style.order='999';patchButtonKey(prefs,'TAB','preferences')}
  return normalized;
}
function ensureStyle(d){
  if(d.getElementById(STYLE_ID))return;
  const s=d.createElement('style');s.id=STYLE_ID;s.textContent=`
    body.runnerMenuHome .runnerNavPad .tabs>.btn[data-menu-reorderable="true"]{cursor:grab;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;touch-action:none;will-change:transform}
    body.runnerMenuHome.runnerMenuReordering .runnerNavPad .tabs>.btn[data-menu-reorderable="true"]{cursor:grabbing}
    body.runnerMenuHome .runnerNavPad .tabs>.btn.menuOrderDragging{position:relative;z-index:12;opacity:.94;outline:2px solid #ffe96b;outline-offset:2px;box-shadow:0 12px 26px rgba(0,0,0,.42),0 0 20px rgba(255,233,107,.24)!important;transition:none!important}
    body.runnerMenuHome.runnerMenuReordering .runnerNavPad .tabs>.btn[data-menu-reorderable="true"]:not(.menuOrderDragging){pointer-events:none}
    #${HINT_ID}{display:none;margin-top:8px;padding:7px 9px;border:1px dashed #31566d;background:#020a10;color:#7f9aa8;text-align:center;font-size:8px;font-weight:900;letter-spacing:.09em;line-height:1.45}
    body.runnerMenuHome #${HINT_ID}{display:block}
    #${PREF_BOX_ID}{margin:11px 0;border:1px solid #31566d;background:linear-gradient(180deg,#020b12,#01070b);padding:11px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
    #${PREF_BOX_ID} .menuPrefHead{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap;margin-bottom:8px}
    #${PREF_BOX_ID} .menuPrefHead b{color:#9feaff;font-size:12px;letter-spacing:.08em}
    #${PREF_BOX_ID} .menuPrefHead span{color:#7f99a5;font-size:9px;line-height:1.45;text-align:right}
    #${PREF_BOX_ID} .menuPrefRows{display:grid;gap:5px}
    #${PREF_BOX_ID} .menuPrefRow{display:grid;grid-template-columns:52px minmax(0,1fr) auto;gap:8px;align-items:center;border:1px solid #203b49;background:#02070b;padding:7px 8px}
    #${PREF_BOX_ID} .menuPrefRow b{color:#7fe4ff;font-size:10px}
    #${PREF_BOX_ID} .menuPrefRow span{color:#c9dce6;font-size:10px;font-weight:900;letter-spacing:.04em}
    #${PREF_BOX_ID} .menuPrefRow em{font-style:normal;color:#718c9a;font-size:8px;font-weight:900;letter-spacing:.06em}
    #${PREF_BOX_ID} .menuPrefRow.locked{border-color:#526a42}.menuPrefRow.locked b,.menuPrefRow.locked em{color:#d8f78c!important}
    #${PREF_BOX_ID} .menuPrefReset{width:100%;margin-top:8px;border:1px solid #5a7483;background:#04111a;color:#b9dfff;padding:9px;font:900 10px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.07em;cursor:pointer}
    #${PREF_BOX_ID} .menuPrefReset:hover,#${PREF_BOX_ID} .menuPrefReset:focus{border-color:#64d7ff;color:#e7f8ff;background:#071923}
    @media(max-width:560px){#${PREF_BOX_ID} .menuPrefHead span{text-align:left}#${PREF_BOX_ID} .menuPrefRow{grid-template-columns:46px minmax(0,1fr) auto}}
  `;d.head.appendChild(s)
}
function ensureHint(d){
  const root=tabs(d),nav=root?.parentElement;if(!root||!nav)return;
  let hint=d.getElementById(HINT_ID);
  if(!hint){hint=d.createElement('div');hint.id=HINT_ID;hint.textContent='PRESS + HOLD TO REORDER // F1 VIGSCOPE + TAB PREFERENCES LOCKED';root.insertAdjacentElement('afterend',hint)}
}
function preferenceRows(){
  const ids=['board',...middle,'preferences'];
  return ids.map(id=>{
    const locked=id==='board'||id==='preferences';
    return `<div class="menuPrefRow${locked?' locked':''}"><b>[${escapeHtml(keyFor(id))}]</b><span>${escapeHtml(DEFINITIONS[id].label)}</span><em>${locked?'LOCKED':'HOLD + DRAG'}</em></div>`;
  }).join('')
}
function renderPreferenceBox(d){
  const panel=d.getElementById('runnerSchedulePreferences');if(!panel)return;
  let box=d.getElementById(PREF_BOX_ID);
  if(!box){box=d.createElement('section');box.id=PREF_BOX_ID}
  const anchor=d.getElementById('runnerPreferenceModuleOverview');
  if(anchor){if(anchor.nextElementSibling!==box)anchor.insertAdjacentElement('afterend',box)}else if(box.parentElement!==panel)panel.appendChild(box);
  const key=JSON.stringify(middle);
  if(box.dataset.key===key&&box.innerHTML)return;
  box.dataset.key=key;
  box.innerHTML=`<div class="menuPrefHead"><b>MAIN MENU ORDER</b><span>THIS ORDER IS SAVED ONLY IN THIS BROWSER / DEVICE. FUNCTION KEYS FOLLOW THE DISPLAYED POSITION.</span></div><div class="menuPrefRows">${preferenceRows()}</div><button type="button" class="menuPrefReset" data-menu-order-reset>RESET DEFAULT ORDER</button>`;
  box.querySelector('[data-menu-order-reset]')?.addEventListener('click',()=>resetOrder());
}
function apply(d,force=false,order=middle){
  if(!d?.body)return false;
  ensureStyle(d);ensureHint(d);
  const normalized=applyVisual(d,order);
  if(force||JSON.stringify(normalized)!==JSON.stringify(middle))middle=normalizeMiddle(normalized);
  renderPreferenceBox(d);
  d.documentElement.dataset.menuOrderAuthority='1';
  if(d.defaultView)d.defaultView.BettingEdgeMenuOrder=window.BettingEdgeMenuOrder;
  return true;
}
function schedule(d){
  if(scheduled)return;scheduled=true;
  const w=d?.defaultView||window;
  w.requestAnimationFrame(()=>{scheduled=false;apply(d)})
}
function clearHold(){if(drag?.timer){clearTimeout(drag.timer);drag.timer=null}}
function cleanupDrag(d){
  clearHold();
  if(drag?.button){
    drag.button.classList.remove('menuOrderDragging');
    drag.button.style.transform='';
    drag.button.style.transition='';
    try{drag.button.releasePointerCapture?.(drag.pointerId)}catch{}
  }
  d.body.classList.remove('runnerMenuReordering');
  drag=null;
}
function baseRect(b){
  const transform=b.style.transform,transition=b.style.transition;
  b.style.transition='none';b.style.transform='none';
  const r=b.getBoundingClientRect();
  b.style.transform=transform;b.style.transition=transition;
  return r;
}
function positionDragged(y){
  if(!drag?.dragging||!drag.button)return;
  const r=baseRect(drag.button);
  const dy=y-drag.pointerOffsetY-r.top;
  drag.translateY=dy;
  drag.button.style.transform=`translate3d(0,${dy.toFixed(2)}px,0) scale(1.012)`;
}
function beginDrag(d){
  if(!drag||drag.dragging||!d.body.classList.contains('runnerMenuHome'))return;
  const r=drag.button.getBoundingClientRect();
  drag.dragging=true;drag.draft=[...middle];drag.pointerOffsetY=drag.currentY-r.top;drag.translateY=0;
  drag.button.classList.add('menuOrderDragging');d.body.classList.add('runnerMenuReordering');
  try{drag.button.setPointerCapture?.(drag.pointerId)}catch{}
  positionDragged(drag.currentY);
}
function draftForY(d,id,y,current){
  const others=current.filter(x=>x!==id);
  let at=others.length;
  for(let i=0;i<others.length;i++){
    const b=button(d,others[i]);if(!b)continue;
    const r=b.getBoundingClientRect();
    if(y<r.top+r.height/2){at=i;break}
  }
  const next=[...others];next.splice(at,0,id);return normalizeMiddle(next)
}
function animateOrderChange(d,next){
  const first=new Map();
  DEFAULT_MIDDLE.forEach(id=>{
    if(id===drag?.id)return;
    const b=button(d,id);if(b)first.set(id,b.getBoundingClientRect().top);
  });
  applyVisual(d,next);
  DEFAULT_MIDDLE.forEach(id=>{
    if(id===drag?.id)return;
    const b=button(d,id),top=first.get(id);if(!b||top===undefined)return;
    const dy=top-b.getBoundingClientRect().top;if(Math.abs(dy)<.5)return;
    try{b.__menuOrderFlip?.cancel?.()}catch{}
    if(typeof b.animate!=='function')return;
    const animation=b.animate([
      {transform:`translate3d(0,${dy.toFixed(2)}px,0)`},
      {transform:'translate3d(0,0,0)'}
    ],{duration:FLIP_MS,easing:'cubic-bezier(.22,.8,.25,1)'});
    b.__menuOrderFlip=animation;
    const clear=()=>{if(b.__menuOrderFlip===animation)b.__menuOrderFlip=null};
    animation.onfinish=clear;animation.oncancel=clear;
  });
}
function autoScroll(d,y){
  const w=d.defaultView;if(!w)return;
  const h=w.innerHeight||0;if(!h)return;
  const edge=Math.min(90,h*.16);let delta=0;
  if(y<edge)delta=-Math.min(14,Math.max(2,(edge-y)/5));
  else if(y>h-edge)delta=Math.min(14,Math.max(2,(y-(h-edge))/5));
  if(delta){try{w.scrollBy({top:delta,left:0,behavior:'auto'})}catch{try{w.scrollBy(0,delta)}catch{}}}
}
function animateDrop(source,visualTop){
  if(!source||!Number.isFinite(visualTop)||typeof source.animate!=='function')return;
  const targetTop=source.getBoundingClientRect().top,dy=visualTop-targetTop;
  source.animate([
    {transform:`translate3d(0,${dy.toFixed(2)}px,0) scale(1.012)`},
    {transform:'translate3d(0,0,0) scale(1)'}
  ],{duration:DROP_MS,easing:'cubic-bezier(.22,.8,.25,1)'});
}
function bindPointer(d){
  if(d.documentElement.dataset.menuOrderPointerBound==='2')return;
  d.documentElement.dataset.menuOrderPointerBound='2';
  d.addEventListener('contextmenu',e=>{
    const b=e.target.closest?.('.runnerNavPad .tabs>.btn[data-menu-id]');
    if(b&&DEFAULT_MIDDLE.includes(b.dataset.menuId))e.preventDefault();
  },true);
  d.addEventListener('pointerdown',e=>{
    if(!d.body.classList.contains('runnerMenuHome'))return;
    if(e.isPrimary===false)return;
    if(e.pointerType==='mouse'&&e.button!==0)return;
    const b=e.target.closest?.('.runnerNavPad .tabs>.btn[data-menu-id]');
    const id=b?.dataset?.menuId;if(!b||!DEFAULT_MIDDLE.includes(id))return;
    clearHold();
    drag={id,button:b,pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,currentX:e.clientX,currentY:e.clientY,dragging:false,draft:[...middle],pointerOffsetY:0,translateY:0,timer:null};
    drag.timer=setTimeout(()=>beginDrag(d),HOLD_MS);
  },true);
  d.addEventListener('pointermove',e=>{
    if(!drag||e.pointerId!==drag.pointerId)return;
    drag.currentX=e.clientX;drag.currentY=e.clientY;
    if(!drag.dragging){
      if(Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>MOVE_CANCEL_PX)cleanupDrag(d);
      return;
    }
    e.preventDefault();
    autoScroll(d,e.clientY);
    const next=draftForY(d,drag.id,e.clientY,drag.draft);
    if(JSON.stringify(next)!==JSON.stringify(drag.draft)){
      drag.draft=next;
      animateOrderChange(d,next);
    }
    positionDragged(e.clientY);
  },{capture:true,passive:false});
  const finish=e=>{
    if(!drag||e.pointerId!==drag.pointerId)return;
    const wasDragging=drag.dragging,source=drag.button,next=drag.draft;
    const visualTop=wasDragging?source.getBoundingClientRect().top:NaN;
    if(wasDragging){e.preventDefault();saveMiddle(next);suppressButton=source;suppressClickUntil=Date.now()+550}
    cleanupDrag(d);apply(d,true);
    if(wasDragging)animateDrop(source,visualTop);
  };
  d.addEventListener('pointerup',finish,true);
  d.addEventListener('pointercancel',finish,true);
  d.addEventListener('click',e=>{
    if(Date.now()>suppressClickUntil)return;
    const b=e.target.closest?.('.runnerNavPad .tabs>.btn');
    if(b&&b===suppressButton){e.preventDefault();e.stopImmediatePropagation()}
  },true);
}
function bindKeys(d){
  const w=d.defaultView;if(!w||w.__bettingEdgeMenuOrderKeysV1)return;
  w.__bettingEdgeMenuOrderKeysV1=true;
  w.addEventListener('keydown',e=>{
    const target=e.target;if(target?.closest?.('input,select,textarea,[contenteditable="true"]'))return;
    const m=/^F([1-8])$/.exec(e.key);if(!m)return;
    const id=['board',...middle][Number(m[1])-1],b=id?button(d,id):null;if(!b)return;
    e.preventDefault();e.stopImmediatePropagation();b.click();
  },true);
}
function attach(){
  const d=appDoc();if(!d?.body)return false;
  if(d!==lastDoc){
    lastDoc=d;
    if(observer)observer.disconnect();
    bindPointer(d);bindKeys(d);
    observer=new MutationObserver(()=>schedule(d));
    observer.observe(d.body,{subtree:true,childList:true,characterData:true});
  }
  bindKeys(d);apply(d);return true;
}

window.BettingEdgeMenuOrder={
  getOrder:()=>['board',...middle,'preferences'],
  getFunctionMap:()=>Object.fromEntries(['board',...middle].map((id,i)=>[`F${i+1}`,id])),
  keyFor:id=>keyFor(id),
  reset:resetOrder,
  refresh:()=>{const d=appDoc();return d?apply(d,true):false}
};

let tries=0;attach();
const timer=setInterval(()=>{tries++;if(attach()||tries>300)clearInterval(timer)},25);
setInterval(()=>{const d=appDoc();if(d)apply(d)},500);
})();