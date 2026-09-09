#!/usr/bin/env node
// Read-only producer advice. Findings never change decisions or block publication.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadPriorPrimaryResearch} from './major-sport-market-coverage-gate.mjs';

const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const list = value => Array.isArray(value) ? value : [];
const text = value => typeof value === 'string' ? value : '';
const unique = values => [...new Set(values.filter(Boolean))];

export function reviewCardEvidence(report, sidecar, {library = null, priorResearch = null} = {}) {
  const issues = [], cards = [], events = new Map();
  const researchIds = new Set(list(library?.items).map(item => item.priorId));
  const receipts = list(sidecar?.primaryAnalysis?.receipts);
  const add = (code, ordinal, title, detail) => issues.push({code, ordinal, title, detail});
  for (const [index, rec] of list(report?.recs).entries()) {
    const ordinal = index + 1, title = rec.title, item = sidecar?.recommendations?.[index] || {};
    const receipt = receipts.find(row => row.state === 'EVALUATED' && row.decision?.feed?.selectionKey === rec.feed?.selectionKey);
    const sources = list(rec.sourceEvidence), personnel = rec.personnelEvidence || {};
    const ids = unique([...list(item.priorIds), ...list(item.synthesisIds)]);
    const grade = text(item.grade || rec.hist).match(/^(NR|[ABCD][+-]?)(?=\s|$)/)?.[1];
    const currentFacts = unique([...list(personnel.facts), ...sources.filter(source => source.kind !== 'MARKET').map(source => source.finding)]);
    const unresolved = list(personnel.unresolved);
    const start = issues.length;
    if (grade && grade !== 'NR' && !ids.length) {
      add('HISTORY_FIT_UNSUPPORTED', ordinal, title, 'History Fit grade has no research links. Read applicable canonical research, or state NR/unavailable with the real limitation; current price evidence does not support a historical B.');
    }
    if (library && ids.some(id => !researchIds.has(id))) {
      add('HISTORY_FIT_UNKNOWN_ID', ordinal, title, `Unknown research IDs: ${ids.filter(id => !researchIds.has(id)).join(', ')}. Resolve against the active library without inventing IDs.`);
    }
    if (/information review was completed|official MLB review was completed/i.test(text(rec.support))) {
      add('SUPPORT_FACTS_NOT_APPLIED', ordinal, title, 'Replace the process statement with the actual relevant findings and their effect. Neutral information may be described as neutral; do not invent support.');
    }
    if (/^(Material personnel remains unresolved|Both batting orders remain TBD),? and no independent true probability/i.test(text(rec.contrary))) {
      add('CONTRARY_GENERIC', ordinal, title, 'Name the exact unresolved team/player/role and why it matters to this selection; retain actual opposing findings and uncertainty.');
    }
    if (/^PASS\. .+ has a [\d.]+-point (?:unfavorable|favorable|neutral) comparison .+after the current information review; no wager\.$/i.test(text(rec.analysis))) {
      add('ANALYSIS_REPEATS_PRICE', ordinal, title, 'Explain how the recorded information supports the final decision, remaining uncertainty and any concrete reassessment trigger.');
    }
    if (/^Bound feed .*; pinned benchmark .*; official /i.test(text(rec.source))) {
      add('SOURCE_NAMES_MISSING', ordinal, title, 'Identify the actual source names and their role with readable Pacific check times; keep exact URLs and original timestamps in sourceEvidence.');
    }
    if (Number(rec.benchmarkComparison?.edgeProbabilityPoints) > 0 && unresolved.length && !list(personnel.fallbackSources).length) {
      add('FAVORABLE_PRICE_PERSONNEL_REVIEW', ordinal, title, 'Decide whether this favorable comparison merits targeted Stage 2 work on the recorded dependency. If material, follow existing fallback-depth rules and record actual attempts/shortfalls. This flag supplies no status or new edge threshold.');
    }
    const earlier = priorResearch?.byForecast?.get(receipt?.selectionId);
    if (earlier && !rec.fairValueEvidence) {
      const old = earlier.receipt.decision;
      add('EARLIER_FORECAST_REVIEW', ordinal, title, `Earlier sourced fair exists at ${earlier.source.reportPath}. Revalidate or explain why it was not adopted; a newer market-only PASS does not invalidate it. Never automatically carry its probability, status or source check time forward.`);
      cards.push({ordinal, title, earlierForecast: {source: earlier.source, fair: old.fairValueEvidence,
        sources: old.sourceEvidence, sameExactSelection: old.feed?.selectionKey === rec.feed?.selectionKey,
        currentReviewRequired: true, authority: 'HISTORICAL_CONTEXT_ONLY'}});
    }
    if (issues.length > start) {
      const eventId = String(rec.feed?.eventId || title);
      if (!events.has(eventId)) events.set(eventId, {eventId, meta: rec.meta, facts: [], unresolved: [], sourceNames: [], selections: []});
      const event = events.get(eventId);
      event.facts = unique([...event.facts, ...currentFacts]);
      event.unresolved = unique([...event.unresolved, ...unresolved]);
      event.sourceNames = unique([...event.sourceNames, ...sources.filter(source => source.kind !== 'MARKET').map(source => source.title)]);
      event.selections.push({ordinal, title, selectionKey: rec.feed?.selectionKey, informationImpact: rec.marketAssessment?.informationReview?.impact,
        personnelImpact: personnel.decisionImpact, decisionSensitivity: personnel.decisionSensitivity});
    }
  }
  for (const receipt of receipts.filter(row => row.state === 'BLOCKED')) {
    const blocker = receipt.blocker || {};
    if (/reference|benchmark/i.test(text(blocker.missing)) && list(blocker.attempts).length &&
        list(blocker.attempts).every(attempt => ['MARKET', 'OFFICIAL'].includes(attempt.kind))) {
      add('REFERENCE_FALLBACK_REVIEW', null, receipt.selectionId, 'Only market/official checks are recorded. Pursue the targeted published-forecast alternative when useful and document the result; incomplete work stays selection-level and does not block other completed decisions.');
    }
  }
  const forecastCards = list(report?.recs).filter(rec => rec.fairValueEvidence != null).length;
  if (/Applicable published point estimates were found for ([1-9]\d*)/.test(text(report?.summary)) && !forecastCards &&
      !receipts.some(row => list(row.decision?.sourceEvidence || row.blocker?.attempts).some(source => source.kind === 'MODEL'))) {
    add('FORECAST_COUNT_REVIEW', null, 'Report summary', 'The summary claims published point estimates but no MODEL sources or fair-value estimates are recorded. Count extracted applicable forecasts separately from qualified market references.');
  }
  return {mode: 'ADVISORY_ONLY', publicationBlocking: false, changesMade: false,
    cardsReviewed: list(report?.recs).length, forecastCards,
    marketAssessmentCards: list(report?.recs).filter(rec => rec.marketAssessment != null).length,
    issueCounts: issues.reduce((counts, issue) => {counts[issue.code] = (counts[issue.code] || 0) + 1; return counts;}, {}),
    issues, recordedEventEvidence: [...events.values()], earlierForecasts: cards,
    limitations: ['Heuristic review; a clear result does not certify research quality or source truth.',
      'Current research and final decisions remain the producer’s responsibility. No probability, history grade, status or stake is generated.'],
    warnings: [...(!library ? ['Research Library unavailable to this review; use the existing History Fit unavailable policy, without inventing a grade.'] : []), ...list(priorResearch?.warnings)]};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2), value = flag => args[args.indexOf(flag) + 1];
    if (args[0] !== 'review' || !args.includes('--report') || !args.includes('--sidecar')) {
      throw new Error('Usage: review-card-evidence.mjs review --report FILE --sidecar FILE [--root DIR] [--summary]');
    }
    const root = args.includes('--root') ? path.resolve(value('--root')) : process.cwd();
    const report = read(value('--report')), sidecar = read(value('--sidecar'));
    let library = null, priorResearch;
    try { library = read(path.join(root, 'research/research-library.json')); } catch { /* advisory failure below */ }
    try { priorResearch = loadPriorPrimaryResearch(root, report, {selections: list(sidecar.primaryAnalysis?.receipts).map(row => ({selectionId: row.selectionId}))}); }
    catch (error) { priorResearch = {warnings: [`Prior context unavailable: ${error.message}`]}; }
    const result = reviewCardEvidence(report, sidecar, {library, priorResearch});
    console.log(JSON.stringify(args.includes('--summary') ? {mode: result.mode, publicationBlocking: false,
      cardsReviewed: result.cardsReviewed, issueCounts: result.issueCounts, warnings: result.warnings} : result, null, 2));
  } catch (error) {
    // Even unavailable advisory input is not a new publication gate. Existing
    // publication validators retain sole authority over bundle correctness.
    console.log(JSON.stringify({mode: 'ADVISORY_ONLY', publicationBlocking: false, changesMade: false,
      warnings: [`Card evidence review unavailable: ${error.message}`]}));
  }
}
