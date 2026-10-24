// Execution health is separate from gate success and betting grades.
import {inspectCardEvidence} from './card-evidence-identity.mjs';
import {inspectQuarterbackFollowUp} from './quarterback-follow-up.mjs';

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
  const sports={},gaps=new Map();
  for(const row of receipts||[]){
    const sport=row.selectionId?.split('|')[0]||'UNKNOWN';
    const tally=sports[sport]??={available:0,evaluated:0,blocked:0};
    tally.available++;if(row.state==='EVALUATED')tally.evaluated++;if(row.state==='BLOCKED')tally.blocked++;
    if(row.state==='BLOCKED'){
      const missing=row.blocker?.missing||row.blocker?.reason||'UNSPECIFIED_BLOCKER';
      gaps.set(missing,(gaps.get(missing)||0)+1);
    }
  }
  const analysisState=available===null?'NOT_ESTABLISHED':available===0?'EMPTY_SLATE':evaluated===0?'ANALYSIS_INCOMPLETE':blocked>0?'PARTIAL_ANALYSIS':'ASSESSED';
  const validationState=state.validation?.state==='PASS'&&['FROZEN','STAGED','PUBLISHED'].includes(state.phase)?'PASS':'NOT_VALIDATED';
  const publicationState=state.phase==='PUBLISHED'&&state.publication?'DURABLY_VERIFIED':state.phase==='STAGED'?'PUBLICATION_PENDING':'NOT_ISSUED';
  return {analysisState,validationState,publicationState,sports,
    gaps:[...gaps].sort((a,b)=>b[1]-a[1]).slice(0,8).map(([missing,selections])=>({missing,selections})),
    nextAction:publicationState==='DURABLY_VERIFIED'?(blocked?'Published partial analysis; remaining selections still need research.':'Read the verified issued decisions.'):
      state.phase==='FROZEN'||state.phase==='STAGED'?'Preserve and submit the exact sealed candidate; verify publisher and controller readback.':
      'Resume the saved event work, inspect exact missingResearch, retime and reconcile eligibility, prepare and inspect deferrals, then freeze/stage and verify publication.',
    limitation:'EVALUATED is a saved producer assessment, not a passed validation or issued report. Saved event reviews and successful publication do not complete unfinished research.'};
}
