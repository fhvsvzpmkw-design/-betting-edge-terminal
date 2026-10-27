import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {verifyCurrentRatingReview,verifyAppliedCurrentRatingReviewEvent} from './graham-current-rating-review.mjs';
export const HISTORICAL_CORRECTION='WALTERS_HISTORICAL_INPUT_CORRECTION';
export const correctionDigest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail=s=>{throw Error('HISTORICAL_INPUT_CORRECTION:'+s);};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const finite=n=>typeof n==='number'&&Number.isFinite(n);
export function loadAppliedCurrentRatingReviewPlans({root=process.cwd(),season}={}){
 const directory=path.join(root,'data/walters/nfl',String(season),'rating-reviews');
 if(!fs.existsSync(directory))return [];
 const plans=[];
 for(const name of fs.readdirSync(directory).sort())if(name.endsWith('.json')){
  try{const plan=JSON.parse(fs.readFileSync(path.join(directory,name)));if(plan?.type==='GRAHAM_ONE_TIME_CURRENT_RATING_REVIEW'&&plan.state==='APPLIED')plans.push(plan);}catch{}
 }
 return plans;
}
export function verifiedCorrectionPublication(power,staging,{reviewPlans}={}){
 if(staging?.state!=='APPLIED'||staging.auditType!==HISTORICAL_CORRECTION||staging.marketViewed!==false||staging.result?.type!==HISTORICAL_CORRECTION||staging.result.state!=='COMPLETE'||!same(staging.result.receipt,power.weekly90_10))return false;
 const entry=power.historicalInputCorrections?.find(c=>c.auditId===staging.auditId);
 if(!entry||entry.proofSha256!==staging.result.proofSha256||!same(entry.ratingChanges,staging.result.ratingChanges))return false;
 const {proofSha256,ratingChanges,...proof}=entry;
 if(correctionDigest(proof)!==proofSha256||entry.marketViewed!==false||!entry.originalEventsPreserved||!entry.priorPredictionsPreserved)return false;
 const receiptEntry=power.weekly90_10?.inputCorrections?.at(-1);
 if(receiptEntry?.auditId!==staging.auditId||receiptEntry.proofSha256!==proofSha256)return false;
 // This receipt certifies the preserved historical correction. A separately
 // verified, forward-only current-rating review may establish a later baseline
 // without invalidating that history or claiming the old correction again.
 const plans=reviewPlans||loadAppliedCurrentRatingReviewPlans({season:power.season});
 let reviewVerified;
 return ratingChanges.every(c=>{
  const t=power.teams.find(t=>t.abbr===c.team);
  const matches=t?.history?.filter(e=>e.type===HISTORICAL_CORRECTION&&e.auditId===staging.auditId&&e.proofSha256===proofSha256)||[];
  if(matches.length!==1)return false;
  const e=matches[0];
  if(e.fromRating!==c.priorRating||e.toRating!==c.currentRating||e.delta!==c.delta)return false;
  const suffix=t.history.slice(t.history.indexOf(e)+1);
  if(!suffix.length)return t.currentRating===c.currentRating;
  if(reviewVerified===undefined)reviewVerified=verifyCurrentRatingReview(power,power.currentRatingReview);
  if(reviewVerified!==true)return false;
  let current=c.currentRating;
  for(const later of suffix){
   const plan=plans.find(p=>p.auditId===later.auditId);
   const latestChange=power.currentRatingReview?.ratingChanges?.find(x=>x.team===c.team);
   const latest=power.currentRatingReview?.auditId===later.auditId&&latestChange?.eventSha256===correctionDigest(later);
   if(later.fromRating!==current||(!latest&&(!plan||!verifyAppliedCurrentRatingReviewEvent(plan,later,c.team))))return false;
   current=later.toRating;
  }
  return current===t.currentRating;
 });
}

