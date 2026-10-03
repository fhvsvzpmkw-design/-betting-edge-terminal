import fs from 'node:fs';

const root = process.cwd();
const report = JSON.parse(fs.readFileSync(`${root}/data/history/runs/2026-10-03/main-081824.json`, 'utf8'));
const sidecar = JSON.parse(fs.readFileSync(`${root}/data/history/research-fit/2026-10-03/main-081824.json`, 'utf8'));

const ts = '2026-10-03T09:30:10-07:00';
const feedGeneratedAt = '2026-10-03T16:24:56.557Z';
Object.assign(report, {
  ts,
  slot: 'final_morning',
  label: '09:30 FINAL MORNING',
  feedGeneratedAt,
  risk: 0,
  counts: {bet: 0, lean: 0, wait: 0, pass: 0},
  summary: 'DRAFT: current primary-market inventory is awaiting event-level review.',
  recs: []
});
delete report.candidateAssessment;
delete report.forecastCoverage;

Object.assign(sidecar.reportReference, {
  ts,
  slot: 'final_morning',
  label: '09:30 FINAL MORNING',
  feedGeneratedAt,
  reportPath: 'data/history/runs/2026-10-03/final_morning-093010.json',
  researchFitPath: 'data/history/research-fit/2026-10-03/final_morning-093010.json'
});
Object.assign(sidecar.provenance, {
  feedBlobSha: '9a0f7e2bd90187c0008c3cea340feca081b07ab9',
  pinnacleObserverBlobSha: '4aaeae8917ff7201c6bd24bfa15930f7df0ce4d8',
  pinnacleGeneratedAt: '2026-10-03T16:24:59.286Z',
  canonicalSlot: 3,
  scheduledPulseTime: '09:20',
  scheduledReportTime: '09:30',
  scheduledLabel: 'FINAL MORNING',
  featuredVigScope: true,
  reportTimestamp: ts,
  pinnacleQualifiedSelectionCount: 110,
  pinnacleBenchmarkQualifiedRecommendationCount: 110
});
sidecar.primaryAnalysis = {schema: 1, feedGeneratedAt, receipts: [], summary: {available: 0, evaluated: 0, blocked: 0}};
sidecar.recommendations = [];
sidecar.forecastEvidence = {schema: 1, records: [], attempts: [], revalidations: []};
delete sidecar.gameIntelligenceInputs;
delete sidecar.candidateAssessment;
delete sidecar.forecastCoverage;
delete sidecar.marketMethodShadow;
delete sidecar.evidenceApplication;

fs.writeFileSync('/tmp/final-report.json', `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync('/tmp/final-sidecar.json', `${JSON.stringify(sidecar, null, 2)}\n`);
