(()=>{
'use strict';

const MANIFEST_URL='./research/season-previews/manifest.json';
const SOURCE_FOLDER='research/season-previews/source-pdfs/';
const BUTTON_ID='runnerSeasonPreviewF6';
const PREF_BUTTON_ID='runnerPreferencesF6';
const PANEL_ID='runnerSeasonPreviewsWorkspace';
const STYLE_ID='runnerSeasonPreviewsUiStyle';
const PDFJS_SRC='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WORKER='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let manifest=null,lastDoc=null,observer=null,manifestRequested=false,pdfJsPromise=null,coverObserver=null;
const pdfCache=new Map();
let readerState={item:null,pdf:null,page:1,zoom:1,renderToken:0};

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
function formatBytes(v){
  const n=Number(v);if(!Number.isFinite(n)||n<=0)return 'SIZE UNKNOWN';
  if(n>=1024*1024)return `${(n/(1024*1024)).toFixed(n>=10*1024*1024?1:2)} MB`;
  if(n>=1024)return `${(n/1024).toFixed(1)} KB`;
  return `${n} B`;
}
function sourceById(id){return (manifest?.sources||[]).find(x=>String(x?.id||'')===String(id||''))||null}
function sourceTags(item){
  const tags=Array.isArray(item?.tags)?item.tags:[];
  return tags.map(x=>`<span class="meatTag">${esc(x)}</span>`).join('');
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
    #${PANEL_ID}{display:none;margin:0 12px 14px;padding:12px;border:1px solid #5f4039;background:linear-gradient(180deg,#090504,#030303);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#d8e8ee;min-height:72vh}
    body.runnerSeasonPreviewsLoaded .top{display:none!important}
    body.runnerSeasonPreviewsLoaded .runnerNavPad{padding-top:8px!important;padding-bottom:0!important;margin-top:0!important}
    body.runnerSeasonPreviewsLoaded .runnerNavPad .tabs>.btn:not(#${BUTTON_ID}){display:none!important}
    body.runnerSeasonPreviewsLoaded #${BUTTON_ID}{grid-column:1/-1!important;display:grid!important}
    body.runnerSeasonPreviewsLoaded #${PANEL_ID}{display:block!important;margin-top:0!important}
    body.runnerSeasonPreviewsLoaded #${PANEL_ID}~*{display:none!important}

    .meatDeskHead{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;border-bottom:1px solid #4a302b;padding-bottom:11px}
    .meatDeskHead h2{margin:0;color:#ffd0bb;font-size:17px;letter-spacing:.10em}.meatDeskHead p{margin:5px 0 0;color:#a88e86;font-size:8px;line-height:1.5}
    .meatDeskBadge{border:1px solid #81584d;color:#f0b5a4;background:#100705;padding:6px 9px;font-size:8px;font-weight:950;letter-spacing:.08em}
    .meatDeskStats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:10px 0}.meatDeskStat{border:1px solid #3d2a26;background:#070404;padding:9px}.meatDeskStat small{display:block;color:#8f7770;font-size:7.5px;letter-spacing:.09em}.meatDeskStat b{display:block;margin-top:4px;color:#f5d6ca;font-size:14px}.meatDeskStat span{display:block;margin-top:3px;color:#816b65;font-size:7.5px;line-height:1.4}
    .meatToolbar{display:grid;grid-template-columns:minmax(180px,1fr) auto;gap:9px;align-items:center;margin:10px 0}.meatSearch{width:100%;min-height:38px;border:1px solid #533931;background:#050303;color:#e7d6cf;padding:8px 10px;font:900 10px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.04em}.meatFilters{display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end}.meatFilter{border:1px solid #533931;background:#080403;color:#b99689;padding:7px 9px;font:900 8px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.07em;cursor:pointer}.meatFilter.active{border-color:#d28069;color:#ffe0d3;background:#1a0a07}
    .meatShelf{display:block}.meatGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.meatCard{min-width:0;border:1px solid #4b332d;background:linear-gradient(145deg,#080404,#040303);padding:10px;display:grid;grid-template-columns:150px minmax(0,1fr);gap:12px;transition:border-color 140ms ease,transform 140ms ease,box-shadow 140ms ease}.meatCard:hover{border-color:#9f604f;box-shadow:0 0 16px rgba(180,92,66,.08);transform:translateY(-1px)}.meatCard.hiddenByFilter{display:none!important}
    .meatCover{position:relative;width:150px;aspect-ratio:.72;background:linear-gradient(160deg,#1a0d09,#040303);border:1px solid #6b4439;overflow:hidden;box-shadow:8px 7px 0 #020202,0 0 16px rgba(0,0,0,.45);display:grid;place-items:center}.meatCover:before{content:"";position:absolute;left:0;top:0;bottom:0;width:7px;background:linear-gradient(90deg,#140806,#4c2b23,#100604);z-index:4;box-shadow:2px 0 5px rgba(0,0,0,.55)}.meatCoverCanvas{display:none;max-width:100%;max-height:100%;width:100%;height:100%;object-fit:contain;background:#111}.meatCover.ready .meatCoverCanvas{display:block}.meatCover.ready .meatCoverFallback{display:none}.meatCoverFallback{padding:18px 12px 14px 18px;text-align:center;color:#e4b7a5;line-height:1.15}.meatCoverFallback strong{display:block;font-size:12px;letter-spacing:.06em}.meatCoverFallback span{display:block;margin-top:8px;color:#9c7568;font-size:8px;letter-spacing:.08em}.meatCoverStatus{position:absolute;left:11px;right:5px;bottom:5px;padding:4px 5px;background:rgba(2,2,2,.82);border:1px solid #4f332c;color:#b78d7f;font-size:6.5px;font-weight:950;letter-spacing:.07em;text-align:center;z-index:5}
    .meatInfo{min-width:0;display:flex;flex-direction:column}.meatKicker{color:#a67c6e;font-size:7.5px;font-weight:950;letter-spacing:.10em}.meatTitle{margin-top:5px;color:#f3c8b8;font-size:14px;font-weight:950;line-height:1.15}.meatMeta{margin-top:5px;color:#a2877e;font-size:8px;line-height:1.45}.meatTags{display:flex;flex-wrap:wrap;gap:4px;margin-top:7px}.meatTag{border:1px solid #4d3832;background:#070403;color:#bc998c;padding:3px 5px;font-size:6.5px;font-weight:900;letter-spacing:.06em}.meatUse{margin-top:8px;color:#a98f86;font-size:8.5px;line-height:1.5}.meatFacts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;margin-top:8px}.meatFact{border:1px solid #3d2b27;background:#050303;padding:6px}.meatFact small{display:block;color:#79645e;font-size:6.5px;letter-spacing:.08em}.meatFact b{display:block;margin-top:3px;color:#c7a79b;font-size:8px;overflow-wrap:anywhere}.meatActions{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:auto;padding-top:9px}.meatAction{min-height:34px;border:1px solid #6f483d;background:#0d0605;color:#d8aa99;padding:7px 8px;font:950 8px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.06em;cursor:pointer;text-align:center;text-decoration:none}.meatAction.primary{border-color:#d07d66;color:#ffe1d5;background:#1a0a07}.meatAction:hover{border-color:#f0a28d;color:#fff0e9}.meatDetails{display:none;margin-top:7px;border-top:1px dotted #3b2c28;padding-top:7px;color:#8f7770;font-size:7.5px;line-height:1.55}.meatCard.detailsOpen .meatDetails{display:block}
    .meatEmpty{margin-top:10px;border:1px dashed #81584d;background:#0a0504;padding:12px;color:#c99c8e;font-size:10px;line-height:1.55}

    .meatReader{display:none}.meatReader.open{display:block}.meatReaderTop{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:center;border-bottom:1px solid #4a302b;padding-bottom:9px;margin-bottom:10px}.readerBack,.readerNative{border:1px solid #5e4037;background:#090504;color:#cda296;padding:7px 9px;font:950 8px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.06em;cursor:pointer;text-decoration:none}.readerTitleWrap{min-width:0;text-align:center}.readerTitle{color:#ffd0bb;font-size:13px;font-weight:950;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.readerSub{margin-top:3px;color:#8d756e;font-size:7px;letter-spacing:.07em}.readerStage{position:relative;min-height:540px;border:1px solid #3f2b26;background:radial-gradient(circle at 50% 35%,#17100d 0,#090605 45%,#030303 80%);padding:18px;display:grid;place-items:center;overflow:hidden}.readerLoading{position:absolute;inset:0;display:none;place-items:center;background:rgba(2,2,2,.72);z-index:20;color:#d4a392;font-size:9px;font-weight:950;letter-spacing:.10em}.readerStage.loading .readerLoading{display:grid}
    .readerBook{position:relative;width:min(1100px,96%);display:grid;grid-template-columns:1fr 1fr;gap:2px;align-items:center;perspective:1400px;transition:transform 160ms ease,filter 160ms ease}.readerBook.turnNext{transform:perspective(1400px) rotateY(-5deg) translateX(-4px);filter:brightness(.88)}.readerBook.turnPrev{transform:perspective(1400px) rotateY(5deg) translateX(4px);filter:brightness(.88)}.readerPage{position:relative;min-width:0;min-height:480px;background:#eee8df;display:grid;place-items:center;overflow:auto;box-shadow:0 8px 28px rgba(0,0,0,.52)}.readerPage.left{transform-origin:right center;border-radius:4px 0 0 4px}.readerPage.right{transform-origin:left center;border-radius:0 4px 4px 0}.readerPage.blank{background:linear-gradient(90deg,#19110e,#0d0907);box-shadow:none}.readerPage canvas{display:block;max-width:none;background:#fff}.readerPageNo{position:absolute;bottom:5px;right:8px;color:#5b554f;background:rgba(250,248,244,.82);padding:2px 4px;font-size:7px;font-weight:900}.readerSpine{position:absolute;left:50%;top:0;bottom:0;width:18px;transform:translateX(-50%);z-index:4;pointer-events:none;background:linear-gradient(90deg,rgba(0,0,0,.20),rgba(255,255,255,.08),rgba(0,0,0,.24));mix-blend-mode:multiply;opacity:.55}
    .readerControls{display:grid;grid-template-columns:auto auto minmax(170px,1fr) auto auto;gap:7px;align-items:center;margin-top:9px}.readerCtrl{border:1px solid #593c34;background:#090504;color:#cda296;padding:8px 10px;font:950 8px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.05em;cursor:pointer}.readerCtrl:disabled{opacity:.35;cursor:default}.readerProgress{display:grid;grid-template-columns:auto minmax(90px,1fr) auto;gap:8px;align-items:center;border:1px solid #3c2c27;background:#060403;padding:6px 8px}.readerProgress span{color:#8c756d;font-size:7px;font-weight:900;white-space:nowrap}.readerProgress input[type="range"]{width:100%}.readerZoom{display:flex;align-items:center;gap:5px;color:#8c756d;font-size:7px;font-weight:900}.readerZoom b{color:#c9a397;min-width:38px;text-align:center}
    .readerHint{text-align:center;margin-top:7px;color:#735f59;font-size:6.5px;letter-spacing:.08em}

    @media(max-width:980px){.meatDeskStats{grid-template-columns:repeat(2,minmax(0,1fr))}.meatGrid{grid-template-columns:1fr}.meatCard{grid-template-columns:135px minmax(0,1fr)}.meatCover{width:135px}.readerStage{min-height:460px;padding:10px}.readerPage{min-height:400px}.readerControls{grid-template-columns:auto auto 1fr auto auto}}
    @media(max-width:760px){#${PANEL_ID}{margin-left:7px;margin-right:7px;padding:9px}.meatToolbar{grid-template-columns:1fr}.meatFilters{justify-content:flex-start}.meatDeskStats{grid-template-columns:1fr 1fr}.meatCard{grid-template-columns:104px minmax(0,1fr);gap:9px;padding:8px}.meatCover{width:104px}.meatTitle{font-size:12px}.meatFacts{grid-template-columns:1fr 1fr}.meatActions{grid-template-columns:1fr}.meatReaderTop{grid-template-columns:auto minmax(0,1fr)}.readerNative{display:none}.readerStage{min-height:430px;padding:7px}.readerBook{grid-template-columns:1fr;width:100%}.readerPage{min-height:390px;max-height:70vh}.readerPage.right,.readerSpine{display:none!important}.readerPage.left{border-radius:4px}.readerControls{grid-template-columns:1fr 1fr;gap:6px}.readerProgress{grid-column:1/-1;order:-1}.readerZoom{grid-column:1/-1;justify-content:center}.readerHint{font-size:6px}}
    @media(max-width:460px){.meatDeskStats{grid-template-columns:1fr}.meatCard{grid-template-columns:92px minmax(0,1fr)}.meatCover{width:92px}.meatKicker{font-size:6.5px}.meatTitle{font-size:11px}.meatMeta,.meatUse{font-size:7.5px}.meatFacts{grid-template-columns:1fr}.readerStage{min-height:380px}.readerPage{min-height:340px}}
  `;
  d.head.appendChild(s);
}

function ensurePdfJs(d){
  const w=d?.defaultView;
  if(w?.pdfjsLib){w.pdfjsLib.GlobalWorkerOptions.workerSrc=PDFJS_WORKER;return Promise.resolve(w.pdfjsLib)}
  if(pdfJsPromise)return pdfJsPromise;
  pdfJsPromise=new Promise((resolve,reject)=>{
    let script=d.getElementById('meatDeskPdfJs');
    const ready=()=>{
      const lib=d.defaultView?.pdfjsLib;
      if(!lib){reject(new Error('PDF renderer unavailable'));return}
      lib.GlobalWorkerOptions.workerSrc=PDFJS_WORKER;resolve(lib);
    };
    if(script){script.addEventListener('load',ready,{once:true});script.addEventListener('error',()=>reject(new Error('PDF renderer load failed')),{once:true});return}
    script=d.createElement('script');script.id='meatDeskPdfJs';script.src=PDFJS_SRC;script.async=true;script.onload=ready;script.onerror=()=>reject(new Error('PDF renderer load failed'));d.head.appendChild(script);
  });
  return pdfJsPromise;
}
function loadPdf(d,item){
  const path=sourcePath(item);if(!path)return Promise.reject(new Error('Missing PDF path'));
  if(pdfCache.has(path))return pdfCache.get(path);
  const promise=ensurePdfJs(d).then(lib=>lib.getDocument({url:path}).promise).catch(err=>{pdfCache.delete(path);throw err});
  pdfCache.set(path,promise);return promise;
}
async function renderPdfPage(pdf,pageNumber,canvas,zoom=1){
  if(!pdf||!canvas||!pageNumber||pageNumber<1||pageNumber>pdf.numPages)return;
  const page=await pdf.getPage(pageNumber),base=page.getViewport({scale:1});
  const holder=canvas.parentElement;
  const available=Math.max(160,(holder?.clientWidth||420)-8);
  const cssScale=Math.max(.18,Math.min(2.2,(available/base.width)*zoom));
  const dpr=Math.min(2,holder?.ownerDocument?.defaultView?.devicePixelRatio||1);
  const viewport=page.getViewport({scale:cssScale*dpr});
  canvas.width=Math.floor(viewport.width);canvas.height=Math.floor(viewport.height);
  canvas.style.width=`${Math.floor(viewport.width/dpr)}px`;canvas.style.height=`${Math.floor(viewport.height/dpr)}px`;
  const ctx=canvas.getContext('2d',{alpha:false});ctx.save();ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.restore();
  await page.render({canvasContext:ctx,viewport}).promise;
}
async function loadCover(d,item,cover){
  if(!cover||cover.dataset.coverState==='loading'||cover.dataset.coverState==='ready')return;
  cover.dataset.coverState='loading';const status=cover.querySelector('.meatCoverStatus');if(status)status.textContent='COVER // RENDERING';
  try{
    const pdf=await loadPdf(d,item),canvas=cover.querySelector('canvas');
    await renderPdfPage(pdf,1,canvas,.92);
    cover.dataset.coverState='ready';cover.classList.add('ready');if(status)status.textContent=`${pdf.numPages} PAGES // READY`;
    const count=d.querySelector(`[data-page-count="${CSS.escape(String(item.id))}"]`);if(count)count.textContent=`${pdf.numPages} PAGES`;
  }catch(err){
    cover.dataset.coverState='error';if(status)status.textContent='COVER // FALLBACK';
  }
}
function hydrateCovers(d,p){
  if(coverObserver)try{coverObserver.disconnect()}catch{}
  if('IntersectionObserver' in (d.defaultView||{})){
    coverObserver=new d.defaultView.IntersectionObserver(entries=>{
      entries.forEach(entry=>{
        if(!entry.isIntersecting)return;
        const cover=entry.target,item=sourceById(cover.dataset.sourceId);if(item)loadCover(d,item,cover);coverObserver.unobserve(cover);
      });
    },{root:null,rootMargin:'180px 0px',threshold:.02});
    p.querySelectorAll('.meatCover[data-source-id]').forEach(x=>coverObserver.observe(x));
  }else{
    p.querySelectorAll('.meatCover[data-source-id]').forEach(x=>{const item=sourceById(x.dataset.sourceId);if(item)loadCover(d,item,x)});
  }
}
function sourceCard(item){
  const title=esc(item.title||item.name||item.file||'UNTITLED SOURCE');
  const kicker=[item.publisher,item.format].filter(Boolean).join(' // ')||item.kind||'SOURCE PDF';
  const search=[item.title,item.publisher,item.format,item.kind,item.season,item.desk,...(item.tags||[])].filter(Boolean).join(' ').toLowerCase();
  const path=sourcePath(item);
  return `<article class="meatCard" data-meat-card="${esc(item.id)}" data-meat-desk="${esc(item.desk||'OTHER')}" data-meat-search="${esc(search)}">
    <div class="meatCover" data-source-id="${esc(item.id)}">
      <canvas class="meatCoverCanvas" aria-label="Cover preview for ${title}"></canvas>
      <div class="meatCoverFallback"><strong>${title}</strong><span>${esc(item.season||'REFERENCE')}</span></div>
      <div class="meatCoverStatus">COVER // QUEUED</div>
    </div>
    <div class="meatInfo">
      <div class="meatKicker">${esc(kicker)}</div>
      <div class="meatTitle">${title}</div>
      <div class="meatMeta">${esc(item.kind||'PDF')} // ${esc(item.season||'SEASON REFERENCE')}</div>
      <div class="meatTags">${sourceTags(item)}</div>
      <div class="meatUse">${esc(item.use||item.notes||'Source reference for the Meat Desk.')}</div>
      <div class="meatFacts">
        <div class="meatFact"><small>DESK</small><b>${esc(item.desk||'REFERENCE')}</b></div>
        <div class="meatFact"><small>FILE</small><b>${esc(formatBytes(item.bytes))}</b></div>
        <div class="meatFact"><small>LENGTH</small><b data-page-count="${esc(item.id)}">CHECKING…</b></div>
      </div>
      <div class="meatActions">
        <button type="button" class="meatAction primary" data-meat-read="${esc(item.id)}">READ DESK COPY</button>
        <button type="button" class="meatAction" data-meat-details="${esc(item.id)}">SOURCE INFO</button>
      </div>
      <div class="meatDetails">STATUS: ${esc(item.status||'UNREVIEWED')}<br>FILE: ${esc(item.file||'—')}<br>${item.notes?`NOTE: ${esc(item.notes)}<br>`:''}${path?`<a class="readerNative" href="${esc(path)}" target="_blank" rel="noopener">OPEN ORIGINAL PDF</a>`:''}</div>
    </div>
  </article>`;
}
function shelfMarkup(sources){
  const totalBytes=sources.reduce((n,x)=>n+(Number(x.bytes)||0),0),football=sources.filter(x=>['NFL','CFB','FANTASY'].includes(String(x.desk||'').toUpperCase())).length;
  return `<div class="meatShelf">
    <div class="meatDeskHead"><div><h2>🥩 MEAT DESK // SOURCE LIBRARY 🥩</h2><p>SEASON GUIDES // MAGAZINES // BOOKS // PRESEASON REFERENCE // TAP A COVER TO READ</p></div><div class="meatDeskBadge">SOURCE-ONLY // READ BEFORE USE</div></div>
    <div class="meatDeskStats">
      <div class="meatDeskStat"><small>SOURCES ON FILE</small><b>${sources.length}</b><span>INDEXED DESK COPIES</span></div>
      <div class="meatDeskStat"><small>FOOTBALL SHELF</small><b>${football}</b><span>NFL / CFB / FANTASY</span></div>
      <div class="meatDeskStat"><small>LIBRARY SIZE</small><b>${esc(formatBytes(totalBytes))}</b><span>RAW PDF MATERIAL</span></div>
      <div class="meatDeskStat"><small>REVIEW STATE</small><b>UNREVIEWED</b><span>NO SOURCE CREATES A BET</span></div>
    </div>
    <div class="meatToolbar"><input class="meatSearch" data-meat-search-input type="search" placeholder="SEARCH THE MEAT DESK…" autocomplete="off"><div class="meatFilters"><button type="button" class="meatFilter active" data-meat-filter="ALL">ALL</button><button type="button" class="meatFilter" data-meat-filter="NFL">NFL</button><button type="button" class="meatFilter" data-meat-filter="CFB">CFB</button><button type="button" class="meatFilter" data-meat-filter="FANTASY">FANTASY</button><button type="button" class="meatFilter" data-meat-filter="RACING">RACING</button></div></div>
    ${sources.length?`<div class="meatGrid">${sources.map(sourceCard).join('')}</div>`:`<div class="meatEmpty"><b>NO DESK COPIES INDEXED.</b><br>UPLOAD PDFs TO <b>${esc(SOURCE_FOLDER)}</b>.</div>`}
  </div>`;
}
function readerMarkup(){
  return `<section class="meatReader" aria-label="Meat Desk book reader">
    <div class="meatReaderTop"><button type="button" class="readerBack" data-meat-back>← MEAT DESK</button><div class="readerTitleWrap"><div class="readerTitle" data-reader-title>SELECT A DESK COPY</div><div class="readerSub" data-reader-sub>BOOK READER // PAGE TURN MODE</div></div><a class="readerNative" data-reader-native target="_blank" rel="noopener">OPEN ORIGINAL PDF</a></div>
    <div class="readerStage"><div class="readerLoading">OPENING DESK COPY…</div><div class="readerBook"><div class="readerPage left"><canvas data-reader-canvas="left"></canvas><div class="readerPageNo" data-reader-page-left></div></div><div class="readerSpine"></div><div class="readerPage right"><canvas data-reader-canvas="right"></canvas><div class="readerPageNo" data-reader-page-right></div></div></div></div>
    <div class="readerControls"><button type="button" class="readerCtrl" data-reader-prev>◀ PREV</button><button type="button" class="readerCtrl" data-reader-next>NEXT ▶</button><div class="readerProgress"><span data-reader-position>PAGE —</span><input type="range" min="1" max="1" value="1" data-reader-slider><span data-reader-total>— PAGES</span></div><button type="button" class="readerCtrl" data-reader-zoom-out>ZOOM −</button><button type="button" class="readerCtrl" data-reader-zoom-in>ZOOM +</button><div class="readerZoom">VIEW <b data-reader-zoom>100%</b></div></div>
    <div class="readerHint">SWIPE OR USE ◀ / ▶ // COVER OPENS AS PAGE 1 // DESKTOP USES A TWO-PAGE SPREAD</div>
  </section>`;
}
function renderPanel(d){
  const tabs=d.querySelector('.runnerNavPad .tabs')||d.querySelector('.tabs');
  const nav=tabs?.parentElement;if(!nav)return;
  let p=d.getElementById(PANEL_ID);
  if(!p){p=d.createElement('section');p.id=PANEL_ID;p.setAttribute('aria-label','Meat Desk source library');nav.insertAdjacentElement('afterend',p)}
  const sources=Array.isArray(manifest?.sources)?manifest.sources:[];
  const renderKey=JSON.stringify([manifest?.updatedAt||'',sources]);
  if(p.dataset.renderKey===renderKey&&p.innerHTML)return;
  p.dataset.renderKey=renderKey;
  p.innerHTML=shelfMarkup(sources)+readerMarkup();
  bindPanel(d,p);hydrateCovers(d,p);
}
function isSingleReader(d){return (d.defaultView?.innerWidth||1000)<760}
function normalizeReaderPage(d,page){
  const pdf=readerState.pdf;if(!pdf)return 1;
  let p=Math.max(1,Math.min(pdf.numPages,Math.round(Number(page)||1)));
  if(!isSingleReader(d)&&p>1&&p%2===1)p-=1;
  return p;
}
function readerStep(d){return isSingleReader(d)?1:2}
function updateReaderControls(d){
  const p=d.getElementById(PANEL_ID),pdf=readerState.pdf;if(!p||!pdf)return;
  const page=normalizeReaderPage(d,readerState.page),single=isSingleReader(d),shownRight=!single&&page>1&&page+1<=pdf.numPages;
  readerState.page=page;
  const pos=p.querySelector('[data-reader-position]'),total=p.querySelector('[data-reader-total]'),slider=p.querySelector('[data-reader-slider]'),prev=p.querySelector('[data-reader-prev]'),next=p.querySelector('[data-reader-next]'),zoom=p.querySelector('[data-reader-zoom]');
  if(pos)pos.textContent=shownRight?`PAGES ${page}-${page+1}`:`PAGE ${page}`;
  if(total)total.textContent=`${pdf.numPages} PAGES`;
  if(slider){slider.max=String(pdf.numPages);slider.value=String(page)}
  if(prev)prev.disabled=page<=1;
  if(next)next.disabled=page>=pdf.numPages;
  if(zoom)zoom.textContent=`${Math.round(readerState.zoom*100)}%`;
}
async function renderReader(d){
  const p=d.getElementById(PANEL_ID),pdf=readerState.pdf;if(!p||!pdf)return;
  const token=++readerState.renderToken,stage=p.querySelector('.readerStage');stage?.classList.add('loading');
  const page=normalizeReaderPage(d,readerState.page),single=isSingleReader(d),leftCanvas=p.querySelector('[data-reader-canvas="left"]'),rightCanvas=p.querySelector('[data-reader-canvas="right"]'),leftBox=leftCanvas?.parentElement,rightBox=rightCanvas?.parentElement;
  const leftNo=p.querySelector('[data-reader-page-left]'),rightNo=p.querySelector('[data-reader-page-right]');
  if(leftBox)leftBox.classList.remove('blank');if(rightBox)rightBox.classList.remove('blank');
  try{
    await renderPdfPage(pdf,page,leftCanvas,readerState.zoom);
    if(token!==readerState.renderToken)return;
    if(leftNo)leftNo.textContent=String(page);
    if(!single&&page>1&&page+1<=pdf.numPages){
      await renderPdfPage(pdf,page+1,rightCanvas,readerState.zoom);if(rightNo)rightNo.textContent=String(page+1);
    }else{
      if(rightCanvas){rightCanvas.width=1;rightCanvas.height=1;rightCanvas.style.width='1px';rightCanvas.style.height='1px'}
      if(rightNo)rightNo.textContent='';if(rightBox)rightBox.classList.add('blank');
    }
    updateReaderControls(d);
  }catch(err){
    const loading=p.querySelector('.readerLoading');if(loading)loading.textContent='DESK COPY RENDER FAILED // OPEN ORIGINAL PDF';
  }finally{if(token===readerState.renderToken)stage?.classList.remove('loading')}
}
async function openReader(d,item){
  const p=d.getElementById(PANEL_ID),shelf=p?.querySelector('.meatShelf'),reader=p?.querySelector('.meatReader');if(!p||!reader||!item)return;
  shelf?.setAttribute('hidden','');reader.classList.add('open');readerState={item,pdf:null,page:1,zoom:1,renderToken:readerState.renderToken+1};
  const title=p.querySelector('[data-reader-title]'),sub=p.querySelector('[data-reader-sub]'),native=p.querySelector('[data-reader-native]'),stage=p.querySelector('.readerStage'),loading=p.querySelector('.readerLoading');
  if(title)title.textContent=item.title||item.file||'DESK COPY';if(sub)sub.textContent=[item.publisher,item.season,item.kind].filter(Boolean).join(' // ');
  if(native){native.href=sourcePath(item);native.style.display=sourcePath(item)?'inline-block':'none'}
  if(loading)loading.textContent='OPENING DESK COPY…';stage?.classList.add('loading');
  try{
    readerState.pdf=await loadPdf(d,item);readerState.page=1;readerState.zoom=1;
    await renderReader(d);
  }catch(err){if(loading)loading.textContent='PDF READER UNAVAILABLE // OPEN ORIGINAL PDF'}
  finally{if(readerState.pdf)stage?.classList.remove('loading')}
  try{d.defaultView?.scrollTo({top:0,left:0,behavior:'auto'})}catch{}
}
function closeReader(d){
  const p=d.getElementById(PANEL_ID);if(!p)return;
  readerState.renderToken++;readerState.item=null;readerState.pdf=null;
  p.querySelector('.meatReader')?.classList.remove('open');p.querySelector('.meatShelf')?.removeAttribute('hidden');
  try{d.defaultView?.scrollTo({top:0,left:0,behavior:'auto'})}catch{}
}
function turnReader(d,direction){
  const pdf=readerState.pdf;if(!pdf)return;
  const step=readerStep(d),current=normalizeReaderPage(d,readerState.page),next=direction>0?(current===1&&!isSingleReader(d)?2:current+step):(current<=2&&!isSingleReader(d)?1:current-step),target=normalizeReaderPage(d,next);
  if(target===current)return;
  const book=d.getElementById(PANEL_ID)?.querySelector('.readerBook');book?.classList.add(direction>0?'turnNext':'turnPrev');
  setTimeout(async()=>{readerState.page=target;await renderReader(d);book?.classList.remove('turnNext','turnPrev')},130);
}
function applyShelfFilter(p){
  const q=String(p.querySelector('[data-meat-search-input]')?.value||'').trim().toLowerCase(),active=p.querySelector('.meatFilter.active')?.dataset.meatFilter||'ALL';
  p.querySelectorAll('.meatCard').forEach(card=>{
    const desk=String(card.dataset.meatDesk||'OTHER').toUpperCase(),search=String(card.dataset.meatSearch||'');
    const deskMatch=active==='ALL'||desk===active||(active==='NFL'&&desk==='FANTASY');
    const textMatch=!q||search.includes(q);
    card.classList.toggle('hiddenByFilter',!(deskMatch&&textMatch));
  });
}
function bindPanel(d,p){
  if(p.dataset.bound==='1')return;p.dataset.bound='1';
  p.addEventListener('click',e=>{
    const filter=e.target.closest('[data-meat-filter]');if(filter){p.querySelectorAll('.meatFilter').forEach(x=>x.classList.toggle('active',x===filter));applyShelfFilter(p);return}
    const read=e.target.closest('[data-meat-read]');if(read){const item=sourceById(read.dataset.meatRead);if(item)openReader(d,item);return}
    const details=e.target.closest('[data-meat-details]');if(details){e.target.closest('.meatCard')?.classList.toggle('detailsOpen');return}
    if(e.target.closest('[data-meat-back]')){closeReader(d);return}
    if(e.target.closest('[data-reader-prev]')){turnReader(d,-1);return}
    if(e.target.closest('[data-reader-next]')){turnReader(d,1);return}
    if(e.target.closest('[data-reader-zoom-out]')){readerState.zoom=Math.max(.6,Math.round((readerState.zoom-.1)*10)/10);renderReader(d);return}
    if(e.target.closest('[data-reader-zoom-in]')){readerState.zoom=Math.min(2,Math.round((readerState.zoom+.1)*10)/10);renderReader(d);return}
  });
  p.addEventListener('input',e=>{
    if(e.target.matches('[data-meat-search-input]')){applyShelfFilter(p);return}
    if(e.target.matches('[data-reader-slider]')&&readerState.pdf){readerState.page=normalizeReaderPage(d,e.target.value);renderReader(d)}
  });
  let swipeX=null;
  const stage=p.querySelector('.readerStage');
  stage?.addEventListener('pointerdown',e=>{swipeX=e.clientX});
  stage?.addEventListener('pointerup',e=>{if(swipeX===null)return;const dx=e.clientX-swipeX;swipeX=null;if(Math.abs(dx)<55)return;turnReader(d,dx<0?1:-1)});
}
function setButtonCopy(d,b){
  const count=Array.isArray(manifest?.sources)?manifest.sources.length:null;
  const msg=count===null?'MEAT DESK SOURCE LIBRARY&nbsp;&nbsp; // &nbsp;&nbsp;PRESS [F6] TO OPEN':`${count} SOURCE${count===1?'':'S'} ON FILE&nbsp;&nbsp; // &nbsp;&nbsp;PRESS [F6] TO OPEN MEAT DESK`;
  const html=`<span class="f6Main"><b>[F6]</b>&nbsp; 🥩 LOAD MEAT DESK 🥩</span><span class="f6Message">${msg}</span>`;
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
    const walker=d.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
    while((node=walker.nextNode())){
      const next=String(node.nodeValue||'').replace(/F6 observes/g,'Preferences observes').replace(/F6 remains/g,'Preferences remains').replace(/\bF6\b/g,'[TAB] PREFERENCES');
      if(next!==node.nodeValue)node.nodeValue=next;
    }
  });
}
function closeMeatDesk(d,b){closeReader(d);d.body.classList.remove('runnerSeasonPreviewsLoaded');if(b){b.classList.remove('active');b.setAttribute('aria-pressed','false')}}
function bind(d,b,pref,tabs){
  if(b.dataset.bound!=='1'){
    b.dataset.bound='1';
    b.addEventListener('click',()=>{
      const open=!d.body.classList.contains('runnerSeasonPreviewsLoaded');
      d.body.classList.remove('runnerSyndicateLoaded','runnerPreferencesLoaded');pref?.classList.remove('active');
      d.body.classList.toggle('runnerSeasonPreviewsLoaded',open);b.classList.toggle('active',open);b.setAttribute('aria-pressed',String(open));
      if(open)renderPanel(d);else closeReader(d);
      try{d.defaultView?.scrollTo({top:0,left:0,behavior:'auto'})}catch{}
    });
  }
  if(pref&&pref.dataset.seasonPreviewBound!=='1'){pref.dataset.seasonPreviewBound='1';pref.addEventListener('click',()=>closeMeatDesk(d,b))}
  if(tabs.dataset.seasonPreviewBound!=='1'){tabs.dataset.seasonPreviewBound='1';tabs.addEventListener('click',e=>{const x=e.target.closest?.('.btn');if(x&&x!==b)closeMeatDesk(d,b)})}
  if(d.documentElement.dataset.seasonPreviewKeysBound!=='1'&&pref){
    d.documentElement.dataset.seasonPreviewKeysBound='1';
    d.addEventListener('keydown',e=>{
      const target=e.target;if(target?.closest?.('input,select,textarea,[contenteditable="true"]'))return;
      if(e.key==='F6'){e.preventDefault();b.click();return}
      if(e.key==='Tab'&&!d.body.classList.contains('runnerPreferencesLoaded')){e.preventDefault();pref.click();return}
      if(d.body.classList.contains('runnerSeasonPreviewsLoaded')&&readerState.pdf){
        if(e.key==='ArrowRight'){e.preventDefault();turnReader(d,1)}
        else if(e.key==='ArrowLeft'){e.preventDefault();turnReader(d,-1)}
        else if(e.key==='Escape'){e.preventDefault();closeReader(d)}
      }
    },true);
  }
  if(d.documentElement.dataset.seasonPreviewChangeBound!=='1'){d.documentElement.dataset.seasonPreviewChangeBound='1';d.addEventListener('change',()=>setTimeout(()=>setPreferenceCopy(d,pref),0))}
}
function ensureUi(d){
  if(!d?.body)return false;ensureStyle(d);
  const tabs=d.querySelector('.runnerNavPad .tabs')||d.querySelector('.tabs');if(!tabs)return false;
  const pref=d.getElementById(PREF_BUTTON_ID);if(!pref)return false;
  let b=d.getElementById(BUTTON_ID);if(!b){b=d.createElement('button');b.type='button';b.id=BUTTON_ID;b.className='btn';b.setAttribute('aria-pressed','false');tabs.appendChild(b)}
  setButtonCopy(d,b);setPreferenceCopy(d,pref);
  const f5=d.getElementById('runnerSyndicateF5');if(f5&&f5.nextElementSibling!==b)f5.insertAdjacentElement('afterend',b);else if(!f5&&b.parentElement!==tabs)tabs.appendChild(b);
  if(tabs.lastElementChild!==pref)tabs.appendChild(pref);
  renderPanel(d);patchLegacyPreferenceCopy(d);bind(d,b,pref,tabs);return true;
}
async function loadManifest(){
  if(manifestRequested)return;manifestRequested=true;
  try{const r=await fetch(`${MANIFEST_URL}?v=${Date.now()}`,{cache:'no-store'});if(r.ok)manifest=await r.json()}catch{}
  const d=appDoc();if(d)ensureUi(d);
}
function attach(){
  const d=appDoc();if(!d?.body)return false;
  if(d!==lastDoc){lastDoc=d;if(observer)observer.disconnect();observer=new MutationObserver(()=>requestAnimationFrame(()=>ensureUi(d)));observer.observe(d.body,{subtree:true,childList:true})}
  ensureUi(d);loadManifest();return true;
}

let tries=0;const timer=setInterval(()=>{tries++;if(attach()||tries>200)clearInterval(timer)},100);
setInterval(()=>{const d=appDoc();if(d)ensureUi(d)},1200);
})();
