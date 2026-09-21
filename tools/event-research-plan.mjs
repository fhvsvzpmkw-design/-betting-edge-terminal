// Event-first research orchestration. Read-only: never creates a betting decision.
export const EVENT_RESEARCH_VERSION = '2026-09-20.1';
export const EVENT_RESEARCH_FROM = '2026-09-20T18:15:00-07:00';
const list = value => Array.isArray(value) ? value : [];
const text = value => typeof value === 'string' ? value.trim() : '';
const time = value => typeof value === 'string' ? Date.parse(value) : NaN;
const keyFor = row => text(row?.sport) && String(row?.eventId || '').trim() && Number.isFinite(time(row?.eventDate))
  ? JSON.stringify([row.sport, String(row.eventId), new Date(row.eventDate).toISOString()]) : null;
const sourcesOf = receipt => [
  ...list(receipt?.decision?.sourceEvidence), ...list(receipt?.evidence?.sourceEvidence),
  ...list(receipt?.candidateDraft?.decision?.sourceEvidence), ...list(receipt?.candidateDraft?.evidence?.sourceEvidence),
  ...list(receipt?.blocker?.attempts)
];
function usableSource(source, event, report) {
  if (!source || !text(source.id) || !['OFFICIAL', 'REPORTING'].includes(source.kind)) return false;
  if (String(source.eventId) !== String(event.eventId) || (source.sport && source.sport !== event.sport)) return false;
  if (source.eventDate && time(source.eventDate) !== time(event.eventDate)) return false;
  const observed = time(source.checkedAt || source.asOf);
  if (!Number.isFinite(observed) || !Number.isFinite(time(report.ts)) || observed > time(report.ts) || !text(source.finding || source.fact)) return false;
  try { const url = new URL(source.url); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password; }
  catch { return false; }
}
function signature(source) {
  return JSON.stringify([source.kind, String(source.eventId), source.url, source.checkedAt || source.asOf, source.finding || source.fact]);
}
function routeFor(row, receipt) {
  if (row.state === 'EVALUATED' && ['BET', 'LEAN', 'WAIT', 'PASS'].includes(row.status) && !(row.promising && row.reviewState === 'UNFINISHED')) return 'COMPLETED';
  if (receipt?.cardEvidenceDetachment || receipt?.blocker?.progress?.stage === 'CARD_EVIDENCE_REBUILD') return 'REPAIR_EXACT_EVIDENCE';
  const options = [row, ...list(row.options)];
  const directionalFinding = list(receipt?.decision?.cardEvidence?.findings).some(finding => finding.stance === 'SUPPORT') ||
    list(receipt?.candidateDraft?.decision?.cardEvidence?.findings).some(finding => finding.stance === 'SUPPORT');
  if (receipt?.researchRouting?.requiresDeepReview === true || row.promising || directionalFinding || options.some(option =>
    option.nativeFairComparison?.supportsPointReview === true || option.marketComparison?.direction === 'FAVORABLE' || Number(option.marketComparison?.edgeProbabilityPoints) > 0 ||
    list(option.forecastComparisons).some(forecast => forecast.direction === 'SUPPORTS_PRICE'))) return 'DEEP_REVIEW';
  // A negative screen is permission to REVIEW a PASS, never an automatic PASS.
  // Producer-identified close calls, contrary model findings and material uncertainty
  // must be escalated after the shared event scan; no numerical betting buffer is added.
  if (options.some(option => Number.isFinite(option.marketComparison?.edgeProbabilityPoints) && option.marketComparison.edgeProbabilityPoints < 0)) return 'MARKET_PASS_REVIEW';
  return 'REFERENCE_OR_FORECAST_RESEARCH';
}
const actionFor = route => ({
  COMPLETED: 'Preserve the completed exact-selection decision and normal publication validation.',
  REPAIR_EXACT_EVIDENCE: 'Rebuild the exact-selection evidence binding before reassessment; never use a different selection card as a substitute.',
  DEEP_REVIEW: 'Use the event package, disposition applicable forecasts and directional findings, resolve material inputs, then assess the exact paired market under existing Core rules.',
  MARKET_PASS_REVIEW: 'Finish the shared event scan and selection-specific applicability check. A justified unfavorable market comparison may conclude PASS without an exhaustive exact-probability search. Escalate close calls, contradictory forecasts or decision-sensitive facts; do not auto-PASS.',
  REFERENCE_OR_FORECAST_RESEARCH: 'Reuse the event scan, then obtain a compatible exact reference or defensible sourced forecast. Missing reference is not proof of no value.',
  IDENTITY_REVIEW: 'Resolve exact sport, event and start-time identity before sharing research.'
}[route]);

