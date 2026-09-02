export const VIG_METER_CALIBRATION_ID='vigscope-meter-calibration-v1';
export const HEAT_LOW_MAX=20;
export const HEAT_HIGH_MIN=40;
export const PRESSURE_ADVERSE_MAX=48;
export const PRESSURE_FAVORABLE_MIN=52;
export const AGREEMENT_HIGH_MIN=45;

export function clamp(v,min=0,max=100){return Math.max(min,Math.min(max,Number(v)||0));}

export function heatConfidenceFactor(confidence){
  const c=clamp(confidence);
  return c===0?0:0.50+0.50*Math.sqrt(c/100);
}

export function calibratedHeat({avgMagnitude=0,breadth=0,thresholdActivity=0,agreementScore=50,agreementConfidence=0}={}){
  const c=clamp(agreementConfidence);
  const dispersion=c>0?(100-clamp(agreementScore))/100:0;
  return clamp((Number(avgMagnitude)||0)/0.03*40+(Number(breadth)||0)*25+(Number(thresholdActivity)||0)*20+dispersion*15*heatConfidenceFactor(c));
}

export function calibratedPressure(signedFavor=0){
  return clamp(50+50*Math.tanh((Number(signedFavor)||0)/0.028));
}

export function agreementEvidenceQuality(confidence){
  const c=clamp(confidence);
  return c===0?'UNMEASURED':c<25?'LIMITED':'SUPPORTED';
}

export function classifyHeat(value){
  const v=clamp(value);
  return v<HEAT_LOW_MAX?'LOW':v<HEAT_HIGH_MIN?'MEDIUM':'HIGH';
}

export function classifyPressure(value){
  const v=clamp(value);
  return v<PRESSURE_ADVERSE_MAX?'ADVERSE':v<PRESSURE_FAVORABLE_MIN?'NEUTRAL':'FAVORABLE';
}

export function classifyAgreement(score,confidence){
  const c=clamp(confidence),quality=agreementEvidenceQuality(c);
  if(c===0)return {semantic:'UNMEASURED',render:'LOW',quality};
  const measured=clamp(score)<AGREEMENT_HIGH_MIN?'LOW':'HIGH';
  return {semantic:measured,render:measured,quality};
}

export const VIG_STATES=Object.freeze({
  'HIGH|FAVORABLE|HIGH':['🟢','COORDINATED FAVORABLE'],
  'HIGH|ADVERSE|HIGH':['🔴','COORDINATED ADVERSE'],
  'HIGH|FAVORABLE|LOW':['🟡','FAVORABLE BUT DISPUTED'],
  'HIGH|ADVERSE|LOW':['🟠','ADVERSE BUT DISPUTED'],
  'HIGH|NEUTRAL|LOW':['🟠','TURBULENT'],
  'HIGH|NEUTRAL|HIGH':['⚪','ACTIVE / BALANCED'],
  'MEDIUM|FAVORABLE|HIGH':['🟢','CONSTRUCTIVE'],
  'MEDIUM|ADVERSE|HIGH':['🔴','DETERIORATING'],
  'MEDIUM|FAVORABLE|LOW':['🟡','FAVORABLE / MIXED'],
  'MEDIUM|ADVERSE|LOW':['🟠','ADVERSE / MIXED'],
  'MEDIUM|NEUTRAL|HIGH':['⚪','ORDERLY'],
  'MEDIUM|NEUTRAL|LOW':['🟠','MIXED'],
  'LOW|FAVORABLE|LOW':['🟡','ISOLATED FAVORABLE'],
  'LOW|FAVORABLE|HIGH':['🟢','QUIET FAVORABLE'],
  'LOW|ADVERSE|HIGH':['🔴','QUIET ADVERSE'],
  'LOW|ADVERSE|LOW':['🟠','FRAGMENTED ADVERSE'],
  'LOW|NEUTRAL|HIGH':['⚪','SETTLED'],
  'LOW|NEUTRAL|LOW':['🔵','FRAGMENTED QUIET']
});

export function classifyVigState({heat,pressure,agreementScore,agreementConfidence}={}){
  const h=classifyHeat(heat),p=classifyPressure(pressure),a=classifyAgreement(agreementScore,agreementConfidence);
  const key=[h,p,a.render].join('|'),state=VIG_STATES[key]||['⚪','MIXED'];
  return {key,heat:h,pressure:p,agreement:a,emoji:state[0],label:state[1]};
}
