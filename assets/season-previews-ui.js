(()=>{
'use strict';

const MANIFEST_URL='./research/season-previews/manifest.json';
const SOURCE_FOLDER='research/season-previews/source-pdfs/';
const BUTTON_ID='runnerSeasonPreviewF6';
const PREF_BUTTON_ID='runnerPreferencesF6';
const PANEL_ID='runnerSeasonPreviewsWorkspace';
const STYLE_ID='runnerSeasonPreviewsUiStyle';
let manifest=null,lastDoc=null,observer=null,manifestRequested=false;

function appDoc(){
  try{
    const core=document.getElementById('core');
    const app=core?.contentDocument?.getElementById('app');
    return app?.contentDocument||null;
  }catch{return null}
}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function cardStyle(){
  let v='normal';
  try{v=localStorage.getItem('bettingEdge.preferences.cardView')||'normal'}catch{}
  return ({normal:'NORMAL',excited:'EXCITED',neon:'NEON',vigscope:'VIG SCOPE'})[v]||String(v).toUpperCase();
}
function ensureStyle(d){
  if(d.getElementById(STYLE_ID))return;
  const s=d.createElement('style');
  s.id=STYLE_ID;
  s.textContent=`
    #${BUTTON_ID}{grid-column:1/-1!important;display:grid!important;place-items:center!important;gap:7px!important;padding-top:10px!important;padding-bottom:10px!important;border-color:#9b5b50!important;color:#ffd0bb!important;background:#0a0505!important;box-shadow:inset 0 0 0 1px rgba(255,160,130,.05),0 0 10px rgba(175,72,52,.08)!important;text-shadow:0 0 6px rgba(255,166,132,.16)!important}
    #${BUTTON_ID} .f6Main{display:block;font-size:inherit}.f6Message{display:block;color:#c88f80;font-size:8px;font-weight:900;letter-spacing:.11em;line-height:1.35}
    #${BUTTON_ID}.active,#${BUTTON_ID}:hover{border-color:#e38a75!important;color:#ffe3d6!important;background:#120706!important;box-shadow:inset 0 0 0 1px rgba(255,190,165,.10),0 0 14px rgba(210,100,75,.14)!important}
    #${PREF_BUTTON_ID}{grid-column:1/-1!important;display:grid!important;place-items:center!important;gap:7px!important;padding-top:10px!important;padding-bottom:10px!important}
    #${PREF_BUTTON_ID} .prefMain{display:block;font-size:inherit}.prefMessage{display:block;color:#83a6b7;font-size:8px;font-weight:900;letter-spacing:.11em;line-height:1.35}
    #${PANEL_ID}{display:none;margin:0 12px 14px;padding:12px;border:1px solid #5f4039;background:linear-gradient(180deg,#090504,#030303);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#d8e8ee}
    body.runnerSeasonPreviewsLoaded .top{display:none!important}
    body.runnerSeasonPreviewsLoaded .runnerNavPad{padding-top:8px!important;padding-bottom:0!important;margin-top:0!important}
    body.runnerSeasonPreviewsLoaded .runnerNavPad .tabs>.btn:not(#${BUTTON_ID}){display:none!important}
    body.runnerSeasonPreviewsLoaded #${BUTTON_ID}{grid-column:1/-1!important;display:grid!important}
    body.runnerSeasonPreviewsLoaded #${PANEL_ID}{display:block!important;margin-top:0!important}
    body.runnerSeasonPreviewsLoaded #${PANEL_ID}~*{display:none!important}
    .seasonPreviewHead{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;border-bottom:1px solid #4a302b;padding-bottom:10px}
    .seasonPreviewHead h2{margin:0;color:#ffd0bb;font-size:16px;letter-spacing:.10em}.seasonPreviewHead p{margin:4px 0 0;color:#9c827b;font-size:8px;line-height:1.45}
    .seasonPreviewBadge{border:1px solid #81584d;color:#f0b5a4;background:#100705;padding:6px 9px;font-size:8px;font-weight:950;letter-spacing:.08em}
    .seasonPreviewStatus{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.seasonPreviewStat{border:1px solid #3d2a26;background:#070404;padding:10px}.seasonPreviewStat small{display:block;color:#8f7770;font-size:8px;letter-spacing:.09em}.seasonPreviewStat b{display:block;margin-top:4px;color:#f5d6ca;font-size:14px}.seasonPreviewStat span{display:block;margin-top:4px;color:#8f7770;font-size:8px;line-height:1.45;overflow-wrap:anywhere}
    .seasonPreviewList{display:grid;gap:8px;margin-top:10px}.seasonPreviewItem{border:1px solid #48312b;background:#060303;padding:10px}.seasonPreviewItem b{display:block;color:#f3c8b8;font-size:12px}.seasonPreviewItem span{display:block;margin-top:4px;color:#957e77;font-size:9px;line-height:1.45}.seasonPreviewItem a{display:inline-block;margin-top:7px;color:#8edfff;font-size:9px;font-weight:900;text-decoration:none}
    .seasonPreviewEmpty{margin-top:10px;border:1px dashed #81584d;background:#0a0504;padding:12px;color:#c99c8e;font-size:10px;line-height:1.55}
    @media(max-width:760px){.seasonPreviewStatus{grid-template-columns:1fr}}
  `;
  d.head.appendChild(s);
}
function sourcePath(item){
  const path=String(item?.path||item?.file||'').trim();
  if(!path)return '';
  if(path.startsWith('http://')||path.startsWith('https://')||path.startsWith('./')||path.startsWith('../'))return path;
  if(path.startsWith('research/'))return './'+path;
  return './'+SOURCE_FOLDER+path;
}
function renderPanel(d){
  const tabs=d.querySelector('.runnerNavPad .tabs')||d.querySelector('.tabs');
  const nav=tabs?.parentElement;if(!nav)return;
  let p=d.getElementById(PANEL_ID);
  if(!p){p=d.createElement('section');p.id=PANEL_ID;p.setAttribute('aria-label','Season preview source library');nav.insertAdjacentElement('afterend',p)}
  const sources=Array.isArray(manifest?.sources)?manifest.sources:[];
  const renderKey=JSON.stringify([manifest?.updatedAt||'',sources]);
  if(p.dataset.renderKey===renderKey&&p.innerHTML)return;
  p.dataset.renderKey=renderKey;
  const cards=sources.map(item=>{
    const title=esc(item.title||item.name||item.file||'UNTITLED SOURCE');
    const meta=[item.kind,item.season,item.status].filter(Boolean).map(esc).join(' // ');
    const path=sourcePath(item);
    return `<article class="seasonPreviewItem"><b>${title}</b>${meta?`<span>${meta}</span>`:''}${item.notes?`<span>${esc(item.notes)}</span>`:''}${path?`<a href="${esc(path)}" target="_blank" rel="noopener">OPEN SOURCE PDF</a>`:''}</article>`;
  }).join('');
  p.innerHTML=`
    <div class="seasonPreviewHead"><div><h2>SEASON PREVIEWS // SOURCE LIBRARY</h2><p>MAGAZINES // GUIDES // BOOKS // PRESEASON REFERENCE MATERIAL</p></div><div class="seasonPreviewBadge">SOURCE-ONLY // READ BEFORE USE</div></div>
    <div class="seasonPreviewStatus">
      <div class="seasonPreviewStat"><small>PDF SOURCE FOLDER</small><b>${esc(SOURCE_FOLDER)}</b><span>Upload raw season-preview PDFs here.</span></div>
      <div class="seasonPreviewStat"><small>INDEXED SOURCES</small><b>${sources.length}</b><span>${manifest?.updatedAt?`MANIFEST UPDATED ${esc(manifest.updatedAt)}`:'WAITING FOR SOURCE INDEX'}</span></div>
    </div>
    ${cards?`<div class="seasonPreviewList">${cards}</div>`:`<div class="seasonPreviewEmpty"><b>NO SOURCES INDEXED YET.</b><br>UPLOAD PDF FILES TO <b>${esc(SOURCE_FOLDER)}</b>. AFTER THE FILES ARE PRESENT, THEY CAN BE REVIEWED, INDEXED AND MADE AVAILABLE TO THE SEASON-PREVIEW WORKFLOW.</div>`}
  `;
}
function setButtonCopy(d,b){
  const count=Array.isArray(manifest?.sources)?manifest.sources.length:null;
  const msg=count===null?'SEASON SOURCE LIBRARY&nbsp;&nbsp; // &nbsp;&nbsp;PRESS [F6] TO LOAD PREVIEWS':`${count} SOURCE${count===1?'':'S'} INDEXED&nbsp;&nbsp; // &nbsp;&nbsp;PRESS [F6] TO LOAD PREVIEWS`;
  const html=`<span class="f6Main"><b>[F6]</b>&nbsp; 🥩 LOAD SEASON PREVIEWS 🥩</span><span class="f6Message">${msg}</span>`;
  if(b.innerHTML!==html)b.innerHTML=html;
}
function setPreferenceCopy(d,pref){
  const style=cardStyle();
  if(pref.dataset.cardStyleLabel===style&&pref.dataset.tabified==='1')return;
  pref.dataset.tabified='1';pref.dataset.cardStyleLabel=style;
  pref.innerHTML=`<span class="prefMain"><b>[TAB]</b>&nbsp; PREFERENCES</span><span class="prefMessage">CARD STYLE: ${esc(style)}&nbsp;&nbsp; // &nbsp;&nbsp;PRESS [TAB] TO CONFIGURE</span>`;
  pref.setAttribute('aria-label','Preferences');
}
function patchLegacyPreferenceCopy(d){
  d.querySelectorAll('.prefFrameworkRule,.prefModulePolicy,.sp-note,.sp-control-lock').forEach(root=>{
    const walker=d.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    let node;
    while((node=walker.nextNode())){
      const next=String(node.nodeValue||'')
        .replace(/F6 observes/g,'Preferences observes')
        .replace(/F6 remains/g,'Preferences remains')
        .replace(/\bF6\b/g,'[TAB] PREFERENCES');
      if(next!==node.nodeValue)node.nodeValue=next;
    }
  });
}
function closeSeasonPreview(d,b){d.body.classList.remove('runnerSeasonPreviewsLoaded');if(b){b.classList.remove('active');b.setAttribute('aria-pressed','false')}}
function bind(d,b,pref,tabs){
  if(b.dataset.bound!=='1'){
    b.dataset.bound='1';
    b.addEventListener('click',()=>{
      const open=!d.body.classList.contains('runnerSeasonPreviewsLoaded');
      d.body.classList.remove('runnerSyndicateLoaded','runnerPreferencesLoaded');
      pref?.classList.remove('active');
      d.body.classList.toggle('runnerSeasonPreviewsLoaded',open);
      b.classList.toggle('active',open);
      b.setAttribute('aria-pressed',String(open));
      if(open)renderPanel(d);
      try{d.defaultView?.scrollTo({top:0,left:0,behavior:'auto'})}catch{}
    });
  }
  if(pref&&pref.dataset.seasonPreviewBound!=='1'){
    pref.dataset.seasonPreviewBound='1';
    pref.addEventListener('click',()=>closeSeasonPreview(d,b));
  }
  if(tabs.dataset.seasonPreviewBound!=='1'){
    tabs.dataset.seasonPreviewBound='1';
    tabs.addEventListener('click',e=>{const x=e.target.closest?.('.btn');if(x&&x!==b)closeSeasonPreview(d,b)});
  }
  if(d.documentElement.dataset.seasonPreviewKeysBound!=='1'&&pref){
    d.documentElement.dataset.seasonPreviewKeysBound='1';
    d.addEventListener('keydown',e=>{
      if(e.key==='F6'){
        e.preventDefault();b.click();return;
      }
      if(e.key==='Tab'&&!d.body.classList.contains('runnerPreferencesLoaded')){
        const target=e.target;
        if(target?.closest?.('input,select,textarea,[contenteditable="true"]'))return;
        e.preventDefault();pref.click();
      }
    },true);
  }
  if(d.documentElement.dataset.seasonPreviewChangeBound!=='1'){
    d.documentElement.dataset.seasonPreviewChangeBound='1';
    d.addEventListener('change',()=>setTimeout(()=>setPreferenceCopy(d,pref),0));
  }
}
function ensureUi(d){
  if(!d?.body)return false;
  ensureStyle(d);
  const tabs=d.querySelector('.runnerNavPad .tabs')||d.querySelector('.tabs');
  if(!tabs)return false;
  const pref=d.getElementById(PREF_BUTTON_ID);
  if(!pref)return false;
  let b=d.getElementById(BUTTON_ID);
  if(!b){b=d.createElement('button');b.type='button';b.id=BUTTON_ID;b.className='btn';b.setAttribute('aria-pressed','false');tabs.appendChild(b)}
  setButtonCopy(d,b);setPreferenceCopy(d,pref);
  const f5=d.getElementById('runnerSyndicateF5');
  if(f5&&f5.nextElementSibling!==b)f5.insertAdjacentElement('afterend',b);
  else if(!f5&&b.parentElement!==tabs)tabs.appendChild(b);
  if(tabs.lastElementChild!==pref)tabs.appendChild(pref);
  renderPanel(d);patchLegacyPreferenceCopy(d);bind(d,b,pref,tabs);
  return true;
}
async function loadManifest(){
  if(manifestRequested)return;manifestRequested=true;
  try{
    const r=await fetch(`${MANIFEST_URL}?v=${Date.now()}`,{cache:'no-store'});
    if(r.ok)manifest=await r.json();
  }catch{}
  const d=appDoc();if(d)ensureUi(d);
}
function attach(){
  const d=appDoc();if(!d?.body)return false;
  if(d!==lastDoc){
    lastDoc=d;
    if(observer)observer.disconnect();
    observer=new MutationObserver(()=>requestAnimationFrame(()=>ensureUi(d)));
    observer.observe(d.body,{subtree:true,childList:true});
  }
  ensureUi(d);loadManifest();return true;
}

let tries=0;
const timer=setInterval(()=>{tries++;if(attach()||tries>200)clearInterval(timer)},100);
setInterval(()=>{const d=appDoc();if(d)ensureUi(d)},1200);
})();
