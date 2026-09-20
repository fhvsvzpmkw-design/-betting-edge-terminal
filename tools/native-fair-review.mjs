// Review leads from an already recorded fair. Never adopts a model or issues a grade.
const list = x => Array.isArray(x) ? x : [];
const text = x => typeof x === 'string' && x.trim().length > 0;
const finite = x => typeof x === 'number' && Number.isFinite(x);
const time = x => Date.parse(x || '');
const sameLine = (a,b) => a == null ? b == null : finite(a) && finite(b) && Math.abs(a-b)<1e-8;
const americanProbability = x => x >= 100 ? 100/(100+x) : x <= -100 ? -x/(100-x) : null;
export const NATIVE_FAIR_REVIEW_FROM = '2026-09-20T18:15:00-07:00';
export function compareRecordedFair(report, selection, quote, receipt) {
  if (!(time(report?.ts) >= time(NATIVE_FAIR_REVIEW_FROM))) return null;
  const rec = receipt?.decision || receipt?.candidateDraft?.decision, fair = rec?.fairValueEvidence;
  if (!fair || !quote || !['INDEPENDENT_MODEL','MARKET_ANCHORED_MODEL'].includes(rec?.coreAssessment?.context?.fairValueBasis)) return null;
  // A recorded fair is not transferred to another side, handicap, period or event.
  if (fair.selectionKey !== quote.selectionKey || rec.feed?.selectionKey !== quote.selectionKey ||
      String(rec.feed?.eventId) !== String(selection.eventId) || rec.feed?.side !== quote.side ||
      !sameLine(rec.feed?.line, quote.line) || !Number.isFinite(time(rec.feed?.eventDate)) ||
      time(rec.feed.eventDate) !== time(selection.eventDate || selection.startTime) ||
      time(report.ts) >= time(rec.feed.eventDate) || !finite(quote.priceDecimal) || quote.priceDecimal <= 1 ||
      !finite(fair.estimate) || !text(fair.method) || !text(fair.calculation) || !text(fair.limitations)) return null;
  // Existing facts remain dated. Current receipt review is required before this
  // becomes a current lead; a prior report cannot silently revalidate itself.
  if (!(time(receipt.checkedAt) >= time(report.feedGeneratedAt) && time(receipt.checkedAt) <= time(report.ts))) return null;
  const sources = new Map(list(rec.sourceEvidence).filter(source => text(source.id) && text(source.finding) &&
    String(source.eventId) === String(selection.eventId) && Number.isFinite(time(source.checkedAt || source.asOf)) &&
    time(source.checkedAt || source.asOf) <= time(report.ts) && /^https?:\/\//i.test(source.url || '')).map(source=>[source.id,source]));
  if (!list(fair.inputs).length || fair.inputs.some(input => !list(input.sourceIds).length || input.sourceIds.some(id=>!sources.has(id))) ||
      !fair.inputs.some(input=>input.sourceIds.some(id=>['MODEL','OFFICIAL','REPORTING'].includes(sources.get(id).kind)))) return null;
  let pointMargin=null, conservativeMargin=null, comparisonUnit=null, settlementPending=false;
  const low=fair.range?.low, high=fair.range?.high;
  if (fair.unit === 'selection_probability' || fair.unit === 'selection_american_odds') {
    const p = fair.unit === 'selection_probability' ? fair.estimate : americanProbability(fair.estimate);
    if (!finite(p) || p<=0 || p>=1) return null;
    let threshold=1/quote.priceDecimal;
    const conditional = fair.probabilityBasis==='CONDITIONAL_ON_NO_PUSH';
    const unconditional = fair.probabilityBasis==='UNCONDITIONAL' && finite(fair.pushProbability) && fair.pushProbability>=0 && fair.pushProbability<1 && p+fair.pushProbability<=1+1e-10;
    if (unconditional) threshold=(1-fair.pushProbability)/quote.priceDecimal;
    // Missing push semantics produces a review lead, never claimed EV or a BET threshold.
    settlementPending=!conditional&&!unconditional;
    pointMargin=(p-threshold)*100; comparisonUnit='probability_points';
    if (finite(low)&&finite(high)&&low<=fair.estimate&&fair.estimate<=high) {
      const q=fair.unit==='selection_probability' ? low : Math.min(americanProbability(low)??Infinity,americanProbability(high)??Infinity);
      if (finite(q)&&q>0&&q<1) conservativeMargin=(q-threshold)*100;
    }
  } else if (fair.unit==='selection_spread_points' && quote.marketKey==='spread') {
    const selectedLine=quote.side==='away' ? -quote.line : quote.line;
    pointMargin=selectedLine-fair.estimate; comparisonUnit='spread_points';
    if (finite(high)) conservativeMargin=selectedLine-high;
  } else if (fair.unit==='home_spread_points' && quote.marketKey==='spread' && quote.side==='home') {
    pointMargin=quote.line-fair.estimate; comparisonUnit='spread_points';
    if (finite(high)) conservativeMargin=quote.line-high;
  } else if (fair.unit==='total_points' && quote.marketKey==='totals' && ['over','under'].includes(quote.side)) {
    pointMargin=quote.side==='over' ? fair.estimate-quote.line : quote.line-fair.estimate; comparisonUnit='total_points';
    if (finite(low)&&finite(high)) conservativeMargin=quote.side==='over' ? low-quote.line : quote.line-high;
  } else return null;
  if (!finite(pointMargin)) return null;
  return {selectionKey:quote.selectionKey, unit:fair.unit, estimate:fair.estimate,
    comparisonUnit, pointMargin, conservativeMargin, settlementPending,
    supportsPointReview:pointMargin>1e-8, conservativeBoundClears:!settlementPending&&finite(conservativeMargin)&&conservativeMargin>1e-8,
    decisionAuthority:false, statusEffect:'NONE',
    limitation:'An existing sourced fair is a research lead. A positive point or point-spread margin is not calibrated EV, BET eligibility, or an instruction to wager.'};
}