// Plan and verify the entire replay before appending any event. Old events,
// predictions, and the original completion/attempt records remain unchanged.
export function historicalInputCorrection({input,power,active,facts,loadEvidence,calculate,sum}){
 if(input.auditType!==HISTORICAL_CORRECTION||input.marketViewed!==false||input.season!==active.season||input.targetWeek!==active.week||input.sourceWeek!==active.week-2||!input.auditId||!input.sourceRefs?.length||!Number.isFinite(Date.parse(input.effectiveAt)))fail('IDENTITY');
 if(power.historicalInputCorrections?.some(c=>c.auditId===input.auditId))fail('AUDIT_ALREADY_APPLIED');
 if(!Array.isArray(power.teams)||power.teams.length!==32||new Set(power.teams.map(t=>t.abbr)).size!==32)fail('TEAM_INVENTORY');
 const receipt=power.weekly90_10;
 if(receipt?.state!=='COMPLETE'||receipt.season!==active.season||receipt.sourceWeek!==active.week-1||receipt.targetWeek!==active.week||receipt.marketViewed!==false||receipt.blockedGames?.length||receipt.gamesUpdated!==receipt.gamesProcessed||receipt.teamsUpdated!==2*receipt.gamesProcessed)fail('COMPLETE_PRIOR_WEEK_REQUIRED');
 if(facts?.season!==active.season||facts.marketViewed!==false||facts.sourceWeek!==input.sourceWeek||facts.targetWeek!==input.targetWeek||!Array.isArray(facts.weeks)||facts.weeks.length!==2||!facts.sourceRefs?.length)fail('FINAL_FACTS');
 if(!Array.isArray(input.corrections)||!input.corrections.length||new Set(input.corrections.map(c=>c.gameKey)).size!==input.corrections.length)fail('CORRECTION_INVENTORY');
 const byTeam=new Map(power.teams.map(t=>[t.abbr,t])),error=new Map(power.teams.map(t=>[t.abbr,0]));
 const priorReceipt=correctionDigest(receipt),originals=power.teams.map(t=>({abbr:t.abbr,history:structuredClone(t.history),currentRating:t.currentRating}));
 for(const t of power.teams){
  if(input.expectedRatings?.[t.abbr]!==t.currentRating||input.historySha256?.[t.abbr]!==correctionDigest(t.history))fail('CURRENT_OR_HISTORY_DRIFT:'+t.abbr);
  if((t.history||[]).some(e=>Date.parse(e.effectiveAt)>=Date.parse(input.effectiveAt)))fail('PUBLICATION_CLOCK:'+t.abbr);
 }
 const originalProof=[],replayProof=[],verifiedGames=new Set(),lastOriginal=new Map();
 const verifyPair=(g,week)=>{
  const pair=[g.away,g.home].map(abbr=>{
   const t=byTeam.get(abbr),events=t?.history?.filter(e=>e.type==='WALTERS_WEEKLY_90_10'&&e.season===active.season&&e.sourceWeek===week&&e.targetWeek===week+1&&e.gameKey===g.gameKey);
   if(events?.length!==1)fail('PAIRED_EVENT_REQUIRED:'+g.gameKey);
   const e=events[0];
   if(e.marketViewed!==false||!e.sourceRefs?.length||!['BW-R016','BW-R017','BW-R018'].every(id=>e.formulaIds?.includes(id))||!e.gameDayEvidenceBinding)fail('EVENT_AUTHORITY:'+abbr);
   const c=calculate({oldRating:e.fromRating,...e.tgplInputs});
   if(e.toRating!==c.newRating||e.tgpl!==c.tgpl||e.delta!==c.delta||e.opponent!==[g.home,g.away].find(a=>a!==abbr)||e.kickoff!==g.startTimePacific)fail('EVENT_ARITHMETIC_OR_IDENTITY:'+abbr);
   if(e.tgplInputs.scoreMargin!==(abbr===g.away?g.awayScore-g.homeScore:g.homeScore-g.awayScore)||e.tgplInputs.teamLocationAdvantage!==(abbr===g.away?-g.homeFieldAdvantagePoints:g.homeFieldAdvantagePoints))fail('SCORE_OR_LOCATION:'+abbr);
   return {t,e};
  });
  const [a,b]=pair.map(p=>p.e);
  if(a.auditId!==b.auditId||a.effectiveAt!==b.effectiveAt||!same(a.gameDayEvidenceBinding,b.gameDayEvidenceBinding)||a.fromRating!==b.tgplInputs.opponentOldRating||b.fromRating!==a.tgplInputs.opponentOldRating||a.tgplInputs.teamInjuryLoss!==b.tgplInputs.opponentInjuryLoss||b.tgplInputs.teamInjuryLoss!==a.tgplInputs.opponentInjuryLoss)fail('PAIR_SNAPSHOT:'+g.gameKey);
  const evidence=loadEvidence(a.gameDayEvidenceBinding,week,a.effectiveAt,g.gameKey);
  if(evidence.game.state!=='READY')fail('ORIGINAL_EVIDENCE_NOT_READY:'+g.gameKey);
  for(const {t,e} of pair)if(evidence.game.teams.find(x=>x.team===t.abbr)?.injuryLoss!==e.tgplInputs.teamInjuryLoss)fail('ORIGINAL_EVIDENCE_TOTAL:'+t.abbr);
  verifiedGames.add(g.gameKey);return pair;
 };
 for(let week=input.sourceWeek;week<active.week;week++){
  const f=facts.weeks.find(w=>w.sourceWeek===week);
  if(!f?.games?.length||new Set(f.games.flatMap(g=>[g.away,g.home])).size!==2*f.games.length||!f.sourceRefs?.length)fail('FINAL_SLATE:'+week);
  if(week===input.sourceWeek){const r=receipt.previousReceipts?.find(r=>r.sourceWeek===week&&r.targetWeek===week+1);if(r?.state!=='COMPLETE'||r.gamesUpdated!==f.games.length||r.gamesProcessed!==f.games.length||r.teamsUpdated!==2*f.games.length||r.blockedGames?.length)fail('SOURCE_WEEK_COMPLETION_REQUIRED');}
  if(week===active.week-1&&(f.games.length!==receipt.gamesProcessed||!same(f.games.map(g=>g.gameKey).sort(),input.priorWeekCompletion?.finals?.map(g=>g.gameKey).sort())))fail('RECEIPT_SLATE');
  const startError=new Map(error);
  for(const g of f.games){
   if(!Number.isInteger(g.awayScore)||!Number.isInteger(g.homeScore)||g.awayScore<0||g.homeScore<0||!['DOMESTIC_HOME','NEUTRAL','INTERNATIONAL_NEUTRAL'].includes(g.homeFieldVenueClass)||!finite(g.homeFieldAdvantagePoints)||(g.homeFieldVenueClass!=='DOMESTIC_HOME'&&g.homeFieldAdvantagePoints!==0))fail('FINAL_GAME:'+g.gameKey);
   const correction=week===input.sourceWeek?input.corrections.find(c=>c.gameKey===g.gameKey):null;
   if(week===input.sourceWeek&&!correction)continue;
   const pair=verifyPair(g,week);
   for(const {t,e} of pair)if(lastOriginal.has(t.abbr)&&lastOriginal.get(t.abbr)!==e.fromRating)fail('REPLAY_CHAIN_DRIFT:'+t.abbr);
   let corrected;
   if(correction){
    corrected=loadEvidence(correction.evidenceBinding,week,input.effectiveAt,g.gameKey);
    const intent=corrected.bundle.correctionIntent;
    if(corrected.game.state!=='READY'||intent?.state!=='PENDING_GOVERNED_APPEND_ONLY_CORRECTION'||intent.originalHistoricalEventsPreserved!==true||intent.sourceWeek!==week||intent.targetWeek!==week+1||intent.gameKey!==g.gameKey||intent.originalEvidencePath!==pair[0].e.gameDayEvidenceBinding.path)fail('CORRECTION_EVIDENCE_INTENT:'+g.gameKey);
   }
   const proof={gameKey:g.gameKey,sourceWeek:week,originalBinding:pair[0].e.gameDayEvidenceBinding,...(correction?{correctedBinding:correction.evidenceBinding}:{}),teams:[]};
   for(const {t,e} of pair){
    const oldRating=sum(e.fromRating,startError.get(t.abbr)),opponentOldRating=sum(e.tgplInputs.opponentOldRating,startError.get(e.opponent));
    const losses=corrected?Object.fromEntries(corrected.game.teams.map(t=>[t.team,t.injuryLoss])):{[t.abbr]:e.tgplInputs.teamInjuryLoss,[e.opponent]:e.tgplInputs.opponentInjuryLoss};
    const calculation=calculate({...e.tgplInputs,oldRating,opponentOldRating,teamInjuryLoss:losses[t.abbr],opponentInjuryLoss:losses[e.opponent]});
    const delta=sum(calculation.newRating,-e.toRating);error.set(t.abbr,delta);
    lastOriginal.set(t.abbr,e.toRating);
    proof.teams.push({team:t.abbr,opponent:e.opponent,eventSha256:correctionDigest(e),originalFromRating:e.fromRating,originalToRating:e.toRating,originalInjuryLoss:e.tgplInputs.teamInjuryLoss,correctedInjuryLoss:losses[t.abbr],correctedFromRating:oldRating,correctedOpponentOldRating:opponentOldRating,correctedTgpl:calculation.tgpl,correctedToRating:calculation.newRating,propagatedCorrection:delta});
    const later=t.history.filter(x=>Number(x.sequence)>Number(e.sequence));
    if(later.some(x=>x.type!=='WALTERS_WEEKLY_90_10'||x.sourceWeek<=week||x.sourceWeek>=active.week-1+1))fail('INTERVENING_TRANSACTION:'+t.abbr);
    if(week===active.week-1&&(t.history.at(-1)!==e||t.currentRating!==e.toRating))fail('CURRENT_NOT_LAST_WEEKLY:'+t.abbr);
   }
   (correction?originalProof:replayProof).push(proof);
  }
 }
 if(input.corrections.some(c=>!originalProof.some(p=>p.gameKey===c.gameKey)))fail('UNRECOGNIZED_CORRECTION_GAME');
 if(sum(...error.values())!==0)fail('PAIRED_CONSERVATION');
 for(const t of power.teams){
  if(!error.get(t.abbr))continue;
  if(!replayProof.some(p=>p.teams.some(x=>x.team===t.abbr)))fail('PROPAGATION_MISSING:'+t.abbr);
 }
 const ratingChanges=power.teams.filter(t=>error.get(t.abbr)!==0).map(t=>({team:t.abbr,priorRating:t.currentRating,delta:error.get(t.abbr),currentRating:sum(t.currentRating,error.get(t.abbr))}));
 const proof={schema:1,type:HISTORICAL_CORRECTION,state:'APPLIED',auditId:input.auditId,effectiveAt:input.effectiveAt,season:active.season,sourceWeek:input.sourceWeek,targetWeek:active.week,originalProof,replayProof,originalReceiptSha256:priorReceipt,originalEventsPreserved:true,priorPredictionsPreserved:true,marketViewed:false};
 const proofSha256=correctionDigest(proof);
 for(const c of ratingChanges){
  const t=byTeam.get(c.team),event={sequence:Math.max(-1,...t.history.map(e=>Number(e.sequence)||0))+1,type:HISTORICAL_CORRECTION,auditId:input.auditId,season:active.season,sourceWeek:input.sourceWeek,targetWeek:active.week,effectiveAt:input.effectiveAt,fromRating:c.priorRating,delta:c.delta,toRating:c.currentRating,proofSha256,reason:'Source-bound historical injury-input correction replayed through subsequent exact governed weekly calculations; original events and prior predictions preserved.',sourceRefs:input.sourceRefs,marketViewed:false};
  t.priorRating=c.priorRating;t.currentRating=c.currentRating;t.lastDelta=c.delta;t.lastUpdatedAt=input.effectiveAt;t.lastUpdateType=HISTORICAL_CORRECTION;t.history.push(event);
 }
 power.historicalInputCorrections=[...(power.historicalInputCorrections||[]),{...proof,proofSha256,ratingChanges}];
 receipt.inputCorrections=[...(receipt.inputCorrections||[]),{auditId:input.auditId,effectiveAt:input.effectiveAt,sourceWeek:input.sourceWeek,proofSha256,changedTeams:ratingChanges.map(c=>c.team),marketViewed:false}];power.updatedAt=input.effectiveAt;
 for(const t of power.teams){const old=originals.find(x=>x.abbr===t.abbr);if(!same(t.history.slice(0,old.history.length),old.history))fail('ORIGINAL_HISTORY_CHANGED');}
 return {state:'COMPLETE',type:HISTORICAL_CORRECTION,ratingChanges,proofSha256,receipt,marketViewed:false};
}
