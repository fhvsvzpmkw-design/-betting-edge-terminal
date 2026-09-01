#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluate, loadProductionFramework, matchCondition, validateContext } from './core-handicap-framework.mjs';
import { auditLiquidityReport, loadLiquidityPolicy } from './core-liquidity-classification.mjs';

function fail(message) { throw new Error(message); }
function assert(condition, message) { if (!condition) fail(message); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function nonEmpty(value) { return typeof value === 'string' && value.trim().length > 0; }
function setEqual(left, right) { return left.size === right.size && [...left].every(value => right.has(value)); }

function expectedResearchIds(framework, context) {
  return [...new Set((framework.graduatedResearchRules || [])
    .filter(rule => matchCondition(rule.when, context))
    .map(rule => rule.priorId))].sort();
}

function compareSetField(errors, index, field, recorded, computed) {
  if (!Array.isArray(recorded)) {
    errors.push(`recommendation ${index + 1} ${field} must be an array`);
    return;
  }
  if (!setEqual(new Set(recorded), new Set(computed))) {
    errors.push(`recommendation ${index + 1} ${field} mismatch: recorded=${JSON.stringify(recorded)} computed=${JSON.stringify(computed)}`);
  }
}

export function auditReport(report, framework = loadProductionFramework()) {
  assert(report && typeof report === 'object' && !Array.isArray(report), 'Report must be an object');
  assert(Array.isArray(report.recs), 'Report recs must be an array');
  const errors = [];

  for (let i = 0; i < report.recs.length; i += 1) {
    const rec = report.recs[i];
    const assessment = rec?.coreAssessment;
    const label = `recommendation ${i + 1} ${rec?.title || 'UNKNOWN'}`;

    if (!assessment || typeof assessment !== 'object' || Array.isArray(assessment)) {
      errors.push(`${label}: coreAssessment is required`);
      continue;
    }
    if (assessment.frameworkId !== framework.frameworkId) {
      errors.push(`${label}: frameworkId mismatch recorded=${assessment.frameworkId || 'MISSING'} expected=${framework.frameworkId}`);
    }
    if (!assessment.context || typeof assessment.context !== 'object' || Array.isArray(assessment.context)) {
      errors.push(`${label}: coreAssessment.context is required`);
      continue;
    }

    try { validateContext(framework, assessment.context, `${label} context`); }
    catch (error) { errors.push(`${label}: ${error.message}`); continue; }

    const expectedIds = expectedResearchIds(framework, assessment.context);
    if (!setEqual(new Set(assessment.context.graduatedResearchIds || []), new Set(expectedIds))) {
      errors.push(`${label}: graduatedResearchIds mismatch recorded=${JSON.stringify(assessment.context.graduatedResearchIds || [])} computed=${JSON.stringify(expectedIds)}`);
    }

    if (!nonEmpty(assessment.fairValueBasisRationale)) errors.push(`${label}: fairValueBasisRationale is required`);
    if (!nonEmpty(assessment.uncertaintyStatement)) errors.push(`${label}: uncertaintyStatement is required`);
    if (!nonEmpty(assessment.rationale)) errors.push(`${label}: rationale is required`);

    const actual = evaluate(framework, assessment.context);
    if (assessment.modelErrorState !== actual.modelErrorState) {
      errors.push(`${label}: modelErrorState mismatch recorded=${assessment.modelErrorState} computed=${actual.modelErrorState}`);
    }
    if (assessment.betEligibleByModelError !== actual.betEligibleByModelError) {
      errors.push(`${label}: betEligibleByModelError mismatch recorded=${assessment.betEligibleByModelError} computed=${actual.betEligibleByModelError}`);
    }
    compareSetField(errors, i, 'effects', assessment.effects, actual.effects);
    compareSetField(errors, i, 'appliedRules', assessment.appliedRules, actual.appliedRules);
    compareSetField(errors, i, 'reasons', assessment.reasons, actual.reasons);
  }

  const liquidityPolicy = loadLiquidityPolicy();
  for (const liquidityError of auditLiquidityReport(report, liquidityPolicy)) {
    errors.push(`liquidity classification: ${liquidityError}`);
  }

  return errors;
}

function syntheticAssessment(framework, context) {
  const normalized = { ...context, graduatedResearchIds: expectedResearchIds(framework, context) };
  const actual = evaluate(framework, normalized);
  return {
    frameworkId: framework.frameworkId,
    context: normalized,
    fairValueBasisRationale: 'Synthetic market-anchored model for trace regression.',
    uncertaintyStatement: 'Synthetic uncertainty statement for trace regression.',
    rationale: 'Synthetic Core assessment trace regression.',
    ...actual
  };
}

function selfTest() {
  const framework = loadProductionFramework();
  loadLiquidityPolicy();
  const panamaContext = {
    sport: 'Basketball',
    marketClass: 'moneyline',
    marketDetail: 'full_game_moneyline',
    timing: 'pregame',
    fairValueBasis: 'MARKET_ANCHORED_MODEL',
    bookDispersion: 'MATERIAL',
    liquidityRisk: 'THIN',
    tailRisk: 'EXTREME',
    directCalibration: 'LIMITED',
    personnelSensitivity: 'UNRESOLVED',
    independentCurrentSupport: 'MODERATE',
    movementPrimaryEvidence: false,
    historicalDirectionalRecalibrationPrimary: false,
    graduatedResearchIds: []
  };
  const assessment = syntheticAssessment(framework, panamaContext);
  const clean = { recs: [{ title: 'Synthetic Panama moneyline', status: 'PASS', coreAssessment: assessment }] };
  assert(auditReport(clean, framework).length === 0, 'Clean Panama-like assessment must pass');
  assert(assessment.appliedRules.includes('base:unresolved-personnel'), 'Panama-like context must apply unresolved-personnel');
  assert(assessment.reasons.includes('Material unresolved participation/role/lineup inputs widen the current distribution.'), 'Panama-like context must include unresolved-personnel reason');

  const missingRule = structuredClone(clean);
  missingRule.recs[0].coreAssessment.appliedRules = missingRule.recs[0].coreAssessment.appliedRules.filter(rule => rule !== 'base:unresolved-personnel');
  assert(auditReport(missingRule, framework).some(error => error.includes('appliedRules mismatch')), 'Missing unresolved-personnel appliedRule must fail');

  const missingReason = structuredClone(clean);
  missingReason.recs[0].coreAssessment.reasons = missingReason.recs[0].coreAssessment.reasons.filter(reason => reason !== 'Material unresolved participation/role/lineup inputs widen the current distribution.');
  assert(auditReport(missingReason, framework).some(error => error.includes('reasons mismatch')), 'Missing unresolved-personnel reason must fail');

  const twoBad = { recs: [missingRule.recs[0], missingReason.recs[0]] };
  const allErrors = auditReport(twoBad, framework);
  assert(allErrors.some(error => error.startsWith('recommendation 1')), 'Aggregate audit must retain recommendation 1 defect');
  assert(allErrors.some(error => error.startsWith('recommendation 2')), 'Aggregate audit must retain recommendation 2 defect');

  const mlbBase = {
    sport: 'MLB',
    marketClass: 'moneyline',
    marketDetail: 'full_game_moneyline',
    timing: 'pregame',
    fairValueBasis: 'MARKET_ANCHORED_MODEL',
    bookDispersion: 'NONE',
    liquidityRisk: 'NORMAL',
    tailRisk: 'NORMAL',
    directCalibration: 'DIRECT',
    personnelSensitivity: 'RESOLVED',
    independentCurrentSupport: 'STRONG',
    movementPrimaryEvidence: false,
    historicalDirectionalRecalibrationPrimary: false,
    graduatedResearchIds: []
  };
  const mlbNormal = { recs: [{ title: 'Synthetic MLB moneyline', status: 'PASS', coreAssessment: syntheticAssessment(framework, mlbBase) }] };
  assert(auditReport(mlbNormal, framework).length === 0, 'Mainstream MLB full-game moneyline with NORMAL liquidity must pass');
  const mlbThinContext = { ...mlbBase, liquidityRisk: 'THIN' };
  const mlbThin = { recs: [{ title: 'Synthetic MLB moneyline', status: 'PASS', coreAssessment: syntheticAssessment(framework, mlbThinContext) }] };
  assert(auditReport(mlbThin, framework).some(error => error.includes('mlb-primary-moneyline-normal')), 'Mainstream MLB full-game moneyline with THIN liquidity must fail');

  console.log('CORE ASSESSMENT TRACE SELF-TEST OK');
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const args = { command };
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (!token.startsWith('--')) fail(`Unexpected argument ${token}`);
    const key = token.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const next = rest[i + 1];
    if (next && !next.startsWith('--')) { args[key] = next; i += 1; }
    else args[key] = true;
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.command === 'self-test') { selfTest(); return; }
  if (args.command !== 'validate' || !args.report) {
    fail('Usage: core-assessment-trace-gate.mjs validate --report FILE | self-test');
  }
  const report = readJson(path.resolve(args.report));
  const errors = auditReport(report);
  if (errors.length) {
    fail(`Core assessment trace contains ${errors.length} defect(s):\n- ${errors.join('\n- ')}`);
  }
  console.log(`CORE ASSESSMENT TRACE OK ${report.recs.length} recommendation(s)`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); }
  catch (error) { console.error(`CORE ASSESSMENT TRACE ERROR: ${error.message}`); process.exit(1); }
}
