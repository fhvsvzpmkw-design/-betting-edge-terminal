#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT=path.resolve('data/history/runs');
const START=process.env.CALIBRATION_START||'2026-08-15';
const END=process.env.CALIBRATION_END||'2026-09-01';
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,Number(v)||0));
const mean=a=>{const x=(a||[]).filter(Number.isFinite);return x.length?x.reduce((s,v)=>s+v,0)/x.length:null;};
function quantile(values,q){const a=[...values].filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return null;const p=(a.length-1)*q,l=Math.floor(p),h=Math.ceil(p),w=p-l;return a[l]*(1-w)+a[h]*w;}
function summary(values){const a=values.filter(Number.isFinite);return {min:+Math.min(...a).toFixed(4),p10:+quantile(a,.1).toFixed(4),p25:+quantile(a,.25).toFixed(4),median:+quantile(a,.5).toFixed(4),p75:+quantile(a,.75).toFixed(4),p90:+quantile(a,.9).toFixed(4),max:+Math.max(...a).toFixed(4)};}
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
  if(nums.length>=2){
    const favors=[],mags=[];
    for(let i=0;i+1<nums.length;i+=2){
      const a=americanProb(nums[i]),b=americanProb(nums[i+1]);
      if(a!==null&&b!==null){favors.push(a-b);mags.push(Math.abs(a-b));}
    }
    if(favors.length)return {favor:mean(favors)||0,magnitude:mean(mags)||0};
  }
  const text=String(rec?.move||'').toUpperCase();
  if(/UNCHANGED|STABLE|FLAT|NO MOVE|HELD/.test(text))return {favor:0,magnitude:0};
  if(/IMPROV|DRIFT|BETTER|EASED/.test(text))return {favor:.005,magnitude:.005};
  if(/WORSEN|SHORTEN|STEAM|EXPENS|AGAINST/.test(text))return {favor:-.005,magnitude:.005};
  return {favor:0,magnitude:0};
}
function thresholdActivity(rec){
  const status=String(rec?.status||'PASS').toUpperCase();
  if(!['BET','LEAN'].includes(status))return null;
  const play=americanFromText(rec?.playTo||rec?.betAt);
  const current=rec?.priceComparison?.state==='MATCHED'?americanFromText(rec.priceComparison.price):americanFromText(rec?.price);
  const p=americanProb(play),c=americanProb(current);
  if(p===null||c===null)return null;
  return clamp(1-Math.abs(c-p)/.03,0,1);
}
function bookOddsFromText(rec,book){
  const text=[rec?.source,rec?.analysis,rec?.price].filter(Boolean).join(' // ').replace(/−/g,'-');
  const re=new RegExp(book+'[^+\\-]{0,28}([+-]\\d{2,4})','i'),m=text.match(re);
  return m?Number(m[1]):null;
}
function fallbackAgreement(run){
  const recs=Array.isArray(run?.recs)?run.recs:[],diffs=[];
  let aligned=0,conflicted=0,stable=0,signals=0;
  for(const rec of recs){
    const a=bookOddsFromText(rec,'Bet365'),b=bookOddsFromText(rec,'DraftKings'),pa=americanProb(a),pb=americanProb(b);
    if(pa!==null&&pb!==null)diffs.push(Math.abs(pa-pb));
    const text=[rec?.move,rec?.analysis,rec?.source,rec?.contrary].filter(Boolean).join(' ').toUpperCase();
    if(!text)continue;
    if(/DISAGREE|DIVERG|CONFLICT|SPLIT|OPPOSITE|MIXED BOOK|BOOKS? (?:ARE )?MIXED/.test(text)){conflicted++;signals++;continue;}
    if(/CONVERG|CONSENSUS|AGREE|ALIGNED|IN TANDEM|SAME DIRECTION|BROADLY (?:STEADY|STABLE)/.test(text)){aligned++;signals++;continue;}
    if(/UNCHANGED|STABLE|FLAT|HELD|NO MOVE|STEADY/.test(text)){stable++;signals++;}
  }
  if(diffs.length){
    const avg=mean(diffs)||0,priceScore=clamp(100-(avg/.10)*100);
    const qualitative=signals?clamp(50+aligned*12+stable*4-conflicted*18):priceScore;
    const score=signals?priceScore*.8+qualitative*.2:priceScore;
    return {score,confidence:clamp(((diffs.length*2+signals)/Math.max(1,recs.length*2))*100),source:'REPORT + BOOKS'};
  }
  if(!signals)return {score:50,confidence:0,source:'NO COHESION DATA'};
  const score=clamp(50+aligned*14+stable*5-conflicted*20);
  return {score,confidence:clamp((signals/Math.max(1,recs.length))*70),source:'REPORT COHESION'};
}
function primitive(run){
  const recs=Array.isArray(run?.recs)?run.recs:[],signals=recs.map(r=>({...moveSignal(r),weight:recWeight(r)}));
  const avgMag=mean(signals.map(x=>x.magnitude))||0;
  const breadth=recs.length?signals.filter(x=>x.magnitude>=.0025).length/recs.length:0;
  const th=recs.map(thresholdActivity).filter(x=>x!==null),threshold=mean(th)||0;
  const agreement=run?.instrumentTelemetry?.agreement||fallbackAgreement(run);
  return {avgMag,breadth,threshold,agreementScore:clamp(agreement?.score??50),agreementConfidence:clamp(agreement?.confidence??0),agreementSource:agreement?.source||'UNKNOWN'};
}
function load(){
  const rows=[];
  for(const date of fs.readdirSync(ROOT).sort()){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<START||date>END)continue;
    const dir=path.join(ROOT,date);if(!fs.statSync(dir).isDirectory())continue;
    for(const name of fs.readdirSync(dir).sort()){
      if(!name.endsWith('.json'))continue;
      try{const run=JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'));rows.push({date,name,ts:run.ts||null,slot:run.slot||null,...primitive(run)});}catch{}
    }
  }
  return rows;
}
function corr(a,b){const ma=mean(a),mb=mean(b);let n=0,da=0,db=0;for(let i=0;i<a.length;i++){const x=a[i]-ma,y=b[i]-mb;n+=x*y;da+=x*x;db+=y*y;}return da&&db?+(n/Math.sqrt(da*db)).toFixed(5):null;}
function classifyHeat(v){return v<40?'LOW':v<55?'MEDIUM':'HIGH';}
function bins(values){const out={'0-19':0,'20-39':0,'40-60':0,'61-80':0,'81-100':0};for(const v of values){if(v<20)out['0-19']++;else if(v<40)out['20-39']++;else if(v<=60)out['40-60']++;else if(v<=80)out['61-80']++;else out['81-100']++;}return out;}
function bucket(rows,pred,field){const x=rows.filter(pred);return {n:x.length,mean:+(mean(x.map(r=>r[field]))??0).toFixed(4),median:+(quantile(x.map(r=>r[field]),.5)??0).toFixed(4)};}
function evaluateVariant(rows,key){
  const current=rows.map(r=>r.heatCurrent),candidate=rows.map(r=>r[key]);
  const deltas=rows.map(r=>r[key]-r.heatCurrent);
  const changed=rows.filter(r=>classifyHeat(r[key])!==classifyHeat(r.heatCurrent));
  return {
    summary:summary(candidate),bins:bins(candidate),correlationToCurrent:corr(current,candidate),
    meanAbsDelta:+mean(deltas.map(Math.abs)).toFixed(4),
    saturationLow:candidate.filter(v=>v<=5).length,saturationHigh:candidate.filter(v=>v>=95).length,
    classificationChangesAtCurrentThresholds:changed.length,
    classificationChangeDirections:changed.reduce((o,r)=>{const k=`${classifyHeat(r.heatCurrent)}->${classifyHeat(r[key])}`;o[k]=(o[k]||0)+1;return o;},{}),
    deltaByConfidence:{
      zero:bucket(rows,r=>r.agreementConfidence===0,`${key}Delta`),
      low:bucket(rows,r=>r.agreementConfidence>0&&r.agreementConfidence<25,`${key}Delta`),
      adequate:bucket(rows,r=>r.agreementConfidence>=25,`${key}Delta`)
    },
    disagreementContributionByConfidence:{
      lowCurrent:bucket(rows,r=>r.agreementConfidence>0&&r.agreementConfidence<25,'disagreementCurrent'),
      lowCandidate:bucket(rows,r=>r.agreementConfidence>0&&r.agreementConfidence<25,`${key}Disagreement`),
      adequateCurrent:bucket(rows,r=>r.agreementConfidence>=25,'disagreementCurrent'),
      adequateCandidate:bucket(rows,r=>r.agreementConfidence>=25,`${key}Disagreement`)
    }
  };
}

