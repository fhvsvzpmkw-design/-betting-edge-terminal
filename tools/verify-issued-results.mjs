#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const GRADES = new Set(['WIN', 'LOSS', 'PUSH', 'VOID']);

function fail(message) {
  console.error(`verify-issued-results: ${message}`);
  process.exit(1);
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { fail(`cannot parse ${file}: ${error.message}`); }
}

function repoPath(file) {
  return path.relative(ROOT, file).split(path.sep).join('/');
}

function defaultOutput(sourcePath) {
  const rel = repoPath(sourcePath);
  if (rel.startsWith('data/history/runs/')) {
    return path.join(ROOT, rel.replace('data/history/runs/', 'data/history/observations/'));
  }
  return path.join(ROOT, 'data/history/observations', path.basename(sourcePath));
}

function parseArgs(argv) {
  const positional = [];
  let output = null;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--output') {
      output = argv[i + 1];
      i += 1;
    } else if (argv[i].startsWith('-')) {
      fail(`unknown argument: ${argv[i]}`);
    } else {
      positional.push(argv[i]);
    }
  }
  if (positional.length !== 2) {
    fail('usage: node tools/verify-issued-results.mjs <issued-run.json> <verification.json> [--output <observations.json>]');
  }
  return { source: positional[0], verification: positional[1], output };
}

function normalizeMarket(value) {
  return String(value || '').trim().toLowerCase();
}

function parseLine(rec) {
  const direct = rec?.feed?.hdp ?? rec?.feed?.line;
  if (Number.isFinite(Number(direct))) return Number(direct);
  const parts = String(rec?.feed?.selectionKey || '').split('|');
  const tail = parts.at(-1);
  return Number.isFinite(Number(tail)) && tail !== '' ? Number(tail) : null;
}

function gradeFromScore(rec, event) {
  const home = Number(event?.homeScore);
  const away = Number(event?.awayScore);
  if (!Number.isFinite(home) || !Number.isFinite(away)) {
    return { grade: null, reason: 'final_score_missing' };
  }

  const market = normalizeMarket(rec?.feed?.marketKey || rec?.feed?.market);
  const side = String(rec?.feed?.side || '').trim().toLowerCase();

  if (market === 'ml' || market === 'moneyline') {
    if (!['home', 'away', 'draw'].includes(side)) return { grade: null, reason: 'unsupported_moneyline_side' };
    if (side === 'draw') return { grade: home === away ? 'WIN' : 'LOSS', method: 'final_score' };
    if (home === away) return { grade: 'LOSS', method: 'final_score' };
    const winner = home > away ? 'home' : 'away';
    return { grade: winner === side ? 'WIN' : 'LOSS', method: 'final_score' };
  }

  if (market === 'spread') {
    if (!['home', 'away'].includes(side)) return { grade: null, reason: 'unsupported_spread_side' };
    const line = parseLine(rec);
    if (!Number.isFinite(line)) return { grade: null, reason: 'spread_line_missing' };
    const selected = side === 'home' ? home : away;
    const opponent = side === 'home' ? away : home;
    const margin = selected + line - opponent;
    if (Math.abs(margin) < 1e-9) return { grade: 'PUSH', method: 'final_score', line };
    return { grade: margin > 0 ? 'WIN' : 'LOSS', method: 'final_score', line };
  }

  if (market === 'totals' || market === 'total') {
    if (!['over', 'under'].includes(side)) return { grade: null, reason: 'unsupported_total_side' };
    const line = parseLine(rec);
    if (!Number.isFinite(line)) return { grade: null, reason: 'total_line_missing' };
    const total = home + away;
    if (Math.abs(total - line) < 1e-9) return { grade: 'PUSH', method: 'final_score', line };
    if (side === 'over') return { grade: total > line ? 'WIN' : 'LOSS', method: 'final_score', line };
    return { grade: total < line ? 'WIN' : 'LOSS', method: 'final_score', line };
  }

  return { grade: null, reason: 'market_requires_exact_selection_verification' };
}

function exactSelectionGrade(rec, event) {
  const key = rec?.feed?.selectionKey;
  if (!key) return null;
  const rows = Array.isArray(event?.selectionOutcomes) ? event.selectionOutcomes : [];
  const match = rows.find((row) => row?.selectionKey === key);
  const grade = String(match?.grade || '').toUpperCase();
  if (!match || !GRADES.has(grade)) return null;
  return {
    grade,
    method: 'exact_selection_verification',
    basis: match.basis || null,
    observedValue: match.observedValue ?? null
  };
}

