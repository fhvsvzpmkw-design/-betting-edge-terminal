import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import { derivePrimarySelectionInventory, deriveBoundCoverage, PRIMARY_ANALYSIS_FROM, validatePrimaryAnalysis, validateCoverageAudit, validateVisibleCoverageSummary } from '../tools/major-sport-market-coverage-gate.mjs';
import { evaluate, matchCondition } from '../tools/core-handicap-framework.mjs';
const read = file => JSON.parse(fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'));
const policy = read('data/major-sport-market-coverage-v1.json');
const framework = read('core/core-handicap-framework-v1.4.json');
const clone = value => structuredClone(value);
const report = { ts: '2026-09-06T10:15:00-07:00', feedGeneratedAt: '2026-09-06T17:00:00.000Z', recs: [] };
const market = { marketKey: 'ml', updatedAt: report.feedGeneratedAt, odds: [{home: '1.9', away: '1.9', selectionKeys: {home: 'event1|ml|home||', away: 'event1|ml|away||'}}] };
const feed = {generatedAt: report.feedGeneratedAt, events: [{eventId: 'event1', date: '2026-09-06T20:00:00Z', sport: {slug: 'baseball'}, league: {slug: 'usa-mlb'}, bookmakers: {Bet365: [market]}}]};
const inventory = derivePrimarySelectionInventory(report, feed, policy);
assert.equal(inventory.selections.length, 2);
assert.deepEqual(inventory.sports.MLB.primary, {required: 6, available: 2, unavailable: 4});
assert.equal(inventory.selections[0].quotes.length, 1, 'one supported execution book is sufficient');
assert.deepEqual(derivePrimarySelectionInventory(report, clone(feed), policy), inventory, 'inventory deterministic');
function blocked(selection) {
  return { selectionId: selection.selectionId, quote: clone(selection.quotes[0]), state: 'BLOCKED', blocker: {
    reason: 'FAIR_MODEL_UNAVAILABLE', missing: `No validated fair model for event1 ${selection.side} moneyline.`, impact: 'Cannot reach a value decision; no wager authorized.', checkedAt: report.ts,
    attempts: [{eventId: 'event1', checkedAt: '2026-09-06T16:58:00Z', url: 'https://example.org/models/event1', finding: `Checked event1 model manifest; ${selection.side} matchup adjustment remains absent.`}]
  }};
}
const sidecar = { primaryAnalysis: {schema: 1, feedGeneratedAt: report.feedGeneratedAt, receipts: inventory.selections.map(blocked)} };
const validate = (candidate = sidecar, candidateReport = report) => validatePrimaryAnalysis(candidateReport, candidate, {feed, policy, framework});
const result = validate();
assert.equal(result.primaryEvaluated, 0);
assert.equal(result.primaryBlocked, 2);
assert.deepEqual(result.outcomeCounts, {BET: 0, LEAN: 0, WAIT: 0, PASS: 0}, 'blockers never manufacture PASS cards');
assert.throws(() => validate({primaryAnalysis: {...sidecar.primaryAnalysis, receipts: []}}), /missing 2 required receipt/);
assert.throws(() => validate({primaryAnalysis: {...sidecar.primaryAnalysis, receipts: [sidecar.primaryAnalysis.receipts[0], sidecar.primaryAnalysis.receipts[0]]}}), /duplicated/);
for (const [field, value] of Object.entries({eventId: 'fake', selectionKey: 'event2|ml|home||', book: 'Pinnacle', side: 'over', line: 2, priceDecimal: 3, quoteUpdatedAt: '2026-09-06T16:59:00Z'})) {
  const altered = clone(sidecar); altered.primaryAnalysis.receipts[0].quote[field] = value;
  assert.throws(() => validate(altered), /quote identity\/book\/line\/price\/time/, field);
}
for (const change of [r => r.blocker.attempts = [], r => r.blocker.attempts[0].eventId = 'other', r => r.blocker.missing = '', r => r.blocker.checkedAt = '2026-09-07T17:00:00Z', r => r.fair = 0.5, r => r.decision = {status: 'PASS'}]) {
  const altered = clone(sidecar); change(altered.primaryAnalysis.receipts[0]); assert.throws(() => validate(altered));
}
assert.equal(validatePrimaryAnalysis({ts: '2026-09-05T18:21:30-07:00'}, {}, {}).enforced, false, 'all Sep 5 historical reports preserved');
assert.equal(Date.parse(PRIMARY_ANALYSIS_FROM), Date.parse('2026-09-06T07:00:00Z'));
function evaluated(selection, p = 0.5) {
  const quote = selection.quotes[0];
  const context = {sport: 'MLB', marketClass: 'moneyline', marketDetail: 'full_game_moneyline', timing: 'pregame', fairValueBasis: 'INDEPENDENT_MODEL', bookDispersion: 'NONE', liquidityRisk: 'NORMAL', tailRisk: 'NORMAL', directCalibration: 'DIRECT', personnelSensitivity: 'NONE', independentCurrentSupport: 'STRONG', movementPrimaryEvidence: false, historicalDirectionalRecalibrationPrimary: false, graduatedResearchIds: []};
  context.graduatedResearchIds = (framework.graduatedResearchRules || []).filter(rule => matchCondition(rule.when, context)).map(rule => rule.priorId);
  const coreAssessment = {frameworkId: framework.frameworkId, context, fairValueBasisRationale: 'Fixture independent model.', uncertaintyStatement: 'Fixture uncertainty range.', rationale: 'Fixture does not meet value threshold.', ...evaluate(framework, context)};
  const decision = {title: `Fixture event1 ${selection.side}`, status: 'PASS', stake: '$0', book: quote.book, price: '-111', fair: String(p), analysis: 'Fixture event1 calibrated model does not clear the price and uncertainty allowance.', feed: {...quote, eventDate: feed.events[0].date}, coreAssessment,
    sourceEvidence: [{id: 'model1', kind: 'MODEL', sport: 'MLB', eventId: 'event1', checkedAt: report.feedGeneratedAt, url: 'https://example.org/models/event1', title: 'Fixture event1 model', finding: 'Fixture event1 opponent-adjusted probability output.'}],
    fairValueEvidence: {selectionKey: quote.selectionKey, unit: 'selection_probability', estimate: p, result: p, range: {low: p - 0.02, high: p + 0.02}, displayValue: String(p), method: 'Fixture independent probability model', calculation: 'Fixture calibrated model output.', limitations: 'Fixture uncertainty is two probability points.', inputs: [{name: 'Fixture model probability', value: p, unit: 'probability', sourceIds: ['model1']}], personnelBasis: {sensitive: false, rationale: 'Synthetic non-personnel fixture.'}}
  };
  return {selectionId: selection.selectionId, quote: clone(quote), state: 'EVALUATED', checkedAt: report.ts, decision, evidence: clone(decision)};
}
const reviewed = {primaryAnalysis: {...sidecar.primaryAnalysis, receipts: inventory.selections.map(s => evaluated(s))}};
const reviewedReport = {...clone(report), recs: reviewed.primaryAnalysis.receipts.map(receipt => clone(receipt.decision))};
assert.equal(validate(reviewed, reviewedReport).primaryEvaluated, 2, 'every documented PASS decision is published as a card');
assert.equal(validate(reviewed, reviewedReport).outcomeCounts.PASS, 2);
assert.throws(() => validate(reviewed), /must match its published card/, 'evaluated PASS may not be concealed');
const incoherent = clone(reviewed); incoherent.primaryAnalysis.receipts[0] = evaluated(inventory.selections[0], 0.6);
const incoherentReport = {...clone(report), recs: incoherent.primaryAnalysis.receipts.map(receipt => clone(receipt.decision))};
assert.throws(() => validate(incoherent, incoherentReport), /incoherent shared market fair/);
for (const [field, value] of Object.entries({eventDate: '2040-01-01T00:00:00Z', line: 999, hdp: 999, quoteUpdatedAt: '1970-01-01T00:00:00Z', priceDecimal: 9})) {
  const altered = clone(reviewed); altered.primaryAnalysis.receipts[0].decision.feed[field] = value; altered.primaryAnalysis.receipts[0].evidence = clone(altered.primaryAnalysis.receipts[0].decision);
  assert.throws(() => validate(altered, reviewedReport), /differs from inventory/, `published PASS ${field} remains bound to actual quote`);
}
const marketOnly = clone(reviewed); marketOnly.primaryAnalysis.receipts[0].decision.sourceEvidence[0].kind = 'MARKET'; marketOnly.primaryAnalysis.receipts[0].evidence = clone(marketOnly.primaryAnalysis.receipts[0].decision);
assert.throws(() => validate(marketOnly, reviewedReport), /non-market source-linked inputs/);
const noFair = clone(reviewed); delete noFair.primaryAnalysis.receipts[0].decision.fairValueEvidence; delete noFair.primaryAnalysis.receipts[0].evidence.fairValueEvidence;
assert.throws(() => validate(noFair, reviewedReport), /requires a numeric documented fair/);
const fakeCore = clone(reviewed); fakeCore.primaryAnalysis.receipts[0].decision.coreAssessment.modelErrorState = 'HIGH'; fakeCore.primaryAnalysis.receipts[0].evidence = clone(fakeCore.primaryAnalysis.receipts[0].decision);
assert.throws(() => validate(fakeCore, reviewedReport), /does not recompute/);
const concealed = clone(reviewed); concealed.primaryAnalysis.receipts[0].decision.status = 'BET'; concealed.primaryAnalysis.receipts[0].evidence.status = 'BET';
assert.throws(() => validate(concealed, reviewedReport), /must match its published card/);
for (const change of [m => m.updatedAt = '2026-09-06T17:00:01Z', m => m.updatedAt = '2026-09-06T16:29:59Z', m => m.suspended = true, m => m.odds[0].suspended = true, m => m.odds[0].selectionKeys = {home: 'fake|ml|home||', away: 'fake|ml|away||'}]) {
  const altered = clone(feed); change(altered.events[0].bookmakers.Bet365[0]);
  assert.equal(derivePrimarySelectionInventory(report, altered, policy).selections.length, 0, 'invalid current quotes excluded');
}
const suspension = clone(feed); suspension.events[0].bookmakers.Bet365.push({...clone(market), updatedAt: '2026-09-06T16:59:00Z'}); suspension.events[0].bookmakers.Bet365[0].suspended = true;
assert.equal(derivePrimarySelectionInventory(report, suspension, policy).selections.length, 0, 'suspended current market cannot rescue older quote');
const tied = clone(feed); tied.events[0].bookmakers.Bet365.push({...clone(market), suspended: true});
assert.equal(derivePrimarySelectionInventory(report, tied, policy).selections.length, 0, 'conflicting newest timestamp ties fail closed');
tied.events[0].bookmakers.Bet365.reverse();
assert.equal(derivePrimarySelectionInventory(report, tied, policy).selections.length, 0, 'tie outcome independent of array order');
const identical = clone(feed); identical.events[0].bookmakers.Bet365.push(clone(market));
assert.equal(derivePrimarySelectionInventory(report, identical, policy).selections.length, 2, 'identical duplicated market does not erase availability');
const partial = clone(feed); partial.events[0].bookmakers.Bet365[0].period = '1st_half';
assert.equal(derivePrimarySelectionInventory(report, partial, policy).selections.length, 0, 'canonical key cannot hide partial-period market');
// An explicitly unavailable continuity PASS remains presentational only.
const unavailableCard = {status: 'PASS', title: 'Fixture missing total', stake: '$0', fair: 'Unavailable', sourceEvidence: [], sourceShortfall: {reason: 'MARKET_UNAVAILABLE', missing: 'event1 full-game total not returned', impact: 'Withdraw prior interest; cannot quote a value.'}, coreAssessment: {context: {sport: 'MLB', marketClass: 'total', marketDetail: 'full_game_primary_total'}}, feed: {eventId: 'event1', marketKey: 'totals', side: 'over', selectionKey: 'event1|totals|over||8.5'}};
const withContinuity = {...clone(sidecar), recommendations: [clone(unavailableCard)]};
assert.equal(validate(withContinuity, {...report, recs: [unavailableCard]}).primaryEvaluated, 0, 'unavailable PASS gets no evaluated credit');
const fakeValue = clone(unavailableCard); fakeValue.fair = '8.5';
assert.throws(() => validate({...withContinuity, recommendations: [fakeValue]}, {...report, recs: [fakeValue]}), /no matching evaluated receipt/);

const archived = read('data/history/runs/2026-09-05/late-182130.json');
const archivedFeed = read('data/live-odds.json');
if (archivedFeed.generatedAt === archived.feedGeneratedAt) {
  const coverage = deriveBoundCoverage(archived, archivedFeed, policy);
  assert.equal(Object.values(coverage.sports).reduce((n, row) => n + row.primary.evaluated, 0), 26);
  assert.equal(Object.values(coverage.sports).reduce((n, row) => n + row.primary.unavailable, 0), 34);
  assert.equal(validatePrimaryAnalysis(archived, {}, {}).enforced, false);
}
// Integrated coverage gate refuses to turn counts into analysis evidence.
const policyRaw = fs.readFileSync(new URL('../data/major-sport-market-coverage-v1.json', import.meta.url));
const authoritySha = crypto.createHash('sha1').update(Buffer.from(`blob ${policyRaw.length}\0`)).update(policyRaw).digest('hex');
const sports = Object.fromEntries(Object.entries(inventory.sports).map(([sport, row]) => [sport, {gamesInScope: row.gamesInScope, gamesEvaluated: row.gamesInScope, primary: {...row.primary, evaluated: 0, blocked: row.primary.available}, props: {state: 'PAUSED_BY_SCOPE', returned: row.propsReturned, screened: 0, seriousDeepReviewed: 0, excludedByScope: row.propsReturned}}]));
const integrated = {...clone(sidecar), recommendations: [], provenance: {feedBlobSha: '0'.repeat(40)}, coverageAudit: {schema: policy.coverageAudit.schema, authorityId: policy.authorityId, authorityPath: 'data/major-sport-market-coverage-v1.json', authorityBlobSha: authoritySha, state: policy.coverageAudit.state, feedGeneratedAt: report.feedGeneratedAt, evaluationOrder: policy.principles.evaluationOrder, complete: true, scope: {id: policy.reportScope.id, effectiveFrom: policy.reportScope.effectiveFrom, playerProps: policy.reportScope.playerProps}, sports,
  availabilityLimitations: [...inventory.limitations].map(([key, reason]) => {const [sport, eventId, marketDetail, selection] = key.split('|'); return {sport, eventId, marketDetail, selections: [selection], reason};}),
  presentation: {mode: 'UNBOUNDED_ANALYSIS_OUTPUT', allEvaluatedPublished: true, fillerAdded: 0}, totals: {gamesInScope: 1, gamesEvaluated: 1, primaryRequired: 6, primaryAvailable: 2, primaryEvaluated: 0, primaryBlocked: 2, primaryUnavailable: 4, propsReturned: 0, propsScreened: 0, seriousPropsDeepReviewed: 0, propsExcludedByScope: 0}}};
const visible = {...report, summary: 'Primary selections: 2 available; 0 evaluated; 2 evidence-blocked; 4 unavailable.'};
assert.equal(validateCoverageAudit(visible, integrated, {feed}).calculatedTotals.primaryEvaluated, 0);
const noReceipts = clone(integrated); noReceipts.primaryAnalysis.receipts = [];
assert.throws(() => validateCoverageAudit(visible, noReceipts, {feed}), /missing 2 required receipt/);
const countForgery = clone(integrated); countForgery.coverageAudit.sports.MLB.primary.evaluated = 2; countForgery.coverageAudit.sports.MLB.primary.blocked = 0; countForgery.coverageAudit.totals.primaryEvaluated = 2; countForgery.coverageAudit.totals.primaryBlocked = 0;
assert.throws(() => validateCoverageAudit({...visible, summary: 'Primary selections: 2 available; 2 evaluated; 0 evidence-blocked; 4 unavailable.'}, countForgery, {feed}), /does not match exact bound feed/);
assert.throws(() => validateVisibleCoverageSummary({...report, summary: 'Primary selections: 2 evaluated; 4 unavailable.'}, integrated.coverageAudit), /actual coverage limitation/);
// Historical receipt decisions recompute against the pinned framework, even if
// a later operational framework changes its error floors.
const replayRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'primary-receipt-replay-'));
try {
  fs.mkdirSync(path.join(replayRoot, 'core')); fs.mkdirSync(path.join(replayRoot, 'data'));
  fs.writeFileSync(path.join(replayRoot, 'data/major-sport-market-coverage-v1.json'), policyRaw);
  execFileSync('git', ['init', '-q'], {cwd: replayRoot});
  const frameworkRaw = fs.readFileSync(new URL('../core/core-handicap-framework-v1.4.json', import.meta.url));
  const frameworkSha = execFileSync('git', ['hash-object', '-w', '--stdin'], {cwd: replayRoot, input: frameworkRaw, encoding: 'utf8'}).trim();
  fs.writeFileSync(path.join(replayRoot, 'core/core-handicap-framework-v1.4.json'), frameworkRaw);
  const replay = clone(integrated); replay.primaryAnalysis = reviewed.primaryAnalysis; replay.recommendations = reviewed.primaryAnalysis.receipts.map(receipt => clone(receipt.evidence));
  replay.coverageAudit.sports.MLB.primary.evaluated = 2; replay.coverageAudit.sports.MLB.primary.blocked = 0;
  replay.coverageAudit.totals.primaryEvaluated = 2; replay.coverageAudit.totals.primaryBlocked = 0;
  replay.provenance.coreFrameworkPath = 'core/core-handicap-framework-v1.4.json'; replay.provenance.coreFrameworkBlobSha = frameworkSha;
  const replayReport = {...clone(report), recs: reviewed.primaryAnalysis.receipts.map(receipt => clone(receipt.decision)), summary: 'Primary selections: 2 available; 2 evaluated; 0 evidence-blocked; 4 unavailable.'};
  assert.equal(validateCoverageAudit(replayReport, replay, {feed, root: replayRoot}).primaryAnalysis.primaryEvaluated, 2);
  const laterFramework = clone(framework); laterFramework.baseRules.unshift({id: 'later-change', when: {sport: ['MLB']}, floor: 'HIGH', reason: 'Synthetic future policy change'});
  fs.writeFileSync(path.join(replayRoot, 'core/core-handicap-framework-v1.4.json'), JSON.stringify(laterFramework));
  assert.equal(validateCoverageAudit(replayReport, replay, {feed, root: replayRoot, requireCurrentAuthority: false}).primaryAnalysis.primaryEvaluated, 2, 'historic replay uses original pinned framework');
  assert.throws(() => validateCoverageAudit(replayReport, replay, {feed, root: replayRoot}), /differs from current operational framework/);
} finally { fs.rmSync(replayRoot, {recursive: true, force: true}); }
console.log('Primary analysis receipt regression: exact inventory, published verified decisions, explicit blockers, coherent fair, truthful counts and Sep 5 history passed.');
