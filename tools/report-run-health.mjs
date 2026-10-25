// Execution health is separate from gate success and betting grades.
import {inspectCardEvidence} from './card-evidence-identity.mjs';
import {inspectQuarterbackFollowUp} from './quarterback-follow-up.mjs';

const documentedShortfallReasons=new Set(['SOURCE_UNAVAILABLE','FAIR_MODEL_UNAVAILABLE','PERSONNEL_UNRESOLVED','CALIBRATION_UNAVAILABLE','CONFLICTING_EVIDENCE']);
const nonEmpty=value=>typeof value==='string'&&value.trim().length>0;
const eventOf=row=>String(row.quote?.eventId??row.decision?.feed?.eventId??row.selectionId?.split('|')[1]??'');
function blockerWork(row){
  const blocker=row.blocker||{};
  // RESEARCH_INCOMPLETE describes work left to do, even when a source lead is
  // attached. A generic current-review placeholder is never a source failure.
  if(blocker.reason==='RESEARCH_INCOMPLETE'||/CURRENT_CANDIDATE_REVIEW_REQUIRED|PRODUCER_CANDIDATE_ASSESSMENT_REQUIRED/.test(String(blocker.missing||'')))return 'producerUnfinished';
  const attempts=Array.isArray(blocker.attempts)?blocker.attempts:[];
  const recordedAttempt=attempts.some(attempt=>String(attempt.eventId??'')===eventOf(row)&&
    Number.isFinite(Date.parse(attempt.checkedAt))&&/^https?:\/\//.test(attempt.url||'')&&nonEmpty(attempt.finding));
  // This is a diagnostic distinction based on the saved receipt fields. It
  // does not validate the research or clear a source, personnel input or card.
  return documentedShortfallReasons.has(blocker.reason)&&nonEmpty(blocker.missing)&&nonEmpty(blocker.impact)&&recordedAttempt
    ?'documentedShortfalls':'blockerReviewRequired';
}

// Reuse existing inspectors immediately after saving an event. This catches
// a missing handoff before the same unfinished construction spans the slate.
export function reportEventFeedback(state,eventId) {
  const receipts=(state.sidecar?.primaryAnalysis?.receipts||[]).filter(row=>String(row.quote?.eventId??row.decision?.feed?.eventId??row.selectionId?.split('|')[1])===String(eventId));
  const selections=receipts.map(row=>{
    const missing=[];
    if(row.state==='EVALUATED'){
      const card=inspectCardEvidence(row.decision);
      if(card.state!=='VALID')missing.push(`CARD_EVIDENCE_${card.state}`);
      const quarterback=inspectQuarterbackFollowUp({report:state.report,receipt:row,selection:{sport:row.selectionId?.split('|')[0]}});
      missing.push(...quarterback.missing);
    }else if(row.blocker?.missing)missing.push(row.blocker.missing);
    return {selectionId:row.selectionId,savedState:row.state,missingResearch:missing};
  });
  return {eventId:String(eventId),state:selections.some(row=>row.missingResearch.length)?'FOLLOW_UP_REQUIRED':'NO_INSPECTOR_SHORTFALL',
    selections,nextAction:'Resolve these recorded shortfalls and inspect the full next event plan. This feedback does not validate or issue a decision.'};
}

export function reportRunHealth(state={}) {
  const receipts=state.sidecar?.primaryAnalysis?.receipts;
  const available=Array.isArray(receipts)?receipts.length:null;
  const evaluated=(receipts||[]).filter(row=>row.state==='EVALUATED').length;
  const blocked=(receipts||[]).filter(row=>row.state==='BLOCKED').length;
  const sports={},gaps=new Map(),pendingEvents=new Set();
  const remainingWork={selections:blocked,events:0,producerUnfinished:0,documentedShortfalls:0,blockerReviewRequired:0,sports:{}};
  for(const row of receipts||[]){
    const sport=row.selectionId?.split('|')[0]||'UNKNOWN';
    const tally=sports[sport]??={available:0,evaluated:0,blocked:0};
    tally.available++;if(row.state==='EVALUATED')tally.evaluated++;if(row.state==='BLOCKED')tally.blocked++;
    if(row.state==='BLOCKED'){
      const missing=row.blocker?.missing||row.blocker?.reason||'UNSPECIFIED_BLOCKER';
      gaps.set(missing,(gaps.get(missing)||0)+1);
      const kind=blockerWork(row),pending=remainingWork.sports[sport]??={selections:0,producerUnfinished:0,documentedShortfalls:0,blockerReviewRequired:0};
      remainingWork[kind]++;pending.selections++;pending[kind]++;
      pendingEvents.add(`${sport}|${eventOf(row)}`);
    }
  }
  remainingWork.events=pendingEvents.size;
  const continuationRequired=remainingWork.producerUnfinished+remainingWork.blockerReviewRequired>0;
  const analysisState=available===null?'NOT_ESTABLISHED':available===0?'EMPTY_SLATE':evaluated===0?'ANALYSIS_INCOMPLETE':blocked>0?'PARTIAL_ANALYSIS':'ASSESSED';
  const validationState=state.validation?.state==='PASS'&&['FROZEN','STAGED','PUBLISHED'].includes(state.phase)?'PASS':'NOT_VALIDATED';
  const publicationState=state.phase==='PUBLISHED'&&state.publication?'DURABLY_VERIFIED':state.phase==='STAGED'?'PUBLICATION_PENDING':'NOT_ISSUED';
  const continueAction=`Complete current event reviews for ${remainingWork.producerUnfinished} unfinished selections and inspect ${remainingWork.blockerReviewRequired} undocumented blockers across ${remainingWork.events} pending events. Follow nextEventId and scheduleUrgency, inspect next --event-id, reuse pinned observations with current applicability checks, and save each event before preparing again. Do not relabel unfinished work as a source shortfall.`;
  return {analysisState,validationState,publicationState,sports,continuationRequired,remainingWork,
    gaps:[...gaps].sort((a,b)=>b[1]-a[1]).slice(0,8).map(([missing,selections])=>({missing,selections})),
    nextAction:publicationState==='DURABLY_VERIFIED'?(continuationRequired?`Publication is verified; producer work is unfinished. Start a current-time continuation without editing issued History. ${continueAction}`:
      blocked?'Published selections are verified; remaining receipts record source shortfalls. Recheck the named sources when their inputs change.':'Read the verified issued decisions.'):
      state.phase==='FROZEN'||state.phase==='STAGED'?`Preserve and submit the exact sealed candidate; verify publisher and controller readback.${continuationRequired?` Then start a current-time continuation. ${continueAction}`:''}`:
      continuationRequired?continueAction:'Resume the saved event work, inspect exact missingResearch, retime and reconcile eligibility, prepare and inspect deferrals, then freeze/stage and verify publication.',
    limitation:'EVALUATED is a saved producer assessment, not a passed validation or issued report. Saved event reviews and successful publication do not complete unfinished research.'};
}
