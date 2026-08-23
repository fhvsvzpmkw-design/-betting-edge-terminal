(()=>{
'use strict';

const STYLE_ID='runnerResultsDeskStyle';
const INSTALLED='resultsDeskInstalled';
const INDEX_URL='./data/history/results-index.json';
const ACCENT='#7aa6c2';
const ACCENT_SOFT='#9bb7ca';
let cached=null;
let state={scope:'cards',status:'ALL'};

function appDoc(){
  try{
    const core=document.getElementById('core');
    const app=core?.contentDocument?.getElementById('app');
    return app?.contentDocument||null;
  }catch{return null}
}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function signed(v,d=2){const n=Number(v);return Number.isFinite(n)?`${n>0?'+':''}${n.toFixed(d)}`:'—'}
function pct(v){const n=Number(v);return Number.isFinite(n)?`${n>0?'+':''}${n.toFixed(2)}%`:'—'}
function grades(row){const g=row?.grades||{};return `${Number(g.WIN||0)}-${Number(g.LOSS||0)}`+(Number(g.PUSH||0)?`-${Number(g.PUSH)}P`:'')+(Number(g.HALF_WIN||0)?` / ${Number(g.HALF_WIN)} HW`:'')+(Number(g.HALF_LOSS||0)?` / ${Number(g.HALF_LOSS)} HL`:'')}
function dateLabel(v){
  if(!v)return '—';
  const d=new Date(`${String(v).slice(0,10)}T12:00:00Z`);
  return Number.isFinite(d.getTime())?new Intl.DateTimeFormat('en-CA',{month:'short',day:'numeric'}).format(d):String(v);
}
function slotLabel(v){return ({open:'OPEN',main:'MAIN',final_morning:'FINAL',evening:'EVENING',late:'LATE'})[v]||String(v||'—').toUpperCase()}
function gradeClass(g){g=String(g||'').toUpperCase();return g.includes('WIN')?'rWin':g.includes('LOSS')?'rLoss':g==='PUSH'||g==='VOID'?'rPush':'rOpen'}
function statusClass(s){return `rStatus ${String(s||'pass').toLowerCase()}`}

function ensureStyle(d){
  if(d.getElementById(STYLE_ID))return;
  const s=d.createElement('style');
  s.id=STYLE_ID;
  s.textContent=`
    :root{--results-accent:${ACCENT};--results-soft:${ACCENT_SOFT}}
    body.runnerMenuHome .runnerNavPad .tabs>.btn[data-view="engine"],
    body.runnerPrimaryViewLoaded[data-primary-view="engine"] .runnerNavPad .tabs>.btn.primaryShellActive{border-color:var(--results-accent)!important;color:var(--results-accent)!important;background:#071019!important;box-shadow:inset 0 0 0 1px rgba(122,166,194,.08),0 0 10px rgba(122,166,194,.10)!important;text-shadow:0 0 6px rgba(122,166,194,.18)!important}
    body.runnerMenuHome .runnerNavPad .tabs>.btn[data-view="engine"] .primaryMenuMessage,
    body.runnerPrimaryViewLoaded[data-primary-view="engine"] .primaryShellMessage{color:var(--results-soft)!important}
    #engine.resultsDesk{--rline:#24445a;--rpanel:#07111b;--rpanel2:#091824;color:var(--text)}
    #engine.resultsDesk .resultsHero{border:2px solid var(--results-accent);background:linear-gradient(180deg,#091521,#050c13);padding:12px;box-shadow:0 0 18px rgba(122,166,194,.08)}
    #engine.resultsDesk .resultsTitle{color:var(--results-accent);font-weight:950;letter-spacing:.09em;font-size:14px}
    #engine.resultsDesk .resultsSub{color:var(--results-soft);font-size:10px;margin-top:5px;line-height:1.45}
    #engine.resultsDesk .resultsStats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px;margin-top:10px}
    #engine.resultsDesk .resultsStat{border:1px solid var(--rline);background:#030a11;padding:9px;min-height:70px}
    #engine.resultsDesk .resultsStat .key{color:var(--results-soft)}
    #engine.resultsDesk .resultsStat b{display:block;color:var(--results-accent);font-size:20px;margin-top:5px}
    #engine.resultsDesk .resultsControls{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}
    #engine.resultsDesk .resultsCtl{font:inherit;font-weight:900;cursor:pointer;border:1px solid var(--results-accent);color:var(--results-accent);background:#06101a;padding:7px 9px}
    #engine.resultsDesk .resultsCtl.active{background:var(--results-accent);color:#06101a}
    #engine.resultsDesk .resultsGrid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:9px}
    #engine.resultsDesk .resultsBox{border:1px solid var(--rline);background:var(--rpanel);padding:10px}
    #engine.resultsDesk .resultsBox.full{grid-column:1/-1}
    #engine.resultsDesk .resultsSection{color:var(--results-accent);font-weight:950;letter-spacing:.07em;font-size:11px}
    #engine.resultsDesk .resultsNote{color:var(--results-soft);font-size:9px;margin-top:4px;line-height:1.4}
    #engine.resultsDesk table{width:100%;border-collapse:collapse;margin-top:7px}
    #engine.resultsDesk th,#engine.resultsDesk td{padding:7px 6px;border-top:1px dotted var(--rline);text-align:left;font-size:10px;vertical-align:top}
    #engine.resultsDesk th{color:var(--results-soft);font-size:8px;letter-spacing:.07em}
    #engine.resultsDesk .rStatus{font-weight:950}
    #engine.resultsDesk .rStatus.bet,#engine.resultsDesk .rWin{color:var(--green)}
    #engine.resultsDesk .rStatus.lean{color:var(--yellow)}
    #engine.resultsDesk .rStatus.wait{color:var(--cyan)}
    #engine.resultsDesk .rStatus.pass{color:var(--muted)}
    #engine.resultsDesk .rLoss{color:var(--red)}
    #engine.resultsDesk .rPush{color:var(--yellow)}
    #engine.resultsDesk .rOpen{color:var(--results-soft)}
    #engine.resultsDesk .resultsRoi{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin-top:8px}
    #engine.resultsDesk .resultsRoi>div{border:1px solid var(--rline);background:#030a11;padding:9px}
    #engine.resultsDesk .resultsRoi b{display:block;color:var(--results-accent);font-size:18px;margin-top:4px}
    #engine.resultsDesk .resultsScroll{overflow-x:auto}
    #engine.resultsDesk .resultsEmpty{padding:12px;border:1px dashed var(--results-accent);color:var(--results-soft);margin-top:8px}
    #engine.resultsDesk .resultsReason{color:#c8a96b}
    #engine.resultsDesk .resultsFoot{margin-top:9px;color:var(--results-soft);font-size:9px;line-height:1.45}
    @media(max-width:900px){#engine.resultsDesk .resultsStats{grid-template-columns:repeat(3,minmax(0,1fr))}#engine.resultsDesk .resultsRoi{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
    @media(max-width:650px){#engine.resultsDesk .resultsStats{grid-template-columns:repeat(2,minmax(0,1fr))}#engine.resultsDesk .resultsGrid{grid-template-columns:1fr!important}#engine.resultsDesk .resultsBox.full{grid-column:auto!important}#engine.resultsDesk th,#engine.resultsDesk td{font-size:9px;padding:6px 5px}}
  `;
  d.head.appendChild(s);
}

function patchF8(d){
  const b=d.querySelector('.runnerNavPad .tabs>.btn[data-view="engine"]')||d.querySelector('.tabs>.btn[data-view="engine"]');
  if(!b)return;
  const shell=d.body.classList.contains('runnerPrimaryViewLoaded')&&d.body.dataset.primaryView==='engine';
  const menu=d.body.classList.contains('runnerMenuHome');
  const desired=shell
    ? '<span class="primaryShellMain"><b>[F8]</b>&nbsp; 🧠 RESULTS 🧠</span><span class="primaryShellMessage">PERFORMANCE + CALIBRATION&nbsp;&nbsp; // &nbsp;&nbsp;PRESS [F8] TO RETURN TO MENU</span>'
    : '<span class="primaryMenuMain"><b>[F8]</b>&nbsp; 🧠 RESULTS 🧠</span><span class="primaryMenuMessage">PERFORMANCE + CALIBRATION&nbsp;&nbsp; // &nbsp;&nbsp;PRESS [F8] TO OPEN</span>';
  if((menu||shell)&&b.innerHTML!==desired)b.innerHTML=desired;
}

function rowTable(rows,label){
  if(!rows?.length)return '<div class="resultsEmpty">NO DATA YET</div>';
  return `<div class="resultsScroll"><table><thead><tr><th>${label}</th><th>CLOSED</th><th>W-L</th><th>OPEN</th><th>ROI</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.name)}</td><td>${Number(r.complete||0)}</td><td>${esc(grades(r))}</td><td>${Number(r.unresolved||0)}</td><td>${esc(pct(r.roiPct))}</td></tr>`).join('')}</tbody></table></div>`;
}
function filteredCards(index){
  const cards=Array.isArray(index.cards)?index.cards:[];
  return cards.filter(c=>state.status==='ALL'||c.status===state.status).slice().sort((a,b)=>String(b.runId||'').localeCompare(String(a.runId||'')));
}
function filteredSelections(index){
  const selections=Array.isArray(index.selections)?index.selections:[];
  if(state.status==='ALL')return selections;
  return selections.filter(s=>(s.statusPath||[]).includes(state.status));
}
function detailRows(index){
  if(state.scope==='unique'){
    const list=filteredSelections(index).slice(0,35);
    if(!list.length)return '<div class="resultsEmpty">UNIQUE-SELECTION DETAIL WILL APPEAR AFTER THE INDEX BUILDER COMPLETES.</div>';
    return `<div class="resultsScroll"><table><thead><tr><th>SELECTION</th><th>SPORT</th><th>MARKET</th><th>STATUS PATH</th><th>RESULT</th><th>APPEARANCES</th></tr></thead><tbody>${list.map(s=>`<tr><td>${esc(s.title)}</td><td>${esc(s.sport)}</td><td>${esc(s.market)}</td><td>${esc((s.statusPath||[]).join(' → '))}</td><td class="${gradeClass(s.grade)}">${esc(s.grade||'OPEN')}</td><td>${Number(s.timeline?.length||0)}</td></tr>`).join('')}</tbody></table></div>`;
  }
  const list=filteredCards(index).slice(0,45);
  if(!list.length)return '<div class="resultsEmpty">CARD DETAIL WILL APPEAR AFTER THE INDEX BUILDER COMPLETES.</div>';
  return `<div class="resultsScroll"><table><thead><tr><th>DATE / LANE</th><th>CARD</th><th>STATUS</th><th>PRICE</th><th>RESULT</th><th>u</th></tr></thead><tbody>${list.map(c=>`<tr><td>${esc(dateLabel(c.date))} / ${esc(slotLabel(c.slot))}</td><td>${esc(c.title)}</td><td class="${statusClass(c.status)}">${esc(c.status)}</td><td>${esc(c.analysisPrice?.state==='exact'?(c.analysisPrice.american>0?'+':'')+c.analysisPrice.american:c.issuedPriceText||'—')}</td><td class="${gradeClass(c.grade)}">${esc(c.grade||'OPEN')}</td><td>${c.units===null||c.units===undefined?'—':esc(signed(c.units,2))}</td></tr>`).join('')}</tbody></table></div>`;
}
function unresolvedRows(index){
  const rows=Array.isArray(index.unresolved)?index.unresolved:[];
  const unique=new Map();
  rows.forEach(r=>{const k=r.selectionKey||r.eventId||r.title;if(!unique.has(k))unique.set(k,r)});
  const list=[...unique.values()].slice(0,40);
  if(!list.length&&Array.isArray(index.unresolvedEvents)){
    return `<div class="resultsScroll"><table><thead><tr><th>OPEN EVENT</th><th>CARDS</th></tr></thead><tbody>${index.unresolvedEvents.map(e=>`<tr><td>${esc((e.titles||[]).join(' / '))}</td><td>${Number(e.unresolvedCards||e.cards||0)}</td></tr>`).join('')}</tbody></table></div>`;
  }
  if(!list.length)return '<div class="resultsEmpty">NO UNRESOLVED ITEMS.</div>';
  return `<div class="resultsScroll"><table><thead><tr><th>DATE</th><th>ITEM</th><th>STATUS</th><th>REASON</th></tr></thead><tbody>${list.map(r=>`<tr><td>${esc(dateLabel(r.date))}</td><td>${esc(r.title)}</td><td class="${statusClass(r.status)}">${esc(r.status||'—')}</td><td class="resultsReason">${esc(String(r.reason||'unresolved').replaceAll('_',' '))}</td></tr>`).join('')}</tbody></table></div>`;
}
function statusRow(index,name){return (index.byStatus||[]).find(x=>x.name===name)||{name,issued:0,complete:0,unresolved:0,grades:{},priced:0,netUnits:0,roiPct:null}}

function render(d,index){
  const engine=d.getElementById('engine');
  if(!engine)return;
  cached=index;
  engine.classList.add('resultsDesk');
  const c=index.coverage||{},pa=index.priceAnalytics||{};
  const bet=statusRow(index,'BET'),pass=statusRow(index,'PASS'),wait=statusRow(index,'WAIT'),lean=statusRow(index,'LEAN');
  engine.innerHTML=`
    <div class="resultsHero">
      <div class="resultsTitle">BETTING EDGE // RESULTS DESK</div>
      <div class="resultsSub">Outcome audit and engine calibration. Official BET performance remains separate from hypothetical LEAN / WAIT / PASS observations.</div>
      <div class="resultsStats">
        <div class="resultsStat"><div class="key">EVENTS</div><b>${Number(c.events||0)}</b></div>
        <div class="resultsStat"><div class="key">SELECTIONS</div><b>${Number(c.selections||0)}</b></div>
        <div class="resultsStat"><div class="key">CARDS</div><b>${Number(c.cards||0)}</b></div>
        <div class="resultsStat"><div class="key">CLOSED</div><b>${Number(c.completeCards||0)}</b></div>
        <div class="resultsStat"><div class="key">OPEN EVENTS</div><b>${Number(c.unresolvedEvents||0)}</b></div>
      </div>
      <div class="resultsControls">
        <button class="resultsCtl ${state.scope==='cards'?'active':''}" data-results-scope="cards">CARDS</button>
        <button class="resultsCtl ${state.scope==='unique'?'active':''}" data-results-scope="unique">UNIQUE</button>
        ${['ALL','BET','LEAN','WAIT','PASS'].map(x=>`<button class="resultsCtl ${state.status===x?'active':''}" data-results-status="${x}">${x}</button>`).join('')}
      </div>
    </div>
    <div class="resultsGrid">
      <div class="resultsBox full">
        <div class="resultsSection">PRICE-ADJUSTED SNAPSHOT</div>
        <div class="resultsNote">Flat 1-unit risk per price-resolvable completed card. The immutable sidecars remain authority; this index is rebuildable presentation/analytics.</div>
        <div class="resultsRoi">
          <div><div class="key">PRICED CARDS</div><b>${Number(pa.pricedCards||0)}</b></div>
          <div><div class="key">NET UNITS</div><b>${esc(signed(pa.netUnits,2))}u</b></div>
          <div><div class="key">ROI</div><b>${esc(pct(pa.roiPct))}</b></div>
          <div><div class="key">OFFICIAL BETS</div><b>${Number(bet.complete||0)}</b></div>
        </div>
      </div>
      <div class="resultsBox"><div class="resultsSection">STATUS PERFORMANCE</div><div class="resultsNote">PASS ${grades(pass)} · WAIT ${grades(wait)} · LEAN ${grades(lean)}</div>${rowTable([bet,lean,wait,pass],'STATUS')}</div>
      <div class="resultsBox"><div class="resultsSection">BY MARKET</div><div class="resultsNote">Exact issued market identity; quarter-line settlements are supported.</div>${rowTable(index.byMarket||[],'MARKET')}</div>
      <div class="resultsBox"><div class="resultsSection">BY SPORT</div><div class="resultsNote">Direction alone is not profitability; use ROI alongside W-L.</div>${rowTable(index.bySport||[],'SPORT')}</div>
      <div class="resultsBox"><div class="resultsSection">BY REPORT LANE</div><div class="resultsNote">Repeated selections remain separate in CARDS mode.</div>${rowTable(index.byLane||[],'LANE')}</div>
      <div class="resultsBox full"><div class="resultsSection">${state.scope==='cards'?'ISSUED CARD LOG':'UNIQUE SELECTION LOG'}</div><div class="resultsNote">${state.scope==='cards'?'Each report appearance is preserved.':'Exact selectionKey is deduplicated; status path shows how the card evolved across lanes.'}</div>${detailRows(index)}</div>
      <div class="resultsBox full"><div class="resultsSection">OPEN / UNRESOLVED</div><div class="resultsNote">Unresolved means not safely verified yet, not a loss. Closure retry metadata remains in the observation sidecars.</div>${unresolvedRows(index)}</div>
    </div>
    <div class="resultsFoot">INDEX GENERATED ${esc(index.generatedAt||'—')} // SOURCE THROUGH ${esc(c.lastDate||'—')} // RESULTS INDEX IS NON-AUTHORITATIVE AND MAY BE REBUILT FROM IMMUTABLE RUNS + OBSERVATIONS.</div>
  `;
  engine.querySelectorAll('[data-results-scope]').forEach(b=>b.addEventListener('click',()=>{state.scope=b.dataset.resultsScope;render(d,cached)}));
  engine.querySelectorAll('[data-results-status]').forEach(b=>b.addEventListener('click',()=>{state.status=b.dataset.resultsStatus;render(d,cached)}));
}

async function load(d){
  const engine=d.getElementById('engine');
  if(!engine)return;
  engine.classList.add('resultsDesk');
  engine.innerHTML='<div class="resultsHero"><div class="resultsTitle">BETTING EDGE // RESULTS DESK</div><div class="resultsSub">LOADING RESULTS INDEX…</div></div>';
  try{
    const r=await fetch(`${INDEX_URL}?v=${Date.now()}`,{cache:'no-store'});
    if(!r.ok)throw new Error(`HTTP ${r.status}`);
    render(d,await r.json());
  }catch(e){
    engine.innerHTML=`<div class="resultsHero"><div class="resultsTitle">BETTING EDGE // RESULTS DESK</div><div class="resultsSub">RESULTS INDEX UNAVAILABLE // ${esc(e.message||e)}</div></div>`;
  }
}
function install(d){
  if(!d?.body)return false;
  ensureStyle(d);
  patchF8(d);
  const engine=d.getElementById('engine');
  if(!engine)return false;
  if(engine.dataset[INSTALLED]!=='1'){
    engine.dataset[INSTALLED]='1';
    load(d);
  }
  if(d.documentElement.dataset.resultsDeskObserver!=='1'){
    d.documentElement.dataset.resultsDeskObserver='1';
    const obs=new MutationObserver(()=>patchF8(d));
    obs.observe(d.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','data-primary-view']});
  }
  return true;
}

let tries=0;
const timer=setInterval(()=>{
  tries+=1;
  const d=appDoc();
  if(d&&install(d))clearInterval(timer);
  if(tries>250)clearInterval(timer);
},40);
setInterval(()=>{const d=appDoc();if(d)install(d)},700);
})();
