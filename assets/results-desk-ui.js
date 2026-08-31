(()=>{
'use strict';

const STYLE_ID='runnerResultsDeskStyle';
const INSTALLED='resultsDeskInstalled';
const INDEX_URL='./data/history/results-index.json';
const ACCENT='#39e7ff';
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
function money(v){const n=Number(v);if(!Number.isFinite(n))return '—';const sign=n>0?'+':n<0?'-':'';return `${sign}$${Math.abs(n).toFixed(2)}`}
function grades(row){const g=row?.grades||{};return `${Number(g.WIN||0)}-${Number(g.LOSS||0)}`+(Number(g.PUSH||0)?`-${Number(g.PUSH)}P`:'')+(Number(g.HALF_WIN||0)?` / ${Number(g.HALF_WIN)} HW`:'')+(Number(g.HALF_LOSS||0)?` / ${Number(g.HALF_LOSS)} HL`:'')}
function dateLabel(v){
  if(!v)return '—';
  const d=new Date(`${String(v).slice(0,10)}T12:00:00Z`);
  return Number.isFinite(d.getTime())?new Intl.DateTimeFormat('en-CA',{month:'short',day:'numeric'}).format(d):String(v);
}
function slotLabel(v){return ({open:'OPEN',main:'MAIN',final_morning:'FINAL',evening:'EVENING',late:'LATE'})[v]||String(v||'—').toUpperCase()}
function gradeClass(g){g=String(g||'').toUpperCase();return g.includes('WIN')?'rWin':g.includes('LOSS')?'rLoss':g==='PUSH'||g==='VOID'?'rPush':'rOpen'}
function statusClass(s){return `rStatus ${String(s||'pass').toLowerCase()}`}
function valueClass(v){const n=Number(v);return !Number.isFinite(n)?'neutral':n>0?'positive':n<0?'negative':'neutral'}
function parseBankrollText(v){
  const text=String(v||'').replace(/,/g,'');
  const m=text.match(/\$\s*([0-9]+(?:\.[0-9]+)?)/);
  return m?Number(m[1]):null;
}
function bankrollSnapshot(d){
  const exact=d.querySelector('#runnerBankrollCompact .runnerBankrollValue');
  let bankroll=parseBankrollText(exact?.textContent);
  if(!Number.isFinite(bankroll))bankroll=parseBankrollText(d.getElementById('runnerBankrollCompact')?.textContent);
  if(!Number.isFinite(bankroll))return {bankroll:null,unit:null};
  return {bankroll,unit:bankroll*.03};
}
function modelCashSnapshot(d,pa){
  const bank=bankrollSnapshot(d);
  const units=Number(pa?.netUnits);
  return {...bank,cash:Number.isFinite(bank.unit)&&Number.isFinite(units)?bank.unit*units:null};
}
function bestRow(rows){
  const list=(Array.isArray(rows)?rows:[]).filter(r=>Number(r?.complete||0)>0&&Number.isFinite(Number(r?.roiPct)));
  return list.sort((a,b)=>Number(b.roiPct)-Number(a.roiPct))[0]||null;
}
function statusRow(index,name){return (index.byStatus||[]).find(x=>x.name===name)||{name,issued:0,complete:0,unresolved:0,grades:{},priced:0,netUnits:0,roiPct:null}}

function ensureStyle(d){
  if(d.getElementById(STYLE_ID))return;
  const s=d.createElement('style');
  s.id=STYLE_ID;
  s.textContent=`
    :root{--results-accent:${ACCENT};--results-soft:${ACCENT_SOFT}}
    /* Primary navigation shell is the sole authority for the F8 menu tile and active page header theme. */
    #engine.resultsDesk{--rline:#244b61;--rpanel:#06111b;--rpanel2:#081824;--rgreen:#58ff88;--ryellow:#ffe96b;--rred:#ff6178;color:var(--text)}
    #engine.resultsDesk .resultsValueHero{border:2px solid #5bd8e8;background:radial-gradient(circle at 14% 8%,rgba(57,231,255,.09),transparent 34%),linear-gradient(180deg,#07131d,#03090f);padding:14px;box-shadow:0 0 20px rgba(57,231,255,.10),inset 0 0 24px rgba(88,255,136,.025)}
    #engine.resultsDesk .resultsTitle{color:var(--results-accent);font-weight:950;letter-spacing:.09em;font-size:15px;text-align:center}
    #engine.resultsDesk .resultsSub{color:var(--results-soft);font-size:10px;margin-top:5px;line-height:1.45;text-align:center}
    #engine.resultsDesk .valueGrid{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(260px,.75fr);gap:12px;margin-top:13px}
    #engine.resultsDesk .valueMain{border:1px solid #59d9dc;background:linear-gradient(180deg,rgba(4,22,25,.88),rgba(2,11,16,.96));padding:16px;min-height:224px;display:flex;flex-direction:column;justify-content:center;box-shadow:inset 0 0 20px rgba(88,255,136,.035)}
    #engine.resultsDesk .valueLabel{color:var(--results-accent);font-size:clamp(18px,2.5vw,31px);font-weight:950;letter-spacing:.055em}
    #engine.resultsDesk .resultsCashValue{font-size:clamp(48px,8vw,88px);font-weight:950;line-height:.96;margin-top:16px;letter-spacing:-.04em;text-shadow:0 0 18px currentColor}
    #engine.resultsDesk .resultsCashValue.positive,#engine.resultsDesk .valueMetric b.positive,#engine.resultsDesk .metricValue.positive{color:var(--rgreen)}
    #engine.resultsDesk .resultsCashValue.negative,#engine.resultsDesk .valueMetric b.negative,#engine.resultsDesk .metricValue.negative{color:var(--rred)}
    #engine.resultsDesk .resultsCashValue.neutral,#engine.resultsDesk .valueMetric b.neutral,#engine.resultsDesk .metricValue.neutral{color:var(--results-soft)}
    #engine.resultsDesk .valueCashLabel{color:var(--rgreen);font-size:clamp(13px,1.8vw,21px);font-weight:950;letter-spacing:.07em;margin-top:7px}
    #engine.resultsDesk .valueFormula{color:#c3d3db;font-size:9px;line-height:1.5;margin-top:10px}
    #engine.resultsDesk .valueDisclaimer{color:#96aab5;font-size:9px;line-height:1.45;margin-top:4px}
    #engine.resultsDesk .valueMetricStack{display:grid;gap:9px}
    #engine.resultsDesk .valueMetric{border:1px solid #2d6a5a;background:linear-gradient(180deg,#071813,#030b0a);padding:12px 13px;min-height:68px;display:flex;flex-direction:column;justify-content:center}
    #engine.resultsDesk .valueMetric.cyan{border-color:#23627b;background:linear-gradient(180deg,#06151e,#030a10)}
    #engine.resultsDesk .valueMetric .key{color:#a9c0ca;font-size:9px}
    #engine.resultsDesk .valueMetric b{display:block;font-size:clamp(23px,3vw,36px);line-height:1;margin-bottom:6px}
    #engine.resultsDesk .valueMetric.cyan b{color:var(--results-accent)}
    #engine.resultsDesk .proofBox,#engine.resultsDesk .auditBox,#engine.resultsDesk .resultsBox{border:1px solid var(--rline);background:var(--rpanel);padding:11px}
    #engine.resultsDesk .proofBox,#engine.resultsDesk .auditBox{margin-top:9px}
    #engine.resultsDesk .resultsSection{color:var(--results-accent);font-weight:950;letter-spacing:.08em;font-size:12px}
    #engine.resultsDesk .resultsNote{color:var(--results-soft);font-size:9px;margin-top:4px;line-height:1.4}
    #engine.resultsDesk .proofGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:9px}
    #engine.resultsDesk .proofCard{border:1px solid #315268;background:#030a11;padding:11px;min-height:102px;display:flex;flex-direction:column;justify-content:center}
    #engine.resultsDesk .proofCard.good{border-color:#4b8b3d;background:linear-gradient(180deg,#08170a,#030a07)}
    #engine.resultsDesk .proofCard.warn{border-color:#826d29;background:linear-gradient(180deg,#171305,#090703)}
    #engine.resultsDesk .proofCard .key{color:#a7bcc7;font-size:8px}
    #engine.resultsDesk .proofCard b{display:block;color:var(--results-accent);font-size:19px;margin-top:5px}
    #engine.resultsDesk .proofCard.good b{color:var(--rgreen)}
    #engine.resultsDesk .proofCard.warn b{color:var(--ryellow)}
    #engine.resultsDesk .proofCard span{display:block;margin-top:5px;font-size:11px;font-weight:900}
    #engine.resultsDesk .proofCard .proofSecondary{color:#d7e1e5}
    #engine.resultsDesk .auditStats{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:7px;margin-top:9px}
    #engine.resultsDesk .auditStat{border:1px solid #27465a;background:#030a11;padding:9px;min-height:67px}
    #engine.resultsDesk .auditStat .key{color:var(--results-soft);font-size:8px}
    #engine.resultsDesk .auditStat b{display:block;color:#b7d1df;font-size:20px;margin-top:5px}
    #engine.resultsDesk .auditStat.good b{color:var(--rgreen)}
    #engine.resultsDesk .auditStat.open b{color:var(--ryellow)}
    #engine.resultsDesk .auditNotice{border:1px solid #29475a;background:#020811;color:#9fb3be;padding:7px 9px;font-size:8px;line-height:1.45;margin-top:8px}
    #engine.resultsDesk .resultsControls{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
    #engine.resultsDesk .resultsCtl{font:inherit;font-size:9px;font-weight:900;cursor:pointer;border:1px solid #37627a;color:#8fb8cd;background:#04101a;padding:6px 8px}
    #engine.resultsDesk .resultsCtl.active{background:#7aa6c2;color:#03101a;border-color:#7aa6c2}
    #engine.resultsDesk .resultsGrid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:9px}
    #engine.resultsDesk .resultsBox.full{grid-column:1/-1}
    #engine.resultsDesk .performancePanel{min-height:180px}
    #engine.resultsDesk .marketBars{display:grid;gap:8px;margin-top:10px}
    #engine.resultsDesk .marketBarRow{display:grid;grid-template-columns:minmax(90px,.75fr) minmax(90px,1.2fr) 78px;align-items:center;gap:8px}
    #engine.resultsDesk .marketName{font-size:10px;color:#c6d5dc}
    #engine.resultsDesk .barTrack{height:12px;border-left:1px solid #35546a;background:#020810;overflow:hidden}
    #engine.resultsDesk .barFill{display:block;height:100%;min-width:3px;background:#7aa6c2}
    #engine.resultsDesk .barFill.positive{background:var(--rgreen)}
    #engine.resultsDesk .barFill.negative{background:var(--rred)}
    #engine.resultsDesk .barPct{text-align:right;font-size:10px;font-weight:950}
    #engine.resultsDesk .barPct.positive{color:var(--rgreen)}
    #engine.resultsDesk .barPct.negative{color:var(--rred)}
    #engine.resultsDesk .barPct.neutral{color:var(--results-soft)}
    #engine.resultsDesk .statusRows{display:grid;gap:7px;margin-top:10px}
    #engine.resultsDesk .statusPerfRow{display:grid;grid-template-columns:72px 1fr 82px;align-items:center;gap:8px;border:1px solid #234154;background:#030a11;padding:8px}
    #engine.resultsDesk .statusPerfRow .statusName{font-weight:950;font-size:10px}
    #engine.resultsDesk .statusPerfRow .statusGrade{color:#cedce2;font-size:11px;text-align:right}
    #engine.resultsDesk .statusRoi{border:1px solid currentColor;padding:4px 6px;text-align:center;font-size:10px;font-weight:950}
    #engine.resultsDesk .statusRoi.positive{color:var(--rgreen);background:#0b1c0d}
    #engine.resultsDesk .statusRoi.negative{color:var(--ryellow);background:#1a1505}
    #engine.resultsDesk .statusRoi.neutral{color:var(--results-accent);background:#05141c}
    #engine.resultsDesk .topSportRow{display:grid;grid-template-columns:minmax(100px,.7fr) repeat(3,minmax(80px,.55fr));gap:8px;align-items:center;margin-top:9px;border:1px solid #315268;background:#030a11;padding:10px}
    #engine.resultsDesk .topSportName{font-size:18px;font-weight:950;color:#c4d9e4}
    #engine.resultsDesk .topSportMetric .key{color:var(--results-soft);font-size:8px}
    #engine.resultsDesk .topSportMetric b{display:block;font-size:13px;margin-top:3px}
    #engine.resultsDesk table{width:100%;border-collapse:collapse;margin-top:7px}
    #engine.resultsDesk th,#engine.resultsDesk td{padding:7px 6px;border-top:1px dotted var(--rline);text-align:left;font-size:10px;vertical-align:top}
    #engine.resultsDesk th{color:var(--results-soft);font-size:8px;letter-spacing:.07em}
    #engine.resultsDesk .rStatus{font-weight:950}
    #engine.resultsDesk .rStatus.bet,#engine.resultsDesk .rWin{color:var(--rgreen)}
    #engine.resultsDesk .rStatus.lean{color:var(--ryellow)}
    #engine.resultsDesk .rStatus.wait{color:var(--results-accent)}
    #engine.resultsDesk .rStatus.pass{color:var(--muted)}
    #engine.resultsDesk .rLoss{color:var(--rred)}
    #engine.resultsDesk .rPush{color:var(--ryellow)}
    #engine.resultsDesk .rOpen{color:var(--results-soft)}
    #engine.resultsDesk .positive{color:var(--rgreen)}
    #engine.resultsDesk .negative{color:var(--rred)}
    #engine.resultsDesk .neutral{color:var(--results-soft)}
    #engine.resultsDesk .resultsScroll{overflow-x:auto}
    #engine.resultsDesk .resultsEmpty{padding:12px;border:1px dashed var(--results-accent);color:var(--results-soft);margin-top:8px}
    #engine.resultsDesk .resultsReason{color:#c8a96b}
    #engine.resultsDesk .resultsFoot{margin-top:9px;color:var(--results-soft);font-size:9px;line-height:1.45}
    @media(max-width:900px){#engine.resultsDesk .valueGrid{grid-template-columns:1fr}#engine.resultsDesk .proofGrid{grid-template-columns:repeat(2,minmax(0,1fr))}#engine.resultsDesk .auditStats{grid-template-columns:repeat(3,minmax(0,1fr))}#engine.resultsDesk .topSportRow{grid-template-columns:1fr repeat(3,minmax(80px,.6fr))}}
    @media(max-width:650px){#engine.resultsDesk .resultsGrid{grid-template-columns:1fr!important}#engine.resultsDesk .resultsBox.full{grid-column:auto!important}#engine.resultsDesk .proofGrid{grid-template-columns:1fr 1fr}#engine.resultsDesk .auditStats{grid-template-columns:repeat(2,minmax(0,1fr))}#engine.resultsDesk .valueMain{min-height:190px}#engine.resultsDesk .marketBarRow{grid-template-columns:90px 1fr 68px}#engine.resultsDesk .topSportRow{grid-template-columns:1fr 1fr}#engine.resultsDesk th,#engine.resultsDesk td{font-size:9px;padding:6px 5px}}
    @media(max-width:440px){#engine.resultsDesk .proofGrid{grid-template-columns:1fr}#engine.resultsDesk .statusPerfRow{grid-template-columns:60px 1fr 72px}#engine.resultsDesk .resultsTitle{font-size:12px}}
  `;
  d.head.appendChild(s);
}

function rowTable(rows,label){
  if(!rows?.length)return '<div class="resultsEmpty">NO DATA YET</div>';
  return `<div class="resultsScroll"><table><thead><tr><th>${label}</th><th>CLOSED</th><th>W-L</th><th>OPEN</th><th>ROI</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.name)}</td><td>${Number(r.complete||0)}</td><td>${esc(grades(r))}</td><td>${Number(r.unresolved||0)}</td><td class="${valueClass(r.roiPct)}">${esc(pct(r.roiPct))}</td></tr>`).join('')}</tbody></table></div>`;
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
function marketBars(rows){
  const list=Array.isArray(rows)?rows:[];
  if(!list.length)return '<div class="resultsEmpty">NO MARKET DATA YET</div>';
  const max=Math.max(1,...list.map(r=>Math.abs(Number(r.roiPct)||0)));
  return `<div class="marketBars">${list.map(r=>{
    const roi=Number(r.roiPct),width=Math.max(3,Math.min(100,(Math.abs(roi||0)/max)*100)),cls=valueClass(roi);
    return `<div class="marketBarRow"><div class="marketName">${esc(String(r.name||'—').toUpperCase())}</div><div class="barTrack"><span class="barFill ${cls}" style="width:${width.toFixed(1)}%"></span></div><div class="barPct ${cls}">${esc(pct(roi))}</div></div>`;
  }).join('')}</div>`;
}
function statusPerformance(rows){
  return `<div class="statusRows">${rows.map(r=>{const cls=valueClass(r.roiPct);return `<div class="statusPerfRow"><div class="statusName ${statusClass(r.name)}">${esc(r.name)}</div><div class="statusGrade">${esc(grades(r))}</div><div class="statusRoi ${cls}">${esc(pct(r.roiPct))}</div></div>`}).join('')}</div>`;
}
function topSportRow(row){
  if(!row)return '<div class="resultsEmpty">NO SPORT DATA YET</div>';
  return `<div class="topSportRow"><div class="topSportName">${esc(row.name)}</div><div class="topSportMetric"><div class="key">CLOSED</div><b>${Number(row.complete||0)}</b></div><div class="topSportMetric"><div class="key">W-L</div><b>${esc(grades(row))}</b></div><div class="topSportMetric"><div class="key">ROI</div><b class="${valueClass(row.roiPct)}">${esc(pct(row.roiPct))}</b></div></div>`;
}
function refreshCash(d,pa){
  const snap=modelCashSnapshot(d,pa);
  const cash=d.querySelector('#engine.resultsDesk .resultsCashValue');
  if(cash){cash.textContent=money(snap.cash);cash.className=`resultsCashValue ${valueClass(snap.cash)}`}
  const formula=d.querySelector('#engine.resultsDesk .valueFormula');
  if(formula){
    formula.textContent=Number.isFinite(snap.bankroll)
      ? `MODEL EQUIVALENT: ${signed(pa?.netUnits,2)}u × 3% OF ${money(snap.bankroll).replace(/^\+/,'')} BANKROLL (${money(snap.unit).replace(/^\+/,'')} / UNIT).`
      : 'MODEL EQUIVALENT USES NET UNITS × THE CURRENT 3% BANKROLL UNIT WHEN BANKROLL IS AVAILABLE.';
  }
}

function render(d,index){
  const engine=d.getElementById('engine');
  if(!engine)return;
  cached=index;
  engine.classList.add('resultsDesk');
  const c=index.coverage||{},pa=index.priceAnalytics||{};
  const bet=statusRow(index,'BET'),pass=statusRow(index,'PASS'),wait=statusRow(index,'WAIT'),lean=statusRow(index,'LEAN');
  const bestMarket=bestRow(index.byMarket),bestSport=bestRow(index.bySport);
  engine.innerHTML=`
    <div class="resultsValueHero">
      <div class="resultsTitle">🧠 VIGSCOPE // RESULTS &amp; VALUE 🧠</div>
      <div class="resultsSub">WHAT THE ENGINE HAS BEEN WORTH // PERFORMANCE PROOF FIRST, AUDIT DETAIL BELOW</div>
      <div class="valueGrid">
        <div class="valueMain">
          <div class="valueLabel">VIGSCOPE ADVANTAGE</div>
          <div class="resultsCashValue neutral">—</div>
          <div class="valueCashLabel">EST. CASH VALUE ADDED</div>
          <div class="valueFormula">CALCULATING CURRENT 3% BANKROLL UNIT…</div>
          <div class="valueDisclaimer">MODEL VALUE ONLY. THIS CONVERTS PRICE-ADJUSTED NET UNITS INTO A CURRENT-BANKROLL CASH EQUIVALENT; IT IS NOT OFFICIAL SETTLED BETTING PROFIT.</div>
        </div>
        <div class="valueMetricStack">
          <div class="valueMetric"><b class="${valueClass(pa.netUnits)}">${esc(signed(pa.netUnits,2))}u</b><div class="key">NET EDGE CAPTURED</div></div>
          <div class="valueMetric"><b class="${valueClass(pa.roiPct)}">${esc(pct(pa.roiPct))}</b><div class="key">ROI ON PRICED CARDS</div></div>
          <div class="valueMetric cyan"><b>${Number(pa.pricedCards||0)}</b><div class="key">PRICED CARDS</div></div>
        </div>
      </div>
    </div>

    <div class="proofBox">
      <div class="resultsSection">WHY VIGSCOPE MATTERS</div>
      <div class="proofGrid">
        <div class="proofCard good"><div class="key">BEST MARKET</div><b>${esc(bestMarket?.name||'—')}</b><span>${esc(pct(bestMarket?.roiPct))} ROI</span></div>
        <div class="proofCard good"><div class="key">BEST SPORT</div><b>${esc(bestSport?.name||'—')}</b><span>${esc(pct(bestSport?.roiPct))} ROI</span></div>
        <div class="proofCard warn"><div class="key">LEANS</div><b>${esc(grades(lean))}</b><span class="proofSecondary">${esc(pct(lean.roiPct))} MODEL ROI</span></div>
        <div class="proofCard"><div class="key">FILTERING ENGINE</div><b>PASS ${esc(grades(pass))}</b><span class="proofSecondary">WAIT ${esc(grades(wait))}</span></div>
      </div>
    </div>

    <div class="auditBox">
      <div class="resultsSection">AUDIT SNAPSHOT</div>
      <div class="auditStats">
        <div class="auditStat"><div class="key">EVENTS</div><b>${Number(c.events||0)}</b></div>
        <div class="auditStat"><div class="key">SELECTIONS</div><b>${Number(c.selections||0)}</b></div>
        <div class="auditStat"><div class="key">CARDS</div><b>${Number(c.cards||0)}</b></div>
        <div class="auditStat good"><div class="key">CLOSED</div><b>${Number(c.completeCards||0)}</b></div>
        <div class="auditStat open"><div class="key">OPEN EVENTS</div><b>${Number(c.unresolvedEvents||0)}</b></div>
        <div class="auditStat"><div class="key">OFFICIAL BETS</div><b>${Number(bet.complete||0)}</b></div>
      </div>
      <div class="auditNotice">OFFICIAL BET PERFORMANCE REMAINS SEPARATE. THIS PAGE RANKS AND PRICES MODEL OPPORTUNITIES; HYPOTHETICAL LEAN / WAIT / PASS RESULTS ARE CALIBRATION EVIDENCE, NOT CASH WON.</div>
      <div class="resultsControls">
        <button class="resultsCtl ${state.scope==='cards'?'active':''}" data-results-scope="cards">CARDS</button>
        <button class="resultsCtl ${state.scope==='unique'?'active':''}" data-results-scope="unique">UNIQUE</button>
        ${['ALL','BET','LEAN','WAIT','PASS'].map(x=>`<button class="resultsCtl ${state.status===x?'active':''}" data-results-status="${x}">${x}</button>`).join('')}
      </div>
    </div>

    <div class="resultsGrid">
      <div class="resultsBox performancePanel"><div class="resultsSection">MARKET PERFORMANCE // ROI</div><div class="resultsNote">Price-adjusted model return by exact issued market.</div>${marketBars(index.byMarket||[])}</div>
      <div class="resultsBox performancePanel"><div class="resultsSection">STATUS PERFORMANCE</div><div class="resultsNote">Calibration view; official BET results remain isolated.</div>${statusPerformance([pass,wait,lean])}</div>
      <div class="resultsBox full"><div class="resultsSection">TOP SPORT PERFORMANCE</div>${topSportRow(bestSport)}</div>
      <div class="resultsBox"><div class="resultsSection">BY SPORT // FULL TABLE</div><div class="resultsNote">Use ROI alongside W-L and sample size.</div>${rowTable(index.bySport||[],'SPORT')}</div>
      <div class="resultsBox"><div class="resultsSection">BY REPORT LANE</div><div class="resultsNote">Repeated selections remain separate in CARDS mode.</div>${rowTable(index.byLane||[],'LANE')}</div>
      <div class="resultsBox full"><div class="resultsSection">${state.scope==='cards'?'ISSUED CARD LOG':'UNIQUE SELECTION LOG'}</div><div class="resultsNote">${state.scope==='cards'?'Each report appearance is preserved.':'Exact selectionKey is deduplicated; status path shows how the card evolved across lanes.'}</div>${detailRows(index)}</div>
      <div class="resultsBox full"><div class="resultsSection">OPEN / UNRESOLVED</div><div class="resultsNote">Unresolved means not safely verified yet, not a loss. Closure retry metadata remains in the observation sidecars.</div>${unresolvedRows(index)}</div>
    </div>
    <div class="resultsFoot">INDEX GENERATED ${esc(index.generatedAt||'—')} // SOURCE THROUGH ${esc(c.lastDate||'—')} // RESULTS INDEX IS NON-AUTHORITATIVE AND MAY BE REBUILT FROM IMMUTABLE RUNS + OBSERVATIONS.</div>
  `;
  refreshCash(d,pa);
  engine.querySelectorAll('[data-results-scope]').forEach(b=>b.addEventListener('click',()=>{state.scope=b.dataset.resultsScope;render(d,cached)}));
  engine.querySelectorAll('[data-results-status]').forEach(b=>b.addEventListener('click',()=>{state.status=b.dataset.resultsStatus;render(d,cached)}));
}

async function load(d){
  const engine=d.getElementById('engine');
  if(!engine)return;
  engine.classList.add('resultsDesk');
  engine.innerHTML='<div class="resultsValueHero"><div class="resultsTitle">🧠 VIGSCOPE // RESULTS &amp; VALUE 🧠</div><div class="resultsSub">LOADING RESULTS INDEX…</div></div>';
  try{
    const r=await fetch(`${INDEX_URL}?v=${Date.now()}`,{cache:'no-store'});
    if(!r.ok)throw new Error(`HTTP ${r.status}`);
    render(d,await r.json());
  }catch(e){
    engine.innerHTML=`<div class="resultsValueHero"><div class="resultsTitle">🧠 VIGSCOPE // RESULTS &amp; VALUE 🧠</div><div class="resultsSub">RESULTS INDEX UNAVAILABLE // ${esc(e.message||e)}</div></div>`;
  }
}
function install(d){
  if(!d?.body)return false;
  ensureStyle(d);
  const engine=d.getElementById('engine');
  if(!engine)return false;
  if(engine.dataset[INSTALLED]!=='1'){
    engine.dataset[INSTALLED]='1';
    load(d);
  }else if(cached){
    refreshCash(d,cached.priceAnalytics||{});
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
function refreshCachedValue(){const d=appDoc();if(d&&cached)refreshCash(d,cached.priceAnalytics||{})}window.addEventListener('pageshow',refreshCachedValue);window.addEventListener('focus',refreshCachedValue);
})();