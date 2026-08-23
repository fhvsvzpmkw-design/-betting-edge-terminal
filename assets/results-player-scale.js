(()=>{
'use strict';

const STYLE_ID='resultsValuePresentationV3';
const INDEX_URL='./data/history/results-index.json';
const VERSION='3';
let cached=null;
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
function finite(v){return v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))}
function signed(v,d=2){const n=Number(v);return finite(v)?`${n>0?'+':''}${n.toFixed(d)}`:'—'}
function pct(v){const n=Number(v);return finite(v)?`${n>0?'+':''}${n.toFixed(2)}%`:'—'}
function cash(v){if(!finite(v))return '—';const n=Number(v),sign=n>0?'+':n<0?'-':'';return `${sign}$${Math.abs(n).toFixed(2)}`}
function valueClass(v){return !finite(v)?'neutral':Number(v)>0?'positive':Number(v)<0?'negative':'neutral'}
function gradeText(row){const g=row?.grades||{};return `${Number(g.WIN||0)}-${Number(g.LOSS||0)}`}

function ensureStyle(d){
  if(d.getElementById(STYLE_ID))return;
  const s=d.createElement('style');
  s.id=STYLE_ID;
  s.textContent=`
    :root{--value-steel:#6f8faa;--value-silver:#c7d2dc;--value-muted:#8ea0af;--value-line:#35506a;--value-panel:#08111b;--value-panel2:#0b1622;--value-gold:#d8b45a}
    body.runnerMenuHome .runnerNavPad .tabs>.btn[data-view="engine"],
    body.runnerPrimaryViewLoaded[data-primary-view="engine"] .runnerNavPad .tabs>.btn.primaryShellActive{border-color:var(--value-steel)!important;color:var(--value-silver)!important;background:#09131d!important;box-shadow:inset 0 0 0 1px rgba(111,143,170,.10),0 0 12px rgba(111,143,170,.12)!important;text-shadow:none!important}
    body.runnerMenuHome .runnerNavPad .tabs>.btn[data-view="engine"] .primaryMenuMessage,
    body.runnerPrimaryViewLoaded[data-primary-view="engine"] .primaryShellMessage{color:var(--value-muted)!important}

    #engine.resultsDesk{--results-accent:var(--value-steel)!important;--results-soft:var(--value-silver)!important;--rline:var(--value-line)!important;--rpanel:var(--value-panel)!important;--rpanel2:var(--value-panel2)!important}
    #engine.resultsDesk .resultsValueHero{border-color:var(--value-steel)!important;background:radial-gradient(circle at 14% 8%,rgba(111,143,170,.08),transparent 34%),linear-gradient(180deg,#0a141f,#050a10)!important;box-shadow:0 0 18px rgba(111,143,170,.09),inset 0 0 22px rgba(199,210,220,.015)!important}
    #engine.resultsDesk .resultsTitle,#engine.resultsDesk .resultsSection{color:var(--value-silver)!important;text-shadow:none!important}
    #engine.resultsDesk .resultsSub,#engine.resultsDesk .resultsNote,#engine.resultsDesk .key{color:var(--value-muted)!important}
    #engine.resultsDesk .valueMain{border-color:#58738a!important;background:linear-gradient(180deg,#0a151f,#050b11)!important;box-shadow:inset 0 0 18px rgba(111,143,170,.035)!important}
    #engine.resultsDesk .valueMetric,#engine.resultsDesk .valueMetric.cyan{border-color:#405b72!important;background:linear-gradient(180deg,#0a151f,#050b11)!important}
    #engine.resultsDesk .valueMetric.cyan b{color:var(--value-silver)!important}
    #engine.resultsDesk .proofBox,#engine.resultsDesk .auditBox,#engine.resultsDesk .resultsBox{border-color:var(--value-line)!important;background:var(--value-panel)!important}
    #engine.resultsDesk .proofCard{border-color:#3d566b!important;background:#060d14!important}
    #engine.resultsDesk .proofCard.good{border-color:#426f4a!important;background:linear-gradient(180deg,#0a160d,#050b08)!important}
    #engine.resultsDesk .proofCard.warn{border-color:#75602c!important;background:linear-gradient(180deg,#171308,#090804)!important}
    #engine.resultsDesk .proofCard:not(.good):not(.warn) b{color:var(--value-silver)!important}
    #engine.resultsDesk .auditStat{border-color:#334c61!important;background:#060d14!important}
    #engine.resultsDesk .auditNotice{border-color:#334c61!important;background:#050b11!important;color:var(--value-muted)!important}
    #engine.resultsDesk .resultsCtl{border-color:#4a657b!important;color:#b9c6d0!important;background:#07111a!important}
    #engine.resultsDesk .resultsCtl.active{background:var(--value-steel)!important;color:#071019!important;border-color:var(--value-steel)!important}
    #engine.resultsDesk th{color:#9aabba!important}
    #engine.resultsDesk th,#engine.resultsDesk td{border-top-color:#294256!important}
    #engine.resultsDesk .barTrack{border-left-color:#40566a!important;background:#111a22!important}

    #engine.resultsDesk .actualPlayerState{font-size:clamp(28px,4.7vw,54px);font-weight:950;line-height:1.02;letter-spacing:.015em;color:var(--value-silver);margin-top:15px}
    #engine.resultsDesk .actualPlayerCash{font-size:clamp(48px,7.5vw,84px);font-weight:950;line-height:.95;letter-spacing:-.04em;margin-top:13px;text-shadow:0 0 16px currentColor}
    #engine.resultsDesk .actualPlayerCash.positive,#engine.resultsDesk .decisionBig.positive,#engine.resultsDesk .decisionMetric b.positive,#engine.resultsDesk .decisionStatusCash.positive{color:var(--green)}
    #engine.resultsDesk .actualPlayerCash.negative,#engine.resultsDesk .decisionBig.negative,#engine.resultsDesk .decisionMetric b.negative,#engine.resultsDesk .decisionStatusCash.negative{color:var(--red)}
    #engine.resultsDesk .actualPlayerCash.neutral,#engine.resultsDesk .decisionBig.neutral,#engine.resultsDesk .decisionMetric b.neutral,#engine.resultsDesk .decisionStatusCash.neutral{color:var(--value-silver)}
    #engine.resultsDesk .actualPlayerLabel{color:var(--value-silver);font-size:clamp(12px,1.7vw,19px);font-weight:950;letter-spacing:.07em;margin-top:7px}
    #engine.resultsDesk .actualPlayerRule{color:#aebbc5;font-size:9px;line-height:1.5;margin-top:10px;font-weight:800}
    #engine.resultsDesk .actualPlayerNote{color:var(--value-muted);font-size:9px;line-height:1.45;margin-top:5px}
    #engine.resultsDesk .actualNoBetBadge{display:inline-block;border:1px solid var(--value-gold);color:#e0c377;background:#171308;padding:4px 7px;font-size:8px;font-weight:950;letter-spacing:.07em;margin-top:9px}

    #engine.resultsDesk .decisionValueBox,#engine.resultsDesk .modelCalibrationBox{border:1px solid var(--value-line);background:var(--value-panel);padding:12px;margin-top:9px}
    #engine.resultsDesk .decisionHead{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
    #engine.resultsDesk .counterBadge,#engine.resultsDesk .modelBadge{border:1px solid var(--value-gold);color:#e0c377;background:#171308;padding:3px 7px;font-size:8px;font-weight:950;letter-spacing:.07em;white-space:nowrap}
    #engine.resultsDesk .decisionHero{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(270px,.85fr);gap:10px;margin-top:10px}
    #engine.resultsDesk .decisionMain{border:1px solid #57606b;background:linear-gradient(180deg,#0d141a,#070b0f);padding:13px;display:flex;flex-direction:column;justify-content:center}
    #engine.resultsDesk .decisionBig{font-size:clamp(42px,6.5vw,72px);font-weight:950;line-height:.95;letter-spacing:-.035em;margin-top:8px;text-shadow:0 0 14px currentColor}
    #engine.resultsDesk .decisionLabel{color:var(--value-silver);font-size:11px;font-weight:950;letter-spacing:.07em;margin-top:7px}
    #engine.resultsDesk .decisionSub{color:var(--value-muted);font-size:8px;line-height:1.5;margin-top:6px}
    #engine.resultsDesk .decisionMetrics{display:grid;gap:8px}
    #engine.resultsDesk .decisionMetric{border:1px solid #3b5265;background:#060d14;padding:10px}
    #engine.resultsDesk .decisionMetric b{display:block;font-size:clamp(22px,3vw,32px);margin-top:5px}
    #engine.resultsDesk .decisionMetric.avoided b{color:var(--green)}
    #engine.resultsDesk .decisionMetric.missed b{color:var(--red)}
    #engine.resultsDesk .decisionStatusGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:9px}
    #engine.resultsDesk .decisionStatusCard{border:1px solid #3b5265;background:#060d14;padding:10px;min-height:104px}
    #engine.resultsDesk .decisionStatusCard.lean,#engine.resultsDesk .decisionStatusCard.wait{border-color:#6f5b2c}
    #engine.resultsDesk .decisionStatusName{font-size:11px;font-weight:950;letter-spacing:.06em;color:var(--value-silver)}
    #engine.resultsDesk .decisionStatusCard.lean .decisionStatusName,#engine.resultsDesk .decisionStatusCard.wait .decisionStatusName{color:#e0c377}
    #engine.resultsDesk .decisionStatusCash{font-size:23px;font-weight:950;margin-top:7px}
    #engine.resultsDesk .decisionStatusMeta{color:var(--value-muted);font-size:8px;line-height:1.45;margin-top:5px}
    #engine.resultsDesk .decisionMethod{border-left:3px solid var(--value-gold);padding:7px 9px;background:#0c0e0c;color:#9eaaaf;font-size:8px;line-height:1.5;margin-top:9px}

    #engine.resultsDesk .modelGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:9px}
    #engine.resultsDesk .modelMetric{border:1px solid #3b5265;background:#060d14;padding:11px}
    #engine.resultsDesk .modelMetric .key{color:#9aaab7!important}
    #engine.resultsDesk .modelMetric b{display:block;color:var(--value-silver);font-size:clamp(22px,3vw,31px);margin-top:6px}
    #engine.resultsDesk .modelMethod{color:var(--value-muted);font-size:8px;line-height:1.5;margin-top:8px}

    @media(max-width:760px){#engine.resultsDesk .decisionHero{grid-template-columns:1fr}#engine.resultsDesk .decisionStatusGrid{grid-template-columns:1fr}}
    @media(max-width:560px){#engine.resultsDesk .modelGrid{grid-template-columns:1fr}}
  `;
  d.head.appendChild(s);
}

