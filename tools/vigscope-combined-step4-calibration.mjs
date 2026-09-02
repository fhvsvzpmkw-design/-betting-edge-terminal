#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT=path.resolve('data/history/runs');
const START=process.env.CALIBRATION_START||'2026-08-15';
const END=process.env.CALIBRATION_END||'2026-09-01';
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,Number(v)||0));
const mean=a=>{const x=(a||[]).filter(Number.isFinite);return x.length?x.reduce((s,v)=>s+v,0)/x.length:null;};
function americanFromText(v){const m=String(v||'').replace(/−/g,'-').match(/[+-]?\d{2,4}/);return m?Number(m[0]):null;}
function americanProb(a){const n=Number(a);if(!Number.isFinite(n)||n===0)return null;return n>0?100/(n+100):(-n)/((-n)+100);}
function signedOdds(v){return [...String(v||'').replace(/−/g,'-').matchAll(/([+-]\d{2,4})(?![\d.])/g)].map(m=>Number(m[1])).filter(Number.isFinite);}
function recWeight(rec){const s=String(rec?.status||'PASS').toUpperCase();return s==='BET'?1.5:s==='LEAN'?1.2:s==='WAIT'?0.8:0.45;}
function moveSignal(rec){
  const issued=americanFromText(rec?.price),pc=rec?.priceComparison;
  if(pc?.state==='MATCHED'){
    const current=americanFromText(pc.price),a=americanProb(issued),b=americanProb(current);
    if(a!==null&&b!==null)return {favor:a-b,magnitude:Math.abs(a-b)};
  }
  const nums=signedOdds(rec?.move);
  if(nums.length>=2){const favors=[],mags=[];for(let i=0;i+1<nums.length;i+=2){const a=americanProb(nums[i]),b=americanProb(nums[i+1]);if(a!==null&&b!==null){favors.push(a-b);mags.push(Math.abs(a-b));}}if(favors.length)return {favor:mean(favors)||0,magnitude:mean(mags)||0};}
  const text=String(rec?.move||'').toUpperCase();
  if(/UNCHANGED|STABLE|FLAT|NO MOVE|HELD/.test(text))return {favor:0,magnitude:0};
  if(/IMPROV|DRIFT|BETTER|EASED/.test(text))return {favor:.005,magnitude:.005};
  if(/WORSEN|SHORTEN|STEAM|EXPENS|AGAINST/.test(text))return {favor:-.005,magnitude:.005};
  return {favor:0,magnitude:0};
}
function thresholdActivity(rec){
  const status=String(rec?.status||'PASS').toUpperCase();if(!['BET','LEAN'].includes(status))return null;
  const play=americanFromText(rec?.playTo||rec?.betAt),current=rec?.priceComparison?.state==='MATCHED'?americanFromText(rec.priceComparison.price):americanFromText(rec?.price);
  const p=americanProb(play),c=americanProb(current);if(p===null||c===null)return null;return clamp(1-Math.abs(c-p)/.03,0,1);
}
function bookOddsFromText(rec,book){const text=[rec?.source,rec?.analysis,rec?.price].filter(Boolean).join(' // ').replace(/−/g,'-');const re=new RegExp(book+'[^+\\-]{0,28}([+-]\\d{2,4})','i'),m=text.match(re);return m?Number(m[1]):null;}
function fallbackAgreement(run){
  const recs=Array.isArray(run?.recs)?run.recs:[],diffs=[];let aligned=0,conflicted=0,stable=0,signals=0;
  for(const rec of recs){
    const a=bookOddsFromText(rec,'Bet365'),b=bookOddsFromText(rec,'DraftKings'),pa=americanProb(a),pb=americanProb(b);if(pa!==null&&pb!==null)diffs.push(Math.abs(pa-pb));
    const text=[rec?.move,rec?.analysis,rec?.source,rec?.contrary].filter(Boolean).join(' ').toUpperCase();if(!text)continue;
    if(/DISAGREE|DIVERG|CONFLICT|SPLIT|OPPOSITE|MIXED BOOK|BOOKS? (?:ARE )?MIXED/.test(text)){conflicted++;signals++;continue;}
    if(/CONVERG|CONSENSUS|AGREE|ALIGNED|IN TANDEM|SAME DIRECTION|BROADLY (?:STEADY|STABLE)/.test(text)){aligned++;signals++;continue;}
    if(/UNCHANGED|STABLE|FLAT|HELD|NO MOVE|STEADY/.test(text)){stable++;signals++;}
  }
  if(diffs.length){const avg=mean(diffs)||0,priceScore=clamp(100-(avg/.10)*100);const qualitative=signals?clamp(50+aligned*12+stable*4-conflicted*18):priceScore;const score=signals?priceScore*.8+qualitative*.2:priceScore;return {score,confidence:clamp(((diffs.length*2+signals)/Math.max(1,recs.length*2))*100),source:'REPORT + BOOKS'};}
  if(!signals)return {score:50,confidence:0,source:'NO COHESION DATA'};
  const score=clamp(50+aligned*14+stable*5-conflicted*20);return {score,confidence:clamp((signals/Math.max(1,recs.length))*70),source:'REPORT COHESION'};
}
function primitive(run){
  const recs=Array.isArray(run?.recs)?run.recs:[],signals=recs.map(r=>({...moveSignal(r),weight:recWeight(r)}));
  const weighted=signals.reduce((n,x)=>n+x.weight,0)||1;
  const favor=signals.reduce((n,x)=>n+x.favor*x.weight,0)/weighted;
  const avgMag=mean(signals.map(x=>x.magnitude))||0;
  const breadth=recs.length?signals.filter(x=>x.magnitude>=.0025).length/recs.length:0;
  const th=recs.map(thresholdActivity).filter(x=>x!==null),threshold=mean(th)||0;
  const agreement=run?.instrumentTelemetry?.agreement||fallbackAgreement(run);
  const agreementScore=clamp(agreement?.score??50),agreementConfidence=clamp(agreement?.confidence??0);
  const dispersion=(100-agreementScore)/100;
  const confidenceFactor=agreementConfidence===0?0:0.50+0.50*Math.sqrt(agreementConfidence/100);
  const heat=clamp((avgMag/.03)*40+breadth*25+threshold*20+dispersion*15*confidenceFactor);
  const pressure=clamp(50+50*Math.tanh(favor/.028));
  const agreementQuality=agreementConfidence===0?'UNMEASURED':agreementConfidence<25?'LIMITED':'SUPPORTED';
  return {heat,pressure,agreementScore,agreementConfidence,agreementQuality,favor};
}
function load(){const rows=[];for(const date of fs.readdirSync(ROOT).sort()){if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<START||date>END)continue;const dir=path.join(ROOT,date);if(!fs.statSync(dir).isDirectory())continue;for(const name of fs.readdirSync(dir).sort()){if(!name.endsWith('.json'))continue;try{const run=JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'));rows.push({date,name,slot:run.slot||null,ts:run.ts||null,...primitive(run)});}catch{}}}return rows;}

const H=['LOW','MEDIUM','HIGH'],P=['ADVERSE','NEUTRAL','FAVORABLE'],A=['LOW','HIGH'];
const ALL=[];for(const h of H)for(const p of P)for(const a of A)ALL.push(`${h}|${p}|${a}`);
function classify(row,t){
  const h=row.heat<t.h1?'LOW':row.heat<t.h2?'MEDIUM':'HIGH';
  const p=row.pressure<t.pLow?'ADVERSE':row.pressure<t.pHigh?'NEUTRAL':'FAVORABLE';
  let a,displayAgreement;
  if(row.agreementConfidence===0){a='LOW';displayAgreement='UNMEASURED';}
  else {a=row.agreementScore>=t.aHigh?'HIGH':'LOW';displayAgreement=a;}
  return {h,p,a,state:`${h}|${p}|${a}`,displayAgreement};
}
function entropy(counts,n){let e=0;for(const c of Object.values(counts)){if(!c)continue;const p=c/n;e-=p*Math.log(p);}return e/Math.log(18);}
function evalCandidate(rows,t){
  const counts=Object.fromEntries(ALL.map(k=>[k,0]));
  const heat={LOW:0,MEDIUM:0,HIGH:0},pressure={ADVERSE:0,NEUTRAL:0,FAVORABLE:0},agreementRender={LOW:0,HIGH:0};
  const agreementMeasured={LOW:0,HIGH:0},agreementQuality={UNMEASURED:0,LIMITED:0,SUPPORTED:0};
  let limitedHigh=0,supportedHigh=0,unmeasuredHigh=0;
  for(const r of rows){const c=classify(r,t);counts[c.state]++;heat[c.h]++;pressure[c.p]++;agreementRender[c.a]++;agreementQuality[r.agreementQuality]++;if(r.agreementConfidence>0)agreementMeasured[c.a]++;if(c.a==='HIGH'&&r.agreementQuality==='LIMITED')limitedHigh++;if(c.a==='HIGH'&&r.agreementQuality==='SUPPORTED')supportedHigh++;if(c.a==='HIGH'&&r.agreementQuality==='UNMEASURED')unmeasuredHigh++;}
  const n=rows.length,occupied=Object.values(counts).filter(Boolean).length,maxCount=Math.max(...Object.values(counts)),ideal=n/18;
  const rmse=Math.sqrt(Object.values(counts).reduce((s,c)=>s+(c-ideal)**2,0)/18);
  const heatPenalty=Object.values(heat).reduce((s,c)=>s+Math.abs(c/n-1/3),0);
  const pressurePenalty=Object.values(pressure).reduce((s,c)=>s+Math.abs(c/n-1/3),0);
  const measuredN=agreementMeasured.LOW+agreementMeasured.HIGH;
  const measuredAgreementPenalty=measuredN?Math.abs(agreementMeasured.HIGH/measuredN-.45):1;
  return {thresholds:t,occupied,unused:18-occupied,normalizedEntropy:+entropy(counts,n).toFixed(4),rmse:+rmse.toFixed(3),maxCount,maxShare:+(maxCount/n).toFixed(4),marginals:{heat,pressure,agreementRender,agreementMeasured,agreementQuality},highEvidence:{limitedHigh,supportedHigh,unmeasuredHigh},counts,penalties:{heat:+heatPenalty.toFixed(4),pressure:+pressurePenalty.toFixed(4),measuredAgreement:+measuredAgreementPenalty.toFixed(4)}};
}
function qualifies(e,n){
  const h=Object.values(e.marginals.heat),p=Object.values(e.marginals.pressure),meas=e.marginals.agreementMeasured;
  return h.every(c=>c>=n*.20)&&p.every(c=>c>=n*.18)&&e.highEvidence.unmeasuredHigh===0&&meas.HIGH>=15&&meas.LOW>=20;
}
function score(e){
  // Distribution is important but subordinate to truthful/symmetric semantics already enforced by the search space.
  return e.normalizedEntropy*100 + e.occupied*2 - e.maxShare*25 - e.penalties.heat*8 - e.penalties.pressure*8 - e.penalties.measuredAgreement*5;
}
const rows=load();if(!rows.length)throw new Error('No reports');
const candidates=[];
for(let h1=15;h1<=30;h1+=5)for(let h2=35;h2<=55;h2+=5){if(h2-h1<15)continue;
  for(let width=2;width<=10;width+=1){const pLow=50-width,pHigh=50+width;
    for(const aHigh of [45,50,55,60]){const e=evalCandidate(rows,{h1,h2,pLow,pHigh,aHigh,unmeasuredRender:'LOW'});if(!qualifies(e,rows.length))continue;e.objective=+score(e).toFixed(4);candidates.push(e);}
  }
}
candidates.sort((a,b)=>b.objective-a.objective||b.normalizedEntropy-a.normalizedEntropy||a.maxShare-b.maxShare);
const top=candidates.slice(0,12);
const selected=top[0];
if(!selected)throw new Error('No Step 4 candidate satisfied semantic constraints');

const output={
  state:'PASS',mode:'READ_ONLY_COMBINED_VIG_STEP4_CALIBRATION',period:{start:START,end:END,reports:rows.length,dates:new Set(rows.map(r=>r.date)).size},
  lockedMeters:{
    heat:'HEAT_CONFIDENCE_50_SQRT_50',
    pressure:'PRESSURE_TANH_014',
    agreement:'AGREEMENT_TWO_AXIS_EVIDENCE_AWARE'
  },
  searchConstraints:{
    heatThresholds:'rounded 5-point values; each heat bucket must contain at least 20% of reports',
    pressureThresholds:'strictly symmetric around neutral 50; each pressure bucket must contain at least 18% of reports',
    agreementHighThresholds:[45,50,55,60],
    agreementMeasuredBalance:'at least 15 measured HIGH and 20 measured LOW',
    unmeasuredHighAllowed:false,
    unmeasuredGraphicMapping:'LOW branch only, while displayed Agreement state remains UNMEASURED'
  },
  selected,
  topCandidates:top,
  interpretation:{
    unmeasured:'UNMEASURED is not semantically LOW. LOW is only the conservative render branch used to preserve the 18-graphic architecture; the visible Agreement label must remain UNMEASURED.',
    agreement:'The HIGH threshold applies only when confidence > 0. Evidence quality remains separately visible as LIMITED or SUPPORTED.',
    distribution:'The objective improves use of the 18 graphics only after semantic constraints are satisfied; it does not force equal use.'
  },
  notes:['Read-only Step 4 study. No terminal formula, thresholds, graphics, or reports are modified.']
};
console.log(JSON.stringify(output,null,2));
