import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {
  buildPrimaryResearchPlan, derivePrimarySelectionInventory, loadPriorPrimaryResearch,
  PARTIAL_RESEARCH_FROM, validatePrimaryAnalysis, describeResearchCompletion
} from '../tools/major-sport-market-coverage-gate.mjs';

const reportPath = 'data/history/runs/2026-09-06/evening-151930.json';
const sidecarPath = 'data/history/research-fit/2026-09-06/evening-151930.json';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const report = read(reportPath), sidecar = read(sidecarPath);
const policy = read('data/major-sport-market-coverage-v1.json');
const provenance = read('data/history/report-provenance-schema.json');
assert.equal(provenance.primaryAnalysis.partialResearchPublicationFrom, PARTIAL_RESEARCH_FROM);

// Reconstruct only the inventory binding from the immutable failed receipts.
// The CLI below independently derives availability from the pinned odds blob.
const selections = sidecar.primaryAnalysis.receipts.map(receipt => {
  const [sport, eventId, marketDetail, side] = receipt.selectionId.split('|');
  return {selectionId: receipt.selectionId, sport, eventId, marketDetail, side, quotes: [receipt.quote]};
});
const sports = Object.fromEntries(Object.entries(sidecar.coverageAudit.sports).map(([sport, row]) => [sport, {primary: row.primary}]));
const inventory = {selections, sports, limitations: new Map()};
const before = JSON.stringify({report, sidecar});
const plan = buildPrimaryResearchPlan(report, sidecar, inventory);
assert.deepEqual(plan.counts, {available: 30, pending: 30, evaluatedRecorded: 0, blockersRecorded: 0});
assert.equal(plan.state, 'RESEARCH_PENDING');
assert.equal(plan.events.length, 5, 'shared event research, not 30 independent source hunts');
assert.ok(plan.events.every(event => event.markets.length === 3));
assert.ok(plan.events.every(event => event.markets.every(market => market.selections.length === 2)));
assert.ok(plan.events.flatMap(event => event.markets).flatMap(market => market.selections).every(selection => selection.nextAction === 'RESUME_RESEARCH' && selection.missing && selection.attempts.length));
assert.equal(JSON.stringify({report, sidecar}), before, 'planning must not generate evidence or alter the failed run');

assert.equal(validatePrimaryAnalysis(report, sidecar, {inventory}).primaryBlocked, 30, 'issued 15:15 history retains original validation');
assert.equal(describeResearchCompletion({ts: '2026-09-06T18:14:59-07:00'}, sidecar), null);
const forwardReport = {...report, ts: PARTIAL_RESEARCH_FROM};
assert.equal(validatePrimaryAnalysis(forwardReport, sidecar, {inventory}).primaryBlocked, 30, 'unfinished research remains selection-level and permits honest publication');
assert.deepEqual(describeResearchCompletion(forwardReport, sidecar), {state: 'INCOMPLETE', evaluated: 0, unfinished: 30, notice: 'ANALYSIS INCOMPLETE: 0 evaluated; 30 unfinished.'});

const draft = structuredClone(sidecar);
draft.primaryAnalysis.receipts = [];
assert.equal(buildPrimaryResearchPlan(report, draft, inventory).counts.pending, 30, 'initial working queue requires no fabricated blockers');
// A recorded decision is explicitly provisional until evidence validators pass.
draft.primaryAnalysis.receipts = [{...structuredClone(sidecar.primaryAnalysis.receipts[0]), state: 'EVALUATED', checkedAt: report.ts, blocker: undefined}];
let partial = buildPrimaryResearchPlan(report, draft, inventory);
assert.equal(partial.counts.pending, 29);
assert.equal(partial.counts.evaluatedRecorded, 1);
assert.throws(() => validatePrimaryAnalysis(report, draft, {inventory}), /recorded decision and matching evidence/, 'queue state does not certify empty decisions');
draft.primaryAnalysis.receipts[0].quote.priceDecimal += 1;
partial = buildPrimaryResearchPlan(report, draft, inventory);
assert.equal(partial.counts.pending, 30, 'changed quote cannot silently reuse progress');
draft.primaryAnalysis.receipts = [sidecar.primaryAnalysis.receipts[0], sidecar.primaryAnalysis.receipts[0]];
assert.equal(buildPrimaryResearchPlan(report, draft, inventory).counts.pending, 30, 'duplicate receipt requires reconciliation');

