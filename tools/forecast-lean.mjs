// A reviewed published probability can support an opinion without becoming
// an independently validated fair or acquiring BET/staking authority.
export const FORECAST_LEAN_FROM = '2026-10-01T12:00:00-07:00';
const text = v => typeof v === 'string' && v.trim().length > 0;
const list = v => Array.isArray(v) ? v : [];
const close = (a,b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a-b)<1e-8;
const ensure = (ok,msg) => {if (!ok) throw new Error(`Forecast LEAN: ${msg}`);};

export function validateForecastLean(report, rec, ids = new Map(list(rec?.sourceEvidence).map(s=>[s.id,s]))) {
  const a=rec?.forecastLean;
  if (a == null) return false;
  ensure(Date.parse(report.ts)>=Date.parse(FORECAST_LEAN_FROM),'predates forward activation');
  ensure(rec.status==='LEAN' && /^\$?0(?:\.0+)?$/.test(String(rec.stake)) && rec.playTo==='NO BET' && !rec.priceWatch,'opinion only; cannot authorize BET, stake or a wagering threshold');
  ensure(rec.marketAssessment?.basis==='QUALIFIED_PINNACLE' && rec.fairValueEvidence==null,'requires the existing exact market assessment; cannot masquerade as adopted fair');
  ensure(a.schema===1 && a.basis==='REVIEWED_FORECAST_POINT' && a.selectionKey===rec.feed?.selectionKey,'requires exact selection identity');
  ensure(rec.coreAssessment?.context?.fairValueBasis==='MARKET_DERIVED_ONLY' && rec.coreAssessment.betEligibleByModelError===false,'must retain honest market-only Core classification and blocked BET authority');
  const at=Date.parse(a.checkedAt);
  ensure(Number.isFinite(at) && at>=Date.parse(report.feedGeneratedAt) && at<=Date.parse(report.ts),'requires current producer judgment');
  ensure(Date.parse(rec.feed?.eventDate)>Date.parse(report.ts),'requires an unstarted event');
  for (const k of ['rationale','uncertainty','conflictReview','limitations']) ensure(text(a[k]),`requires ${k}`);
  ensure(a.uncertaintyState==='UNQUANTIFIED' && a.independentFairClaimed===false,'must disclose unquantified forecast uncertainty');
  ensure(list(a.sourceIds).length>0 && a.sourceIds.every(id=>ids.get(id)?.kind==='MODEL'),'requires source-linked model evidence');
  const matches=list(rec.forecastReview?.records).filter(r=>r.recordId===a.forecastRecordId);
  ensure(matches.length===1,'requires one reviewed forecast record');
  const r=matches[0];
  ensure(r.eligibility==='ELIGIBLE_EXACT' && r.kind==='OUTCOME_PROBABILITY' && r.side===rec.feed.side && r.marketDetail===rec.coreAssessment.context.marketDetail,'requires an eligible exact outcome forecast');
  ensure(a.sourceIds.some(id=>ids.get(id)?.url===r.url),'model source URL must match the forecast');
  ensure(close(a.probability,r.probability) && a.probabilityBasis===r.probabilityBasis && a.probability>0 && a.probability<1,'published point/basis must be preserved');
  ensure(r.comparison?.direction==='SUPPORTS_PRICE' && close(r.comparison.priceDecimal,Number(rec.feed.priceDecimal)),'forecast point must support the exact current price');
  ensure(typeof a.provisional==='boolean','requires explicit provisional state');
  const unresolved=rec.marketAssessment.informationReview?.state==='UNRESOLVED' || rec.coreAssessment.context.personnelSensitivity==='UNRESOLVED';
  if (unresolved) ensure(a.provisional===true && text(a.recheckCondition),'unresolved material information requires provisional wording and a named recheck');
  ensure(String(rec.fair).startsWith('Market reference: '),'market reference must remain separately labelled');
  ensure(/\bLEAN\b/.test(rec.analysis) && /no (?:bet|wager)/i.test(rec.analysis),'visible analysis must identify an opinion and no wager');
  if (a.provisional) ensure(/provisional/i.test(rec.analysis) && rec.analysis.includes(a.recheckCondition),'visible analysis must carry the provisional condition');
  ensure(rec.analysis.includes(a.uncertainty) && rec.analysis.includes(a.conflictReview),'uncertainty and disagreement must be visible');
  return true;
}

export function validateForecastLeanDirections(report) {
  const groups=new Map();
  for (const rec of list(report?.recs).filter(r=>r.status==='LEAN')) {
    const f=rec.feed||{}, key=[rec.coreAssessment?.context?.sport,f.eventId,Date.parse(f.eventDate),f.marketKey,f.line??''].join('|');
    const g=groups.get(key)||{sides:new Set(),forecastOpinion:false};
    g.sides.add(f.side);g.forecastOpinion ||= rec.forecastLean!=null;groups.set(key,g);
  }
  for (const g of groups.values()) if (g.forecastOpinion) ensure(g.sides.size===1,'select one directional preference per exact paired contract; retain disagreement in analysis');
}

/** Producer-supplied judgment is mandatory; this never auto-promotes cards. */
export function createForecastLean(report, rec, judgment) {
  const r=list(rec.forecastReview?.records).find(r=>r.recordId===judgment?.forecastRecordId);
  ensure(r,'reviewed record required');
  const next=structuredClone(rec);
  next.status='LEAN';next.stake='$0';next.playTo='NO BET';delete next.priceWatch;
  next.forecastLean={schema:1,basis:'REVIEWED_FORECAST_POINT',selectionKey:rec.feed.selectionKey,
    checkedAt:report.ts,forecastRecordId:r.recordId,probability:r.probability,probabilityBasis:r.probabilityBasis,
    uncertaintyState:'UNQUANTIFIED',independentFairClaimed:false,...judgment};
  // Canonical identity and the observed model point cannot be overridden by judgment.
  Object.assign(next.forecastLean,{schema:1,basis:'REVIEWED_FORECAST_POINT',selectionKey:rec.feed.selectionKey,
    checkedAt:report.ts,forecastRecordId:r.recordId,probability:r.probability,probabilityBasis:r.probabilityBasis,
    uncertaintyState:'UNQUANTIFIED',independentFairClaimed:false});
  const a=next.forecastLean;
  next.analysis=`${a.provisional?'PROVISIONAL ':''}LEAN — ${a.rationale} ${a.uncertainty} ${a.conflictReview} ${a.provisional?a.recheckCondition:''} No wager; below BET strength.`;
  next.edge=`${r.publisher} published ${(r.probability*100).toFixed(2)}% for this exact selection. This is a forecast point, not an independently established fair or profit estimate.`;
  next.support=next.edge;
  next.contrary=`${a.uncertainty} ${a.conflictReview} ${a.limitations}`;
  next.coreAssessment.rationale=next.analysis;
  next.marketAssessment.decisionRationale=next.analysis;
  if (next.cardEvidence) {
    next.cardEvidence.decisionExplanation=next.analysis;
    next.cardEvidence.findings.push({stance:'SUPPORT',sourceIds:a.sourceIds,finding:next.edge,
      application:a.rationale,limitation:a.limitations});
  }
  validateForecastLean(report,next);
  return next;
}
