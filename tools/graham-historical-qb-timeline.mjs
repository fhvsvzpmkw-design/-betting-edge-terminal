import {historicalExposure} from './graham-historical-exposure.mjs';
const fail=m=>{throw Error(m);},nonempty=s=>typeof s==='string'&&s.trim().length>0,round=n=>Number(n.toFixed(3));

// Historical injury duty only. Segments partition elapsed regulation time;
// they do not modify the current performance model or infer medical impairment.
export function historicalQbTimeline(qb,{lookup,sourceCheck}){
  if(qb.estimateAcknowledged!==true||qb.lossCause!=='BASELINE_OUT_WITH_INJURY_DRIVEN_RELIEF_CHANGE'||!nonempty(qb.baselineRationale)||!nonempty(qb.replacementRationale))fail('QB_TIMELINE_DECLARATION_REQUIRED');
  sourceCheck(qb.baselineSourceIds);sourceCheck(qb.replacementSourceIds);
  const healthy=(qb.healthyCandidates||[]).map(p=>lookup(p.player,p.eaPlayerId,true));
  if(!healthy.length||healthy.some(p=>p.position!=='QB')||new Set(healthy.map(p=>p.waltersPoints)).size!==1||new Set(healthy.map(p=>p.eaPlayerId)).size!==healthy.length)fail('QB_TIMELINE_BASELINE_REQUIRED');
  if(!Array.isArray(qb.segments)||qb.segments.length<2)fail('QB_TIMELINE_SEGMENTS_REQUIRED');
  let prior=null,loss=0,min=0,max=0,duration=null;
  const segments=qb.segments.map((s,index)=>{
    if(s.lossCause!==(index?'INJURY_DRIVEN_RELIEF_CHANGE':'BASELINE_INJURY_REPLACEMENT')||!nonempty(s.rationale))fail('QB_TIMELINE_INJURY_REASON_REQUIRED');
    sourceCheck(s.sourceIds);
    const p=lookup(s.replacement?.player,s.replacement?.eaPlayerId,true);
    if(p.position!=='QB'||healthy.some(h=>h.eaPlayerId===p.eaPlayerId)||!Number.isFinite(p.waltersPoints))fail('QB_TIMELINE_RELIEF_IDENTITY');
    const exposure=historicalExposure(s.exposure,sourceCheck),intervals=exposure.unavailableIntervals;
    if(intervals?.length!==1||exposure.unavailableSnapEstimate||exposure.unavailableDurationEstimate)fail('QB_TIMELINE_CLOCK_INTERVAL_REQUIRED');
    const i=intervals[0];duration??=exposure.gameDurationSeconds;
    if(duration!==exposure.gameDurationSeconds||(!prior&&(i.startEarliest!==0||i.startLatest!==0))||(prior&&(i.startEarliest!==prior.endEarliest||i.startLatest!==prior.endLatest)))fail('QB_TIMELINE_PARTITION_CONFLICT');
    const difference=Math.max(0,healthy[0].waltersPoints-p.waltersPoints);
    loss+=difference*exposure.fraction;min+=difference*exposure.fractionRange.min;max+=difference*exposure.fractionRange.max;
    prior=i;
    return {replacement:{player:p.player,eaPlayerId:p.eaPlayerId,lockedValue:p.waltersPoints},fullGameLoss:difference,exposure,lossCause:s.lossCause,rationale:s.rationale,sourceIds:s.sourceIds};
  });
  if(prior.endEarliest!==duration||prior.endLatest!==duration)fail('QB_TIMELINE_PARTITION_INCOMPLETE');
  return {modelId:'graham-historical-qb-timeline-v1',classification:'GRAHAM_MODEL_ESTIMATE',healthyCandidates:healthy.map(p=>({player:p.player,eaPlayerId:p.eaPlayerId,lockedValue:p.waltersPoints})),segments,injuryLoss:round(loss),rawTeamContributionDelta:-round(loss),injuryLossRange:{min:round(min),max:round(max)},baselineRationale:qb.baselineRationale,replacementRationale:qb.replacementRationale,sourceIds:qb.sourceIds,limitation:'Elapsed time estimates injury-related replacement duty against one frozen healthy baseline. Clock sensitivity is not a confidence interval. No performance benching, unpriced QB or current performance-model recalibration.'};
}
