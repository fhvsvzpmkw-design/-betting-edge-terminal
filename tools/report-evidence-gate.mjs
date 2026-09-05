#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Historical reports remain immutable. This adds evidence requirements for the
// next scheduled lane; it does not supply a model, a fair, or a betting threshold.
export const REPORT_EVIDENCE_FROM = '2026-09-05T17:00:00-07:00';
export const REPORT_EVIDENCE_FIELDS = Object.freeze(['sourceEvidence', 'sourceShortfall', 'fairValueEvidence', 'benchmarkComparison']);
const SERIOUS = new Set(['BET', 'LEAN', 'WAIT']);
const SOURCE_KINDS = new Set(['OFFICIAL', 'REPORTING', 'MODEL', 'MARKET']);
const SHORTFALL_REASONS = new Set(['SOURCE_UNAVAILABLE', 'MARKET_UNAVAILABLE', 'QUOTE_STALE', 'IDENTITY_UNRESOLVED', 'EVENT_INELIGIBLE']);
const FAIR_UNITS = new Set(['selection_spread_points', 'home_spread_points', 'total_points', 'selection_probability', 'selection_american_odds']);
const SPORTS = new Set(['MLB', 'NFL', 'NCAAF', 'CFL', 'NHL', 'NBA_WNBA']);
const EPSILON = 1e-8;
function ensure(condition, message) { if (!condition) throw new Error(message); }
function nonEmpty(value) { return typeof value === 'string' && value.trim().length > 0; }
function object(value) { return value && typeof value === 'object' && !Array.isArray(value); }
function canonicalSport(value) {
  const sport = String(value || '').trim().toUpperCase();
  return ['NBA', 'WNBA', 'NBA/WNBA'].includes(sport) ? 'NBA_WNBA' : sport === 'CFB' ? 'NCAAF' : sport;
}
function same(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function close(left, right) { return Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) <= EPSILON; }
function zeroStake(rec) { return /^\$?0(?:\.0+)?$/.test(String(rec.stake).trim()); }
function unavailableFair(rec) {
  return rec.fairValueEvidence == null && /\b(?:unavailable|unverified|not rated|not assessed|not established|not calculated|withheld|no fair|n\/a)\b/i.test(String(rec.fair || '')) && !/[+\-−]?\d+(?:\.\d+)?/.test(String(rec.fair || ''));
}
function timestamp(value, label) {
  ensure(nonEmpty(value) && Number.isFinite(Date.parse(value)), `${label} requires a valid timestamp`);
  return Date.parse(value);
}
function sourceUrl(value, label) {
  let url;
  try { url = new URL(value); } catch { throw new Error(`${label} requires a valid source URL`); }
  ensure(['https:', 'http:'].includes(url.protocol) && !url.username && !url.password, `${label} requires an HTTP(S) source URL without credentials`);
  ensure(url.pathname !== '/' || url.search, `${label} must cite a specific source page or artifact, not a domain homepage`);
  return url;
}
function domainSport(url) {
  const host = url.hostname.toLowerCase();
  const matches = domain => host === domain || host.endsWith(`.${domain}`);
  for (const [domain, sport] of [['mlb.com', 'MLB'], ['nfl.com', 'NFL'], ['cfl.ca', 'CFL'], ['nhl.com', 'NHL'], ['nba.com', 'NBA_WNBA'], ['wnba.com', 'NBA_WNBA']]) {
    if (matches(domain)) return sport;
  }
  // Multi-sport publishers and university domains cannot be classified by host.
  return null;
}
function validateSourceLabel(source, sport, label) {
  // Only a positive source attribution is classified. Merely mentioning another
  // league in analysis (or saying its sources were not used) is not a mismatch.
  for (const segment of String(source || '').split(/[;\n]/)) {
    if (/\b(?:no|not|without|excluded|not used|not applicable)\b/i.test(segment)) continue;
    const cited = [...segment.matchAll(/\bofficial\s+(MLB|NFL|NCAAF|CFL|NHL|NBA|WNBA)\s+(?:schedule|game|team|injury|league|source|page|report|notes)\b/gi)];
    for (const match of cited) ensure(canonicalSport(match[1]) === sport, `${label} source sport mismatch: official ${match[1]} citation on ${sport} card`);
  }
}
function sourceEvidence(rec, item, sport, reportMs, label) {
  validateSourceLabel(rec.source, sport, label);
  ensure(Array.isArray(rec.sourceEvidence), `${label} requires structured sourceEvidence`);
  if (!rec.sourceEvidence.length) {
    const shortfall = rec.sourceShortfall;
    ensure(rec.status === 'PASS' && object(shortfall), `${label} missing sources require PASS with explicit sourceShortfall`);
    ensure(SHORTFALL_REASONS.has(shortfall.reason) && nonEmpty(shortfall.missing) && nonEmpty(shortfall.impact), `${label} sourceShortfall requires reason, missing evidence and decision impact`);
    ensure(zeroStake(rec), `${label} source-shortfall PASS must carry zero stake`);
    ensure(unavailableFair(rec), `${label} source-shortfall PASS must state unavailable fair without an unsupported numeric estimate`);
  } else if (rec.sourceShortfall != null) {
    ensure(object(rec.sourceShortfall) && SHORTFALL_REASONS.has(rec.sourceShortfall.reason) && nonEmpty(rec.sourceShortfall.missing) && nonEmpty(rec.sourceShortfall.impact), `${label} sourceShortfall must record a specific evidence limitation`);
  }
  const ids = new Map();
  for (const [index, source] of rec.sourceEvidence.entries()) {
    const prefix = `${label} sourceEvidence[${index}]`;
    ensure(object(source) && nonEmpty(source.id) && !ids.has(source.id), `${prefix} requires a unique source id`);
    ensure(nonEmpty(source.title) && nonEmpty(source.finding), `${prefix} requires a title and specific finding`);
    ensure(SOURCE_KINDS.has(source.kind), `${prefix} requires an explicit source kind`);
    ensure(canonicalSport(source.sport) === sport, `${prefix} sport does not match ${sport}`);
    ensure(nonEmpty(String(source.eventId || '')) && String(source.eventId) === String(rec.feed?.eventId || ''), `${prefix} eventId does not match the issued selection`);
    const url = sourceUrl(source.url, prefix);
    const knownSport = domainSport(url);
    ensure(!knownSport || knownSport === sport, `${prefix} URL source sport mismatch: ${knownSport} on ${sport} card`);
    validateSourceLabel(source.title, sport, prefix);
    ensure(timestamp(source.checkedAt, `${prefix}.checkedAt`) <= reportMs, `${prefix} checkedAt cannot be after report issuance`);
    ids.set(source.id, source);
  }
  if (SERIOUS.has(rec.status)) ensure([...ids.values()].some(source => source.kind !== 'MARKET'), `${label} ${rec.status} requires independent non-market source evidence`);
  return ids;
}
function displayNumber(value, unit, label) {
  ensure(nonEmpty(value) && /^[+\-−]?\d+(?:\.\d+)?%?$/.test(value), `${label} fair displayValue must be a single numeric token`);
  const percentage = value.endsWith('%');
  ensure(!percentage || unit === 'selection_probability', `${label} only probability displayValue may use %`);
  return Number(value.replace('−', '-').replace('%', '')) / (percentage ? 100 : 1);
}
function hasDisplayValue(fair, displayValue) {
  const text = String(fair || '').replaceAll('−', '-');
  const wanted = displayValue.replaceAll('−', '-');
  const escaped = wanted.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\w.+%\\-])${escaped}(?=$|[^\\w.%])`).test(text);
}
function fairEvidence(rec, item, ids, label) {
  const fair = rec.fairValueEvidence;
  if (!SERIOUS.has(rec.status) && fair == null) return;
  ensure(object(fair), `${label} ${rec.status} requires numeric fairValueEvidence with a derivation and range`);
  ensure(fair.selectionKey === rec.feed?.selectionKey && nonEmpty(fair.selectionKey), `${label} fair evidence selectionKey must match the issued selection`);
  ensure(FAIR_UNITS.has(fair.unit), `${label} fair evidence requires an explicit supported unit/orientation`);
  const market = rec.coreAssessment?.context?.marketClass;
  if (fair.unit.endsWith('_spread_points')) ensure(market === 'spread', `${label} spread fair unit requires a spread market`);
  if (fair.unit === 'home_spread_points') ensure(rec.feed?.side === 'home', `${label} home_spread_points cannot label an away selection; convert the model output to selection_spread_points`);
  if (fair.unit === 'total_points') ensure(market === 'total', `${label} total fair unit requires a total market`);
  ensure(Number.isFinite(fair.estimate) && close(fair.result, fair.estimate), `${label} numeric fair result must equal estimate`);
  ensure(object(fair.range) && Number.isFinite(fair.range.low) && Number.isFinite(fair.range.high) && fair.range.low <= fair.estimate && fair.estimate <= fair.range.high, `${label} fair range must have numeric bounds containing the estimate`);
  if (fair.unit === 'selection_probability') ensure(fair.range.low > 0 && fair.range.high < 1, `${label} fair probability range must lie inside (0, 1)`);
  if (fair.unit === 'selection_american_odds') ensure(Math.abs(fair.estimate) >= 100 && Math.abs(fair.range.low) >= 100 && Math.abs(fair.range.high) >= 100, `${label} American fair prices must be at least 100 in absolute value`);
  ensure(close(displayNumber(fair.displayValue, fair.unit, label), fair.estimate) && hasDisplayValue(rec.fair, fair.displayValue), `${label} fair displayValue must match the numeric estimate and displayed fair`);
  for (const field of ['method', 'calculation', 'limitations']) ensure(nonEmpty(fair[field]), `${label} fair evidence requires ${field}`);
  ensure(Array.isArray(fair.inputs) && fair.inputs.length > 0, `${label} fair derivation requires numeric inputs with source references`);
  for (const [index, input] of fair.inputs.entries()) {
    ensure(object(input) && nonEmpty(input.name) && Number.isFinite(input.value) && nonEmpty(input.unit), `${label} fair inputs[${index}] requires name, numeric value and unit`);
    ensure(Array.isArray(input.sourceIds) && input.sourceIds.length > 0 && input.sourceIds.every(id => ids.has(id)), `${label} fair inputs[${index}] references missing source evidence`);
  }
  ensure(object(fair.personnelBasis) && typeof fair.personnelBasis.sensitive === 'boolean' && nonEmpty(fair.personnelBasis.rationale), `${label} fair evidence requires an explicit personnel sensitivity rationale`);
  const contextSensitive = ['RESOLVED', 'UNRESOLVED'].includes(rec.coreAssessment?.context?.personnelSensitivity);
  if (contextSensitive || fair.personnelBasis.sensitive) {
    ensure(rec.personnelRequired === true && item.personnelRequired === true && object(item.personnelEvidence), `${label} personnel-sensitive fair requires the existing Stage 2 personnel evidence`);
  }
  ensure(!contextSensitive || fair.personnelBasis.sensitive, `${label} fair personnel sensitivity contradicts Core context`);
}
function impliedAmerican(value) {
  const odds = Number(String(value).replace('−', '-'));
  return Number.isFinite(odds) && Math.abs(odds) >= 100 ? (odds > 0 ? 100 / (odds + 100) : -odds / (-odds + 100)) : null;
}
function positiveBenchmarkClaim(rec) {
  const text = [rec.edge, rec.contrary, rec.analysis, rec.hist].filter(nonEmpty).join('; ');
  return text.split(/[;.!?]/).some(sentence => {
    if (!/\b(?:Pinnacle|no[- ]vig|benchmark)\b/i.test(sentence)) return false;
    if (/\b(?:not|without|doesn't|does not|isn't|is not)\b|\bno\s+(?!vig\b)/i.test(sentence)) return false;
    return /\b(?:positive\s+(?:no[- ]vig\s+)?edge|favorable\s+(?:no[- ]vig\s+)?(?:edge|benchmark|comparison)|(?:small|positive)\s+no[- ]vig\s+premium|confirms?\s+(?:the\s+)?value|supports?\s+(?:the\s+)?value)\b/i.test(sentence);
  });
}
function benchmarkEvidence(rec, label) {
  const benchmark = rec.pinnacleBenchmark;
  if (benchmark?.state !== 'QUALIFIED') {
    ensure(rec.benchmarkComparison == null, `${label} benchmarkComparison requires a qualified exact-selection Pinnacle benchmark`);
    return;
  }
  ensure(String(benchmark.eventId) === String(rec.feed?.eventId) && benchmark.selectionKey === rec.feed?.selectionKey && benchmark.marketKey === rec.feed?.marketKey, `${label} Pinnacle benchmark identity does not match issued selection`);
  const executable = impliedAmerican(rec.price), probability = benchmark.noVigProbability;
  ensure(executable !== null && Number.isFinite(probability) && probability > 0 && probability < 1, `${label} requires valid executable and benchmark probabilities`);
  const comparison = rec.benchmarkComparison;
  ensure(object(comparison), `${label} qualified benchmark requires benchmarkComparison`);
  const edge = (probability - executable) * 100;
  const direction = Math.abs(edge) <= EPSILON ? 'NEUTRAL' : edge > 0 ? 'FAVORABLE' : 'UNFAVORABLE';
  ensure(close(comparison.executableImpliedProbability, executable) && close(comparison.benchmarkNoVigProbability, probability) && close(comparison.edgeProbabilityPoints, edge) && comparison.direction === direction, `${label} benchmarkComparison must reflect benchmark probability minus executable break-even probability (${direction})`);
  if (direction === 'UNFAVORABLE') ensure(!positiveBenchmarkClaim(rec), `${label} unfavorable Pinnacle comparison cannot be described as positive value or a small no-vig premium`);
}
function leanWording(rec, label) {
  if (rec.status !== 'LEAN') return;
  ensure(zeroStake(rec), `${label} LEAN must carry zero stake`);
  const text = [rec.hist, rec.analysis, rec.edge, rec.support, rec.move].filter(nonEmpty).join('; ');
  ensure(/\b(?:no (?:bet|wager)|no new risk|not (?:a |an? )?(?:approved )?(?:bet|wager)|below BET strength|not (?:large|strong) enough for a wager)\b/i.test(text), `${label} LEAN must explicitly state no wager or below BET strength`);
  for (const sentence of text.split(/[;.!?]/)) {
    if (/\b(?:not|no|would|could|if|unless|once|until)\b/i.test(sentence)) continue;
    ensure(!/\b(?:is playable|playable only at|bet now|place (?:the|a) (?:bet|wager)|wager now)\b/i.test(sentence), `${label} LEAN cannot use affirmative playable/wager instructions`);
  }
}

export function validateRecommendationEvidence(report, rec, item, index) {
  const reportMs = timestamp(report.ts, 'report.ts');
  if (reportMs < Date.parse(REPORT_EVIDENCE_FROM)) return {enforced: false};
  const label = `Recommendation ${index + 1} ${rec?.title || 'UNKNOWN'}`;
  ensure(object(rec) && object(item), `${label} requires report/sidecar recommendation objects`);
  for (const field of REPORT_EVIDENCE_FIELDS) ensure(Object.hasOwn(rec, field) === Object.hasOwn(item, field) && same(rec[field], item[field]), `${label} ${field} drifted between report and sidecar`);
  const sport = canonicalSport(rec.coreAssessment?.context?.sport);
  ensure(SPORTS.has(sport), `${label} requires canonical sport context for source evidence`);
  const identityComplete = nonEmpty(String(rec.feed?.eventId || '')) && nonEmpty(rec.feed?.selectionKey);
  if (!identityComplete) {
    const shortfall = rec.status === 'PASS' && SHORTFALL_REASONS.has(rec.sourceShortfall?.reason) && rec.pinnacleBenchmark?.state !== 'QUALIFIED';
    ensure(shortfall, `${label} requires event and selection identity for evidence`);
    ensure(zeroStake(rec), `${label} identity-shortfall PASS must carry zero stake`);
    ensure(unavailableFair(rec), `${label} identity-shortfall PASS must state unavailable fair without an unsupported numeric estimate`);
  }
  const ids = sourceEvidence(rec, item, sport, reportMs, label);
  fairEvidence(rec, item, ids, label);
  benchmarkEvidence(rec, label);
  leanWording(rec, label);
  return {enforced: true};
}

export function validateReportEvidence(report, sidecar) {
  const reportMs = timestamp(report?.ts, 'report.ts');
  if (reportMs < Date.parse(REPORT_EVIDENCE_FROM)) return {enforced: false, checked: 0};
  ensure(Array.isArray(report.recs) && Array.isArray(sidecar?.recommendations) && report.recs.length === sidecar.recommendations.length, 'Report evidence requires aligned report and sidecar recommendations');
  const errors = [];
  for (let i = 0; i < report.recs.length; i++) {
    try { validateRecommendationEvidence(report, report.recs[i], sidecar.recommendations[i], i); }
    catch (error) { errors.push(error.message); }
  }
  ensure(!errors.length, `Report evidence contains ${errors.length} recommendation defect(s):\n- ${errors.join('\n- ')}`);
  return {enforced: true, checked: report.recs.length};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    ensure(args[0] === 'validate' && args.includes('--report') && args.includes('--sidecar'), 'Usage: report-evidence-gate.mjs validate --report FILE --sidecar FILE');
    const read = key => JSON.parse(fs.readFileSync(args[args.indexOf(key) + 1], 'utf8'));
    const result = validateReportEvidence(read('--report'), read('--sidecar'));
    console.log(`REPORT EVIDENCE GATE OK ${JSON.stringify(result)}`);
  } catch (error) { console.error(`REPORT EVIDENCE ERROR: ${error.message}`); process.exit(1); }
}
