// Execution health is separate from gate success and betting grades.
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