function statusRow(decision,status){return (decision?.byStatus||[]).find(x=>String(x?.status||'').toUpperCase()===status)||{status,decisions:0,priced:0,grades:{},shadowCashCad:null,decisionValueCad:null}}

function apply(d,index){
  if(applying)return false;
  const engine=d.getElementById('engine');
  if(!engine?.classList.contains('resultsDesk'))return false;
  const hero=engine.querySelector('.resultsValueHero');
  const main=hero?.querySelector('.valueMain');
  const stack=hero?.querySelector('.valueMetricStack');
  const proof=engine.querySelector('.proofBox');
  if(!hero||!main||!stack||!proof)return false;
  ensureStyle(d);
  if(hero.dataset.valuePresentation===VERSION&&engine.querySelector('#resultsDecisionValueBox')&&engine.querySelector('#resultsModelCalibrationBox'))return true;

  applying=true;
  try{
    const player=index?.playerValueAnalytics||{};
    const decision=index?.decisionValueAnalytics||{};
    const pa=index?.priceAnalytics||{};
    const playerPriced=Number(player.pricedBets||0);
    const hasPlayerSample=playerPriced>0;
    const playerCash=hasPlayerSample?Number(player.cashValueCad):0;
    const playerRisk=finite(player.riskCad)?Number(player.riskCad):0;
    const playerNet=hasPlayerSample?Number(player.netUnits):null;
    const playerRoi=hasPlayerSample&&finite(player.roiPct)?Number(player.roiPct):null;

    const title=hero.querySelector('.resultsTitle');
    const sub=hero.querySelector('.resultsSub');
    if(title)title.textContent='VIGSCOPE // $100 PLAYER VALUE';
    if(sub)sub.textContent='ACTUAL BET PERFORMANCE // DECISION VALUE // MODEL CALIBRATION';
    hero.dataset.valuePresentation=VERSION;

    main.innerHTML=`
      <div class="valueLabel">ACTUAL $100 PLAYER PERFORMANCE</div>
      ${hasPlayerSample?'':`<div class="actualPlayerState">NO ISSUED PLAYS YET</div>`}
      <div class="actualPlayerCash ${valueClass(playerCash)}">${esc(cash(playerCash))}</div>
      <div class="actualPlayerLabel">SETTLED P/L ON ISSUED BETS</div>
      <div class="actualPlayerRule">$100 DEFINES THE FULL-UNIT REFERENCE ONLY. ACTUAL VIGSCOPE BETS ARE SCALED FROM THE ISSUED BETTING EDGE STAKE: ISSUED STAKE ÷ 3% OF THAT REPORT BANKROLL × $100.</div>
      <div class="actualPlayerNote">${hasPlayerSample
        ?`${esc(cash(playerRisk))} STANDARDIZED RISK // ${Number(player.settledBets||0)} SETTLED BETS // ACTUAL ISSUED STAKE FRACTIONS PRESERVED.`
        :'0 SETTLED BETS // $0.00 STANDARDIZED RISK // NON-BET STATUSES DO NOT COUNT AS REALIZED PLAYER PROFIT.'}</div>
      ${hasPlayerSample?'':'<div class="actualNoBetBadge">PLAYER PERFORMANCE STARTS WITH THE FIRST SETTLED ISSUED BET</div>'}
    `;
    stack.innerHTML=`
      <div class="valueMetric"><b class="${valueClass(playerNet)}">${hasPlayerSample?esc(signed(playerNet,2))+'u':'—'}</b><div class="key">SIZED NET RESULT</div></div>
      <div class="valueMetric"><b class="${valueClass(playerRoi)}">${hasPlayerSample?esc(pct(playerRoi)):'—'}</b><div class="key">SIZED ROI</div></div>
      <div class="valueMetric cyan"><b>${Number(player.settledBets||0)}</b><div class="key">SETTLED ISSUED BETS</div></div>
    `;

    engine.querySelector('#resultsHundredUnitBox')?.remove();
    engine.querySelector('#resultsPlayerScaleBox')?.remove();
    engine.querySelector('#resultsCalibrationBox')?.remove();
    engine.querySelector('#resultsDecisionValueBox')?.remove();
    engine.querySelector('#resultsModelCalibrationBox')?.remove();

    const lean=statusRow(decision,'LEAN'),wait=statusRow(decision,'WAIT'),pass=statusRow(decision,'PASS');
    const hasDecisionSample=Number(decision.pricedFinalDecisions||0)>0;
    const decisionBox=d.createElement('div');
    decisionBox.id='resultsDecisionValueBox';
    decisionBox.className='decisionValueBox';
    decisionBox.innerHTML=`
      <div class="decisionHead"><div><div class="resultsSection">DECISION VALUE // SHADOW REVIEW</div><div class="resultsNote">WHAT VIGSCOPE'S NON-BET DECISIONS MAY HAVE PROTECTED OR LEFT ON THE TABLE.</div></div><div class="counterBadge">COUNTERFACTUAL</div></div>
      <div class="decisionHero">
        <div class="decisionMain">
          <div class="key">NET DECISION VALUE</div>
          <div class="decisionBig ${valueClass(decision.netDecisionCad)}">${hasDecisionSample?esc(cash(decision.netDecisionCad)):'—'}</div>
          <div class="decisionLabel">LOSSES AVOIDED − PROFITABLE OPPORTUNITIES PASSED UP</div>
          <div class="decisionSub">POSITIVE = FILTERING PROTECTED MORE VALUE THAN IT MISSED. NEGATIVE = THE NON-BET FILTERS LEFT MORE PROFITABLE SHADOW VALUE ON THE TABLE.</div>
        </div>
        <div class="decisionMetrics">
          <div class="decisionMetric avoided"><div class="key">LOSSES AVOIDED</div><b>${hasDecisionSample?esc(cash(decision.lossAvoidedCad)):'—'}</b></div>
          <div class="decisionMetric missed"><div class="key">OPPORTUNITY MISSED</div><b>${hasDecisionSample?'-'+esc(cash(Math.abs(Number(decision.opportunityMissedCad||0))).replace(/^\+/,'')):'—'}</b></div>
          <div class="decisionMetric"><div class="key">UNIQUE PRICED DECISIONS</div><b class="neutral">${Number(decision.pricedFinalDecisions||0)}</b></div>
        </div>
      </div>
      <div class="decisionStatusGrid">
        ${[lean,wait,pass].map(row=>`<div class="decisionStatusCard ${String(row.status||'').toLowerCase()}"><div class="decisionStatusName">${esc(row.status)} DECISION VALUE</div><div class="decisionStatusCash ${valueClass(row.decisionValueCad)}">${finite(row.decisionValueCad)?esc(cash(row.decisionValueCad)):'—'}</div><div class="decisionStatusMeta">${Number(row.priced||0)} PRICED UNIQUE DECISIONS // ${esc(gradeText(row))} W-L<br>SHADOW RESULT IF PLAYED: ${finite(row.shadowCashCad)?esc(cash(row.shadowCashCad)):'—'}</div></div>`).join('')}
      </div>
      <div class="decisionMethod">ONE FINAL NON-BET DECISION PER UNIQUE SELECTION IS COUNTED, SO REPEATED REPORT-LANE APPEARANCES DO NOT INFLATE THE HEADLINE. SHADOW REVIEW ASSUMES ONE FLAT $100 FULL-UNIT RISK AT THAT FINAL EXACT ISSUED PRICE. THIS IS REVIEW / CALIBRATION EVIDENCE, NOT ACTUAL PLAYER P/L.</div>
    `;
    proof.insertAdjacentElement('beforebegin',decisionBox);

    const calibration=d.createElement('div');
    calibration.id='resultsModelCalibrationBox';
    calibration.className='modelCalibrationBox';
    calibration.innerHTML=`
      <div class="decisionHead"><div><div class="resultsSection">MODEL CALIBRATION // FLAT 1u TEST</div><div class="resultsNote">BROAD PRICE-ADJUSTED ENGINE TEST KEPT SEPARATE FROM PLAYER P/L AND DECISION VALUE.</div></div><div class="modelBadge">MODEL</div></div>
      <div class="modelGrid">
        <div class="modelMetric"><div class="key">FLAT NET</div><b>${esc(signed(pa.netUnits,2))}u</b></div>
        <div class="modelMetric"><div class="key">FLAT ROI</div><b>${esc(pct(pa.roiPct))}</b></div>
        <div class="modelMetric"><div class="key">PRICED CARDS</div><b>${Number(pa.pricedCards||0)}</b></div>
      </div>
      <div class="modelMethod">FLAT 1-UNIT RISK PER PRICE-RESOLVABLE COMPLETED CARD. THIS REMAINS USEFUL MODEL CALIBRATION, BUT IT DOES NOT REPRESENT CASH WON BY A $100 PLAYER.</div>
    `;
    decisionBox.insertAdjacentElement('afterend',calibration);
    return true;
  }finally{
    applying=false;
  }
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
  if(d.documentElement.dataset.resultsValueObserver===VERSION)return;
  d.documentElement.dataset.resultsValueObserver=VERSION;
  let queued=false;
  const obs=new MutationObserver(()=>{
    if(!cached||queued||applying)return;
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
setInterval(()=>{patch();if(!cached&&!loading)loadIndex().then(patch)},700);
setInterval(()=>{loadIndex().then(patch)},60000);
})();
