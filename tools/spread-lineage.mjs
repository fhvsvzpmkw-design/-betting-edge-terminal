#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const BOOKS = ['Bet365', 'DraftKings'];
const FEED_MAX_AGE_MINUTES = 75;
const QUOTE_MAX_AGE_MINUTES = 30;

function die(message) { throw new Error(message); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function writeJson(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }
function parseMs(value) { const ms = Date.parse(value || ''); return Number.isFinite(ms) ? ms : null; }
function marketKey(market) { return String(market?.marketKey || market?.identity?.marketKey || '').toLowerCase(); }
function isSpreadRec(rec) { return String(rec?.feed?.marketKey || rec?.feed?.market || '').toLowerCase() === 'spread' && rec?.feed?.eventId && rec?.feed?.side && Number.isFinite(Number(rec?.feed?.hdp)); }
function lineFromRaw(raw, side) { const n = Number(raw); if (!Number.isFinite(n)) return null; const line = String(side).toLowerCase() === 'away' ? -n : n; return Object.is(line, -0) ? 0 : line; }
function lineText(value) { const n = Number(value); if (!Number.isFinite(n)) return '—'; return n > 0 ? `+${n}` : String(n); }
function decimalOdds(value) { const n = Number(value); return Number.isFinite(n) && n > 1 ? n : null; }
function americanOdds(value) { const d = decimalOdds(value); if (!d) return null; const n = d >= 2 ? Math.round((d - 1) * 100) : Math.round(-100 / (d - 1)); return n > 0 ? `+${n}` : String(n); }
function implied(value) { const d = decimalOdds(value); return d ? 1 / d : null; }
function ageMinutes(older, newer) { const a = parseMs(older), b = parseMs(newer); if (a === null || b === null) return Infinity; return Math.max(0, (b - a) / 60000); }
function fresh(value, reportTs, limit) { return ageMinutes(value, reportTs) <= limit; }
function recKey(rec) { return `${rec.feed.eventId}|${String(rec.feed.side).toLowerCase()}`; }
function combinedText(rec) { return [rec?.title, rec?.move, rec?.analysis, rec?.price, rec?.source].filter(Boolean).join(' // ').toUpperCase(); }

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

function feedFromGit(root, sha) {
  if (!/^[0-9a-f]{40}$/i.test(String(sha || ''))) return null;
  try {
    const raw = execFileSync('git', ['cat-file', 'blob', sha], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    return JSON.parse(raw);
  } catch { return null; }
}

function loadFeed(root, report, sidecar, feedFile) {
  if (feedFile) return readJson(path.resolve(feedFile));
  const sha = sidecar?.provenance?.feedBlobSha;
  const fromGit = feedFromGit(root, sha);
  if (fromGit) return fromGit;
  const livePath = path.join(root, 'data/live-odds.json');
  if (!fs.existsSync(livePath)) die('Cannot resolve report odds snapshot: data/live-odds.json is missing');
  const live = readJson(livePath);
  if (String(live?.generatedAt || '') !== String(report?.feedGeneratedAt || '')) {
    die(`Cannot resolve exact report odds snapshot: live feed ${live?.generatedAt || 'unknown'} != report ${report?.feedGeneratedAt || 'unknown'}`);
  }
  return live;
}

function allEvents(feed) {
  const map = new Map();
  for (const event of [...(feed?.events || []), ...(feed?.deepMarkets || []), ...(feed?.baseballProps || [])]) {
    const id = String(event?.eventId || event?.identity?.eventId || event?.id || '');
    if (!id) continue;
    if (!map.has(id)) { map.set(id, event); continue; }
    const prior = map.get(id);
    const merged = { ...prior, ...event, bookmakers: { ...(prior?.bookmakers || {}) } };
    for (const [book, markets] of Object.entries(event?.bookmakers || {})) {
      const old = Array.isArray(merged.bookmakers[book]) ? merged.bookmakers[book] : [];
      const add = Array.isArray(markets) ? markets : [];
      const byKey = new Map();
      for (const market of [...old, ...add]) byKey.set(`${marketKey(market)}|${market?.updatedAt || ''}`, market);
      merged.bookmakers[book] = [...byKey.values()];
    }
    map.set(id, merged);
  }
  return map;
}

function primarySpread(event, book, side, reportTs) {
  const markets = event?.bookmakers?.[book];
  if (!Array.isArray(markets)) return null;
  const market = markets.find((item) => marketKey(item) === 'spread');
  if (!market || !fresh(market.updatedAt, reportTs, QUOTE_MAX_AGE_MINUTES)) return null;
  const rows = (market.odds || []).map((row) => {
    const home = decimalOdds(row?.home), away = decimalOdds(row?.away), raw = Number(row?.hdp);
    if (!home || !away || !Number.isFinite(raw)) return null;
    const ph = implied(home), pa = implied(away);
    return { row, raw, home, away, balance: Math.abs(ph - pa), overroundDistance: Math.abs((ph + pa) - 1.05) };
  }).filter(Boolean).sort((a, b) => a.balance - b.balance || a.overroundDistance - b.overroundDistance || Math.abs(a.raw) - Math.abs(b.raw));
  if (!rows.length) return null;
  const picked = rows[0];
  const dec = decimalOdds(picked.row?.[side]);
  if (!dec) return null;
  return {
    book,
    rawHdp: picked.raw,
    displayLine: lineFromRaw(picked.raw, side),
    priceAmerican: americanOdds(dec),
    updatedAt: market.updatedAt
  };
}

function exactFreshQuotes(event, priorRec, reportTs) {
  const out = [];
  const side = String(priorRec.feed.side).toLowerCase();
  const selectionKey = String(priorRec.feed.selectionKey || '');
  const rawHdp = Number(priorRec.feed.hdp);
  for (const book of BOOKS) {
    const markets = event?.bookmakers?.[book];
    if (!Array.isArray(markets)) continue;
    const market = markets.find((item) => marketKey(item) === 'spread');
    if (!market || !fresh(market.updatedAt, reportTs, QUOTE_MAX_AGE_MINUTES)) continue;
    for (const row of market.odds || []) {
      const raw = Number(row?.hdp);
      if (!Number.isFinite(raw) || Math.abs(raw - rawHdp) > 0.001) continue;
      const keys = row?.selectionKeys || row?.identity?.selectionKeys || {};
      if (selectionKey && keys?.[side] && String(keys[side]) !== selectionKey) continue;
      const dec = decimalOdds(row?.[side]);
      if (!dec) continue;
      out.push({ book, rawHdp: raw, displayLine: lineFromRaw(raw, side), priceAmerican: americanOdds(dec), updatedAt: market.updatedAt });
    }
  }
  return out;
}

function priorTrackedSpreads(root, report) {
  const indexPath = path.join(root, 'run-history.json');
  if (!fs.existsSync(indexPath)) return [];
  const index = readJson(indexPath);
  const day = String(report.ts).slice(0, 10);
  const currentMs = parseMs(report.ts);
  const entries = (index?.runs || []).filter((entry) => entry?.date === day && parseMs(entry.ts) < currentMs).sort((a, b) => parseMs(a.ts) - parseMs(b.ts));
  const latest = new Map();
  for (const entry of entries) {
    const file = path.join(root, entry.path || '');
    if (!fs.existsSync(file)) continue;
    const issued = readJson(file);
    for (const rec of issued?.recs || []) {
      if (!isSpreadRec(rec)) continue;
      latest.set(recKey(rec), { rec, sourceTs: issued.ts, sourcePath: entry.path });
    }
  }
  return [...latest.values()];
}

function movementLabel(oldLine, newLine) {
  if (newLine > oldLine + 0.001) return 'LINE MOVED IN FAVOR';
  if (newLine < oldLine - 0.001) return 'LINE MOVED AGAINST';
  return 'PRICE MOVED';
}

function auditLineage({ root, report, sidecar = null, feed = null }) {
  const reportMs = parseMs(report?.ts);
  if (reportMs === null) die('Report ts is invalid');
  if (!feed) feed = loadFeed(root, report, sidecar, null);
  if (String(feed?.generatedAt || '') !== String(report?.feedGeneratedAt || '')) {
    die(`Resolved feed generatedAt ${feed?.generatedAt || 'unknown'} does not match report feedGeneratedAt ${report?.feedGeneratedAt || 'unknown'}`);
  }
  if (!fresh(feed.generatedAt, report.ts, FEED_MAX_AGE_MINUTES)) die(`Report feed is older than ${FEED_MAX_AGE_MINUTES} minutes at issuance`);

  const events = allEvents(feed);
  const currentSpreads = new Map();
  for (const rec of report?.recs || []) if (isSpreadRec(rec)) currentSpreads.set(recKey(rec), rec);

  const diagnostics = [];
  const violations = [];
  for (const tracked of priorTrackedSpreads(root, report)) {
    const prior = tracked.rec;
    const commenceMs = parseMs(prior?.feed?.eventDate);
    if (commenceMs !== null && commenceMs <= reportMs) continue;
    const event = events.get(String(prior.feed.eventId));
    if (!event) {
      diagnostics.push({ eventId: String(prior.feed.eventId), side: prior.feed.side, priorLine: lineFromRaw(prior.feed.hdp, prior.feed.side), state: 'EVENT_NOT_IN_FEED' });
      continue;
    }

    const exact = exactFreshQuotes(event, prior, report.ts);
    if (exact.length) continue;

    const oldLine = lineFromRaw(prior.feed.hdp, prior.feed.side);
    const primaries = BOOKS.map((book) => primarySpread(event, book, String(prior.feed.side).toLowerCase(), report.ts)).filter(Boolean);
    const currentRec = currentSpreads.get(recKey(prior));
    const diagnostic = {
      eventId: String(prior.feed.eventId),
      side: String(prior.feed.side).toLowerCase(),
      priorLine: oldLine,
      priorLineText: lineText(oldLine),
      sourceTs: tracked.sourceTs,
      sourcePath: tracked.sourcePath,
      primary: primaries
    };

    if (!currentRec) {
      diagnostic.state = primaries.length ? 'RECONCILIATION_REQUIRED' : 'UNAVAILABLE_RECONCILIATION_REQUIRED';
      diagnostics.push(diagnostic);
      violations.push(`${prior.title}: tracked ${lineText(oldLine)} spread disappeared from the draft; preserve the same event/side and reconcile it before publication`);
      continue;
    }

    const text = combinedText(currentRec);
    if (!primaries.length) {
      diagnostic.state = 'NO_FRESH_PRIMARY';
      diagnostics.push(diagnostic);
      if (!/(MARKET UNAVAILABLE|PRICE NOT VERIFIED|FEED STALE|IDENTITY MISMATCH)/.test(text)) {
        violations.push(`${prior.title}: exact ${lineText(oldLine)} is not fresh and no fresh primary spread exists; draft must state unavailable/unverified`);
      }
      continue;
    }

    const uniqueLines = [...new Set(primaries.map((item) => item.displayLine))];
    if (uniqueLines.length > 1) {
      diagnostic.state = 'BOOK_CONFLICT';
      diagnostics.push(diagnostic);
      if (!/(CONFLICTING SIGNALS|PRICE NOT VERIFIED)/.test(text)) {
        violations.push(`${prior.title}: Bet365/DraftKings primary spreads disagree (${primaries.map((x) => `${x.book} ${lineText(x.displayLine)}`).join(', ')}); draft must preserve the conflict`);
      }
      continue;
    }

    const newLine = uniqueLines[0];
    const expected = movementLabel(oldLine, newLine);
    diagnostic.state = expected;
    diagnostic.currentLine = newLine;
    diagnostic.currentLineText = lineText(newLine);
    diagnostics.push(diagnostic);
    if (!text.includes(expected)) {
      violations.push(`${prior.title}: expected ${expected} ${lineText(oldLine)} -> ${lineText(newLine)} in draft movement text`);
    }
    if (expected !== 'PRICE MOVED' && (!text.includes(lineText(oldLine).toUpperCase()) || !text.includes(lineText(newLine).toUpperCase()))) {
      violations.push(`${prior.title}: movement text must show archived ${lineText(oldLine)} and current ${lineText(newLine)}`);
    }
  }

  return { ok: violations.length === 0, diagnostics, violations };
}

function fixtureRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'betting-edge-spread-lineage-'));
  writeJson(path.join(root, 'run-history.json'), {
    runs: [{ date: '2026-08-19', ts: '2026-08-19T08:00:00-07:00', slot: 'main', path: 'data/history/runs/2026-08-19/main-080000.json' }]
  });
  writeJson(path.join(root, 'data/history/runs/2026-08-19/main-080000.json'), {
    slot: 'main', ts: '2026-08-19T08:00:00-07:00', feedGeneratedAt: '2026-08-19T14:55:00Z', recs: [{
      status: 'WAIT', title: 'Toronto Tempo +11.5', feed: { eventId: '68096572', marketKey: 'spread', market: 'Spread', side: 'away', hdp: -11.5, selectionKey: '68096572|spread|away||-11.5', eventDate: '2026-08-19T23:30:00Z' }
    }]
  });
  return root;
}