function skeleton(issued, sourcePath) {
  return {
    schemaVersion: 1,
    kind: 'issued-card-observations',
    sourceRun: repoPath(sourcePath),
    runId: issued.ts,
    slot: issued.slot || null,
    resultMethod: {
      lifecycle: 'ISSUED -> UNRESOLVED -> VERIFIED -> COMPLETE',
      scoreMarkets: ['ml', 'spread', 'totals'],
      unsupportedMarkets: 'remain unresolved unless exact selection verification is supplied',
      officialOnlyWhenStatus: 'BET',
      issuedReportMutable: false
    },
    recommendations: (issued.recs || []).map((rec) => ({
      title: rec.title || null,
      status: rec.status || null,
      book: rec.book || null,
      selectionKey: rec?.feed?.selectionKey || null,
      commenceTime: rec?.feed?.eventDate || null,
      issued: {
        priceAmerican: rec.price || null,
        feedGeneratedAt: issued.feedGeneratedAt || null
      },
      observation: { state: 'unavailable', reason: 'price_not_backfilled' },
      completion: { state: 'unresolved' }
    }))
  };
}

const args = parseArgs(process.argv.slice(2));
const sourcePath = path.resolve(ROOT, args.source);
const verificationPath = path.resolve(ROOT, args.verification);
if (!fs.existsSync(sourcePath)) fail(`issued run not found: ${args.source}`);
if (!fs.existsSync(verificationPath)) fail(`verification file not found: ${args.verification}`);

const issued = readJson(sourcePath);
const verification = readJson(verificationPath);
const outputPath = args.output ? path.resolve(ROOT, args.output) : defaultOutput(sourcePath);
let result = fs.existsSync(outputPath) ? readJson(outputPath) : skeleton(issued, sourcePath);
result.kind = 'issued-card-observations';
result.resultMethod = result.resultMethod || skeleton(issued, sourcePath).resultMethod;

const verifiedAt = verification.verifiedAt || new Date().toISOString();
const globalSource = verification.source || null;
const events = Array.isArray(verification.events) ? verification.events : [];
let completed = 0;
let unresolved = 0;

result.recommendations = (issued.recs || []).map((rec, index) => {
  const existing = result.recommendations?.[index] || skeleton(issued, sourcePath).recommendations[index];
  if (existing?.completion?.state === 'complete') {
    completed += 1;
    return existing;
  }

  const eventId = String(rec?.feed?.eventId || '');
  const event = events.find((row) => String(row?.eventId || '') === eventId);
  if (!event) {
    unresolved += 1;
    return { ...existing, completion: { state: 'unresolved', reason: 'result_not_verified' } };
  }

  const status = String(event.status || '').toLowerCase();
  if (!['final', 'settled', 'complete', 'completed'].includes(status)) {
    unresolved += 1;
    return { ...existing, completion: { state: 'unresolved', reason: 'event_not_final' } };
  }

  const exact = exactSelectionGrade(rec, event);
  const graded = exact || gradeFromScore(rec, event);
  if (!graded.grade) {
    unresolved += 1;
    return { ...existing, completion: { state: 'unresolved', reason: graded.reason } };
  }

  const official = String(rec.status || '').toUpperCase() === 'BET';
  const source = event.source || globalSource;
  completed += 1;
  return {
    ...existing,
    completion: {
      state: 'complete',
      verificationState: 'verified',
      grade: graded.grade,
      official,
      hypothetical: !official,
      verifiedAt,
      eventId: eventId || null,
      finalScore: Number.isFinite(Number(event.homeScore)) && Number.isFinite(Number(event.awayScore)) ? {
        home: event.home || null,
        away: event.away || null,
        homeScore: Number(event.homeScore),
        awayScore: Number(event.awayScore)
      } : null,
      settlementMethod: graded.method,
      line: graded.line ?? null,
      basis: graded.basis ?? null,
      observedValue: graded.observedValue ?? null,
      source: source ? {
        name: source.name || null,
        url: source.url || null
      } : null
    }
  };
});

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(`${repoPath(outputPath)}: ${completed} complete, ${unresolved} unresolved`);
