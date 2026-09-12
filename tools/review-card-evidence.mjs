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
const isGap = item => item?.historyFitRole === 'gap' || item?.evidence?.tierAssignment === 'gap_summary';
const processOnly = value => /(?:page|endpoint|schedule|reporting|review).{0,100}(?:checked|queried|reviewed|returned an access error)|(?:checked|queried|reviewed).{0,100}(?:page|endpoint|schedule)/i.test(text(value)) &&
  !/\b(?:confirmed|named|starting pitcher|starts? at|will start|ruled out|scratched|active|inactive)\b.{0,80}\b(?:[A-Z][a-z]+\s+[A-Z][a-z]+)\b/.test(text(value));

// Only recognize this exact legacy template, preserving team labels. Other
// narrative numbers receive an interpretation advisory, never an inferred fair.
function legacyDRatings(source, rec) {
  const match = text(source.finding).match(/^DRatings projected (.+?) ([\d.]+), (.+?) ([\d.]+) \(([\d.]+)%\/([\d.]+)%\)/);
  if (!match) return null;
  const label = text(rec.title).toLowerCase(), away = label.startsWith(match[1].toLowerCase()), home = label.startsWith(match[3].toLowerCase());
  return {probability: away !== home ? Number(match[away ? 5 : 6]) / 100 : null, first: match[1], second: match[3]};
}

