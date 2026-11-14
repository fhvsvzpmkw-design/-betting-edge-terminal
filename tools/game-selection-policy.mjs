// Forward selection rules. Pinnacle remains visible context, never a qualifier.
// These initial operating cutoffs are not measured profitability estimates.
export const GAME_SELECTION_FROM = '2026-11-14T17:00:00Z';
export const LEAN_MIN_PROBABILITY_POINTS = 0.5;
export const BET_MIN_PROBABILITY_POINTS = 2;
const EPS = 1e-8;
const finite = x => typeof x === 'number' && Number.isFinite(x);
const ensure = (ok, message) => { if (!ok) throw new Error(`Game selection: ${message}`); };
export const gameSelectionActive = report => Date.parse(report?.ts) >= Date.parse(GAME_SELECTION_FROM);

export function forecastQualification(comparison) {
  const edge = comparison?.edgeProbabilityPoints;
  const supported = comparison?.direction === 'SUPPORTS_PRICE' && finite(edge) && edge > 0 &&
    finite(comparison.priceDecimal) && comparison.priceDecimal > 1;
  return {lean: supported && edge >= LEAN_MIN_PROBABILITY_POINTS - EPS,
    priceWait: supported && edge < LEAN_MIN_PROBABILITY_POINTS - EPS,
    betReview: supported && edge >= BET_MIN_PROBABILITY_POINTS - EPS};
}

// Original reviewed comparisons already preserve unconditional/conditional push
// treatment. Their break-even point scales with 1/price, so no new distribution
// or score-to-probability conversion is needed for an exact price recheck.
export function forecastLeanPriceTarget(record) {
  const c = record?.comparison, p = record?.probability;
  ensure(finite(p) && p > 0 && p < 1 && finite(c?.priceDecimal) && c.priceDecimal > 1 &&
    finite(c.breakEvenProbability) && c.breakEvenProbability > 0 &&
    ['UNCONDITIONAL', 'CONDITIONAL_ON_NO_PUSH'].includes(record.probabilityBasis), 'requires a reviewed exact probability/settlement comparison');
  const remainingMass = c.breakEvenProbability * c.priceDecimal;
  ensure(remainingMass > 0 && remainingMass <= 1 + EPS && p <= remainingMass + EPS,
    'invalid probability/settlement mass');
  const denominator = p - LEAN_MIN_PROBABILITY_POINTS / 100;
  ensure(denominator > 0, 'no finite price can reach the LEAN threshold for this point');
  const decimal = remainingMass / denominator;
  ensure(decimal > 1, 'invalid LEAN price target');
  const raw = decimal >= 2 ? (decimal - 1) * 100 : -100 / (decimal - 1);
  const american = Math.ceil(raw - 1e-9);
  return {decimal, american: american > 0 ? `+${american}` : String(american)};
}

const americanProbability = n => n >= 100 ? 100 / (n + 100) : n <= -100 ? -n / (100 - n) : NaN;

export function validateGameSelection(report, rec) {
  if (!gameSelectionActive(report)) return {active:false};
  const serious = ['LEAN', 'WAIT', 'BET'].includes(rec?.status);
  if (!serious) return {active:true};
  const fair = rec.fairValueEvidence;
  ensure(!(rec.marketAssessment?.basis === 'QUALIFIED_PINNACLE' && !fair && !rec.forecastLean && !rec.forecastWait),
    'a Pinnacle comparison alone cannot qualify LEAN, WAIT or BET; retain it as context');
  if (!['LEAN', 'BET'].includes(rec.status) || !fair) return {active:true};
  if (!['selection_probability', 'selection_american_odds'].includes(fair.unit))
    return {active:true, basis:'NATIVE_UNIT_REVIEW'}; // Existing sourced point/range rules remain authoritative.
  const probability = fair.unit === 'selection_probability' ? fair.estimate : americanProbability(fair.estimate);
  const bounds = [fair.range?.low, fair.range?.high].map(x => fair.unit === 'selection_probability' ? x : americanProbability(x));
  const basis = fair.probabilityBasis;
  const noPush = fair.settlement?.pushRule === 'NO_PUSH';
  const push = noPush ? 0 : fair.pushProbability;
  ensure(['UNCONDITIONAL', 'CONDITIONAL_ON_NO_PUSH'].includes(basis),
    'a probability fair must state its original probabilityBasis; do not assume push treatment');
  ensure(basis === 'CONDITIONAL_ON_NO_PUSH' || finite(push) && push >= 0 && push < 1,
    'an unconditional fair requires its supported push probability or NO_PUSH settlement');
  const mass = basis === 'CONDITIONAL_ON_NO_PUSH' ? 1 : 1 - push;
  ensure(finite(probability) && probability > 0 && probability <= mass && bounds.every(x => finite(x) && x > 0 && x <= mass) &&
    finite(rec.feed?.priceDecimal) && rec.feed.priceDecimal > 1, 'invalid fair, range or execution price');
  const breakEven = mass / rec.feed.priceDecimal;
  const edgeProbabilityPoints = (probability - breakEven) * 100;
  const conservativeEdgeProbabilityPoints = (Math.min(...bounds) - breakEven) * 100;
  const minimum = rec.status === 'BET' ? BET_MIN_PROBABILITY_POINTS : LEAN_MIN_PROBABILITY_POINTS;
  ensure(edgeProbabilityPoints >= minimum - EPS, `${rec.status} requires at least ${minimum.toFixed(2)} probability points from the supported game fair`);
  if (rec.status === 'BET') ensure(conservativeEdgeProbabilityPoints > EPS,
    'BET requires its supported conservative endpoint to remain above break-even');
  return {active:true, edgeProbabilityPoints, conservativeEdgeProbabilityPoints};
}
