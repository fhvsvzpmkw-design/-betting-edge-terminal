#!/usr/bin/env node
import fs from 'node:fs';

const DEFAULT_CAL='data/walters/nfl/personnel-calibration-v1.json';
const readJson=p=>JSON.parse(fs.readFileSync(p,'utf8'));

export function bandValue(bands,ovr){
  const n=Number(ovr);
  if(!Number.isFinite(n)) throw new Error('Missing/invalid Madden OVR');
  const b=bands.find(x=>n>=x.ovrMin&&n<=x.ovrMax);
  if(!b) throw new Error(`OVR ${n} outside calibration bands`);
  return Number(b.points);
}

export function playerValue(cal,{position,maddenOvr}){
  const p=String(position||'').toUpperCase();
  if(cal.qbConversion.eligiblePositions.includes(p)) return bandValue(cal.qbConversion.bands,maddenOvr);
  if(cal.nonQbConversion.eligiblePositions.includes(p)) return bandValue(cal.nonQbConversion.bands,maddenOvr);
  throw Object.assign(new Error(`No governed value curve for position ${p}`),{code:'REVIEW_REQUIRED_SPECIALIST_VALUE'});
}

function assertPct(v){
  const n=Number(v);
  if(!Number.isFinite(n)||n<0||n>1) throw Object.assign(new Error('approvedEffectivenessPct must be 0..1'),{code:'REVIEW_REQUIRED_EFFECTIVENESS'});
  return n;
}

export function individualDelta(cal,input){
  const status=String(input.availabilityStatus||'UNKNOWN').toUpperCase();
  const rule=cal.availabilityRules[status]||cal.availabilityRules.UNKNOWN;
  const healthy=Number(input.healthyValue);
  if(!Number.isFinite(healthy)) throw Object.assign(new Error('healthyValue is required'),{code:'REVIEW_REQUIRED_PLAYER_VALUE'});
  if(status==='ACTIVE_FULL') return {...input,rawTeamContributionDelta:0};
  if(['OUT','IR','SUSPENDED','COMMISSIONER_EXEMPT'].includes(status)){
    const replacement=Number(input.replacementValue);
    if(!Number.isFinite(replacement)) throw Object.assign(new Error('replacementValue is required'),{code:'REVIEW_REQUIRED_REPLACEMENT_VALUE'});
    return {...input,rawTeamContributionDelta:Number((replacement-healthy).toFixed(3))};
  }
  if(status==='PLAYING_LIMITED'){
    if(input.approvedEffectivenessPct==null) throw Object.assign(new Error('approvedEffectivenessPct is required'),{code:'REVIEW_REQUIRED_EFFECTIVENESS'});
    const pct=assertPct(input.approvedEffectivenessPct);
    return {...input,rawTeamContributionDelta:Number(((healthy*pct)-healthy).toFixed(3))};
  }
  throw Object.assign(new Error(rule.action||'REVIEW_REQUIRED_AVAILABILITY'),{code:rule.action||'REVIEW_REQUIRED_AVAILABILITY'});
}

export function clusterMultiplier(cal,group,entries){
  const g=cal.clusterRules[group];
  if(!g) return {multiplier:1,reviewRequired:false};
  const losses=entries.filter(x=>Number(x.rawTeamContributionDelta)<0);
  if(group==='RECEIVER') return {multiplier:losses.length>=2?Number(g.multiplier):1,reviewRequired:false};
  if(group==='DEFENSIVE_LINE') return {multiplier:losses.length>=2?Number(g.multiplier):1,reviewRequired:false};
  return {multiplier:1,reviewRequired:losses.length>=2&&Boolean(g.multipleMaterialLossAction),code:g.multipleMaterialLossAction||null};
}

export function applyTeamPersonnel(cal,{side,group,entries,matchupOverride=null}){
  const computed=entries.map(e=>individualDelta(cal,e));
  const c=clusterMultiplier(cal,group,computed);
  if(c.reviewRequired) throw Object.assign(new Error(c.code),{code:c.code});
  const raw=computed.reduce((s,e)=>s+Number(e.rawTeamContributionDelta),0);
  let final=raw*Number(c.multiplier||1);
  if(matchupOverride!=null){
    if(matchupOverride.status!=='WALTERS_CALIBRATED_MATCHUP_OVERRIDE'||!Number.isFinite(Number(matchupOverride.teamContributionDelta)))
      throw new Error('Invalid matchup override');
    final=Number(matchupOverride.teamContributionDelta);
  }
  final=Number(final.toFixed(3));
  const s=String(side||'').toUpperCase();
  if(!['HOME','AWAY'].includes(s)) throw new Error('side must be HOME or AWAY');
  const pointsToHomeSpread=Number((s==='HOME'?-final:final).toFixed(3));
  return {entries:computed,clusterGroup:group||null,clusterMultiplier:Number(c.multiplier||1),rawTeamContributionDelta:Number(raw.toFixed(3)),finalTeamContributionDelta:final,pointsToHomeSpread};
}

export function applyToFair(priorFair,personnelAdjustments){
  const prior=Number(priorFair);
  if(!Number.isFinite(prior)) throw new Error('priorFair must be numeric');
  const delta=personnelAdjustments.reduce((s,a)=>s+Number(a.pointsToHomeSpread||0),0);
  const exact=Number((prior+delta).toFixed(2));
  const published=Math.round(exact*2)/2;
  return {priorGrahamFairHome:prior,personnelDeltaToHomeSpread:Number(delta.toFixed(2)),exactGrahamFairHome:exact,publishedGrahamFairHome:published};
}

if(import.meta.url===`file://${process.argv[1]}`){
  const cal=readJson(process.argv[2]||DEFAULT_CAL);
  if(process.argv[3]){
    const input=readJson(process.argv[3]);
    const out=applyTeamPersonnel(cal,input);
    process.stdout.write(JSON.stringify(out,null,2)+'\n');
  } else {
    const checks={
      calibrationId:cal.calibrationId,
      qb99:playerValue(cal,{position:'QB',maddenOvr:99}),
      qb70:playerValue(cal,{position:'QB',maddenOvr:70}),
      wr99:playerValue(cal,{position:'WR',maddenOvr:99}),
      wr82:playerValue(cal,{position:'WR',maddenOvr:82}),
      ordinaryNonQb:playerValue(cal,{position:'CB',maddenOvr:68})
    };
    if(checks.qb99!==9.5||checks.qb70!==7||checks.wr99!==3||checks.wr82!==0.5||checks.ordinaryNonQb!==0) throw new Error('Calibration self-check failed');
    console.log(`WALTERS PERSONNEL CALIBRATION VERIFY: PASS // ${cal.calibrationId}`);
  }
}