const rows=load();if(!rows.length)throw new Error('No reports');
const factors={
  heatLinear:r=>r.agreementConfidence>0?r.agreementConfidence/100:0,
  heatSqrt:r=>r.agreementConfidence>0?Math.sqrt(r.agreementConfidence/100):0,
  heat25Sqrt75:r=>r.agreementConfidence>0?.25+.75*Math.sqrt(r.agreementConfidence/100):0,
  heat50Sqrt50:r=>r.agreementConfidence>0?.50+.50*Math.sqrt(r.agreementConfidence/100):0,
  heat50Linear50:r=>r.agreementConfidence>0?.50+.50*(r.agreementConfidence/100):0,
  heat75Linear25:r=>r.agreementConfidence>0?.75+.25*(r.agreementConfidence/100):0
};
for(const r of rows){
  const base=clamp((r.avgMag/.03)*40+r.breadth*25+r.threshold*20);
  const dispersion=(100-r.agreementScore)/100;
  r.heatBase=base;
  r.disagreementCurrent=r.agreementConfidence>0?dispersion*15:0;
  r.heatCurrent=clamp(base+r.disagreementCurrent);
  for(const [key,factorFn] of Object.entries(factors)){
    r[`${key}Disagreement`]=dispersion*15*factorFn(r);
    r[key]=clamp(base+r[`${key}Disagreement`]);
    r[`${key}Delta`]=r[key]-r.heatCurrent;
  }
}
const variants={};for(const key of Object.keys(factors))variants[key]=evaluateVariant(rows,key);
const output={
  state:'PASS',mode:'READ_ONLY_HEAT_STEP1_CALIBRATION',period:{start:START,end:END,reports:rows.length,dates:new Set(rows.map(r=>r.date)).size},
  invariantFormula:{magnitudeAnchor:.03,magnitudeWeight:40,breadthWeight:25,thresholdActivityWeight:20,disagreementMaxWeight:15,currentRule:'full disagreement contribution whenever agreement confidence > 0'},
  confidenceBuckets:{zero:rows.filter(r=>r.agreementConfidence===0).length,low:rows.filter(r=>r.agreementConfidence>0&&r.agreementConfidence<25).length,adequate:rows.filter(r=>r.agreementConfidence>=25).length},
  current:{summary:summary(rows.map(r=>r.heatCurrent)),bins:bins(rows.map(r=>r.heatCurrent)),saturationLow:rows.filter(r=>r.heatCurrent<=5).length,saturationHigh:rows.filter(r=>r.heatCurrent>=95).length},
  variants,
  decisionCriteria:{minimumCorrelationToCurrent:.995,targetLowConfidenceMeanReductionPoints:[1.5,3.5],maximumAdequateConfidenceMeanReductionPoints:2.0,preferFewThresholdClassChanges:true,doNotIncreaseHighSaturation:true},
  notes:['No production formula, threshold, graphic, or report output is modified.','Zero-confidence runs continue to contribute zero disagreement Heat in every variant.','Current 40/55 Heat thresholds are used only to measure classification stability, not to select future final thresholds.']
};
console.log(JSON.stringify(output,null,2));
