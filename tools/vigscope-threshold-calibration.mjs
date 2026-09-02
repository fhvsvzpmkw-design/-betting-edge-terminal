#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('data/history/runs');
const START = process.env.CALIBRATION_START || '2026-08-15';
const END = process.env.CALIBRATION_END || '2026-09-01';

function americanFromText(v){
  const m=String(v||'').replace(/−/g,'-').match(/[+-]?\d{2,4}/);
  return m?Number(m[0]):null;
}
function americanProb(a){
  const n=Number(a);
  if(!Number.isFinite(n)||n===0)return null;
  return n>0?100/(n+100):(-n)/((-n)+100);
}
function clamp(v,min=0,max=100){return Math.max(min,Math.min(max,Number(v)||0));}
function mean(values){
  const a=(values||[]).filter(Number.isFinite);
  return a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
}
function signedOdds(v){
  return [...String(v||'').replace(/−/g,'-').matchAll(/([+-]\d{2,4})(?![\d.])/g)]
    .map(m=>Number(m[1])).filter(Number.isFinite);
}
function recWeight(rec){
  const s=String(rec?.status||'PASS').toUpperCase();
  return s==='BET'?1.5:s==='LEAN'?1.2:s==='WAIT'?0.8:0.45;
}
function moveSignal(rec){
  const issued=americanFromText(rec?.price),pc=rec?.priceComparison;
  if(pc?.state==='MATCHED'){
    const current=americanFromText(pc.price),a=americanProb(issued),b=americanProb(current);
    if(a!==null&&b!==null)return {favor:a-b,magnitude:Math.abs(a-b),source:'REPRICE'};
  }
  const nums=signedOdds(rec?.move);
  if(nums.length>=2){
    const favors=[],mags=[];
    for(let i=0;i+1<nums.length;i+=2){
      const a=americanProb(nums[i]),b=americanProb(nums[i+1]);
      if(a!==null&&b!==null){favors.push(a-b);mags.push(Math.abs(a-b));}
    }
    if(favors.length)return {favor:mean(favors)||0,magnitude:mean(mags)||0,source:'MOVE'};
  }
  const text=String(rec?.move||'').toUpperCase();
  if(/UNCHANGED|STABLE|FLAT|NO MOVE|HELD/.test(text))return {favor:0,magnitude:0,source:'TEXT'};
  if(/IMPROV|DRIFT|BETTER|EASED/.test(text))return {favor:.005,magnitude:.005,source:'TEXT'};
  if(/WORSEN|SHORTEN|STEAM|EXPENS|AGAINST/.test(text))return {favor:-.005,magnitude:.005,source:'TEXT'};
  return {favor:0,magnitude:0,source:'NONE'};
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
    return {score,confidence:clamp(((diffs.length*2+signals)/Math.max(1,recs.length*2))*100),pairs:diffs.length,source:'REPORT + BOOKS'};
  }
  if(!signals)return {score:50,confidence:0,pairs:0,source:'NO COHESION DATA'};
  const score=clamp(50+aligned*14+stable*5-conflicted*20);
  return {score,confidence:clamp((signals/Math.max(1,recs.length))*70),pairs:0,source:'REPORT COHESION'};
}
function instrumentAgreement(run){return run?.instrumentTelemetry?.agreement||fallbackAgreement(run);}
function deriveInstrumentReadings(run){
  const recs=Array.isArray(run?.recs)?run.recs:[];
  const signals=recs.map(r=>({...moveSignal(r),weight:recWeight(r)}));
  const weighted=signals.reduce((n,x)=>n+x.weight,0)||1;
  const fav=signals.reduce((n,x)=>n+x.favor*x.weight,0)/weighted;
  const mags=signals.map(x=>x.magnitude),avgMag=mean(mags)||0;
  const breadth=recs.length?signals.filter(x=>x.magnitude>=.0025).length/recs.length:0;
  const th=recs.map(thresholdActivity).filter(x=>x!==null),threshold=mean(th)||0;
  const agreement=instrumentAgreement(run),dispersion=agreement.confidence>0?(100-agreement.score)/100:0;
  const heat=clamp((avgMag/.03)*40+breadth*25+threshold*20+dispersion*15);
  const pressure=clamp(50+fav*1000);
  return {heat:Math.round(heat),pressure:Math.round(pressure),agreement:Math.round(agreement.score)};
}

