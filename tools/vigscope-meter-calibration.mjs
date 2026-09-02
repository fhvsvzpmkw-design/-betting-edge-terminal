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
  if(nums.length>=2){const favors=[],mags=[];for(let i=0;i+1<nums.length;i+=2){const a=americanProb(nums[i]),b=americanProb(nums[i+1]);if(a!==null&&b!==null){favors.push(a-b);mags.push(Math.abs(a-b));}}if(favors.length)return {favor:mean(favors)||0,magnitude:mean(mags)||0,source:'MOVE'};}
  const text=String(rec?.move||'').toUpperCase();
  if(/UNCHANGED|STABLE|FLAT|NO MOVE|HELD/.test(text))return {favor:0,magnitude:0,source:'TEXT'};
  if(/IMPROV|DRIFT|BETTER|EASED/.test(text))return {favor:.005,magnitude:.005,source:'TEXT'};
  if(/WORSEN|SHORTEN|STEAM|EXPENS|AGAINST/.test(text))return {favor:-.005,magnitude:.005,source:'TEXT'};
  return {favor:0,magnitude:0,source:'NONE'};
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
  if(diffs.length){const avg=mean(diffs)||0,priceScore=clamp(100-(avg/.10)*100);const qualitative=signals?clamp(50+aligned*12+stable*4-conflicted*18):priceScore;const score=signals?priceScore*.8+qualitative*.2:priceScore;return {score,confidence:clamp(((diffs.length*2+signals)/Math.max(1,recs.length*2))*100),pairs:diffs.length,source:'REPORT + BOOKS'};}
  if(!signals)return {score:50,confidence:0,pairs:0,source:'NO COHESION DATA'};
  const score=clamp(50+aligned*14+stable*5-conflicted*20);return {score,confidence:clamp((signals/Math.max(1,recs.length))*70),pairs:0,source:'REPORT COHESION'};
}
function primitive(run){
  const recs=Array.isArray(run?.recs)?run.recs:[],signals=recs.map(r=>({...moveSignal(r),weight:recWeight(r)}));
  const weighted=signals.reduce((n,x)=>n+x.weight,0)||1;
  const favor=signals.reduce((n,x)=>n+x.favor*x.weight,0)/weighted;
  const avgMag=mean(signals.map(x=>x.magnitude))||0;
  const breadth=recs.length?signals.filter(x=>x.magnitude>=.0025).length/recs.length:0;
  const th=recs.map(thresholdActivity).filter(x=>x!==null),threshold=mean(th)||0;
  const agreement=run?.instrumentTelemetry?.agreement||fallbackAgreement(run);
  return {favor,avgMag,breadth,threshold,agreementScore:clamp(agreement?.score??50),agreementConfidence:clamp(agreement?.confidence??0),agreementSource:agreement?.source||'UNKNOWN',recs:recs.length};
}
function load(){const rows=[];for(const date of fs.readdirSync(ROOT).sort()){if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<START||date>END)continue;const dir=path.join(ROOT,date);if(!fs.statSync(dir).isDirectory())continue;for(const name of fs.readdirSync(dir).sort()){if(!name.endsWith('.json'))continue;try{const run=JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'));rows.push({date,name,ts:run.ts||null,slot:run.slot||null,...primitive(run)});}catch{}}}return rows;}
function bins(values){const out={'0-19':0,'20-39':0,'40-60':0,'61-80':0,'81-100':0};for(const v of values){if(v<20)out['0-19']++;else if(v<40)out['20-39']++;else if(v<=60)out['40-60']++;else if(v<=80)out['61-80']++;else out['81-100']++;}return out;}
function meterStats(values){const exact50=values.filter(v=>Math.round(v)===50).length,satLow=values.filter(v=>v<=5).length,satHigh=values.filter(v=>v>=95).length;return {summary:summary(values),bins:bins(values),exact50,saturationLow:satLow,saturationHigh:satHigh};}
function corr(a,b){const ma=mean(a),mb=mean(b);let n=0,da=0,db=0;for(let i=0;i<a.length;i++){const x=a[i]-ma,y=b[i]-mb;n+=x*y;da+=x*x;db+=y*y;}return da&&db?+(n/Math.sqrt(da*db)).toFixed(4):null;}

const rows=load();if(!rows.length)throw new Error('No reports');
const nonzeroMag=rows.map(r=>r.avgMag).filter(v=>v>0),nonzeroFavorAbs=rows.map(r=>Math.abs(r.favor)).filter(v=>v>0);
const magScale=Math.max(.0025,quantile(nonzeroMag,.75)||.03);
const pressureScale=Math.max(.0005,quantile(nonzeroFavorAbs,.75)||.01);
for(const r of rows){
  const dispersion=(100-r.agreementScore)/100;
  r.heatCurrent=clamp((r.avgMag/.03)*40+r.breadth*25+r.threshold*20+(r.agreementConfidence>0?dispersion:0)*15);
  r.heatCandidate=clamp((r.avgMag/magScale)*40+r.breadth*25+r.threshold*20+dispersion*(r.agreementConfidence/100)*15);
  r.pressureCurrent=clamp(50+r.favor*1000);
  r.pressureCandidate=clamp(50+25*(r.favor/pressureScale));
  r.pressureTanh=clamp(50+50*Math.tanh(r.favor/(2*pressureScale)));
  r.agreementCurrent=r.agreementScore;
  r.agreementCandidate=clamp(50+(r.agreementScore-50)*Math.sqrt(r.agreementConfidence/100));
}
const confidence=rows.map(r=>r.agreementConfidence);
const zeroConf=rows.filter(r=>r.agreementConfidence===0).length,lowConf=rows.filter(r=>r.agreementConfidence>0&&r.agreementConfidence<25).length,adequateConf=rows.filter(r=>r.agreementConfidence>=25).length;
const current={heat:meterStats(rows.map(r=>r.heatCurrent)),pressure:meterStats(rows.map(r=>r.pressureCurrent)),agreement:meterStats(rows.map(r=>r.agreementCurrent))};
const candidate={heat:meterStats(rows.map(r=>r.heatCandidate)),pressureLinear:meterStats(rows.map(r=>r.pressureCandidate)),pressureTanh:meterStats(rows.map(r=>r.pressureTanh)),agreement:meterStats(rows.map(r=>r.agreementCandidate))};
const output={state:'PASS',mode:'READ_ONLY_METER_CALIBRATION',period:{start:START,end:END,reports:rows.length,dates:new Set(rows.map(r=>r.date)).size},primitiveDistributions:{avgMagnitude:summary(rows.map(r=>r.avgMag)),breadth:summary(rows.map(r=>r.breadth)),thresholdActivity:summary(rows.map(r=>r.threshold)),signedFavor:summary(rows.map(r=>r.favor)),absoluteFavor:summary(rows.map(r=>Math.abs(r.favor))),agreementScore:summary(rows.map(r=>r.agreementScore)),agreementConfidence:summary(confidence)},calibrationScales:{heatMagnitudeP75Nonzero:+magScale.toFixed(6),pressureAbsFavorP75Nonzero:+pressureScale.toFixed(6)},agreementEvidence:{zeroConfidence:zeroConf,lowConfidence:lowConf,adequateConfidence:adequateConf,zeroConfidenceShare:+(zeroConf/rows.length).toFixed(4),sourceCounts:rows.reduce((o,r)=>(o[r.agreementSource]=(o[r.agreementSource]||0)+1,o),{})},current,candidate,correlations:{heat:corr(rows.map(r=>r.heatCurrent),rows.map(r=>r.heatCandidate)),pressureLinear:corr(rows.map(r=>r.pressureCurrent),rows.map(r=>r.pressureCandidate)),pressureTanh:corr(rows.map(r=>r.pressureCurrent),rows.map(r=>r.pressureTanh)),agreement:corr(rows.map(r=>r.agreementCurrent),rows.map(r=>r.agreementCandidate))},candidateDefinitions:{heat:'Magnitude normalized to current-period nonzero p75; breadth and threshold unchanged; disagreement contribution multiplied by agreement confidence.',pressureLinear:'50 +/- 25 points per current-period p75 absolute signed movement, clamped 0-100.',pressureTanh:'Smooth robust alternative centered at 50 using tanh and current-period p75 absolute signed movement.',agreement:'Shrink agreement score toward 50 by sqrt(confidence); zero-confidence evidence becomes exactly neutral 50.'},notes:['Read-only study. No terminal formulas or thresholds are modified.','Current-period scales are diagnostic calibration anchors, not yet proposed as permanently self-updating production parameters.']};
console.log(JSON.stringify(output,null,2));
