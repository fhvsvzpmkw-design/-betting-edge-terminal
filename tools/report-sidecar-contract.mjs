#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const DERIVED_FIELDS = Object.freeze([
  'coreAssessment',
  'waltersEvidence',
  'personnelRequired',
  'personnelEvidence',
  'waitQualification'
]);

function die(message) { throw new Error(message); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function writeJson(file, value) { fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }
function clone(value) { return value === undefined ? undefined : structuredClone(value); }
function sameJson(left, right) { return JSON.stringify(left) === JSON.stringify(right); }

function validateAlignment(report, sidecar) {
  if (!report || typeof report !== 'object' || Array.isArray(report)) die('Report must be an object');
  if (!sidecar || typeof sidecar !== 'object' || Array.isArray(sidecar)) die('Sidecar must be an object');
  if (!Array.isArray(report.recs)) die('Report recs must be an array');
  if (!Array.isArray(sidecar.recommendations)) die('Sidecar recommendations must be an array');
  if (sidecar.recommendations.length !== report.recs.length) {
    die(`Sidecar recommendation count ${sidecar.recommendations.length} does not match report ${report.recs.length}`);
  }

  for (let i = 0; i < report.recs.length; i += 1) {
    const rec = report.recs[i];
    const item = sidecar.recommendations[i];
    if (!rec || typeof rec !== 'object' || Array.isArray(rec)) die(`Report recommendation ${i + 1} is invalid`);
    if (!item || typeof item !== 'object' || Array.isArray(item)) die(`Sidecar recommendation ${i + 1} is invalid`);
    if (item.ordinal !== i + 1) die(`Sidecar recommendation ${i + 1} has invalid ordinal`);
    if (item.title !== rec.title) die(`Sidecar recommendation ${i + 1} title does not match report`);
    if (item.status !== rec.status) die(`Sidecar recommendation ${i + 1} status does not match report`);
  }
}

export function normalizeDerivedSidecarFields(report, sidecar) {
  validateAlignment(report, sidecar);
  const normalized = structuredClone(sidecar);

  for (let i = 0; i < report.recs.length; i += 1) {
    const rec = report.recs[i];
    const item = normalized.recommendations[i];
    item.displayText = rec.hist;

    for (const field of DERIVED_FIELDS) {
      if (Object.hasOwn(rec, field)) item[field] = clone(rec[field]);
      else delete item[field];
    }
  }

  return normalized;
}

export function verifyDerivedSidecarFields(report, sidecar) {
  validateAlignment(report, sidecar);

  for (let i = 0; i < report.recs.length; i += 1) {
    const rec = report.recs[i];
    const item = sidecar.recommendations[i];
    if (item.displayText !== rec.hist) die(`Sidecar recommendation ${i + 1} displayText drifted from report.hist`);

    for (const field of DERIVED_FIELDS) {
      const reportHas = Object.hasOwn(rec, field);
      const sidecarHas = Object.hasOwn(item, field);
      if (reportHas !== sidecarHas) die(`Sidecar recommendation ${i + 1} ${field} presence drifted from report`);
      if (reportHas && !sameJson(item[field], rec[field])) {
        die(`Sidecar recommendation ${i + 1} ${field} drifted from report`);
      }
    }
  }

  return true;
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const args = { command };
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (!token.startsWith('--')) die(`Unexpected argument: ${token}`);
    const key = token.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const next = rest[i + 1];
    if (next && !next.startsWith('--')) { args[key] = next; i += 1; }
    else args[key] = true;
  }
  return args;
}

function selfTest() {
  const report = {
    recs: [{
      title: 'Example moneyline',
      status: 'WAIT',
      hist: 'B — example history fit',
      coreAssessment: { frameworkId: 'core-test', modelErrorState: 'ELEVATED' },
      waltersEvidence: { applicable: false, availability: 'NOT_APPLICABLE' },
      personnelRequired: true,
      personnelEvidence: { personnelState: 'PARTIAL' },
      waitQualification: { actionableIfResolved: true, blockers: ['price'], independentSignals: [{ origin: 'team report', finding: 'starter confirmed' }], rationale: 'Recheck at threshold.' }
    }]
  };
  const sidecar = {
    schema: 3,
    recommendations: [{
      ordinal: 1,
      title: 'Example moneyline',
      status: 'WAIT',
      displayText: 'stale',
      coreAssessment: { frameworkId: 'stale' },
      waltersEvidence: { applicable: true },
      personnelRequired: false,
      personnelEvidence: null,
      waitQualification: null,
      priorIds: [],
      synthesisIds: [],
      clusterIds: []
    }]
  };

  const normalized = normalizeDerivedSidecarFields(report, sidecar);
  verifyDerivedSidecarFields(report, normalized);
  assert.equal(normalized.recommendations[0].displayText, report.recs[0].hist);
  assert.deepEqual(normalized.recommendations[0].waitQualification, report.recs[0].waitQualification);
  assert.deepEqual(normalized.recommendations[0].coreAssessment, report.recs[0].coreAssessment);

  const drifted = structuredClone(normalized);
  drifted.recommendations[0].waitQualification.rationale = 'drift';
  assert.throws(() => verifyDerivedSidecarFields(report, drifted), /waitQualification drifted/i);

  const misaligned = structuredClone(sidecar);
  misaligned.recommendations[0].title = 'Wrong card';
  assert.throws(() => normalizeDerivedSidecarFields(report, misaligned), /title does not match/i);

  console.log('REPORT SIDECAR CONTRACT SELF-TEST OK');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.command === 'self-test') { selfTest(); return; }
  if (!['normalize', 'check'].includes(args.command) || !args.report || !args.sidecar) {
    die('Usage: report-sidecar-contract.mjs normalize|check --report FILE --sidecar FILE | self-test');
  }

  const reportFile = path.resolve(args.report);
  const sidecarFile = path.resolve(args.sidecar);
  const report = readJson(reportFile);
  const sidecar = readJson(sidecarFile);

  if (args.command === 'normalize') {
    const normalized = normalizeDerivedSidecarFields(report, sidecar);
    verifyDerivedSidecarFields(report, normalized);
    writeJson(sidecarFile, normalized);
    console.log(`REPORT SIDECAR CONTRACT NORMALIZED ${report.recs.length} recommendation(s)`);
    return;
  }

  verifyDerivedSidecarFields(report, sidecar);
  console.log(`REPORT SIDECAR CONTRACT OK ${report.recs.length} recommendation(s)`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); }
  catch (error) { console.error(`REPORT SIDECAR CONTRACT ERROR: ${error.message}`); process.exit(1); }
}