// Full CLI replay uses the same blob resolver as publication and writes nothing.
const paths = [reportPath, sidecarPath, 'data/live-odds.json', 'run-history.json'];
const bytes = paths.map(file => fs.readFileSync(file));
const cli = spawnSync(process.execPath, ['tools/major-sport-market-coverage-gate.mjs', 'research-plan', '--report', reportPath, '--sidecar', sidecarPath], {encoding: 'utf8'});
assert.equal(cli.status, 0, cli.stderr);
const replay = JSON.parse(cli.stdout);
assert.deepEqual(replay.counts, plan.counts);
assert.equal(replay.events.length, 5);
assert.ok(replay.events.every(event => event.eventDate), 'pinned feed supplies event order');
for (let index = 0; index < paths.length; index++) assert.deepEqual(fs.readFileSync(paths[index]), bytes[index], 'CLI replay is read-only');

// Explicitly protect the corrected freshness clock in the new working route.
const clockReport = {ts: '2026-09-06T18:20:00-07:00', feedGeneratedAt: '2026-09-07T01:10:00Z'};
const market = {marketKey: 'ml', updatedAt: '2026-09-06T15:00:00Z', observedAt: clockReport.feedGeneratedAt, odds: [{home: '1.9', away: '1.9', selectionKeys: {home: 'clock|ml|home||', away: 'clock|ml|away||'}}]};
const feed = {quoteObservationVersion: 1, generatedAt: clockReport.feedGeneratedAt, events: [{eventId: 'clock', date: '2026-09-07T02:00:00Z', sport: {slug: 'baseball'}, league: {slug: 'usa-mlb'}, bookmakers: {Bet365: [market]}}]};
const current = derivePrimarySelectionInventory(clockReport, feed, policy);
assert.equal(buildPrimaryResearchPlan(clockReport, {}, current).counts.pending, 2, 'fresh observations qualify despite old last-change timestamps');
for (const change of [m => delete m.observedAt, m => m.observedAt = '2026-09-07T00:39:00Z', m => m.suspended = true]) {
  const bad = structuredClone(feed); change(bad.events[0].bookmakers.Bet365[0]);
  assert.equal(buildPrimaryResearchPlan(clockReport, {}, derivePrimarySelectionInventory(clockReport, bad, policy)).counts.available, 0, 'missing/stale/suspended observations cannot enter research');
}
assert.equal(describeResearchCompletion(clockReport, {primaryAnalysis: {receipts: []}}).state, 'COMPLETE');
console.log('PRIMARY RESEARCH PROGRESS: 15:15 replay = 30 pending / 5 events; unfinished receipts remain publishable without invented evaluations; historical validation, read-only planning and observation freshness preserved.');

// Real 06:00 -> 08:00 handoff, starting with an empty new draft. Available
// selections still need current research even when yesterday's code rated them.
const morningPath = 'data/history/runs/2026-09-07/main-080700.json';
const morning = read(morningPath);
const morningSidecar = read(morningPath.replace('/runs/', '/research-fit/'));
const compactCli = spawnSync(process.execPath, ['tools/major-sport-market-coverage-gate.mjs', 'research-plan', '--report', morningPath, '--sidecar', morningPath.replace('/runs/', '/research-fit/'), '--summary', '--event-id', '63303323'], {encoding: 'utf8'});
assert.equal(compactCli.status, 0, compactCli.stderr);
const compact = JSON.parse(compactCli.stdout);
assert.equal(compact.events.length, 1);
assert.equal(compact.counts.available, 60, 'event detail filtering cannot narrow coverage accounting');
assert.equal(compact.events[0].sharedResearch, undefined, 'compact queue must omit repeated source payloads');
const morningInventory = {selections: morningSidecar.primaryAnalysis.receipts.map(receipt => {
  const [sport, eventId, marketDetail, side] = receipt.selectionId.split('|');
  return {selectionId: receipt.selectionId, sport, eventId, marketDetail, side, quotes: [receipt.quote]};
})};
const inherited = loadPriorPrimaryResearch(process.cwd(), morning, morningInventory);
assert.equal(inherited.bySelection.size, 54);
assert.deepEqual(inherited.warnings, []);
const emptyMorning = {primaryAnalysis: {feedGeneratedAt: morning.feedGeneratedAt, receipts: []}};
const inheritedBytes = JSON.stringify([...inherited.bySelection]);
const handoff = buildPrimaryResearchPlan(morning, emptyMorning, morningInventory, inherited);
const sides = handoff.events.flatMap(event => event.markets.flatMap(market => market.selections));
assert.equal(handoff.counts.pending, 60);
assert.equal(handoff.counts.evaluatedRecorded, 0, 'prior decisions do not become current PASS cards');
assert.equal(sides.filter(side => side.nextAction === 'RESUME_PRIOR_RESEARCH').length, 36);
assert.equal(sides.filter(side => side.nextAction === 'REVALIDATE_PRIOR_RESEARCH').length, 18);
assert.equal(sides.filter(side => side.nextAction === 'START_STAGE_1').length, 6, 'new NCAAF market must start current research');
assert.equal(JSON.stringify([...inherited.bySelection]), inheritedBytes);
assert.equal(emptyMorning.primaryAnalysis.receipts.length, 0);
const angels = handoff.events.find(event => event.eventId === '63303323');
assert.equal(angels.markets.length, 3);
assert.ok(angels.sharedResearch.every(item => item.historical && item.requiresCurrentReview));
assert.ok(angels.sharedResearch.every(item => item.checkedAt.startsWith('2026-09-07T06:18:')));
assert.ok(angels.markets.every(market => market.selections.every(side => side.remainingWork.stage === 'UNSPECIFIED')));
const evaluatedEvent = handoff.events.find(event => event.eventId === '63303047');
assert.ok(evaluatedEvent.sharedResearch.some(item => item.selectionIds.length > 1), 'shared findings must be deduplicated across sides');
assert.equal(loadPriorPrimaryResearch(process.cwd(), {...morning, ts: '2026-09-07T06:00:00-07:00'}, morningInventory).bySelection.size, 0, 'exclude later runs and other Vancouver dates');