function loadRuns(){
  if(!fs.existsSync(ROOT))throw new Error(`Missing ${ROOT}`);
  const rows=[];
  for(const date of fs.readdirSync(ROOT).sort()){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<START||date>END)continue;
    const dir=path.join(ROOT,date);
    if(!fs.statSync(dir).isDirectory())continue;
    for(const name of fs.readdirSync(dir).sort()){
      if(!name.endsWith('.json'))continue;
      const file=path.join(dir,name);
      try{
        const run=JSON.parse(fs.readFileSync(file,'utf8'));
        const r=deriveInstrumentReadings(run);
        rows.push({date,name,file:path.relative('.',file),ts:run.ts||null,label:run.label||null,slot:run.slot||null,recs:Array.isArray(run.recs)?run.recs.length:0,...r});
      }catch(err){
        console.error(`SKIP ${file}: ${err.message}`);
      }
    }
  }
  return rows;
}

function quantile(values,q){
  const a=[...values].sort((x,y)=>x-y);
  if(!a.length)return null;
  const pos=(a.length-1)*q,lo=Math.floor(pos),hi=Math.ceil(pos),w=pos-lo;
  return a[lo]*(1-w)+a[hi]*w;
}
function quantileSummary(values){
  return {
    min:Math.min(...values),p25:+quantile(values,.25).toFixed(1),p33:+quantile(values,1/3).toFixed(1),median:+quantile(values,.5).toFixed(1),p67:+quantile(values,2/3).toFixed(1),p75:+quantile(values,.75).toFixed(1),max:Math.max(...values)
  };
}
function nearest5(v){return Math.max(0,Math.min(100,Math.round(v/5)*5));}
function thresholdsFromQuantiles(rows){
  const heat=rows.map(r=>r.heat),pressure=rows.map(r=>r.pressure),agreement=rows.map(r=>r.agreement);
  let h1=Math.round(quantile(heat,1/3)),h2=Math.round(quantile(heat,2/3));
  let p1=Math.round(quantile(pressure,1/3)),p2=Math.round(quantile(pressure,2/3));
  if(h2<=h1)h2=h1+1;if(p2<=p1)p2=p1+1;
  return {heat:[h1,h2],pressure:[p1,p2],agreement:Math.round(quantile(agreement,.5))};
}
function roundedQuantiles(q){
  let h1=nearest5(q.heat[0]),h2=nearest5(q.heat[1]);
  let p1=nearest5(q.pressure[0]),p2=nearest5(q.pressure[1]);
  if(h2<=h1)h2=Math.min(100,h1+5);if(p2<=p1)p2=Math.min(100,p1+5);
  return {heat:[h1,h2],pressure:[p1,p2],agreement:nearest5(q.agreement)};
}

