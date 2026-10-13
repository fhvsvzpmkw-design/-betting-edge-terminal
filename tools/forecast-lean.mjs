// A reviewed published probability can support an opinion without becoming
// an independently validated fair or acquiring BET/staking authority.
export const FORECAST_LEAN_FROM = '2026-10-01T12:00:00-07:00';
export const FORECAST_LEAN_DEFAULT_FROM = '2026-10-06T15:53:55-07:00';
export const FORECAST_LEAN_DEFAULT_MIN_POINTS = 1;
export const NHL_FORECAST_PRICE_WAIT_FROM = '2026-10-13T07:07:42-07:00';
const text = v => typeof v === 'string' && v.trim().length > 0;
const list = v => Array.isArray(v) ? v : [];
const close = (a,b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a-b)<1e-8;
const ensure = (ok,msg) => {if (!ok) throw new Error(`Forecast LEAN: ${msg}`);};
const nhlPriceOpinion = (report, rec) => Date.parse(report?.ts) >= Date.parse(NHL_FORECAST_PRICE_WAIT_FROM) &&
  rec?.coreAssessment?.context?.sport === 'NHL' && rec?.coreAssessment?.context?.marketDetail === 'full_game_moneyline';
const points = rec => 100 * (rec.probability - 1 / Number(rec.comparison?.priceDecimal));
function targetPrice(probability) {
  ensure(Number.isFinite(probability) && probability > FORECAST_LEAN_DEFAULT_MIN_POINTS / 100 && probability < 1,
    'forecast point must permit a finite one-point price condition');
  const decimal = 1 / (probability - FORECAST_LEAN_DEFAULT_MIN_POINTS / 100);
  const raw = decimal >= 2 ? (decimal - 1) * 100 : -100 / (decimal - 1);
  // Round toward a better offered price, so the visible threshold really clears one point.
  const american = Math.ceil(raw - 1e-9);
  return {decimal, american: american > 0 ? `+${american}` : String(american)};
}

// Producer guidance only: current exact forecast comparisons still come from
// the bound-record/applicability validators. This does not create a decision.
export function forecastLeanDefault(report, decision, comparisons = []) {
  const active = Date.parse(report?.ts) >= Date.parse(FORECAST_LEAN_DEFAULT_FROM);
  const exact = list(comparisons).filter(row => row.direction === 'SUPPORTS_PRICE' &&
    Number.isFinite(row.edgeProbabilityPoints) && row.edgeProbabilityPoints >= FORECAST_LEAN_DEFAULT_MIN_POINTS &&
    close(row.priceDecimal, Number(decision?.feed?.priceDecimal)));
  const applies = active && decision?.marketAssessment?.basis === 'QUALIFIED_PINNACLE' && exact.length > 0;
  const waitExact = nhlPriceOpinion(report, decision) ? list(comparisons).filter(row => row.direction === 'SUPPORTS_PRICE' &&
    Number.isFinite(row.edgeProbabilityPoints) && row.edgeProbabilityPoints > 0 && row.edgeProbabilityPoints < FORECAST_LEAN_DEFAULT_MIN_POINTS - 1e-8 &&
    close(row.priceDecimal, Number(decision?.feed?.priceDecimal))) : [];
  const waitApplies = !applies && decision?.marketAssessment?.basis === 'QUALIFIED_PINNACLE' && waitExact.length > 0;
  return {active, applies, minimumEdgeProbabilityPoints:FORECAST_LEAN_DEFAULT_MIN_POINTS,
    qualifyingRecordIds:applies ? exact.map(row => row.recordId) : [],
    ...(nhlPriceOpinion(report, decision) ? {waitApplies, waitingRecordIds:waitApplies ? waitExact.map(row => row.recordId) : []} : {}),
    recommendedStatus:applies ? 'LEAN' : waitApplies ? 'WAIT' : null,
    provisional:applies && (decision?.marketAssessment?.informationReview?.state === 'UNRESOLVED' ||
      decision?.coreAssessment?.context?.personnelSensitivity === 'UNRESOLVED'),
    decisionAuthority:false,
    instruction:applies ? 'Default to a sourced zero-stake LEAN, visibly provisional when assumptions remain unresolved. A PASS needs a specific evidenced exception; Pinnacle disagreement, market dependence, missing intervals and ordinary unconfirmed lineups are limitations, not sufficient rejection reasons.' : waitApplies ? 'Author a zero-stake forecast price WAIT with createForecastWait. Name the current exact price/forecast condition for a one-point LEAN reassessment; preserve Pinnacle disagreement and unresolved personnel. No automatic promotion or wager.' : null};
}

