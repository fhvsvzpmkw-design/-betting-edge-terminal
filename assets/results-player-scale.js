(()=>{
'use strict';

const STYLE_ID='resultsPlayerScaleStyle';
const INDEX_URL='./data/history/results-index.json';
let cached=null;
let loading=false;

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
function cash(v){const n=Number(v);if(!Number.isFinite(n))return '—';const sign=n>0?'+':n<0?'-':'';return `${sign}$${Math.abs(n).toFixed(2)}`}
function valueClass(v){const n=Number(v);return !Number.isFinite(n)?'neutral':n>0?'positive':n<0?'negative':'neutral'}

function ensureStyle(d){
  if(d.getElementById(STYLE_ID))return;
  const s=d.createElement('style');
  s.id=STYLE_ID;
  s.textContent=`
    #engine.resultsDesk .playerValueAmount{font-size:clamp(50px,8vw,90px);font-weight:950;line-height:.95;margin-top:16px;letter-spacing:-.045em;text-shadow:0 0 18px currentColor}
    #engine.resultsDesk .playerValueAmount.positive,#engine.resultsDesk .playerMetric b.positive,#engine.resultsDesk .playerScaleCard b.positive{color:var(--green)}
    #engine.resultsDesk .playerValueAmount.negative,#engine.resultsDesk .playerMetric b.negative,#engine.resultsDesk .playerScaleCard b.negative{color:var(--red)}
    #engine.resultsDesk .playerValueAmount.neutral,#engine.resultsDesk .playerMetric b.neutral,#engine.resultsDesk .playerScaleCard b.neutral{color:var(--results-soft)}
    #engine.resultsDesk .playerValueLabel{color:var(--green);font-size:clamp(13px,1.8vw,21px);font-weight:950;letter-spacing:.07em;margin-top:7px}
    #engine.resultsDesk .playerValueRule{color:#c5d6dd;font-size:10px;line-height:1.5;margin-top:10px;font-weight:800}
    #engine.resultsDesk .playerValueNote{color:#91a7b3;font-size:9px;line-height:1.45;margin-top:5px}
    #engine.resultsDesk .playerMetric{border:1px solid #2d6a5a;background:linear-gradient(180deg,#071813,#030b0a);padding:12px 13px;min-height:68px;display:flex;flex-direction:column;justify-content:center}
    #engine.resultsDesk .playerMetric.cyan{border-color:#23627b;background:linear-gradient(180deg,#06151e,#030a10)}
    #engine.resultsDesk .playerMetric .key{color:#a9c0ca;font-size:9px}
    #engine.resultsDesk .playerMetric b{display:block;font-size:clamp(23px,3vw,36px);line-height:1;margin-bottom:6px}
    #engine.resultsDesk .playerMetric.cyan b{color:var(--results-accent)}
    #engine.resultsDesk .playerScaleBox,#engine.resultsDesk .calibrationBox{border:1px solid var(--rline);background:var(--rpanel);padding:11px;margin-top:9px}
    #engine.resultsDesk .playerScaleGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:9px}
    #engine.resultsDesk .playerScaleCard{border:1px solid #315268;background:#030a11;padding:12px;min-height:92px}
    #engine.resultsDesk .playerScaleCard.anchor{border-color:#4b8b3d;background:linear-gradient(180deg,#08170a,#030a07);box-shadow:inset 0 0 14px rgba(88,255,136,.035)}
    #engine.resultsDesk .playerScaleCard .key{color:#a7bcc7;font-size:8px}
    #engine.resultsDesk .playerScaleCard b{display:block;font-size:clamp(22px,3vw,34px);margin-top:8px;line-height:1}
    #engine.resultsDesk .playerScaleCard span{display:block;color:#98abb5;font-size:8px;margin-top:6px;line-height:1.35}
    #engine.resultsDesk .playerScaleExplainer{color:#a9bdc8;font-size:9px;line-height:1.45;margin-top:8px}
    #engine.resultsDesk .calibrationGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:9px}
    #engine.resultsDesk .calibrationMetric{border:1px solid #28465a;background:#030a11;padding:10px}
    #engine.resultsDesk .calibrationMetric .key{color:#91aab8;font-size:8px}
    #engine.resultsDesk .calibrationMetric b{display:block;color:var(--results-accent);font-size:21px;margin-top:5px}
    #engine.resultsDesk .calibrationNote{color:#859aa6;font-size:8px;line-height:1.45;margin-top:7px}
    @media(max-width:760px){#engine.resultsDesk .playerScaleGrid{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media(max-width:560px){#engine.resultsDesk .calibrationGrid{grid-template-columns:1fr}#engine.resultsDesk .playerScaleCard b{font-size:25px}}
  `;
  d.head.appendChild(s);
}

function scaleValue(analytics,unitCad){
  const rows=Array.isArray(analytics?.playerScale)?analytics.playerScale:[];
  const row=rows.find(x=>Number(x.fullUnitCad)===unitCad);
  if(row&&Number.isFinite(Number(row.cashValueCad)))return Number(row.cashValueCad);
  const net=Number(analytics?.netUnits);
  return Number(analytics?.pricedBets)>0&&Number.isFinite(net)?net*unitCad:null;
}

function apply(d,index){
  const engine=d.getElementById('engine');
  if(!engine?.classList.contains('resultsDesk'))return false;
  const hero=engine.querySelector('.resultsValueHero');
  const main=hero?.querySelector('.valueMain');
  const stack=hero?.querySelector('.valueMetricStack');
  const proof=engine.querySelector('.proofBox');
  if(!hero||!main||!stack||!proof)return false;
  ensureStyle(d);
  if(main.querySelector('.playerValueAmount')&&engine.querySelector('#resultsPlayerScaleBox'))return true;

  const a=index?.playerValueAnalytics||{};
  const pa=index?.priceAnalytics||{};
  const priced=Number(a.pricedBets||0);
  const net=Number(a.netUnits);
  const roi=Number(a.roiPct);
  const hundred=scaleValue(a,100);
  const hasSample=priced>0&&Number.isFinite(hundred);

  const title=hero.querySelector('.resultsTitle');
  const sub=hero.querySelector('.resultsSub');
  if(title)title.textContent='🧠 VIGSCOPE // PLAYER VALUE 🧠';
  if(sub)sub.textContent='ISSUED BET SIZING // STANDARDIZED PLAYER SCALE // CALIBRATION KEPT SEPARATE';

  main.innerHTML=`
    <div class="valueLabel">VIGSCOPE PLAYER VALUE</div>
    <div class="playerValueAmount ${valueClass(hundred)}">${hasSample?esc(cash(hundred)):'—'}</div>
    <div class="playerValueLabel">FOR A $100 FULL-UNIT PLAYER</div>
    <div class="playerValueRule">$100 PLAYER = 1.00u IS $100. VIGSCOPE'S ISSUED FRACTIONAL / PARTIAL / FULL SIZING IS PRESERVED — EVERY BET IS NOT FORCED TO $100.</div>
    <div class="playerValueNote">${hasSample?'CASH VALUE REPLAYS SETTLED, PRICE-RESOLVABLE BETS AT THEIR ISSUED STAKE FRACTION.':'NO SETTLED PRICE-RESOLVABLE BET WITH NON-ZERO ISSUED STAKE IS IN THIS RESULTS WINDOW YET. PLAYER VALUE WILL POPULATE AUTOMATICALLY WHEN ONE SETTLES.'}</div>
  `;
  stack.innerHTML=`
    <div class="playerMetric"><b class="${valueClass(net)}">${priced?esc(signed(net,2))+'u':'—'}</b><div class="key">SIZED NET RESULT</div></div>
    <div class="playerMetric"><b class="${valueClass(roi)}">${priced?esc(pct(roi)):'—'}</b><div class="key">SIZED ROI</div></div>
    <div class="playerMetric cyan"><b>${priced}</b><div class="key">PRICED SETTLED BETS</div></div>
  `;

  engine.querySelector('#resultsPlayerScaleBox')?.remove();
  engine.querySelector('#resultsCalibrationBox')?.remove();
  const scale=d.createElement('div');
  scale.id='resultsPlayerScaleBox';
  scale.className='playerScaleBox';
  scale.innerHTML=`
    <div class="resultsSection">PLAYER SCALE // SAME VIGSCOPE SIZING, BIGGER FULL UNIT</div>
    <div class="playerScaleGrid">
      ${[100,250,500,1000].map((unit,i)=>{const v=scaleValue(a,unit);return `<div class="playerScaleCard ${i===0?'anchor':''}"><div class="key">$${unit.toLocaleString('en-CA')} FULL UNIT</div><b class="${valueClass(v)}">${priced?esc(cash(v)):'—'}</b><span>1.00u = $${unit.toLocaleString('en-CA')} // FRACTIONAL STAKES SCALE WITH IT</span></div>`}).join('')}
    </div>
    <div class="playerScaleExplainer">A $250-unit player is 2.5× the $100-unit player, a $500-unit player is 5×, and a $1,000-unit player is 10×. The underlying VigScope stake fractions stay identical.</div>
  `;
  proof.insertAdjacentElement('beforebegin',scale);

  const calibration=d.createElement('div');
  calibration.id='resultsCalibrationBox';
  calibration.className='calibrationBox';
  calibration.innerHTML=`
    <div class="resultsSection">MODEL CALIBRATION // FLAT 1u TEST</div>
    <div class="calibrationGrid">
      <div class="calibrationMetric"><div class="key">PRICED CARDS</div><b>${Number(pa.pricedCards||0)}</b></div>
      <div class="calibrationMetric"><div class="key">FLAT NET</div><b class="${valueClass(pa.netUnits)}">${esc(signed(pa.netUnits,2))}u</b></div>
      <div class="calibrationMetric"><div class="key">FLAT ROI</div><b class="${valueClass(pa.roiPct)}">${esc(pct(pa.roiPct))}</b></div>
    </div>
    <div class="calibrationNote">THIS IS THE EXISTING 1-UNIT-PER-PRICED-CARD CALIBRATION TEST. IT IS USEFUL MODEL EVIDENCE, BUT IT IS NOT USED TO CALCULATE THE $100-PLAYER CASH VALUE ABOVE.</div>
  `;
  scale.insertAdjacentElement('afterend',calibration);
  return true;
}

async function loadIndex(){
  if(loading)return;
  loading=true;
  try{
    const r=await fetch(`${INDEX_URL}?v=${Date.now()}`,{cache:'no-store'});
    if(r.ok)cached=await r.json();
  }catch(e){}
  loading=false;
}

function patch(){
  const d=appDoc();
  if(!d)return false;
  if(cached)apply(d,cached);
  return true;
}

loadIndex().then(patch);
let tries=0;
const boot=setInterval(()=>{
  tries+=1;
  patch();
  if(!cached&&!loading)loadIndex().then(patch);
  if((cached&&patch())||tries>250)clearInterval(boot);
},60);
setInterval(()=>{patch();if(!cached&&!loading)loadIndex().then(patch)},600);
setInterval(()=>{loadIndex().then(patch)},60000);
})();