const HEAT=['low','medium','high'];
const PRESSURE=['adverse','neutral','favorable'];
const AGREEMENT=['low','high'];
const ALL_STATES=[];
for(const h of HEAT)for(const p of PRESSURE)for(const a of AGREEMENT)ALL_STATES.push(`${h}|${p}|${a}`);
function classify(row,t){
  const h=row.heat<t.heat[0]?'low':row.heat<t.heat[1]?'medium':'high';
  const p=row.pressure<t.pressure[0]?'adverse':row.pressure<t.pressure[1]?'neutral':'favorable';
  const a=row.agreement<t.agreement?'low':'high';
  return `${h}|${p}|${a}`;
}
function evaluate(rows,t){
  const counts=Object.fromEntries(ALL_STATES.map(k=>[k,0]));
  const heat={low:0,medium:0,high:0},pressure={adverse:0,neutral:0,favorable:0},agreement={low:0,high:0};
  for(const row of rows){
    const state=classify(row,t);counts[state]++;
    const [h,p,a]=state.split('|');heat[h]++;pressure[p]++;agreement[a]++;
  }
  const n=rows.length,ideal=n/18;
  const occupied=Object.values(counts).filter(Boolean).length;
  const entropy=-Object.values(counts).filter(Boolean).reduce((s,c)=>{const p=c/n;return s+p*Math.log(p);},0);
  const normalizedEntropy=n?entropy/Math.log(18):0;
  const rmse=Math.sqrt(Object.values(counts).reduce((s,c)=>s+(c-ideal)**2,0)/18);
  const maxCount=Math.max(...Object.values(counts));
  const maxShare=n?maxCount/n:0;
  const marginalPenalty=(Object.values(heat).reduce((s,c)=>s+Math.abs(c/n-1/3),0)+Object.values(pressure).reduce((s,c)=>s+Math.abs(c/n-1/3),0)+Object.values(agreement).reduce((s,c)=>s+Math.abs(c/n-1/2),0));
  return {thresholds:t,occupied,unused:18-occupied,normalizedEntropy:+normalizedEntropy.toFixed(4),rmse:+rmse.toFixed(3),maxCount,maxShare:+maxShare.toFixed(4),marginals:{heat,pressure,agreement},counts};
}
function validMarginals(e,n){
  return Object.values(e.marginals.heat).every(c=>c>=n*.15)&&
    Object.values(e.marginals.pressure).every(c=>c>=n*.15)&&
    Object.values(e.marginals.agreement).every(c=>c>=n*.25);
}
function better(a,b,quant){
  if(!b)return true;
  if(a.occupied!==b.occupied)return a.occupied>b.occupied;
  if(a.normalizedEntropy!==b.normalizedEntropy)return a.normalizedEntropy>b.normalizedEntropy;
  if(a.rmse!==b.rmse)return a.rmse<b.rmse;
  if(a.maxShare!==b.maxShare)return a.maxShare<b.maxShare;
  if(a.marginalPenalty!==b.marginalPenalty)return a.marginalPenalty<b.marginalPenalty;
  const dist=x=>Math.abs(x.thresholds.heat[0]-quant.heat[0])+Math.abs(x.thresholds.heat[1]-quant.heat[1])+Math.abs(x.thresholds.pressure[0]-quant.pressure[0])+Math.abs(x.thresholds.pressure[1]-quant.pressure[1])+Math.abs(x.thresholds.agreement-quant.agreement);
  return dist(a)<dist(b);
}
function optimize(rows,roundedQ){
  let best=null;
  const n=rows.length;
  for(let h1=10;h1<=70;h1+=5)for(let h2=h1+10;h2<=90;h2+=5)
  for(let p1=10;p1<=70;p1+=5)for(let p2=p1+5;p2<=90;p2+=5)
  for(let a=10;a<=90;a+=5){
    const e=evaluate(rows,{heat:[h1,h2],pressure:[p1,p2],agreement:a});
    if(!validMarginals(e,n))continue;
    e.marginalPenalty=(Object.values(e.marginals.heat).reduce((s,c)=>s+Math.abs(c/n-1/3),0)+Object.values(e.marginals.pressure).reduce((s,c)=>s+Math.abs(c/n-1/3),0)+Object.values(e.marginals.agreement).reduce((s,c)=>s+Math.abs(c/n-1/2),0));
    if(better(e,best,roundedQ))best=e;
  }
  return best;
}
function topStates(e){
  return Object.entries(e.counts).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).map(([state,count])=>({state,count}));
}

const rows=loadRuns();
if(!rows.length)throw new Error(`No report files found from ${START} through ${END}`);
const q={heat:quantileSummary(rows.map(r=>r.heat)),pressure:quantileSummary(rows.map(r=>r.pressure)),agreement:quantileSummary(rows.map(r=>r.agreement))};
const currentT={heat:[40,55],pressure:[45,56],agreement:45};
const quantT=thresholdsFromQuantiles(rows);
const roundedT=roundedQuantiles(quantT);
const current=evaluate(rows,currentT);
const percentile=evaluate(rows,quantT);
const rounded=evaluate(rows,roundedT);
const optimized=optimize(rows,roundedT);
const output={
  state:'PASS',mode:'READ_ONLY_CALIBRATION',period:{start:START,end:END,issuedReports:rows.length,dates:new Set(rows.map(r=>r.date)).size},
  observed:q,
  current:{...current,states:topStates(current)},
  percentile:{...percentile,states:topStates(percentile)},
  roundedPercentile:{...rounded,states:topStates(rounded)},
  optimizedRounded:optimized?{...optimized,states:topStates(optimized)}:null,
  sample:rows
};
console.log(JSON.stringify(output,null,2));
