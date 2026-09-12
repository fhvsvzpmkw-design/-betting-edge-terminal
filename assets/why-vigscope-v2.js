(()=>{
'use strict';

const STYLE_ID='whyVigScopeV2Style';
const INDEX_URL='./data/history/results-index.json';
const VERSION='4';
let cached=null;
let loading=false;
let applying=false;

function doc(){
  try{
    const core=document.getElementById('core');
    const app=core?.contentDocument?.getElementById('app');
    return app?.contentDocument||null;
  }catch{return null}
}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function finite(v){return v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))}
function pct(v){
  if(!finite(v))return '—';
  const n=Number(v);
  const sign=n>0?'+':n<0?'−':'';
  return `${sign}${Math.abs(n).toFixed(2)}%`;
}
function grades(r){
  const g=r?.grades||{};
  return `${Number(g.WIN||0)}-${Number(g.LOSS||0)}`;
}
function shadowRow(v,status){
  return (v?.byStatus||[]).find(x=>String(x?.status||'').toUpperCase()===status)||{status,decisions:0,priced:0,grades:{},protectedOutcomes:0,missedOutcomes:0,shadowRoiPct:null};
}
function bestSport(rows){
  const list=(Array.isArray(rows)?rows:[]).filter(r=>Number(r?.priced||0)>=5&&finite(r?.roiPct));
  return list.sort((a,b)=>Number(b.roiPct)-Number(a.roiPct))[0]||null;
}
function shadowCardClass(v){return !finite(v)||Number(v)===0?'':Number(v)>0?'good':'warn'}
function opportunityCardClass(v){return !finite(v)||Number(v)===0?'':Number(v)>0?'good':'warn'}
function betSummary(p={}){
  const issued=Number(p.issuedBets||0),settled=Number(p.settledBets||0),priced=Number(p.pricedBets||0);
  const hasReturn=priced>0&&finite(p.roiPct);
  return {
    value:hasReturn?`${pct(p.roiPct)} ROI`:issued?'AWAITING RESULTS':'NO BETS ISSUED YET',
    meaning:hasReturn?'RETURN ON ISSUED BET STAKES':issued?'Results appear after settlement and price verification.':'The record starts when VigScope issues its first BET.',
    meta:`${issued} ISSUED // ${settled} SETTLED // ${priced} PRICED`,
    units:hasReturn&&finite(p.netUnits)?`${Number(p.netUnits)>0?'+':''}${Number(p.netUnits).toFixed(2)}u NET // `:'',
    tone:hasReturn?opportunityCardClass(p.roiPct):''
  };
}
function filterMeaning(v,good,bad){
  if(!finite(v))return 'WAITING FOR A VALID SAMPLE';
  if(Number(v)<0)return good;
  if(Number(v)>0)return bad;
  return 'FLAT HYPOTHETICAL RETURN';
}
function ensureStyle(d){
  if(d.getElementById(STYLE_ID))return;
  const s=d.createElement('style');
  s.id=STYLE_ID;
  s.textContent=`
    #engine.resultsDesk .whyVigScopeSub{color:#bdcbd4;font-size:11px;line-height:1.6;margin-top:7px;max-width:100ch}
    #engine.resultsDesk .proofGrid{grid-template-columns:repeat(3,minmax(0,1fr))}
    #engine.resultsDesk .proofCard.whyProofCard{justify-content:flex-start;min-height:112px}
    #engine.resultsDesk .proofCard.whyProofCard b{font-size:clamp(18px,2vw,24px);line-height:1.08;margin-top:8px}
    #engine.resultsDesk .proofCard.whyProofCard>span{font-size:9px;line-height:1.35;margin-top:7px;letter-spacing:.025em}
    #engine.resultsDesk .whyProofMeta{display:block;color:#8ea0af!important;font-size:8px!important;font-weight:700!important;line-height:1.35!important;margin-top:6px!important}
    #engine.resultsDesk .whyProofExplain{color:#bdcbd4;font-size:10px;line-height:1.55;margin:9px 0 0}
    #engine.resultsDesk .whyVigScopeMethod{border-top:1px solid #315268;color:#8ea0af;font-size:10px;line-height:1.55;margin:12px 0 0;padding-top:10px}
    @media(max-width:900px){#engine.resultsDesk .proofGrid{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media(max-width:760px){#engine.resultsDesk .proofCard.whyProofCard{min-height:100px}}
    @media(max-width:440px){#engine.resultsDesk .proofGrid{grid-template-columns:1fr}}
  `;
  d.head.appendChild(s);
}
function signature(index){
  const v=index?.decisionValueShadowV2||{};
  return JSON.stringify([(index?.issuedBetAnalytics||index?.playerValueAnalytics),...['LEAN','WAIT','PASS'].map(s=>shadowRow(v,s)),bestSport(index?.finalSelectionAnalytics?.bySport || index?.bySport),v?.diagnostics?.recentSevenDay,v?.diagnostics?.recentTrend]);
}
function apply(d,index){
  if(applying)return false;
  const engine=d.getElementById('engine');
  const proof=engine?.querySelector('.proofBox');
  const grid=proof?.querySelector('.proofGrid');
  if(!engine?.classList.contains('resultsDesk')||!proof||!grid)return false;
  const v=index?.decisionValueShadowV2||{};
  if(Number(v?.version)!==2)return false;
  ensureStyle(d);
  const sig=signature(index);
  if(proof.dataset.whyVigScopeV2===VERSION&&proof.dataset.whyVigScopeSignature===sig)return true;
  applying=true;
  try{
    const lean=shadowRow(v,'LEAN');
    const wait=shadowRow(v,'WAIT');
    const pass=shadowRow(v,'PASS');
    const bet=betSummary((index?.issuedBetAnalytics||index?.playerValueAnalytics));
    const sport=bestSport(index?.finalSelectionAnalytics?.bySport || index?.bySport);
    const recent=v?.diagnostics?.recentSevenDay||null;
    const trend=String(v?.diagnostics?.recentTrend||'NO BASELINE').toUpperCase();
    const heading=proof.querySelector('.resultsSection');
    if(heading)heading.textContent='WHY VIGSCOPE MATTERS';
    let sub=proof.querySelector('.whyVigScopeSub');
    if(!sub){
      sub=d.createElement('div');
      sub.className='whyVigScopeSub';
      heading?.insertAdjacentElement('afterend',sub);
    }
    sub.textContent='VigScope is designed to turn qualified odds and supporting research into a fair-value estimate and a BET, LEAN, WAIT or PASS decision. This section asks two questions: how did issued BETs perform, and what happened to the opportunities held back?';
    grid.innerHTML=`
      <div class="proofCard whyProofCard ${bet.tone}" data-why-status="BET">
        <div class="key">BET // ISSUED PLAY RESULTS</div>
        <b>${esc(bet.value)}</b>
        <span>${esc(bet.meaning)}</span>
        <small class="whyProofMeta">${esc(bet.units+bet.meta)}</small>
        <p class="whyProofExplain">BET is the actionable decision. Net units and ROI follow the issued stake sizes, so this record measures the plays VigScope actually recommended taking.</p>
      </div>
      <div class="proofCard whyProofCard ${shadowCardClass(lean.shadowRoiPct)}">
        <div class="key">LEAN TRACKING</div>
        <b>LEAN ${esc(pct(lean.shadowRoiPct))}</b>
        <span>${esc(filterMeaning(lean.shadowRoiPct,'FILTERED LEANS WOULD HAVE LOST','FILTERED LEANS WOULD HAVE WON'))}</span>
        <small class="whyProofMeta">${Number(lean.protectedOutcomes||0)} LOSING OUTCOMES // ${Number(lean.missedOutcomes||0)} WINNING OUTCOMES</small>
        <p class="whyProofExplain">LEAN identifies interest without a BET recommendation. Shadow ROI asks whether those final leans would have paid off at their recorded prices.</p>
      </div>
      <div class="proofCard whyProofCard ${shadowCardClass(wait.shadowRoiPct)}">
        <div class="key">WAIT TRACKING</div>
        <b>WAIT ${esc(pct(wait.shadowRoiPct))}</b>
        <span>${esc(filterMeaning(wait.shadowRoiPct,'FILTERED WAITS WOULD HAVE LOST','FILTERED WAITS WOULD HAVE WON'))}</span>
        <small class="whyProofMeta">${Number(wait.protectedOutcomes||0)} LOSING OUTCOMES // ${Number(wait.missedOutcomes||0)} WINNING OUTCOMES</small>
        <p class="whyProofExplain">WAIT holds a decision for a better price or clearer information. This checks the selections still marked WAIT at the final recorded decision.</p>
      </div>
      <div class="proofCard whyProofCard ${shadowCardClass(pass.shadowRoiPct)}">
        <div class="key">PASS TRACKING</div>
        <b>PASS ${esc(pct(pass.shadowRoiPct))}</b>
        <span>${esc(filterMeaning(pass.shadowRoiPct,'FILTERED PASSES WOULD HAVE LOST','FILTERED PASSES WOULD HAVE WON'))}</span>
        <small class="whyProofMeta">${Number(pass.protectedOutcomes||0)} LOSING OUTCOMES // ${Number(pass.missedOutcomes||0)} WINNING OUTCOMES</small>
        <p class="whyProofExplain">PASS means leave the selection alone. Both opposing sides often appear. Their negative combined return can reflect bookmaker margin, so it does not alone demonstrate useful filtering.</p>
      </div>
      <div class="proofCard whyProofCard ${opportunityCardClass(sport?.roiPct)}">
        <div class="key">HIGHEST HISTORICAL SPORT ROI</div>
        <b>${esc(sport?.name||'—')}</b>
        <span>${esc(pct(sport?.roiPct))} HYPOTHETICAL ROI</span>
        <small class="whyProofMeta">${sport?`${Number(sport.priced||0)} PRICED // ${esc(grades(sport))} W-L`:'MINIMUM 5 PRICED SELECTIONS'}</small>
        <p class="whyProofExplain">The strongest historical sport across final exact selections with completed, priced results. Opposing sides remain; five selections is a display minimum, not evidence of a repeatable edge.</p>
      </div>
      <div class="proofCard whyProofCard ${shadowCardClass(recent?.shadowRoiPct)}">
        <div class="key">RECENT FORM</div>
        <b>${recent?esc(pct(recent.shadowRoiPct)):'—'} SHADOW ROI</b>
        <span>${esc(filterMeaning(recent?.shadowRoiPct,'FILTERED BETS WOULD HAVE LOST','FILTERED BETS WOULD HAVE WON'))}</span>
        <small class="whyProofMeta">${recent?`${Number(recent.priced||0)} DECISIONS // ${esc(trend)}`:'NO CURRENT 7-DAY WINDOW'}</small>
        <p class="whyProofExplain">The latest seven-day window in the results index checks whether the held-back selections would have won or lost, and how that compares with the previous week.</p>
      </div>`;
    let method=proof.querySelector('.whyVigScopeMethod');
    if(!method){method=d.createElement('p');method.className='whyVigScopeMethod';grid.insertAdjacentElement('afterend',method)}
    method.textContent='Shadow returns use one final decision per exact selection at its frozen price. The denominator is 1u per priced settled selection, including pushes and voids; pending cards and missing prices are excluded. Both opposing sides are retained and grouped: bookmaker margin and dependent outcomes prevent using negative PASS return alone as proof of filter skill. Issued BET stake results are recommendation replays, separate from hypothetical tracking and verified user wagers.';
    proof.dataset.whyVigScopeV2=VERSION;
    proof.dataset.whyVigScopeSignature=sig;
    return true;
  }finally{applying=false}
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
function patch(){const d=doc();if(!d||!cached)return false;return apply(d,cached)}
function obs(){const d=doc(),engine=d?.getElementById('engine');if(!engine||engine.dataset.whyVigScopeObserver==='1')return false;engine.dataset.whyVigScopeObserver='1';let q=false;new MutationObserver(()=>{if(!cached||q||applying)return;q=true;requestAnimationFrame(()=>{q=false;apply(d,cached)})}).observe(engine,{childList:true,subtree:true});return true}
load().then(()=>{obs();patch()});
let tries=0;
const boot=setInterval(()=>{
  tries++;
  patch();
  if(!cached&&!loading)load().then(patch);
  if((cached&&patch())||tries>250)clearInterval(boot);
},60);
window.addEventListener('pageshow',()=>load().then(()=>{obs();patch()}));
})();
