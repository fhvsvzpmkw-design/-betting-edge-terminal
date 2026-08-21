(()=>{
'use strict';

const MANIFEST_URL='./research/season-previews/manifest.json';
const SOURCE_FOLDER='research/season-previews/source-pdfs/';
const BUTTON_ID='runnerSeasonPreviewF6';
const PREF_BUTTON_ID='runnerPreferencesF6';
const PANEL_ID='runnerSeasonPreviewsWorkspace';
const STYLE_ID='runnerSeasonPreviewsUiStyle';

let manifest=null,lastDoc=null,observer=null,manifestRequested=false;
let selectedId=null,reader=null;

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
function sourcePath(item){
  const path=String(item?.path||item?.file||'').trim();
  if(!path)return '';
  if(path.startsWith('http://')||path.startsWith('https://')||path.startsWith('./')||path.startsWith('../'))return path;
  if(path.startsWith('research/'))return './'+path;
  return './'+SOURCE_FOLDER+path;
}
function iconFor(item){
  const desk=String(item?.desk||item?.kind||'').toUpperCase();
  if(desk.includes('RACING')||desk.includes('HORSE'))return '🐎';
  if(desk.includes('FANTASY'))return '🏈';
  if(desk.includes('CFB')||desk.includes('COLLEGE'))return '🏟️';
  if(desk.includes('NFL'))return '🏈';
  return '📖';
}
function shortDesk(item){return String(item?.desk||item?.season||item?.kind||'SOURCE').toUpperCase()}
function sizeText(bytes){
  const n=Number(bytes);if(!Number.isFinite(n)||n<=0)return '';
  return n>1048576?`${(n/1048576).toFixed(1)} MB`:`${Math.round(n/1024)} KB`;
}
function itemById(id){return (manifest?.sources||[]).find(x=>String(x.id)===String(id))||null}

function ensureStyle(d){
  if(d.getElementById(STYLE_ID))return;
  const s=d.createElement('style');
  s.id=STYLE_ID;
  s.textContent=`
    #${BUTTON_ID}{grid-column:1/-1!important;display:grid!important;place-items:center!important;gap:7px!important;padding:10px 8px!important;border-color:#9b5b50!important;color:#ffd0bb!important;background:#0a0505!important;box-shadow:inset 0 0 0 1px rgba(255,160,130,.05),0 0 10px rgba(175,72,52,.08)!important;text-shadow:0 0 6px rgba(255,166,132,.16)!important}
    #${BUTTON_ID} .f6Main{display:block;font-size:inherit}.f6Message{display:block;color:#c88f80;font-size:8px;font-weight:900;letter-spacing:.11em;line-height:1.35}
    #${BUTTON_ID}.active,#${BUTTON_ID}:hover{border-color:#e38a75!important;color:#ffe3d6!important;background:#120706!important;box-shadow:inset 0 0 0 1px rgba(255,190,165,.10),0 0 14px rgba(210,100,75,.14)!important}
    #${PREF_BUTTON_ID}{grid-column:1/-1!important;display:grid!important;place-items:center!important;gap:7px!important;padding-top:10px!important;padding-bottom:10px!important}
    #${PREF_BUTTON_ID} .prefMain{display:block;font-size:inherit}.prefMessage{display:block;color:#83a6b7;font-size:8px;font-weight:900;letter-spacing:.11em;line-height:1.35}
    #${PANEL_ID}{display:none;margin:0 12px 14px;padding:12px;border:1px solid #5f4039;background:radial-gradient(circle at 50% -20%,rgba(128,43,28,.20),transparent 48%),linear-gradient(180deg,#090504,#030303);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#d8e8ee;min-height:65vh}
    body.runnerSeasonPreviewsLoaded .top{display:none!important}
    body.runnerSeasonPreviewsLoaded .runnerNavPad{padding-top:8px!important;padding-bottom:0!important;margin-top:0!important}
    body.runnerSeasonPreviewsLoaded .runnerNavPad .tabs>.btn:not(#${BUTTON_ID}){display:none!important}
    body.runnerSeasonPreviewsLoaded #${BUTTON_ID}{grid-column:1/-1!important;display:grid!important}
    body.runnerSeasonPreviewsLoaded #${PANEL_ID}{display:block!important;margin-top:0!important}
    body.runnerSeasonPreviewsLoaded #${PANEL_ID}~*{display:none!important}

    .meatDeskHead{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;border-bottom:1px solid #4a302b;padding-bottom:10px;flex-wrap:wrap}.meatDeskHead h2{margin:0;color:#ffd0bb;font-size:18px;letter-spacing:.12em}.meatDeskHead p{margin:5px 0 0;color:#9c827b;font-size:8px;line-height:1.5;letter-spacing:.05em}.meatDeskBadge{border:1px solid #81584d;color:#f0b5a4;background:#100705;padding:6px 9px;font-size:8px;font-weight:950;letter-spacing:.09em}
    .meatShelfTools{display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin:11px 0 6px}.meatSearch{flex:1 1 220px;min-height:36px;border:1px solid #4a302b;background:#080404;color:#e9d8d1;padding:8px 10px;font:800 10px ui-monospace,SFMono-Regular,Menlo,monospace;outline:none}.meatFilter{border:1px solid #594039;background:#080404;color:#a98f87;padding:7px 9px;font:900 8px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;cursor:pointer}.meatFilter.active{border-color:#d88672;color:#ffd5c6;background:#190908}
    .meatShelf{display:grid;grid-template-columns:repeat(auto-fill,minmax(145px,1fr));gap:16px 13px;padding:10px 2px 16px;align-items:start}.meatBookWrap{min-width:0;display:grid;justify-items:center;gap:7px}.meatBook{position:relative;width:min(100%,170px);aspect-ratio:.72;border:0;background:transparent;padding:0;cursor:pointer;perspective:900px}.meatBookCover{position:absolute;inset:0;border:1px solid #68443a;border-left:7px solid #3b211b;border-radius:3px 7px 7px 3px;background:linear-gradient(150deg,#1d0a07 0%,#5a1e15 45%,#140706 100%);box-shadow:0 12px 22px rgba(0,0,0,.42),inset 0 0 0 1px rgba(255,220,205,.06);display:grid;grid-template-rows:auto 1fr auto;padding:10px 9px;overflow:hidden;transform-origin:left center;transition:transform 160ms ease,box-shadow 160ms ease,border-color 160ms ease}.meatBookCover:after{content:"";position:absolute;inset:0;background:repeating-linear-gradient(105deg,rgba(255,255,255,.025) 0 1px,transparent 1px 7px);pointer-events:none}.meatBook:hover .meatBookCover,.meatBook:focus-visible .meatBookCover{transform:rotateY(-7deg) translateY(-2px);box-shadow:7px 14px 24px rgba(0,0,0,.50);border-color:#d88672}.meatBookKicker{position:relative;z-index:1;color:#e1a694;font-size:7px;font-weight:950;letter-spacing:.11em;text-align:left}.meatBookIcon{position:relative;z-index:1;display:grid;place-items:center;font-size:48px;filter:drop-shadow(0 4px 8px rgba(0,0,0,.45))}.meatBookTitle{position:relative;z-index:1;text-align:left}.meatBookTitle b{display:block;color:#fff0e8;font-size:11px;line-height:1.12;letter-spacing:.035em;text-shadow:0 1px 5px #000}.meatBookTitle span{display:block;margin-top:5px;color:#e5ac9b;font-size:7px;font-weight:900;letter-spacing:.08em}.meatBookCaption{width:min(100%,170px);color:#bea69d;font-size:8px;line-height:1.35;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.meatBookCaption b{color:#f0c3b5}.meatBookStatus{font-size:7px;color:#866e67}
    .meatEmpty{margin-top:14px;border:1px dashed #81584d;padding:18px;text-align:center;color:#c99c8e;font-size:10px}

    .meatDetail{margin-top:11px;border:1px solid #52362e;background:#050303;padding:11px}.meatDetailTop{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px}.meatDetailTop b{color:#ffd0bb;font-size:12px;letter-spacing:.08em}.meatClose,.meatAction,.meatReaderBtn{border:1px solid #6b493f;background:#0b0504;color:#e9baa9;padding:8px 10px;font:900 8px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;cursor:pointer;text-decoration:none}.meatAction.primary,.meatReaderBtn.primary{border-color:#d88672;background:#1a0907;color:#ffe0d4}.meatDetailGrid{display:grid;grid-template-columns:minmax(220px,.8fr) minmax(260px,1.2fr);gap:13px}.meatCoverPreview{position:relative;min-height:420px;border:1px solid #5d4037;background:#100806;overflow:hidden;display:grid;place-items:center}.meatCoverPreview iframe{position:absolute;inset:0;width:100%;height:100%;border:0;background:#111}.meatCoverHint{position:absolute;left:8px;right:8px;bottom:8px;z-index:2;background:rgba(5,3,3,.86);border:1px solid #60423a;padding:6px;color:#c6a69b;font-size:7px;text-align:center;pointer-events:none}.meatInfo{display:grid;align-content:start;gap:9px}.meatInfo h3{margin:0;color:#fff0e8;font-size:17px;line-height:1.2}.meatInfoMeta{display:flex;gap:6px;flex-wrap:wrap}.meatChip{border:1px solid #5b4038;background:#0b0605;color:#caa89b;padding:4px 6px;font-size:7px;font-weight:900;letter-spacing:.07em}.meatInfoBlock{border-top:1px solid #34231f;padding-top:8px}.meatInfoBlock small{display:block;color:#8f7770;font-size:7px;font-weight:900;letter-spacing:.10em}.meatInfoBlock p{margin:4px 0 0;color:#cbb6ae;font-size:10px;line-height:1.55}.meatInfoActions{display:flex;gap:8px;flex-wrap:wrap;margin-top:4px}

    .meatReader{margin-top:10px}.meatReaderBar{display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin-bottom:8px}.meatReaderTitle{flex:1 1 220px;color:#f5d1c3;font-size:10px;font-weight:950;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.meatPageBox{display:flex;align-items:center;gap:6px;border:1px solid #51362f;background:#080404;padding:5px 7px;color:#a78c83;font-size:8px}.meatPageBox input{width:54px;border:0;background:#120806;color:#ffe1d6;font:900 10px ui-monospace,SFMono-Regular,Menlo,monospace;text-align:center;outline:none}.meatReaderStage{position:relative;border:1px solid #5f4039;background:radial-gradient(circle at 50% 15%,#39211b,#0a0605 58%,#030303);min-height:620px;padding:12px;overflow:hidden;perspective:1200px}.meatPaper{position:relative;width:100%;height:min(74vh,880px);min-height:580px;background:#111;border:1px solid #6a5149;box-shadow:0 20px 44px rgba(0,0,0,.55);transform-origin:left center;transition:transform 160ms ease,opacity 160ms ease}.meatPaper.turning{transform:rotateY(-10deg) translateX(8px);opacity:.72}.meatPaper iframe{position:absolute;inset:0;width:100%;height:100%;border:0;background:#161616}.meatReaderHelp{margin-top:7px;color:#8e7770;font-size:7px;line-height:1.45;text-align:center}
    @media(max-width:760px){#${PANEL_ID}{margin-left:7px;margin-right:7px;padding:9px}.meatShelf{grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 10px}.meatBook{width:min(100%,160px)}.meatDetailGrid{grid-template-columns:1fr}.meatCoverPreview{min-height:430px}.meatReaderStage{min-height:520px;padding:7px}.meatPaper{height:68vh;min-height:500px}}
    @media(max-width:430px){.meatShelf{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 8px}.meatBookIcon{font-size:40px}.meatBookTitle b{font-size:9.5px}.meatBookCover{padding:8px 7px}.meatBookCaption{font-size:7.5px}.meatCoverPreview{min-height:360px}.meatPaper{min-height:460px}}
  `;
  d.head.appendChild(s);
}

function setButtonCopy(b){
  const count=Array.isArray(manifest?.sources)?manifest.sources.length:null;
  const msg=count===null?'SOURCE DESK&nbsp;&nbsp; // &nbsp;&nbsp;PRESS [F8] TO OPEN':`${count} SOURCE${count===1?'':'S'} ON DESK&nbsp;&nbsp; // &nbsp;&nbsp;PRESS [F8] TO OPEN`;
  const html=`<span class="f6Main"><b>[F8]</b>&nbsp; 🥩 MEAT DESK 🥩</span><span class="f6Message">${msg}</span>`;
  if(b.innerHTML!==html)b.innerHTML=html;
}
function setPreferenceCopy(pref){
  const style=cardStyle();
  if(pref.dataset.cardStyleLabel===style&&pref.dataset.tabified==='1')return;
  pref.dataset.tabified='1';pref.dataset.cardStyleLabel=style;
  pref.innerHTML=`<span class="prefMain"><b>[TAB]</b>&nbsp; PREFERENCES</span><span class="prefMessage">CARD STYLE: ${esc(style)}&nbsp;&nbsp; // &nbsp;&nbsp;PRESS [TAB] TO CONFIGURE</span>`;
  pref.setAttribute('aria-label','Preferences');
}
function patchLegacyPreferenceCopy(d){
  d.querySelectorAll('.prefFrameworkRule,.prefModulePolicy,.sp-note,.sp-control-lock').forEach(root=>{
    const walker=d.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
    while((node=walker.nextNode())){
      const next=String(node.nodeValue||'').replace(/F6 observes/g,'Preferences observes').replace(/F6 remains/g,'Preferences remains').replace(/\bF6\b/g,'[TAB] PREFERENCES');
      if(next!==node.nodeValue)node.nodeValue=next;
    }
  });
}
function filtersHtml(){return ['ALL','NFL','CFB','FANTASY','RACING'].map(x=>`<button type="button" class="meatFilter${x==='ALL'?' active':''}" data-meat-filter="${x}">${x}</button>`).join('')}
function bookHtml(item){
  const title=esc(item.title||item.file||'UNTITLED SOURCE');
  const tags=(item.tags||[]).slice(0,2).map(esc).join(' · ');
  return `<div class="meatBookWrap" data-meat-item="${esc(item.id)}" data-search="${esc([item.title,item.kind,item.season,item.desk,item.publisher,(item.tags||[]).join(' ')].filter(Boolean).join(' ').toUpperCase())}" data-desk="${esc(shortDesk(item))}">
    <button type="button" class="meatBook" data-meat-open="${esc(item.id)}" aria-label="Open ${title}">
      <span class="meatBookCover"><span class="meatBookKicker">${esc(shortDesk(item))} // ${esc(item.season||'')}</span><span class="meatBookIcon">${iconFor(item)}</span><span class="meatBookTitle"><b>${title}</b><span>${tags||esc(item.format||item.kind||'SOURCE')}</span></span></span>
    </button>
    <div class="meatBookCaption"><b>${esc(item.publisher||item.format||'DESK COPY')}</b> · ${esc(sizeText(item.bytes))}</div>
    <div class="meatBookStatus">${esc(item.status||'INDEXED')}</div>
  </div>`;
}
function libraryHtml(){
  const sources=Array.isArray(manifest?.sources)?manifest.sources:[];
  return `<div class="meatDeskHead"><div><h2>🥩 MEAT DESK</h2><p>PRESEASON MAGAZINES // BETTING GUIDES // BOOKS // REFERENCE COPIES</p></div><div class="meatDeskBadge">${sources.length} DESK COP${sources.length===1?'Y':'IES'} // SOURCE-ONLY</div></div>
    <div class="meatShelfTools"><input class="meatSearch" type="search" placeholder="SEARCH THE DESK…" aria-label="Search Meat Desk">${filtersHtml()}</div>
    ${sources.length?`<div class="meatShelf">${sources.map(bookHtml).join('')}</div>`:`<div class="meatEmpty">NO DESK COPIES INDEXED.</div>`}`;
}
function detailHtml(item){
  const path=sourcePath(item),title=esc(item.title||item.file||'SOURCE');
  const chips=[item.desk,item.season,item.publisher,item.format,sizeText(item.bytes)].filter(Boolean).map(x=>`<span class="meatChip">${esc(x)}</span>`).join('');
  const previewSrc=`${path}#page=1&view=FitH&toolbar=0&navpanes=0`;
  return `<div class="meatDetail" data-meat-detail="${esc(item.id)}">
    <div class="meatDetailTop"><b>DESK COPY // COVER PREVIEW</b><button type="button" class="meatClose" data-meat-back>BACK TO SHELF</button></div>
    <div class="meatDetailGrid">
      <div class="meatCoverPreview"><iframe src="${esc(previewSrc)}" title="${title} cover preview" loading="eager"></iframe><div class="meatCoverHint">LIVE PDF COVER PREVIEW // IF THE EMBED IS BLANK, USE OPEN FULLSCREEN PDF</div></div>
      <div class="meatInfo"><h3>${title}</h3><div class="meatInfoMeta">${chips}</div>
        <div class="meatInfoBlock"><small>WHY IT'S ON THE DESK</small><p>${esc(item.use||item.notes||'Reference copy.')}</p></div>
        <div class="meatInfoBlock"><small>REVIEW STATE</small><p>${esc(item.status||'INDEXED')}</p></div>
        <div class="meatInfoBlock"><small>NOTES</small><p>${esc(item.notes||'No notes yet.')}</p></div>
        <div class="meatInfoActions"><button type="button" class="meatAction primary" data-meat-read="${esc(item.id)}">READ DESK COPY</button><a class="meatAction" href="${esc(path)}" target="_blank" rel="noopener">OPEN FULLSCREEN PDF</a></div>
      </div>
    </div>
  </div>`;
}
function readerSrc(item,page){return `${sourcePath(item)}#page=${Math.max(1,page)}&zoom=page-width&view=FitH`}
function readerHtml(item,page=1){
  const title=esc(item.title||item.file||'SOURCE'),path=sourcePath(item);
  return `<div class="meatReader" data-meat-reader="${esc(item.id)}">
    <div class="meatReaderBar"><button type="button" class="meatReaderBtn" data-meat-reader-back>← SHELF</button><div class="meatReaderTitle">${title}</div><button type="button" class="meatReaderBtn" data-meat-prev>◀ PREV</button><div class="meatPageBox">PAGE <input type="number" min="1" value="${page}" data-meat-page></div><button type="button" class="meatReaderBtn primary" data-meat-next>NEXT ▶</button><a class="meatReaderBtn" href="${esc(path)}" target="_blank" rel="noopener">FULLSCREEN PDF</a></div>
    <div class="meatReaderStage"><div class="meatPaper"><iframe src="${esc(readerSrc(item,page))}" title="${title} reader" loading="eager"></iframe></div></div>
    <div class="meatReaderHelp">NATIVE PDF READER // SWIPE LEFT OR RIGHT OR USE PREV / NEXT // THE FULLSCREEN PDF LINK IS ALWAYS AVAILABLE AS A FALLBACK</div>
  </div>`;
}
function renderPanel(d,mode='library'){
  const tabs=d.querySelector('.runnerNavPad .tabs')||d.querySelector('.tabs'),nav=tabs?.parentElement;if(!nav)return;
  let p=d.getElementById(PANEL_ID);if(!p){p=d.createElement('section');p.id=PANEL_ID;p.setAttribute('aria-label','Meat Desk source library');nav.insertAdjacentElement('afterend',p)}
  if(mode==='detail'&&selectedId){const item=itemById(selectedId);p.innerHTML=libraryHtml()+(item?detailHtml(item):'');return}
  if(mode==='reader'&&reader?.id){const item=itemById(reader.id);p.innerHTML=item?readerHtml(item,reader.page||1):libraryHtml();return}
  p.innerHTML=libraryHtml();
}
function applyShelfFilter(d){
  const p=d.getElementById(PANEL_ID);if(!p)return;
  const q=String(p.querySelector('.meatSearch')?.value||'').trim().toUpperCase();
  const active=p.querySelector('.meatFilter.active')?.dataset.meatFilter||'ALL';
  p.querySelectorAll('[data-meat-item]').forEach(card=>{
    const search=String(card.dataset.search||''),desk=String(card.dataset.desk||'');
    const filterOk=active==='ALL'||desk.includes(active),searchOk=!q||search.includes(q);
    card.style.display=filterOk&&searchOk?'grid':'none';
  });
}
function turnPage(d,deltaOrPage){
  if(!reader?.id)return;const item=itemById(reader.id);if(!item)return;
  const page=typeof deltaOrPage==='number'&&Math.abs(deltaOrPage)<2?Math.max(1,(reader.page||1)+deltaOrPage):Math.max(1,Number(deltaOrPage)||1);
  if(page===reader.page)return;
  const p=d.getElementById(PANEL_ID),paper=p?.querySelector('.meatPaper');if(paper)paper.classList.add('turning');
  setTimeout(()=>{reader.page=page;renderPanel(d,'reader')},150);
}
function bindPanel(d){
  if(d.documentElement.dataset.meatDeskPanelBound==='1')return;
  d.documentElement.dataset.meatDeskPanelBound='1';
  d.addEventListener('click',e=>{
    const p=e.target.closest?.(`#${PANEL_ID}`);if(!p)return;
    const filter=e.target.closest('[data-meat-filter]');if(filter){p.querySelectorAll('.meatFilter').forEach(x=>x.classList.toggle('active',x===filter));applyShelfFilter(d);return}
    const open=e.target.closest('[data-meat-open]');if(open){selectedId=open.dataset.meatOpen;reader=null;renderPanel(d,'detail');return}
    if(e.target.closest('[data-meat-back]')){selectedId=null;reader=null;renderPanel(d,'library');return}
    const read=e.target.closest('[data-meat-read]');if(read){reader={id:read.dataset.meatRead,page:1};selectedId=null;renderPanel(d,'reader');return}
    if(e.target.closest('[data-meat-reader-back]')){reader=null;selectedId=null;renderPanel(d,'library');return}
    if(e.target.closest('[data-meat-prev]')){turnPage(d,-1);return}
    if(e.target.closest('[data-meat-next]')){turnPage(d,1);return}
  });
  d.addEventListener('input',e=>{if(e.target.matches?.('.meatSearch'))applyShelfFilter(d)});
  d.addEventListener('change',e=>{if(e.target.matches?.('[data-meat-page]'))turnPage(d,Number(e.target.value)||1);setTimeout(()=>{const pref=d.getElementById(PREF_BUTTON_ID);if(pref)setPreferenceCopy(pref)},0)});
  let touchX=null;
  d.addEventListener('touchstart',e=>{if(e.target.closest?.('.meatReaderStage'))touchX=e.touches?.[0]?.clientX??null},{passive:true});
  d.addEventListener('touchend',e=>{if(touchX===null||!e.target.closest?.('.meatReaderStage'))return;const x=e.changedTouches?.[0]?.clientX??touchX,dx=x-touchX;touchX=null;if(Math.abs(dx)>55)turnPage(d,dx<0?1:-1)},{passive:true});
}
function closeDesk(d,b){d.body.classList.remove('runnerSeasonPreviewsLoaded');if(b){b.classList.remove('active');b.setAttribute('aria-pressed','false')}selectedId=null;reader=null}
function bindNav(d,b,pref,tabs){
  if(b.dataset.bound!=='1'){
    b.dataset.bound='1';b.addEventListener('click',()=>{
      const open=!d.body.classList.contains('runnerSeasonPreviewsLoaded');d.body.classList.remove('runnerSyndicateLoaded','runnerPreferencesLoaded');pref?.classList.remove('active');d.body.classList.toggle('runnerSeasonPreviewsLoaded',open);b.classList.toggle('active',open);b.setAttribute('aria-pressed',String(open));if(open)renderPanel(d,'library');try{d.defaultView?.scrollTo({top:0,left:0,behavior:'auto'})}catch{}
    });
  }
  if(pref&&pref.dataset.meatDeskBound!=='1'){pref.dataset.meatDeskBound='1';pref.addEventListener('click',()=>closeDesk(d,b))}
  if(tabs.dataset.meatDeskBound!=='1'){tabs.dataset.meatDeskBound='1';tabs.addEventListener('click',e=>{const x=e.target.closest('.btn');if(x&&x!==b)closeDesk(d,b)})}
  if(d.documentElement.dataset.meatDeskKeysBound!=='1'&&pref){d.documentElement.dataset.meatDeskKeysBound='1';d.addEventListener('keydown',e=>{
    if(e.key==='F8'){e.preventDefault();b.click();return}
    if(e.key==='Tab'&&!d.body.classList.contains('runnerPreferencesLoaded')){const target=e.target;if(target?.closest?.('input,select,textarea,[contenteditable="true"]'))return;e.preventDefault();pref.click();return}
    if(reader?.id&&e.key==='ArrowLeft'){e.preventDefault();turnPage(d,-1)}
    if(reader?.id&&e.key==='ArrowRight'){e.preventDefault();turnPage(d,1)}
  },true)}
}
function ensureUi(d){
  if(!d?.body)return false;ensureStyle(d);
  const tabs=d.querySelector('.runnerNavPad .tabs')||d.querySelector('.tabs');if(!tabs)return false;
  const pref=d.getElementById(PREF_BUTTON_ID);if(!pref)return false;
  let b=d.getElementById(BUTTON_ID);if(!b){b=d.createElement('button');b.type='button';b.id=BUTTON_ID;b.className='btn';b.setAttribute('aria-pressed','false');tabs.appendChild(b)}
  setButtonCopy(b);setPreferenceCopy(pref);
  const f5=d.getElementById('runnerSyndicateF5');if(f5&&f5.nextElementSibling!==b)f5.insertAdjacentElement('afterend',b);if(tabs.lastElementChild!==pref)tabs.appendChild(pref);
  if(!d.getElementById(PANEL_ID))renderPanel(d,'library');patchLegacyPreferenceCopy(d);bindPanel(d);bindNav(d,b,pref,tabs);return true;
}
async function loadManifest(){
  if(manifestRequested)return;manifestRequested=true;
  try{const r=await fetch(`${MANIFEST_URL}?v=${Date.now()}`,{cache:'no-store'});if(r.ok)manifest=await r.json()}catch{}
  const d=appDoc();if(d){ensureUi(d);if(d.body.classList.contains('runnerSeasonPreviewsLoaded'))renderPanel(d,'library')}
}
function attach(){
  const d=appDoc();if(!d?.body)return false;
  if(d!==lastDoc){lastDoc=d;if(observer)observer.disconnect();observer=new MutationObserver(()=>requestAnimationFrame(()=>ensureUi(d)));observer.observe(d.body,{subtree:true,childList:true})}
  ensureUi(d);loadManifest();return true;
}
let tries=0;const timer=setInterval(()=>{tries++;if(attach()||tries>200)clearInterval(timer)},100);setInterval(()=>{const d=appDoc();if(d)ensureUi(d)},1200);
})();
