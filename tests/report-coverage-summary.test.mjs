import assert from 'node:assert/strict';
import fs from 'node:fs';
import {explainUnavailableSelections, deriveReportCoverageSummary} from '../tools/report-coverage-summary.mjs';

const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const report = read('data/history/runs/2026-09-05/late-182130.json');
const sidecar = read('data/history/research-fit/2026-09-05/late-182130.json');
// This archived fixture is pinned by content identity, never today's feed.
import {execFileSync} from 'node:child_process';
const raw = execFileSync('git', ['cat-file','blob',sidecar.provenance.feedBlobSha], {encoding:'utf8',maxBuffer:128*1024*1024});
const feed = JSON.parse(raw);
const before = JSON.stringify({report,sidecar,feed});
const explanation = explainUnavailableSelections(report, sidecar.coverageAudit, feed);
assert.deepEqual(Object.fromEntries(explanation.unavailableReasons.map(row => [row.reason,row.count])), {
  MARKET_NOT_RETURNED:6, STALE_BEYOND_RETENTION:22, STALE_EXECUTABLE_QUOTE:6
});
assert.equal(explanation.unavailableDetails.reduce((n,row) => n + row.selections.length,0),34);
assert.ok(explanation.discoveryOmissions.some(row => row.eventId === '72854572' && row.reason === 'EVENT_NOT_RETURNED'));
assert.equal(deriveReportCoverageSummary(report,sidecar,feed),null,'issued September 5 reports are not rewritten');
assert.equal(JSON.stringify({report,sidecar,feed}),before);

const absentDiagnostic = structuredClone(feed);
delete absentDiagnostic.diagnostics;
const fallback = explainUnavailableSelections(report,sidecar.coverageAudit,absentDiagnostic);
assert.equal(fallback.unavailableReasons.find(row => row.reason === 'MARKET_NOT_RETURNED').count,28,'missing acquisition evidence must not become a proved stale cause');
assert.equal(fallback.discoveryOmissions.length,0);
const corruptedDiagnostic = structuredClone(feed);
const market = corruptedDiagnostic.diagnostics.coreMarketAvailability.find(row => row.eventId === '63302661').markets.totals;
market.updatedAtByBook.Bet365 = feed.generatedAt;
const corrupted = explainUnavailableSelections(report,sidecar.coverageAudit,corruptedDiagnostic);
assert.equal(corrupted.unavailableReasons.find(row => row.reason === 'STALE_BEYOND_RETENTION').count,20,'a label cannot override contradictory timestamps');
console.log('COVERAGE EXPLANATION: exact 18:15 6 retained-stale / 22 pruned-stale / 6 missing; acquisition omissions visible; history unchanged.');
