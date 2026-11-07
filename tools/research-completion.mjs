// Read-only producer completion. A recorded source gap does not complete an
// independently unfinished assessment of the same exact current quote.
export const RESEARCH_COMPLETION_FROM = '2026-11-07T20:10:00Z';
const list = value => Array.isArray(value) ? value : [];
const time = value => Date.parse(value || '');
const close = (a,b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a-b)<1e-8;
function sameQuote(a,b) {
  return a && b && ['eventId','marketKey','side','selectionKey','book'].every(key => String(a[key]??'')===String(b[key]??'')) &&
    (a.line==null ? b.line==null : close(a.line,b.line)) && close(a.priceDecimal,b.priceDecimal) &&
    ['quoteUpdatedAt','quoteObservedAt'].every(key => (a[key]??null)===(b[key]??null));
}

export function unfinishedCandidateReviews(report={},sidecar={}) {
  if(!report?.feedGeneratedAt || sidecar?.primaryAnalysis?.feedGeneratedAt!==report.feedGeneratedAt)return [];
  const receipts=new Map();
  for(const receipt of list(sidecar.primaryAnalysis?.receipts)) {
    const rows=receipts.get(receipt.selectionId)||[]; rows.push(receipt);receipts.set(receipt.selectionId,rows);
  }
  const pending=new Map();
  for(const assessment of [sidecar.candidateAssessment,report.candidateAssessment]) {
    if(assessment?.schema!==1 || assessment.version!=='candidate-assessment-v1' ||
      !Number.isFinite(time(report.ts)) || time(assessment.asOf)!==time(report.ts))continue;
    for(const row of list(assessment.selections)) {
      if(typeof row?.selectionId!=='string')continue;
      const matches=receipts.get(row.selectionId)||[],receipt=matches.length===1?matches[0]:null;
      if(!receipt || !['BLOCKED','EVALUATED'].includes(receipt.state) || row.state!==receipt.state || !(row.promising || row.reviewRequired) || row.reviewState!=='UNFINISHED' ||
        !sameQuote(row.assessedQuote||row.quote,receipt.quote))continue;
      pending.set(row.selectionId,{selectionId:row.selectionId,eventId:String(receipt.quote.eventId),
        sport:row.selectionId.split('|')[0],missingResearch:[...new Set(list(row.missingResearch))]});
    }
  }
  return [...pending.values()];
}

export function researchCompletion(report={},sidecar={}, {includeCandidateReviews=true}={}) {
  const receipts=list(sidecar.primaryAnalysis?.receipts),unfinished=new Set(receipts
    .filter(row=>row.state==='BLOCKED' && row.blocker?.reason==='RESEARCH_INCOMPLETE').map(row=>row.selectionId));
  if(includeCandidateReviews)for(const row of unfinishedCandidateReviews(report,sidecar))unfinished.add(row.selectionId);
  const evaluated=receipts.filter(row=>row.state==='EVALUATED').length;
  return {state:unfinished.size?(evaluated?'PARTIAL':'INCOMPLETE'):'COMPLETE',evaluated,unfinished:unfinished.size,
    notice:unfinished.size?`${evaluated?'PARTIAL REPORT':'ANALYSIS INCOMPLETE'}: ${evaluated} evaluated; ${unfinished.size} unfinished.`:null};
}
