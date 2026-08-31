(()=>{
'use strict';

const STYLE_ID='whyVigScopeV2Style';
const INDEX_URL='./data/history/results-index.json';
const VERSION='2';
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
function shadowCardClass(v){return finite(v)&&Number(v)<0?'good':'warn'}
function opportunityCardClass(v){return finite(v)&&Number(v)>0?'good':'warn'}
function filterMeaning(v,good,bad){
  if(!finite(v))return 'WAITING FOR A VALID SAMPLE';
  if(Number(v)<0)return good;
  if(Number(v)>0)return bad;
  return 'FILTER ROUGHLY NEUTRAL';
}
function ensureStyle(d){
  if(d.getElementById(STYLE_ID))return;
  const s=d.createElement('style');
  s.id=STYLE_ID;
  s.textContent=`
    #engine.resultsDesk .whyVigScopeSub{color:#8ea0af;font-size:8px;font-weight:900;letter-spacing:.09em;margin-top:4px}
    #engine.resultsDesk .proofCard.whyProofCard{justify-content:flex-start;min-height:112px}
    #engine.resultsDesk .proofCard.whyProofCard b{font-size:clamp(18px,2vw,24px);line-height:1.08;margin-top:8px}
    #engine.resultsDesk .proofCard.whyProofCard>span{font-size:9px;line-height:1.35;margin-top:7px;letter-spacing:.025em}
    #engine.resultsDesk .whyProofMeta{display:block;color:#8ea0af!important;font-size:8px!important;font-weight:700!important;line-height:1.35!important;margin-top:6px!important}
    @media(max-width:760px){#engine.resultsDesk .proofCard.whyProofCard{min-height:100px}}
  `;
  d.head.appendChild(s);
}
function signature(index){
  const v=index?.decisionValueShadowV2||{};
  const lean=shadowRow(v,'LEAN'),wait=shadowRow(v,'WAIT'),recent=v?.diagnostics?.recentSevenDay||{};
  const sport=bestSport(index?.bySport)||{};
  return [lean.shadowRoiPct,lean.protectedOutcomes,lean.missedOutcomes,wait.shadowRoiPct,wait.protectedOutcomes,wait.missedOutcomes,sport.name,sport.roiPct,sport.priced,recent.shadowRoiPct,recent.priced,v?.diagnostics?.recentTrend].join('|');
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
    const sport=bestSport(index?.bySport);
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
    sub.textContent='MEASURED VALUE OF THE DECISION ENGINE';
    grid.innerHTML=`
      <div class="proofCard whyProofCard ${shadowCardClass(lean.shadowRoiPct)}">
        <div class="key">FILTER PROTECTION</div>
        <b>LEAN ${esc(pct(lean.shadowRoiPct))}</b>
        <span>${esc(filterMeaning(lean.shadowRoiPct,'BAD BETS KEPT OFF THE CARD','LEAN FILTER MAY BE TOO TIGHT'))}</span>
        <small class="whyProofMeta">${Number(lean.protectedOutcomes||0)} AVOIDED LOSERS // ${Number(lean.missedOutcomes||0)} MISSED WINNERS</small>
      </div>
      <div class="proofCard whyProofCard ${shadowCardClass(wait.shadowRoiPct)}">
        <div class="key">WAIT DISCIPLINE</div>
        <b>WAIT ${esc(pct(wait.shadowRoiPct))}</b>
        <span>${esc(filterMeaning(wait.shadowRoiPct,'MARGINAL PLAYS HELD BACK','WAIT FILTER MAY BE TOO TIGHT'))}</span>
        <small class="whyProofMeta">${Number(wait.protectedOutcomes||0)} AVOIDED LOSERS // ${Number(wait.missedOutcomes||0)} MISSED WINNERS</small>
      </div>
      <div class="proofCard whyProofCard ${opportunityCardClass(sport?.roiPct)}">
        <div class="key">BEST OPPORTUNITY</div>
        <b>${esc(sport?.name||'—')}</b>
        <span>${esc(pct(sport?.roiPct))} MODEL ROI</span>
        <small class="whyProofMeta">${sport?`${Number(sport.priced||0)} PRICED // ${esc(grades(sport))} W-L`:'MINIMUM 5 PRICED CARDS'}</small>
      </div>
      <div class="proofCard whyProofCard ${shadowCardClass(recent?.shadowRoiPct)}">
        <div class="key">RECENT FORM</div>
        <b>${recent?esc(pct(recent.shadowRoiPct)):'—'} SHADOW ROI</b>
        <span>${esc(filterMeaning(recent?.shadowRoiPct,'FILTERED BETS WOULD HAVE LOST','FILTERED BETS WOULD HAVE WON'))}</span>
        <small class="whyProofMeta">${recent?`${Number(recent.priced||0)} DECISIONS // ${esc(trend)}`:'NO CURRENT 7-DAY WINDOW'}</small>
      </div>`;
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
