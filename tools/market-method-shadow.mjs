#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { exactMarketReference } from './market-price-assessment.mjs';

export const MARKET_METHOD_CONFIG = Object.freeze(JSON.parse(fs.readFileSync(new URL('../research/market-method-shadow-v1.json', import.meta.url), 'utf8')));
const list = value => Array.isArray(value) ? value : [];
const normBook = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const finiteTime = value => { const result = Date.parse(value || ''); return Number.isFinite(result) ? result : null; };
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const sameNumber = (a, b) => typeof a === 'number' && typeof b === 'number' && Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1e-8;
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
export const marketMethodRuleHash = config => crypto.createHash('sha256').update(JSON.stringify(stable(config))).digest('hex');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));

function pacificDate(time, timezone) {
  if (finiteTime(time) === null) return null;
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(time));
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)?.value).join('-');
}

function recent(earlier, later, maxMinutes) {
  const a = finiteTime(earlier), b = finiteTime(later);
  return a !== null && b !== null && b >= a && b - a <= maxMinutes * 60000;
}

function exactKey(selection, quote) {
  const eventDate = finiteTime(selection.eventDate) === null ? selection.eventDate : new Date(selection.eventDate).toISOString();
  return JSON.stringify([selection.sport, String(selection.eventId), eventDate, 'FULL_GAME', quote.marketKey, quote.line ?? null]);
}