function validateForecastPoint(report, rec, a, ids, {status, basis, from}) {
  if (a == null) return false;
  ensure(Date.parse(report.ts)>=Date.parse(from),'predates forward activation');
  ensure(rec.status===status && /^\$?0(?:\.0+)?$/.test(String(rec.stake)) && rec.playTo==='NO BET' && !rec.priceWatch,'opinion only; cannot authorize BET, stake or a wagering threshold');
  ensure(rec.marketAssessment?.basis==='QUALIFIED_PINNACLE' && rec.fairValueEvidence==null,'requires the existing exact market assessment; cannot masquerade as adopted fair');
  ensure(a.schema===1 && a.basis===basis && a.selectionKey===rec.feed?.selectionKey,'requires exact selection identity');
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
  ensure(new RegExp(`\\b${status}\\b`).test(rec.analysis) && /no (?:bet|wager)/i.test(rec.analysis),'visible analysis must identify an opinion and no wager');
  if (a.provisional) ensure(/provisional/i.test(rec.analysis) && rec.analysis.includes(a.recheckCondition),'visible analysis must carry the provisional condition');
  ensure(rec.analysis.includes(a.uncertainty) && rec.analysis.includes(a.conflictReview),'uncertainty and disagreement must be visible');
  return true;
}

export function validateForecastLean(report, rec, ids = new Map(list(rec?.sourceEvidence).map(s=>[s.id,s]))) {
  if (rec?.forecastLean == null) return false;
  ensure(rec.forecastWait == null, 'cannot carry both forecast LEAN and forecast WAIT');
  const valid = validateForecastPoint(report, rec, rec.forecastLean, ids, {status:'LEAN',basis:'REVIEWED_FORECAST_POINT',from:FORECAST_LEAN_FROM});
  if (nhlPriceOpinion(report, rec)) {
    const r = list(rec.forecastReview?.records).find(r => r.recordId === rec.forecastLean.forecastRecordId);
    ensure(r.probabilityBasis === 'UNCONDITIONAL' && points(r) >= FORECAST_LEAN_DEFAULT_MIN_POINTS - 1e-8,
      'NHL forecast LEAN requires at least one probability point; smaller positive gaps belong in forecast price WAIT');
  }
  return valid;
}

export function validateForecastWait(report, rec, ids = new Map(list(rec?.sourceEvidence).map(s=>[s.id,s]))) {
  const a = rec?.forecastWait;
  if (a == null) return false;
  ensure(rec.forecastLean == null && nhlPriceOpinion(report, rec), 'forecast price WAIT is forward-only NHL full-game moneyline opinion');
  validateForecastPoint(report, rec, a, ids, {status:'WAIT',basis:'REVIEWED_FORECAST_PRICE_WAIT',from:NHL_FORECAST_PRICE_WAIT_FROM});
  const r = list(rec.forecastReview.records).find(r => r.recordId === a.forecastRecordId), edge = points(r), target = targetPrice(r.probability);
  ensure(r.probabilityBasis === 'UNCONDITIONAL' && edge > 0 && edge < FORECAST_LEAN_DEFAULT_MIN_POINTS - 1e-8,
    'forecast price WAIT requires a positive gap below one probability point');
  ensure(close(a.currentEdgeProbabilityPoints, edge) && a.targetEdgeProbabilityPoints === FORECAST_LEAN_DEFAULT_MIN_POINTS &&
    close(a.targetPriceDecimal, target.decimal) && a.targetPriceAmerican === target.american, 'forecast WAIT price/edge threshold arithmetic must match the original point');
  ensure(a.targetKind === 'LEAN_REASSESSMENT' && text(a.recheckCondition) && rec.analysis.includes(a.recheckCondition) &&
    a.recheckCondition.includes(a.targetPriceAmerican), 'forecast WAIT must visibly name the exact price condition for LEAN reassessment');
  if (a.provisional) ensure(text(a.personnelRecheckCondition) && a.recheckCondition.includes(a.personnelRecheckCondition),
    'provisional forecast WAIT must preserve the producer-named unresolved personnel recheck');
  const w = rec.waitQualification;
  ensure(w?.mode === 'FORECAST_PRICE_WAIT' && w.actionableIfResolved === false && w.leanReassessmentIfResolved === true &&
    w.forecastRecordId === a.forecastRecordId && list(w.independentSignals).length === 0 &&
    list(w.blockers).length > 0 && w.blockers.every(text) && text(w.rationale), 'forecast WAIT must retain opinion-only qualification without claiming independent wagering support');
  ensure(rec.cardEvidence?.waitCondition?.trigger === a.recheckCondition, 'forecast WAIT card evidence must preserve the price-growth trigger');
  return true;
}

