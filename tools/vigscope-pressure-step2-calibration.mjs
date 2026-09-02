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
    if(a!==null&&b!==null)return {favor:a-b,magnitude:Math.abs(a-b),source:'REPRICE'};
  }
  const nums=signedOdds(rec?.move);
  if(nums.length>=2){
    const favors=[],mags=[];
    for(let i=0;i+1<nums.length;i+=2){const a=americanProb(nums[i]),b=americanProb(nums[i+1]);if(a!==null&&b!==null){favors.push(a-b);mags.push(Math.abs(a-b));}}
    if(favors.length)return {favor:mean(favors)||0,magnitude:mean(mags)||0,source:'MOVE'};
  }
  const text=String(rec?.move||'').toUpperCase();
  if(/UNCHANGED|STABLE|FLAT|NO MOVE|HELD/.test(text))return {favor:0,magnitude:0,source:'TEXT'};
  if(/IMPROV|DRIFT|BETTER|EASED/.test(text))return {favor:.005,magnitude:.005,source:'TEXT'};
  if(/WORSEN|SHORTEN|STEAM|EXPENS|AGAINST/.test(text))return {favor:-.005,magnitude:.005,source:'TEXT'};
  return {favor:0,magnitude:0,source:'NONE'};
}
function primitive(run){
  const recs=Array.isArray(run?.recs)?run.recs:[];
  const signals=recs.map(r=>({...moveSignal(r),weight:recWeight(r)}));
  const weighted=signals.reduce((n,x)=>n+x.weight,0)||1;
  const favor=signals.reduce((n,x)=>n+x.favor*x.weight,0)/weighted;
  return {favor,recs:recs.length};
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
function bins(values){const out={'0-19':0,'20-39':0,'40-60':0,'61-80':0,'81-100':0};for(const v of values){if(v<20)out['0-19']++;else if(v<40)out['20-39']++;else if(v<=60)out['40-60']++;else if(v<=80)out['61-80']++;else out['81-100']++;}return out;}
function direction(v,dead=0){return v>dead?1:v<-dead?-1:0;}
function evaluate(rows,key,currentKey){
  const vals=rows.map(r=>r[key]),current=rows.map(r=>r[currentKey]);
  const zeroRows=rows.filter(r=>Math.abs(r.favor)<1e-12);
  const exactNeutral=zeroRows.filter(r=>Math.abs(r[key]-50)<1e-9).length;
  const signMismatches=rows.filter(r=>direction(r.favor)!==direction(r[key]-50)).length;
  const satLow=vals.filter(v=>v<=5).length,satHigh=vals.filter(v=>v>=95).length;
  const middle=vals.filter(v=>v>=40&&v<=60).length;
  const strongDirectional=vals.filter(v=>v<=20||v>=80).length;
  const nonzero=rows.filter(r=>Math.abs(r.favor)>=1e-12);
  const nonzeroValues=nonzero.map(r=>r[key]);
  const uniqueRoundedNonzero=new Set(nonzeroValues.map(v=>Math.round(v))).size;
  return {
    summary:summary(vals),bins:bins(vals),
    zeroFavorRows:zeroRows.length,zeroFavorRemainExactly50:exactNeutral,
    signMismatches,saturationLow:satLow,saturationHigh:satHigh,middle40to60:middle,strongDirectional20or80:strongDirectional,
    correlationToCurrent:corr(current,vals),meanAbsDelta:+mean(vals.map((v,i)=>Math.abs(v-current[i]))).toFixed(4),
    uniqueRoundedNonzeroValues:uniqueRoundedNonzero
  };
}

const rows=load();if(!rows.length)throw new Error('No reports');
const absNonzero=rows.map(r=>Math.abs(r.favor)).filter(v=>v>0);
const favorStats=summary(rows.map(r=>r.favor));
const absStats=summary(rows.map(r=>Math.abs(r.favor)));
const nonzeroStats=summary(absNonzero);
for(const r of rows){
  r.current=clamp(50+r.favor*1000);
  r.linear1250=clamp(50+r.favor*1250);
  r.linear1500=clamp(50+r.favor*1500);
  r.linear1750=clamp(50+r.favor*1750);
  r.linear2000=clamp(50+r.favor*2000);
  r.tanh010=50+50*Math.tanh(r.favor/.020);
  r.tanh012=50+50*Math.tanh(r.favor/.024);
  r.tanh014=50+50*Math.tanh(r.favor/.028);
  r.tanh016=50+50*Math.tanh(r.favor/.032);
}
const keys=['current','linear1250','linear1500','linear1750','linear2000','tanh010','tanh012','tanh014','tanh016'];
const variants=Object.fromEntries(keys.map(k=>[k,evaluate(rows,k,'current')]));

// Step-2 guardrails: preserve true neutral, preserve direction, keep rank highly stable,
// materially reduce central compression, and avoid materially more endpoint saturation.
const criteria={
  zeroFavorMustRemainExactly50:true,
  signMismatchesAllowed:0,
  minimumCorrelationToCurrent:0.975,
  targetMiddle40to60:[52,60],
  maximumCombinedEndpointSaturation:8,
  preferSmoothNoHardClipping:true
};
function qualifies(k,e){
  if(k==='current')return false;
  const combined=e.saturationLow+e.saturationHigh;
  return e.zeroFavorRows===e.zeroFavorRemainExactly50 && e.signMismatches===0 &&
    (e.correlationToCurrent??0)>=criteria.minimumCorrelationToCurrent &&
    e.middle40to60>=criteria.targetMiddle40to60[0] && e.middle40to60<=criteria.targetMiddle40to60[1] &&
    combined<=criteria.maximumCombinedEndpointSaturation;
}
const qualified=keys.filter(k=>qualifies(k,variants[k]));
const smoothQualified=qualified.filter(k=>k.startsWith('tanh'));
// Prefer smooth monotonic transforms; among them choose the one closest to the midpoint of target central occupancy,
// then highest correlation, then lower mean absolute delta.
const targetMid=mean(criteria.targetMiddle40to60);
const ranked=[...(smoothQualified.length?smoothQualified:qualified)].sort((a,b)=>{
  const ea=variants[a],eb=variants[b];
  const da=Math.abs(ea.middle40to60-targetMid),db=Math.abs(eb.middle40to60-targetMid);
  if(da!==db)return da-db;
  if(eb.correlationToCurrent!==ea.correlationToCurrent)return eb.correlationToCurrent-ea.correlationToCurrent;
  return ea.meanAbsDelta-eb.meanAbsDelta;
});
const selected=ranked[0]||null;
const output={
  state:'PASS',mode:'READ_ONLY_PRESSURE_STEP2_CALIBRATION',
  period:{start:START,end:END,reports:rows.length,dates:new Set(rows.map(r=>r.date)).size},
  primitive:{signedFavor:favorStats,absoluteFavor:absStats,nonzeroAbsoluteFavor:nonzeroStats,zeroFavorRows:rows.filter(r=>Math.abs(r.favor)<1e-12).length},
  currentFormula:'Pressure = clamp(50 + signedFavor * 1000, 0, 100)',
  variants,criteria,qualifiedVariants:qualified,selectedVariant:selected,
  selectedDefinition:selected?.startsWith('tanh')?{
    family:'SMOOTH_TANH',
    formula:selected==='tanh010'?'50 + 50*tanh(signedFavor / 0.020)':selected==='tanh012'?'50 + 50*tanh(signedFavor / 0.024)':selected==='tanh014'?'50 + 50*tanh(signedFavor / 0.028)':'50 + 50*tanh(signedFavor / 0.032)',
    property:'signedFavor=0 maps exactly to 50; positive/negative movement remains directionally symmetric; extremes approach 0/100 smoothly without hard clipping.'
  }:selected?{family:'LINEAR',multiplier:Number(selected.replace('linear',''))}:null,
  notes:[
    'Read-only study. No production formula, threshold, VIG graphic, or report output is modified.',
    'The goal is not equal thirds. Exact zero market pressure is intentionally allowed to cluster at 50.',
    'Final Pressure ADVERSE/NEUTRAL/FAVORABLE thresholds remain deferred until all three meters are calibrated.'
  ]
};
console.log(JSON.stringify(output,null,2));
