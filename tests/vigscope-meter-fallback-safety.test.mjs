import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  calibratedHeat,
  calibratedPressure
} from '../tools/vigscope-meter-production.mjs';

const RUNTIME = fs.readFileSync('assets/runner-core-runtime.js', 'utf8');
const RUN = JSON.parse(fs.readFileSync('data/history/runs/2026-09-02/open-060215.json', 'utf8'));

function americanFromText(v){const m=String(v||'').replace(/−/g,'-').match(/[+-]?\d{2,4}/);return m?Number(m[0]):null;}
function americanProb(a){const n=Number(a);if(!Number.isFinite(n)||n===0)return null;return n>0?100/(n+100):(-n)/((-n)+100);}
function clamp(v,min=0,max=100){return Math.max(min,Math.min(max,Number(v)||0));}
function mean(values){const a=(values||[]).filter(Number.isFinite);return a.length?a.reduce((x,y)=>x+y,0)/a.length:null;}
function recWeight(rec){const s=String(rec?.status||'PASS').toUpperCase();return s==='BET'?1.5:s==='LEAN'?1.2:s==='WAIT'?0.8:0.45;}

function explicitMovementOddsPairs(v){
  const text=String(v||'').replace(/−/g,'-');
  const pairs=[];
  const re=/([+-]\d{2,4})\s*(?:→|->|=>|\bTO\b)\s*([+-]\d{2,4})/gi;
  for(const match of text.matchAll(re)) pairs.push([Number(match[1]),Number(match[2])]);
  return pairs;
}

function moveSignal(rec){
  const issued=americanFromText(rec?.price),pc=rec?.priceComparison;
  if(pc?.state==='MATCHED'){
    const current=americanFromText(pc.price),a=americanProb(issued),b=americanProb(current);
    if(a!==null&&b!==null)return {favor:a-b,magnitude:Math.abs(a-b),source:'REPRICE'};
  }
  const pairs=explicitMovementOddsPairs(rec?.move);
  if(pairs.length){
    const favors=[],mags=[];
    for(const [from,to] of pairs){
      const a=americanProb(from),b=americanProb(to);
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
    return {score,confidence:clamp(((diffs.length*2+signals)/Math.max(1,recs.length*2))*100),pairs:diffs.length};
  }
  if(!signals)return {score:50,confidence:0,pairs:0};
  return {score:clamp(50+aligned*14+stable*5-conflicted*20),confidence:clamp((signals/Math.max(1,recs.length))*70),pairs:0};
}

const signals=RUN.recs.map(moveSignal);
assert.equal(signals.length,8);
assert.ok(signals.every(s=>!['MOVE','REPRICE'].includes(s.source)), '06:00 PASS price/playTo text must not create numeric market movement');
assert.ok(signals.every(s=>s.magnitude===0), '06:00 PASS fixture must have zero movement magnitude');
assert.ok(RUN.recs.every(rec=>explicitMovementOddsPairs(rec.move).length===0));

assert.deepEqual(explicitMovementOddsPairs('Bet365 +120 → +130'), [[120,130]]);
assert.deepEqual(explicitMovementOddsPairs('price moved from -115 to -105'), [[-115,-105]]);
assert.deepEqual(explicitMovementOddsPairs('PASS / NO VALUE — +125 is inside fair and below the +180 action boundary.'), []);

const weighted=signals.reduce((n,x,i)=>n+x.favor*recWeight(RUN.recs[i]),0)/(signals.reduce((n,x,i)=>n+recWeight(RUN.recs[i]),0)||1);
const agreement=fallbackAgreement(RUN);
const heat=calibratedHeat({avgMagnitude:0,breadth:0,thresholdActivity:0,agreementScore:agreement.score,agreementConfidence:agreement.confidence});
const pressure=calibratedPressure(weighted);
assert.equal(heat,0);
assert.equal(pressure,50);
assert.equal(agreement.score,50);
assert.equal(agreement.confidence,0);

for(const token of [
  'function explicitMovementOddsPairs(v)',
  'const pairs=explicitMovementOddsPairs(rec?.move);',
  "const displayValue=Number(reading.confidence)>0?`${reading.value}`:'—';",
  "if(Number(reading.confidence)<=0)needle.style.opacity='0';",
  "'MARKET STATE UNMEASURED'"
]) assert.ok(RUNTIME.includes(token), `runtime missing fallback-safety token: ${token}`);

assert.ok(!RUNTIME.includes('const nums=signedOdds(rec?.move);'), 'runtime must not generically pair arbitrary odds in rec.move');

console.log(JSON.stringify({
  state:'PASS',
  fixture:'2026-09-02 06:00',
  falseMovementSignals:0,
  expectedUnmeasuredDisplay:{heat:'—',pressure:'—',agreement:'—'},
  internalFallback:{heat,pressure,agreementScore:agreement.score,agreementConfidence:agreement.confidence}
},null,2));
