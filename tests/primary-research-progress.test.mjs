import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {
  buildPrimaryResearchPlan, derivePrimarySelectionInventory,
  RESEARCH_COMPLETION_FROM, validatePrimaryAnalysis, validateResearchCompletion
} from '../tools/major-sport-market-coverage-gate.mjs';

const reportPath = 'data/history/runs/2026-09-06/evening-151930.json';
const sidecarPath = 'data/history/research-fit/2026-09-06/evening-151930.json';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const report = read(reportPath), sidecar = read(sidecarPath);
const policy = read('data/major-sport-market-coverage-v1.json');
const provenance = read('data/history/report-provenance-schema.json');
assert.equal(provenance.primaryAnalysis.researchCompletionFrom, RESEARCH_COMPLETION_FROM);

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
assert.equal(validateResearchCompletion({ts: '2026-09-06T18:14:59-07:00'}, sidecar).enforced, false);
const forwardReport = {...report, ts: RESEARCH_COMPLETION_FROM};
assert.throws(() => validatePrimaryAnalysis(forwardReport, sidecar, {inventory}), /RESEARCH_PENDING: 30 primary selection\(s\) across 5 event\(s\)/, 'identical unfinished work cannot close after the amendment');
assert.throws(() => validateResearchCompletion(forwardReport, sidecar), /do not stage READY/);

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
assert.equal(validateResearchCompletion(clockReport, {primaryAnalysis: {receipts: []}}).enforced, true);
console.log('PRIMARY RESEARCH PROGRESS: 15:15 replay = 30 pending / 5 events; forward completion rejected; historical validation, read-only planning and observation freshness preserved.');
