import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {reviewCardEvidence} from '../tools/review-card-evidence.mjs';
import {loadPriorPrimaryResearch, buildPrimaryResearchPlan, describeResearchCompletion} from '../tools/major-sport-market-coverage-gate.mjs';

const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const reportPath = 'data/history/runs/2026-09-09/final_morning-095137.json';
const sidecarPath = reportPath.replace('/runs/', '/research-fit/');
const report = read(reportPath), sidecar = read(sidecarPath), library = read('research/research-library.json');
const inventory = {selections: sidecar.primaryAnalysis.receipts.map(row => {
  const [sport, eventId, marketDetail, side] = row.selectionId.split('|');
  return {selectionId: row.selectionId, sport, eventId, marketDetail, side, quotes: [row.quote]};
})};
const priorResearch = loadPriorPrimaryResearch(process.cwd(), report, inventory);
const athleticsId = 'MLB|63301247|full_game_moneyline|home';
assert.equal(priorResearch.bySelection.get(athleticsId).source.ts, '2026-09-09T08:20:42.000-07:00');
assert.equal(priorResearch.bySelection.get(athleticsId).receipt.decision.fairValueEvidence, null);
assert.equal(priorResearch.byForecast.get(athleticsId).source.ts, '2026-09-09T06:19:37.000-07:00', 'the 8:00 market-only PASS must not hide the 6:00 sourced fair');
assert.equal(priorResearch.byForecast.get(athleticsId).receipt.decision.fairValueEvidence.estimate, .402);
const plan = buildPrimaryResearchPlan(report, sidecar, inventory, priorResearch);
const plannedAthletics = plan.events.flatMap(event => event.markets.flatMap(market => market.selections)).find(row => row.selectionId === athleticsId);
assert.equal(plannedAthletics.priorForecastResearch.authority, 'HISTORICAL_CONTEXT_ONLY');
assert.equal(plannedAthletics.priorForecastResearch.requiresCurrentReview, true);
assert.equal(plannedAthletics.priorForecastResearch.fairValueEvidence.estimate, .402);
assert.equal(plan.counts.evaluatedRecorded, 90, 'history does not change completion counts');
assert.ok(plan.events.find(event => event.eventId === '63301247').sharedResearch.some(source => source.kind === 'MODEL' && source.historical && source.checkedAt.startsWith('2026-09-09T06:')));

const before = JSON.stringify({report, sidecar, library});
const result = reviewCardEvidence(report, sidecar, {library, priorResearch});
assert.equal(result.publicationBlocking, false);
assert.equal(result.issueCounts.HISTORY_FIT_UNSUPPORTED, 90);
assert.equal(result.issueCounts.EARLIER_FORECAST_REVIEW, 2);
assert.equal(result.issueCounts.FAVORABLE_PRICE_PERSONNEL_REVIEW, 4);
assert.equal(result.issueCounts.FORECAST_COUNT_REVIEW, 1);
assert.ok(result.recordedEventEvidence.find(event => event.eventId === '63299279').facts.some(fact => fact.includes('Pallante') && fact.includes('Tidwell')));
assert.equal(JSON.stringify({report, sidecar, library}), before, 'advice must not mutate odds, research, status, stakes, counts or evidence');
assert.deepEqual(describeResearchCompletion(report, sidecar), {state: 'PARTIAL', evaluated: 90, unfinished: 6, notice: 'PARTIAL REPORT: 90 evaluated; 6 unfinished.'});

// Specific evidence and honest research gaps are publishable without a new model.
const rec = structuredClone(report.recs[0]);
Object.assign(rec, {hist: 'NR — no reliable applicable historical prior was established for this assessment.',
  support: 'MLB lists Pallante against Tidwell; the St. Louis batting order is posted. The available facts do not establish an advantage at this price.',
  contrary: 'San Francisco’s batting order remains pending; a material change would require reassessment.',
  source: 'DraftKings execution; Pinnacle market reference; MLB personnel checked 9:51 AM PT.',
  analysis: 'The offered price is unfavorable to the market reference. With San Francisco’s batting order still pending and no supported contrary forecast, this remains PASS at zero stake.'});
const item = {...structuredClone(sidecar.recommendations[0]), grade: 'NR', hist: rec.hist, displayText: rec.hist};
const specific = reviewCardEvidence({recs: [rec]}, {recommendations: [item]}, {library});
assert.equal(specific.issues.length, 0);
assert.equal(rec.fairValueEvidence, null);
assert.equal(rec.status, 'PASS');
assert.equal(reviewCardEvidence({recs: []}, {recommendations: []}, {}).publicationBlocking, false);

// The reviewer checks links, but never claims an existing ID proves applicability.
item.grade = 'C'; item.priorIds = ['not-a-real-prior'];
assert.ok(reviewCardEvidence({recs: [rec]}, {recommendations: [item]}, {library}).issues.some(issue => issue.code === 'HISTORY_FIT_UNKNOWN_ID'));
item.priorIds = ['market_efficiency_general'];
assert.ok(!reviewCardEvidence({recs: [rec]}, {recommendations: [item]}, {library}).issues.some(issue => issue.code === 'HISTORY_FIT_UNKNOWN_ID'));

const processResult = spawnSync(process.execPath, ['tools/review-card-evidence.mjs', 'review', '--report', reportPath, '--sidecar', sidecarPath, '--summary'], {encoding: 'utf8'});
assert.equal(processResult.status, 0, 'even the reproduced 90-card regression cannot become a new publication block');
assert.equal(JSON.parse(processResult.stdout).publicationBlocking, false);
const absent = spawnSync(process.execPath, ['tools/review-card-evidence.mjs', 'review', '--report', 'absent-review-input.json', '--sidecar', sidecarPath], {encoding: 'utf8'});
assert.equal(absent.status, 0, 'advisory input failure leaves hard-gate authority unchanged');
assert.ok(JSON.parse(absent.stdout).warnings.length);
console.log('CARD EVIDENCE REVIEW TESTS OK — earlier forecasts retained, facts surfaced, partial publication and immutability preserved');
