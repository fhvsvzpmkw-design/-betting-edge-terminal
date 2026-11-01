import {createHash} from 'node:crypto';

function canonical(value){
  if(Array.isArray(value))return value.map(canonical);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,canonical(item)]));
  return value;
}
export function personnelCaseFingerprint(input){
  const {personnelEventId,matchupEventId,inputCaseSha256,...facts}=input;
  return createHash('sha256').update(JSON.stringify(canonical(facts))).digest('hex');
}
export function assertPersonnelCaseOrder(current,input,effectiveAt){
  const fingerprint=personnelCaseFingerprint(input);
  if(!current)return fingerprint;
  const previous=Date.parse(current.effectiveAt),incoming=Date.parse(effectiveAt);
  if(!Number.isFinite(previous)||!Number.isFinite(incoming))throw Error(`PERSONNEL_CASE_TIME_INVALID:${input.caseKey}`);
  if(incoming<previous)throw Error(`PERSONNEL_CASE_STALE:${input.caseKey}`);
  // An equal-clock append may repeat exactly the same facts under a new event
  // id. Different facts require an actual later observation clock.
  if(incoming===previous&&current.inputCaseSha256!==fingerprint)throw Error(`PERSONNEL_CASE_SAME_TIME_CONFLICT:${input.caseKey}`);
  return fingerprint;
}
export function latestRecordTime(...values){
  return values.filter(value=>Number.isFinite(Date.parse(value))).reduce((latest,value)=>!latest||Date.parse(value)>Date.parse(latest)?value:latest,null);
}
