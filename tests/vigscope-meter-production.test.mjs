import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  VIG_METER_CALIBRATION_ID,
  heatConfidenceFactor,
  calibratedHeat,
  calibratedPressure,
  agreementEvidenceQuality,
  classifyHeat,
  classifyPressure,
  classifyAgreement,
  classifyVigState
} from '../tools/vigscope-meter-production.mjs';

const ROOT=path.resolve('data/history/runs');
const POLICY=JSON.parse(fs.readFileSync('data/vigscope/meter-calibration-production-v1.json','utf8'));
const RUNTIME=fs.readFileSync('assets/runner-core-runtime.js','utf8');

assert.equal(POLICY.policyId,VIG_METER_CALIBRATION_ID);
assert.equal(POLICY.state,'OPERATIONAL');
assert.equal(POLICY.productionAuthority,true);

assert.equal(heatConfidenceFactor(0),0);
assert.equal(heatConfidenceFactor(25),0.75);
assert.ok(Math.abs(heatConfidenceFactor(100)-1)<1e-12);
assert.equal(calibratedPressure(0),50);
assert.ok(Math.abs((calibratedPressure(0.014)+calibratedPressure(-0.014))-100)<1e-10);
assert.ok(calibratedPressure(0.014)>50&&calibratedPressure(-0.014)<50);
assert.equal(classifyHeat(19.999),'LOW');
assert.equal(classifyHeat(20),'MEDIUM');
assert.equal(classifyHeat(39.999),'MEDIUM');
assert.equal(classifyHeat(40),'HIGH');
assert.equal(classifyPressure(47.999),'ADVERSE');
assert.equal(classifyPressure(48),'NEUTRAL');
assert.equal(classifyPressure(51.999),'NEUTRAL');
assert.equal(classifyPressure(52),'FAVORABLE');
assert.deepEqual(classifyAgreement(90,0),{semantic:'UNMEASURED',render:'LOW',quality:'UNMEASURED'});
assert.deepEqual(classifyAgreement(44.999,10),{semantic:'LOW',render:'LOW',quality:'LIMITED'});
assert.deepEqual(classifyAgreement(45,10),{semantic:'HIGH',render:'HIGH',quality:'LIMITED'});
assert.deepEqual(classifyAgreement(45,25),{semantic:'HIGH',render:'HIGH',quality:'SUPPORTED'});
assert.equal(agreementEvidenceQuality(0),'UNMEASURED');
assert.equal(agreementEvidenceQuality(24.999),'LIMITED');
assert.equal(agreementEvidenceQuality(25),'SUPPORTED');

const heatProbe=calibratedHeat({avgMagnitude:0,breadth:0,thresholdActivity:0,agreementScore:0,agreementConfidence:25});
assert.equal(heatProbe,11.25);

for(const token of [
  "VIG_METER_CALIBRATION_ID='vigscope-meter-calibration-v1'",
  'VIG_HEAT_LOW_MAX=20',
  'VIG_HEAT_HIGH_MIN=40',
  'VIG_PRESSURE_ADVERSE_MAX=48',
  'VIG_PRESSURE_FAVORABLE_MIN=52',
  'VIG_AGREEMENT_HIGH_MIN=45',
  '0.50+0.50*Math.sqrt(agreementConfidence/100)',
  '50+50*Math.tanh(fav/0.028)',
  "label:agreementConfidence?agreementLabel(agreementScore):'UNMEASURED'",
  'evidenceQuality:agreementQuality',
  'const h=r.heat.rawValue??r.heat.value,p=r.pressure.rawValue??r.pressure.value,a=r.agreement.rawValue??r.agreement.value;',
  "const agreement=agreementConfidence>0?(a<VIG_AGREEMENT_HIGH_MIN?'LOW':'HIGH'):'LOW';"
]) assert.ok(RUNTIME.includes(token),`runtime missing production token: ${token}`);

for(const forbidden of [
  'const heat=clamp((avgMag/.03)*40+breadth*25+threshold*20+dispersion*15);',
  'const pressure=clamp(50+fav*1000);',
  "const heat=h<40?'LOW':h<55?'MEDIUM':'HIGH';",
  "const pressure=p<45?'ADVERSE':p<56?'NEUTRAL':'FAVORABLE';",
  "const agreement=a<45?'LOW':'HIGH';"
]) assert.ok(!RUNTIME.includes(forbidden),`legacy runtime logic still present: ${forbidden}`);

