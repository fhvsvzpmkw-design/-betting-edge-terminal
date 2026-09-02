#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT=path.resolve('data/history/runs');
const START=process.env.CALIBRATION_START||'2026-08-15';
const END=process.env.CALIBRATION_END||'2026-09-01';
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,Number(v)||0));
const mean=a=>{const x=(a||[]).filter(Number.isFinite);return x.length?x.reduce((s,v)=>s+v,0)/x.length:null;};
function quantile(values,q){const a=[...values].filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return null;const p=(a.length-1)*q,l=Math.floor(p),h=Math.ceil(p),w=p-l;return a[l]*(1-w)+a[h]*w;}
function summary(values){const a=values.filter(Number.isFinite);if(!a.length)return null;return {n:a.length,min:+Math.min(...a).toFixed(4),p10:+quantile(a,.1).toFixed(4),p25:+quantile(a,.25).toFixed(4),median:+quantile(a,.5).toFixed(4),p75:+quantile(a,.75).toFixed(4),p90:+quantile(a,.9).toFixed(4),max:+Math.max(...a).toFixed(4),mean:+mean(a).toFixed(4)};}
function americanProb(a){const n=Number(a);if(!Number.isFinite(n)||n===0)return null;return n>0?100/(n+100):(-n)/((-n)+100);}
function americanFromText(v){const m=String(v||'').replace(/−/g,'-').match(/[+-]?\d{2,4}/);return m?Number(m[0]):null;}
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
  if(diffs.length){
    const avg=mean(diffs)||0,priceScore=clamp(100-(avg/.10)*100);
    const qualitative=signals?clamp(50+aligned*12+stable*4-conflicted*18):priceScore;
    const score=signals?priceScore*.8+qualitative*.2:priceScore;
    return {score,confidence:clamp(((diffs.length*2+signals)/Math.max(1,recs.length*2))*100),pairs:diffs.length,source:'REPORT + BOOKS'};
  }
  if(!signals)return {score:50,confidence:0,pairs:0,source:'NO COHESION DATA'};
  const score=clamp(50+aligned*14+stable*5-conflicted*20);
  return {score,confidence:clamp((signals/Math.max(1,recs.length))*70),pairs:0,source:'REPORT COHESION'};
}
function load(){const rows=[];for(const date of fs.readdirSync(ROOT).sort()){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<START||date>END)continue;
  const dir=path.join(ROOT,date);if(!fs.statSync(dir).isDirectory())continue;
  for(const name of fs.readdirSync(dir).sort()){
    if(!name.endsWith('.json'))continue;
    try{const run=JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'));const a=run?.instrumentTelemetry?.agreement||fallbackAgreement(run);rows.push({date,name,ts:run.ts||null,score:clamp(a?.score??50),confidence:clamp(a?.confidence??0),source:a?.source||'UNKNOWN',pairs:Number(a?.pairs||0)});}catch{}
  }
}return rows;}
function quality(c){return c===0?'UNMEASURED':c<25?'LIMITED':'SUPPORTED';}
function gate(rows,minConfidence,highScore){let ineligible=0,low=0,high=0,unsupportedHigh=0;for(const r of rows){const eligible=r.confidence>=minConfidence&&r.confidence>0;if(!eligible){ineligible++;if(r.score>=highScore)unsupportedHigh++;continue;}if(r.score>=highScore)high++;else low++;}return {minConfidence,highScore,ineligible,low,high,unsupportedHigh};}
function currentBinary(rows,threshold){let low=0,high=0,zeroConfidenceHigh=0;for(const r of rows){if(r.score>=threshold){high++;if(r.confidence===0)zeroConfidenceHigh++;}else low++;}return {threshold,low,high,zeroConfidenceHigh};}

