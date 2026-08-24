(()=>{
'use strict';

const STORAGE_KEY='bettingEdge.preferences.mainMenuOrder.v1';
const STYLE_ID='runnerMenuOrderControllerStyle';
const HINT_ID='runnerMenuOrderHint';
const PREF_BOX_ID='runnerMenuOrderPreference';
const HOLD_MS=260;
const MOVE_CANCEL_PX=10;
const AUTO_SCROLL_EDGE=64;
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
const activeAnimations=new WeakMap();

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
  const d=appDoc();if(d)apply(d,true,middle);
  return [...middle];
}
function currentOrder(){return drag?.dragging?drag.draft:middle}
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
function applyVisual(d,order=currentOrder()){
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
  let s=d.getElementById(STYLE_ID);
  if(!s){s=d.createElement('style');s.id=STYLE_ID;d.head.appendChild(s)}
  s.textContent=`
    body.runnerMenuHome .runnerNavPad .tabs>.btn[data-menu-reorderable="true"]{cursor:grab;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;touch-action:none}
    body.runnerMenuHome.runnerMenuReordering .runnerNavPad .tabs>.btn[data-menu-reorderable="true"]{cursor:grabbing}
    body.runnerMenuHome .runnerNavPad .tabs>.btn.menuOrderSource{visibility:hidden!important}
    .menuOrderGhost{position:fixed!important;z-index:2147483000!important;margin:0!important;pointer-events:none!important;touch-action:none!important;will-change:transform,left,top;opacity:.97;transform-origin:center center;outline:2px solid #ffe96b!important;outline-offset:2px!important;box-shadow:0 14px 34px rgba(0,0,0,.46),0 0 22px rgba(255,233,107,.22)!important;filter:brightness(1.06);border-radius:0}
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
  `;
}
function ensureHint(d){
  const root=tabs(d);if(!root)return;
  let hint=d.getElementById(HINT_ID);
  if(!hint){hint=d.createElement('div');hint.id=HINT_ID;hint.textContent='PRESS + HOLD TO REORDER // F1 VIGSCOPE + TAB PREFERENCES LOCKED';root.insertAdjacentElement('afterend',hint)}
}
function preferenceRows(order=middle){
  const ids=['board',...normalizeMiddle(order),'preferences'];
  return ids.map(id=>{
    const locked=id==='board'||id==='preferences';
    return `<div class="menuPrefRow${locked?' locked':''}"><b>[${escapeHtml(keyFor(id,order))}]</b><span>${escapeHtml(DEFINITIONS[id].label)}</span><em>${locked?'LOCKED':'HOLD + DRAG'}</em></div>`;
  }).join('')
}
function renderPreferenceBox(d,order=middle){
  const panel=d.getElementById('runnerSchedulePreferences');if(!panel)return;
  let box=d.getElementById(PREF_BOX_ID);
  if(!box){box=d.createElement('section');box.id=PREF_BOX_ID}
  const anchor=d.getElementById('runnerPreferenceModuleOverview');
  if(anchor){if(anchor.nextElementSibling!==box)anchor.insertAdjacentElement('afterend',box)}else if(box.parentElement!==panel)panel.appendChild(box);
  const normalized=normalizeMiddle(order),key=JSON.stringify(normalized);
  if(box.dataset.key===key&&box.innerHTML)return;
  box.dataset.key=key;
  box.innerHTML=`<div class="menuPrefHead"><b>MAIN MENU ORDER</b><span>THIS ORDER IS SAVED ONLY IN THIS BROWSER / DEVICE. FUNCTION KEYS FOLLOW THE DISPLAYED POSITION.</span></div><div class="menuPrefRows">${preferenceRows(normalized)}</div><button type="button" class="menuPrefReset" data-menu-order-reset>RESET DEFAULT ORDER</button>`;
  box.querySelector('[data-menu-order-reset]')?.addEventListener('click',()=>resetOrder());
}
function apply(d,force=false,order=currentOrder()){
  if(!d?.body)return false;
  ensureStyle(d);ensureHint(d);
  const normalized=applyVisual(d,order);
  if(!drag?.dragging&&(force||JSON.stringify(normalized)!==JSON.stringify(middle)))middle=normalizeMiddle(normalized);
  renderPreferenceBox(d,drag?.dragging?drag.draft:middle);
  d.documentElement.dataset.menuOrderAuthority='2';
  if(d.defaultView)d.defaultView.BettingEdgeMenuOrder=window.BettingEdgeMenuOrder;
  return true;
}
function schedule(d){
  if(scheduled)return;scheduled=true;
  const w=d?.defaultView||window;
  w.requestAnimationFrame(()=>{scheduled=false;apply(d,false,currentOrder())})
}
function clearHold(){if(drag?.timer){clearTimeout(drag.timer);drag.timer=null}}
function cancelNodeAnimation(node){
  const a=activeAnimations.get(node);if(a){try{a.cancel()}catch{}activeAnimations.delete(node)}
}
function animateReflow(d,oldRects){
  for(const id of DEFAULT_MIDDLE){
    const node=button(d,id);if(!node||node===drag?.button)continue;
    const before=oldRects.get(node),after=node.getBoundingClientRect();if(!before||!after)continue;
    const dx=before.left-after.left,dy=before.top-after.top;
    if(Math.abs(dx)<.5&&Math.abs(dy)<.5)continue;
    cancelNodeAnimation(node);
    try{
      const a=node.animate([{transform:`translate3d(${dx}px,${dy}px,0)`},{transform:'translate3d(0,0,0)'}],{duration:175,easing:'cubic-bezier(.2,.8,.2,1)'});
      activeAnimations.set(node,a);a.onfinish=()=>activeAnimations.delete(node);a.oncancel=()=>activeAnimations.delete(node);
    }catch{}
  }
}
function snapshotRects(d){
  const m=new Map();
  for(const id of DEFAULT_MIDDLE){const node=button(d,id);if(node)m.set(node,node.getBoundingClientRect())}
  return m;
}
function copyGhostAppearance(source,ghost){
  const cs=source.ownerDocument.defaultView.getComputedStyle(source);
  const props=['background','backgroundColor','backgroundImage','color','border','borderTop','borderRight','borderBottom','borderLeft','boxShadow','textShadow','font','fontFamily','fontSize','fontWeight','fontStyle','letterSpacing','lineHeight','padding','textAlign','display','placeItems','alignItems','justifyContent','gap'];
  for(const p of props){try{ghost.style[p]=cs[p]}catch{}}
}
function makeGhost(d,b,rect){
  const ghost=b.cloneNode(true);ghost.removeAttribute('id');ghost.classList.add('menuOrderGhost');ghost.classList.remove('active','primaryShellActive','loaded');
  ghost.removeAttribute('aria-pressed');ghost.setAttribute('aria-hidden','true');
  copyGhostAppearance(b,ghost);
  Object.assign(ghost.style,{left:`${rect.left}px`,top:`${rect.top}px`,width:`${rect.width}px`,height:`${rect.height}px`,minHeight:`${rect.height}px`,transform:'translate3d(0,0,0) scale(1.015)'});
  d.body.appendChild(ghost);return ghost;
}
function moveGhost(clientX,clientY){
  if(!drag?.ghost)return;
  const dx=clientX-drag.startX,dy=clientY-drag.startY;
  drag.lastX=clientX;drag.lastY=clientY;
  drag.ghost.style.transform=`translate3d(${dx}px,${dy}px,0) scale(1.015)`;
}
function beginDrag(d){
  if(!drag||drag.dragging||!d.body.classList.contains('runnerMenuHome'))return;
  drag.dragging=true;drag.draft=[...middle];drag.sourceRect=drag.button.getBoundingClientRect();
  drag.ghost=makeGhost(d,drag.button,drag.sourceRect);
  drag.button.classList.add('menuOrderSource');d.body.classList.add('runnerMenuReordering');
  moveGhost(drag.lastX,drag.lastY);
  try{drag.button.setPointerCapture?.(drag.pointerId)}catch{}
  try{navigator.vibrate?.(8)}catch{}
}
function draftForPoint(d,id,y,current){
  const others=current.filter(x=>x!==id);
  let at=others.length;
  for(let i=0;i<others.length;i++){
    const b=button(d,others[i]);if(!b)continue;
    const r=b.getBoundingClientRect();
    if(y<r.top+r.height/2){at=i;break}
  }
  const next=[...others];next.splice(at,0,id);return normalizeMiddle(next)
}
function reorderDraft(d,next){
  next=normalizeMiddle(next);if(!drag||JSON.stringify(next)===JSON.stringify(drag.draft))return;
  const oldRects=snapshotRects(d);drag.draft=next;applyVisual(d,next);animateReflow(d,oldRects);renderPreferenceBox(d,next);
}
function autoScroll(d,y){
  const w=d.defaultView;if(!w)return;
  const h=w.innerHeight||d.documentElement.clientHeight||0;
  let delta=0;
  if(y<AUTO_SCROLL_EDGE)delta=-Math.ceil((AUTO_SCROLL_EDGE-y)/7);
  else if(y>h-AUTO_SCROLL_EDGE)delta=Math.ceil((y-(h-AUTO_SCROLL_EDGE))/7);
  if(delta){try{w.scrollBy({top:delta,left:0,behavior:'auto'})}catch{try{w.scrollBy(0,delta)}catch{}}}
}
function finishGhost(d,showSource=true){
  if(!drag?.ghost){if(showSource&&drag?.button)drag.button.classList.remove('menuOrderSource');return}
  const ghost=drag.ghost,source=drag.button,target=source?.getBoundingClientRect(),current=ghost.getBoundingClientRect();
  if(!target||!current){ghost.remove();if(showSource)source?.classList.remove('menuOrderSource');return}
  ghost.style.transform='none';ghost.style.left=`${current.left}px`;ghost.style.top=`${current.top}px`;
  try{
    const a=ghost.animate([
      {left:`${current.left}px`,top:`${current.top}px`,width:`${current.width}px`,height:`${current.height}px`,opacity:.97,transform:'scale(1.015)'},
      {left:`${target.left}px`,top:`${target.top}px`,width:`${target.width}px`,height:`${target.height}px`,opacity:.88,transform:'scale(1)'}
    ],{duration:125,easing:'cubic-bezier(.2,.8,.2,1)',fill:'forwards'});
    a.onfinish=()=>{ghost.remove();if(showSource)source?.classList.remove('menuOrderSource')};
    a.oncancel=()=>{ghost.remove();if(showSource)source?.classList.remove('menuOrderSource')};
  }catch{ghost.remove();if(showSource)source?.classList.remove('menuOrderSource')}
}
function cleanupDrag(d,showSource=true){
  clearHold();
  if(drag?.button){try{drag.button.releasePointerCapture?.(drag.pointerId)}catch{}}
  if(drag?.dragging)finishGhost(d,showSource);else drag?.button?.classList.remove('menuOrderSource');
  d.body.classList.remove('runnerMenuReordering');
  drag=null;
}
function bindPointer(d){
  if(d.documentElement.dataset.menuOrderPointerBound==='2')return;
  d.documentElement.dataset.menuOrderPointerBound='2';
  d.addEventListener('contextmenu',e=>{if(e.target.closest?.('.runnerNavPad .tabs>.btn[data-menu-reorderable="true"]'))e.preventDefault()},true);
  d.addEventListener('selectstart',e=>{if(drag?.dragging)e.preventDefault()},true);
  d.addEventListener('pointerdown',e=>{
    if(!d.body.classList.contains('runnerMenuHome'))return;
    if(e.pointerType==='mouse'&&e.button!==0)return;
    const b=e.target.closest?.('.runnerNavPad .tabs>.btn[data-menu-id]');
    const id=b?.dataset?.menuId;if(!b||!DEFAULT_MIDDLE.includes(id))return;
    clearHold();drag={id,button:b,pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,lastX:e.clientX,lastY:e.clientY,dragging:false,draft:[...middle],timer:null,ghost:null};
    drag.timer=setTimeout(()=>beginDrag(d),HOLD_MS);
  },true);
  d.addEventListener('pointermove',e=>{
    if(!drag||e.pointerId!==drag.pointerId)return;
    drag.lastX=e.clientX;drag.lastY=e.clientY;
    if(!drag.dragging){
      if(Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>MOVE_CANCEL_PX)cleanupDrag(d,true);
      return;
    }
    e.preventDefault();e.stopPropagation();
    moveGhost(e.clientX,e.clientY);autoScroll(d,e.clientY);
    reorderDraft(d,draftForPoint(d,drag.id,e.clientY,drag.draft));
  },{capture:true,passive:false});
  const finish=e=>{
    if(!drag||e.pointerId!==drag.pointerId)return;
    const wasDragging=drag.dragging,source=drag.button,next=drag.draft;
    if(wasDragging){e.preventDefault();e.stopPropagation();saveMiddle(next);suppressButton=source;suppressClickUntil=Date.now()+650}
    cleanupDrag(d,true);apply(d,true,middle);
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
  const w=d.defaultView;if(!w||w.__bettingEdgeMenuOrderKeysV2)return;
  w.__bettingEdgeMenuOrderKeysV2=true;
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
  bindPointer(d);bindKeys(d);apply(d,false,currentOrder());return true;
}

window.BettingEdgeMenuOrder={
  getOrder:()=>['board',...middle,'preferences'],
  getFunctionMap:()=>Object.fromEntries(['board',...middle].map((id,i)=>[`F${i+1}`,id])),
  keyFor:id=>keyFor(id),
  reset:resetOrder,
  refresh:()=>{const d=appDoc();return d?apply(d,true,middle):false}
};

let tries=0;attach();
const timer=setInterval(()=>{tries++;if(attach()||tries>300)clearInterval(timer)},25);
setInterval(()=>{const d=appDoc();if(d)apply(d,false,currentOrder())},500);
})();