export function reviewCardEvidence(report, sidecar, {library = null, priorResearch = null} = {}) {
  const issues = [], cards = [], events = new Map();
  const researchIds = new Set(list(library?.items).map(item => item.priorId));
  const researchById = new Map(list(library?.items).map(item => [item.priorId, item]));
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
    const canonical = ids.map(id => researchById.get(id));
    if (ids.length && canonical.every(entry => entry && isGap(entry)) && (grade && grade !== 'NR' || /^DIRECT$/i.test(text(item.directness)) || /^HIGH$/i.test(text(item.transportability)))) {
      add('HISTORY_FIT_GAP_ONLY', ordinal, title, 'All linked canonical items explicitly document a gap. Use the existing NR/gap treatment; these records cannot establish a supportive grade or DIRECT/HIGH applicability. Preserve the real links and current decision.');
    }
    if (!ids.length && /priors? (?:were )?applied|(?:reverse favorite.longshot|market.efficiency) research/i.test(text(rec.hist))) {
      add('HISTORY_FIT_REFERENCES_MISSING', ordinal, title, 'The card says historical findings were applied but does not retain their canonical prior/synthesis IDs. Reconcile the actual considered research, application and limitation; do not assign unrelated IDs after the fact.');
    }
    if (item.displayText != null && item.displayText !== rec.hist) add('HISTORY_FIT_DISPLAY_DRIFT', ordinal, title, 'History Fit text differs between the card and its research record. Preserve one reviewed finding, application and limitation in both.');
    const direction = rec.benchmarkComparison?.direction;
    for (const field of ['analysis', 'support', 'contrary', 'edge']) {
      const stated = text(rec[field]).match(/\b\d+(?:\.\d+)?[ -]point\s+(favorable|unfavorable|neutral)\s+(?:price\/reference\s+)?comparison\b/i)?.[1]?.toUpperCase();
      if (stated && direction && stated !== direction) add('BENCHMARK_PROSE_DIRECTION', ordinal, title, `${field} calls the numerical comparison ${stated}, but benchmarkComparison says ${direction}. Reconcile with the exact executable price and paired reference; this wording warning does not alter the decision.`);
    }
    const forecastReviews = list(rec.forecastReview?.records);
    for (const forecast of forecastReviews) {
      if (forecast.eligibility === 'ELIGIBLE_EXACT' && forecast.comparison?.direction === 'OPPOSES_PRICE') {
        const explicit = rec.cardEvidence?.schema === 1 && /opposes this price/.test(text(rec.contrary));
        if (!explicit) add('FORECAST_PRICE_CONFLICT_REVIEW', ordinal, title, `${forecast.publisher || forecast.sourceId || forecast.recordId} opposes the executable price by ${Math.abs(forecast.comparison.edgeProbabilityPoints).toFixed(2)} probability points. Put that disagreement in contrary evidence and explain its weight against the market reference; do not automatically change fair/status.`);
      }
    }
    for (const source of sources.filter(source => /forecast|predictor|DRatings|Dimers|FanGraphs|MoneyPuck/i.test([source.title, source.finding].join(' ')))) {
      if (!text(rec.support).includes(text(source.finding)) || !text(source.finding)) continue;
      const parsed = legacyDRatings(source, rec), market = rec.coreAssessment?.context?.marketClass || rec.feed?.market;
      if (parsed && market === 'moneyline' && parsed.probability != null && Number(rec.feed?.priceDecimal) > 1 && parsed.probability < 1 / Number(rec.feed.priceDecimal)) {
        add('FORECAST_BELOW_PRICE_IN_SUPPORT', ordinal, title, `The explicitly labelled legacy DRatings team-win forecast is ${(parsed.probability * 100).toFixed(2)}%, below ${(100 / Number(rec.feed.priceDecimal)).toFixed(2)}% break-even at the frozen decimal price. Review its settlement/applicability and explain it as opposing the price if applicable. Its presence in SUPPORT is not resolved by a favorable Pinnacle comparison.`);
      }
      if (parsed && market !== 'moneyline' && !/team.win|moneyline forecast|win probability.{0,70}(?:cover|run.line)|does not establish.{0,60}(?:settlement|cover)/i.test([rec.support, rec.contrary, rec.analysis].map(text).join(' '))) {
        add('FORECAST_MARKET_LIMITATION_MISSING', ordinal, title, 'A team-win forecast/projected score is repeated as support for a spread/run line/total without an explicit market-translation limit. It is context, not an exact cover or Over/Under settlement probability. Retain a separately qualified market-reference assessment where eligible.');
      }
      if (!parsed && !forecastReviews.length && /\d+(?:\.\d+)?\s*%|project(?:ed|s).{0,80}\d/i.test(text(source.finding))) {
        add('FORECAST_INTERPRETATION_UNSTRUCTURED', ordinal, title, 'A numerical forecast appears in support without structured exact-market interpretation. Record source market/side/line, settlement and current applicability; distinguish projected scores from probabilities and compare any applicable probability with this price.');
      }
    }
    if (currentFacts.length && currentFacts.every(processOnly)) add('PERSONNEL_PROCESS_WITHOUT_FINDING', ordinal, title, 'Recorded non-market evidence consists of source-check/access statements. Retain actual named starters/roles, projections or specific absences and their relevance; where unavailable state the exact missing fact and source shortfall. A blank final-lineup field does not automatically make every market material.');
    if (unresolved.length && /material late starter, lineup or participation change requires a fresh assessment|starting pitchers and batting orders materially affect|named personnel inputs can materially affect/i.test([personnel.decisionSensitivity, personnel.dependencyRationale].map(text).join(' ')) && !rec.cardEvidence?.findings?.some(finding => finding.stance === 'UNRESOLVED' && text(finding.application))) {
      add('PERSONNEL_MARKET_MATERIALITY_GENERIC', ordinal, title, 'Identify the specific remaining personnel input and how plausible outcomes affect this exact side/line decision. Apply the existing credible-projection/fallback process where relevant; do not impose final confirmation on every market.');
    }
    if (rec.status === 'WAIT') {
      const condition = rec.cardEvidence?.waitCondition;
      if (!text(condition?.trigger) || !text(condition?.checkSource) || !text(condition?.remainingBetRequirements)) add('WAIT_REASSESSMENT_DETAIL', ordinal, title, 'Record the concrete observable trigger, where it will be checked, and which existing BET requirements still remain after it resolves. Missing research alone is neither WAIT qualification nor a supported PASS. Existing WAIT validation retains authority.');
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
    if (!text(blocker.missing) || !text(blocker.impact) || !list(blocker.attempts).length || !text(blocker.progress?.nextStep) || !text(blocker.progress?.stoppingReason)) add('BLOCKED_DISPOSITION_DETAIL', null, receipt.selectionId, 'Retain the precise missing input, decision impact, actual attempts, observed stopping reason and concrete next step in this selection-level blocker. Reconcile usable recorded evidence first; unfinished work does not become PASS/WAIT and does not block completed selections.');
    if (list(blocker.attempts).some(attempt => attempt.kind === 'MODEL' && /\d+(?:\.\d+)?\s*%|project(?:ed|s).{0,80}\d/i.test(text(attempt.finding))) && /(?:no|missing|unavailable) (?:published |independent )?(?:forecast|model|point estimate)/i.test(text(blocker.missing))) add('BLOCKED_RECORDED_FORECAST_REVIEW', null, receipt.selectionId, 'A source attempt contains a numerical forecast while the missing-input text says no forecast. Review and retain the actual point, exact-market applicability and real remaining limitation; a found contextual score is not automatically a qualified exact probability.');
    if (blocker.reason === 'FAIR_MODEL_UNAVAILABLE' && /qualified|exact paired|Pinnacle/.test(text(blocker.missing)) && !list(blocker.attempts).some(attempt => attempt.kind === 'MARKET')) add('BLOCKED_MARKET_ROUTE_UNREVIEWED', null, receipt.selectionId, 'Recheck the existing qualified exact paired Pinnacle route and record the result. An otherwise valid market assessment need not acquire an unnecessary independent numerical fair; BET requirements remain unchanged.');
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
      'Legacy forecast narrative checks recognize limited explicit templates for advice only; they never manufacture structured probabilities, research findings or decisions.',
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
