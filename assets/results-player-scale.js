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
    #engine.resultsDesk .playerValueAmount.positive,#engine.resultsDesk .playerMetric b.positive{color:var(--green)}
    #engine.resultsDesk .playerValueAmount.negative,#engine.resultsDesk .playerMetric b.negative{color:var(--red)}
    #engine.resultsDesk .playerValueAmount.neutral,#engine.resultsDesk .playerMetric b.neutral{color:var(--results-soft)}
    #engine.resultsDesk .playerValueLabel{color:var(--green);font-size:clamp(13px,1.8vw,21px);font-weight:950;letter-spacing:.07em;margin-top:7px}
    #engine.resultsDesk .playerValueRule{color:#c5d6dd;font-size:10px;line-height:1.5;margin-top:10px;font-weight:800}
    #engine.resultsDesk .playerValueNote{color:#91a7b3;font-size:9px;line-height:1.5;margin-top:5px}
    #engine.resultsDesk .playerMetric{border:1px solid #2d6a5a;background:linear-gradient(180deg,#071813,#030b0a);padding:12px 13px;min-height:68px;display:flex;flex-direction:column;justify-content:center}
    #engine.resultsDesk .playerMetric.cyan{border-color:#23627b;background:linear-gradient(180deg,#06151e,#030a10)}
    #engine.resultsDesk .playerMetric .key{color:#a9c0ca;font-size:9px}
    #engine.resultsDesk .playerMetric b{display:block;font-size:clamp(23px,3vw,36px);line-height:1;margin-bottom:6px}
    #engine.resultsDesk .playerMetric.cyan b{color:var(--results-accent)}
    #engine.resultsDesk .hundredUnitBox{border:1px solid #2d6a5a;background:linear-gradient(180deg,#07150f,#030a08);padding:11px;margin-top:9px;box-shadow:inset 0 0 14px rgba(88,255,136,.025)}
    #engine.resultsDesk .hundredUnitGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:9px}
    #engine.resultsDesk .hundredUnitStake{border:1px solid #315b4d;background:#030b09;padding:10px;text-align:center}
    #engine.resultsDesk .hundredUnitStake .key{color:#9fb7ad;font-size:8px}
    #engine.resultsDesk .hundredUnitStake b{display:block;color:var(--green);font-size:clamp(21px,3vw,31px);margin-top:5px}
    #engine.resultsDesk .hundredUnitExplain{color:#a9bdc8;font-size:9px;line-height:1.5;margin-top:8px}
    #engine.resultsDesk .sampleBadge{display:inline-block;border:1px solid #7b6b2a;color:var(--yellow);background:#171303;padding:3px 6px;font-size:8px;font-weight:900;letter-spacing:.06em;margin-top:8px}
    @media(max-width:560px){#engine.resultsDesk .hundredUnitGrid{grid-template-columns:1fr}}
  `;
  d.head.appendChild(s);
}

function sizedValue(a,unitCad=100){
  const rows=Array.isArray(a?.playerScale)?a.playerScale:[];
  const row=rows.find(x=>Number(x.fullUnitCad)===unitCad);
  if(row&&row.cashValueCad!==null&&row.cashValueCad!==undefined&&Number.isFinite(Number(row.cashValueCad)))return Number(row.cashValueCad);
  const net=Number(a?.netUnits);
  return Number(a?.pricedBets)>0&&Number.isFinite(net)?net*unitCad:null;
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
  if(main.querySelector('.playerValueAmount')&&engine.querySelector('#resultsHundredUnitBox'))return true;

  const a=index?.playerValueAnalytics||{};
  const pa=index?.priceAnalytics||{};
  const sizedPriced=Number(a.pricedBets||0);
  const sizedNet=Number(a.netUnits);
  const sizedRoi=a.roiPct===null||a.roiPct===undefined?null:Number(a.roiPct);
  const actualHundred=sizedValue(a,100);
  const hasSizedSample=sizedPriced>0&&Number.isFinite(actualHundred);

  const calibrationNet=Number(pa.netUnits);
  const calibrationRoi=pa.roiPct===null||pa.roiPct===undefined?null:Number(pa.roiPct);
  const calibrationPriced=Number(pa.pricedCards||0);
  const calibrationHundred=Number.isFinite(calibrationNet)?calibrationNet*100:null;

  const headlineValue=hasSizedSample?actualHundred:calibrationHundred;
  const displayNet=hasSizedSample?sizedNet:calibrationNet;
  const displayRoi=hasSizedSample?sizedRoi:calibrationRoi;
  const displayCount=hasSizedSample?sizedPriced:calibrationPriced;

  const title=hero.querySelector('.resultsTitle');
  const sub=hero.querySelector('.resultsSub');
  if(title)title.textContent='🧠 VIGSCOPE // $100 PLAYER VALUE 🧠';
  if(sub)sub.textContent='$100 FULL UNIT // VIGSCOPE SIZING PRESERVED // PERFORMANCE VALUE';

  main.innerHTML=`
    <div class="valueLabel">VIGSCOPE VALUE</div>
    <div class="playerValueAmount ${valueClass(headlineValue)}">${esc(cash(headlineValue))}</div>
    <div class="playerValueLabel">FOR A $100 FULL-UNIT PLAYER</div>
    <div class="playerValueRule">$100 PLAYER = 1.00u = $100. WHEN VIGSCOPE ISSUES ¼u / ½u / 1u, THAT MEANS $25 / $50 / $100 — EVERY BET IS NOT FORCED TO $100.</div>
    <div class="playerValueNote">${hasSizedSample
      ?'SIZED CASH RESULT REPLAYS SETTLED, PRICE-RESOLVABLE VIGSCOPE BETS AT THEIR ISSUED STAKE FRACTION.'
      :'CURRENTLY SHOWN FROM THE PRICE-ADJUSTED MODEL CALIBRATION BECAUSE THIS RESULTS WINDOW HAS NO SETTLED ISSUED BET WITH NON-ZERO STAKE YET. THIS IS MODEL VALUE, NOT OFFICIAL SETTLED BETTING PROFIT.'}</div>
    ${hasSizedSample?'':'<div class="sampleBadge">SIZED BET SAMPLE: 0 SETTLED BETS</div>'}
  `;

  stack.innerHTML=`
    <div class="playerMetric"><b class="${valueClass(displayNet)}">${esc(signed(displayNet,2))}u</b><div class="key">${hasSizedSample?'SIZED NET RESULT':'MODEL CALIBRATION NET'}</div></div>
    <div class="playerMetric"><b class="${valueClass(displayRoi)}">${esc(pct(displayRoi))}</b><div class="key">${hasSizedSample?'SIZED ROI':'MODEL CALIBRATION ROI'}</div></div>
    <div class="playerMetric cyan"><b>${displayCount}</b><div class="key">${hasSizedSample?'PRICED SETTLED BETS':'PRICED CARDS'}</div></div>
  `;

  engine.querySelector('#resultsPlayerScaleBox')?.remove();
  engine.querySelector('#resultsCalibrationBox')?.remove();
  engine.querySelector('#resultsHundredUnitBox')?.remove();

  const box=d.createElement('div');
  box.id='resultsHundredUnitBox';
  box.className='hundredUnitBox';
  box.innerHTML=`
    <div class="resultsSection">$100 PLAYER SIZING // ONE STANDARD, VARIABLE BET SIZE</div>
    <div class="hundredUnitGrid">
      <div class="hundredUnitStake"><div class="key">¼ UNIT</div><b>$25</b></div>
      <div class="hundredUnitStake"><div class="key">½ UNIT</div><b>$50</b></div>
      <div class="hundredUnitStake"><div class="key">1 FULL UNIT</div><b>$100</b></div>
    </div>
    <div class="hundredUnitExplain">THE $100 LABEL DEFINES THE FULL UNIT ONLY. VIGSCOPE'S ACTUAL ISSUED FRACTION CONTROLS THE DOLLAR RISK ON EACH BET. WHEN A SIZED BET SAMPLE EXISTS, THE HEADLINE ABOVE AUTOMATICALLY USES THAT SIZED RESULT; UNTIL THEN IT SHOWS THE SEPARATELY LABELLED MODEL CALIBRATION VALUE.</div>
  `;
  proof.insertAdjacentElement('beforebegin',box);
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
function ensureObserver(d){
  if(d.documentElement.dataset.resultsPlayerScaleObserver==='2')return;
  d.documentElement.dataset.resultsPlayerScaleObserver='2';
  let queued=false;
  const obs=new MutationObserver(()=>{
    if(!cached||queued)return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;apply(d,cached)});
  });
  obs.observe(d.body,{childList:true,subtree:true});
}
function patch(){
  const d=appDoc();
  if(!d)return false;
  ensureObserver(d);
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
