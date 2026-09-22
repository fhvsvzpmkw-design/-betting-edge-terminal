// User-approved Graham convention, not a formula attributed to Billy Walters.
export const REPLACEMENT_MODEL_ID='graham-replacement-role-estimate-v1';
export const MODEL_RESOLUTIONS=['PRIMARY_REPLACEMENT','WEIGHTED_COMMITTEE','EQUAL_SHARE_COMMITTEE'];
export const ROLE_CHAIN_MODEL_ID='graham-reconciled-role-chain-v1';
const fail=code=>{throw Error(code);};
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const text=x=>typeof x==='string'&&x.trim().length>0;
const round=x=>Number(x.toFixed(3));
// Reconcile a single vacant offensive-line role through documented position moves.
// Retained players occur on BOTH sides: their locked values cancel, not add credit.
export function reconciledRoleChainEstimate(c,absent,replacements,{lookup,sourceCheck}){
  if(c.resolution!=='RECONCILED_ROLE_CHAIN'||c.modelId!==ROLE_CHAIN_MODEL_ID||c.estimateAcknowledged!==true||!text(c.assumptionRationale))fail('CHAIN_DECLARATION_REQUIRED');
  if(c.baselineTreatment!=='RECONCILED_ROLE_CHAIN'||c.baselineDutiesDisplaced!==true||!text(c.baselineRationale))fail('CHAIN_BASELINE_RECONCILIATION_REQUIRED');
  sourceCheck(c.baselineSourceIds);
  const chain=c.roleChain;
  const ol=['LT','LG','C','RG','RT'],receivers=['WR','TE'];
  const unit=ol.includes(absent.position)?'OFFENSIVE_LINE':receivers.includes(absent.position)?'RECEIVER':null;
  if(!unit)fail('CHAIN_UNSUPPORTED_UNIT');
  const roles=unit==='OFFENSIVE_LINE'?ol:['X','Z','SLOT','BASE_RECEIVER','TE1','TE2'];
  const positions=unit==='OFFENSIVE_LINE'?ol:receivers;
  if(!chain||!Array.isArray(chain.before)||!Array.isArray(chain.after)||chain.before.length<2||chain.before.length>5||chain.before.length!==chain.after.length||replacements.length!==1)fail('CHAIN_ASSIGNMENTS_REQUIRED');
  const resolve=(rows,after)=>rows.map(row=>{
    if(!roles.includes(row.role)||!text(row.eaPlayerId)||!text(row.rationale))fail('CHAIN_ASSIGNMENT_IDENTITY');
    sourceCheck(row.sourceIds);
    const p=lookup(row.player,row.eaPlayerId);
    if(!positions.includes(p.position)||!finite(p.waltersPoints)||p.waltersPoints<0)fail('CHAIN_LOCKED_OFFENSIVE_LINE_VALUE');
    if(after&&(row.availabilityStatus!=='ACTIVE'||!['REPORTED_STARTER','GAMEBOOK_STARTER','REPORTED_ROLE'].includes(row.assignmentEvidence)))fail('CHAIN_OCCUPANT_AVAILABILITY_REQUIRED');
    return {role:row.role,player:p.player,eaPlayerId:String(p.eaPlayerId),lockedValue:p.waltersPoints};
  });
  const before=resolve(chain.before,false),after=resolve(chain.after,true);
  for(const rows of [before,after])if(new Set(rows.map(r=>r.role)).size!==rows.length||new Set(rows.map(r=>r.eaPlayerId)).size!==rows.length)fail('CHAIN_DUPLICATE_ROLE_OR_PLAYER');
  if(before.some(r=>!after.some(a=>a.role===r.role)))fail('CHAIN_UNFILLED_BASELINE_ROLE');
  const absentId=String(absent.eaPlayerId),incomingId=String(replacements[0].eaPlayerId);
  if(!before.some(r=>r.eaPlayerId===absentId)||after.some(r=>r.eaPlayerId===absentId)||before.some(r=>r.eaPlayerId===incomingId)||!after.some(r=>r.eaPlayerId===incomingId))fail('CHAIN_VACANCY_OR_INCOMING_IDENTITY');
  if(before.filter(r=>r.eaPlayerId!==absentId).some(r=>!after.some(a=>a.eaPlayerId===r.eaPlayerId)))fail('CHAIN_SECOND_UNRECONCILED_ABSENCE');
  let role=before.find(r=>r.eaPlayerId===absentId).role;
  const visited=new Set();
  while(true){
    if(visited.has(role))fail('CHAIN_DISCONNECTED_OR_CYCLIC');
    visited.add(role);
    const occupant=after.find(r=>r.role===role);
    if(occupant.eaPlayerId===incomingId)break;
    const old=before.find(r=>r.eaPlayerId===occupant.eaPlayerId);
    if(!old)fail('CHAIN_UNBOUND_OCCUPANT');
    role=old.role;
  }
  if(visited.size!==before.length)fail('CHAIN_DISCONNECTED_OR_CYCLIC');
  // Algebraically identical to sum(before)-sum(after), avoiding cancellation rounding.
  const healthy=absent.waltersPoints,effective=replacements[0].waltersPoints;
  const injuryLoss=round(Math.max(0,healthy-effective));
  return {modelId:ROLE_CHAIN_MODEL_ID,classification:'GRAHAM_MODEL_ESTIMATE',method:c.resolution,
    weightBasis:'DOCUMENTED_SINGLE_VACANCY_ROLE_CHAIN',healthyValue:healthy,replacementValue:effective,
    replacementValueRatio:{numerator:effective,denominator:1},injuryLoss,rawTeamContributionDelta:-injuryLoss,
    upgradeExcluded:effective>healthy,injuryLossRange:{min:injuryLoss,max:injuryLoss},
    reconciledRoles:{before,after,retainedPlayerValuesCancel:true},reservedPlayers:after.map(r=>({player:r.player,eaPlayerId:r.eaPlayerId})),
    baselineTreatment:c.baselineTreatment,assumptionRationale:c.assumptionRationale,
    limitation:'Historical non-QB values are retained across documented unit roles; no positional proficiency penalty is invented. Complete paired coverage and existing cluster review still apply.'};
}
export function replacementEstimate(c,healthy,replacements,{sourceCheck=()=>{}}={}){
  if(c.modelId!==REPLACEMENT_MODEL_ID||!MODEL_RESOLUTIONS.includes(c.resolution)||c.estimateAcknowledged!==true||!text(c.assumptionRationale))fail('REPLACEMENT_MODEL_DECLARATION_REQUIRED');
  if(!finite(healthy)||healthy<0||!replacements.length||replacements.some(r=>!finite(r.waltersPoints)||r.waltersPoints<0))fail('MODEL_LOCKED_VALUES_REQUIRED');
  if(!Array.isArray(c.replacements)||c.replacements.length!==replacements.length)fail('MODEL_REPLACEMENT_COUNT_MISMATCH');
  if(c.baselineTreatment!=='ADDITIONAL_DUTIES_ONLY'||c.baselineDutiesDisplaced!==false||!text(c.baselineRationale))fail('MODEL_BASELINE_RECONCILIATION_REQUIRED');
  sourceCheck(c.baselineSourceIds);
  if(c.resolution==='PRIMARY_REPLACEMENT'){
    if(replacements.length!==1||!['NAMED_STARTER','REPORTED_PRIMARY','DOCUMENTED_DEPTH_ESTIMATE'].includes(c.primaryEvidence))fail('MODEL_PRIMARY_ROLE_REQUIRED');
  }else if(replacements.length<2)fail('MODEL_COMMITTEE_REQUIRED');
  let units=replacements.map(()=>1),weightBasis='EQUAL_ADDITIONAL_ROLE_ASSUMPTION';
  if(c.resolution==='PRIMARY_REPLACEMENT')weightBasis=c.primaryEvidence==='DOCUMENTED_DEPTH_ESTIMATE'?'DOCUMENTED_AVAILABLE_DEPTH_ROLE_ASSUMPTION':'DOCUMENTED_PRIMARY_ROLE';
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
