import {replacementEstimate} from './graham-replacement-model.mjs';
import {historicalExposure} from './graham-historical-exposure.mjs';
const need=(x,code)=>{if(!x)throw Error(code);};
const nonempty=x=>typeof x==='string'&&x.trim().length>0;
const round=x=>Number(x.toFixed(3));

// Historical estimation convention only. A defensive/receiving OVR is not a
// calibrated special-teams value; retain the full assumed proxy range.
export function specialTeamsOnlyEstimate(c,healthy,replacements,{sourceCheck}){
 need(c.resolution==='SPECIAL_TEAMS_ONLY_DUTY_ESTIMATE'&&c.modelId==='graham-st-only-duty-estimate-v1'&&c.estimateAcknowledged===true&&c.specialTeamsOnly===true&&c.documentedInjuryAbsence===true&&c.offenseOrDefenseDutyExcluded===true&&['OUT','IR','PARTIAL_GAME'].includes(c.availabilityStatus)&&c.proxyConvention==='ZERO_TO_FULL_NON_QB_DIFFERENCE_MIDPOINT'&&nonempty(c.roleScopeRationale),'ST_ONLY_DECLARATION_REQUIRED');
 sourceCheck(c.roleScopeSourceIds);
 const supported=p=>p.valueStatus==='CALIBRATED'||p.valueProvenance?.type==='INDEPENDENT_MADDEN_27';
 need(supported(healthy)&&replacements.every(supported),'ST_ONLY_SOURCE_BOUND_VALUES_REQUIRED');
 const role=replacementEstimate({...c,resolution:c.replacementResolution,modelId:'graham-replacement-role-estimate-v1'},healthy.waltersPoints,replacements,{sourceCheck});
 const exposure=c.availabilityStatus==='PARTIAL_GAME'?historicalExposure(c.exposure,sourceCheck):null;
 const effective=role.replacementValueRatio.numerator/role.replacementValueRatio.denominator,difference=Math.max(0,healthy.waltersPoints-effective),fraction=exposure?.fraction??1;
 const injuryLoss=round(difference*fraction/2);
 return {...role,modelId:c.modelId,method:c.resolution,classification:'GRAHAM_MODEL_ESTIMATE',injuryLoss,rawTeamContributionDelta:-injuryLoss,injuryLossRange:{min:0,max:round(difference*(exposure?.fractionRange?.max??1))},proxyConvention:c.proxyConvention,roleScopeRationale:c.roleScopeRationale,...(exposure?{exposure}:{}),limitation:'Explicit midpoint between zero ST-only loss and the full non-QB replacement-difference proxy. The ceiling is an assumed modelling bound, not a calibrated ST value or confidence interval. Source-supported depth is an allocation assumption, not an observed substitution or snap-to-time conversion.'};
}

// Only the directly documented scoring opportunity is quantified. Do not turn
// a bad snap into an invented whole-game specialist rating.
export function specialistScoreImpactEstimate(c,{officialCheck,seenEvents}){
 need(c.method==='DOCUMENTED_SPECIALIST_SCORE_IMPACT_ESTIMATE'&&c.modelId==='graham-specialist-score-impact-v1'&&c.estimateAcknowledged===true&&c.availableProfessionalReplacement===true&&c.materialRoleDisruption===true&&c.scoreImpactConvention==='ZERO_TO_DOCUMENTED_OPPORTUNITY_MIDPOINT'&&Array.isArray(c.events)&&c.events.length>0,'SPECIALIST_SCORE_DECLARATION_REQUIRED');
 officialCheck(c.sourceIds);officialCheck(c.replacementSourceIds);
 let possible=0;
 for(const e of c.events){
  need(nonempty(e.eventId)&&!seenEvents.has(e.eventId)&&e.type==='MISSED_EXTRA_POINT'&&e.cause==='DOCUMENTED_REPLACEMENT_SNAP_ERROR'&&e.possiblePoints===1&&Number.isInteger(e.quarter)&&e.quarter>=1&&e.quarter<=4&&/^(?:0[0-9]|1[0-5]):[0-5][0-9]$/.test(e.clock||'')&&nonempty(e.rationale),'SPECIALIST_SCORE_EVENT_REQUIRED');
  officialCheck(e.sourceIds);seenEvents.add(e.eventId);possible+=e.possiblePoints;
 }
 return {...c,classification:'GRAHAM_MODEL_ESTIMATE',injuryLoss:possible/2,injuryLossRange:{min:0,max:possible},uncertainty:'BOUNDED_SCORING_ASSUMPTION_OTHER_EFFECTS_UNQUANTIFIED',limitation:'Only documented replacement-error scoring opportunities are quantified, using the midpoint from zero to their possible score. Normal execution is not assumed certain. No Madden specialist value, inferred punting-distance effect or generic whole-game penalty is invented.'};
}
