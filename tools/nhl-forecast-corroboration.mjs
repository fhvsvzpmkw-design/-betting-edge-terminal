// Forward-only NHL forecast opinions. Agreement is corroboration, not a fair
// probability, an independence claim, or authority to place a wager.
export const NHL_FORECAST_CORROBORATION_FROM = '2026-10-15T12:11:48-07:00';
export const NHL_FORECAST_CORROBORATION_POLICY = 'nhl-forecast-corroboration-v1';
export const NHL_FORECAST_SOURCES = Object.freeze({
  moneypuck: Object.freeze({family:'MONEYPUCK',host:'moneypuck.com'}),
  dratings: Object.freeze({family:'DRATINGS',host:'dratings.com'}),
  dimers: Object.freeze({family:'CIPHER',host:'dimers.com'})
});
const list = v => Array.isArray(v) ? v : [];
const close = (a,b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a-b)<1e-8;
const nonempty = v => typeof v==='string' && v.trim().length>0;
const ensure = (ok,message) => {if(!ok) throw new Error(`NHL corroboration: ${message}`);};
export const nhlCorroborationApplies = (report,rec) => Date.parse(report?.ts)>=Date.parse(NHL_FORECAST_CORROBORATION_FROM) &&
  rec?.coreAssessment?.context?.sport==='NHL' && rec?.coreAssessment?.context?.marketDetail==='full_game_moneyline';

export function inspectNhlCorroboration(report,rec) {
  if(!nhlCorroborationApplies(report,rec)) return {active:false};
  const price=Number(rec?.feed?.priceDecimal),groups=new Map();
  for(const r of list(rec?.forecastReview?.records)) {
    const source=NHL_FORECAST_SOURCES[r.sourceId];
    let host='';try {host=new URL(r.url).hostname.toLowerCase();} catch {}
    if(!source || r.modelFamily!==source.family || !(host===source.host || host.endsWith(`.${source.host}`)) ||
      r.eligibility!=='ELIGIBLE_EXACT' || r.kind!=='OUTCOME_PROBABILITY' || r.period!=='FULL_GAME' ||
      r.marketDetail!=='full_game_moneyline' || r.side!==rec.feed?.side || r.line!=null ||
      r.probabilityBasis!=='UNCONDITIONAL' || !(r.probability>0 && r.probability<1) ||
      !close(r.comparison?.priceDecimal,price) || !close(r.comparison?.edgeProbabilityPoints,100*(r.probability-1/price))) continue;
    const group=groups.get(r.sourceId)||[];group.push(r);groups.set(r.sourceId,group);
  }
  // Repeated captures of one provider never become two votes. Conflicting
  // current versions cannot be resolved by choosing that provider's high point.
  const records=[],conflictingSources=[];
  for(const [sourceId,rows] of groups) {
    if(rows.some(r=>!close(r.probability,rows[0].probability))) {conflictingSources.push(sourceId);continue;}
    records.push([...rows].sort((a,b)=>String(a.recordId).localeCompare(String(b.recordId)))[0]);
  }
  records.sort((a,b)=>a.sourceId.localeCompare(b.sourceId));
  const supporting=records.filter(r=>r.comparison.edgeProbabilityPoints>1e-8 && r.comparison.direction==='SUPPORTS_PRICE');
  const meaningful=supporting.filter(r=>r.comparison.edgeProbabilityPoints>=1-1e-8);
  return {active:true,policyId:NHL_FORECAST_CORROBORATION_POLICY,records,
    supportingRecordIds:supporting.map(r=>r.recordId),supportingSourceIds:supporting.map(r=>r.sourceId),
    meaningfulRecordIds:meaningful.map(r=>r.recordId),conflictingSources,
    eligible:supporting.length>=2 && meaningful.length>0};
}

const americanFor = d => d>=2 ? 100*(d-1) : -100/(d-1);
const decimalFor = a => a>0 ? 1+a/100 : 1+100/-a;

// A price WAIT must name a price that would satisfy BOTH source agreement and
// the one-point threshold. A one-model threshold cannot imply LEAN clearance.
export function nhlCorroborationPriceTarget(report,rec,anchorId) {
  const review=inspectNhlCorroboration(report,rec);
  ensure(review.active && !review.eligible,'price WAIT needs an unresolved corroboration/one-point condition');
  const anchor=review.records.find(r=>r.recordId===anchorId);
  ensure(anchor && anchor.comparison.edgeProbabilityPoints>1e-8 && anchor.probability>.01,
    'price WAIT needs a positive exact point from MoneyPuck, DRatings or Dimers');
  const options=review.records.filter(r=>r.sourceId!==anchor.sourceId && r.probability>2e-10).map(other=>{
    const boundary=Math.max(1/(anchor.probability-.01),1/(other.probability-2e-10));
    let american=Math.ceil(americanFor(boundary)-1e-9),decimal=decimalFor(american);
    ensure(Number.isSafeInteger(american) && american!==0,'price condition cannot be represented in American odds');
    for(let attempt=0;attempt<3 && (anchor.probability-1/decimal<.01-1e-10 || other.probability-1/decimal<=1e-10);attempt++) {
      american++;decimal=decimalFor(american);
    }
    ensure(anchor.probability-1/decimal>=.01-1e-10 && other.probability-1/decimal>1e-10,'price condition must clear both source thresholds');
    return {decimal,american:american>0?`+${american}`:String(american),forecastRecordIds:[anchor.recordId,other.recordId]};
  }).sort((a,b)=>a.decimal-b.decimal || a.forecastRecordIds[1].localeCompare(b.forecastRecordIds[1]));
  ensure(options.length>0,'price WAIT needs a second applicable approved source to establish a concrete price condition; otherwise review PASS');
  return options[0];
}

