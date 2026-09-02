#!/usr/bin/env node
import fs from 'node:fs';

const RUNTIME='assets/runner-core-runtime.js';
const WORKFLOW='.github/workflows/vigscope-meter-production-regression.yml';

function fail(message){throw new Error(message);}
function replaceOnce(text,from,to,label){
  const count=text.split(from).length-1;
  if(count!==1)fail(`${label}: expected exactly one match, found ${count}`);
  return text.replace(from,to);
}

let runtime=fs.readFileSync(RUNTIME,'utf8');

runtime=replaceOnce(
  runtime,
  "function signedOdds(v){return [...String(v||'').replace(/−/g,'-').matchAll(/([+-]\\d{2,4})(?![\\d.])/g)].map(m=>Number(m[1])).filter(Number.isFinite)}\nfunction recWeight(rec){",
  "function signedOdds(v){return [...String(v||'').replace(/−/g,'-').matchAll(/([+-]\\d{2,4})(?![\\d.])/g)].map(m=>Number(m[1])).filter(Number.isFinite)}\nfunction explicitMovementOddsPairs(v){const text=String(v||'').replace(/−/g,'-'),pairs=[],re=/([+-]\\d{2,4})\\s*(?:→|->|=>|\\bTO\\b)\\s*([+-]\\d{2,4})/gi;for(const m of text.matchAll(re))pairs.push([Number(m[1]),Number(m[2])]);return pairs}\nfunction recWeight(rec){",
  'insert explicit movement pair parser'
);

runtime=replaceOnce(
  runtime,
  "  const nums=signedOdds(rec?.move);\n  if(nums.length>=2){const favors=[],mags=[];for(let i=0;i+1<nums.length;i+=2){const a=americanProb(nums[i]),b=americanProb(nums[i+1]);if(a!==null&&b!==null){favors.push(a-b);mags.push(Math.abs(a-b))}}if(favors.length)return {favor:mean(favors)||0,magnitude:mean(mags)||0,source:'MOVE'}}\n  const text=String(rec?.move||'').toUpperCase();",
  "  const pairs=explicitMovementOddsPairs(rec?.move);\n  if(pairs.length){const favors=[],mags=[];for(const [from,to] of pairs){const a=americanProb(from),b=americanProb(to);if(a!==null&&b!==null){favors.push(a-b);mags.push(Math.abs(a-b))}}if(favors.length)return {favor:mean(favors)||0,magnitude:mean(mags)||0,source:'MOVE'}}\n  const text=String(rec?.move||'').toUpperCase();",
  'replace generic numeric pairing'
);

runtime=replaceOnce(
  runtime,
  "  const needle=d.createElementNS(ns,'g');needle.setAttribute('class','gaugeNeedle');needle.style.transform=`rotate(${-72+clamp(reading.value)*1.44}deg)`;",
  "  const needle=d.createElementNS(ns,'g');needle.setAttribute('class','gaugeNeedle');needle.style.transform=`rotate(${-72+clamp(reading.value)*1.44}deg)`;if(Number(reading.confidence)<=0)needle.style.opacity='0';",
  'hide needle when unmeasured'
);

runtime=replaceOnce(
  runtime,
  "  const read=el(d,'div','instrumentRead');read.append(el(d,'b','',`${reading.value}`),d.createTextNode(reading.label));wrap.appendChild(read);",
  "  const displayValue=Number(reading.confidence)>0?`${reading.value}`:'—';const read=el(d,'div','instrumentRead');read.append(el(d,'b','',displayValue),d.createTextNode(reading.label));wrap.appendChild(read);",
  'render dash when unmeasured'
);

runtime=replaceOnce(
  runtime,
  "  const agreementConfidence=r.agreement.rawConfidence??r.agreement.confidence;\n  const heat=h<VIG_HEAT_LOW_MAX?'LOW':h<VIG_HEAT_HIGH_MIN?'MEDIUM':'HIGH';",
  "  const agreementConfidence=r.agreement.rawConfidence??r.agreement.confidence;\n  const heatConfidence=Number(r.heat.confidence)||0,pressureConfidence=Number(r.pressure.confidence)||0;\n  const heat=h<VIG_HEAT_LOW_MAX?'LOW':h<VIG_HEAT_HIGH_MIN?'MEDIUM':'HIGH';",
  'capture heat pressure confidence'
);

runtime=replaceOnce(
  runtime,
  "  const agreement=agreementConfidence>0?(a<VIG_AGREEMENT_HIGH_MIN?'LOW':'HIGH'):'LOW';\n  const key=[heat,pressure,agreement].join('|');",
  "  const agreement=agreementConfidence>0?(a<VIG_AGREEMENT_HIGH_MIN?'LOW':'HIGH'):'LOW';\n  if(heatConfidence<=0||pressureConfidence<=0){const label=heatConfidence<=0&&pressureConfidence<=0?'MARKET STATE UNMEASURED':'MARKET STATE PARTIAL';return {emoji:'⚪',label,agreementState:agreementConfidence>0?agreement:'UNMEASURED',agreementRender:agreement}}\n  const key=[heat,pressure,agreement].join('|');",
  'guard overall state when movement evidence missing'
);

fs.writeFileSync(RUNTIME,runtime,'utf8');

let workflow=fs.readFileSync(WORKFLOW,'utf8');
if(!workflow.includes("tests/vigscope-meter-fallback-safety.test.mjs")){
  workflow=replaceOnce(
    workflow,
    "      - 'tests/vigscope-meter-production.test.mjs'\n",
    "      - 'tests/vigscope-meter-production.test.mjs'\n      - 'tests/vigscope-meter-fallback-safety.test.mjs'\n",
    'add safety test workflow path'
  );
  workflow=replaceOnce(
    workflow,
    "      - name: Run calibrated meter regression\n        run: node tests/vigscope-meter-production.test.mjs\n",
    "      - name: Run calibrated meter regression\n        run: node tests/vigscope-meter-production.test.mjs\n      - name: Run fallback meter safety regression\n        run: node tests/vigscope-meter-fallback-safety.test.mjs\n",
    'add safety test workflow step'
  );
  workflow=replaceOnce(
    workflow,
    "          grep -F \"AGREEMENT UNMEASURED\" assets/runner-core-runtime.js\n",
    "          grep -F \"AGREEMENT UNMEASURED\" assets/runner-core-runtime.js\n          grep -F \"function explicitMovementOddsPairs(v)\" assets/runner-core-runtime.js\n          grep -F \"MARKET STATE UNMEASURED\" assets/runner-core-runtime.js\n",
    'add runtime safety wiring checks'
  );
}
fs.writeFileSync(WORKFLOW,workflow,'utf8');

console.log('VIGSCOPE METER FALLBACK SAFETY PATCH APPLIED');