export function validateForecastLeanDirections(report) {
  const groups=new Map();
  for (const rec of list(report?.recs).filter(r=>r.status==='LEAN' || (r.status==='WAIT' && r.forecastWait != null))) {
    const f=rec.feed||{}, key=[rec.coreAssessment?.context?.sport,f.eventId,Date.parse(f.eventDate),f.marketKey,f.line??''].join('|');
    const g=groups.get(key)||{sides:new Set(),forecastOpinion:false};
    g.sides.add(f.side);g.forecastOpinion ||= rec.forecastLean!=null || rec.forecastWait!=null;groups.set(key,g);
  }
  for (const g of groups.values()) if (g.forecastOpinion) ensure(g.sides.size===1,'select one directional preference per exact paired contract; retain disagreement in analysis');
}

/** Producer-supplied judgment is mandatory; this never auto-promotes cards. */
export function createForecastLean(report, rec, judgment) {
  const r=list(rec.forecastReview?.records).find(r=>r.recordId===judgment?.forecastRecordId);
  ensure(r,'reviewed record required');
  const next=structuredClone(rec);
  if (next.forecastWait != null) {
    next.waitQualification = null;
    if (next.cardEvidence) delete next.cardEvidence.waitCondition;
  }
  delete next.forecastWait;
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

/** A current small positive forecast gap is a price watch for a LEAN, never a bet. */
export function createForecastWait(report, rec, judgment) {
  const r = list(rec.forecastReview?.records).find(r => r.recordId === judgment?.forecastRecordId);
  ensure(r, 'reviewed record required');
  const target = targetPrice(r.probability), next = structuredClone(rec);
  next.status = 'WAIT'; next.stake = '$0'; next.playTo = 'NO BET'; delete next.priceWatch; delete next.forecastLean;
  next.forecastWait = {...judgment, schema:1,basis:'REVIEWED_FORECAST_PRICE_WAIT',selectionKey:rec.feed.selectionKey,
    checkedAt:report.ts,forecastRecordId:r.recordId,probability:r.probability,probabilityBasis:r.probabilityBasis,
    uncertaintyState:'UNQUANTIFIED',independentFairClaimed:false,currentEdgeProbabilityPoints:points(r),
    targetKind:'LEAN_REASSESSMENT',targetEdgeProbabilityPoints:FORECAST_LEAN_DEFAULT_MIN_POINTS,
    targetPriceDecimal:target.decimal,targetPriceAmerican:target.american};
  const a = next.forecastWait;
  if (a.provisional) {
    ensure(text(judgment?.recheckCondition), 'provisional forecast WAIT needs a producer-named personnel recheck');
    a.personnelRecheckCondition = judgment.recheckCondition;
  }
  a.recheckCondition = `Recheck ${rec.title} at ${a.targetPriceAmerican} or better with this forecast, or when a fresh applicable forecast gives at least 1.00 probability point at the current price. Reassess Pinnacle and goalie/personnel applicability; reaching the condition does not authorize a wager.`;
  if (a.provisional) a.recheckCondition += ` ${a.personnelRecheckCondition}`;
  next.analysis = `WAIT — ${a.rationale} ${a.provisional?'Provisional forecast opinion. ':''}${a.uncertainty} ${a.conflictReview} ${a.recheckCondition} No wager; waiting for a meaningful LEAN gap.`;
  next.edge = `${r.publisher} published ${(r.probability*100).toFixed(2)}%; current forecast gap ${a.currentEdgeProbabilityPoints.toFixed(2)} probability points, below the 1.00-point LEAN threshold.`;
  next.support = next.edge; next.contrary = `${a.uncertainty} ${a.conflictReview} ${a.limitations}`;
  next.waitQualification = {mode:'FORECAST_PRICE_WAIT',actionableIfResolved:false,leanReassessmentIfResolved:true,
    forecastRecordId:r.recordId,independentSignals:[],blockers:['Forecast price gap below 1.00 probability point'],rationale:a.recheckCondition};
  next.coreAssessment.rationale = next.analysis; next.marketAssessment.decisionRationale = next.analysis;
  if (next.cardEvidence) {
    next.cardEvidence.decisionExplanation = next.analysis;
    next.cardEvidence.waitCondition = {trigger:a.recheckCondition,checkSource:r.url,
      remainingBetRequirements:'Fresh source, quote, Pinnacle, goalie/personnel and full independent-fair/range, Core, staking and exposure review. This trigger permits LEAN reassessment only.'};
    next.cardEvidence.findings.push({stance:'SUPPORT',sourceIds:a.sourceIds,finding:next.edge,application:a.rationale,limitation:a.limitations});
  }
  validateForecastWait(report,next);
  return next;
}