// Exact current inventory controls scope. A prior selection cannot resurrect a
// now-missing quote; a new primary line carries only historical context.
const subset = structuredClone(morningInventory);
subset.selections = subset.selections.filter(item => item.eventId === '63303323');
subset.selections.find(item => item.marketDetail === 'full_game_primary_total').quotes[0].line += 1;
const subsetPlan = buildPrimaryResearchPlan(morning, emptyMorning, subset, inherited);
assert.equal(subsetPlan.counts.available, 6);
assert.ok(subsetPlan.events[0].markets.flatMap(market => market.selections).some(side => side.priorResearch.primaryLineChanged));

// A concrete calculation handoff survives the next run with original facts.
const progressed = structuredClone(inherited);
const firstId = subset.selections[0].selectionId;
progressed.bySelection.get(firstId).receipt.blocker.progress = {
  stage: 'FAIR_CONSTRUCTION', nextStep: 'Calculate the current total from checked pitcher workloads and lineup inputs.',
  stoppingReason: 'The pitcher workload input has not yet been translated into the run estimate.'
};
const progressedPlan = buildPrimaryResearchPlan(morning, emptyMorning, subset, progressed);
assert.equal(progressedPlan.events[0].markets.flatMap(market => market.selections).find(side => side.selectionId === firstId).remainingWork.stage, 'FAIR_CONSTRUCTION');

// An index mismatch or duplicate receipt must never leak partly loaded context.
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'research-handoff-'));
try {
  const entry = read('run-history.json').runs.find(run => run.path === 'data/history/runs/2026-09-07/open-061830.json');
  for (const file of [entry.path, entry.researchFitPath]) {
    fs.mkdirSync(path.dirname(path.join(temporary, file)), {recursive: true});
    fs.copyFileSync(file, path.join(temporary, file));
  }
  fs.writeFileSync(path.join(temporary, 'run-history.json'), JSON.stringify({runs: [entry]}));
  const prior = read(path.join(temporary, entry.researchFitPath));
  prior.primaryAnalysis.receipts.push(prior.primaryAnalysis.receipts.at(-1));
  fs.writeFileSync(path.join(temporary, entry.researchFitPath), JSON.stringify(prior));
  const duplicate = loadPriorPrimaryResearch(temporary, morning, morningInventory);
  assert.equal(duplicate.bySelection.size, 0);
  assert.match(duplicate.warnings[0], /duplicate/);
  prior.reportReference.ts = morning.ts;
  fs.writeFileSync(path.join(temporary, entry.researchFitPath), JSON.stringify(prior));
  const mismatch = loadPriorPrimaryResearch(temporary, morning, morningInventory);
  assert.equal(mismatch.bySelection.size, 0);
  assert.match(mismatch.warnings[0], /binding mismatch/);
} finally { fs.rmSync(temporary, {recursive: true, force: true}); }
console.log('MORNING RESEARCH HANDOFF: 36 resume + 18 revalidate + 6 new; no inherited evaluation credit; exact scope, original times, shared facts, progress and corrupt-context handling verified.');