function evidenceIds(rec,records) {
  return records.map(record=>{
    const source=list(rec.sourceEvidence).find(s=>s.kind==='MODEL' && s.url===record.url && nonempty(s.id));
    ensure(source,`missing MODEL evidence for ${record.sourceId}`);return source.id;
  });
}
export function buildNhlCorroboration(report,rec,anchorId,{waiting=false}={}) {
  const review=inspectNhlCorroboration(report,rec);
  ensure(review.active,'requires the forward NHL moneyline rule');
  let ids;
  if(waiting) ids=nhlCorroborationPriceTarget(report,rec,anchorId).forecastRecordIds;
  else {
    ensure(review.eligible,'LEAN requires two approved sources supporting the exact price, with at least one at 1.00 probability point');
    ensure(review.meaningfulRecordIds.includes(anchorId),'LEAN anchor must be an approved source clearing 1.00 probability point');
    ids=review.supportingRecordIds;
  }
  const records=ids.map(id=>review.records.find(r=>r.recordId===id));
  return {schema:1,policyId:NHL_FORECAST_CORROBORATION_POLICY,forecastRecordIds:ids,sourceIds:evidenceIds(rec,records)};
}
export function nhlCorroborationText(rec,assessment) {
  const records=assessment.corroboration.forecastRecordIds.map(id=>list(rec.forecastReview?.records).find(r=>r.recordId===id));
  return `NHL source comparison: ${records.map(r=>`${r.publisher} ${(100*r.probability).toFixed(2)}% (${r.comparison.edgeProbabilityPoints>=0?'+':''}${r.comparison.edgeProbabilityPoints.toFixed(2)} probability points at this price)`).join('; ')}. Source agreement is not established independence or calibrated profit.`;
}
export function validateNhlCorroboration(report,rec,assessment,{waiting=false}={}) {
  if(!nhlCorroborationApplies(report,rec)) return false;
  const expected=buildNhlCorroboration(report,rec,assessment.forecastRecordId,{waiting}),actual=assessment.corroboration;
  ensure(actual?.schema===1 && actual.policyId===expected.policyId &&
    JSON.stringify(actual.forecastRecordIds)===JSON.stringify(expected.forecastRecordIds) &&
    JSON.stringify(actual.sourceIds)===JSON.stringify(expected.sourceIds),'source/record bindings differ from exact reviewed corroboration');
  ensure(expected.sourceIds.every(id=>list(assessment.sourceIds).includes(id)),'opinion must bind both MODEL sources');
  ensure(rec.analysis.includes(nhlCorroborationText(rec,assessment)),'visible opinion must preserve both probabilities and signed price gaps');
  validateNhlPinnacleReview(report,rec,assessment);
  return true;
}

export function buildNhlPinnacleReview(report,rec,judgment) {
  const gap=rec.benchmarkComparison?.edgeProbabilityPoints;
  if(!(gap<0)) return undefined;
  ensure(nonempty(judgment?.rationale) && nonempty(judgment?.decisionImpact),
    'unfavorable Pinnacle price requires a producer-authored disagreement rationale and decision impact');
  return {schema:1,checkedAt:report.ts,edgeProbabilityPoints:gap,
    sourceIds:[...list(rec.marketAssessment?.referenceSourceIds)],rationale:judgment.rationale,decisionImpact:judgment.decisionImpact};
}
export function nhlPinnacleReviewText(review) {
  return review ? `Pinnacle price gap ${review.edgeProbabilityPoints.toFixed(2)} probability points. ${review.rationale} ${review.decisionImpact}` : '';
}
export function validateNhlPinnacleReview(report,rec,assessment) {
  const gap=rec.benchmarkComparison?.edgeProbabilityPoints,p=assessment.pinnacleReview;
  if(!(gap<0) && p==null) return;
  ensure(p?.schema===1 && close(p.edgeProbabilityPoints,gap) &&
    Date.parse(p.checkedAt)>=Date.parse(report.feedGeneratedAt) && Date.parse(p.checkedAt)<=Date.parse(report.ts) &&
    list(p.sourceIds).length>0 && JSON.stringify(p.sourceIds)===JSON.stringify(rec.marketAssessment?.referenceSourceIds) &&
    p.sourceIds.every(id=>list(rec.sourceEvidence).some(s=>s.id===id && s.kind==='MARKET')) &&
    nonempty(p.rationale) && nonempty(p.decisionImpact),'requires source-bound review of the actual signed Pinnacle disagreement');
  ensure(rec.analysis.includes(nhlPinnacleReviewText(p)),'Pinnacle disagreement and producer judgment must be visible');
}