function americanFromText(v){const m=String(v||'').replace(/−/g,'-').match(/[+-]?\d{2,4}/);return m?Number(m[0]):null;}
function americanProb(a){const n=Number(a);if(!Number.isFinite(n)||n===0)return null;return n>0?100/(n+100):(-n)/((-n)+100);}
function clamp(v,min=0,max=100){return Math.max(min,Math.min(max,Number(v)||0));}
function mean(a){const x=(a||[]).filter(Number.isFinite);return x.length?x.reduce((s,v)=>s+v,0)/x.length:null;}
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
  if(diffs.length){const avg=mean(diffs)||0,priceScore=clamp(100-(avg/.10)*100);const qualitative=signals?clamp(50+aligned*12+stable*4-conflicted*18):priceScore;const score=signals?priceScore*.8+qualitative*.2:priceScore;return {score,confidence:clamp(((diffs.length*2+signals)/Math.max(1,recs.length*2))*100)};}
  if(!signals)return {score:50,confidence:0};
  return {score:clamp(50+aligned*14+stable*5-conflicted*20),confidence:clamp((signals/Math.max(1,recs.length))*70)};
}
function derive(run){
  const recs=Array.isArray(run?.recs)?run.recs:[],signals=recs.map(r=>({...moveSignal(r),weight:recWeight(r)}));
  const weighted=signals.reduce((n,x)=>n+x.weight,0)||1;
  const favor=signals.reduce((n,x)=>n+x.favor*x.weight,0)/weighted;
  const avgMagnitude=mean(signals.map(x=>x.magnitude))||0;
  const breadth=recs.length?signals.filter(x=>x.magnitude>=.0025).length/recs.length:0;
  const threshold=mean(recs.map(thresholdActivity).filter(x=>x!==null))||0;
  const agreement=run?.instrumentTelemetry?.agreement||fallbackAgreement(run);
  const agreementScore=clamp(agreement?.score??50),agreementConfidence=clamp(agreement?.confidence??0);
  return {
    heat:calibratedHeat({avgMagnitude,breadth,thresholdActivity:threshold,agreementScore,agreementConfidence}),
    pressure:calibratedPressure(favor),agreementScore,agreementConfidence
  };
}

const rows=[];
for(const date of fs.readdirSync(ROOT).sort()){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<'2026-08-15'||date>'2026-09-01')continue;
  const dir=path.join(ROOT,date);if(!fs.statSync(dir).isDirectory())continue;
  for(const name of fs.readdirSync(dir).sort()){
    if(!name.endsWith('.json'))continue;
    const run=JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'));
    rows.push({date,name,...derive(run)});
  }
}
assert.equal(rows.length,85);
assert.equal(new Set(rows.map(r=>r.date)).size,18);

const heat={LOW:0,MEDIUM:0,HIGH:0},pressure={ADVERSE:0,NEUTRAL:0,FAVORABLE:0},agreementMeasured={LOW:0,HIGH:0},agreementEvidence={UNMEASURED:0,LIMITED:0,SUPPORTED:0},states={};
for(const r of rows){
  const v=classifyVigState(r);heat[v.heat]++;pressure[v.pressure]++;agreementEvidence[v.agreement.quality]++;if(v.agreement.semantic!=='UNMEASURED')agreementMeasured[v.agreement.semantic]++;states[v.key]=(states[v.key]||0)+1;
}
assert.deepEqual(heat,POLICY.combined18State.expectedHistoricalDistribution.heat);
assert.deepEqual(pressure,POLICY.combined18State.expectedHistoricalDistribution.pressure);
assert.deepEqual(agreementMeasured,POLICY.combined18State.expectedHistoricalDistribution.agreementMeasured);
assert.deepEqual(agreementEvidence,POLICY.combined18State.expectedHistoricalDistribution.agreementEvidence);
const occupied=Object.keys(states).length,maxCount=Math.max(...Object.values(states));
assert.equal(occupied,POLICY.combined18State.expectedHistoricalDistribution.occupiedStates);
assert.equal(maxCount,POLICY.combined18State.expectedHistoricalDistribution.maxSingleStateCount);

const sept1=rows.filter(r=>r.date==='2026-09-01').map(r=>({file:r.name,...classifyVigState(r)}));
assert.equal(sept1.length,5);
console.log(JSON.stringify({state:'PASS',calibrationId:VIG_METER_CALIBRATION_ID,reports:rows.length,dates:18,marginals:{heat,pressure,agreementMeasured,agreementEvidence},occupied,maxCount,sept1},null,2));