function settlementFor(report, decision, quote, selection, sidecar) {
  const assessment = decision.marketAssessment || decision.marketMethodReview;
  if (assessment?.probabilityBasis === 'CONDITIONAL_ON_NO_PUSH' && nonempty(assessment.settlementRationale) && (!assessment.selectionKey || assessment.selectionKey === quote.selectionKey)) {
    return { settlementRationale: assessment.settlementRationale, settlementEvidence: { origin: 'EXACT_MARKET_ASSESSMENT', probabilityBasis: 'CONDITIONAL_ON_NO_PUSH' } };
  }
  const evidence = sidecar?.forecastEvidence || {}, adopted = list(decision.fairValueEvidence?.forecastRecordIds);
  const rawLine = quote.marketKey === 'spread' && quote.side === 'away' ? -quote.line : quote.line;
  const accepted = [];
  for (const id of adopted) {
    const matches = list(evidence.records).filter(record => record.recordId === id);
    if (!matches.length || new Set(matches.map(record => JSON.stringify(stable(record)))).size !== 1) continue;
    const record = matches[0];
    if (String(record.eventId) !== String(quote.eventId) || normalizedSport(record.sport) !== normalizedSport(selection.sport) || finiteTime(record.startTime) !== finiteTime(selection.eventDate) || record.marketDetail !== selection.marketDetail || record.period !== 'FULL_GAME' || record.side !== quote.side || !/^https?:\/\//i.test(record.url || '') || (rawLine === null ? record.line !== null : !sameNumber(record.line, rawLine))) continue;
    const currentReviews = list(evidence.revalidations).filter(row => row.recordId === id && finiteTime(row.forReportAt) === finiteTime(report.ts)).sort((a, b) => finiteTime(b.checkedAt) - finiteTime(a.checkedAt));
    const review = currentReviews[0] || (finiteTime(record.applicability?.forReportAt) === finiteTime(report.ts) ? record.applicability : null);
    const settlement = record.settlement;
    if (!review || review.eventMatch !== true || review.freshnessStatus !== 'CURRENT' || review.settlementMatch !== true || !nonempty(review.settlementRationale) || !recent(report.feedGeneratedAt, review.checkedAt, 75) || !recent(review.checkedAt, report.ts, 75) || finiteTime(record.observedAt) === null || finiteTime(record.observedAt) > finiteTime(review.checkedAt)) continue;
    if (!['UNCONDITIONAL', 'CONDITIONAL_ON_NO_PUSH'].includes(record.probabilityBasis) || typeof settlement?.includesOvertime !== 'boolean' || !['NO_PUSH', 'REFUND'].includes(settlement?.pushRule)) continue;
    if (quote.marketKey !== 'ml' && Number.isInteger(rawLine) && settlement.pushRule !== 'REFUND') continue;
    accepted.push({ recordId: id, sourceUrl: record.url || null, checkedAt: review.checkedAt, probabilityBasis: record.probabilityBasis, ...settlement, rationale: review.settlementRationale });
  }
  if (!accepted.length || new Set(accepted.map(row => `${row.includesOvertime}|${row.pushRule}`)).size !== 1) return { reason: 'SETTLEMENT_COMPATIBILITY_UNRECORDED' };
  return { settlementRationale: accepted.map(row => row.rationale).join(' '), settlementEvidence: { origin: 'ADOPTED_EXACT_FORECAST_SETTLEMENT', records: accepted } };
}

function informationFor(report, decision, quote, receipt, selection, sidecar) {
  if (!decision || decision.feed?.selectionKey !== quote.selectionKey || String(decision.feed?.eventId) !== String(quote.eventId)) return { reason: 'EXACT_INFORMATION_REVIEW_MISSING' };
  const assessment = decision.marketAssessment;
  const candidateReview = receipt?.candidateAssessment, p = candidateReview?.personnel;
  const personnel = decision.personnelEvidence || receipt?.evidence?.personnelEvidence || receipt?.candidateDraft?.evidence?.personnelEvidence;
  const info = assessment?.informationReview || decision.marketMethodReview?.informationReview;
  const discrepancy = info?.state === 'UNRESOLVED' || decision.coreAssessment?.context?.personnelSensitivity === 'UNRESOLVED' || ['PARTIAL', 'UNKNOWN'].includes(personnel?.personnelState) || list(personnel?.unresolved).length > 0;
  let review = info;
  if (p) {
    if (candidateReview.schema !== 1 || candidateReview.selectionId !== selection.selectionId || !['RESOLVED', 'NOT_MATERIAL'].includes(p.state) || !nonempty(p.rationale)) return { reason: 'MATERIAL_INFORMATION_UNRESOLVED' };
    const binding = candidateReview.quote;
    if (!binding || ['eventId', 'marketKey', 'side', 'selectionKey'].some(field => String(binding[field]) !== String(decision.feed?.[field])) || (quote.line === null ? binding.line !== null : !sameNumber(binding.line, quote.line))) return { reason: 'INFORMATION_REVIEW_IDENTITY_MISMATCH' };
    if (discrepancy && (!nonempty(p.materialityExplanation) || !nonempty(p.remainingUncertainty))) return { reason: 'PERSONNEL_MATERIALITY_DISTINCTION_REQUIRED' };
    review = { state: 'MATERIAL_REVIEW_COMPLETED', personnelState: p.state, checkedAt: candidateReview.checkedAt, sourceIds: list(p.sourceIds), impact: p.rationale,
      discrepancy, materialityExplanation: p.materialityExplanation || null, remainingUncertainty: p.remainingUncertainty || null, origin: 'CANDIDATE_ASSESSMENT_PERSONNEL' };
  } else if (discrepancy) return { reason: 'MATERIAL_INFORMATION_UNRESOLVED' };
  const sources = new Map([...list(receipt?.evidence?.sourceEvidence), ...list(receipt?.candidateDraft?.evidence?.sourceEvidence), ...list(decision.sourceEvidence)].map(source => [source.id, source]));
  if (!review || !['NO_MATERIAL_CONFLICT', 'MATERIAL_REVIEW_COMPLETED'].includes(review.state) || !nonempty(review.impact)) return { reason: 'MATERIAL_INFORMATION_UNRESOLVED' };
  if (!recent(report.feedGeneratedAt, review.checkedAt, 75) || !recent(review.checkedAt, report.ts, 75)) return { reason: 'INFORMATION_REVIEW_NOT_CURRENT' };
  if (!list(review.sourceIds).length || !review.sourceIds.every(id => {
    const source = sources.get(id);
    return source && ['OFFICIAL', 'REPORTING'].includes(source.kind) && nonempty(source.url) && nonempty(source.finding) && String(source.eventId) === String(quote.eventId) && recent(report.feedGeneratedAt, source.checkedAt, 75) && recent(source.checkedAt, report.ts, 75);
  })) return { reason: 'INFORMATION_SOURCE_BINDING_MISSING' };
  if (personnel?.sourceConflict && personnel.sourceConflict !== 'NONE' && !nonempty(personnel.conflictResolution)) return { reason: 'MATERIAL_INFORMATION_CONFLICT' };
  const settlement = settlementFor(report, decision, quote, selection, sidecar);
  if (settlement.reason) return settlement;
  return { review: structuredClone(review), sourceEvidence: review.sourceIds.map(id => structuredClone(sources.get(id))), ...settlement };
}

function titleForQuote(decision, quote) {
  if (quote.marketKey === 'totals') return `${quote.side === 'over' ? 'Over' : 'Under'} ${quote.line}`;
  const label = decision?.feed?.label || (decision?.feed?.selectionKey === quote.selectionKey ? String(decision.title || '').replace(/\s+[+-]?\d+(?:\.\d+)?\s*$/, '') : null) || (quote.side === 'home' ? 'Home' : 'Away');
  if (quote.marketKey === 'spread') {
    const line = quote.side === 'away' ? -quote.line : quote.line;
    return `${label} ${line > 0 ? '+' : ''}${line}`;
  }
  return label;
}

/** Pure prospective snapshot. Universe must be the inventory derived from the bound feed. */
export function buildMarketMethodShadow({ report, sidecar, universe, observer, config = MARKET_METHOD_CONFIG } = {}) {
  const ruleHash = marketMethodRuleHash(config);
  const reportMs = finiteTime(report?.ts);
  const snapshot = {
    schema: 1, kind: 'market-method-shadow-snapshot', methodVersion: config.methodVersion, ruleHash,
    activationAt: config.activationAt, generatedAt: report?.ts || null,
    sourceRun: sidecar?.reportReference?.reportPath || null,
    cohortDate: pacificDate(report?.ts, config.timezone),
    mode: reportMs !== null && reportMs >= finiteTime(config.activationAt) ? 'PROSPECTIVE' : 'DEVELOPMENT_REPLAY',
    authority: 'HYPOTHETICAL_ONLY', executionAuthority: false, decisionAuthority: false,
    feedGeneratedAt: report?.feedGeneratedAt || null,
    feedBlobSha: sidecar?.provenance?.feedBlobSha || null,
    pinnacleObserverBlobSha: sidecar?.provenance?.pinnacleObserverBlobSha || null,
    candidates: [], exclusions: [], summary: {},
    limitations: ['A quote observed in the bound feed is not proof of an actual fill.', 'Pinnacle no-vig is a market estimate conditional on no push, not independently established true probability.', 'No actual wager or change to report grades or stakes.']
  };
  const exclude = (selection, quote, reason, detail = null) => snapshot.exclusions.push({ selectionId: selection?.selectionId || null, selectionKey: quote?.selectionKey || null, exactMarketKey: quote && selection ? exactKey(selection, quote) : null, book: quote?.book || null, reason, ...(detail ? { detail } : {}) });
  if (!Array.isArray(universe?.selections)) {
    exclude(null, null, 'BOUND_SELECTION_UNIVERSE_MISSING');
    snapshot.summary = { availableSelections: null, qualifyingMarkets: 0, excludedQuotes: 1 };
    return snapshot;
  }
  if (!snapshot.sourceRun || !/^[a-f0-9]{40}$/i.test(snapshot.feedBlobSha || '') || !/^[a-f0-9]{40}$/i.test(snapshot.pinnacleObserverBlobSha || '') || sidecar?.reportReference?.ts !== report?.ts || sidecar?.reportReference?.feedGeneratedAt !== report?.feedGeneratedAt) {
    exclude(null, null, 'IMMUTABLE_REPORT_PROVENANCE_MISSING');
    snapshot.summary = { availableSelections: universe.selections.length, qualifyingMarkets: 0, excludedQuotes: 1 };
    return snapshot;
  }
  const receipts = new Map(list(sidecar?.primaryAnalysis?.receipts).map(receipt => [receipt.selectionId, receipt]));
  const cards = new Map(list(report?.recs).map(card => [card.feed?.selectionKey, card]));
  const groups = new Map();
  for (const selection of universe.selections) {
    if (!list(selection.quotes).length) exclude(selection, null, 'EXECUTION_QUOTE_MISSING');
    for (const rawQuote of list(selection.quotes)) {
      const quote = { ...rawQuote, eventDate: selection.eventDate };
      const key = exactKey(selection, quote);
      if (!groups.has(key)) groups.set(key, { availableSides: new Set(), qualified: [] });
      const group = groups.get(key);
      const selectedParts = String(quote.selectionKey || '').split('|');
      const sides = quote.marketKey === 'totals' ? ['over', 'under'] : ['home', 'away'];
      if (!config.marketKeys.includes(quote.marketKey) || !sides.includes(quote.side) || String(selection.eventId) !== String(quote.eventId) || selection.side !== quote.side || selectedParts[0] !== String(quote.eventId) || selectedParts[1] !== quote.marketKey || selectedParts[2] !== quote.side || !selection.marketDetail?.startsWith('full_game_') || (quote.marketKey === 'ml' ? quote.line !== null : !Number.isFinite(quote.line) || !Number.isInteger(quote.line * 2))) { exclude(selection, quote, 'IDENTITY_OR_SCOPE_UNSUPPORTED'); continue; }
      if (!config.executionBooks.some(book => normBook(book) === normBook(quote.book)) || !Number.isFinite(quote.priceDecimal) || quote.priceDecimal <= 1) { exclude(selection, quote, 'EXECUTION_PRICE_INVALID'); continue; }
      if (reportMs === null || finiteTime(selection.eventDate) === null || finiteTime(selection.eventDate) <= reportMs) { exclude(selection, quote, 'EVENT_STARTED_OR_TIME_INVALID'); continue; }
      if (!recent(report.feedGeneratedAt, report.ts, config.maximumFeedAgeMinutes) || !recent(quote.quoteObservedAt || quote.quoteUpdatedAt, report.feedGeneratedAt, config.maximumQuoteAgeMinutes)) { exclude(selection, quote, 'EXECUTION_QUOTE_STALE_OR_FUTURE'); continue; }
      group.availableSides.add(quote.side);
      const receipt = receipts.get(selection.selectionId);
      const decision = receipt?.decision || receipt?.candidateDraft?.decision || cards.get(quote.selectionKey);
      const information = informationFor(report, decision, quote, receipt, selection, sidecar);
      if (information.reason) { exclude(selection, quote, information.reason); continue; }
      if (finiteTime(observer?.generatedAt) === null || finiteTime(observer.generatedAt) > reportMs) { exclude(selection, quote, 'PINNACLE_OBSERVATION_AFTER_ENTRY_OR_INVALID'); continue; }
      let reference;
      try { reference = exactMarketReference(report, quote, observer); }
      catch (error) { exclude(selection, quote, 'QUALIFIED_EXACT_PINNACLE_PAIR_UNAVAILABLE', error.message); continue; }
      const p = reference.selected.noVigProbability;
      const edgeProbabilityPoints = (p - 1 / quote.priceDecimal) * 100;
      if (!(edgeProbabilityPoints > config.minimumEdgeProbabilityPointsExclusive + config.numericTolerance)) { exclude(selection, quote, 'NO_POSITIVE_PRICE_DISCREPANCY'); continue; }
      group.qualified.push({
        selectionId: selection.selectionId, selectionKey: quote.selectionKey, exactMarketKey: key,
        eventId: String(selection.eventId), eventDate: selection.eventDate, sport: selection.sport,
        marketKey: quote.marketKey, marketDetail: selection.marketDetail, side: quote.side, line: quote.line,
        title: titleForQuote(decision, quote), issuedStatus: cards.get(quote.selectionKey)?.status || null,
        informationEvidenceOrigin: receipt?.candidateDraft?.decision === decision ? 'UNISSUED_INCOMPLETE_DRAFT_ONLY' : 'CURRENT_ASSESSMENT',
        status: 'HYPOTHETICAL_ONLY', hypotheticalUnits: config.hypotheticalUnits,
        quote: { ...quote, obtainableBasis: 'BOUND_FRESH_EXECUTION_FEED', snapshotGeneratedAt: report.feedGeneratedAt, snapshotBlobSha: snapshot.feedBlobSha },
        reference: { ...reference, probabilityBasis: config.probabilityBasis, executionAuthority: false },
        edgeProbabilityPoints, conditionalEvPerResolvedUnit: p * quote.priceDecimal - 1,
        unconditionalExpectedReturn: null,
        informationReview: information.review, informationSources: information.sourceEvidence,
        settlementRationale: information.settlementRationale, settlementEvidence: information.settlementEvidence,
        entryRule: 'FIRST_QUALIFYING_EXACT_MARKET_PER_PACIFIC_DAY'
      });
    }
  }
  for (const group of groups.values()) {
    group.qualified.sort((a, b) => b.edgeProbabilityPoints - a.edgeProbabilityPoints || a.selectionKey.localeCompare(b.selectionKey) || normBook(a.quote.book).localeCompare(normBook(b.quote.book)));
    if (group.availableSides.size !== 2) {
      for (const row of group.qualified) exclude(row, row.quote, 'OPPOSING_EXECUTION_SIDE_UNAVAILABLE');
      continue;
    }
    if (group.qualified.length) snapshot.candidates.push(group.qualified[0]);
    for (const row of group.qualified.slice(1)) exclude(row, row.quote, 'STRONGER_QUALIFIED_SIDE_OR_BOOK_SELECTED');
  }
  snapshot.candidates.sort((a, b) => a.exactMarketKey.localeCompare(b.exactMarketKey));
  snapshot.summary = { availableSelections: universe.selections.length, qualifyingMarkets: snapshot.candidates.length, excludedQuotes: snapshot.exclusions.length, exclusionReasons: counts(snapshot.exclusions.map(row => row.reason)) };
  return snapshot;
}

function counts(values) { const result = {}; for (const value of values) result[value] = (result[value] || 0) + 1; return result; }

function netUnits(grade, decimal) {
  if (!(decimal > 1)) return null;
  return ({ WIN: decimal - 1, LOSS: -1, PUSH: 0, VOID: 0 })[grade] ?? null;
}

function rowMatches(candidate, row) {
  const issued = row?.issued;
  if (row?.selectionKey !== candidate.selectionKey || normBook(issued?.analysisBook || row.book) !== normBook(candidate.quote.book)) return false;
  const line = candidate.marketKey === 'spread' && candidate.side === 'away' ? -candidate.line : candidate.line;
  return issued?.marketKey === candidate.marketKey && issued?.side === candidate.side && (line === null ? issued?.selectedLine === null : sameNumber(issued?.selectedLine, line));
}

function verifiedCompletion(completion, eventId, eventDate) {
  return completion?.state === 'complete' && completion?.verificationState === 'verified' && String(completion.eventId) === String(eventId) && finiteTime(completion.verifiedAt) !== null && finiteTime(completion.verifiedAt) >= finiteTime(eventDate) && nonempty(completion.source?.url);
}

const normalizedSport = sport => ['NBA', 'WNBA', 'NBA/WNBA'].includes(sport) ? 'NBA_WNBA' : sport;
const detailMarketKey = detail => !String(detail || '').startsWith('full_game_') ? null : /moneyline/.test(detail) ? 'ml' : /spread|run_line|puck_line/.test(detail) ? 'spread' : /total/.test(detail) ? 'totals' : null;

// Reuse only existing verified full-game scores with independently bound source
// report identity. This grades the frozen contract; it never selects an entry.
function replayVerifiedScore(candidate, observations, config) {
  const unresolved = reason => ({ state: 'unresolved', reason });
  if (!list(config.scoreReplaySports).includes(candidate.sport)) return unresolved('SCORE_REPLAY_SPORT_UNSUPPORTED');
  const sources = [];
  for (const doc of observations) for (const row of list(doc.recommendations)) {
    const context = row.marketMethodSourceContext, completion = row.completion;
    if (!verifiedCompletion(completion, candidate.eventId, candidate.eventDate) || completion.grade === 'VOID') continue;
    if (!context || normalizedSport(context.sport) !== candidate.sport || context.eventId !== candidate.eventId || finiteTime(context.eventDate) !== finiteTime(candidate.eventDate) || detailMarketKey(context.marketDetail) !== candidate.marketKey || context.selectionKey !== row.selectionKey || context.marketKey !== candidate.marketKey) continue;
    if (!['final_score', 'final_score_asian_handicap', 'final_score_asian_total'].includes(completion.settlementMethod)) continue;
    const score = completion.finalScore;
    if (!Number.isFinite(score?.homeScore) || !Number.isFinite(score?.awayScore) || score.homeScore < 0 || score.awayScore < 0) continue;
    sources.push({ sourceRun: doc.sourceRun, selectionKey: row.selectionKey, verifiedAt: completion.verifiedAt, source: structuredClone(completion.source), finalScore: structuredClone(score) });
  }
  if (!sources.length) return unresolved('VERIFIED_EXACT_SETTLEMENT_OR_COMPATIBLE_SCORE_MISSING');
  if (new Set(sources.map(row => `${row.finalScore.homeScore}|${row.finalScore.awayScore}`)).size !== 1) return { ...unresolved('VERIFIED_FINAL_SCORE_CONFLICT'), sourceObservations: sources };
  const score = sources[0].finalScore;
  let margin;
  if (candidate.marketKey === 'ml') {
    if (!['home', 'away'].includes(candidate.side) || candidate.line !== null) return unresolved('SCORE_REPLAY_CONTRACT_UNSUPPORTED');
    if (score.homeScore === score.awayScore) return { ...unresolved('TIE_SETTLEMENT_UNVERIFIED'), sourceObservations: sources };
    margin = candidate.side === 'home' ? score.homeScore - score.awayScore : score.awayScore - score.homeScore;
  } else if (candidate.marketKey === 'spread') {
    if (!['home', 'away'].includes(candidate.side) || !Number.isFinite(candidate.line) || !Number.isInteger(candidate.line * 2)) return unresolved('SCORE_REPLAY_CONTRACT_UNSUPPORTED');
    margin = candidate.side === 'home' ? score.homeScore + candidate.line - score.awayScore : score.awayScore - candidate.line - score.homeScore;
  } else if (candidate.marketKey === 'totals') {
    if (!['over', 'under'].includes(candidate.side) || !Number.isFinite(candidate.line) || !Number.isInteger(candidate.line * 2)) return unresolved('SCORE_REPLAY_CONTRACT_UNSUPPORTED');
    margin = (score.homeScore + score.awayScore - candidate.line) * (candidate.side === 'over' ? 1 : -1);
  } else return unresolved('SCORE_REPLAY_CONTRACT_UNSUPPORTED');
  const grade = Math.abs(margin) <= config.numericTolerance ? 'PUSH' : margin > 0 ? 'WIN' : 'LOSS';
  return { state: 'settled', grade, netUnits: netUnits(grade, candidate.quote.priceDecimal), settlementMethod: 'VERIFIED_FULL_GAME_SCORE_REPLAY', finalScore: score, sourceObservations: sources };
}

function observedDiagnostics(candidate, snapshot, doc, row, config) {
  const observation = row?.observation;
  const absent = reason => ({ state: 'unavailable', reason, verifiedClosingLine: false });
  if (!rowMatches(candidate, row)) return absent('NO_EXACT_SAME_BOOK_OBSERVATION');
  if (observation?.state !== 'observed_exact' || observation.marketKey !== candidate.marketKey || !(Number.isFinite(observation.priceDecimal) && observation.priceDecimal > 1)) return absent(observation?.reason || 'LATER_QUOTE_UNAVAILABLE');
  const time = finiteTime(observation.snapshotGeneratedAt);
  if (time === null || time <= finiteTime(snapshot.generatedAt) || time >= finiteTime(candidate.eventDate) || !recent(observation.quoteObservedAt || observation.quoteUpdatedAt, observation.snapshotGeneratedAt, config.maximumQuoteAgeMinutes)) return absent('COMPARISON_NOT_FRESH_AFTER_ENTRY_BEFORE_START');
  const verifiedClosingLine = doc?.method?.closingLine === true && observation.verifiedClosingLine === true;
  return { state: 'observed_exact', label: verifiedClosingLine ? 'Verified closing price' : 'Last observed pre-start price; not a verified closing line', verifiedClosingLine,
    book: candidate.quote.book, snapshotGeneratedAt: observation.snapshotGeneratedAt, snapshotBlobSha: observation.snapshotBlobSha || null,
    quoteObservedAt: observation.quoteObservedAt || null, quoteUpdatedAt: observation.quoteUpdatedAt || null,
    priceDecimal: observation.priceDecimal, entryPriceDecimal: candidate.quote.priceDecimal,
    entryVsLaterPricePct: (candidate.quote.priceDecimal / observation.priceDecimal - 1) * 100,
    beatLaterPrice: candidate.quote.priceDecimal > observation.priceDecimal + config.numericTolerance,
    noVigClosingEdge: null };
}

/** Re-evaluates outcomes only; never chooses a new entry or changes a snapshot. */
export function evaluateMarketMethodShadow({ snapshots = [], observations = [], config = MARKET_METHOD_CONFIG } = {}) {
  const expectedHash = marketMethodRuleHash(config), rows = [], skipped = [], seen = new Set();
  const docs = new Map(list(observations).map(doc => [doc.sourceRun, doc]));
  const sorted = [...snapshots].sort((a, b) => (finiteTime(a.generatedAt) ?? Infinity) - (finiteTime(b.generatedAt) ?? Infinity) || String(a.sourceRun).localeCompare(String(b.sourceRun)));
  for (const snapshot of sorted) {
    if (snapshot.mode !== 'PROSPECTIVE' || snapshot.methodVersion !== config.methodVersion || snapshot.ruleHash !== expectedHash || finiteTime(snapshot.generatedAt) === null || finiteTime(snapshot.generatedAt) < finiteTime(config.activationAt) || snapshot.cohortDate !== pacificDate(snapshot.generatedAt, config.timezone)) {
      skipped.push({ sourceRun: snapshot.sourceRun || null, reason: snapshot.mode === 'DEVELOPMENT_REPLAY' ? 'DEVELOPMENT_REPLAY_NOT_VALIDATION' : 'METHOD_OR_PROSPECTIVE_BINDING_INVALID' }); continue;
    }
    for (const candidate of list(snapshot.candidates)) {
      const key = `${snapshot.cohortDate}|${candidate.exactMarketKey}`;
      if (seen.has(key)) { skipped.push({ sourceRun: snapshot.sourceRun, selectionKey: candidate.selectionKey, reason: 'REPEATED_EXACT_MARKET_DAY' }); continue; }
      seen.add(key);
      const doc = docs.get(snapshot.sourceRun), matching = list(doc?.recommendations).filter(row => rowMatches(candidate, row));
      const observed = matching.length === 1 ? matching[0] : null;
      const completion = observed?.completion;
      const verified = verifiedCompletion(completion, candidate.eventId, candidate.eventDate);
      const score = completion?.finalScore;
      const ambiguousTie = candidate.marketKey === 'ml' && Number.isFinite(score?.homeScore) && score.homeScore === score.awayScore && String(completion?.settlementMethod || '').startsWith('final_score');
      const result = verified && !ambiguousTie ? netUnits(completion.grade, candidate.quote.priceDecimal) : null;
      rows.push({ ...structuredClone(candidate), sourceRun: snapshot.sourceRun, capturedAt: snapshot.generatedAt, cohortDate: snapshot.cohortDate,
        sampleKey: key, result: ambiguousTie ? { state: 'unresolved', reason: 'TIE_SETTLEMENT_UNVERIFIED' } : result === null ? replayVerifiedScore(candidate, observations, config) : { state: 'settled', grade: completion.grade, netUnits: result, verifiedAt: completion.verifiedAt, source: structuredClone(completion.source), settlementMethod: 'VERIFIED_EXACT_SAME_BOOK_OBSERVATION' },
        priceDiagnostic: observedDiagnostics(candidate, snapshot, doc, observed, config) });
    }
  }
  const settled = rows.filter(row => row.result.state === 'settled');
  const priceRows = rows.filter(row => row.priceDiagnostic.state === 'observed_exact');
  const total = settled.reduce((sum, row) => sum + row.result.netUnits, 0);
  return { schema: 1, kind: 'market-method-shadow-evaluation', methodVersion: config.methodVersion, ruleHash: expectedHash, activationAt: config.activationAt,
    authority: 'HYPOTHETICAL_ONLY', decisionAuthority: false, executionAuthority: false,
    summary: { samples: rows.length, uniqueEvents: new Set(rows.map(row => row.eventId)).size, settled: settled.length, unresolved: rows.length - settled.length,
      grades: counts(settled.map(row => row.result.grade)), netUnits: total, hypotheticalUnitsPerSample: 1,
      settledUnitsAtRisk: settled.length, roiPct: settled.length ? total / settled.length * 100 : null,
      observedPriceComparisons: priceRows.length, missingPriceComparisons: rows.length - priceRows.length,
      verifiedClosingPrices: priceRows.filter(row => row.priceDiagnostic.verifiedClosingLine).length,
      meanEntryVsLaterPricePct: priceRows.length ? priceRows.reduce((sum, row) => sum + row.priceDiagnostic.entryVsLaterPricePct, 0) / priceRows.length : null },
    limitations: ['Hypothetical flat one-unit entries, never official bets or realized customer returns.', 'ROI denominator is settled hypothetical entries including pushes and voids; unresolved entries are reported separately.', 'Same-event markets and repeated daily events can be correlated; these counts are not independent observations.', 'Observed price comparisons are not a no-vig closing-value estimate or proof of profitability.', 'Development replay is excluded and no automatic betting promotion is permitted.'], rows, skipped };
}

/** Reads the normal run index and observation files; output is a derived file only. */
export function rebuildMarketMethodShadowIndex({ root = process.cwd(), index = 'run-history.json', output = null, config = MARKET_METHOD_CONFIG } = {}) {
  const entries = readJson(path.resolve(root, index));
  const snapshots = [], observations = [], readWarnings = [];
  for (const entry of list(entries.runs || entries.entries)) {
    if (!entry.path) continue;
    let report;
    try { report = readJson(path.resolve(root, entry.path)); }
    catch (error) { readWarnings.push({ sourceRun: entry.path, reason: 'RUN_UNREADABLE', detail: error.message }); continue; }
    if (report.marketMethodShadow) {
      const snapshot = report.marketMethodShadow;
      if (snapshot.sourceRun !== entry.path || snapshot.generatedAt !== report.ts) readWarnings.push({ sourceRun: entry.path, reason: 'SNAPSHOT_RUN_BINDING_INVALID' });
      else snapshots.push(snapshot);
    }
    const observationPath = path.resolve(root, entry.path.replace('data/history/runs/', 'data/history/observations/'));
    if (observationPath !== path.resolve(root, entry.path) && fs.existsSync(observationPath)) {
      try {
        const document = readJson(observationPath);
        if (document.sourceRun !== entry.path) { readWarnings.push({ sourceRun: entry.path, reason: 'OBSERVATION_RUN_BINDING_INVALID' }); continue; }
        const cards = new Map(list(report.recs).map(rec => [rec.feed?.selectionKey, rec]));
        observations.push({ ...document, recommendations: list(document.recommendations).map(row => {
          const rec = cards.get(row.selectionKey), context = rec?.coreAssessment?.context;
          return { ...row, marketMethodSourceContext: rec ? {
            selectionKey: rec.feed.selectionKey, eventId: String(rec.feed.eventId), eventDate: rec.feed.eventDate,
            marketKey: rec.feed.marketKey, sport: normalizedSport(context?.sport), marketDetail: context?.marketDetail
          } : null };
        }) });
      }
      catch (error) { readWarnings.push({ sourceRun: entry.path, reason: 'OBSERVATION_UNREADABLE', detail: error.message }); }
    }
  }
  const result = { ...evaluateMarketMethodShadow({ snapshots, observations, config }), readWarnings };
  if (output) { const target = path.resolve(root, output); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, `${JSON.stringify(result, null, 2)}\n`); }
  return result;
}

function main() {
  const [command, ...argv] = process.argv.slice(2);
  if (command !== 'evaluate') throw new Error('Usage: market-method-shadow.mjs evaluate [--root DIR] [--index FILE] [--output FILE]');
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!['--root', '--index', '--output'].includes(argv[i]) || !argv[i + 1]) throw new Error(`Invalid argument ${argv[i]}`);
    args[argv[i].slice(2)] = argv[i + 1];
  }
  const result = rebuildMarketMethodShadowIndex(args);
  console.log(JSON.stringify({ methodVersion: result.methodVersion, activationAt: result.activationAt, ...result.summary, warnings: result.readWarnings.length }, null, 2));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(`market-method-shadow: ${error.message}`); process.exitCode = 1; }
}
