// User-approved Graham convention, not a formula attributed to Billy Walters.
export const REPLACEMENT_MODEL_ID='graham-replacement-role-estimate-v1';
export const MODEL_RESOLUTIONS=['PRIMARY_REPLACEMENT','WEIGHTED_COMMITTEE','EQUAL_SHARE_COMMITTEE'];
const fail=code=>{throw Error(code);};
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const text=x=>typeof x==='string'&&x.trim().length>0;
const round=x=>Number(x.toFixed(3));
export function replacementEstimate(c,healthy,replacements,{sourceCheck=()=>{}}={}){
  if(c.modelId!==REPLACEMENT_MODEL_ID||!MODEL_RESOLUTIONS.includes(c.resolution)||c.estimateAcknowledged!==true||!text(c.assumptionRationale))fail('REPLACEMENT_MODEL_DECLARATION_REQUIRED');
  if(!finite(healthy)||healthy<0||!replacements.length||replacements.some(r=>!finite(r.waltersPoints)||r.waltersPoints<0))fail('MODEL_LOCKED_VALUES_REQUIRED');
  if(!Array.isArray(c.replacements)||c.replacements.length!==replacements.length)fail('MODEL_REPLACEMENT_COUNT_MISMATCH');
  if(c.baselineTreatment!=='ADDITIONAL_DUTIES_ONLY'||c.baselineDutiesDisplaced!==false||!text(c.baselineRationale))fail('MODEL_BASELINE_RECONCILIATION_REQUIRED');
  sourceCheck(c.baselineSourceIds);
  if(c.resolution==='PRIMARY_REPLACEMENT'){
    if(replacements.length!==1||!['NAMED_STARTER','REPORTED_PRIMARY'].includes(c.primaryEvidence))fail('MODEL_PRIMARY_ROLE_REQUIRED');
  }else if(replacements.length<2)fail('MODEL_COMMITTEE_REQUIRED');
  let units=replacements.map(()=>1),weightBasis='EQUAL_ADDITIONAL_ROLE_ASSUMPTION';
  if(c.resolution==='PRIMARY_REPLACEMENT')weightBasis='DOCUMENTED_PRIMARY_ROLE';
  if(c.resolution==='WEIGHTED_COMMITTEE'){
    if(!['ROLE_SNAPS','ROLE_OPPORTUNITIES','DOCUMENTED_ROLE_SHARES'].includes(c.roleUnitType))fail('MODEL_ROLE_UNIT_TYPE_REQUIRED');
    weightBasis=c.roleUnitType;
    units=c.replacements.map(r=>{
      if(!finite(r.observedRoleUnits)||!finite(r.baselineRoleUnits)||r.baselineRoleUnits<0||r.observedRoleUnits<=r.baselineRoleUnits)fail('MODEL_ADDITIONAL_ROLE_UNITS_REQUIRED');
      sourceCheck(r.unitsSourceIds);
      return r.observedRoleUnits-r.baselineRoleUnits;
    });
  }else if(c.replacements.some(r=>r.observedRoleUnits!==undefined||r.baselineRoleUnits!==undefined))fail('MODEL_UNITS_REQUIRE_WEIGHTED_METHOD');
  const total=units.reduce((s,n)=>s+n,0);
  if(!finite(total)||total<=0)fail('MODEL_ROLE_UNITS_INVALID');
  const numerator=replacements.reduce((s,r,i)=>s+r.waltersPoints*units[i],0);
  if(!finite(numerator))fail('MODEL_WEIGHTED_VALUE_INVALID');
  const effective=numerator/total;
  // Quantize only the estimated personnel input at the existing millipoint precision.
  // The 90/10 updater retains exact decimal arithmetic from that input onward.
  const injuryLoss=round(Math.max(0,healthy-effective));
  return {modelId:REPLACEMENT_MODEL_ID,classification:'GRAHAM_MODEL_ESTIMATE',method:c.resolution,weightBasis,healthyValue:healthy,replacementValue:round(effective),replacementValueRatio:{numerator,denominator:total},injuryLoss,rawTeamContributionDelta:-injuryLoss,upgradeExcluded:effective>healthy,injuryLossRange:{min:round(Math.max(0,healthy-Math.max(...replacements.map(r=>r.waltersPoints)))),max:round(Math.max(0,healthy-Math.min(...replacements.map(r=>r.waltersPoints))))},weights:replacements.map((r,i)=>({player:r.player,eaPlayerId:r.eaPlayerId,lockedValue:r.waltersPoints,additionalRoleUnits:units[i],weight:units[i]/total})),baselineTreatment:c.baselineTreatment,assumptionRationale:c.assumptionRationale,precision:'Estimated injury loss rounded once to 0.001; subsequent weekly arithmetic is exact.'};
}
