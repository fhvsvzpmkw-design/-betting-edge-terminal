// Execution evidence for forward producer runs; no betting or completion quota.
export const EVENT_REVIEW_TRACE_FROM='2026-10-08T14:30:43-07:00';
const eventOf=row=>String(row?.quote?.eventId??row?.decision?.feed?.eventId??row?.selectionId?.split('|')[1]??'');
export const eventReviewTraceRequired=report=>Date.parse(report?.ts)>=Date.parse(EVENT_REVIEW_TRACE_FROM);

export function producerExecutionFor(state){
  if(!eventReviewTraceRequired(state.report))return undefined;
  return {schema:1,eventReviews:state.events.filter(event=>event.command==='checkpoint'&&event.eventId)
    .map(({eventId,at,revision})=>({eventId,at,revision}))};
}

export function validateProducerExecution(bundle){
  if(!eventReviewTraceRequired(bundle.report))return;
  const receipts=bundle.sidecar.primaryAnalysis?.receipts;
  if(!Array.isArray(receipts))throw Error('Forward producer requires bound selection receipts');
  if(receipts.length===0)return; // Preserve the ordinary empty-slate path.
  const trace=bundle.producerExecution;
  if(trace?.schema!==1||!Array.isArray(trace.eventReviews)||trace.eventReviews.length===0)
    throw Error('Save an actual event review with checkpoint --event-id before freezing an available board');
  const available=new Set(receipts.map(eventOf)),reviewed=new Set();
  for(const event of trace.eventReviews){
    if(!event.eventId||!available.has(String(event.eventId))||!Number.isSafeInteger(event.revision)||event.revision<1 ||
      !Number.isFinite(Date.parse(event.at))||Date.parse(event.at)>Date.parse(bundle.report.ts))
      throw Error('Invalid saved producer event-review trace');
    reviewed.add(String(event.eventId));
  }
  const missing=[...new Set(receipts.filter(row=>row.state==='EVALUATED').map(eventOf))].filter(id=>!reviewed.has(id));
  if(missing.length)throw Error(`Issued decision events lack saved reviews: ${missing.join(', ')}. Complete and checkpoint those event reviews before freeze.`);
  // Other unfinished selections may still publish as honest blockers. A trace
  // proves the producer saved work, not that a prediction is correct or a BET.
}