const rows=load();if(!rows.length)throw new Error('No reports');
const evidenceBacked=rows.filter(r=>r.confidence>0),supported=rows.filter(r=>r.confidence>=25),limited=rows.filter(r=>r.confidence>0&&r.confidence<25),unmeasured=rows.filter(r=>r.confidence===0);
const sourceCounts=rows.reduce((o,r)=>(o[r.source]=(o[r.source]||0)+1,o),{});
const qualityCounts=rows.reduce((o,r)=>(o[quality(r.confidence)]=(o[quality(r.confidence)]||0)+1,o),{});
const gates=[];for(const c of [0.000001,5,10,15,20,25])for(const s of [50,55,60])gates.push(gate(rows,c,s));
const currentThresholds=[45,50,55,60].map(t=>currentBinary(rows,t));
const zeroScoreDistinct=[...new Set(unmeasured.map(r=>r.score))].sort((a,b)=>a-b);
const output={
  state:'PASS',mode:'READ_ONLY_AGREEMENT_STEP3_CALIBRATION',period:{start:START,end:END,reports:rows.length,dates:new Set(rows.map(r=>r.date)).size},
  currentStructure:{scoreMeaning:'market/book cohesion strength on 0-100 scale',confidenceMeaning:'amount of evidence supporting the score on 0-100 scale',currentDisplayProblem:'score and confidence are collapsed into a binary LOW/HIGH classification; a neutral fallback score can therefore look like measured HIGH agreement'},
  evidence:{qualityCounts,sourceCounts,unmeasuredShare:+(unmeasured.length/rows.length).toFixed(4),limitedShare:+(limited.length/rows.length).toFixed(4),supportedShare:+(supported.length/rows.length).toFixed(4),zeroConfidenceScoreValues:zeroScoreDistinct},
  scoreDistributions:{all:summary(rows.map(r=>r.score)),unmeasured:summary(unmeasured.map(r=>r.score)),evidenceBacked:summary(evidenceBacked.map(r=>r.score)),limited:summary(limited.map(r=>r.score)),supported:summary(supported.map(r=>r.score))},
  confidenceDistribution:summary(rows.map(r=>r.confidence)),
  currentBinaryThresholdTests:currentThresholds,
  evidenceGateTests:gates,
  candidateArchitectures:{
    SCORE_SHRINK:{description:'Modify the numeric Agreement score toward 50 according to confidence.',status:'REJECT',reason:'Previous meter study showed it compresses measured Agreement around 50 and still makes missing evidence look like a numeric observation.'},
    SCORE_TIMES_CONFIDENCE:{description:'Multiply or geometrically blend score and confidence into one number.',status:'REJECT',reason:'Changes the semantic meaning of Agreement and makes evidence quantity indistinguishable from actual market cohesion.'},
    TWO_AXIS_EVIDENCE_AWARE:{description:'Preserve the raw Agreement score; carry evidence confidence independently; mark confidence=0 as UNMEASURED; confidence 0-25 as LIMITED; >=25 as SUPPORTED; forbid UNMEASURED readings from qualifying as HIGH.',status:'PREFERRED'}
  },
  proposedDecision:{
    architecture:'TWO_AXIS_EVIDENCE_AWARE',
    preserveRawScoreFormula:true,
    evidenceQualityBands:{UNMEASURED:'confidence == 0',LIMITED:'0 < confidence < 25',SUPPORTED:'confidence >= 25'},
    highEligibilityRule:'confidence > 0 is mandatory for HIGH; final HIGH score threshold remains deferred to combined Step 4 calibration',
    unmeasuredNumericHandling:'retain neutral score 50 internally for arithmetic compatibility, but expose state UNMEASURED and never treat that 50 as measured HIGH agreement',
    lowEligibilityRule:'evidence-backed readings below the eventual HIGH threshold remain LOW; how UNMEASURED maps to the existing two-state VIG graphic is intentionally deferred to Step 4 so the 18-graphic architecture is not changed prematurely'
  },
  decisionCriteria:{eliminateZeroConfidenceHigh:true,preserveRawScoreOrdering:true,preserveScoreSemantics:true,avoidArtificialScoreCompression:true,doNotAddThirdVIGGraphicStateInStep3:true},
  notes:['Read-only study. No production Agreement formula, threshold, VIG graphic, or report output is modified.','Final LOW/HIGH score threshold and the presentation treatment of UNMEASURED are deferred to combined VIG Meter recalibration.']
};
console.log(JSON.stringify(output,null,2));
