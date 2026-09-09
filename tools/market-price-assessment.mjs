import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {AUTHORITY, QUALIFIED, qualifyMarket, isFullGameAlternateTotalMarket} from './pinnacle-sharp-benchmark.mjs';

// Applies only to new assessments; issued reports keep their original evidence.
export const MARKET_ASSESSMENT_FROM = '2026-09-07T18:31:00-07:00';
export const EXACT_ALTERNATE_TOTALS_FROM = '2026-09-09T16:00:00-07:00';
const EPS = 1e-8;
const nonEmpty = value => typeof value === 'string' && value.trim().length > 0;
const close = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= EPS;
const ensure = (ok, message) => { if (!ok) throw new Error(message); };
export const marketAssessmentEnabled = report => Date.parse(report?.ts) >= Date.parse(MARKET_ASSESSMENT_FROM);

export function loadBoundMarketObserver(sidecar, root) {
  const p = sidecar?.provenance;
  ensure(p?.pinnacleObserverPath === 'data/oddspapi-observer.json' && /^[a-f0-9]{40}$/i.test(p.pinnacleObserverBlobSha || ''), 'Market assessment requires pinned Pinnacle observer provenance');
  let raw;
  try { raw = execFileSync('git', ['cat-file', 'blob', p.pinnacleObserverBlobSha], {cwd: root, maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore']}); }
  catch { raw = fs.readFileSync(path.join(root, p.pinnacleObserverPath)); }
  const sha = crypto.createHash('sha1').update(Buffer.from(`blob ${raw.length}\0`)).update(raw).digest('hex');
  ensure(sha === p.pinnacleObserverBlobSha, 'Market assessment observer differs from pinned blob');
  return JSON.parse(raw);
}

// Main lines retain their original behavior. Future assessments can also use
// the exact full-game alternate total; never substitute another line or period.
export function exactMarketReference(report, quote, observer) {
  ensure(observer?.schema === 3 && observer.mode === 'official-sharp-benchmark' && observer.status === 'ok' && observer.authoritative === true && observer.benchmarkAuthority === AUTHORITY && observer.executionAuthority === false, 'Market assessment requires an official available Pinnacle observer');
  const age = (Date.parse(report.ts) - Date.parse(observer.generatedAt)) / 60000;
  ensure(Number.isFinite(age) && age >= -5 && age <= 75, 'Market assessment Pinnacle observer is stale');
  const fixtures = (observer.fixtures || []).filter(f => String(f.primaryMatch?.eventId) === String(quote.eventId));
  ensure(fixtures.length === 1, 'Market assessment requires one exact matched event');
  const fixture = fixtures[0], pinnacle = fixture.pinnacle;
  ensure(Date.parse(fixture.startTime) === Date.parse(quote.eventDate) && Date.parse(fixture.startTime) > Date.parse(report.ts), 'Market assessment event time differs or event has started');
  const suffix = {ml: 'moneyline', spread: 'spreads', totals: 'totals'}[quote.marketKey];
  ensure(suffix, 'Market assessment supports full-game two-way primary markets only');
  const matches = [];
  for (const market of pinnacle?.markets || []) {
    const exactAlternate = quote.marketKey === 'totals' && Date.parse(report.ts) >= Date.parse(EXACT_ALTERNATE_TOTALS_FROM) && isFullGameAlternateTotalMarket(market);
    if (!exactAlternate && !new RegExp(`^line/[^/]+/[^/]+/[^/]+/[^/]+/0/${suffix}$`).test(market.bookmakerMarketId || '')) continue;
    const qualified = qualifyMarket({market, generatedAt: observer.generatedAt, primaryMatch: fixture.primaryMatch, bookmakerIsActive: pinnacle.bookmakerIsActive === true, suspended: pinnacle.suspended === true, quoteObservationVersion: observer.quoteObservationVersion, ...(exactAlternate ? {exactTotalLine: quote.line} : {})});
    if (qualified.state !== QUALIFIED) continue;
    const rows = qualified.pairedOutcomes;
    const expectedSides = quote.marketKey === 'totals' ? ['over', 'under'] : ['home', 'away'];
    const decoded = rows.map(row => {
      const parts = row.bookmakerOutcomeId.split('/');
      if (quote.marketKey === 'ml') return {row, side: parts.length === 1 ? parts[0] : null, line: null};
      return {row, side: parts.length === 2 ? parts[1] : null, line: parts.length === 2 ? Number(parts[0]) : NaN};
    });
    if (decoded.length !== 2 || !expectedSides.every(side => decoded.some(d => d.side === side))) continue;
    if (!decoded.every(d => quote.marketKey === 'ml' ? quote.line == null : close(d.line, Number(quote.line)))) continue;
    const selected = decoded.find(d => d.side === quote.side), opposite = decoded.find(d => d.side !== quote.side);
    if (selected && opposite) matches.push({fixtureId: fixture.fixtureId, bookmakerMarketId: market.bookmakerMarketId, ...(exactAlternate ? {referenceKind: 'EXACT_FULL_GAME_ALTERNATE_TOTAL'} : {}), selected: selected.row, opposite: opposite.row, generatedAt: observer.generatedAt});
  }
  ensure(matches.length === 1, 'Market assessment requires one qualified exact full-game paired reference');
  return matches[0];
}

export function marketComparison(priceDecimal, probability) {
  ensure(Number.isFinite(priceDecimal) && priceDecimal > 1 && probability > 0 && probability < 1, 'Market comparison requires valid decimal price and probability');
  const edge = (probability - 1 / priceDecimal) * 100;
  return {executableImpliedProbability: 1 / priceDecimal, benchmarkNoVigProbability: probability, edgeProbabilityPoints: edge, direction: Math.abs(edge) <= EPS ? 'NEUTRAL' : edge > 0 ? 'FAVORABLE' : 'UNFAVORABLE'};
}

export function validateMarketAssessment(report, rec, item, ids) {
  if (rec.marketAssessment == null) return false;
  const label = `Market assessment ${rec.title || rec.feed?.selectionKey}`, m = rec.marketAssessment;
  ensure(marketAssessmentEnabled(report), `${label} predates the completion amendment`);
  ensure(m?.schema === 1 && m.basis === 'QUALIFIED_PINNACLE', `${label} requires the qualified reference basis`);
  ensure(['PASS', 'LEAN', 'WAIT'].includes(rec.status) && /^\$?0(?:\.0+)?$/.test(String(rec.stake)), `${label} cannot authorize BET or stake`);
  ensure(rec.playTo === 'NO BET' && !rec.priceWatch, `${label} cannot create a wagering threshold or price watch`);
  ensure(rec.fairValueEvidence == null, `${label} must keep market reference separate from independent fair evidence`);
  ensure(rec.coreAssessment?.context?.fairValueBasis === 'MARKET_DERIVED_ONLY', `${label} must retain MARKET_DERIVED_ONLY Core classification`);
  ensure(rec.coreAssessment.context.directCalibration !== 'DIRECT', `${label} cannot claim direct model calibration from a market reference`);
  ensure(m.selectionKey === rec.feed?.selectionKey && m.probabilityBasis === 'CONDITIONAL_ON_NO_PUSH', `${label} requires exact selection and conditional settlement basis`);
  const b = rec.pinnacleBenchmark;
  ensure(b?.state === QUALIFIED && b.authority === AUTHORITY && b.executionAuthority === false, `${label} requires qualified non-executable Pinnacle evidence`);
  ensure(close(m.referenceProbability, b.noVigProbability) && close(m.referencePriceDecimal, 1 / b.noVigProbability), `${label} reference arithmetic differs from benchmark`);
  ensure(String(rec.fair).startsWith('Market reference: ') && String(rec.fair).includes(`${b.noVigPriceAmerican}`), `${label} must label the displayed market reference`);
  ensure(m.referenceSourceIds?.length > 0 && m.referenceSourceIds.every(id => ids.get(id)?.kind === 'MARKET'), `${label} requires source-linked reference evidence`);
  ensure(nonEmpty(m.settlementRationale) && nonEmpty(m.limitations) && nonEmpty(m.decisionRationale), `${label} requires settlement, limitations and decision rationale`);
  const review = m.informationReview;
  ensure(review && Number.isFinite(Date.parse(review.checkedAt)) && Date.parse(review.checkedAt) >= Date.parse(report.feedGeneratedAt) && Date.parse(review.checkedAt) <= Date.parse(report.ts), `${label} requires a current information review`);
  ensure(review.sourceIds?.length > 0 && review.sourceIds.every(id => ['OFFICIAL', 'REPORTING'].includes(ids.get(id)?.kind)), `${label} requires roster/lineup/news source evidence`);
  ensure(['NO_MATERIAL_CONFLICT', 'MATERIAL_REVIEW_COMPLETED', 'UNRESOLVED'].includes(review.state) && nonEmpty(review.impact), `${label} requires information state and decision impact`);
  if (rec.status === 'LEAN') ensure(rec.benchmarkComparison?.direction === 'FAVORABLE' && review.state !== 'UNRESOLVED', `${label} LEAN requires favorable price and resolved material information`);
  if (rec.status === 'WAIT') ensure(rec.waitQualification?.actionableIfResolved === true && rec.waitQualification.independentSignals?.length > 0, `${label} WAIT requires the existing actionable trigger and independent signal`);
  const expected = marketComparison(Number(rec.feed.priceDecimal), b.noVigProbability);
  ensure(Object.keys(expected).every(key => typeof expected[key] === 'number' ? close(expected[key], rec.benchmarkComparison?.[key]) : expected[key] === rec.benchmarkComparison?.[key]), `${label} comparison must use the exact decimal execution price`);
  return true;
}

export function validateBoundMarketAssessment(report, rec, observer) {
  const reference = exactMarketReference(report, rec.feed, observer), b = rec.pinnacleBenchmark;
  if (reference.referenceKind) {
    ensure(b.referenceKind === reference.referenceKind && b.bookmakerMarketId === reference.bookmakerMarketId, 'Market assessment requires exact alternate-total source identity');
  } else ensure(b.referenceKind === undefined && b.bookmakerMarketId === undefined, 'Market assessment alternate-total source identity differs from bound observer');
  for (const field of ['noVigProbability', 'noVigPriceAmerican', 'quoteChangedAt', 'limit']) ensure(b[field] === reference.selected[field], `Market assessment ${field} differs from bound observer`);
  if(b.quoteObservedAt!==undefined) ensure(b.quoteObservedAt===reference.selected.quoteObservedAt, 'Market assessment quoteObservedAt differs from bound observer');
  ensure(String(b.price) === String(reference.selected.priceAmerican) && String(b.pairedPrice) === String(reference.opposite.priceAmerican), 'Market assessment paired prices differ from bound observer');
  ensure(rec.marketAssessment.referenceGeneratedAt === reference.generatedAt, 'Market assessment reference timestamp differs from bound observer');
  return reference;
}
