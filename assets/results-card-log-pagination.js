(()=>{
'use strict';

const INDEX_URL='./data/history/results-index.json';
const STYLE_ID='resultsCardLogPaginationStyle';
let cached=null;
let pageSize=10;
let page=0;
let lastScope='cards';
let lastStatus='ALL';
let loading=false;
let applying=false;

function appDoc(){
  try{
    const core=document.getElementById('core');
    const app=core?.contentDocument?.getElementById('app');
    return app?.contentDocument||null;
  }catch{return null}
}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function signed(v,d=2){const n=Number(v);return Number.isFinite(n)?`${n>0?'+':''}${n.toFixed(d)}`:'—'}
function dateLabel(v){
  if(!v)return '—';
  const d=new Date(`${String(v).slice(0,10)}T12:00:00Z`);
  return Number.isFinite(d.getTime())?new Intl.DateTimeFormat('en-CA',{month:'short',day:'numeric'}).format(d):String(v);
}
function slotLabel(v){return ({open:'OPEN',main:'MAIN',final_morning:'FINAL',evening:'EVENING',late:'LATE'})[v]||String(v||'—').toUpperCase()}
function gradeClass(g){g=String(g||'').toUpperCase();return g.includes('WIN')?'rWin':g.includes('LOSS')?'rLoss':g==='PUSH'||g==='VOID'?'rPush':'rOpen'}
function statusClass(s){return `rStatus ${String(s||'pass').toLowerCase()}`}
function exactPrice(c){
  const a=Number(c?.analysisPrice?.american);
  if(c?.analysisPrice?.state==='exact'&&Number.isFinite(a))return `${a>0?'+':''}${a}`;
  return String(c?.issuedPriceText||'—');
}
function latestSelectionRun(s){
  const timeline=Array.isArray(s?.timeline)?s.timeline:[];
  return timeline.reduce((latest,row)=>String(row?.runId||'').localeCompare(latest)>0?String(row.runId):latest,'');
}
function currentState(d){
  return {
    scope:d.querySelector('[data-results-scope].active')?.dataset.resultsScope||'cards',
    status:d.querySelector('[data-results-status].active')?.dataset.resultsStatus||'ALL'
  };
}
function rowsFor(scope,status){
  if(scope==='unique'){
    const rows=Array.isArray(cached?.selections)?cached.selections:[];
    return rows
      .filter(s=>status==='ALL'||(s.statusPath||[]).includes(status))
      .slice()
      .sort((a,b)=>latestSelectionRun(b).localeCompare(latestSelectionRun(a))||String(a.title||'').localeCompare(String(b.title||'')));
  }
  const rows=Array.isArray(cached?.cards)?cached.cards:[];
  return rows
    .filter(c=>status==='ALL'||c.status===status)
    .slice()
    .sort((a,b)=>String(b.runId||'').localeCompare(String(a.runId||'')));
}
function findDetailBox(d){
  const boxes=[...d.querySelectorAll('#engine.resultsDesk .resultsBox.full')];
  return boxes.find(box=>{
    const title=String(box.querySelector('.resultsSection')?.textContent||'').trim();
    return title==='ISSUED CARD LOG'||title==='UNIQUE SELECTION LOG';
  })||null;
}
function ensureStyle(d){
  if(d.getElementById(STYLE_ID))return;
  const s=d.createElement('style');
  s.id=STYLE_ID;
  s.textContent=`
    #engine.resultsDesk .cardLogToolbar{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:8px;align-items:center;margin-top:9px;margin-bottom:4px}
    #engine.resultsDesk .cardLogLimit,#engine.resultsDesk .cardLogPager{display:flex;gap:5px;align-items:center;flex-wrap:wrap}
    #engine.resultsDesk .cardLogLabel,#engine.resultsDesk .cardLogSummary,#engine.resultsDesk .cardLogPage{color:var(--results-soft);font-size:8px;font-weight:900;letter-spacing:.06em;line-height:1.4}
    #engine.resultsDesk .cardLogSummary{text-align:center;white-space:nowrap}
    #engine.resultsDesk .cardLogPager{justify-content:flex-end}
    #engine.resultsDesk .cardLogCtl{min-width:34px;padding:6px 8px}
    #engine.resultsDesk .cardLogCtl[disabled]{opacity:.35;cursor:default}
    @media(max-width:760px){
      #engine.resultsDesk .cardLogToolbar{grid-template-columns:1fr}
      #engine.resultsDesk .cardLogSummary{text-align:left;white-space:normal}
      #engine.resultsDesk .cardLogPager{justify-content:flex-start}
    }
  `;
  d.head.appendChild(s);
}
function tableHtml(scope,list){
  if(scope==='unique'){
    return `<div class="resultsScroll"><table><thead><tr><th>SELECTION</th><th>SPORT</th><th>MARKET</th><th>STATUS PATH</th><th>RESULT</th><th>APPEARANCES</th></tr></thead><tbody>${list.map(s=>`<tr><td>${esc(s.title)}</td><td>${esc(s.sport)}</td><td>${esc(s.market)}</td><td>${esc((s.statusPath||[]).join(' → '))}</td><td class="${gradeClass(s.grade)}">${esc(s.grade||'OPEN')}</td><td>${Number(s.timeline?.length||0)}</td></tr>`).join('')}</tbody></table></div>`;
  }
  return `<div class="resultsScroll"><table><thead><tr><th>DATE / LANE</th><th>CARD</th><th>STATUS</th><th>PRICE</th><th>RESULT</th><th>u</th></tr></thead><tbody>${list.map(c=>`<tr><td>${esc(dateLabel(c.date))} / ${esc(slotLabel(c.slot))}</td><td>${esc(c.title)}</td><td class="${statusClass(c.status)}">${esc(c.status)}</td><td>${esc(exactPrice(c))}</td><td class="${gradeClass(c.grade)}">${esc(c.grade||'OPEN')}</td><td>${c.units===null||c.units===undefined?'—':esc(signed(c.units,2))}</td></tr>`).join('')}</tbody></table></div>`;
}
function apply(d){
  if(applying||!cached)return false;
  const box=findDetailBox(d);
  if(!box)return false;
  ensureStyle(d);

  const next=currentState(d);
  if(next.scope!==lastScope||next.status!==lastStatus){
    page=0;
    lastScope=next.scope;
    lastStatus=next.status;
  }
  const rows=rowsFor(next.scope,next.status);
  const size=pageSize==='ALL'?Math.max(rows.length,1):Number(pageSize);
  const totalPages=pageSize==='ALL'?1:Math.max(1,Math.ceil(rows.length/size));
  page=Math.min(Math.max(0,page),totalPages-1);
  const start=rows.length?page*size:0;
  const end=pageSize==='ALL'?rows.length:Math.min(rows.length,start+size);
  const visible=rows.slice(start,end);
  const signature=[cached.generatedAt,next.scope,next.status,pageSize,page,rows.length].join('|');
  if(box.dataset.cardLogSignature===signature)return true;

  applying=true;
  try{
    const noun=next.scope==='cards'?'ISSUED CARDS':'UNIQUE SELECTIONS';
    box.dataset.cardLogSignature=signature;
    box.innerHTML=`
      <div class="resultsSection">${next.scope==='cards'?'ISSUED CARD LOG':'UNIQUE SELECTION LOG'}</div>
      <div class="resultsNote">${next.scope==='cards'?'Each report appearance is preserved.':'Exact selectionKey is deduplicated; status path shows how the card evolved across lanes.'}</div>
      <div class="cardLogToolbar">
        <div class="cardLogLimit"><span class="cardLogLabel">SHOW:</span>${[10,25,50,100,'ALL'].map(x=>`<button type="button" class="resultsCtl cardLogCtl ${String(pageSize)===String(x)?'active':''}" data-card-log-size="${x}">${x}</button>`).join('')}</div>
        <div class="cardLogSummary">${rows.length?`SHOWING ${start+1}–${end} OF ${rows.length} ${noun}`:`0 ${noun}`}</div>
        <div class="cardLogPager"><button type="button" class="resultsCtl cardLogCtl" data-card-log-prev ${page<=0?'disabled':''}>PREV</button><span class="cardLogPage">PAGE ${rows.length?page+1:0} OF ${rows.length?totalPages:0}</span><button type="button" class="resultsCtl cardLogCtl" data-card-log-next ${page>=totalPages-1||!rows.length?'disabled':''}>NEXT</button></div>
      </div>
      ${visible.length?tableHtml(next.scope,visible):'<div class="resultsEmpty">NO MATCHING LOG ITEMS.</div>'}
    `;
    box.querySelectorAll('[data-card-log-size]').forEach(button=>button.addEventListener('click',()=>{
      pageSize=button.dataset.cardLogSize==='ALL'?'ALL':Number(button.dataset.cardLogSize)||10;
      page=0;
      box.dataset.cardLogSignature='';
      apply(d);
    }));
    box.querySelector('[data-card-log-prev]')?.addEventListener('click',()=>{
      if(page>0){page-=1;box.dataset.cardLogSignature='';apply(d)}
    });
    box.querySelector('[data-card-log-next]')?.addEventListener('click',()=>{
      if(page<totalPages-1){page+=1;box.dataset.cardLogSignature='';apply(d)}
    });
    return true;
  }finally{
    applying=false;
  }
}
async function load(){
  if(loading)return;
  loading=true;
  try{
    const r=await fetch(`${INDEX_URL}?v=${Date.now()}`,{cache:'no-store'});
    if(r.ok)cached=await r.json();
  }catch{}
  loading=false;
}
function tick(){const d=appDoc();if(d)apply(d)}

load().then(tick);
setInterval(tick,150);
setInterval(()=>load().then(tick),60000);
})();
