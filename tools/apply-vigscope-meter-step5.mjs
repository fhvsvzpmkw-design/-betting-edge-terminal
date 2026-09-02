#!/usr/bin/env node
import fs from 'node:fs';

const file='assets/runner-core-runtime.js';
let src=fs.readFileSync(file,'utf8');
const original=src;

function replaceOnce(oldText,newText,label){
  const count=src.split(oldText).length-1;
  if(count!==1)throw new Error(`${label}: expected exactly one legacy match, found ${count}`);
  src=src.replace(oldText,newText);
}

if(!src.includes("VIG_METER_CALIBRATION_ID='vigscope-meter-calibration-v1'")){
  replaceOnce(
    "const BOOK_PRIORITY=['Bet365','DraftKings'];\n",
    "const BOOK_PRIORITY=['Bet365','DraftKings'];\nconst VIG_METER_CALIBRATION_ID='vigscope-meter-calibration-v1';\nconst VIG_HEAT_LOW_MAX=20,VIG_HEAT_HIGH_MIN=40,VIG_PRESSURE_ADVERSE_MAX=48,VIG_PRESSURE_FAVORABLE_MIN=52,VIG_AGREEMENT_HIGH_MIN=45;\n",
    'calibration constants'
  );

  replaceOnce(
    "function pressureLabel(v){return v<15?'HEAVY AGAINST':v<30?'AGAINST':v<45?'LEAN AGAINST':v<56?'NEUTRAL':v<71?'LEAN FAVORABLE':v<86?'FAVORABLE':'STRONG FAVORABLE'}",
    "function pressureLabel(v){return v<15?'HEAVY AGAINST':v<30?'AGAINST':v<48?'LEAN AGAINST':v<52?'NEUTRAL':v<71?'LEAN FAVORABLE':v<86?'FAVORABLE':'STRONG FAVORABLE'}",
    'pressure descriptive label boundaries'
  );

  replaceOnce(
    "function agreementLabel(v){return v<15?'FRACTURED':v<30?'WIDE':v<45?'MIXED':v<60?'NORMAL':v<75?'TIGHT':v<90?'STRONG':'LOCKSTEP'}\n",
    "function agreementLabel(v){return v<15?'FRACTURED':v<30?'WIDE':v<45?'MIXED':v<60?'NORMAL':v<75?'TIGHT':v<90?'STRONG':'LOCKSTEP'}\nfunction agreementEvidenceQuality(confidence){const c=clamp(confidence);return c===0?'UNMEASURED':c<25?'LIMITED':'SUPPORTED'}\n",
    'agreement evidence quality helper'
  );

  const derive=/function deriveInstrumentReadings\(run\)\{[\s\S]*?\n\}\nfunction vancouverIso/;
  const deriveMatch=src.match(derive);
  if(!deriveMatch)throw new Error('deriveInstrumentReadings block not found');
  const deriveReplacement=`function deriveInstrumentReadings(run){
  const recs=Array.isArray(run?.recs)?run.recs:[],signals=recs.map(r=>({...moveSignal(r),weight:recWeight(r)}));
  const weighted=signals.reduce((n,x)=>n+x.weight,0)||1;
  const fav=signals.reduce((n,x)=>n+x.favor*x.weight,0)/weighted;
  const mags=signals.map(x=>x.magnitude),avgMag=mean(mags)||0;
  const breadth=recs.length?signals.filter(x=>x.magnitude>=.0025).length/recs.length:0;
  const th=(recs.map(thresholdActivity).filter(x=>x!==null));const threshold=mean(th)||0;
  const agreement=instrumentAgreement(run),agreementScore=clamp(agreement?.score??50),agreementConfidence=clamp(agreement?.confidence??0);
  const dispersion=agreementConfidence>0?(100-agreementScore)/100:0;
  const confidenceFactor=agreementConfidence===0?0:0.50+0.50*Math.sqrt(agreementConfidence/100);
  const heat=clamp((avgMag/.03)*40+breadth*25+threshold*20+dispersion*15*confidenceFactor);
  const pressure=clamp(50+50*Math.tanh(fav/0.028));
  const movementCoverage=recs.length?signals.filter(x=>x.source!=='NONE').length/recs.length:0;
  const pressureConf=clamp(movementCoverage*100),heatConf=clamp((movementCoverage*.7+(agreementConfidence/100)*.3)*100);
  const agreementQuality=agreementEvidenceQuality(agreementConfidence);
  return {
    heat:{value:Math.round(heat),rawValue:heat,label:heatConf?heatLabel(heat):'NO DATA',confidence:Math.round(heatConf)},
    pressure:{value:Math.round(pressure),rawValue:pressure,label:pressureConf?pressureLabel(pressure):'NO DATA',confidence:Math.round(pressureConf)},
    agreement:{value:Math.round(agreementScore),rawValue:agreementScore,label:agreementConfidence?agreementLabel(agreementScore):'UNMEASURED',confidence:Math.round(agreementConfidence),rawConfidence:agreementConfidence,evidenceQuality:agreementQuality,pairs:agreement.pairs||0}
  }
}
function vancouverIso`;
  src=src.replace(derive,deriveReplacement);

  replaceOnce(
    "  wrap.appendChild(el(d,'div','instrumentConf',`CONF ${reading.confidence}%${reading.pairs?` • ${reading.pairs} PAIRS`:''}`));",
    "  const evidence=reading.evidenceQuality?` • ${reading.evidenceQuality}`:'';wrap.appendChild(el(d,'div','instrumentConf',`CONF ${reading.confidence}%${evidence}${reading.pairs?` • ${reading.pairs} PAIRS`:''}`));",
    'instrument evidence display'
  );

  const market=/function marketState\(run\)\{\n  const r=deriveInstrumentReadings\(run\),h=r\.heat\.value,p=r\.pressure\.value,a=r\.agreement\.value;\n  const heat=h<40\?'LOW':h<55\?'MEDIUM':'HIGH';\n  const pressure=p<45\?'ADVERSE':p<56\?'NEUTRAL':'FAVORABLE';\n  const agreement=a<45\?'LOW':'HIGH';/;
  const marketReplacement=`function marketState(run){
  const r=deriveInstrumentReadings(run);
  const h=r.heat.rawValue??r.heat.value,p=r.pressure.rawValue??r.pressure.value,a=r.agreement.rawValue??r.agreement.value;
  const agreementConfidence=r.agreement.rawConfidence??r.agreement.confidence;
  const heat=h<VIG_HEAT_LOW_MAX?'LOW':h<VIG_HEAT_HIGH_MIN?'MEDIUM':'HIGH';
  const pressure=p<VIG_PRESSURE_ADVERSE_MAX?'ADVERSE':p<VIG_PRESSURE_FAVORABLE_MIN?'NEUTRAL':'FAVORABLE';
  const agreement=agreementConfidence>0?(a<VIG_AGREEMENT_HIGH_MIN?'LOW':'HIGH'):'LOW';`;
  if(!market.test(src))throw new Error('marketState legacy thresholds not found');
  src=src.replace(market,marketReplacement);

  replaceOnce(
    "  return {emoji:s[0],label:s[1]}\n}",
    "  return {emoji:s[0],label:s[1],agreementState:agreementConfidence>0?agreement:'UNMEASURED',agreementRender:agreement}\n}",
    'market state evidence return'
  );

  replaceOnce(
    "    fresh.append(el(d,'span','feedMeta',priceStateText),el(d,'span','marketStateLabel',`${state.emoji} ${state.label}`));",
    "    fresh.append(el(d,'span','feedMeta',priceStateText),el(d,'span','marketStateLabel',`${state.emoji} ${state.label}${state.agreementState==='UNMEASURED'?' • AGREEMENT UNMEASURED':''}`));",
    'visible unmeasured market label'
  );
}

const required=[
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
  "const agreement=agreementConfidence>0?(a<VIG_AGREEMENT_HIGH_MIN?'LOW':'HIGH'):'LOW';",
  "state.agreementState==='UNMEASURED'?' • AGREEMENT UNMEASURED':''"
];
for(const token of required)if(!src.includes(token))throw new Error(`missing post-patch token: ${token}`);
for(const forbidden of [
  'const heat=clamp((avgMag/.03)*40+breadth*25+threshold*20+dispersion*15);',
  'const pressure=clamp(50+fav*1000);',
  "const heat=h<40?'LOW':h<55?'MEDIUM':'HIGH';",
  "const pressure=p<45?'ADVERSE':p<56?'NEUTRAL':'FAVORABLE';",
  "const agreement=a<45?'LOW':'HIGH';"
])if(src.includes(forbidden))throw new Error(`legacy logic survived patch: ${forbidden}`);

if(src!==original)fs.writeFileSync(file,src);
console.log(JSON.stringify({state:'PASS',file,changed:src!==original,calibrationId:'vigscope-meter-calibration-v1'},null,2));