function selfTest() {
  const root = fixtureRoot();
  try {
    const feed = {
      generatedAt: '2026-08-19T16:15:00Z',
      events: [{ id: 68096572, home: 'Washington Mystics', away: 'Toronto Tempo', bookmakers: {
        Bet365: [{ name: 'Spread', marketKey: 'spread', updatedAt: '2026-08-19T16:14:00Z', odds: [
          { hdp: -10.5, home: '1.80', away: '1.95', selectionKeys: { home: '68096572|spread|home||-10.5', away: '68096572|spread|away||-10.5' } },
          { hdp: -11, home: '1.91', away: '1.91', selectionKeys: { home: '68096572|spread|home||-11', away: '68096572|spread|away||-11' } }
        ] }]
      }}]
    };
    const base = { slot: 'final_morning', label: '09:30 FINAL MORNING', ts: '2026-08-19T09:16:00-07:00', feedGeneratedAt: feed.generatedAt, recs: [] };

    const missing = auditLineage({ root, report: base, feed });
    assert.equal(missing.ok, false);
    assert.match(missing.violations.join(' '), /preserve the same event\/side/i);

    const corrected = structuredClone(base);
    corrected.recs = [{
      status: 'WAIT', title: 'Toronto Tempo +11', move: 'LINE MOVED AGAINST — Toronto +11.5 -> +11; current line requires independent requalification', stake: '$0',
      feed: { eventId: '68096572', marketKey: 'spread', market: 'Spread', side: 'away', hdp: -11, selectionKey: '68096572|spread|away||-11', eventDate: '2026-08-19T23:30:00Z' }
    }];
    const passed = auditLineage({ root, report: corrected, feed });
    assert.equal(passed.ok, true, passed.violations.join('; '));
    assert.equal(passed.diagnostics[0].state, 'LINE MOVED AGAINST');
    assert.equal(passed.diagnostics[0].currentLine, 11);

    const conflictFeed = structuredClone(feed);
    conflictFeed.events[0].bookmakers.DraftKings = [{ name: 'Spread', marketKey: 'spread', updatedAt: '2026-08-19T16:14:30Z', odds: [
      { hdp: -10.5, home: '1.91', away: '1.91', selectionKeys: { home: '68096572|spread|home||-10.5', away: '68096572|spread|away||-10.5' } }
    ] }];
    const conflictDraft = structuredClone(base);
    conflictDraft.recs = [{ status: 'WAIT', title: 'Toronto Tempo spread', move: 'CONFLICTING SIGNALS — Bet365 +11 / DraftKings +10.5', feed: { eventId: '68096572', marketKey: 'spread', market: 'Spread', side: 'away', hdp: -11, selectionKey: '68096572|spread|away||-11', eventDate: '2026-08-19T23:30:00Z' } }];
    const conflict = auditLineage({ root, report: conflictDraft, feed: conflictFeed });
    assert.equal(conflict.ok, true, conflict.violations.join('; '));
    assert.equal(conflict.diagnostics[0].state, 'BOOK_CONFLICT');

    console.log('SPREAD LINEAGE SELF-TEST OK');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.command === 'self-test') { selfTest(); return; }
  if (args.command !== 'audit') die('Usage: spread-lineage.mjs audit --report FILE [--sidecar FILE] [--feed FILE] [--root DIR] | self-test');
  if (!args.report) die('audit requires --report FILE');
  const root = path.resolve(args.root || process.cwd());
  const report = readJson(path.resolve(args.report));
  const sidecar = args.sidecar ? readJson(path.resolve(args.sidecar)) : null;
  const feed = args.feed ? readJson(path.resolve(args.feed)) : loadFeed(root, report, sidecar, null);
  const result = auditLineage({ root, report, sidecar, feed });
  for (const item of result.diagnostics) {
    const primary = (item.primary || []).map((x) => `${x.book} ${lineText(x.displayLine)} ${x.priceAmerican || ''}`).join(' / ');
    console.log(`SPREAD LINEAGE ${item.eventId} ${item.side} ${item.priorLineText || ''} // ${item.state}${primary ? ` // ${primary}` : ''}`);
  }
  if (!result.ok) {
    for (const problem of result.violations) console.error(`SPREAD LINEAGE ERROR: ${problem}`);
    process.exit(1);
  }
  console.log(`SPREAD LINEAGE AUDIT OK ${result.diagnostics.length} reconciliation(s)`);
}

try { main(); }
catch (error) { console.error(`SPREAD LINEAGE ERROR: ${error.message}`); process.exit(1); }