/**
 * Plan ALL available selections, separately from the positive-candidate shortlist.
 * Source packages contain immutable review leads, not inherited personnel clearance,
 * probabilities, stances, card text, or current-run research-completion claims.
 */
export function buildEventResearchPlan({report = {}, sidecar = {}, candidateAssessment = {}, forecastCoverage = {}, priorReceipts = new Map()} = {}) {
  const inventory = list(candidateAssessment.selections), receipts = list(sidecar.primaryAnalysis?.receipts);
  const groups = new Map(), warnings = [], seen = new Set();
  for (const row of inventory) {
    if (seen.has(row.selectionId)) { warnings.push(`Duplicate inventory selection ${row.selectionId}; resolve identity before use.`); continue; }
    seen.add(row.selectionId);
    const identity = keyFor(row), eventKey = identity || `INVALID:${row.selectionId}`;
    if (!groups.has(eventKey)) groups.set(eventKey, {eventKey, sport:row.sport, eventId:row.eventId,
      eventDate:row.eventDate, label:row.eventLabel || null, selections:[], sourceMap:new Map(), conflicts:new Set()});
    const event = groups.get(eventKey), matches = receipts.filter(receipt => receipt.selectionId === row.selectionId);
    const receipt = matches.length === 1 ? matches[0] : null;
    if (matches.length > 1) warnings.push(`Duplicate receipts for ${row.selectionId}; no research reuse or completion inferred.`);
    const route = !identity || matches.length > 1 ? 'IDENTITY_REVIEW' : routeFor(row, receipt);
    if (!event.label && row.eventLabel) event.label = row.eventLabel;
    event.selections.push({selectionId:row.selectionId, marketDetail:row.marketDetail, side:row.side,
      state:row.state, status:row.status || null, route, quote:row.quote || null, assessedQuote:row.assessedQuote || null,
      exactOptions:list(row.options).map(option => ({quote:option.quote, marketComparison:option.marketComparison || null})),
      priceComparison:row.marketComparison || null, nativeFairComparison:row.nativeFairComparison || null, blocker:row.blocker || receipt?.blocker?.reason || null,
      nextAction:actionFor(route), producerRoutingRationale:receipt?.researchRouting?.rationale || null});
    if (!identity || matches.length > 1) continue;
    const collect = (record, priorReportPath = null) => {
      for (const source of sourcesOf(record)) {
        if (!usableSource(source, event, report)) continue;
        const existing = event.sourceMap.get(source.id);
        if (existing && priorReportPath && !existing.priorReportPath) continue;
        if (existing && !priorReportPath && existing.priorReportPath) {
          event.sourceMap.set(source.id, {source:structuredClone(source), priorReportPath:null, requiresCurrentApplicabilityReview:true});
        } else if (existing && signature(existing.source) !== signature(source)) event.conflicts.add(source.id);
        else if (!existing) event.sourceMap.set(source.id, {source:structuredClone(source), priorReportPath,
          requiresCurrentApplicabilityReview:true});
      }
    };
    collect(receipt);
    const prior = priorReceipts instanceof Map ? priorReceipts.get(row.selectionId) : null;
    const priorDate = prior?.row?.decision?.feed?.eventDate || prior?.row?.candidateDraft?.decision?.feed?.eventDate || prior?.row?.eventDate;
    if (prior && time(priorDate) === time(row.eventDate)) collect(prior.row, prior.reportPath || null);
  }
  const events = [...groups.values()].map(event => {
    for (const id of event.conflicts) { event.sourceMap.delete(id); warnings.push(`Conflicting source ID ${id} in ${event.eventKey}; source not shared.`); }
    const pending = event.selections.filter(row => row.route !== 'COMPLETED');
    // Surface the existing coverage module's fallbacks in the event work plan.
    // One source retrieval can answer several sides; listing it is not execution.
    const forecastRows = list(forecastCoverage.selections).filter(row => String(row.eventId) === String(event.eventId) &&
      (row.sport === event.sport || (event.sport === 'NBA_WNBA' && ['NBA','WNBA'].includes(row.sport))) &&
      time(row.startTime) === time(event.eventDate));
    const sourceQueue = new Map();
    for (const row of forecastRows.filter(row => !list(row.eligibleExactRecordIds).length)) {
      for (const source of list(row.nextRoutes)) {
        if (!sourceQueue.has(source.sourceId)) sourceQueue.set(source.sourceId, {...source, selectionIds:[], questions:[]});
        const queued = sourceQueue.get(source.sourceId);
        queued.selectionIds.push(row.selectionId);
        queued.questions.push({selectionId:row.selectionId, marketDetail:row.marketDetail, side:row.side, line:row.line, role:source.role});
      }
    }
    const forecastRetrieval = {state:'RETRIEVAL_QUEUE_NOT_EXECUTED',
      selectionsWithoutExactForecast:forecastRows.filter(row => !list(row.eligibleExactRecordIds).length).length,
      attempts:forecastRows.flatMap(row => list(row.attempts).map(attempt => ({selectionId:row.selectionId,...attempt}))),
      nextSources:[...sourceQueue.values()],
      instruction:'Open the actual game panel or dated article for these ordered teams and kickoff. Record probability-specific update time, exact field and named personnel. A failed first source does not exhaust this queue. Import real findings, then re-run assessment; no automatic status change.'};
    return {eventKey:event.eventKey, sport:event.sport, eventId:event.eventId, eventDate:event.eventDate,
      label:event.label || `${event.sport} event ${event.eventId}`, available:event.selections.length,
      completed:event.selections.length-pending.length, pending:pending.length,
      sharedResearchRequired:pending.length>0, researchPackage:{state:'REVIEW_LEADS_ONLY', sources:[...event.sourceMap.values()],
        instructions:'Review current personnel, matchup, weather/rest and relevant forecast leads once for this event. Preserve source times; map the finding, application and limitation separately to each exact selection.'},
      forecastRetrieval, selections:event.selections};
  }).sort((a,b) => (time(a.eventDate) || Infinity)-(time(b.eventDate) || Infinity) || a.eventKey.localeCompare(b.eventKey));
  const rows = events.flatMap(event => event.selections), pending = rows.filter(row => row.route !== 'COMPLETED');
  const routes = {};
  for (const row of rows) routes[row.route] = (routes[row.route] || 0) + 1;
  return {schema:1, version:EVENT_RESEARCH_VERSION, effectiveFrom:EVENT_RESEARCH_FROM, asOf:report.ts,
    mode:'RESEARCH_ORCHESTRATION_ONLY', decisionAuthority:false, state:inventory.length ? 'FULL_INVENTORY_PLANNED' : 'NO_INVENTORY',
    counts:{available:rows.length, events:events.length, completed:rows.length-pending.length, pending:pending.length,
      researchIncomplete:pending.filter(row => row.blocker?.reason === 'RESEARCH_INCOMPLETE' || row.blocker === 'RESEARCH_INCOMPLETE').length,
      eventScansPending:events.filter(event => event.pending>0).length, routes}, events,
    summary:`${rows.length-pending.length} completed decisions; ${pending.length} selections still require assessment across ${events.filter(event => event.pending>0).length} events. An empty positive shortlist does not mean research is complete or no value exists.`,
    warnings, limitations:[
      'All routes are research instructions, not betting decisions. No grade, stake, fair value or price is changed.',
      'Shared sources never transfer a probability, personnel clearance or directional stance between different selections.',
      'A market PASS needs an actual current event review and exact-selection rationale, not merely missing forecasts.',
      'Complete unrelated selections may publish while real unfinished work remains separately visible.'
    ]};
}
