#!/usr/bin/env node
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AUTHORITY_PATH = 'data/major-sport-market-coverage-v1.json';
const PREFERENCES_PATH = 'data/preferences.json';
const EXPECTED_AUTHORITY_ID = 'major-sport-market-coverage-v1';

function die(message) { throw new Error(message); }
function ensure(condition, message) { if (!condition) die(message); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function isObject(value) { return value && typeof value === 'object' && !Array.isArray(value); }
function nonEmpty(value) { return typeof value === 'string' && value.trim().length > 0; }
function int(value, label) { ensure(Number.isInteger(value) && value >= 0, `${label} must be a non-negative integer`); }
function gitBlobSha(buffer) {
  const header = Buffer.from(`blob ${buffer.length}\0`, 'utf8');
  return crypto.createHash('sha1').update(header).update(buffer).digest('hex');
}
function authority(root = process.cwd()) {
  const file = path.join(root, AUTHORITY_PATH);
  const raw = fs.readFileSync(file);
  const policy = JSON.parse(raw.toString('utf8'));
  ensure(policy.schema === 1, 'Major-sport coverage authority schema must be 1');
  ensure(policy.authorityId === EXPECTED_AUTHORITY_ID, 'Major-sport coverage authority id mismatch');
  ensure(policy.state === 'OPERATIONAL', 'Major-sport coverage authority must be OPERATIONAL');
  ensure(isObject(policy.coverageAudit), 'Major-sport coverage authority is missing coverageAudit policy');
  return { policy, blobSha: gitBlobSha(raw) };
}
function cardTarget(root = process.cwd()) {
  const preferences = readJson(path.join(root, PREFERENCES_PATH));
  const module = (preferences.modules || []).find(item => item?.id === 'report_card_target');
  ensure(module, 'report_card_target preference is missing');
  int(module.current, 'report_card_target.current');
  ensure(module.overflowProtection === true, 'report_card_target overflowProtection must be true');
  return module.current;
}

const SELECTIONS_BY_DETAIL = Object.freeze({
  full_game_moneyline: ['home', 'away'],
  full_game_primary_run_line: ['home', 'away'],
  full_game_primary_puck_line: ['home', 'away'],
  full_game_primary_spread: ['home', 'away'],
  full_game_primary_total: ['over', 'under']
});

function allowedDetailsForSport(sport) {
  if (sport === 'MLB') return new Set(['full_game_moneyline', 'full_game_primary_run_line', 'full_game_primary_total']);
  if (sport === 'NHL') return new Set(['full_game_moneyline', 'full_game_primary_puck_line', 'full_game_primary_total']);
  if (sport === 'NBA_WNBA') return new Set(['full_game_moneyline', 'full_game_primary_spread', 'full_game_primary_total']);
  if (['NFL', 'NCAAF', 'CFL'].includes(sport)) return new Set(['full_game_moneyline', 'full_game_primary_spread', 'full_game_primary_total']);
  return new Set();
}

function sumSports(sports, sportKeys) {
  const totals = {
    gamesInScope: 0,
    gamesEvaluated: 0,
    primaryRequired: 0,
    primaryEvaluated: 0,
    primaryUnavailable: 0,
    propsReturned: 0,
    propsScreened: 0,
    seriousPropsDeepReviewed: 0
  };
  for (const key of sportKeys) {
    const row = sports[key];
    totals.gamesInScope += row.gamesInScope;
    totals.gamesEvaluated += row.gamesEvaluated;
    totals.primaryRequired += row.primary.required;
    totals.primaryEvaluated += row.primary.evaluated;
    totals.primaryUnavailable += row.primary.unavailable;
    totals.propsReturned += row.props.returned;
    totals.propsScreened += row.props.screened;
    totals.seriousPropsDeepReviewed += row.props.seriousDeepReviewed;
  }
  return totals;
}

export function validateCoverageAudit(report, sidecar, { root = process.cwd(), requireCurrentAuthority = true } = {}) {
  ensure(isObject(report), 'Coverage gate report must be an object');
  ensure(isObject(sidecar), 'Coverage gate sidecar must be an object');
  const { policy, blobSha } = authority(root);
  const auditPolicy = policy.coverageAudit;
  const cutover = Date.parse(auditPolicy.requiredFrom);
  const reportMs = Date.parse(report.ts || '');
  ensure(Number.isFinite(reportMs), 'Coverage gate report.ts must be parseable');
  if (reportMs < cutover) return { enforced: false, reason: 'pre-cutover' };

  const audit = sidecar[auditPolicy.sidecarField];
  ensure(isObject(audit), `Sidecar ${auditPolicy.sidecarField} is required for reports at/after ${auditPolicy.requiredFrom}`);
  ensure(audit.schema === auditPolicy.schema, 'coverageAudit schema mismatch');
  ensure(audit.authorityId === policy.authorityId, 'coverageAudit authorityId mismatch');
  ensure(audit.authorityPath === AUTHORITY_PATH, 'coverageAudit authorityPath mismatch');
  ensure(/^[0-9a-f]{40}$/i.test(String(audit.authorityBlobSha || '')), 'coverageAudit authorityBlobSha must be a Git SHA');
  if (requireCurrentAuthority) ensure(audit.authorityBlobSha === blobSha, 'coverageAudit authorityBlobSha does not match current operational authority');
  ensure(audit.state === auditPolicy.state, `coverageAudit state must be ${auditPolicy.state}`);
  ensure(audit.feedGeneratedAt === report.feedGeneratedAt, 'coverageAudit feedGeneratedAt must match report.feedGeneratedAt');
  ensure(audit.evaluationOrder === policy.principles.evaluationOrder, 'coverageAudit evaluationOrder mismatch');
  ensure(audit.complete === true, 'coverageAudit complete must be true');

  ensure(isObject(audit.sports), 'coverageAudit.sports must be an object');
  const sportKeys = auditPolicy.sportKeys;
  ensure(Object.keys(audit.sports).length === sportKeys.length, 'coverageAudit.sports must contain exactly the controlled sport keys');
  for (const sport of sportKeys) {
    const row = audit.sports[sport];
    ensure(isObject(row), `coverageAudit.sports.${sport} is required`);
    int(row.gamesInScope, `coverageAudit.sports.${sport}.gamesInScope`);
    int(row.gamesEvaluated, `coverageAudit.sports.${sport}.gamesEvaluated`);
    ensure(row.gamesEvaluated === row.gamesInScope, `coverageAudit.sports.${sport}.gamesEvaluated must equal gamesInScope`);
    ensure(isObject(row.primary), `coverageAudit.sports.${sport}.primary is required`);
    for (const key of ['required', 'evaluated', 'unavailable']) int(row.primary[key], `coverageAudit.sports.${sport}.primary.${key}`);
    ensure(row.primary.required === row.gamesInScope * auditPolicy.primarySelectionsPerGame, `coverageAudit.sports.${sport}.primary.required must equal gamesInScope * ${auditPolicy.primarySelectionsPerGame}`);
    ensure(row.primary.evaluated + row.primary.unavailable === row.primary.required, `coverageAudit.sports.${sport} primary arithmetic does not reconcile`);
    ensure(isObject(row.props), `coverageAudit.sports.${sport}.props is required`);
    for (const key of ['returned', 'screened', 'seriousDeepReviewed']) int(row.props[key], `coverageAudit.sports.${sport}.props.${key}`);
    ensure(row.props.screened === row.props.returned, `coverageAudit.sports.${sport}.props.screened must equal props.returned`);
    ensure(row.props.seriousDeepReviewed <= row.props.screened, `coverageAudit.sports.${sport}.props.seriousDeepReviewed cannot exceed props.screened`);
  }

  ensure(Array.isArray(audit.availabilityLimitations), 'coverageAudit.availabilityLimitations must be an array');
  const allowedReasons = new Set(auditPolicy.availabilityReasonCodes);
  const unavailableTuples = new Set();
  let limitationsSelectionCount = 0;
  for (const [index, item] of audit.availabilityLimitations.entries()) {
    ensure(isObject(item), `coverageAudit.availabilityLimitations[${index}] must be an object`);
    ensure(nonEmpty(item.eventId), `coverageAudit.availabilityLimitations[${index}].eventId is required`);
    ensure(sportKeys.includes(item.sport), `coverageAudit.availabilityLimitations[${index}].sport is invalid`);
    ensure(allowedDetailsForSport(item.sport).has(item.marketDetail), `coverageAudit.availabilityLimitations[${index}].marketDetail is invalid for ${item.sport}`);
    ensure(allowedReasons.has(item.reason), `coverageAudit.availabilityLimitations[${index}].reason is invalid`);
    ensure(Array.isArray(item.selections) && item.selections.length > 0, `coverageAudit.availabilityLimitations[${index}].selections must be non-empty`);
    const permittedSelections = new Set(SELECTIONS_BY_DETAIL[item.marketDetail] || []);
    for (const selection of item.selections) {
      ensure(permittedSelections.has(selection), `coverageAudit.availabilityLimitations[${index}] selection ${selection} is invalid for ${item.marketDetail}`);
      const tuple = `${item.sport}|${item.eventId}|${item.marketDetail}|${selection}`;
      ensure(!unavailableTuples.has(tuple), `coverageAudit availability limitation duplicates ${tuple}`);
      unavailableTuples.add(tuple);
      limitationsSelectionCount++;
    }
  }

  ensure(isObject(audit.presentation), 'coverageAudit.presentation must be an object');
  int(audit.presentation.target, 'coverageAudit.presentation.target');
  ensure(audit.presentation.target === cardTarget(root), 'coverageAudit.presentation.target does not match repository report_card_target');
  ensure(audit.presentation.targetIsSoft === true, 'coverageAudit.presentation.targetIsSoft must be true');
  ensure(audit.presentation.overflowProtection === true, 'coverageAudit.presentation.overflowProtection must be true');
  int(audit.presentation.actionableSuppressedByTarget, 'coverageAudit.presentation.actionableSuppressedByTarget');
  ensure(audit.presentation.actionableSuppressedByTarget === 0, 'coverageAudit may not suppress actionable recommendations to meet the card target');

  ensure(isObject(audit.totals), 'coverageAudit.totals must be an object');
  const calculatedTotals = sumSports(audit.sports, sportKeys);
  for (const [key, expected] of Object.entries(calculatedTotals)) {
    int(audit.totals[key], `coverageAudit.totals.${key}`);
    ensure(audit.totals[key] === expected, `coverageAudit.totals.${key} does not reconcile with sport rows`);
  }
  ensure(limitationsSelectionCount === calculatedTotals.primaryUnavailable, 'coverageAudit availabilityLimitations selection count must equal total primaryUnavailable');

  return { enforced: true, audit, calculatedTotals, authorityBlobSha: blobSha };
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const args = { command };
  for (let i = 0; i < rest.length; i++) {
    const token = rest[i];
    if (!token.startsWith('--')) die(`Unexpected argument: ${token}`);
    const key = token.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const next = rest[i + 1];
    if (next && !next.startsWith('--')) { args[key] = next; i++; }
    else args[key] = true;
  }
  return args;
}

function makeSport(gamesInScope, evaluated, unavailable, propsReturned, serious = 0) {
  return {
    gamesInScope,
    gamesEvaluated: gamesInScope,
    primary: { required: gamesInScope * 6, evaluated, unavailable },
    props: { returned: propsReturned, screened: propsReturned, seriousDeepReviewed: serious }
  };
}

function selfTest() {
  const { policy, blobSha } = authority();
  const report = { ts: policy.coverageAudit.requiredFrom, feedGeneratedAt: '2026-09-02T14:55:00.000Z' };
  const sports = {
    MLB: makeSport(1, 4, 2, 18, 2),
    NHL: makeSport(0, 0, 0, 0),
    NBA_WNBA: makeSport(0, 0, 0, 0),
    NFL: makeSport(0, 0, 0, 0),
    NCAAF: makeSport(0, 0, 0, 0),
    CFL: makeSport(0, 0, 0, 0)
  };
  const totals = sumSports(sports, policy.coverageAudit.sportKeys);
  const sidecar = {
    schema: 3,
    coverageAudit: {
      schema: 1,
      authorityId: policy.authorityId,
      authorityPath: AUTHORITY_PATH,
      authorityBlobSha: blobSha,
      state: 'COMPLETE',
      feedGeneratedAt: report.feedGeneratedAt,
      evaluationOrder: 'EVALUATE_BEFORE_CARD_SELECTION',
      sports,
      availabilityLimitations: [{
        eventId: '63301763',
        sport: 'MLB',
        marketDetail: 'full_game_primary_run_line',
        selections: ['home', 'away'],
        reason: 'MARKET_NOT_RETURNED'
      }],
      presentation: {
        target: cardTarget(),
        targetIsSoft: true,
        overflowProtection: true,
        actionableSuppressedByTarget: 0
      },
      totals,
      complete: true
    }
  };
  const result = validateCoverageAudit(report, sidecar);
  assert.equal(result.enforced, true);
  assert.equal(result.calculatedTotals.primaryUnavailable, 2);

  const badArithmetic = structuredClone(sidecar);
  badArithmetic.coverageAudit.sports.MLB.primary.evaluated = 5;
  assert.throws(() => validateCoverageAudit(report, badArithmetic), /primary arithmetic/i);

  const missingLimitation = structuredClone(sidecar);
  missingLimitation.coverageAudit.availabilityLimitations = [];
  assert.throws(() => validateCoverageAudit(report, missingLimitation), /availabilityLimitations selection count/i);

  const suppressed = structuredClone(sidecar);
  suppressed.coverageAudit.presentation.actionableSuppressedByTarget = 1;
  assert.throws(() => validateCoverageAudit(report, suppressed), /may not suppress actionable/i);

  const preCutover = { ts: '2026-09-02T07:59:59-07:00', feedGeneratedAt: report.feedGeneratedAt };
  assert.equal(validateCoverageAudit(preCutover, { schema: 3 }).enforced, false);

  console.log('MAJOR SPORT COVERAGE GATE SELF-TEST OK');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.command === 'self-test') { selfTest(); return; }
  if (args.command !== 'validate' || !args.report || !args.sidecar) {
    die('Usage: major-sport-market-coverage-gate.mjs validate --report FILE --sidecar FILE | self-test');
  }
  const report = readJson(path.resolve(args.report));
  const sidecar = readJson(path.resolve(args.sidecar));
  const result = validateCoverageAudit(report, sidecar);
  if (!result.enforced) {
    console.log(`MAJOR SPORT COVERAGE GATE PRE-CUTOVER ${report.ts}`);
    return;
  }
  console.log(`MAJOR SPORT COVERAGE GATE OK games=${result.calculatedTotals.gamesInScope} primary=${result.calculatedTotals.primaryRequired} props=${result.calculatedTotals.propsScreened}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); }
  catch (error) { console.error(`MAJOR SPORT COVERAGE GATE ERROR: ${error.message}`); process.exit(1); }
}
